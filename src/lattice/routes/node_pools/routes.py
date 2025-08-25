from fastapi import APIRouter, Depends, HTTPException, Request, Response
from lattice.routes.auth.api_key_auth import get_user_or_api_key
from lattice.routes.skypilot.utils import get_skypilot_status
from lattice.routes.skypilot.runpod_utils import (
    load_runpod_config,
    get_current_runpod_config,
)
from lattice.routes.skypilot.azure_utils import (
    load_azure_config,
    get_current_azure_config,
)
from lattice.utils.file_utils import (
    load_ssh_node_info,
)
from lattice.utils.cluster_utils import (
    get_cluster_platform_info,
    get_display_name_from_actual,
)
from lattice.routes.clusters.utils import (
    list_cluster_names_from_db,
    get_cluster_config_from_db,
)
from config import get_db
from sqlalchemy.orm import Session
from db_models import NodePoolAccess, Team
from lattice.routes.quota.utils import get_user_team_id
from lattice.models import (
    NodePoolAccessListResponse,
    NodePoolAccessEntry,
    NodePoolAccessUpdateRequest,
)

router = APIRouter(prefix="/node-pools", dependencies=[Depends(get_user_or_api_key)])


@router.get("")
async def get_node_pools(
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Get comprehensive node pools data combining:
    - Clusters from /clusters endpoint
    - RunPod instances from /skypilot/runpod/instances
    - Azure instances from /skypilot/azure/instances
    - SSH node info from /skypilot/ssh-node-info
    - SkyPilot status from /skypilot/status
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

        # 1. Get clusters from /clusters endpoint (will be added to node_pools as direct provider)
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
                runpod_config = get_current_runpod_config()
                if runpod_config:
                    total_max_instances += runpod_config.get("max_instances", 0)
            except Exception as e:
                print(f"Error getting RunPod config: {e}")

            # Add Azure max instances
            try:
                azure_config = get_current_azure_config()
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

        # 4. Get SSH node info
        try:
            node_info = load_ssh_node_info()
            response_data["ssh_node_info"] = node_info
        except Exception as e:
            print(f"Error loading SSH node info: {e}")

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

            # Helper: fetch access list for a given pool key
            def get_access_for_pool(pool_key: str):
                try:
                    db = next(get_db())
                    rows = (
                        db.query(NodePoolAccess)
                        .filter(
                            NodePoolAccess.organization_id == user["organization_id"],
                            NodePoolAccess.pool_key == pool_key,
                        )
                        .all()
                    )
                    if not rows:
                        return ["Admin"]
                    # map team names
                    team_ids = [r.team_id for r in rows]
                    teams = db.query(Team).filter(Team.id.in_(team_ids)).all()
                    return [t.name for t in teams]
                except Exception:
                    return ["Admin"]

            # Helper: determine if current user is allowed for a pool
            def user_has_access(pool_key: str) -> bool:
                try:
                    # Admins can see all
                    role = user.get("role")
                    if role == "admin" or (isinstance(role, dict) and (role.get("slug") == "admin" or role.get("name") == "admin")):
                        return True
                    db = next(get_db())
                    # If there are no explicit assignments for this pool, default to visible
                    any_assignment = (
                        db.query(NodePoolAccess)
                        .filter(
                            NodePoolAccess.organization_id == user["organization_id"],
                            NodePoolAccess.pool_key == pool_key,
                        )
                        .first()
                    )
                    if any_assignment is None:
                        return True
                    # get user's team id
                    team_id = get_user_team_id(db, user["organization_id"], user["id"])  # type: ignore
                    if not team_id:
                        return False
                    exists = (
                        db.query(NodePoolAccess)
                        .filter(
                            NodePoolAccess.organization_id == user["organization_id"],
                            NodePoolAccess.pool_key == pool_key,
                            NodePoolAccess.team_id == team_id,
                        )
                        .first()
                    )
                    # If no explicit rows exist for this pool at all, treat as admin-only (hidden)
                    return exists is not None
                except Exception:
                    return False

            # Get Azure configs
            try:
                azure_config_data = load_azure_config()
                if azure_config_data.get("configs"):
                    for config_key, config in azure_config_data["configs"].items():
                        pool_key = f"azure:{config_key}"
                        access_list = get_access_for_pool(pool_key)
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

                        pool_entry = (
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
                                "access": access_list,
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
                        if user_has_access(pool_key):
                            node_pools.append(pool_entry)
            except Exception as e:
                print(f"Error loading Azure config: {e}")

            # Get RunPod configs
            try:
                runpod_config_data = load_runpod_config()
                if runpod_config_data.get("configs"):
                    for config_key, config in runpod_config_data["configs"].items():
                        pool_key = f"runpod:{config_key}"
                        access_list = get_access_for_pool(pool_key)
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

                        pool_entry = (
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
                                "access": access_list,
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
                        if user_has_access(pool_key):
                            node_pools.append(pool_entry)
            except Exception as e:
                print(f"Error loading RunPod config: {e}")

            # Get SSH clusters
            try:
                for cluster_name in list_cluster_names_from_db():
                    cfg = get_cluster_config_from_db(cluster_name)
                    hosts_count = len(cfg.get("hosts", []))
                    pool_key = f"direct:{cluster_name}"
                    access_list = get_access_for_pool(pool_key)

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

                    pool_entry = (
                        {
                            "name": cluster_name,
                            "type": "direct",
                            "provider": "direct",
                            "max_instances": hosts_count,
                            "current_instances": hosts_count,
                            "can_launch": True,
                            "status": "enabled",
                            "access": access_list,
                            "config": {
                                "is_configured": True,
                                "hosts": cfg.get("hosts", []),
                            },
                            "active_clusters": active_clusters,
                            "user_instances": ssh_instances_for_user,
                        }
                    )
                    if user_has_access(pool_key):
                        node_pools.append(pool_entry)
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


@router.get("/access/{pool_key}", response_model=NodePoolAccessListResponse)
async def get_pool_access(
    pool_key: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """List team access for a given pool_key in user's organization."""
    try:
        org_id = user["organization_id"]
        # Fetch access rows
        rows = (
            db.query(NodePoolAccess)
            .filter(
                NodePoolAccess.organization_id == org_id,
                NodePoolAccess.pool_key == pool_key,
            )
            .all()
        )
        team_ids = [r.team_id for r in rows]
        teams = db.query(Team).filter(Team.id.in_(team_ids)).all() if team_ids else []
        team_map = {t.id: t for t in teams}
        entries = [
            NodePoolAccessEntry(team_id=r.team_id, team_name=team_map.get(r.team_id).name if team_map.get(r.team_id) else "Unknown")
            for r in rows
        ]
        return NodePoolAccessListResponse(pool_key=pool_key, team_access=entries)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pool access: {str(e)}")


@router.put("/access/{pool_key}", response_model=NodePoolAccessListResponse)
async def update_pool_access(
    pool_key: str,
    body: NodePoolAccessUpdateRequest,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Replace team access list for a pool_key within the user's organization."""
    try:
        org_id = user["organization_id"]
        # Validate team IDs belong to org
        if body.team_ids:
            valid_team_ids = {
                t.id for t in db.query(Team).filter(Team.organization_id == org_id, Team.id.in_(body.team_ids)).all()
            }
            if set(body.team_ids) - valid_team_ids:
                raise HTTPException(status_code=400, detail="One or more team IDs are invalid for this organization")

        # Delete existing for this pool/org
        db.query(NodePoolAccess).filter(
            NodePoolAccess.organization_id == org_id,
            NodePoolAccess.pool_key == pool_key,
        ).delete(synchronize_session=False)
        # Insert new
        for tid in body.team_ids:
            db.add(
                NodePoolAccess(
                    organization_id=org_id,
                    pool_key=pool_key,
                    team_id=tid,
                )
            )
        db.commit()

        # Return updated list
        rows = (
            db.query(NodePoolAccess)
            .filter(
                NodePoolAccess.organization_id == org_id,
                NodePoolAccess.pool_key == pool_key,
            )
            .all()
        )
        team_ids = [r.team_id for r in rows]
        teams = db.query(Team).filter(Team.id.in_(team_ids)).all() if team_ids else []
        team_map = {t.id: t for t in teams}
        entries = [
            NodePoolAccessEntry(team_id=r.team_id, team_name=team_map.get(r.team_id).name if team_map.get(r.team_id) else "Unknown")
            for r in rows
        ]
        return NodePoolAccessListResponse(pool_key=pool_key, team_access=entries)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update pool access: {str(e)}")
