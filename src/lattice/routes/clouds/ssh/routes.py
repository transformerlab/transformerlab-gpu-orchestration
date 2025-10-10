from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Response,
    Depends,
)
from routes.auth.api_key_auth import get_user_or_api_key
from config import get_db
from db.db_models import SSHNodePool as SSHNodePoolDB
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/node-info")
async def get_ssh_node_info(
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Get SSH node information from database with fresh GPU data"""
    try:
        from routes.node_pools.utils import (
            list_cluster_names_from_db_by_org,
            get_cluster_config_from_db,
            get_cached_gpu_resources,
        )
        from routes.instances.utils import fetch_and_parse_gpu_resources
        from datetime import datetime

        # Build comprehensive SSH node info from database with fresh GPU data
        ssh_node_info = {}
        cluster_names = list_cluster_names_from_db_by_org(user["organization_id"])

        for cluster_name in cluster_names:
            cfg = get_cluster_config_from_db(cluster_name, user["organization_id"])

            # Fetch and update GPU resources synchronously
            try:
                gpu_resources = await fetch_and_parse_gpu_resources(cluster_name)

                # Update the database with fresh GPU resources
                pool = (
                    db.query(SSHNodePoolDB)
                    .filter(SSHNodePoolDB.name == cluster_name)
                    .first()
                )
                if pool:
                    current_other_data = pool.other_data or {}
                    current_other_data.update(
                        {
                            "gpu_resources": gpu_resources,
                            "last_updated": datetime.utcnow().isoformat(),
                        }
                    )
                    pool.other_data = current_other_data
                    db.commit()

                ssh_node_info[cluster_name] = {
                    "hosts": cfg.get("hosts", []),
                    "gpu_resources": gpu_resources,
                }
            except Exception as e:
                print(f"Error updating GPU resources for {cluster_name}: {e}")
                # Fallback to cached data if fresh fetch fails
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
