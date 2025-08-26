from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Response,
    Depends,
)
from routes.auth.api_key_auth import get_user_or_api_key

from .utils import (
    run_sky_check_ssh,
)


router = APIRouter()


@router.get("/sky-check")
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


@router.get("/node-info")
async def get_ssh_node_info(
    request: Request, response: Response, user: dict = Depends(get_user_or_api_key)
):
    """Get SSH node information from database"""
    try:
        from routes.node_pools.utils import (
            list_cluster_names_from_db_by_org,
            get_cluster_config_from_db,
            get_cached_gpu_resources,
        )

        # Build comprehensive SSH node info from database
        ssh_node_info = {}
        cluster_names = list_cluster_names_from_db_by_org(user["organization_id"])

        for cluster_name in cluster_names:
            cfg = get_cluster_config_from_db(cluster_name)
            cached_gpu_resources = get_cached_gpu_resources(cluster_name)

            ssh_node_info[cluster_name] = {
                "hosts": cfg.get("hosts", []),
                "gpu_resources": cached_gpu_resources,
            }

        return ssh_node_info
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load SSH node info: {str(e)}"
        )
