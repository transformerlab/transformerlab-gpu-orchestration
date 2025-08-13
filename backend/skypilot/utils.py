import os
import json
from pathlib import Path
from fastapi import HTTPException
import sky
from typing import Optional
from werkzeug.utils import secure_filename

import asyncio
from utils.file_utils import set_cluster_platform


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
        result = sky.get(request_id)
    except Exception as e:
        print(f"Error bringing up SSH cluster: {e}")
        raise Exception(f"Failed to bring up SSH cluster: {e}")
    # if code != 0:
    #     raise Exception(f"Failed to bring up SSH cluster: {err or out}")
    # 3. sky show-gpus --infra ssh
    code, out, err = await run_cmd(["sky", "show-gpus", "--infra", "ssh"])
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
):
    try:
        # Handle RunPod setup
        if cloud and cloud.lower() == "runpod":
            from .runpod_utils import setup_runpod_config, verify_runpod_setup

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
            from clusters.utils import is_ssh_cluster

            if not is_ssh_cluster(cluster_name):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"SSH cluster '{cluster_name}' not found. Create it in SSH Clusters first."
                    ),
                )
            try:
                print(
                    f"[SkyPilot] Running: sky.client.sdk.ssh_up(infra={cluster_name})"
                )
                request_id = sky.client.sdk.ssh_up(infra=cluster_name)
                result = sky.get(request_id)
                print(f"[SkyPilot][ssh up result]:\n{result}")
            except Exception as e:
                print(f"[SkyPilot][ssh up error]: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to run sky ssh up for cluster '{cluster_name}': {str(e)}",
                )

        task = sky.Task(
            name=f"lattice-task-{secure_filename(cluster_name)}",
            run=command,
            setup=setup,
        )
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

        if resources_kwargs:
            resources = sky.Resources(**resources_kwargs)
            task.set_resources(resources)

        request_id = sky.launch(
            task,
            cluster_name=cluster_name,
            idle_minutes_to_autostop=idle_minutes_to_autostop,
        )

        # Store platform information for the cluster
        if cloud:
            platform = cloud.lower()
            if platform == "ssh":
                platform = "ssh"
            elif platform == "runpod":
                platform = "runpod"
            elif platform == "azure":
                platform = "azure"
            else:
                platform = "unknown"

            try:
                set_cluster_platform(cluster_name, platform)
                print(
                    f"[SkyPilot] Stored platform '{platform}' for cluster '{cluster_name}'"
                )
            except Exception as e:
                print(
                    f"[SkyPilot] Warning: Failed to store platform for cluster '{cluster_name}': {e}"
                )

        # Setup port forwarding for interactive development modes
        if launch_mode in ["jupyter", "vscode"]:
            import threading
            from .port_forwarding import setup_port_forwarding_async

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
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
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


def stop_cluster_with_skypilot(cluster_name: str):
    try:
        request_id = sky.stop(cluster_name=cluster_name)
        return request_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop cluster: {str(e)}")


def down_cluster_with_skypilot(cluster_name: str):
    try:
        # First, get all jobs from the cluster before tearing down
        try:
            job_records = get_cluster_job_queue(cluster_name)
            # Extract jobs from the job records
            if job_records and hasattr(job_records, "jobs"):
                jobs = job_records.jobs
                if jobs:
                    save_cluster_jobs(cluster_name, jobs)
            elif isinstance(job_records, list):
                # If it's already a list of jobs
                save_cluster_jobs(cluster_name, job_records)
        except Exception as e:
            print(f"Failed to save jobs for cluster {cluster_name}: {str(e)}")

        request_id = sky.down(cluster_name=cluster_name)
        return request_id
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to terminate cluster: {str(e)}"
        )


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
        final_job_name = job_name if job_name else f"lattice-job-{cluster_name}"
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

        request_id = sky.exec(
            task,
            cluster_name=cluster_name,
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
        import sky

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
        lattice_dir = Path.home() / ".sky" / "lattice"
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
        lattice_dir = Path.home() / ".sky" / "lattice"
        jobs_dir = lattice_dir / "jobs"

        if not jobs_dir.exists():
            return []

        past_jobs = []
        for filepath in jobs_dir.glob("*.json"):
            try:
                with open(filepath, "r") as f:
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


def generate_cost_report():
    request_id = sky.client.sdk.cost_report()
    cost_report = sky.get(request_id)
    print(f"[SkyPilot] Cost report: {cost_report}")
    return cost_report
