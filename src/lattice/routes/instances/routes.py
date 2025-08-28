import json
import uuid
from concurrent.futures import ThreadPoolExecutor

# Removed load_ssh_node_info import as we now use database-based approach
from typing import Optional

from config import UPLOADS_DIR
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from models import (
    DownClusterResponse,
    LaunchClusterResponse,
    StatusResponse,
    StopClusterRequest,
    StopClusterResponse,
    DownClusterRequest,
    ClusterStatusResponse,
)
from .utils import (
    launch_cluster_with_skypilot_isolated,
    get_skypilot_status,
    stop_cluster_with_skypilot,
    down_cluster_with_skypilot,
    generate_cost_report,
)
from routes.clouds.azure.utils import (
    az_get_config_for_display,
)
from routes.clouds.runpod.utils import (
    rp_setup_config,
    map_runpod_display_to_instance_type,
)
from routes.node_pools.utils import (
    is_ssh_cluster,
    is_down_only_cluster,
    update_gpu_resources_for_node_pool,
)
from utils.cluster_utils import (
    create_cluster_platform_entry,
    get_actual_cluster_name,
    get_display_name_from_actual,
    get_cluster_platform_info as get_cluster_platform_data,
    get_cluster_platform_info as get_cluster_platform_info_util,
    get_cluster_platform,
    load_cluster_platforms,
    get_cluster_template,
)
from utils.cluster_utils import (
    get_cluster_user_info,
)
from utils.cluster_resolver import (
    handle_cluster_name_param,
)
from routes.auth.api_key_auth import get_user_or_api_key
from routes.auth.utils import get_current_user

from routes.jobs.utils import get_cluster_job_queue

from routes.reports.utils import record_usage

from utils.skypilot_tracker import skypilot_tracker

# Global thread pool executor for GPU resource updates
_gpu_update_executor = ThreadPoolExecutor(
    max_workers=4,  # Limit concurrent GPU update operations
    thread_name_prefix="gpu-update",
)


def update_gpu_resources_background(node_pool_name: str):
    """
    Background task to update GPU resources for a node pool.
    Uses a thread pool executor to limit concurrent operations.
    """
    import asyncio

    def run_async_update():
        try:
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # Run the async update function
            loop.run_until_complete(update_gpu_resources_for_node_pool(node_pool_name))
            print(
                f"Background thread: Successfully updated GPU resources for {node_pool_name}"
            )
        except Exception as e:
            print(
                f"Background thread: Failed to update GPU resources for {node_pool_name}: {e}"
            )
        finally:
            loop.close()

    # Submit the task to the thread pool executor
    _gpu_update_executor.submit(run_async_update)


router = APIRouter(
    prefix="/instances", dependencies=[Depends(get_user_or_api_key)], tags=["instances"]
)


@router.post("/launch", response_model=LaunchClusterResponse)
async def launch_instance(
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
        python_filename = None
        disk_size = None
        credentials = None

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
                rp_setup_config()
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
                # az_setup_config()
                az_config = az_get_config_for_display()
                az_config_dict = az_config["configs"][az_config["default_config"]]
                credentials = {
                    "azure": {
                        "service_principal": {
                            "tenant_id": az_config_dict["tenant_id"],
                            "client_id": az_config_dict["client_id"],
                            "client_secret": az_config_dict["client_secret"],
                            "subscription_id": az_config_dict["subscription_id"],
                        }
                    }
                }
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup Azure: {str(e)}"
                )
        # print(f"az_config: {az_config}")
        # raise Exception("test")
        print(f"credentials: {credentials}")
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

        # Launch cluster using the actual cluster name (isolated process)
        request_id = await launch_cluster_with_skypilot_isolated(
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
            user_id=user_id,
            organization_id=organization_id,
            display_name=cluster_name,
            credentials=credentials,
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

        # Update GPU resources for SSH node pools when launching clusters (background thread)
        if node_pool_name and is_ssh_cluster(node_pool_name):
            update_gpu_resources_background(node_pool_name)

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


@router.post("/stop", response_model=StopClusterResponse)
async def stop_instance(
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
        request_id = stop_cluster_with_skypilot(
            actual_cluster_name,
            user_id=user["id"],
            organization_id=user["organization_id"],
            display_name=display_name,  # Pass the display name for database storage
        )
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
async def down_instance(
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

        request_id = down_cluster_with_skypilot(
            actual_cluster_name,
            display_name,
            user_id=user["id"],
            organization_id=user["organization_id"],
        )

        # Check if this cluster uses an SSH node pool as its platform (background thread)
        try:
            platform_info = get_cluster_platform_info_util(actual_cluster_name)
            if (
                platform_info
                and platform_info.get("platform")
                and is_ssh_cluster(platform_info["platform"])
            ):
                node_pool_name = platform_info["platform"]
                update_gpu_resources_background(node_pool_name)
        except Exception as e:
            print(
                f"Warning: Failed to get platform info for cluster {actual_cluster_name}: {e}"
            )

        return DownClusterResponse(
            request_id=request_id,
            cluster_name=display_name,  # Return display name to user
            message=f"Cluster '{display_name}' termination initiated successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to terminate cluster: {str(e)}"
        )


@router.get("/status", response_model=StatusResponse)
async def get_instance_status(
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


@router.get("/{cluster_name}/info")
async def get_cluster_info(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Get comprehensive information for a specific cluster in a single API call.

    This endpoint consolidates data from multiple sources:
    - Cluster status and basic information
    - Cluster type and available operations
    - Platform information
    - Template information
    - Jobs associated with the cluster
    - SSH node information (if applicable)

    Returns:
        dict: A comprehensive object containing all cluster information
            - cluster: Basic cluster status and metadata
            - cluster_type: Type information and available operations
            - platform: Platform-specific information
            - template: Template information
            - jobs: List of jobs associated with the cluster
            - ssh_node_info: SSH node information (only for SSH clusters)
    """
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        # Get cluster status information
        cluster_records = get_skypilot_status([actual_cluster_name])
        cluster_data = None

        for record in cluster_records:
            user_info = get_cluster_user_info(record["name"])

            # Skip clusters without user info or not belonging to current user
            if not user_info or not user_info.get("id"):
                continue

            if not (
                user_info.get("id") == user["id"]
                and user_info.get("organization_id") == user["organization_id"]
            ):
                continue

            # Get display name for the response
            display_name = get_display_name_from_actual(record["name"])
            if not display_name:
                display_name = record["name"]  # Fallback to actual name

            cluster_data = {
                "cluster_name": display_name,
                "status": str(record["status"]),
                "launched_at": record.get("launched_at"),
                "last_use": record.get("last_use"),
                "autostop": record.get("autostop"),
                "to_down": record.get("to_down"),
                "resources_str": record.get("resources_str_full")
                or record.get("resources_str"),
                "user_info": user_info,
            }
            break

        if not cluster_data:
            raise HTTPException(status_code=404, detail="Cluster not found")

        # Get cluster type information
        is_ssh = is_ssh_cluster(actual_cluster_name)
        is_down_only = is_down_only_cluster(actual_cluster_name)
        cluster_type = "ssh" if is_ssh else "cloud"
        available_operations = ["down"]
        if not is_down_only:
            available_operations.append("stop")

        cluster_type_info = {
            "cluster_name": cluster_name,
            "cluster_type": cluster_type,
            "is_ssh": is_ssh,
            "available_operations": available_operations,
            "recommendations": {
                "stop": "Stops the cluster while preserving disk data (AWS, GCP, Azure clusters only)",
                "down": "Tears down the cluster and deletes all resources (SSH, RunPod, and cloud clusters)",
            },
        }

        # Get platform information
        platform_info = get_cluster_platform(actual_cluster_name)

        # Get template information
        template = get_cluster_template(actual_cluster_name)

        # Get jobs for this cluster
        try:
            job_records = get_cluster_job_queue(actual_cluster_name)
            jobs = []
            for record in job_records:
                jobs.append(
                    {
                        "job_id": record["job_id"],
                        "job_name": record["job_name"],
                        "username": record["username"],
                        "submitted_at": record["submitted_at"],
                        "start_at": record.get("start_at"),
                        "end_at": record.get("end_at"),
                        "resources": record["resources"],
                        "status": str(record["status"]),
                        "log_path": record["log_path"],
                    }
                )
        except Exception as e:
            print(f"Warning: Failed to get jobs for cluster {cluster_name}: {e}")
            jobs = []

        # Get SSH node information if it's an SSH cluster
        ssh_node_info = None
        if is_ssh:
            try:
                # Get cached GPU resources from database instead of file
                from routes.node_pools.utils import get_cached_gpu_resources

                cached_gpu_resources = get_cached_gpu_resources(actual_cluster_name)
                if cached_gpu_resources:
                    ssh_node_info = {
                        actual_cluster_name: {"gpu_resources": cached_gpu_resources}
                    }
            except Exception as e:
                print(
                    f"Warning: Failed to get SSH node info for cluster {cluster_name}: {e}"
                )

        return {
            "cluster": cluster_data,
            "cluster_type": cluster_type_info,
            "platform": platform_info,
            "template": template,
            "jobs": jobs,
            "ssh_node_info": ssh_node_info,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting cluster info: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster info: {str(e)}"
        )


# SkyPilot Request Tracking Endpoints
@router.get("/requests")
async def get_user_requests(
    task_type: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Get SkyPilot requests for the current user
    """
    try:
        requests = skypilot_tracker.get_user_requests(
            user_id=user["id"],
            organization_id=user["organization_id"],
            task_type=task_type,
            limit=limit,
        )

        # Convert to dict for JSON serialization
        result = []
        for req in requests:
            result.append(
                {
                    "id": req.id,
                    "user_id": req.user_id,
                    "organization_id": req.organization_id,
                    "task_type": req.task_type,
                    "request_id": req.request_id,
                    "cluster_name": req.cluster_name,
                    "status": req.status,
                    "result": req.result,
                    "error_message": req.error_message,
                    "created_at": req.created_at.isoformat()
                    if req.created_at
                    else None,
                    "completed_at": req.completed_at.isoformat()
                    if req.completed_at
                    else None,
                }
            )

        return {"requests": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get requests: {str(e)}")


@router.get("/requests/{request_id}")
async def get_request_details(
    request_id: str,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Get details of a specific SkyPilot request
    """
    try:
        request = skypilot_tracker.get_request_by_id(request_id)

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # Check if user has access to this request
        if (
            request.user_id != user["id"]
            or request.organization_id != user["organization_id"]
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        return {
            "id": request.id,
            "user_id": request.user_id,
            "organization_id": request.organization_id,
            "task_type": request.task_type,
            "request_id": request.request_id,
            "cluster_name": request.cluster_name,
            "status": request.status,
            "result": request.result,
            "error_message": request.error_message,
            "created_at": request.created_at.isoformat()
            if request.created_at
            else None,
            "completed_at": request.completed_at.isoformat()
            if request.completed_at
            else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get request details: {str(e)}"
        )


@router.get("/requests/{request_id}/status")
async def get_request_status(
    request_id: str,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Get the current status of a SkyPilot request (lightweight endpoint)
    """
    try:
        request = skypilot_tracker.get_request_by_id(request_id)

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # Check if user has access to this request
        if (
            request.user_id != user["id"]
            or request.organization_id != user["organization_id"]
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        return {
            "request_id": request.request_id,
            "status": request.status,
            "task_type": request.task_type,
            "cluster_name": request.cluster_name,
            "created_at": request.created_at.isoformat()
            if request.created_at
            else None,
            "completed_at": request.completed_at.isoformat()
            if request.completed_at
            else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get request status: {str(e)}"
        )


@router.get("/requests/{request_id}/logs")
async def stream_request_logs(
    request_id: str,
    tail: Optional[int] = None,
    follow: bool = True,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Stream logs for a specific SkyPilot request in real-time
    """
    try:
        # First check if the request exists and user has access
        request = skypilot_tracker.get_request_by_id(request_id)

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # Check if user has access to this request
        if (
            request.user_id != user["id"]
            or request.organization_id != user["organization_id"]
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        def generate_logs():
            try:
                import queue
                import threading

                # Create a queue to pass log lines from the stream to the generator
                log_queue = queue.Queue()
                streaming_complete = threading.Event()

                class LogCaptureStream:
                    def __init__(self, log_queue):
                        self.log_queue = log_queue

                    def write(self, text):
                        if text.strip():
                            # Put the log line in the queue for immediate streaming
                            self.log_queue.put(text.strip())

                    def flush(self):
                        pass

                # Create the capture stream
                capture_stream = LogCaptureStream(log_queue)

                # Start the SkyPilot log streaming in a separate thread
                def stream_logs():
                    try:
                        skypilot_tracker.get_request_logs(
                            request_id=request_id,
                            tail=tail,
                            follow=follow,
                            output_stream=capture_stream,
                        )
                        # Signal that streaming is complete
                        streaming_complete.set()
                    except Exception as e:
                        # Put error in queue
                        log_queue.put(f"ERROR: {str(e)}")
                        streaming_complete.set()

                # Start streaming in background thread
                stream_thread = threading.Thread(target=stream_logs)
                stream_thread.daemon = True
                stream_thread.start()

                # Yield log lines as they come in
                while not streaming_complete.is_set() or not log_queue.empty():
                    try:
                        # Get log line with timeout to allow checking completion
                        log_line = log_queue.get(timeout=0.1)
                        yield f"data: {json.dumps({'log_line': str(log_line)})}\n\n"
                    except queue.Empty:
                        # No log line available, continue checking
                        continue

                # Update the request status to completed (don't store logs in DB)
                skypilot_tracker.update_request_status(
                    request_id=request_id, status="completed"
                )
                yield f"data: {json.dumps({'status': 'completed'})}\n\n"

            except Exception as e:
                # Update the request status if it failed
                skypilot_tracker.update_request_status(
                    request_id=request_id, status="failed", error_message=str(e)
                )
                yield f"data: {json.dumps({'error': str(e), 'status': 'failed'})}\n\n"

        return StreamingResponse(
            generate_logs(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream logs: {str(e)}")


@router.post("/requests/{request_id}/cancel")
async def cancel_request(
    request_id: str,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Cancel a SkyPilot request
    """
    try:
        # First check if the request exists and user has access
        request = skypilot_tracker.get_request_by_id(request_id)

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # Check if user has access to this request
        if (
            request.user_id != user["id"]
            or request.organization_id != user["organization_id"]
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        # Check if request can be cancelled
        if request.status in ["completed", "failed", "cancelled"]:
            raise HTTPException(
                status_code=400, detail=f"Request is already {request.status}"
            )

        # Cancel the request
        success = skypilot_tracker.cancel_request(request_id)

        if success:
            return {"message": f"Request {request_id} cancelled successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to cancel request")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to cancel request: {str(e)}"
        )
