import os
import json
from pathlib import Path
from fastapi import HTTPException
import sky
from typing import Optional
from build.lib.lattice.routes.instances.utils import (
    determine_actual_cloud_from_skypilot_status,
)
from config import SessionLocal
from db.db_models import ClusterPlatform
from utils.cluster_resolver import handle_cluster_name_param
from routes.clouds.azure.utils import az_get_current_config
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_info_util,
)


def get_cluster_job_queue(cluster_name: str, credentials: Optional[dict] = None):
    try:
        request_id = sky.queue(cluster_name, credentials=credentials)
        job_records = sky.get(request_id)
        return job_records
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get job queue: {str(e)}"
        )


def get_job_logs(
    cluster_name: str,
    job_id: int,
    tail_lines: int = 50,
    user_id: str = None,
    organization_id: str = None,
):
    try:
        # If user context is provided, try to resolve display name to actual cluster name
        actual_cluster_name = cluster_name

        if user_id and organization_id:
            try:
                actual_cluster_name = handle_cluster_name_param(
                    cluster_name, user_id, organization_id
                )
            except Exception:
                # If mapping fails, use the original cluster_name (might be actual name already)
                actual_cluster_name = cluster_name

        # Fetch credentials for the cluster based on the platform
        platform_info = get_cluster_platform_info_util(actual_cluster_name)
        credentials = None
        if platform_info and platform_info.get("platform"):
            platform = platform_info["platform"]
            if platform == "multi-cloud":
                from routes.instances.utils import (
                    determine_actual_cloud_from_skypilot_status,
                )

                # Determine the actual cloud used by SkyPilot
                actual_platform = determine_actual_cloud_from_skypilot_status(
                    actual_cluster_name
                )
                platform = actual_platform if actual_platform else platform
            if platform == "azure":
                try:
                    azure_config_dict = az_get_current_config(
                        organization_id=organization_id
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

                    rp_config = rp_get_current_config(organization_id=organization_id)
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

        log_paths = sky.download_logs(
            actual_cluster_name, [str(job_id)], credentials=credentials
        )

        log_path = log_paths.get(str(job_id))
        log_path = os.path.expanduser(log_path)
        if not log_path or (
            not os.path.exists(log_path) and not os.path.isdir(log_path)
        ):
            raise HTTPException(status_code=404, detail="Log file not found")
        # If log_path is a directory, look for run.log inside
        if os.path.isdir(log_path):
            run_log_path = os.path.join(log_path, "run.log")
            if os.path.exists(run_log_path):
                log_path = run_log_path
            else:
                raise HTTPException(
                    status_code=404, detail="run.log not found in log directory"
                )
        with open(log_path, "r") as f:
            lines = f.readlines()
            logs = "".join(lines[-tail_lines:])
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


def submit_job_to_existing_cluster(
    cluster_name: str,
    command: str,
    setup: Optional[str] = None,
    file_mounts: Optional[dict] = None,
    cpus: Optional[str] = None,
    memory: Optional[str] = None,
    accelerators: Optional[str] = None,
    region: Optional[str] = None,
    zone: Optional[str] = None,
    job_name: Optional[str] = None,
    num_nodes: Optional[int] = None,
):
    try:
        # Create job name with metadata if it's a special job type
        final_job_name = job_name if job_name else "lattice-job"

        # Determine number of nodes (default to 1)
        effective_num_nodes = 1
        try:
            if num_nodes is not None:
                effective_num_nodes = int(num_nodes)
                if effective_num_nodes <= 0:
                    effective_num_nodes = 1
        except Exception:
            effective_num_nodes = 1

        task = sky.Task(
            name=final_job_name,
            run=command,
            setup=setup,
            num_nodes=effective_num_nodes,
        )
        if file_mounts:
            task.set_file_mounts(file_mounts)

        resources_kwargs = {}
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
        if resources_kwargs:
            resources = sky.Resources(**resources_kwargs)
            task.set_resources(resources)

        # Only do sky.launch for file_mounts otherwise skypilot wont honour it
        if file_mounts is not None:
            request_id = sky.launch(
                task, cluster_name=cluster_name, fast=True, no_setup=True
            )
        else:
            request_id = sky.exec(task, cluster_name=cluster_name)

        return request_id
    except Exception as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")


def cancel_job_with_skypilot(cluster_name: str, job_id: int):
    """Cancel a job on a SkyPilot cluster using the SkyPilot SDK."""
    try:
        # Use sky.cancel to cancel the job
        # The job_id should be passed as a string to match the expected format
        request_id = sky.cancel(cluster_name=cluster_name, job_ids=[str(job_id)])

        # Wait for the cancel operation to complete
        result = sky.get(request_id)

        return {
            "request_id": request_id,
            "result": result,
            "message": f"Job {job_id} cancellation initiated successfully",
        }
    except Exception as e:
        raise Exception(f"Failed to cancel job {job_id}: {str(e)}")


def save_cluster_jobs(
    cluster_name: str, jobs: list, user_id: str, organization_id: str
):
    """Save jobs from a cluster to a local file before tearing down."""
    try:
        # Create the lattice directory in ~/.sky if it doesn't exist
        lattice_dir = Path.home() / ".sky" / "lattice_data"
        jobs_dir = lattice_dir / "jobs"
        logs_dir = lattice_dir / "logs"
        jobs_dir.mkdir(parents=True, exist_ok=True)
        logs_dir.mkdir(parents=True, exist_ok=True)

        # Save jobs to a JSON file with timestamp
        import datetime

        timestamp = datetime.datetime.now().isoformat()
        filename = f"{cluster_name}_{timestamp}.json"
        filepath = jobs_dir / filename

        # Convert jobs to the same format as shown in frontend
        serializable_jobs = []
        for job in jobs:
            try:
                # Each job is a dictionary
                job_dict = {
                    "job_id": job.get("job_id", None),
                    "job_name": job.get("job_name", ""),
                    "username": job.get("username", ""),
                    "submitted_at": job.get("submitted_at", None),
                    "start_at": job.get("start_at", None),
                    "end_at": job.get("end_at", None),
                    "resources": job.get("resources", ""),
                    "status": job.get("status", ""),
                    "log_path": "",  # Will be updated with actual log file path after downloading
                }

                # Convert status enum to string if needed
                if hasattr(job_dict["status"], "name"):
                    job_dict["status"] = job_dict["status"].name

                serializable_jobs.append(job_dict)
            except Exception as job_error:
                print(f"Failed to serialize job: {str(job_error)}")
                continue

        # Add metadata to the jobs data
        jobs_data = {
            "cluster_name": cluster_name,
            "saved_at": timestamp,
            "jobs": serializable_jobs,
        }

        # Save jobs data first
        with open(filepath, "w") as f:
            json.dump(jobs_data, f, indent=2)

        # Download and save logs for each job using get_job_logs
        for i, job in enumerate(jobs):
            try:
                job_id = job.get("job_id", None)
                if job_id is not None:
                    try:
                        # Use get_job_logs to download logs for this job
                        logs = get_job_logs(
                            cluster_name,
                            job_id,
                            tail_lines=1000,
                            user_id=user_id,
                            organization_id=organization_id,
                        )
                        log_filename = f"{cluster_name}_{job_id}_{timestamp}.log"
                        log_filepath = logs_dir / log_filename
                        with open(log_filepath, "w") as f:
                            f.write(logs)
                        # Add log file path to job data
                        serializable_jobs[i]["log_path"] = str(log_filepath)
                    except Exception as log_error:
                        print(f"Failed to save logs for job {job_id}: {str(log_error)}")
                        serializable_jobs[i]["log_path"] = ""
            except Exception as job_error:
                print(f"Failed to process job for log saving: {str(job_error)}")
                continue

        # Update the jobs data with log file paths
        with open(filepath, "w") as f:
            json.dump(jobs_data, f, indent=2)

        return str(filepath)
    except Exception as e:
        print(f"Failed to save jobs for cluster {cluster_name}: {str(e)}")
        return None


def get_past_jobs(user_id: str = None, organization_id: str = None):
    """Retrieve past jobs from saved files, filtered by user and organization."""
    try:
        jobs_dir = os.path.expanduser("~/.sky/lattice_data/jobs")

        if not os.path.exists(jobs_dir):
            return []

        # Get all cluster names owned by the current user and organization
        if user_id and organization_id:
            db = SessionLocal()
            try:
                user_clusters = (
                    db.query(ClusterPlatform)
                    .filter(
                        ClusterPlatform.user_id == user_id,
                        ClusterPlatform.organization_id == organization_id,
                    )
                    .all()
                )
                allowed_cluster_names = {
                    cluster.display_name for cluster in user_clusters
                }
            finally:
                db.close()
        else:
            # If no user/org provided, return empty list (shouldn't happen in normal flow)
            return []

        past_jobs = []
        for filepath in os.listdir(jobs_dir):
            if filepath.endswith(".json"):
                try:
                    with open(os.path.join(jobs_dir, filepath), "r") as f:
                        data = json.load(f)

                        # Filter jobs by checking if the cluster belongs to the current user/org
                        cluster_name = data.get("cluster_name", "")
                        if cluster_name in allowed_cluster_names:
                            past_jobs.append(data)

                except Exception as e:
                    print(f"Failed to read job file {filepath}: {str(e)}")
                    continue

        # Sort by saved_at timestamp (newest first)
        past_jobs.sort(key=lambda x: x.get("saved_at", ""), reverse=True)
        return past_jobs
    except Exception as e:
        print(f"Failed to get past jobs: {str(e)}")
        return []
