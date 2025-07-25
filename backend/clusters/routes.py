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
    get_identity_files_dir,
)
from auth.utils import verify_auth
from typing import Optional

router = APIRouter(prefix="/clusters")


@router.get("", response_model=ClustersListResponse)
async def list_clusters(request: Request, response: Response):
    user = verify_auth(request, response)
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
):
    current_user = verify_auth(request, response)
    identity_file_path = None
    if identity_file and identity_file.filename:
        file_content = await identity_file.read()
        identity_file_path = save_identity_file(file_content, identity_file.filename)
    create_cluster_in_pools(
        cluster_name,
        user,
        identity_file_path,
        password,
    )
    return ClusterResponse(cluster_name=cluster_name, nodes=[])


@router.get("/{cluster_name}", response_model=ClusterResponse)
async def get_cluster(cluster_name: str, request: Request, response: Response):
    user = verify_auth(request, response)
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
):
    current_user = verify_auth(request, response)
    identity_file_path = None
    if identity_file and identity_file.filename:
        file_content = await identity_file.read()
        identity_file_path = save_identity_file(file_content, identity_file.filename)
    node = SSHNode(
        ip=ip, user=user, identity_file=identity_file_path, password=password
    )
    cluster_config = add_node_to_cluster(cluster_name, node, background_tasks)
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
    user = verify_auth(request, response)
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    cluster_config = pools[cluster_name]
    if "identity_file" in cluster_config:
        cleanup_identity_file(cluster_config["identity_file"])
    for host in cluster_config.get("hosts", []):
        if "identity_file" in host:
            cleanup_identity_file(host["identity_file"])
    del pools[cluster_name]
    save_ssh_node_pools(pools)
    return {"message": f"Cluster '{cluster_name}' deleted successfully"}


@router.delete("/{cluster_name}/nodes/{node_ip}")
async def remove_node(
    cluster_name: str, node_ip: str, request: Request, response: Response
):
    user = verify_auth(request, response)
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    hosts = pools[cluster_name].get("hosts", [])
    original_length = len(hosts)
    node_to_remove = None
    for host in hosts:
        if host.get("ip") == node_ip:
            node_to_remove = host
            break
    if node_to_remove and "identity_file" in node_to_remove:
        cleanup_identity_file(node_to_remove["identity_file"])
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


@router.get("/identity-files")
async def list_identity_files(request: Request, response: Response):
    user = verify_auth(request, response)
    try:
        identity_dir = get_identity_files_dir()
        files = []
        for file_path in identity_dir.iterdir():
            if file_path.is_file():
                stat_info = file_path.stat()
                files.append(
                    {
                        "filename": file_path.name,
                        "path": str(file_path),
                        "size": stat_info.st_size,
                        "permissions": oct(stat_info.st_mode)[-3:],
                        "created": stat_info.st_ctime,
                    }
                )
        return {"identity_files": files}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list identity files: {str(e)}"
        )
