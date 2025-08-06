from fastapi import (
    APIRouter,
    Form,
    UploadFile,
    Depends,
    HTTPException,
    Request,
    Response,
    BackgroundTasks,
)
from models import ClusterResponse, ClustersListResponse, SSHNode
from clusters.utils import create_cluster_in_pools, add_node_to_cluster
from utils.file_utils import (
    load_ssh_node_pools,
    save_ssh_node_pools,
    cleanup_identity_file,
    save_identity_file,
    save_named_identity_file,
    get_available_identity_files,
    delete_named_identity_file,
    rename_identity_file,
    get_identity_files_dir,
)
from auth.api_key_auth import get_user_or_api_key
from auth.utils import get_current_user
from reports.utils import record_availability
from typing import Optional

router = APIRouter(prefix="/clusters", dependencies=[Depends(get_user_or_api_key)])


@router.get("", response_model=ClustersListResponse)
async def list_clusters(request: Request, response: Response):
    pools = load_ssh_node_pools()
    return ClustersListResponse(clusters=list(pools.keys()))


@router.post("", response_model=ClusterResponse)
async def create_cluster(
    request: Request,
    response: Response,
    cluster_name: str = Form(...),
    user: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    identity_file: Optional[UploadFile] = None,
    identity_file_path: Optional[str] = Form(None),
):
    identity_file_path_final = None
    if identity_file and identity_file.filename:
        file_content = await identity_file.read()
        identity_file_path_final = save_identity_file(
            file_content, identity_file.filename
        )
    elif identity_file_path:
        # Use the selected identity file path
        identity_file_path_final = identity_file_path
    create_cluster_in_pools(
        cluster_name,
        user,
        identity_file_path_final,
        password,
    )
    return ClusterResponse(cluster_name=cluster_name, nodes=[])


@router.get("/identity-files")
async def list_identity_files(request: Request, response: Response):
    try:
        files = get_available_identity_files()
        return {"identity_files": files}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list identity files: {str(e)}"
        )


@router.post("/identity-files")
async def upload_identity_file(
    request: Request,
    response: Response,
    display_name: str = Form(...),
    identity_file: UploadFile = Form(...),
):
    try:
        if not identity_file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        file_content = await identity_file.read()
        file_path = save_named_identity_file(
            file_content, identity_file.filename, display_name
        )

        return {
            "message": "Identity file uploaded successfully",
            "file_path": file_path,
            "display_name": display_name,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to upload identity file: {str(e)}"
        )


@router.delete("/identity-files/{file_path:path}")
async def delete_identity_file(
    request: Request,
    response: Response,
    file_path: str,
):
    try:
        # URL decode the file path
        import urllib.parse

        decoded_path = urllib.parse.unquote(file_path)

        delete_named_identity_file(decoded_path)
        return {"message": "Identity file deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete identity file: {str(e)}"
        )


@router.put("/identity-files/{file_path:path}")
async def rename_identity_file_route(
    request: Request,
    response: Response,
    file_path: str,
    new_display_name: str = Form(...),
):
    try:
        # URL decode the file path
        import urllib.parse

        decoded_path = urllib.parse.unquote(file_path)

        rename_identity_file(decoded_path, new_display_name)
        return {"message": "Identity file renamed successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to rename identity file: {str(e)}"
        )


@router.get("/{cluster_name}", response_model=ClusterResponse)
async def get_cluster(cluster_name: str, request: Request, response: Response):
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    cluster_config = pools[cluster_name]
    nodes = []
    for host in cluster_config.get("hosts", []):
        node = SSHNode(
            ip=host["ip"],
            user=host["user"],
            identity_file=host.get("identity_file"),
            password=host.get("password"),
        )
        nodes.append(node)
    return ClusterResponse(cluster_name=cluster_name, nodes=nodes)


@router.post("/{cluster_name}/nodes")
async def add_node(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    cluster_name: str,
    ip: str = Form(...),
    user: str = Form(...),
    password: Optional[str] = Form(None),
    identity_file: Optional[UploadFile] = None,
    identity_file_path: Optional[str] = Form(None),
):
    identity_file_path_final = None
    if identity_file and identity_file.filename:
        file_content = await identity_file.read()
        identity_file_path_final = save_identity_file(
            file_content, identity_file.filename
        )
    elif identity_file_path:
        # Use the selected identity file path
        identity_file_path_final = identity_file_path
    node = SSHNode(
        ip=ip, user=user, identity_file=identity_file_path_final, password=password
    )
    cluster_config = add_node_to_cluster(cluster_name, node, background_tasks)
    
    # Record availability event
    try:
        user_info = get_current_user(request, response)
        user_id = user_info["id"]
        total_nodes = len(cluster_config.get("hosts", []))
        available_nodes = total_nodes  # All nodes are available when added
        record_availability(
            user_id=user_id,
            cluster_name=cluster_name,
            availability_type="node_added",
            total_nodes=total_nodes,
            available_nodes=available_nodes,
            node_ip=ip
        )
    except Exception as e:
        print(f"Warning: Failed to record availability event: {e}")
    
    nodes = []
    for host in cluster_config.get("hosts", []):
        node_obj = SSHNode(
            ip=host["ip"],
            user=host["user"],
            identity_file=host.get("identity_file"),
            password=host.get("password"),
        )
        nodes.append(node_obj)
    return ClusterResponse(cluster_name=cluster_name, nodes=nodes)


@router.delete("/{cluster_name}")
async def delete_cluster(cluster_name: str, request: Request, response: Response):
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    # Remove cluster from pools without deleting identity files
    del pools[cluster_name]
    save_ssh_node_pools(pools)
    return {"message": f"Cluster '{cluster_name}' deleted successfully"}


@router.delete("/{cluster_name}/nodes/{node_ip}")
async def remove_node(
    cluster_name: str, node_ip: str, request: Request, response: Response
):
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    hosts = pools[cluster_name].get("hosts", [])
    original_length = len(hosts)
    # Remove node without deleting its identity file
    pools[cluster_name]["hosts"] = [host for host in hosts if host.get("ip") != node_ip]
    if len(pools[cluster_name]["hosts"]) == original_length:
        raise HTTPException(
            status_code=404,
            detail=f"Node with IP '{node_ip}' not found in cluster '{cluster_name}'",
        )
    save_ssh_node_pools(pools)
    return {
        "message": f"Node with IP '{node_ip}' removed from cluster '{cluster_name}' successfully"
    }
