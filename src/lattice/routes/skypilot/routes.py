from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Form,
    UploadFile,
    File,
    Request,
    Response,
)
from pydantic import BaseModel
import uuid
import os
from config import UPLOADS_DIR
from werkzeug.utils import secure_filename
from lattice.models import (
    LaunchClusterResponse,
    StatusResponse,
    StopClusterRequest,
    StopClusterResponse,
    DownClusterRequest,
    DownClusterResponse,
    ClusterStatusResponse,
)
from .utils import (
    generate_cost_report,
    launch_cluster_with_skypilot,
    get_skypilot_status,
    stop_cluster_with_skypilot,
    down_cluster_with_skypilot,
    run_sky_check_ssh,
)
from .port_forwarding import port_forward_manager
from ..clouds.azure.utils import (
    load_azure_config,
    setup_azure_config,
)
from ..clouds.runpod.utils import (
    load_runpod_config,
    setup_runpod_config,
    map_runpod_display_to_instance_type,
)

from lattice.routes.clusters.utils import is_ssh_cluster, is_down_only_cluster
from lattice.utils.file_utils import (
    load_ssh_node_info,
    get_cluster_platform,
    load_cluster_platforms,
    get_cluster_user_info,
    get_cluster_template,
)
from lattice.utils.cluster_utils import (
    create_cluster_platform_entry,
    get_actual_cluster_name,
    get_display_name_from_actual,
    get_cluster_platform_info as get_cluster_platform_data,
)
from lattice.utils.cluster_resolver import (
    handle_cluster_name_param,
)
from ..auth.api_key_auth import get_user_or_api_key
from ..auth.utils import get_current_user
from ..reports.utils import record_usage
from typing import Optional


router = APIRouter(prefix="/skypilot", dependencies=[Depends(get_user_or_api_key)])


@router.get("/node-pools")
async def list_node_pools(
    request: Request,
    response: Response,
):
    """Get all node pools (Azure, RunPod, and SSH clusters)"""
    try:
        node_pools = []

        # Get Azure configs - show each config as a separate entry
        try:
            azure_config_data = load_azure_config()
            if azure_config_data.get("configs"):
                for config_key, config in azure_config_data["configs"].items():
                    node_pools.append(
                        {
                            "name": config.get("name", "Azure Pool"),
                            "platform": "azure",
                            "numberOfNodes": config.get("max_instances", 0),
                            "status": "enabled",
                            "access": ["Admin"],  # Default access
                            "config": {
                                "is_configured": azure_config_data.get(
                                    "is_configured", False
                                ),
                                "max_instances": config.get("max_instances", 0),
                                "config_key": config_key,
                                "is_default": azure_config_data.get("default_config")
                                == config_key,
                            },
                        }
                    )
        except Exception as e:
            print(f"Error loading Azure config: {e}")

        # Get RunPod configs - show each config as a separate entry
        try:
            runpod_config_data = load_runpod_config()
            if runpod_config_data.get("configs"):
                for config_key, config in runpod_config_data["configs"].items():
                    node_pools.append(
                        {
                            "name": config.get("name", "RunPod Pool"),
                            "platform": "runpod",
                            "numberOfNodes": config.get("max_instances", 0),
                            "status": "enabled",
                            "access": ["Admin"],  # Default access
                            "config": {
                                "is_configured": runpod_config_data.get(
                                    "is_configured", False
                                ),
                                "max_instances": config.get("max_instances", 0),
                                "config_key": config_key,
                                "is_default": runpod_config_data.get("default_config")
                                == config_key,
                            },
                        }
                    )
        except Exception as e:
            print(f"Error loading RunPod config: {e}")

        # Get SSH clusters (DB-backed)
        try:
            from lattice.routes.clusters.utils import (
                list_cluster_names_from_db,
                get_cluster_config_from_db,
            )

            for cluster_name in list_cluster_names_from_db():
                cfg = get_cluster_config_from_db(cluster_name)
                hosts_count = len(cfg.get("hosts", []))
                node_pools.append(
                    {
                        "name": cluster_name,
                        "platform": "direct",
                        "numberOfNodes": hosts_count,
                        "status": "enabled",
                        "access": ["Admin"],
                        "config": {"is_configured": True, "max_instances": hosts_count},
                    }
                )
        except Exception as e:
            print(f"Error loading SSH clusters: {e}")

        return {"node_pools": node_pools}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list node pools: {str(e)}"
        )


@router.post("/launch", response_model=LaunchClusterResponse)
async def launch_skypilot_cluster(
    request: Request,
    response: Response,
    cluster_name: str = Form(...),
    command: str = Form("echo 'Hello SkyPilot'"),
    setup: Optional[str] = Form(None),
    cloud: Optional[str] = Form(None),
    instance_type: Optional[str] = Form(None),
    cpus: Optional[str] = Form(None),
    memory: Optional[str] = Form(None),
    accelerators: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    zone: Optional[str] = Form(None),
    use_spot: bool = Form(False),
    idle_minutes_to_autostop: Optional[int] = Form(None),
    python_file: Optional[UploadFile] = File(None),
    launch_mode: Optional[str] = Form(None),
    jupyter_port: Optional[int] = Form(None),
    vscode_port: Optional[int] = Form(None),
    template: Optional[str] = Form(None),
    storage_bucket_ids: Optional[str] = Form(None),
    node_pool_name: Optional[str] = Form(None),
    docker_image: Optional[str] = Form(None),
    container_registry_id: Optional[str] = Form(None),
):
    try:
        file_mounts = None
        workdir = None
        python_filename = None
        disk_size = None

        # Parse storage bucket IDs
        parsed_storage_bucket_ids = None
        if storage_bucket_ids:
            try:
                parsed_storage_bucket_ids = [
                    bid.strip() for bid in storage_bucket_ids.split(",") if bid.strip()
                ]
            except Exception as e:
                print(f"Warning: Failed to parse storage bucket IDs: {e}")

        if python_file is not None and python_file.filename:
            # Save the uploaded file to a persistent uploads directory
            python_filename = python_file.filename
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename
            with open(file_path, "wb") as f:
                f.write(await python_file.read())
            # Mount the file to workspace/<filename> in the cluster
            file_mounts = {f"workspace/{python_filename}": str(file_path)}
        # Setup RunPod if cloud is runpod
        if cloud == "runpod":
            try:
                setup_runpod_config()
                # Map display string to instance type if accelerators is provided
                if accelerators:
                    mapped_instance_type = map_runpod_display_to_instance_type(
                        accelerators
                    )
                    if mapped_instance_type.lower().startswith("cpu"):
                        # Using skypilot logic to have disk size lesser than 10x vCPUs
                        disk_size = 5 * int(mapped_instance_type.split("-")[1])
                    if mapped_instance_type != accelerators:
                        instance_type = mapped_instance_type
                        # Clear accelerators for RunPod since we're using instance_type
                        accelerators = None
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup RunPod: {str(e)}"
                )

        # Setup Azure if cloud is azure
        if cloud == "azure":
            try:
                setup_azure_config()
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup Azure: {str(e)}"
                )
        # Get user info first for cluster creation
        user_info = get_current_user(request, response)
        user_id = user_info["id"]
        organization_id = user_info["organization_id"]

        # Create cluster platform entry and get the actual cluster name
        # For SSH clusters, use the node pool name as platform for easier mapping
        if cloud == "ssh" and node_pool_name is not None:
            platform = node_pool_name
        else:
            platform = cloud or "unknown"

        cluster_user_info = {
            "name": user_info.get("first_name", ""),
            "email": user_info.get("email", ""),
            "id": user_info.get("id", ""),
            "organization_id": user_info.get("organization_id", ""),
        }

        # Create cluster platform entry with display name and get actual cluster name
        actual_cluster_name = create_cluster_platform_entry(
            display_name=cluster_name,
            platform=platform,
            user_id=user_id,
            organization_id=organization_id,
            user_info=cluster_user_info,
            template=template,
        )

        # Launch cluster using the actual cluster name
        request_id = launch_cluster_with_skypilot(
            cluster_name=actual_cluster_name,
            command=command,
            setup=setup,
            cloud=cloud,
            instance_type=instance_type,
            cpus=cpus,
            memory=memory,
            accelerators=accelerators,
            region=region,
            zone=zone,
            use_spot=use_spot,
            idle_minutes_to_autostop=idle_minutes_to_autostop,
            file_mounts=file_mounts,
            workdir=None,
            launch_mode=launch_mode,
            jupyter_port=jupyter_port,
            vscode_port=vscode_port,
            disk_size=disk_size,
            storage_bucket_ids=parsed_storage_bucket_ids,
            node_pool_name=node_pool_name,
            docker_image=docker_image,
            container_registry_id=container_registry_id,
        )

        # Record usage event for cluster launch
        try:
            record_usage(
                user_id=user_id,
                cluster_name=actual_cluster_name,
                usage_type="cluster_launch",
                duration_minutes=None,
            )
        except Exception as e:
            print(f"Warning: Failed to record usage event for cluster launch: {e}")

        return LaunchClusterResponse(
            request_id=request_id,
            cluster_name=cluster_name,  # Return display name to user
            message=f"Cluster '{cluster_name}' launch initiated successfully",
        )
    except Exception as e:
        print(f"Error launching cluster: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


@router.get("/status", response_model=StatusResponse)
async def get_skypilot_cluster_status(
    request: Request,
    response: Response,
    cluster_names: Optional[str] = None,
    user: dict = Depends(get_user_or_api_key),
):
    try:
        # Get current user
        # user = await get_user_or_api_key(request, response)

        # Handle cluster names parameter - could be display names, need to resolve to actual names
        actual_cluster_list = None
        if cluster_names:
            display_names = [name.strip() for name in cluster_names.split(",")]
            actual_cluster_list = []
            for display_name in display_names:
                actual_name = get_actual_cluster_name(
                    display_name, user["id"], user["organization_id"]
                )
                if actual_name:
                    actual_cluster_list.append(actual_name)

        cluster_records = get_skypilot_status(actual_cluster_list)
        clusters = []

        for record in cluster_records:
            user_info = get_cluster_user_info(record["name"])

            # Skip clusters without user info (they might be from before user tracking was added)
            if not user_info or not user_info.get("id"):
                continue

            # Only include clusters that belong to the current user and organization
            if not (
                user_info.get("id") == user["id"]
                and user_info.get("organization_id") == user["organization_id"]
            ):
                continue

            # Get display name for the response
            display_name = get_display_name_from_actual(record["name"])
            if not display_name:
                display_name = record["name"]  # Fallback to actual name

            clusters.append(
                ClusterStatusResponse(
                    cluster_name=display_name,  # Return display name to user
                    status=str(record["status"]),
                    launched_at=record.get("launched_at"),
                    last_use=record.get("last_use"),
                    autostop=record.get("autostop"),
                    to_down=record.get("to_down"),
                    resources_str=record.get("resources_str_full")
                    or record.get("resources_str"),
                    user_info=user_info,
                )
            )
        return StatusResponse(clusters=clusters)
    except Exception as e:
        print(f"Error getting cluster status: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )


@router.post("/stop", response_model=StopClusterResponse)
async def stop_skypilot_cluster(
    request: Request,
    response: Response,
    stop_request: StopClusterRequest,
    user: dict = Depends(get_user_or_api_key),
):
    try:
        # Resolve display name to actual cluster name
        display_name = stop_request.cluster_name
        actual_cluster_name = handle_cluster_name_param(
            display_name, user["id"], user["organization_id"]
        )

        if is_down_only_cluster(actual_cluster_name):
            cluster_type = "SSH" if is_ssh_cluster(actual_cluster_name) else "RunPod"
            raise HTTPException(
                status_code=400,
                detail=f"{cluster_type} cluster '{display_name}' cannot be stopped. Use down operation instead.",
            )
        request_id = stop_cluster_with_skypilot(actual_cluster_name)
        return StopClusterResponse(
            request_id=request_id,
            cluster_name=display_name,  # Return display name to user
            message=f"Cluster '{display_name}' stop initiated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop cluster: {str(e)}")


@router.post("/down", response_model=DownClusterResponse)
async def down_skypilot_cluster(
    request: Request,
    response: Response,
    down_request: DownClusterRequest,
    user: dict = Depends(get_user_or_api_key),
):
    try:
        # Resolve display name to actual cluster name
        display_name = down_request.cluster_name
        actual_cluster_name = handle_cluster_name_param(
            display_name, user["id"], user["organization_id"]
        )

        request_id = down_cluster_with_skypilot(actual_cluster_name, display_name)

        return DownClusterResponse(
            request_id=request_id,
            cluster_name=display_name,  # Return display name to user
            message=f"Cluster '{display_name}' termination initiated successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to terminate cluster: {str(e)}"
        )


@router.get("/cluster-type/{cluster_name}")
async def get_cluster_type(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        is_ssh = is_ssh_cluster(actual_cluster_name)
        is_down_only = is_down_only_cluster(actual_cluster_name)
        cluster_type = "ssh" if is_ssh else "cloud"
        available_operations = ["down"]
        if not is_down_only:
            available_operations.append("stop")
        return {
            "cluster_name": cluster_name,  # Return display name to user
            "cluster_type": cluster_type,
            "is_ssh": is_ssh,
            "available_operations": available_operations,
            "recommendations": {
                "stop": "Stops the cluster while preserving disk data (AWS, GCP, Azure clusters only)",
                "down": "Tears down the cluster and deletes all resources (SSH, RunPod, and cloud clusters)",
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster type: {str(e)}"
        )


@router.get("/ssh-node-info")
async def get_ssh_node_info(request: Request, response: Response):
    try:
        node_info = load_ssh_node_info()
        return node_info
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load SSH node info: {str(e)}"
        )


@router.get("/ssh/sky-check")
async def run_sky_check_ssh_route(request: Request, response: Response):
    """Run 'sky check ssh' to validate the SSH setup"""
    try:
        is_valid, output = run_sky_check_ssh()
        return {
            "valid": is_valid,
            "output": output,
            "message": "Sky check ssh completed successfully"
            if is_valid
            else "Sky check ssh failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check ssh: {str(e)}"
        )


@router.get("/port-forwards")
async def get_active_port_forwards(request: Request, response: Response):
    """Get list of active port forwards."""
    try:
        active_forwards = port_forward_manager.get_active_forwards()
        return {"port_forwards": active_forwards}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get active port forwards: {str(e)}"
        )


@router.post("/port-forwards/{cluster_name}/stop")
async def stop_port_forward(request: Request, response: Response, cluster_name: str):
    """Stop port forwarding for a specific cluster."""
    try:
        success = port_forward_manager.stop_port_forward(cluster_name)
        if success:
            return {"message": f"Port forwarding stopped for cluster {cluster_name}"}
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No active port forward found for cluster {cluster_name}",
            )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to stop port forward: {str(e)}"
        )


@router.get("/cluster-platform/{cluster_name}")
async def get_cluster_platform_info(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Get platform information for a specific cluster."""
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        platform_info = get_cluster_platform(actual_cluster_name)
        return platform_info
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster platform info: {str(e)}"
        )


@router.get("/cluster-platforms")
async def get_all_cluster_platforms(request: Request, response: Response):
    """Get platform information for all clusters."""
    try:
        platforms = load_cluster_platforms()
        return {"platforms": platforms}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster platforms: {str(e)}"
        )


@router.get("/cluster-template/{cluster_name}")
async def get_cluster_template_info(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Get template information for a specific cluster."""
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        template = get_cluster_template(actual_cluster_name)
        return {"template": template}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster template info: {str(e)}"
        )


@router.get("/cost-report")
async def get_cost_report(
    request: Request, response: Response, user: dict = Depends(get_user_or_api_key)
):
    """Get cost report for clusters belonging to the current user within their organization."""
    try:
        report = generate_cost_report()
        if not report:
            return []

            # Filter clusters to include only those belonging to the current user within their organization
        filtered_clusters = []
        current_user_id = user.get("id")
        current_user_org_id = user.get("organization_id")

        if not current_user_id:
            return []

        for cluster_data in report:
            cluster_name = cluster_data.get("name")
            if not cluster_name:
                continue

            # Get platform info for this cluster to check ownership
            platform_info = get_cluster_platform_data(cluster_name)
            if not platform_info or not platform_info.get("user_id"):
                continue

            # Include clusters that belong to the current user AND are in the current user's organization
            cluster_user_id = platform_info.get("user_id")
            cluster_org_id = platform_info.get("organization_id")

            if (
                cluster_user_id == current_user_id
                and current_user_org_id
                and cluster_org_id == current_user_org_id
            ):
                # Get display name for user-facing response
                display_name = get_display_name_from_actual(cluster_name)
                cluster_display_name = display_name if display_name else cluster_name

                # Create a copy of cluster data with display name
                filtered_cluster_data = cluster_data.copy()
                filtered_cluster_data["name"] = cluster_display_name
                filtered_clusters.append(filtered_cluster_data)

        return filtered_clusters
    except Exception as e:
        print(f"🔍 Error in /cost-report: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cost report: {str(e)}"
        )
