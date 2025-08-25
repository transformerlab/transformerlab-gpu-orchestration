from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
)
from .utils import (
    generate_cost_report,
)
from .port_forwarding import port_forward_manager
from routes.clusters.utils import is_ssh_cluster, is_down_only_cluster
from utils.cluster_utils import (
    get_display_name_from_actual,
    get_cluster_platform_info as get_cluster_platform_data,
    get_cluster_platform,
    load_cluster_platforms,
    get_cluster_template,
)
from utils.cluster_resolver import (
    handle_cluster_name_param,
)
from routes.auth.api_key_auth import get_user_or_api_key


router = APIRouter(prefix="/skypilot", dependencies=[Depends(get_user_or_api_key)])


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
