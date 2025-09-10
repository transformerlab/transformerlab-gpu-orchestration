import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Removed load_ssh_node_info import as we now use database-based approach
from typing import List, Optional

import yaml
from config import UPLOADS_DIR, get_db
from db.db_models import (
    NodePoolAccess as NodePoolAccessDB,
    SSHNodePool as SSHNodePoolDB,
)
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
    ClusterStatusResponse,
    DownClusterRequest,
    DownClusterResponse,
    LaunchClusterResponse,
    MachineSizeTemplateListResponse,
    MachineSizeTemplateResponse,
    StatusResponse,
    StopClusterRequest,
    StopClusterResponse,
)
from routes.auth.api_key_auth import get_user_or_api_key, require_scope
from routes.clouds.azure.utils import (
    az_get_current_config,
    az_get_price_per_hour,
    az_infer_gpu_count,
    load_azure_config,
)
from routes.clouds.runpod.utils import (
    load_runpod_config,
    map_runpod_display_to_instance_type,
    rp_get_price_per_hour,
)
from routes.jobs.utils import get_cluster_job_queue
from routes.node_pools.utils import (
    is_down_only_cluster,
    is_ssh_cluster,
    update_gpu_resources_for_node_pool,
)
from routes.quota.utils import get_current_user_quota_info, get_user_team_id
from routes.reports.utils import record_usage
from sqlalchemy.orm import Session
from db.db_models import MachineSizeTemplate

from utils.cluster_resolver import handle_cluster_name_param

from utils.cluster_utils import get_cluster_platform_info as get_cluster_platform_data
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_info_util,
)
from utils.cluster_utils import (
    get_cluster_state,
    get_cluster_user_info,
    get_display_name_from_actual,
    load_cluster_platforms,
    update_cluster_state,
    create_cluster_platform_entry,
    get_actual_cluster_name,
    get_cluster_platform,
)
from utils.skypilot_tracker import skypilot_tracker
from werkzeug.utils import secure_filename

from routes.auth.api_key_auth import enforce_csrf

from .utils import (
    down_cluster_with_skypilot,
    generate_cost_report,
    get_skypilot_status,
    launch_cluster_with_skypilot_isolated,
    stop_cluster_with_skypilot,
)

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
    prefix="/instances",
    dependencies=[Depends(get_user_or_api_key), Depends(enforce_csrf)],
    tags=["instances"],
)

@router.get("/templates", response_model=MachineSizeTemplateListResponse)
async def list_machine_size_templates(
    cloud_type: Optional[str] = None,
    cloud_identifier: Optional[str] = None,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    try:
        q = db.query(MachineSizeTemplate).filter(
            MachineSizeTemplate.organization_id == user.get("organization_id")
        )
        if cloud_type:
            q = q.filter(MachineSizeTemplate.cloud_type == cloud_type)
        if cloud_identifier is not None:
            q = q.filter(MachineSizeTemplate.cloud_identifier == cloud_identifier)
        rows = q.order_by(MachineSizeTemplate.updated_at.desc()).all()
        templates = []
        for m in rows:
            templates.append(
                MachineSizeTemplateResponse(
                    id=m.id,
                    name=m.name,
                    description=m.description,
                    cloud_type=m.cloud_type,
                    cloud_identifier=m.cloud_identifier,
                    resources_json=m.resources_json or {},
                    organization_id=m.organization_id,
                    created_by=m.created_by,
                    created_at=m.created_at.isoformat() if m.created_at else "",
                    updated_at=m.updated_at.isoformat() if m.updated_at else "",
                )
            )
        return MachineSizeTemplateListResponse(templates=templates, total_count=len(templates))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")


@router.post("/launch", response_model=LaunchClusterResponse)
async def launch_instance(
    request: Request,
    response: Response,
    cluster_name: Optional[str] = Form(None),
    command: Optional[str] = Form("echo 'Hello World'"),
    setup: Optional[str] = Form(None),
    cloud: Optional[str] = Form(None),
    instance_type: Optional[str] = Form(None),
    cpus: Optional[str] = Form(None),
    memory: Optional[str] = Form(None),
    accelerators: Optional[str] = Form(None),
    disk_space: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    zone: Optional[str] = Form(None),
    use_spot: Optional[bool] = Form(False),
    idle_minutes_to_autostop: Optional[int] = Form(None),
    python_file_name: Optional[str] = Form(None),
    uploaded_dir_path: Optional[str] = Form(None),
    dir_name: Optional[str] = Form(None),
    storage_bucket_ids: Optional[str] = Form(None),
    node_pool_name: Optional[str] = Form(None),
    docker_image_id: Optional[str] = Form(None),
    yaml_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
    scope_check: dict = Depends(require_scope("compute:write")),
):
    try:
        # Parse YAML configuration if provided
        yaml_config = {}
        if yaml_file:
            # Validate file type
            if not yaml_file.filename or not yaml_file.filename.lower().endswith(
                (".yaml", ".yml")
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded file must be a YAML file (.yaml or .yml extension)",
                )

            # Read and parse YAML content
            yaml_content = await yaml_file.read()
            try:
                yaml_config = yaml.safe_load(yaml_content) or {}
            except yaml.YAMLError as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid YAML format: {str(e)}"
                )

            # Validate YAML structure
            if not isinstance(yaml_config, dict):
                raise HTTPException(
                    status_code=400,
                    detail="YAML file must contain a valid configuration object",
                )

        # Merge YAML config with form parameters (form parameters take precedence)
        final_config = {
            "cluster_name": cluster_name,
            "command": command,
            "setup": setup,
            "cloud": cloud,
            "instance_type": instance_type,
            "cpus": cpus,
            "memory": memory,
            "accelerators": accelerators,
            "disk_space": disk_space,
            "region": region,
            "zone": zone,
            "use_spot": use_spot,
            "idle_minutes_to_autostop": idle_minutes_to_autostop,
            "storage_bucket_ids": storage_bucket_ids,
            "node_pool_name": node_pool_name,
            "docker_image_id": docker_image_id,
        }

        # Override with YAML values for all form parameters
        for key, value in yaml_config.items():
            if key in final_config:
                final_config[key] = value

        # Validate required fields
        if not final_config["cluster_name"]:
            raise HTTPException(
                status_code=400,
                detail="cluster_name is required (either in form parameters or YAML file)",
            )

        # Extract final values
        cluster_name = final_config["cluster_name"]
        command = final_config["command"] or "echo 'Hello SkyPilot'"
        setup = final_config["setup"]
        cloud = final_config["cloud"]
        instance_type = final_config["instance_type"]
        cpus = final_config["cpus"]
        memory = final_config["memory"]
        accelerators = final_config["accelerators"]
        disk_space = final_config["disk_space"]
        region = final_config["region"]
        zone = final_config["zone"]
        use_spot = final_config["use_spot"] or False
        idle_minutes_to_autostop = final_config["idle_minutes_to_autostop"]
        storage_bucket_ids = final_config["storage_bucket_ids"]
        node_pool_name = final_config["node_pool_name"]
        docker_image_id = final_config["docker_image_id"]

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

        # Handle uploaded file name from upload route
        file_mounts = None
        if python_file_name:
            # Extract original filename from uploaded name (remove UUID prefix)
            if "_" in python_file_name:
                python_filename = "_".join(python_file_name.split("_")[1:])
            else:
                python_filename = python_file_name

            file_path = UPLOADS_DIR / python_file_name
            if not file_path.exists():
                raise HTTPException(
                    status_code=400,
                    detail=f"Uploaded file '{python_file_name}' not found. Please upload the file first using /upload endpoint.",
                )
            # Mount the file to workspace/<filename> in the cluster
            file_mounts = {f"workspace/{python_filename}": str(file_path)}

        # Handle uploaded directory path from upload route
        if uploaded_dir_path:
            # Validate the uploaded directory exists
            if not os.path.exists(uploaded_dir_path):
                raise HTTPException(
                    status_code=400,
                    detail=f"Uploaded directory '{uploaded_dir_path}' not found. Please upload the files first using /upload endpoint.",
                )

            # Extract base name from the uploaded directory path
            base_name = os.path.basename(uploaded_dir_path)
            if "_" in base_name:
                # Remove UUID prefix if present
                base_name = "_".join(base_name.split("_")[1:])

            # Use provided dir_name if available, otherwise use extracted base_name
            if dir_name:
                base_name = secure_filename(dir_name) or base_name

            # Mount the entire directory at ~/<base_name>
            if file_mounts is None:
                file_mounts = {}
            file_mounts[f"~/{base_name}"] = uploaded_dir_path

        # Handle launch hooks for the organization
        organization_id = user.get("organization_id")
        if organization_id:
            from db.db_models import LaunchHook, LaunchHookFile, TeamMembership
            
            # Get user's team ID
            user_team = db.query(TeamMembership).filter(
                TeamMembership.organization_id == organization_id,
                TeamMembership.user_id == user.get("id")
            ).first()
            user_team_id = user_team.team_id if user_team else None
            
            # Get all active launch hooks for the organization
            active_hooks = db.query(LaunchHook).filter(
                LaunchHook.organization_id == organization_id,
                LaunchHook.is_active == True # noqa: E712
            ).all()
            
            # Filter hooks based on team access
            accessible_hooks = []
            for hook in active_hooks:
                # If no team restrictions (allowed_team_ids is None), hook is accessible to all
                if hook.allowed_team_ids is None:
                    accessible_hooks.append(hook)
                # If user has no team, they can't access team-restricted hooks
                elif user_team_id is None:
                    continue
                # If user's team is in the allowed list, they can access the hook
                elif user_team_id in hook.allowed_team_ids:
                    accessible_hooks.append(hook)
            
            if accessible_hooks:
                # Initialize file_mounts if not already set
                if file_mounts is None:
                    file_mounts = {}
                
                # Collect all setup commands from accessible hooks
                hook_setup_commands = []
                
                for hook in accessible_hooks:
                    # Add setup commands from this hook
                    if hook.setup_commands:
                        hook_setup_commands.append(hook.setup_commands)
                    
                    # Get files for this hook
                    hook_files = db.query(LaunchHookFile).filter(
                        LaunchHookFile.launch_hook_id == hook.id,
                        LaunchHookFile.is_active == True # noqa: E712
                    ).all()
                    
                    # Mount each file to ~/hooks/<filename>
                    for hook_file in hook_files:
                        if os.path.exists(hook_file.file_path):
                            mount_path = f"~/hooks/{hook_file.original_filename}"
                            file_mounts[mount_path] = hook_file.file_path
                
                # Prepend hook setup commands to the main setup commands
                if hook_setup_commands:
                    combined_setup = "\n".join(hook_setup_commands)
                    if setup:
                        setup = f"{combined_setup}\n{setup}"
                    else:
                        setup = combined_setup

        # Pre-calculate requested GPU count and preserve selected RunPod option for pricing
        # (RunPod mapping below may clear 'accelerators')
        def _parse_requested_gpu_count(
            accel: Optional[str], cloud_name: Optional[str]
        ) -> int:
            if not accel:
                return 0
            s = str(accel).strip()
            if s.upper().startswith("CPU"):
                return 0
            if ":" in s:
                try:
                    return max(0, int(s.split(":")[-1].strip()))
                except Exception:
                    return 1
            return 1

        _initial_requested_gpu_count = _parse_requested_gpu_count(accelerators, cloud)
        _runpod_display_option_for_pricing = (
            accelerators if (cloud or "").lower() == "runpod" else None
        )

        # RunPod: map display string to instance type if accelerators is provided
        if cloud == "runpod":
            if accelerators:
                mapped_instance_type = map_runpod_display_to_instance_type(
                    accelerators
                )
                if mapped_instance_type.lower().startswith("cpu"):
                    # Using skypilot logic to have disk size lesser than 10x vCPUs
                    disk_size = 5 * int(mapped_instance_type.split("-")[1])
                else:
                    # For GPU instances, only set disk_size if disk_space is provided
                    if disk_space:
                        try:
                            disk_size = int(disk_space)
                        except ValueError:
                            # If disk_space is not a valid integer, ignore it
                            disk_size = None
                            pass
                if mapped_instance_type != accelerators:
                    instance_type = mapped_instance_type
                    # Clear accelerators for RunPod since we're using instance_type
                    accelerators = None

        # Setup credentials for Azure or RunPod, depending on cloud
        if cloud == "azure":
            try:
                # az_setup_config()
                az_config_dict = az_get_current_config(
                    organization_id=user.get("organization_id"), db=db
                )
                # az_config_dict = az_config["configs"][az_config["default_config"]]
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
        elif cloud == "runpod":
            try:
                from routes.clouds.runpod.utils import rp_get_current_config
                rp_config = rp_get_current_config(organization_id=user.get("organization_id"))
                if rp_config and rp_config.get("api_key"):
                    credentials = {
                        "runpod": {
                            "api_key": rp_config.get("api_key"),
                        }
                    }
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup RunPod credentials: {str(e)}"
                )
        # print(f"az_config: {az_config}")
        # raise Exception("test")
        print(f"credentials: {credentials}")

        # Get user info from the authenticated user (API key or session)
        user_id = user["id"]
        organization_id = user["organization_id"]

        # Enforce team-based access to selected node pool/provider
        try:
            team_id = get_user_team_id(db, organization_id, user_id)
            if cloud == "ssh":
                if not node_pool_name:
                    raise HTTPException(
                        status_code=400,
                        detail="node_pool_name is required for SSH launches",
                    )

                # First check if the node pool exists
                pool = (
                    db.query(SSHNodePoolDB)
                    .filter(SSHNodePoolDB.name == node_pool_name)
                    .first()
                )
                if not pool:
                    raise HTTPException(
                        status_code=404,
                        detail=f"SSH node pool '{node_pool_name}' not found",
                    )

                # Explicitly verify that the org ID of the submitter matches the org ID that the node_pool_name belongs to
                if pool.organization_id != organization_id:
                    raise HTTPException(
                        status_code=403,
                        detail=f"SSH node pool '{node_pool_name}' is not accessible to the current user's organization.",
                    )
                allowed_team_ids = []
                try:
                    od = pool.other_data or {}
                    if isinstance(od, dict):
                        allowed_team_ids = od.get("allowed_team_ids", []) or []
                except Exception:
                    allowed_team_ids = []
                if allowed_team_ids and (
                    team_id is None or team_id not in allowed_team_ids
                ):
                    raise HTTPException(
                        status_code=403,
                        detail="Your team does not have access to this SSH node pool",
                    )
            elif cloud in ("azure", "runpod"):
                # Determine default config key to identify pool
                pool_key = None
                try:
                    if cloud == "azure":
                        cfg = load_azure_config(user.get("organization_id"), db)
                    else:
                        cfg = load_runpod_config(user.get("organization_id"), db)
                    pool_key = cfg.get("default_config")
                except Exception:
                    pool_key = None
                # If access row exists and has restrictions, enforce
                if pool_key:
                    access_row = (
                        db.query(NodePoolAccessDB)
                        .filter(
                            NodePoolAccessDB.organization_id == organization_id,
                            NodePoolAccessDB.provider == cloud,
                            NodePoolAccessDB.pool_key == pool_key,
                        )
                        .first()
                    )
                    allowed_team_ids = (
                        access_row.allowed_team_ids
                        if access_row and access_row.allowed_team_ids
                        else []
                    )
                    if allowed_team_ids and (
                        team_id is None or team_id not in allowed_team_ids
                    ):
                        raise HTTPException(
                            status_code=403,
                            detail=f"Your team does not have access to the {cloud.title()} node pool",
                        )
        except HTTPException:
            raise
        except Exception as e:
            # Fail closed only if explicit restrictions exist; otherwise continue
            print(f"Access check warning: {e}")

        # Quota enforcement: ensure user has enough remaining credits for requested GPUs
        try:
            requested_gpu_count = _initial_requested_gpu_count
            cloud_lower = (cloud or "").lower()

            # Compute price-per-hour for the requested config
            price_per_hour = None
            if cloud_lower == "runpod":
                price_source = _runpod_display_option_for_pricing or accelerators
                if price_source:
                    price_per_hour = rp_get_price_per_hour(price_source)
            elif cloud_lower == "azure" and instance_type:
                price_per_hour = az_get_price_per_hour(instance_type, region=region)

            # If accelerators not provided for Azure, try to infer GPU count for info logs
            if requested_gpu_count == 0 and cloud_lower == "azure" and instance_type:
                try:
                    requested_gpu_count = max(0, int(az_infer_gpu_count(instance_type)))
                except Exception as _e:
                    print(f"Azure GPU inference warning for '{instance_type}': {_e}")

            # Apply price-based quota enforcement for non-SSH clouds when price is available
            if cloud_lower != "ssh" and price_per_hour is not None:
                quota_info = get_current_user_quota_info(db, organization_id, user_id)
                available_credits = float(
                    quota_info.get("current_period_remaining", 0.0) or 0.0
                )
                # Default to at least 1 hour of usage for admission check
                estimated_hours = 1.0
                required_credits = float(price_per_hour) * estimated_hours
                if available_credits < required_credits:
                    raise HTTPException(
                        status_code=403,
                        detail=(
                            "Insufficient quota to launch instance. "
                            f"Estimated cost: {required_credits:.2f} for ~{estimated_hours:.0f} hour(s); "
                            f"Available credits: {available_credits:.2f}. "
                        ),
                    )
        except HTTPException:
            raise
        except Exception as e:
            # Fail-open in case of unexpected quota calculation issues to avoid blocking launches unintentionally
            print(f"Quota check warning: {e}")

        # Create cluster platform entry and get the actual cluster name
        # For SSH clusters, use the node pool name as platform for easier mapping
        if cloud == "ssh" and node_pool_name is not None:
            platform = node_pool_name
        elif cloud is None:
            # Multi-cloud deployment - will be updated after launch when we know which cloud was selected
            platform = "multi-cloud"
        else:
            platform = cloud or "unknown"

        cluster_user_info = {
            "name": user.get("first_name", ""),
            "email": user.get("email", ""),
            "id": user.get("id", ""),
            "organization_id": user.get("organization_id", ""),
        }

        # Create cluster platform entry with display name and get actual cluster name
        actual_cluster_name = create_cluster_platform_entry(
            display_name=cluster_name,
            platform=platform,
            user_id=user_id,
            organization_id=organization_id,
            user_info=cluster_user_info,
        )

        # Handle disk_space parameter for all cloud providers
        if disk_space and not disk_size:
            try:
                disk_size = int(disk_space)
            except ValueError:
                # If disk_space is not a valid integer, ignore it
                disk_size = None
                pass

        # Launch cluster using the actual cluster name
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
            disk_size=disk_size,
            storage_bucket_ids=parsed_storage_bucket_ids,
            node_pool_name=node_pool_name,
            docker_image_id=docker_image_id,
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

        # For multi-cloud deployments, update platform information after launch
        if cloud is None:

            def update_platform_after_launch():
                try:
                    # Wait a bit for the cluster to be created
                    import time

                    time.sleep(5)

                    # Determine which cloud was actually selected
                    from routes.instances.utils import (
                        determine_actual_cloud_from_skypilot_status,
                    )
                    from utils.cluster_utils import update_cluster_platform

                    actual_cloud = determine_actual_cloud_from_skypilot_status(
                        actual_cluster_name
                    )
                    if actual_cloud:
                        update_cluster_platform(actual_cluster_name, actual_cloud)
                        print(
                            f"Updated cluster {actual_cluster_name} platform to: {actual_cloud}"
                        )
                    else:
                        print(
                            f"Could not determine actual cloud for cluster {actual_cluster_name}"
                        )
                except Exception as e:
                    print(
                        f"Error updating platform for cluster {actual_cluster_name}: {e}"
                    )

            # Run platform update in background thread
            import threading

            threading.Thread(target=update_platform_after_launch, daemon=True).start()

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
    db: Session = Depends(get_db),
    scope_check: dict = Depends(require_scope("compute:write")),
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
            db=db,
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
    scope_check: dict = Depends(require_scope("compute:write")),
    db: Session = Depends(get_db),
):
    try:
        # Resolve display name to actual cluster name
        display_name = down_request.cluster_name
        actual_cluster_name = handle_cluster_name_param(
            display_name, user["id"], user["organization_id"]
        )

        # Update cluster state to terminating
        update_cluster_state(actual_cluster_name, "terminating")

        request_id = down_cluster_with_skypilot(
            actual_cluster_name,
            display_name,
            user_id=user["id"],
            organization_id=user["organization_id"],
            db=db,
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

            # Get cluster state
            state = get_cluster_state(record["name"])

            clusters.append(
                ClusterStatusResponse(
                    cluster_name=display_name,  # Return display name to user
                    status=str(record["status"]),
                    state=state,
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
        cluster_type = "ssh" if is_ssh else "cloud"
        return {
            "cluster_name": cluster_name,  # Return display name to user
            "cluster_type": cluster_type,
            "is_ssh": is_ssh,
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

                # Create a copy of cluster data with display name and cloud provider
                filtered_cluster_data = cluster_data.copy()
                filtered_cluster_data["name"] = cluster_display_name
                filtered_cluster_data["cloud_provider"] = platform_info.get(
                    "platform", "direct"
                )
                filtered_clusters.append(filtered_cluster_data)

        return filtered_clusters
    except Exception as e:
        print(f"🔍 Error in /cost-report: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cost report: {str(e)}"
        )


@router.get("/resolve-name/{cluster_name}")
async def resolve_cluster_name(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Resolve a cluster display name to its actual cluster name.
    Used by CLI tools to map user-friendly names to internal names.
    """
    try:
        actual_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )
        return {"display_name": cluster_name, "actual_name": actual_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to resolve cluster name: {str(e)}"
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
    - Cluster type
    - Platform information
    - Template information
    - Jobs associated with the cluster
    - SSH node information (if applicable)

    Returns:
        dict: A comprehensive object containing all cluster information
            - cluster: Basic cluster status and metadata
            - cluster_type: Type information
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
        cluster_type = "ssh" if is_ssh else "cloud"

        cluster_type_info = {
            "cluster_name": cluster_name,
            "cluster_type": cluster_type,
            "is_ssh": is_ssh,
        }

        # Get platform information
        platform_info = get_cluster_platform(actual_cluster_name)

        # Get cluster state
        state = get_cluster_state(actual_cluster_name)

        # Get jobs for this cluster
        try:
            # Fetch credentials for the cluster based on the platform
            platform_info_jobs = get_cluster_platform_info_util(actual_cluster_name)
            credentials = None
            if platform_info_jobs and platform_info_jobs.get("platform"):
                platform = platform_info_jobs["platform"]
                if platform == "azure":
                    try:
                        azure_config_dict = az_get_current_config(
                            organization_id=user.get("organization_id")
                        )
                        credentials = {
                            "azure": {
                                "service_principal": {
                                    "tenant_id": azure_config_dict["tenant_id"],
                                    "client_id": azure_config_dict["client_id"],
                                    "client_secret": azure_config_dict["client_secret"],
                                    "subscription_id": azure_config_dict[
                                        "subscription_id"
                                    ],
                                },
                            }
                        }
                    except Exception as e:
                        print(f"Failed to get Azure credentials: {e}")
                        credentials = None
                elif platform == "runpod":
                    try:
                        from routes.clouds.runpod.utils import rp_get_current_config
                        rp_config = rp_get_current_config(
                            organization_id=user.get("organization_id")
                        )
                        if rp_config and rp_config.get("api_key"):
                            credentials = {
                                "runpod": {
                                    "api_key": rp_config.get("api_key"),
                                }
                            }
                    except Exception as e:
                        print(f"Failed to get RunPod credentials: {e}")
                        credentials = None
                else:
                    credentials = None

            job_records = get_cluster_job_queue(
                actual_cluster_name, credentials=credentials
            )
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

        # Get cost information for this cluster
        cost_info = None
        try:
            # Get the full cost report and find this cluster's cost data
            report = generate_cost_report()
            if report:
                for cluster_cost_data in report:
                    if cluster_cost_data.get("name") == actual_cluster_name:
                        total_cost = cluster_cost_data.get("total_cost", 0)
                        duration = cluster_cost_data.get("duration", 0)
                        cost_per_hour = 0
                        if duration and duration > 0:
                            cost_per_hour = total_cost / (
                                duration / 3600
                            )  # Convert seconds to hours

                        cost_info = {
                            "total_cost": total_cost,
                            "duration": duration,
                            "cost_per_hour": cost_per_hour,
                            "launched_at": cluster_cost_data.get("launched_at"),
                            "status": cluster_cost_data.get("status"),
                            "cloud": cluster_cost_data.get("cloud"),
                            "region": cluster_cost_data.get("region"),
                        }
                        break
        except Exception as e:
            print(f"Warning: Failed to get cost info for cluster {cluster_name}: {e}")
            # Continue without cost info if there's an error

        return {
            "cluster": cluster_data,
            "cluster_type": cluster_type_info,
            "platform": platform_info,
            "state": state,
            "jobs": jobs,
            "ssh_node_info": ssh_node_info,
            "cost_info": cost_info,
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
    scope_check: dict = Depends(require_scope("compute:write")),
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


@router.post("/upload")
async def upload_files(
    request: Request,
    response: Response,
    python_file: Optional[UploadFile] = File(None),
    dir_files: Optional[List[UploadFile]] = File(None),
    dir_name: Optional[str] = Form(None),
    user: dict = Depends(get_user_or_api_key),
    scope_check: dict = Depends(require_scope("compute:write")),
):
    """
    Upload files for use in cluster launches and job submissions.
    Returns uploaded file names that can be passed to /launch and /{cluster_name}/submit routes.
    """
    try:
        uploaded_files = {}

        # Handle single Python file upload
        if python_file and python_file.filename:
            python_filename = secure_filename(python_file.filename)
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename

            with open(file_path, "wb") as f:
                f.write(await python_file.read())

            uploaded_files["python_file"] = {
                "original_name": python_filename,
                "uploaded_name": unique_filename,
                "file_path": str(file_path),
            }

        # Handle directory files upload
        if dir_files:
            # Sanitize provided dir_name, or derive from files
            base_name = dir_name or "project"
            base_name = os.path.basename(base_name.strip())
            base_name = secure_filename(base_name) or "project"

            unique_dir = UPLOADS_DIR / f"{uuid.uuid4()}_{base_name}"
            unique_dir.mkdir(parents=True, exist_ok=True)

            uploaded_files["dir_files"] = {
                "dir_name": base_name,
                "uploaded_dir": str(unique_dir),
                "files": [],
            }

            for up_file in dir_files:
                if up_file.filename:
                    # Filename includes relative path as sent by frontend
                    raw_rel = up_file.filename
                    # Normalize path, remove leading separators and traversal
                    norm_rel = (
                        os.path.normpath(raw_rel).lstrip(os.sep).replace("\\", "/")
                    )
                    parts = [p for p in norm_rel.split("/") if p not in ("..", "")]
                    safe_rel = Path(*[secure_filename(p) for p in parts])
                    target_path = unique_dir / safe_rel
                    target_path.parent.mkdir(parents=True, exist_ok=True)

                    with open(target_path, "wb") as f:
                        f.write(await up_file.read())

                    uploaded_files["dir_files"]["files"].append(
                        {"original_path": raw_rel, "uploaded_path": str(safe_rel)}
                    )

        if not uploaded_files:
            raise HTTPException(
                status_code=400,
                detail="No files were uploaded. Please provide either python_file or dir_files.",
            )

        return {
            "uploaded_files": uploaded_files,
            "message": "Files uploaded successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload files: {str(e)}")
