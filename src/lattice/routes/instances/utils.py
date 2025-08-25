from fastapi import HTTPException
import sky
from typing import Optional
from werkzeug.utils import secure_filename

from ..jobs.utils import save_cluster_jobs, get_cluster_job_queue


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
):
    try:
        # Handle RunPod setup
        if cloud and cloud.lower() == "runpod":
            from routes.clouds.runpod.utils import (
                setup_runpod_config,
                verify_runpod_setup,
            )

            try:
                setup_runpod_config()
                if not verify_runpod_setup():
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
            from lattice.routes.clusters.utils import (
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
                files_list = "\n".join(f"  - {file}" for file in missing_files)
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

        parts = secure_filename(cluster_name).split("-")
        prefix = "-".join(parts[:-1]) if len(parts) > 1 else parts[0]
        name = f"lattice-task-setup-{prefix}"

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
        )
        print(f"REQUEST ID: {request_id}")

        # Note: Platform information is now handled by the calling route before launch

        # Setup port forwarding for interactive development modes
        if launch_mode in ["jupyter", "vscode"]:
            import threading
            from ..skypilot.port_forwarding import setup_port_forwarding_async

            def setup_port_forward():
                import asyncio

                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    result = loop.run_until_complete(
                        setup_port_forwarding_async(
                            cluster_name, launch_mode, jupyter_port, vscode_port
                        )
                    )
                    if result:
                        print(f"Port forwarding setup successfully: {result}")
                    else:
                        print(
                            f"Port forwarding setup failed for cluster {cluster_name}"
                        )
                except Exception as e:
                    print(f"Error in port forwarding setup: {e}")
                finally:
                    loop.close()

            # Start port forwarding in background thread
            port_forward_thread = threading.Thread(
                target=setup_port_forward, daemon=True
            )
            port_forward_thread.start()

        return request_id
    except Exception as e:
        print(f"Error launching cluster: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


def stop_cluster_with_skypilot(cluster_name: str):
    try:
        request_id = sky.stop(cluster_name=cluster_name)
        return request_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop cluster: {str(e)}")


def down_cluster_with_skypilot(cluster_name: str, display_name: str = None):
    try:
        # First, get all jobs from the cluster before tearing down
        try:
            job_records = get_cluster_job_queue(cluster_name)
            # Extract jobs from the job records
            if job_records and hasattr(job_records, "jobs"):
                jobs = job_records.jobs
                if jobs:
                    if display_name:
                        save_cluster_jobs(display_name, jobs)
                    else:
                        save_cluster_jobs(cluster_name, jobs)
            elif isinstance(job_records, list):
                # If it's already a list of jobs
                if display_name:
                    save_cluster_jobs(display_name, job_records)
                else:
                    save_cluster_jobs(cluster_name, job_records)
        except Exception as e:
            print(f"Failed to save jobs for cluster {cluster_name}: {str(e)}")

        request_id = sky.down(cluster_name=cluster_name)

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
