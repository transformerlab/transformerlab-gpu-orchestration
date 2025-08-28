from fastapi import HTTPException
import sky
from typing import Optional
from werkzeug.utils import secure_filename
import asyncio
import json
import tempfile
import os
import sys

from ..jobs.utils import save_cluster_jobs, get_cluster_job_queue
from utils.skypilot_tracker import skypilot_tracker


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
    workdir: Optional[str] = None,
    launch_mode: Optional[str] = None,
    jupyter_port: Optional[int] = None,
    vscode_port: Optional[int] = None,
    disk_size: Optional[int] = None,
    storage_bucket_ids: Optional[list] = None,
    node_pool_name: Optional[str] = None,
    docker_image: Optional[str] = None,
    container_registry_id: Optional[str] = None,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    display_name: Optional[str] = None,
    credentials: Optional[dict] = None,
):
    try:
        # Handle RunPod setup
        if cloud and cloud.lower() == "runpod":
            from routes.clouds.runpod.utils import (
                rp_setup_config,
                rp_verify_setup,
            )

            try:
                rp_setup_config()
                if not rp_verify_setup():
                    raise HTTPException(
                        status_code=500,
                        detail="RunPod setup verification failed. Please check your RUNPOD_API_KEY.",
                    )
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup RunPod: {str(e)}"
                )

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
        # Set Docker authentication environment variables if registry is provided
        if docker_image and container_registry_id:
            from config import get_db
            from db_models import ContainerRegistry

            # Get database session
            db = next(get_db())
            try:
                # Fetch container registry
                registry = (
                    db.query(ContainerRegistry)
                    .filter(
                        ContainerRegistry.id == container_registry_id,
                        ContainerRegistry.is_active,
                    )
                    .first()
                )

                if registry:
                    task_envs = {
                        "SKYPILOT_DOCKER_USERNAME": registry.docker_username,
                        "SKYPILOT_DOCKER_PASSWORD": registry.docker_password,
                        "SKYPILOT_DOCKER_SERVER": registry.docker_server,
                    }
                    envs = task_envs.copy()
                else:
                    envs = None
            finally:
                db.close()
        else:
            envs = None

        name = f"lattice-task-setup-{cluster_name}"

        task = sky.Task(
            name=name,
            run=command,
            setup=setup,
            envs=envs,
        )

        # Process storage buckets if provided
        if storage_bucket_ids:
            from config import get_db
            from db_models import StorageBucket

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

        resources_kwargs = {}
        if cloud:
            if cloud.lower() == "ssh":
                resources_kwargs["infra"] = "ssh"
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
        if docker_image:
            resources_kwargs["image_id"] = f"docker:{docker_image}"

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
    workdir: Optional[str] = None,
    launch_mode: Optional[str] = None,
    jupyter_port: Optional[int] = None,
    vscode_port: Optional[int] = None,
    disk_size: Optional[int] = None,
    storage_bucket_ids: Optional[list] = None,
    node_pool_name: Optional[str] = None,
    docker_image: Optional[str] = None,
    container_registry_id: Optional[str] = None,
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
            "workdir": workdir,
            "launch_mode": launch_mode,
            "jupyter_port": jupyter_port,
            "vscode_port": vscode_port,
            "disk_size": disk_size,
            "storage_bucket_ids": storage_bucket_ids,
            "node_pool_name": node_pool_name,
            "docker_image": docker_image,
            "container_registry_id": container_registry_id,
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
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise HTTPException(
                    status_code=500,
                    detail=f"Launch process failed with code {process.returncode}: {error_msg}",
                )

            # Parse the result
            try:
                result_data = json.loads(stdout.decode().strip())
                if result_data.get("success"):
                    return result_data.get("request_id")
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Launch failed: {result_data.get('error', 'Unknown error')}",
                    )
            except json.JSONDecodeError:
                # Fallback to original output if JSON parsing fails
                output = stdout.decode().strip()
                if output:
                    return output
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


def stop_cluster_with_skypilot(
    cluster_name: str,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    display_name: Optional[str] = None,
):
    try:
        request_id = sky.stop(cluster_name=cluster_name)

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
):
    try:
        # First, get all jobs from the cluster before tearing down
        try:
            job_records = get_cluster_job_queue(cluster_name)
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

        request_id = sky.down(cluster_name=cluster_name)

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
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )
