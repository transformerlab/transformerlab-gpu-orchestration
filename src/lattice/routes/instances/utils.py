import asyncio
import json
import os
import sys
import tempfile
from typing import Optional
from sqlalchemy import or_

import sky
from fastapi import HTTPException
from routes.clouds.azure.utils import az_get_current_config
from routes.jobs.utils import get_cluster_job_queue, save_cluster_jobs
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_info_util,
)
from sqlalchemy.orm import Session
from utils.skypilot_tracker import skypilot_tracker
from werkzeug.utils import secure_filename


async def fetch_and_parse_gpu_resources(cluster_name: str):
    async def run_cmd(cmd, capture_output=True):
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE if capture_output else None,
                stderr=asyncio.subprocess.PIPE if capture_output else None,
            )
            print(f"PROCESS: {process}")
            stdout, stderr = await process.communicate()
            return (
                process.returncode,
                stdout.decode() if stdout else "",
                stderr.decode() if stderr else "",
            )
        except Exception as e:
            print(f"Error running command: {e}")
            return None, None, str(e)

    # code, out, err = await run_cmd(["sky", "ssh", "up", "--infra", cluster_name])
    request_id = sky.client.sdk.ssh_up(infra=cluster_name)
    try:
        sky.get(request_id)
    except Exception as e:
        print(f"Error bringing up SSH cluster: {e}")
        raise Exception(f"Failed to bring up SSH cluster: {e}")
    # if code != 0:
    #     raise Exception(f"Failed to bring up SSH cluster: {err or out}")
    # 3. sky show-gpus --infra ssh
    code, out, err = await run_cmd(
        ["sky", "show-gpus", "--infra", f"ssh/{cluster_name}"]
    )
    # 4. sky ssh down (cleanup)
    # await run_cmd(["sky", "ssh", "down", "--infra", cluster_name], capture_output=False)

    def parse_gpu_output(output, cluster_name):
        import re

        lines = output.splitlines()
        gpus = []
        node_gpus = []
        pool_section = False
        per_node_section = False

        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith(f"SSH Node Pool: {cluster_name}"):
                pool_section = True
                per_node_section = False
                continue
            if line.startswith("SSH Node Pool per-node GPU availability"):
                pool_section = False
                per_node_section = True
                continue
            if pool_section:
                if line.startswith("GPU"):
                    continue  # skip header
                parts = re.split(r"\s{2,}", line)
                if len(parts) >= 3:
                    gpus.append(
                        {
                            "gpu": parts[0],
                            "requestable_qty_per_node": parts[1],
                            "utilization": parts[2],
                            "free": parts[2].split("of")[0].strip(),
                            "total": parts[2].split("of")[1].split("free")[0].strip(),
                        }
                    )
            elif per_node_section:
                if line.startswith("NODE_POOL"):
                    continue  # skip per-node header
                parts = re.split(r"\s{2,}", line)
                if len(parts) >= 4:
                    node_gpus.append(
                        {
                            "node_pool": parts[0],
                            "node": parts[1],
                            "gpu": parts[2],
                            "utilization": parts[3],
                            "free": parts[3].split("of")[0].strip(),
                            "total": parts[3].split("of")[1].split("free")[0].strip(),
                        }
                    )
        if gpus or node_gpus:
            return {"gpus": gpus, "node_gpus": node_gpus}
        if "No GPUs found in any SSH clusters" in output:
            return {
                "gpus": [],
                "node_gpus": [],
                "message": "No GPUs found in this SSH cluster.",
            }
        return {
            "gpus": [],
            "node_gpus": [],
            "message": "No GPU info found for this cluster.",
        }

    return parse_gpu_output(out, cluster_name)


def generate_cost_report():
    request_id = sky.client.sdk.cost_report()
    cost_report = sky.get(request_id)

    # print(f"[SkyPilot] Cost report: {cost_report}")
    return cost_report


def launch_cluster_with_skypilot(
    cluster_name: str,
    command: str,
    setup=None,
    cloud=None,
    instance_type=None,
    cpus=None,
    memory=None,
    accelerators=None,
    region=None,
    zone=None,
    use_spot=False,
    idle_minutes_to_autostop=None,
    file_mounts: Optional[dict] = None,
    disk_size: Optional[int] = None,
    storage_bucket_ids: Optional[list] = None,
    node_pool_name: Optional[str] = None,
    docker_image_id: Optional[str] = None,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    display_name: Optional[str] = None,
    credentials: Optional[dict] = None,
):
    try:
        # RunPod no longer requires global setup; credentials are passed directly to SkyPilot

        if cloud and cloud.lower() == "ssh":
            # Validate using DB and rely on SkyPilot's ssh_up with infra name
            from lattice.routes.node_pools.utils import (
                is_ssh_cluster,
                validate_node_pool_identity_files,
            )

            # Use node_pool_name for validation if provided, otherwise use cluster_name
            validation_name = node_pool_name if node_pool_name else cluster_name

            if not is_ssh_cluster(validation_name):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"SSH cluster '{validation_name}' not found. Create it in SSH Clusters first."
                    ),
                )

            # Validate that all identity files for nodes in the node pool still exist
            missing_files = validate_node_pool_identity_files(validation_name)
            if missing_files:
                # files_list = "\n".join(f"  - {file}" for file in missing_files)
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Some identity files for node pool '{validation_name}' are missing or no longer exist:\n"
                        f"Please check your SSH configuration and ensure all identity files are present."
                    ),
                )
            try:
                print(
                    f"[SkyPilot] Running: sky.client.sdk.ssh_up(infra={validation_name})"
                )
                request_id = sky.client.sdk.ssh_up(infra=validation_name)
                result = sky.get(request_id)
                print(f"[SkyPilot][ssh up result]:\n{result}")
            except Exception as e:
                print(f"[SkyPilot][ssh up error]: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to run sky ssh up for cluster '{validation_name}': {str(e)}",
                )
        envs = None
        docker_image_tag = None
        # Set Docker authentication environment variables if docker image is provided
        if docker_image_id:
            from config import get_db
            from db.db_models import DockerImage, ContainerRegistry

            # Get database session
            db = next(get_db())
            try:
                # Fetch docker image and its associated container registry (if any)
                image = (
                    db.query(DockerImage)
                    .outerjoin(
                        ContainerRegistry,
                        DockerImage.container_registry_id == ContainerRegistry.id,
                    )
                    .filter(
                        DockerImage.id == docker_image_id,
                        DockerImage.is_active,
                        or_(
                            ContainerRegistry.is_active == True,  # noqa: E712
                            DockerImage.container_registry_id.is_(None),
                        ),
                    )
                    .first()
                )

                if image:
                    # Set the docker image tag for SkyPilot
                    docker_image_tag = image.image_tag

                    # Set Docker authentication environment variables only if image has a registry
                    if image.container_registry_id and image.container_registry:
                        task_envs = {
                            "SKYPILOT_DOCKER_USERNAME": image.container_registry.docker_username,
                            "SKYPILOT_DOCKER_PASSWORD": image.container_registry.docker_password,
                            "SKYPILOT_DOCKER_SERVER": image.container_registry.docker_server,
                        }
                        envs = task_envs.copy()
                    else:
                        # Standalone image (no registry needed)
                        envs = None
                else:
                    envs = None
            finally:
                db.close()
        else:
            envs = None

        name = "lattice-task-setup"

        task = sky.Task(
            name=name,
            run=command,
            setup=setup,
            envs=envs,
        )

        # Process storage buckets if provided
        if storage_bucket_ids:
            from config import get_db
            from db.db_models import StorageBucket

            # Get database session
            db = next(get_db())
            try:
                # Fetch storage buckets
                buckets = (
                    db.query(StorageBucket)
                    .filter(StorageBucket.id.in_(storage_bucket_ids))
                    .all()
                )

                # Convert buckets to sky.Storage objects
                storage_mounts = {}
                mode_map = {
                    "MOUNT": sky.StorageMode.MOUNT,
                    "COPY": sky.StorageMode.COPY,
                    "MOUNT_CACHED": sky.StorageMode.MOUNT_CACHED,
                }
                store_map = {
                    "s3": sky.StoreType.S3,
                    "gcs": sky.StoreType.GCS,
                    "azure": sky.StoreType.AZURE,
                    "r2": sky.StoreType.R2,
                    "ibm": sky.StoreType.IBM,
                    "oci": sky.StoreType.OCI,
                    "auto": None,
                }
                for bucket in buckets:
                    # Create sky.Storage object based on bucket configuration
                    if bucket.source:
                        # If bucket has a source (local path or bucket URI), use it
                        storage_obj = sky.Storage(
                            name=bucket.name,
                            mode=mode_map[bucket.mode],
                            source=bucket.source,
                            persistent=bucket.persistent,
                        )
                    else:
                        # Create a new bucket with the bucket name
                        storage_kwargs = {
                            "name": secure_filename(str(bucket.name).lower()),
                            "mode": mode_map[bucket.mode],
                            "persistent": bucket.persistent,
                        }
                        bucket.store = bucket.store.lower()
                        if bucket.store and store_map[bucket.store] is not None:
                            storage_kwargs["stores"] = [store_map[bucket.store]]

                        storage_obj = sky.Storage(**storage_kwargs)

                    storage_mounts[bucket.remote_path] = storage_obj

                # Set storage mounts on the task
                task.set_storage_mounts(storage_mounts)

            except Exception as e:
                print(f"[SkyPilot] Warning: Failed to process storage buckets: {e}")
            finally:
                db.close()

        if file_mounts:
            task.set_file_mounts(file_mounts)

        # If no cloud is specified, create a list of resources for all available clouds
        if not cloud:
            resources_list = []

            # Get available clouds and node pools for the organization
            if organization_id:
                from config import get_db
                from routes.clouds.runpod.utils import rp_get_current_config
                from routes.clouds.azure.utils import az_get_current_config
                from routes.node_pools.utils import list_cluster_names_from_db_by_org

                db = next(get_db())
                try:
                    # Get SSH node pools
                    ssh_node_pools = list_cluster_names_from_db_by_org(organization_id)
                    for node_pool in ssh_node_pools:
                        ssh_resources_kwargs = {"infra": f"ssh/{node_pool}"}
                        if cpus:
                            ssh_resources_kwargs["cpus"] = cpus
                        if memory:
                            ssh_resources_kwargs["memory"] = memory
                        if accelerators:
                            ssh_resources_kwargs["accelerators"] = accelerators
                        if region:
                            ssh_resources_kwargs["region"] = region
                        if zone:
                            ssh_resources_kwargs["zone"] = zone
                        if disk_size:
                            ssh_resources_kwargs["disk_size"] = disk_size
                        if docker_image_tag:
                            ssh_resources_kwargs["image_id"] = (
                                f"docker:{docker_image_tag}"
                            )

                        resources_list.append(sky.Resources(**ssh_resources_kwargs))

                    # Get RunPod configuration
                    runpod_config = rp_get_current_config(organization_id, db)
                    if runpod_config:
                        runpod_resources_kwargs = {"cloud": "runpod"}
                        if instance_type:
                            runpod_resources_kwargs["instance_type"] = instance_type
                        if cpus:
                            runpod_resources_kwargs["cpus"] = cpus
                        if memory:
                            runpod_resources_kwargs["memory"] = memory
                        if accelerators:
                            runpod_resources_kwargs["accelerators"] = accelerators
                        if region:
                            runpod_resources_kwargs["region"] = region
                        if zone:
                            runpod_resources_kwargs["zone"] = zone
                        if disk_size:
                            runpod_resources_kwargs["disk_size"] = disk_size
                        if docker_image_tag:
                            runpod_resources_kwargs["image_id"] = (
                                f"docker:{docker_image_tag}"
                            )

                        resources_list.append(sky.Resources(**runpod_resources_kwargs))

                    # Get Azure configuration
                    azure_config = az_get_current_config(organization_id, db)
                    if azure_config:
                        azure_resources_kwargs = {"cloud": "azure"}
                        if instance_type:
                            azure_resources_kwargs["instance_type"] = instance_type
                        if cpus:
                            azure_resources_kwargs["cpus"] = cpus
                        if memory:
                            azure_resources_kwargs["memory"] = memory
                        if accelerators:
                            azure_resources_kwargs["accelerators"] = accelerators
                        if region:
                            azure_resources_kwargs["region"] = region
                        if zone:
                            azure_resources_kwargs["zone"] = zone
                        if use_spot:
                            azure_resources_kwargs["use_spot"] = use_spot
                        if disk_size:
                            azure_resources_kwargs["disk_size"] = disk_size
                        if docker_image_tag:
                            azure_resources_kwargs["image_id"] = (
                                f"docker:{docker_image_tag}"
                            )

                        resources_list.append(sky.Resources(**azure_resources_kwargs))

                finally:
                    db.close()

            # Set the list of resources on the task
            if resources_list:
                task.set_resources(resources_list)
                print(
                    f"Set {len(resources_list)} resources for multi-cloud deployment: {resources_list}"
                )
        else:
            # Original single cloud logic
            resources_kwargs = {}
            if cloud.lower() == "ssh":
                resources_kwargs["infra"] = f"ssh/{node_pool_name}"
            elif cloud.lower() == "runpod":
                resources_kwargs["cloud"] = "runpod"
            elif cloud.lower() == "azure":
                resources_kwargs["cloud"] = "azure"
            else:
                resources_kwargs["infra"] = cloud

            if instance_type:
                resources_kwargs["instance_type"] = instance_type
            if cpus:
                resources_kwargs["cpus"] = cpus
            if memory:
                resources_kwargs["memory"] = memory
            if accelerators:
                resources_kwargs["accelerators"] = accelerators
            if region:
                resources_kwargs["region"] = region
            if zone:
                resources_kwargs["zone"] = zone
            if use_spot and cloud and cloud.lower() not in ["ssh", "runpod"]:
                resources_kwargs["use_spot"] = use_spot
            if disk_size:
                resources_kwargs["disk_size"] = disk_size

            # Add Docker image support
            if docker_image_tag:
                resources_kwargs["image_id"] = f"docker:{docker_image_tag}"

            if resources_kwargs:
                resources = sky.Resources(**resources_kwargs)
                task.set_resources(resources)

        request_id = sky.launch(
            task,
            cluster_name=cluster_name,
            idle_minutes_to_autostop=idle_minutes_to_autostop,
            credentials=credentials,
        )
        print(f"REQUEST ID: {request_id}")

        # Store the request in the database if user info is provided
        if user_id and organization_id:
            try:
                # Use display_name if provided, otherwise fall back to cluster_name
                cluster_name_to_store = display_name if display_name else cluster_name
                skypilot_tracker.store_request(
                    user_id=user_id,
                    organization_id=organization_id,
                    task_type="launch",
                    request_id=request_id,
                    cluster_name=cluster_name_to_store,
                )
                print(f"Stored SkyPilot request {request_id} in database")
            except Exception as e:
                print(f"Warning: Failed to store SkyPilot request in database: {e}")

        # Note: Platform information is now handled by the calling route before launch

        return request_id
    except Exception as e:
        print(f"Error launching cluster: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


async def launch_cluster_with_skypilot_isolated(
    cluster_name: str,
    command: str,
    setup=None,
    cloud=None,
    instance_type=None,
    cpus=None,
    memory=None,
    accelerators=None,
    region=None,
    zone=None,
    use_spot=False,
    idle_minutes_to_autostop=None,
    file_mounts: Optional[dict] = None,
    disk_size: Optional[int] = None,
    storage_bucket_ids: Optional[list] = None,
    node_pool_name: Optional[str] = None,
    docker_image_id: Optional[str] = None,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    display_name: Optional[str] = None,
    credentials: Optional[dict] = None,
):
    """
    Launch cluster in a separate process to avoid thread-local storage leakage.
    This prevents SkyPilot's thread-local variables from interfering between launches.
    """
    try:
        # Serialize the launch parameters
        launch_params = {
            "cluster_name": cluster_name,
            "command": command,
            "setup": setup,
            "cloud": cloud,
            "instance_type": instance_type,
            "cpus": cpus,
            "memory": memory,
            "accelerators": accelerators,
            "region": region,
            "zone": zone,
            "use_spot": use_spot,
            "idle_minutes_to_autostop": idle_minutes_to_autostop,
            "file_mounts": file_mounts,
            "disk_size": disk_size,
            "storage_bucket_ids": storage_bucket_ids,
            "node_pool_name": node_pool_name,
            "docker_image_id": docker_image_id,
            "user_id": user_id,
            "organization_id": organization_id,
            "display_name": display_name,
            "credentials": credentials,
        }

        # Create a temporary file to pass parameters
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(launch_params, f, default=str)
            params_file = f.name

        try:
            # Prepare environment for the child process
            self_env = os.environ.copy()

            # Get the current working directory and Python path
            current_dir = os.path.dirname(os.path.abspath(__file__))
            lattice_root = os.path.dirname(os.path.dirname(current_dir))

            # Create the worker script content
            worker_script = f'''
import sys
import os
import json

# Add the lattice directory to Python path
sys.path.insert(0, "{lattice_root}")

# Change to the correct working directory
os.chdir("{lattice_root}")

# Import the worker function
from lattice.routes.instances.utils import _launch_cluster_worker

# Load parameters
with open("{params_file}", "r") as f:
    params = json.load(f)

# Execute the launch
try:
    result = _launch_cluster_worker(**params)
    print(json.dumps({{"success": True, "request_id": result}}))
except Exception as e:
    print(json.dumps({{"success": False, "error": str(e)}}))
'''

            # Run the launch in a separate process
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                "-c",
                worker_script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=lattice_root,
                env=self_env,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise HTTPException(
                    status_code=500,
                    detail=f"Launch process failed with code {process.returncode}: {error_msg}",
                )

            # Parse the result: handle noisy stdout before JSON
            output_text = stdout.decode().strip() if stdout else ""
            # Try to parse the last JSON-looking line
            if output_text:
                lines = [ln.strip() for ln in output_text.splitlines() if ln.strip()]
                for ln in reversed(lines):
                    if ln.startswith("{") and ln.endswith("}"):
                        try:
                            result_data = json.loads(ln)
                            if result_data.get("success"):
                                return result_data.get("request_id")
                            else:
                                raise HTTPException(
                                    status_code=500,
                                    detail=f"Launch failed: {result_data.get('error', 'Unknown error')}",
                                )
                        except Exception:
                            continue
                # Fallback: extract request id from 'REQUEST ID: <id>' line
                try:
                    import re
                    m = re.search(r"REQUEST ID:\s*([0-9a-fA-F\-]{36}|[A-Za-z0-9_\-]{8,})", output_text)
                    if m:
                        return m.group(1)
                except Exception:
                    pass
                # Last resort: return the raw output to aid debugging
                return output_text
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Launch process returned invalid output: {stderr.decode() if stderr else 'No output'}",
                )
        finally:
            # Clean up the temporary file
            try:
                os.unlink(params_file)
            except FileNotFoundError:
                pass

    except Exception as e:
        print(f"Error in isolated launch: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to launch cluster in isolated process: {str(e)}",
        )


def _launch_cluster_worker(**params):
    """
    Worker function that runs the actual sky.launch in a separate process.
    This ensures complete isolation from thread-local storage.
    """
    return launch_cluster_with_skypilot(**params)
def determine_actual_cloud_from_skypilot_status(cluster_name: str) -> Optional[str]:
    """
    Determine which cloud was actually selected by SkyPilot by examining the cluster status.
    This is useful for multi-cloud deployments where the actual cloud is determined after launch.

    Args:
        cluster_name: The actual cluster name

    Returns:
        The actual cloud platform that was selected, or None if not found
    """
    try:
        # Get SkyPilot status for this specific cluster
        status_result = get_skypilot_status([cluster_name])

        if not status_result:
            return None

        cluster_info = status_result[0] if status_result else None
        if not cluster_info:
            return None

        # Get the cloud type from the structured data
        cloud = cluster_info.get("cloud", "").lower()

        if cloud == "ssh":
            # For SSH clusters, the region field contains "ssh-{node_pool_name}"
            # We need to extract just the node pool name
            region = cluster_info.get("region", "")
            if region and region.startswith("ssh-"):
                # Extract node pool name by removing "ssh-" prefix
                node_pool_name = region[4:]  # Remove "ssh-" prefix
                return node_pool_name
            elif region:
                # Fallback: return the region as-is if it doesn't start with "ssh-"
                return region
            return "ssh"
        elif cloud == "runpod":
            return "runpod"
        elif cloud == "azure":
            return "azure"
        else:
            # Fallback: try to extract from other fields
            return cloud if cloud else None

        return None

    except Exception as e:
        print(f"Error determining actual cloud for cluster {cluster_name}: {e}")
        return None


def stop_cluster_with_skypilot(
    cluster_name: str,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    display_name: Optional[str] = None,
    db: Optional[Session] = None,
):
    try:
        # Fetch credentials for the cluster based on the platform
        platform_info = get_cluster_platform_info_util(cluster_name)
        credentials = None
        if platform_info and platform_info.get("platform"):
            platform = platform_info["platform"]
            if platform == "azure":
                try:
                    azure_config_dict = az_get_current_config(
                        organization_id=organization_id, db=db
                    )
                    credentials = {
                        "azure": {
                            "service_principal": {
                                "tenant_id": azure_config_dict["tenant_id"],
                                "client_id": azure_config_dict["client_id"],
                                "client_secret": azure_config_dict["client_secret"],
                                "subscription_id": azure_config_dict["subscription_id"],
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
                        organization_id=organization_id
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

        request_id = sky.stop(cluster_name=cluster_name, credentials=credentials)

        # Store the request in the database if user info is provided
        if user_id and organization_id:
            try:
                # Use display_name if provided, otherwise fall back to cluster_name
                cluster_name_to_store = display_name if display_name else cluster_name
                skypilot_tracker.store_request(
                    user_id=user_id,
                    organization_id=organization_id,
                    task_type="stop",
                    request_id=request_id,
                    cluster_name=cluster_name_to_store,
                )
                print(f"Stored SkyPilot stop request {request_id} in database")
            except Exception as e:
                print(
                    f"Warning: Failed to store SkyPilot stop request in database: {e}"
                )

        return request_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop cluster: {str(e)}")


def down_cluster_with_skypilot(
    cluster_name: str,
    display_name: Optional[str] = None,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    try:
        # Fetch credentials for the cluster based on the platform
        platform_info = get_cluster_platform_info_util(cluster_name)
        credentials = None
        if platform_info and platform_info.get("platform"):
            platform = platform_info["platform"]
            if platform == "azure":
                try:
                    azure_config_dict = az_get_current_config(
                        organization_id=organization_id, db=db
                    )
                    credentials = {
                        "azure": {
                            "service_principal": {
                                "tenant_id": azure_config_dict["tenant_id"],
                                "client_id": azure_config_dict["client_id"],
                                "client_secret": azure_config_dict["client_secret"],
                                "subscription_id": azure_config_dict["subscription_id"],
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
                        organization_id=organization_id
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

        # First, get all jobs from the cluster before tearing down
        try:
            job_records = get_cluster_job_queue(cluster_name, credentials=credentials)
            # Extract jobs from the job records
            if job_records and hasattr(job_records, "jobs"):
                jobs = job_records.jobs
                if jobs:
                    if display_name:
                        save_cluster_jobs(display_name, jobs, user_id, organization_id)
                    else:
                        save_cluster_jobs(cluster_name, jobs, user_id, organization_id)
            elif isinstance(job_records, list):
                # If it's already a list of jobs
                if display_name:
                    save_cluster_jobs(
                        display_name, job_records, user_id, organization_id
                    )
                else:
                    save_cluster_jobs(
                        cluster_name, job_records, user_id, organization_id
                    )
        except Exception as e:
            print(f"Failed to save jobs for cluster {cluster_name}: {str(e)}")

        request_id = sky.down(cluster_name=cluster_name, credentials=credentials)

        # Store the request in the database if user info is provided
        if user_id and organization_id:
            try:
                # Use display_name if provided, otherwise fall back to cluster_name
                cluster_name_to_store = display_name if display_name else cluster_name
                skypilot_tracker.store_request(
                    user_id=user_id,
                    organization_id=organization_id,
                    task_type="terminate",
                    request_id=request_id,
                    cluster_name=cluster_name_to_store,
                )
                print(f"Stored SkyPilot down request {request_id} in database")
            except Exception as e:
                print(
                    f"Warning: Failed to store SkyPilot down request in database: {e}"
                )

        return request_id
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to terminate cluster: {str(e)}"
        )


def get_skypilot_status(cluster_names=None):
    try:
        request_id = sky.status(
            cluster_names=cluster_names, refresh=sky.StatusRefreshMode.AUTO
        )
        result = sky.get(request_id)
        result_new = result.copy()
        for cluster in result_new:
            # Delete the credentials if they exist
            if "credentials" in cluster:
                cluster["credentials"] = None
            if "last_creation_yaml" in cluster:
                cluster["last_creation_yaml"] = ""
            if "last_update_yaml" in cluster:
                cluster["last_update_yaml"] = ""
            if "handle" in cluster:
                cluster["handle"] = ""
        return result_new
    except Exception as e:
        print(f"ERROR: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )
