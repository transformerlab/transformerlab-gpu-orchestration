from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Form,
    UploadFile,
    File,
    Request,
    Response,
)
from pydantic import BaseModel
import uuid
import os
import json
from pathlib import Path
from config import UPLOADS_DIR
from fastapi.responses import StreamingResponse
from models import (
    LaunchClusterRequest,
    LaunchClusterResponse,
    StatusResponse,
    JobQueueResponse,
    JobLogsResponse,
    StopClusterRequest,
    StopClusterResponse,
    DownClusterRequest,
    DownClusterResponse,
    ClusterStatusResponse,
    JobRecord,
)
from skypilot.utils import (
    launch_cluster_with_skypilot,
    get_skypilot_status,
    get_cluster_job_queue,
    get_job_logs,
    stop_cluster_with_skypilot,
    down_cluster_with_skypilot,
    fetch_and_parse_gpu_resources,
    cancel_job_with_skypilot,
    get_past_jobs,
)
from skypilot.port_forwarding import port_forward_manager
from skypilot.runpod_utils import (
    verify_runpod_setup,
    get_runpod_gpu_types,
    get_runpod_gpu_types_with_pricing,
    get_runpod_display_options,
    get_runpod_display_options_with_pricing,
    map_runpod_display_to_instance_type,
    setup_runpod_config,
    save_runpod_config,
    get_runpod_config_for_display,
    test_runpod_connection,
    load_runpod_config,
    run_sky_check_runpod,
    create_runpod_config_toml,
    set_runpod_default_config,
    delete_runpod_config,
    get_current_runpod_config,
)
from skypilot.azure_utils import (
    verify_azure_setup,
    get_azure_instance_types,
    get_azure_regions,
    setup_azure_config,
    save_azure_config,
    get_azure_config_for_display,
    test_azure_connection,
    load_azure_config,
    run_sky_check_azure,
    set_azure_default_config,
    delete_azure_config,
    get_current_azure_config,
)
from clusters.utils import is_ssh_cluster, is_down_only_cluster
from utils.file_utils import (
    load_ssh_node_pools,
    load_ssh_node_info,
    save_ssh_node_info,
    get_cluster_platform,
    load_cluster_platforms,
    set_cluster_platform,
    get_cluster_user_info,
)
from auth.api_key_auth import get_user_or_api_key
from auth.utils import get_current_user
from reports.utils import record_usage
from typing import Optional
import asyncio


# RunPod configuration models
class RunPodConfigRequest(BaseModel):
    name: str
    api_key: str
    allowed_gpu_types: list[str]  # Keep for backward compatibility
    allowed_display_options: list[str] = None  # New field for display options
    max_instances: int = 0
    config_key: str = None  # Optional config key for updating existing configs


class RunPodTestRequest(BaseModel):
    api_key: str


# Azure configuration models
class AzureConfigRequest(BaseModel):
    name: str
    subscription_id: str
    tenant_id: str
    client_id: str
    client_secret: str
    allowed_instance_types: list[str]
    allowed_regions: list[str]
    max_instances: int = 0
    config_key: str = None  # Optional config key for updating existing configs


class AzureTestRequest(BaseModel):
    subscription_id: str
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    auth_mode: str = "service_principal"  # Only service_principal supported


router = APIRouter(prefix="/skypilot", dependencies=[Depends(get_user_or_api_key)])


@router.get("/node-pools")
async def list_node_pools(request: Request, response: Response):
    """Get all node pools (Azure, RunPod, and SSH clusters)"""
    try:
        node_pools = []

        # Get Azure configs - show each config as a separate entry
        try:
            azure_config_data = load_azure_config()
            if azure_config_data.get("configs"):
                for config_key, config in azure_config_data["configs"].items():
                    node_pools.append(
                        {
                            "name": config.get("name", "Azure Pool"),
                            "platform": "azure",
                            "numberOfNodes": config.get("max_instances", 0),
                            "status": "enabled",
                            "access": ["Admin"],  # Default access
                            "config": {
                                "is_configured": azure_config_data.get(
                                    "is_configured", False
                                ),
                                "max_instances": config.get("max_instances", 0),
                                "config_key": config_key,
                                "is_default": azure_config_data.get("default_config")
                                == config_key,
                            },
                        }
                    )
        except Exception as e:
            print(f"Error loading Azure config: {e}")

        # Get RunPod configs - show each config as a separate entry
        try:
            runpod_config_data = load_runpod_config()
            if runpod_config_data.get("configs"):
                for config_key, config in runpod_config_data["configs"].items():
                    node_pools.append(
                        {
                            "name": config.get("name", "RunPod Pool"),
                            "platform": "runpod",
                            "numberOfNodes": config.get("max_instances", 0),
                            "status": "enabled",
                            "access": ["Admin"],  # Default access
                            "config": {
                                "is_configured": runpod_config_data.get(
                                    "is_configured", False
                                ),
                                "max_instances": config.get("max_instances", 0),
                                "config_key": config_key,
                                "is_default": runpod_config_data.get("default_config")
                                == config_key,
                            },
                        }
                    )
        except Exception as e:
            print(f"Error loading RunPod config: {e}")

        # Get SSH clusters (DB-backed)
        try:
            from clusters.utils import (
                list_cluster_names_from_db,
                get_cluster_config_from_db,
            )

            for cluster_name in list_cluster_names_from_db():
                cfg = get_cluster_config_from_db(cluster_name)
                hosts_count = len(cfg.get("hosts", []))
                node_pools.append(
                    {
                        "name": cluster_name,
                        "platform": "direct",
                        "numberOfNodes": hosts_count,
                        "status": "enabled",
                        "access": ["Admin"],
                        "config": {"is_configured": True, "max_instances": hosts_count},
                    }
                )
        except Exception as e:
            print(f"Error loading SSH clusters: {e}")

        return {"node_pools": node_pools}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list node pools: {str(e)}"
        )


@router.get("/ssh-clusters")
async def list_ssh_clusters(request: Request, response: Response):
    try:
        from clusters.utils import (
            list_cluster_names_from_db,
            get_cluster_config_from_db,
        )

        ssh_clusters = []
        for cluster_name in list_cluster_names_from_db():
            cfg = get_cluster_config_from_db(cluster_name)
            hosts_count = len(cfg.get("hosts", []))
            has_defaults = any(k in cfg for k in ["user", "identity_file", "password"])
            ssh_clusters.append(
                {
                    "name": cluster_name,
                    "hosts_count": hosts_count,
                    "has_defaults": has_defaults,
                }
            )
        return {"ssh_clusters": ssh_clusters}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list SSH clusters: {str(e)}"
        )


@router.get("/fetch-resources/{cluster_name}")
async def fetch_cluster_resources(
    cluster_name: str, request: Request, response: Response
):
    """
    For a given SSH cluster, bring it up, show GPU info, and bring it down again.
    Returns GPU info under 'gpu_resources'.
    Also updates ~/.sky/lattice_data/ssh_node_info.json for all nodes in the cluster.
    """
    try:
        gpu_info = await fetch_and_parse_gpu_resources(cluster_name)
        # Update persistent file for all node IPs in node_gpus
        try:
            node_info = load_ssh_node_info()
            for node in gpu_info.get("node_gpus", []):
                ip = node.get("node")
                if ip:
                    node_info[ip] = {"gpu_resources": gpu_info}
            save_ssh_node_info(node_info)
        except Exception as e:
            print(f"Warning: Failed to update ssh_node_info.json: {e}")
        return {"gpu_resources": gpu_info}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch resources: {str(e)}"
        )


@router.get("/stream-logs/{logfile}")
async def stream_skypilot_logs(logfile: str, request: Request, response: Response):
    async def log_streamer():
        cmd = ["sky", "api", "logs", "-l", logfile]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            while True:
                line = await process.stdout.readline()
                if not line:
                    if process.returncode is not None:
                        break
                    await asyncio.sleep(0.1)
                    continue
                yield line
        finally:
            if process.returncode is None:
                process.terminate()
                await process.wait()

    return StreamingResponse(log_streamer(), media_type="text/plain")


@router.post("/launch", response_model=LaunchClusterResponse)
async def launch_skypilot_cluster(
    request: Request,
    response: Response,
    cluster_name: str = Form(...),
    command: str = Form("echo 'Hello SkyPilot'"),
    setup: Optional[str] = Form(None),
    cloud: Optional[str] = Form(None),
    instance_type: Optional[str] = Form(None),
    cpus: Optional[str] = Form(None),
    memory: Optional[str] = Form(None),
    accelerators: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    zone: Optional[str] = Form(None),
    use_spot: bool = Form(False),
    idle_minutes_to_autostop: Optional[int] = Form(None),
    python_file: Optional[UploadFile] = File(None),
    launch_mode: Optional[str] = Form(None),
    jupyter_port: Optional[int] = Form(None),
    vscode_port: Optional[int] = Form(None),
):
    try:
        file_mounts = None
        workdir = None
        python_filename = None
        disk_size = None
        if python_file is not None and python_file.filename:
            # Save the uploaded file to a persistent uploads directory
            python_filename = python_file.filename
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename
            with open(file_path, "wb") as f:
                f.write(await python_file.read())
            # Mount the file to workspace/<filename> in the cluster
            file_mounts = {f"workspace/{python_filename}": str(file_path)}
        # Setup RunPod if cloud is runpod
        if cloud == "runpod":
            try:
                setup_runpod_config()
                # Map display string to instance type if accelerators is provided
                if accelerators:
                    mapped_instance_type = map_runpod_display_to_instance_type(
                        accelerators
                    )
                    if mapped_instance_type.lower().startswith("cpu"):
                        # Using skypilot logic to have disk size lesser than 10x vCPUs
                        disk_size = 5 * int(mapped_instance_type.split("-")[1])
                    if mapped_instance_type != accelerators:
                        instance_type = mapped_instance_type
                        # Clear accelerators for RunPod since we're using instance_type
                        accelerators = None
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup RunPod: {str(e)}"
                )

        # Setup Azure if cloud is azure
        if cloud == "azure":
            try:
                setup_azure_config()
            except Exception as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to setup Azure: {str(e)}"
                )
        request_id = launch_cluster_with_skypilot(
            cluster_name=cluster_name,
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
            workdir=None,
            launch_mode=launch_mode,
            jupyter_port=jupyter_port,
            vscode_port=vscode_port,
            disk_size=disk_size,
        )
        # Record usage event for cluster launch and store user info
        try:
            user_info = get_current_user(request, response)
            user_id = user_info["id"]
            record_usage(
                user_id=user_id,
                cluster_name=cluster_name,
                usage_type="cluster_launch",
                duration_minutes=None,
            )

            # Store user info with cluster platform
            platform = cloud or "unknown"
            # Store both name and email, use email as unique identifier
            cluster_user_info = {
                "name": user_info.get("first_name", ""),
                "email": user_info.get("email", ""),
                "id": user_info.get("id", ""),
            }
            set_cluster_platform(cluster_name, platform, cluster_user_info)
        except Exception as e:
            print(f"Warning: Failed to record usage event for cluster launch: {e}")
        return LaunchClusterResponse(
            request_id=request_id,
            cluster_name=cluster_name,
            message=f"Cluster '{cluster_name}' launch initiated successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


@router.get("/status", response_model=StatusResponse)
async def get_skypilot_cluster_status(
    request: Request,
    response: Response,
    cluster_names: Optional[str] = None,
):
    try:
        cluster_list = None
        if cluster_names:
            cluster_list = [name.strip() for name in cluster_names.split(",")]
        cluster_records = get_skypilot_status(cluster_list)
        clusters = []
        for record in cluster_records:
            user_info = get_cluster_user_info(record["name"])
            clusters.append(
                ClusterStatusResponse(
                    cluster_name=record["name"],
                    status=str(record["status"]),
                    launched_at=record.get("launched_at"),
                    last_use=record.get("last_use"),
                    autostop=record.get("autostop"),
                    to_down=record.get("to_down"),
                    resources_str=record.get("resources_str_full"),
                    user_info=user_info,
                )
            )
        return StatusResponse(clusters=clusters)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )


@router.get("/request/{request_id}")
async def get_skypilot_request_status(
    request_id: str, request: Request, response: Response
):
    import sky

    try:
        result = sky.get(request_id)
        return {"request_id": request_id, "status": "completed", "result": result}
    except Exception as e:
        return {
            "request_id": request_id,
            "status": "failed",
            "error": str(e),
        }


@router.get("/jobs/{cluster_name}", response_model=JobQueueResponse)
async def get_cluster_jobs(cluster_name: str, request: Request, response: Response):
    try:
        if cluster_name in ["tailscale-final", "newest-cluster", "new-test-clust"]:
            return JobQueueResponse(jobs=[])
        job_records = get_cluster_job_queue(cluster_name)
        jobs = []
        for record in job_records:
            jobs.append(
                JobRecord(
                    job_id=record["job_id"],
                    job_name=record["job_name"],
                    username=record["username"],
                    submitted_at=record["submitted_at"],
                    start_at=record.get("start_at"),
                    end_at=record.get("end_at"),
                    resources=record["resources"],
                    status=str(record["status"]),
                    log_path=record["log_path"],
                )
            )
        return JobQueueResponse(jobs=jobs)
    except Exception:
        return JobQueueResponse(jobs=[])


@router.get("/jobs/{cluster_name}/{job_id}/logs", response_model=JobLogsResponse)
async def get_cluster_job_logs(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
    tail_lines: int = 50,
):
    try:
        logs = get_job_logs(cluster_name, job_id, tail_lines)
        return JobLogsResponse(job_id=job_id, logs=logs)
    except Exception as e:
        print(f"Failed to get job logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


@router.post("/jobs/{cluster_name}/{job_id}/cancel")
async def cancel_cluster_job(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
):
    """Cancel a job on a SkyPilot cluster."""
    try:
        result = cancel_job_with_skypilot(cluster_name, job_id)
        return {
            "request_id": result["request_id"],
            "job_id": job_id,
            "cluster_name": cluster_name,
            "message": result["message"],
            "result": result["result"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")


@router.post("/jobs/{cluster_name}/{job_id}/setup-port-forward")
async def setup_job_port_forward(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
    job_type: str = Form(...),
    jupyter_port: Optional[int] = Form(None),
    vscode_port: Optional[int] = Form(None),
):
    """Setup port forwarding for a specific job (typically called when job starts running)."""
    try:
        from .port_forwarding import setup_port_forwarding_async

        # Setup port forwarding asynchronously
        result = await setup_port_forwarding_async(
            cluster_name, job_type, jupyter_port, vscode_port
        )

        if result:
            return {
                "job_id": job_id,
                "cluster_name": cluster_name,
                "message": f"Port forwarding setup successfully for job {job_id}",
                "port_forward_info": result,
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to setup port forwarding for job {job_id}",
            )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to setup port forwarding: {str(e)}"
        )


@router.post("/stop", response_model=StopClusterResponse)
async def stop_skypilot_cluster(
    request: Request,
    response: Response,
    stop_request: StopClusterRequest,
):
    try:
        cluster_name = stop_request.cluster_name
        if is_down_only_cluster(cluster_name):
            cluster_type = "SSH" if is_ssh_cluster(cluster_name) else "RunPod"
            raise HTTPException(
                status_code=400,
                detail=f"{cluster_type} cluster '{cluster_name}' cannot be stopped. Use down operation instead.",
            )
        request_id = stop_cluster_with_skypilot(cluster_name)
        return StopClusterResponse(
            request_id=request_id,
            cluster_name=cluster_name,
            message=f"Cluster '{cluster_name}' stop initiated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop cluster: {str(e)}")


@router.post("/down", response_model=DownClusterResponse)
async def down_skypilot_cluster(
    request: Request,
    response: Response,
    down_request: DownClusterRequest,
):
    try:
        cluster_name = down_request.cluster_name
        request_id = down_cluster_with_skypilot(cluster_name)
        return DownClusterResponse(
            request_id=request_id,
            cluster_name=cluster_name,
            message=f"Cluster '{cluster_name}' termination initiated successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to terminate cluster: {str(e)}"
        )


@router.get("/cluster-type/{cluster_name}")
async def get_cluster_type(cluster_name: str, request: Request, response: Response):
    try:
        is_ssh = is_ssh_cluster(cluster_name)
        is_down_only = is_down_only_cluster(cluster_name)
        cluster_type = "ssh" if is_ssh else "cloud"
        available_operations = ["down"]
        if not is_down_only:
            available_operations.append("stop")
        return {
            "cluster_name": cluster_name,
            "cluster_type": cluster_type,
            "is_ssh": is_ssh,
            "available_operations": available_operations,
            "recommendations": {
                "stop": "Stops the cluster while preserving disk data (AWS, GCP, Azure clusters only)",
                "down": "Tears down the cluster and deletes all resources (SSH, RunPod, and cloud clusters)",
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster type: {str(e)}"
        )


@router.get("/past-jobs")
async def get_past_jobs_endpoint(request: Request, response: Response):
    """Get all past jobs from saved files."""
    try:
        past_jobs = get_past_jobs()
        return {"past_jobs": past_jobs}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get past jobs: {str(e)}"
        )


@router.get("/past-jobs/{cluster_name}/{job_id}/logs")
async def get_past_job_logs(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
):
    """Get logs for a past job."""
    try:
        from pathlib import Path
        import os

        # Look for the log file in the saved logs directory
        lattice_dir = Path.home() / ".sky" / "lattice"
        logs_dir = lattice_dir / "logs"

        if not logs_dir.exists():
            raise HTTPException(status_code=404, detail="No saved logs found")

        # Find the log file for this job
        log_files = list(logs_dir.glob(f"{cluster_name}_{job_id}_*.log"))
        if not log_files:
            raise HTTPException(
                status_code=404, detail="Log file not found for this job"
            )

        # Use the most recent log file if multiple exist
        log_file = sorted(log_files)[-1]

        with open(log_file, "r") as f:
            logs = f.read()

        return {"logs": logs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get past job logs: {str(e)}"
        )


@router.post("/jobs/{cluster_name}/submit")
async def submit_job_to_cluster(
    request: Request,
    response: Response,
    cluster_name: str,
    command: str = Form(...),
    setup: Optional[str] = Form(None),
    cpus: Optional[str] = Form(None),
    memory: Optional[str] = Form(None),
    accelerators: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    zone: Optional[str] = Form(None),
    job_name: Optional[str] = Form(None),
    python_file: Optional[UploadFile] = File(None),
    job_type: Optional[str] = Form(None),
    jupyter_port: Optional[int] = Form(None),
    vscode_port: Optional[int] = Form(None),
):
    try:
        file_mounts = None
        python_filename = None
        workdir = None
        if python_file is not None and python_file.filename:
            import uuid
            from config import UPLOADS_DIR

            python_filename = python_file.filename
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename
            with open(file_path, "wb") as f:
                f.write(await python_file.read())
            file_mounts = {f"workspace/{python_filename}": str(file_path)}
            workdir = "workspace"
        from .utils import submit_job_to_existing_cluster

        request_id = submit_job_to_existing_cluster(
            cluster_name=cluster_name,
            command=command,
            setup=setup,
            file_mounts=file_mounts,
            workdir=workdir,
            cpus=cpus,
            memory=memory,
            accelerators=accelerators,
            region=region,
            zone=zone,
            job_name=job_name,
            job_type=job_type,
            jupyter_port=jupyter_port,
            vscode_port=vscode_port,
        )

        # Record usage event
        try:
            user_info = get_current_user(request, response)
            user_id = user_info["id"]
            record_usage(
                user_id=user_id,
                cluster_name=cluster_name,
                usage_type="job_launch",
                job_id=request_id,
                duration_minutes=None,  # Will be updated when job completes
            )
        except Exception as e:
            print(f"Warning: Failed to record usage event: {e}")

        return {
            "request_id": request_id,
            "message": f"Job submitted to cluster '{cluster_name}'",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")


@router.post("/interactive/{cluster_name}/launch")
async def launch_interactive_task(
    request: Request,
    response: Response,
    cluster_name: str,
    task_type: str = Form(...),
    jupyter_port: Optional[int] = Form(8888),
    vscode_port: Optional[int] = Form(8888),
):
    """Launch interactive development tasks directly on existing clusters."""
    try:
        import subprocess
        import threading
        import time

        print("Launching interactive task...")

        # Get the command based on task type
        if task_type == "vscode":
            command = f"""# Install code-server if not already installed
curl -fsSL https://code-server.dev/install.sh | bash
# Start code-server
code-server . --port {vscode_port} --host 0.0.0.0 --auth none"""
            remote_port = vscode_port
        else:
            raise HTTPException(
                status_code=400, detail=f"Unsupported task type: {task_type}"
            )

        # Launch the interactive task in background
        def run_interactive_task():
            try:
                # Build SSH command with port forwarding first, then run the command
                ssh_cmd = [
                    "ssh",
                    "-o",
                    "ConnectTimeout=30",
                    "-o",
                    "StrictHostKeyChecking=no",
                ]

                # Add port forwarding for VSCode
                if task_type == "vscode" and remote_port:
                    ssh_cmd.extend(["-L", f"{remote_port}:localhost:{remote_port}"])

                ssh_cmd.extend([cluster_name, command])

                print(f"Running interactive task: {' '.join(ssh_cmd)}")

                # Run the SSH command (this establishes port forwarding and runs the command)
                process = subprocess.Popen(
                    ssh_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
                )

                # For interactive tasks, we don't wait for completion since they keep running
                # Just check if the SSH connection was established successfully
                time.sleep(2)

                if process.poll() is None:
                    # Try to read any available output without waiting for completion
                    try:
                        import select

                        # Check if there's any output available (non-blocking)
                        ready_to_read, _, _ = select.select(
                            [process.stdout, process.stderr], [], [], 0.1
                        )

                        stdout_data = ""
                        stderr_data = ""

                        if process.stdout in ready_to_read:
                            stdout_data = process.stdout.read()
                        if process.stderr in ready_to_read:
                            stderr_data = process.stderr.read()

                        if stdout_data:
                            print(f"Interactive task stdout: {stdout_data}")
                        if stderr_data:
                            print(f"Interactive task stderr: {stderr_data}")
                    except Exception as e:
                        print(f"Could not read output: {e}")

                    print(
                        f"Interactive {task_type} task started successfully on {cluster_name}"
                    )

                    # Record usage event for interactive session
                    try:
                        user_info = get_current_user(request, response)
                        user_id = user_info["id"]
                        record_usage(
                            user_id=user_id,
                            cluster_name=cluster_name,
                            usage_type="interactive_session",
                            duration_minutes=None,  # Interactive sessions don't have fixed duration
                        )
                    except Exception as e:
                        print(f"Warning: Failed to record interactive usage event: {e}")
                else:
                    stdout, stderr = process.communicate()
                    print(f"Interactive task failed: {stderr}")

            except Exception as e:
                print(f"Error running interactive task: {e}")

        # Start the task in a background thread
        print("Starting task in background thread...")
        task_thread = threading.Thread(target=run_interactive_task)
        task_thread.daemon = True
        task_thread.start()
        print("Task started in background thread")

        # Create port forwarding info for response
        port_forward_info = None
        if task_type == "vscode" and remote_port:
            port_forward_info = {
                "local_port": remote_port,
                "remote_port": remote_port,
                "service_type": task_type,
                "access_url": f"http://localhost:{remote_port}",
            }

        return {
            "message": f"Interactive {task_type} task launched on cluster '{cluster_name}'",
            "port_forward_info": port_forward_info,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch interactive task: {str(e)}"
        )


@router.get("/ssh-node-info")
async def get_ssh_node_info(request: Request, response: Response):
    try:
        node_info = load_ssh_node_info()
        return node_info
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load SSH node info: {str(e)}"
        )


# Azure routes
@router.get("/azure/setup")
async def setup_azure(request: Request, response: Response):
    """Setup Azure configuration"""
    try:
        setup_azure_config()
        return {"message": "Azure configuration setup successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup Azure: {str(e)}")


@router.get("/azure/verify")
async def verify_azure(request: Request, response: Response):
    """Verify Azure setup"""
    try:
        is_valid = verify_azure_setup()
        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify Azure setup: {str(e)}"
        )


@router.get("/azure/instance-types")
async def get_azure_instance_types_route(request: Request, response: Response):
    """Get available Azure instance types"""
    try:
        instance_types = get_azure_instance_types()
        return {"instance_types": instance_types}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get Azure instance types: {str(e)}"
        )


@router.get("/azure/regions")
async def get_azure_regions_route(request: Request, response: Response):
    """Get available Azure regions"""
    try:
        regions = get_azure_regions()
        return {"regions": regions}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get Azure regions: {str(e)}"
        )


@router.get("/azure/config")
async def get_azure_config(request: Request, response: Response):
    """Get current Azure configuration"""
    try:
        config = get_azure_config_for_display()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load Azure configuration: {str(e)}"
        )


@router.get("/azure/config/actual")
async def get_azure_config_actual(request: Request, response: Response):
    """Get current Azure configuration with actual credentials (for testing)"""
    try:
        config = load_azure_config()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load Azure configuration: {str(e)}"
        )


@router.get("/azure/credentials")
async def get_azure_credentials(
    request: Request, response: Response, config_key: str = None
):
    """Get Azure configuration with actual credentials (for display)"""
    try:
        config_data = load_azure_config()

        if config_key:
            # Return specific config's actual credentials
            if config_key in config_data.get("configs", {}):
                return config_data["configs"][config_key]
            else:
                raise HTTPException(
                    status_code=404, detail=f"Azure config '{config_key}' not found"
                )
        else:
            # Return current default config's actual credentials
            config = get_current_azure_config()
            if config:
                return config
            else:
                raise HTTPException(
                    status_code=404, detail="No Azure configuration found"
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load Azure credentials: {str(e)}"
        )


@router.post("/azure/config")
async def save_azure_config_route(
    request: Request, response: Response, config_request: AzureConfigRequest
):
    """Save Azure configuration"""
    try:
        print("CONFIG REQUEST", config_request)
        # Save the configuration using utility function
        config = save_azure_config(
            config_request.name,
            config_request.subscription_id,
            config_request.tenant_id,
            config_request.client_id,
            config_request.client_secret,
            config_request.allowed_instance_types,
            config_request.allowed_regions,
            config_request.max_instances,
            config_request.config_key,
        )

        # Set environment variables for current session only if real credentials were provided
        if (
            config_request.subscription_id
            and not config_request.subscription_id.startswith("*")
        ):
            os.environ["AZURE_SUBSCRIPTION_ID"] = config_request.subscription_id
        elif config.get("subscription_id"):
            os.environ["AZURE_SUBSCRIPTION_ID"] = config["subscription_id"]

        if config_request.tenant_id and not config_request.tenant_id.startswith("*"):
            os.environ["AZURE_TENANT_ID"] = config_request.tenant_id
        elif config.get("tenant_id"):
            os.environ["AZURE_TENANT_ID"] = config["tenant_id"]

        if config_request.client_id and not config_request.client_id.startswith("*"):
            os.environ["AZURE_CLIENT_ID"] = config_request.client_id
        elif config.get("client_id"):
            os.environ["AZURE_CLIENT_ID"] = config["client_id"]

        if config_request.client_secret and not config_request.client_secret.startswith(
            "*"
        ):
            os.environ["AZURE_CLIENT_SECRET"] = config_request.client_secret
        elif config.get("client_secret"):
            os.environ["AZURE_CLIENT_SECRET"] = config["client_secret"]

        # Set the new config as default
        config_key = config_request.name.lower().replace(" ", "_").replace("-", "_")
        set_azure_default_config(config_key)

        # Run sky check to validate the setup if credentials are provided
        sky_check_result = None
        if (
            config.get("subscription_id")
            and config.get("tenant_id")
            and config.get("client_id")
            and config.get("client_secret")
        ):
            try:
                # Run sky check to validate the setup
                is_valid, output = run_sky_check_azure()
                sky_check_result = {
                    "valid": is_valid,
                    "output": output,
                    "message": "Sky check azure completed successfully"
                    if is_valid
                    else "Sky check azure failed",
                }
            except Exception as e:
                sky_check_result = {
                    "valid": False,
                    "output": str(e),
                    "message": f"Error during Azure sky check: {str(e)}",
                }

        # Return the saved config with sky check results
        result = get_azure_config_for_display()
        if sky_check_result:
            result["sky_check_result"] = sky_check_result

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save Azure configuration: {str(e)}"
        )


@router.post("/azure/config/{config_key}/set-default")
async def set_azure_default_config_route(
    request: Request, response: Response, config_key: str
):
    """Set a specific Azure config as default"""
    try:
        result = set_azure_default_config(config_key)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to set Azure default config: {str(e)}"
        )


@router.delete("/azure/config/{config_key}")
async def delete_azure_config_route(
    request: Request, response: Response, config_key: str
):
    """Delete an Azure configuration"""
    try:
        result = delete_azure_config(config_key)
        return {"message": f"Azure config '{config_key}' deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete Azure config: {str(e)}"
        )


@router.post("/azure/test")
async def test_azure_connection_route(
    request: Request, response: Response, test_request: AzureTestRequest
):
    """Test Azure API connection"""
    try:
        # Test the connection using utility function
        is_valid = test_azure_connection(
            test_request.subscription_id,
            test_request.tenant_id or "",
            test_request.client_id or "",
            test_request.client_secret or "",
            test_request.auth_mode,
        )
        if is_valid:
            return {"message": "Azure connection test successful"}
        else:
            raise HTTPException(status_code=400, detail="Azure connection test failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to test Azure connection: {str(e)}"
        )


@router.get("/azure/instances")
async def get_azure_instances(request: Request, response: Response):
    """Get current Azure instance count and limits"""
    try:
        # Get current configuration
        config = get_current_azure_config()

        # Count current Azure clusters using platform information
        skyPilotStatus = get_skypilot_status()
        platforms = load_cluster_platforms()

        azure_clusters = [
            cluster
            for cluster in skyPilotStatus
            if platforms.get(cluster.get("name", "")) == "azure"
        ]

        current_count = len(azure_clusters)
        max_instances = config.get("max_instances", 0) if config else 0

        return {
            "current_count": current_count,
            "max_instances": max_instances,
            "can_launch": max_instances == 0 or current_count < max_instances,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get Azure instance count: {str(e)}"
        )


@router.get("/azure/sky-check")
async def run_sky_check_azure_route(request: Request, response: Response):
    """Run 'sky check azure' to validate the Azure setup"""
    try:
        is_valid, output = run_sky_check_azure()
        return {
            "valid": is_valid,
            "output": output,
            "message": "Sky check azure completed successfully"
            if is_valid
            else "Sky check azure failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check azure: {str(e)}"
        )


# RunPod routes
@router.get("/runpod/setup")
async def setup_runpod(request: Request, response: Response):
    """Setup RunPod configuration"""
    try:
        setup_runpod_config()
        # Run sky check to validate the setup
        is_valid, output = run_sky_check_runpod()
        return {
            "message": "RunPod configuration setup successfully",
            "sky_check_valid": is_valid,
            "sky_check_output": output,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup RunPod: {str(e)}")


@router.get("/runpod/verify")
async def verify_runpod(request: Request, response: Response):
    """Verify RunPod setup"""
    try:
        is_valid = verify_runpod_setup()
        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify RunPod setup: {str(e)}"
        )


@router.get("/runpod/gpu-types")
async def get_runpod_gpu_types_route(request: Request, response: Response):
    """Get available GPU types from RunPod with pricing information"""
    try:
        gpu_types_with_pricing = get_runpod_gpu_types_with_pricing()
        # Return both the detailed format and the simple format for backward compatibility
        gpu_types_simple = [gpu["name"] for gpu in gpu_types_with_pricing]
        return {
            "gpu_types": gpu_types_simple,
            "gpu_types_with_pricing": gpu_types_with_pricing,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod GPU types: {str(e)}"
        )


@router.get("/runpod/gpu-types-with-pricing")
async def get_runpod_gpu_types_with_pricing_route(request: Request, response: Response):
    """Get available GPU types from RunPod with detailed pricing information."""
    try:
        gpu_types_with_pricing = get_runpod_gpu_types_with_pricing()
        return {"gpu_types_with_pricing": gpu_types_with_pricing}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get RunPod GPU types with pricing: {str(e)}",
        )


@router.get("/runpod/display-options")
async def get_runpod_display_options_route(request: Request, response: Response):
    """Get available RunPod options with user-friendly display names"""
    try:
        display_options = get_runpod_display_options()
        return {"display_options": display_options}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod display options: {str(e)}"
        )


@router.get("/runpod/display-options-with-pricing")
async def get_runpod_display_options_with_pricing_route(
    request: Request, response: Response
):
    """Get available RunPod options with user-friendly display names and pricing information."""
    try:
        display_options_with_pricing = get_runpod_display_options_with_pricing()
        return {"display_options_with_pricing": display_options_with_pricing}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get RunPod display options with pricing: {str(e)}",
        )


@router.get("/runpod/config")
async def get_runpod_config(request: Request, response: Response):
    """Get current RunPod configuration"""
    try:
        config = get_runpod_config_for_display()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load RunPod configuration: {str(e)}"
        )


@router.post("/runpod/config")
async def save_runpod_config_route(
    request: Request, response: Response, config_request: RunPodConfigRequest
):
    """Save RunPod configuration"""
    try:
        print(
            f"🔍 RunPod config request - allowed_gpu_types: {config_request.allowed_gpu_types}"
        )
        print(
            f"🔍 RunPod config request - allowed_display_options: {config_request.allowed_display_options}"
        )

        # Save the configuration using utility function
        config = save_runpod_config(
            config_request.name,
            config_request.api_key,
            config_request.allowed_gpu_types,
            config_request.max_instances,
            config_request.config_key,
        )

        # If display options are provided, update the config
        if config_request.allowed_display_options:
            config["allowed_display_options"] = config_request.allowed_display_options

        # Set environment variable for current session only if a real API key was provided
        if config_request.api_key and not config_request.api_key.startswith("*"):
            os.environ["RUNPOD_API_KEY"] = config_request.api_key
        elif config.get("api_key"):
            # Use the saved API key from config
            os.environ["RUNPOD_API_KEY"] = config["api_key"]

        # Set the new config as default
        config_key = config_request.name.lower().replace(" ", "_").replace("-", "_")
        set_runpod_default_config(config_key)

        # Create config.toml file and run sky check if API key is provided
        sky_check_result = None
        if config.get("api_key"):
            try:
                # Create the config.toml file
                if create_runpod_config_toml(config["api_key"]):
                    # Run sky check to validate the setup
                    is_valid, output = run_sky_check_runpod()
                    sky_check_result = {
                        "valid": is_valid,
                        "output": output,
                        "message": "Sky check runpod completed successfully"
                        if is_valid
                        else "Sky check runpod failed",
                    }
                else:
                    sky_check_result = {
                        "valid": False,
                        "output": "Failed to create config.toml file",
                        "message": "Failed to create RunPod config.toml file",
                    }
            except Exception as e:
                sky_check_result = {
                    "valid": False,
                    "output": str(e),
                    "message": f"Error during RunPod setup: {str(e)}",
                }

        # Return the saved config with sky check results
        result = get_runpod_config_for_display()
        if sky_check_result:
            result["sky_check_result"] = sky_check_result

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save RunPod configuration: {str(e)}"
        )


@router.post("/runpod/config/{config_key}/set-default")
async def set_runpod_default_config_route(
    request: Request, response: Response, config_key: str
):
    """Set a specific RunPod config as default"""
    try:
        result = set_runpod_default_config(config_key)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to set RunPod default config: {str(e)}"
        )


@router.delete("/runpod/config/{config_key}")
async def delete_runpod_config_route(
    request: Request, response: Response, config_key: str
):
    """Delete a RunPod configuration"""
    try:
        result = delete_runpod_config(config_key)
        return {"message": f"RunPod config '{config_key}' deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete RunPod config: {str(e)}"
        )


@router.post("/runpod/test")
async def test_runpod_connection_route(
    request: Request, response: Response, test_request: RunPodTestRequest
):
    """Test RunPod API connection"""
    try:
        # Test the connection using utility function
        is_valid = test_runpod_connection(test_request.api_key)
        if is_valid:
            return {"message": "RunPod connection test successful"}
        else:
            raise HTTPException(status_code=400, detail="RunPod connection test failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to test RunPod connection: {str(e)}"
        )


@router.get("/runpod/sky-check")
async def run_sky_check_runpod_route(request: Request, response: Response):
    """Run 'sky check runpod' to validate the RunPod setup"""
    try:
        is_valid, output = run_sky_check_runpod()
        return {
            "valid": is_valid,
            "output": output,
            "message": "Sky check runpod completed successfully"
            if is_valid
            else "Sky check runpod failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check runpod: {str(e)}"
        )


@router.get("/runpod/instances")
async def get_runpod_instances(request: Request, response: Response):
    """Get current RunPod instance count and limits"""
    try:
        # Get current configuration
        config = get_current_runpod_config()

        # Count current RunPod clusters using platform information
        skyPilotStatus = get_skypilot_status()
        platforms = load_cluster_platforms()
        runpod_clusters = [
            cluster
            for cluster in skyPilotStatus
            if platforms.get(cluster.get("name", ""))["platform"] == "runpod"
        ]

        current_count = len(runpod_clusters)
        max_instances = config.get("max_instances", 0) if config else 0

        return {
            "current_count": current_count,
            "max_instances": max_instances,
            "can_launch": max_instances == 0 or current_count < max_instances,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod instance count: {str(e)}"
        )


@router.get("/port-forwards")
async def get_active_port_forwards(request: Request, response: Response):
    """Get list of active port forwards."""
    try:
        active_forwards = port_forward_manager.get_active_forwards()
        return {"port_forwards": active_forwards}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get active port forwards: {str(e)}"
        )


@router.post("/port-forwards/{cluster_name}/stop")
async def stop_port_forward(request: Request, response: Response, cluster_name: str):
    """Stop port forwarding for a specific cluster."""
    try:
        success = port_forward_manager.stop_port_forward(cluster_name)
        if success:
            return {"message": f"Port forwarding stopped for cluster {cluster_name}"}
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No active port forward found for cluster {cluster_name}",
            )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to stop port forward: {str(e)}"
        )


@router.get("/cluster-platform/{cluster_name}")
async def get_cluster_platform_info(
    cluster_name: str, request: Request, response: Response
):
    """Get platform information for a specific cluster."""
    try:
        platform_info = get_cluster_platform(cluster_name)
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
