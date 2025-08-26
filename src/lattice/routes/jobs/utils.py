import os
import json
from pathlib import Path
from fastapi import HTTPException
import sky
from typing import Optional


def get_cluster_job_queue(cluster_name: str):
    try:
        request_id = sky.queue(cluster_name)
        job_records = sky.get(request_id)
        return job_records
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get job queue: {str(e)}"
        )


def get_job_logs(cluster_name: str, job_id: int, tail_lines: int = 50):
    try:
        import os

        log_paths = sky.download_logs(cluster_name, [str(job_id)])
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
    workdir: Optional[str] = None,
    cpus: Optional[str] = None,
    memory: Optional[str] = None,
    accelerators: Optional[str] = None,
    region: Optional[str] = None,
    zone: Optional[str] = None,
    job_name: Optional[str] = None,
    job_type: Optional[str] = None,
    jupyter_port: Optional[int] = None,
    vscode_port: Optional[int] = None,
):
    try:
        # Create job name with metadata if it's a special job type
        final_job_name = job_name if job_name else "lattice-job"
        if job_type and job_type != "custom":
            final_job_name = f"{final_job_name}-{job_type}"
            if job_type == "jupyter" and jupyter_port:
                final_job_name = f"{final_job_name}-port{jupyter_port}"
            elif job_type == "vscode" and vscode_port:
                final_job_name = f"{final_job_name}-port{vscode_port}"

        task = sky.Task(
            name=final_job_name,
            run=command,
            setup=setup,
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

        request_id = sky.launch(
            task, cluster_name=cluster_name, fast=True, no_setup=True
        )

        # Note: Port forwarding for Jupyter jobs is handled separately
        # when the job actually starts running, not at submission time
        # since jobs may be queued and not start immediately

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


def save_cluster_jobs(cluster_name: str, jobs: list):
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
                        logs = get_job_logs(cluster_name, job_id, tail_lines=1000)
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


def get_past_jobs():
    """Retrieve all past jobs from saved files."""
    try:
        jobs_dir = os.path.expanduser("~/.sky/lattice_data/jobs")

        if not os.path.exists(jobs_dir):
            return []

        past_jobs = []
        for filepath in os.listdir(jobs_dir):
            if filepath.endswith(".json"):
                try:
                    with open(os.path.join(jobs_dir, filepath), "r") as f:
                        data = json.load(f)
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
