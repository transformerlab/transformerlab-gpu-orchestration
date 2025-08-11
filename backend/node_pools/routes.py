from fastapi import APIRouter, Depends, HTTPException, Request, Response
from auth.api_key_auth import get_user_or_api_key
from skypilot.utils import get_skypilot_status
from skypilot.runpod_utils import (
    load_runpod_config,
    get_current_runpod_config,
)
from skypilot.azure_utils import (
    load_azure_config,
    get_current_azure_config,
)
from utils.file_utils import (
    load_ssh_node_info,
    load_cluster_platforms,
)
from clusters.utils import (
    list_cluster_names_from_db,
    get_cluster_config_from_db,
)

router = APIRouter(prefix="/node-pools", dependencies=[Depends(get_user_or_api_key)])


@router.get("")
async def get_node_pools(request: Request, response: Response):
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
        try:
            cluster_names = list_cluster_names_from_db()
            # Note: clusters will be added to node_pools array below
        except Exception as e:
            print(f"Error loading clusters: {e}")

            # 2. Get aggregated instances data (combining all cloud providers)
        try:
            skyPilotStatus = get_skypilot_status()
            platforms = load_cluster_platforms()

            # Count all cloud clusters (non-SSH clusters)
            cloud_clusters = []
            for cluster in skyPilotStatus:
                cluster_name = cluster.get("name", "")
                platform_info = platforms.get(cluster_name, {})
                if isinstance(platform_info, dict) and platform_info.get(
                    "platform"
                ) in ["runpod", "azure"]:
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

        # 5. Get SkyPilot status
        try:
            cluster_records = get_skypilot_status()
            response_data["sky_pilot_status"] = cluster_records
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
                        # Get current Azure instances for this config
                        azure_instances = 0
                        for cluster in skyPilotStatus:
                            cluster_name = cluster.get("name", "")
                            platform_info = platforms.get(cluster_name, {})
                            if (
                                isinstance(platform_info, dict)
                                and platform_info.get("platform") == "azure"
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
                        # Get current RunPod instances for this config
                        runpod_instances = 0
                        for cluster in skyPilotStatus:
                            cluster_name = cluster.get("name", "")
                            platform_info = platforms.get(cluster_name, {})
                            if (
                                isinstance(platform_info, dict)
                                and platform_info.get("platform") == "runpod"
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
                for cluster_name in list_cluster_names_from_db():
                    cfg = get_cluster_config_from_db(cluster_name)
                    hosts_count = len(cfg.get("hosts", []))
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
