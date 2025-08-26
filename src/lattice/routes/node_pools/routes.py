from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from models import ClusterResponse, ClustersListResponse, SSHNode
from routes.auth.api_key_auth import get_user_or_api_key
from routes.auth.utils import get_current_user
from routes.clouds.azure.utils import az_get_current_config, load_azure_config
from routes.clouds.runpod.utils import load_runpod_config, rp_get_current_config
from routes.instances.utils import get_skypilot_status, fetch_and_parse_gpu_resources
from routes.reports.utils import record_availability
from utils.cluster_utils import get_cluster_platform_info, get_display_name_from_actual
from utils.file_utils import (
    delete_named_identity_file,
    get_available_identity_files,
    load_ssh_node_info,
    rename_identity_file,
    save_identity_file,
    save_named_identity_file,
)

from models import NodePoolGPUResourcesResponse
from werkzeug.utils import secure_filename

from .utils import (
    add_node_to_cluster,
    create_cluster_in_pools,
    delete_cluster_in_pools,
    remove_node_from_cluster,
    get_cluster_config_from_db,
    list_cluster_names_from_db,
    trigger_gpu_resource_updates_for_user,
    get_cached_gpu_resources,
)
from config import get_db
from db_models import SSHNodePool as SSHNodePoolDB
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/node-pools",
    dependencies=[Depends(get_user_or_api_key)],
    tags=["node-pools"],
)


@router.get("/")
async def get_node_pools(
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """
    Get comprehensive node pools data combining:
    - Clusters from /clusters endpoint
    - RunPod instances from /clouds/runpod/instances
    - Azure instances from /clouds/azure/instances
    - SSH node info from /skypilot/ssh-node-info
    - SkyPilot status from /instances/status
    """
    try:
        # Initialize response structure
        response_data = {
            "node_pools": [],
            "instances": {
                "current_count": 0,
                "max_instances": 0,
                "can_launch": True,
            },
            "ssh_node_info": {},
            "sky_pilot_status": [],
        }

        # 1. Get clusters from /node-pools/ssh-node-pools endpoint (will be added to node_pools as direct provider)
        # Note: SSH clusters will be added to node_pools array below

        # 2. Get aggregated instances data (combining all cloud providers)
        try:
            skyPilotStatus = get_skypilot_status()

            # Count all cloud clusters (non-SSH clusters) that belong to the current user
            cloud_clusters = []
            for cluster in skyPilotStatus:
                cluster_name = cluster.get("name", "")
                platform_info = get_cluster_platform_info(cluster_name)

                # Check if this is a cloud cluster
                if platform_info and platform_info.get("platform") in [
                    "runpod",
                    "azure",
                ]:
                    # Only include clusters that belong to the current user and organization
                    if (
                        platform_info.get("user_id") == user["id"]
                        and platform_info.get("organization_id")
                        == user["organization_id"]
                    ):
                        cloud_clusters.append(cluster)

            # Get total max instances from all cloud providers
            total_max_instances = 0

            # Add RunPod max instances
            try:
                runpod_config = rp_get_current_config()
                if runpod_config:
                    total_max_instances += runpod_config.get("max_instances", 0)
            except Exception as e:
                print(f"Error getting RunPod config: {e}")

            # Add Azure max instances
            try:
                azure_config = az_get_current_config()
                if azure_config:
                    total_max_instances += azure_config.get("max_instances", 0)
            except Exception as e:
                print(f"Error getting Azure config: {e}")

            current_count = len(cloud_clusters)

            response_data["instances"] = {
                "current_count": current_count,
                "max_instances": total_max_instances,
                "can_launch": total_max_instances == 0
                or current_count < total_max_instances,
            }
        except Exception as e:
            print(f"Error loading instances data: {e}")

        # 4. Get SSH node info and trigger background GPU resource updates
        try:
            # Trigger background GPU resource updates for all SSH node pools
            trigger_gpu_resource_updates_for_user(user["id"], user["organization_id"])

            # Build comprehensive SSH node info from database with cached GPU data
            ssh_node_info = {}
            # Get SSH node pools that belong to the user's organization
            user_ssh_pools = (
                db.query(SSHNodePoolDB)
                .filter(SSHNodePoolDB.organization_id == user["organization_id"])
                .all()
            )

            for pool in user_ssh_pools:
                cluster_name = pool.name
                cfg = get_cluster_config_from_db(cluster_name)
                cached_gpu_resources = get_cached_gpu_resources(cluster_name)

                ssh_node_info[cluster_name] = {
                    "hosts": cfg.get("hosts", []),
                    "gpu_resources": cached_gpu_resources,
                }

            response_data["ssh_node_info"] = ssh_node_info
        except Exception as e:
            print(f"Error loading SSH node info: {e}")
            response_data["ssh_node_info"] = {}
            # try:
            #     node_info = load_ssh_node_info()
            #     response_data["ssh_node_info"] = node_info
            # except Exception as fallback_e:
            #     print(f"Error loading fallback SSH node info: {fallback_e}")
            #     response_data["ssh_node_info"] = {}

        # 5. Get SkyPilot status (filtered by user and with display names)
        try:
            cluster_records = get_skypilot_status()
            filtered_status = []

            for record in cluster_records:
                cluster_name = record.get("name", "")
                platform_info = get_cluster_platform_info(cluster_name)

                # Only include clusters that belong to the current user and organization
                if platform_info and (
                    platform_info.get("user_id") == user["id"]
                    and platform_info.get("organization_id") == user["organization_id"]
                ):
                    # Get display name for the response
                    display_name = get_display_name_from_actual(cluster_name)
                    if not display_name:
                        display_name = cluster_name  # Fallback to actual name

                    # Create a copy of the record with display name
                    filtered_record = record.copy()
                    filtered_record["name"] = display_name
                    filtered_status.append(filtered_record)

            response_data["sky_pilot_status"] = filtered_status
        except Exception as e:
            print(f"Error loading SkyPilot status: {e}")

        # 6. Get comprehensive node pools (combining all platforms)
        try:
            node_pools = []

            # Get Azure configs
            try:
                azure_config_data = load_azure_config()
                if azure_config_data.get("configs"):
                    for config_key, config in azure_config_data["configs"].items():
                        # Get current Azure instances for this config (filtered by user)
                        azure_instances = 0
                        for cluster in skyPilotStatus:
                            cluster_name = cluster.get("name", "")
                            platform_info = get_cluster_platform_info(cluster_name)
                            if (
                                platform_info
                                and platform_info.get("platform") == "azure"
                            ):
                                # Only count clusters that belong to the current user and organization
                                if (
                                    platform_info.get("user_id") == user["id"]
                                    and platform_info.get("organization_id")
                                    == user["organization_id"]
                                ):
                                    azure_instances += 1

                        node_pools.append(
                            {
                                "name": config.get("name", "Azure Pool"),
                                "type": "cloud",
                                "provider": "azure",
                                "max_instances": config.get("max_instances", 0),
                                "current_instances": azure_instances,
                                "can_launch": config.get("max_instances", 0) == 0
                                or azure_instances < config.get("max_instances", 0),
                                "status": "enabled"
                                if azure_config_data.get("is_configured", False)
                                else "disabled",
                                "access": ["Admin"],
                                "config": {
                                    "is_configured": azure_config_data.get(
                                        "is_configured", False
                                    ),
                                    "config_key": config_key,
                                    "is_default": azure_config_data.get(
                                        "default_config"
                                    )
                                    == config_key,
                                    "allowed_instance_types": config.get(
                                        "allowed_instance_types", []
                                    ),
                                    "allowed_regions": config.get(
                                        "allowed_regions", []
                                    ),
                                },
                            }
                        )
            except Exception as e:
                print(f"Error loading Azure config: {e}")

            # Get RunPod configs
            try:
                runpod_config_data = load_runpod_config()
                if runpod_config_data.get("configs"):
                    for config_key, config in runpod_config_data["configs"].items():
                        # Get current RunPod instances for this config (filtered by user)
                        runpod_instances = 0
                        for cluster in skyPilotStatus:
                            cluster_name = cluster.get("name", "")
                            platform_info = get_cluster_platform_info(cluster_name)
                            if (
                                platform_info
                                and platform_info.get("platform") == "runpod"
                            ):
                                # Only count clusters that belong to the current user and organization
                                if (
                                    platform_info.get("user_id") == user["id"]
                                    and platform_info.get("organization_id")
                                    == user["organization_id"]
                                ):
                                    runpod_instances += 1

                        node_pools.append(
                            {
                                "name": config.get("name", "RunPod Pool"),
                                "type": "cloud",
                                "provider": "runpod",
                                "max_instances": config.get("max_instances", 0),
                                "current_instances": runpod_instances,
                                "can_launch": config.get("max_instances", 0) == 0
                                or runpod_instances < config.get("max_instances", 0),
                                "status": "enabled"
                                if runpod_config_data.get("is_configured", False)
                                else "disabled",
                                "access": ["Admin"],
                                "config": {
                                    "is_configured": runpod_config_data.get(
                                        "is_configured", False
                                    ),
                                    "config_key": config_key,
                                    "is_default": runpod_config_data.get(
                                        "default_config"
                                    )
                                    == config_key,
                                    "allowed_gpu_types": config.get(
                                        "allowed_gpu_types", []
                                    ),
                                },
                            }
                        )
            except Exception as e:
                print(f"Error loading RunPod config: {e}")

            # Get SSH clusters
            try:
                # Get SSH node pools that belong to the user's organization
                user_ssh_pools = (
                    db.query(SSHNodePoolDB)
                    .filter(SSHNodePoolDB.organization_id == user["organization_id"])
                    .all()
                )

                for pool in user_ssh_pools:
                    cluster_name = pool.name
                    cfg = get_cluster_config_from_db(cluster_name)
                    hosts_count = len(cfg.get("hosts", []))

                    # Find active clusters that use this node pool as platform
                    active_clusters = []
                    ssh_instances_for_user = 0
                    for cluster in skyPilotStatus:
                        sky_cluster_name = cluster.get("name", "")
                        platform_info = get_cluster_platform_info(sky_cluster_name)

                        # Check if this cluster uses this node pool as platform
                        if (
                            platform_info
                            and platform_info.get("platform") == cluster_name
                        ):
                            # Only include clusters that belong to the current user and organization
                            if (
                                platform_info.get("user_id") == user["id"]
                                and platform_info.get("organization_id")
                                == user["organization_id"]
                            ):
                                # Get display name for the response
                                display_name = get_display_name_from_actual(
                                    sky_cluster_name
                                )
                                if not display_name:
                                    display_name = (
                                        sky_cluster_name  # Fallback to actual name
                                    )

                                active_clusters.append(
                                    {
                                        "cluster_name": display_name,  # Return display name
                                        "status": cluster.get("status"),
                                        "user_info": platform_info.get("user_info", {}),
                                    }
                                )
                                ssh_instances_for_user += 1

                    node_pools.append(
                        {
                            "name": cluster_name,
                            "type": "direct",
                            "provider": "direct",
                            "max_instances": hosts_count,
                            "current_instances": hosts_count,
                            "can_launch": True,
                            "status": "enabled",
                            "access": ["Admin"],
                            "config": {
                                "is_configured": True,
                                "hosts": cfg.get("hosts", []),
                            },
                            "active_clusters": active_clusters,
                            "user_instances": ssh_instances_for_user,
                        }
                    )
            except Exception as e:
                print(f"Error loading SSH clusters: {e}")

            response_data["node_pools"] = node_pools
        except Exception as e:
            print(f"Error loading node pools: {e}")

        return response_data

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get node pools data: {str(e)}"
        )


@router.get("/ssh-node-pools", response_model=ClustersListResponse)
async def list_clusters(
    request: Request, response: Response, user: dict = Depends(get_user_or_api_key)
):
    from routes.node_pools.utils import list_cluster_names_from_db_by_org

    return ClustersListResponse(
        clusters=list_cluster_names_from_db_by_org(user["organization_id"])
    )


@router.post("/ssh-node-pools", response_model=ClusterResponse)
async def create_cluster(
    request: Request,
    response: Response,
    cluster_name: str = Form(...),
    user: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    identity_file: Optional[UploadFile] = None,
    identity_file_path: Optional[str] = Form(None),
    vcpus: Optional[str] = Form(None),
    memory_gb: Optional[str] = Form(None),
    logged_user: dict = Depends(get_user_or_api_key),
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

    # Build resources dict if vcpus or memory_gb are provided
    resources = None
    if vcpus or memory_gb:
        resources = {}
        if vcpus:
            resources["vcpus"] = vcpus
        if memory_gb:
            resources["memory_gb"] = memory_gb

    cluster_name = secure_filename(cluster_name)
    create_cluster_in_pools(
        cluster_name,
        user,
        identity_file_path_final,
        password,
        resources,
        logged_user["id"],
        logged_user["organization_id"],
    )
    return ClusterResponse(cluster_name=cluster_name, nodes=[])


@router.get("/ssh-node-pools/identity-files")
async def list_identity_files(request: Request, response: Response):
    try:
        files = get_available_identity_files()
        return {"identity_files": files}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list identity files: {str(e)}"
        )


@router.post("/ssh-node-pools/identity-files")
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


@router.delete("/ssh-node-pools/identity-files/{file_path:path}")
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


@router.put("/ssh-node-pools/identity-files/{file_path:path}")
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


@router.get("/ssh-node-pools/{cluster_name}", response_model=ClusterResponse)
async def get_cluster(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    from lattice.routes.node_pools.utils import get_cluster_config_from_db

    # Check if user has access to this node pool
    pool = (
        db.query(SSHNodePoolDB)
        .filter(
            SSHNodePoolDB.name == cluster_name,
            SSHNodePoolDB.organization_id == user["organization_id"],
        )
        .first()
    )

    if not pool:
        raise HTTPException(
            status_code=404,
            detail=f"SSH node pool '{cluster_name}' not found or access denied",
        )

    cfg = get_cluster_config_from_db(cluster_name)
    nodes = [
        SSHNode(
            ip=host["ip"],
            user=host.get("user"),
            identity_file=host.get("identity_file"),
            password=host.get("password"),
            resources=host.get("resources"),
        )
        for host in cfg.get("hosts", [])
    ]

    # Get cached GPU resources for this node pool
    cached_gpu_resources = get_cached_gpu_resources(cluster_name)

    # Create response with additional GPU data
    response = ClusterResponse(cluster_name=cluster_name, nodes=nodes)

    # Add GPU resources to response if available
    if cached_gpu_resources:
        # Since ClusterResponse doesn't have a field for GPU data,
        # we'll need to return a custom response
        return {
            "cluster_name": cluster_name,
            "nodes": [node.dict() for node in nodes],
            "gpu_resources": cached_gpu_resources,
        }

    return response


@router.post("/ssh-node-pools/{cluster_name}/nodes")
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
    vcpus: Optional[str] = Form(None),
    memory_gb: Optional[str] = Form(None),
    current_user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    # Check if user has access to this node pool
    pool = (
        db.query(SSHNodePoolDB)
        .filter(
            SSHNodePoolDB.name == cluster_name,
            SSHNodePoolDB.organization_id == current_user["organization_id"],
        )
        .first()
    )

    if not pool:
        raise HTTPException(
            status_code=404,
            detail=f"SSH node pool '{cluster_name}' not found or access denied",
        )
    identity_file_path_final = None
    if identity_file and identity_file.filename:
        file_content = await identity_file.read()
        identity_file_path_final = save_identity_file(
            file_content, identity_file.filename
        )
    elif identity_file_path:
        # Use the selected identity file path
        identity_file_path_final = identity_file_path

    # Build resources dict if vcpus or memory_gb are provided
    resources = None
    if vcpus or memory_gb:
        resources = {}
        if vcpus:
            resources["vcpus"] = vcpus
        if memory_gb:
            resources["memory_gb"] = memory_gb

    node = SSHNode(
        ip=ip,
        user=user,
        identity_file=identity_file_path_final,
        password=password,
        resources=resources,
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
            node_ip=ip,
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
            resources=host.get("resources"),
        )
        nodes.append(node_obj)
    return ClusterResponse(cluster_name=cluster_name, nodes=nodes)


@router.delete("/ssh-node-pools/{cluster_name}")
async def delete_cluster(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    # Check if user has access to this node pool
    pool = (
        db.query(SSHNodePoolDB)
        .filter(
            SSHNodePoolDB.name == cluster_name,
            SSHNodePoolDB.organization_id == user["organization_id"],
        )
        .first()
    )

    if not pool:
        raise HTTPException(
            status_code=404,
            detail=f"SSH node pool '{cluster_name}' not found or access denied",
        )

    delete_cluster_in_pools(cluster_name)
    return {"message": f"Cluster '{cluster_name}' deleted successfully"}


@router.delete("/ssh-node-pools/{cluster_name}/nodes/{node_ip}")
async def remove_node(
    cluster_name: str,
    node_ip: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    # Check if user has access to this node pool
    pool = (
        db.query(SSHNodePoolDB)
        .filter(
            SSHNodePoolDB.name == cluster_name,
            SSHNodePoolDB.organization_id == user["organization_id"],
        )
        .first()
    )

    if not pool:
        raise HTTPException(
            status_code=404,
            detail=f"SSH node pool '{cluster_name}' not found or access denied",
        )

    remove_node_from_cluster(cluster_name, node_ip)
    return {
        "message": f"Node with IP '{node_ip}' removed from cluster '{cluster_name}' successfully"
    }


@router.get(
    "/ssh-node-pools/{cluster_name}/gpu-resources",
    response_model=NodePoolGPUResourcesResponse,
)
async def get_node_pool_gpu_resources(
    node_pool_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetch and parse GPU resources for a given node pool name.
    This endpoint is specifically for SSH node pools.
    """
    try:
        # Check if user has access to this node pool
        pool = (
            db.query(SSHNodePoolDB)
            .filter(
                SSHNodePoolDB.name == node_pool_name,
                SSHNodePoolDB.organization_id == current_user["organization_id"],
            )
            .first()
        )

        if not pool:
            raise HTTPException(
                status_code=404,
                detail=f"SSH node pool '{node_pool_name}' not found or access denied",
            )

        # Validate that the node pool exists
        from routes.node_pools.utils import is_ssh_cluster

        if not is_ssh_cluster(node_pool_name):
            raise HTTPException(
                status_code=404, detail=f"SSH node pool '{node_pool_name}' not found"
            )

        # Fetch GPU resources using the existing utility function
        gpu_resources = await fetch_and_parse_gpu_resources(node_pool_name)

        return gpu_resources

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching GPU resources for node pool {node_pool_name}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch GPU resources: {str(e)}"
        )
