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
import uuid
from config import UPLOADS_DIR
from models import LaunchClusterRequest
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
)
from skypilot.runpod_utils import (
    verify_runpod_setup,
    get_runpod_gpu_types,
    setup_runpod_config,
)
from clusters.utils import is_ssh_cluster, is_down_only_cluster
from utils.file_utils import load_ssh_node_pools, load_ssh_node_info, save_ssh_node_info
from auth.utils import get_current_user
from typing import Optional
import asyncio

router = APIRouter(prefix="/skypilot", dependencies=[Depends(get_current_user)])


@router.get("/ssh-clusters")
async def list_ssh_clusters(request: Request, response: Response):
    try:
        pools = load_ssh_node_pools()
        ssh_clusters = []
        for cluster_name, config in pools.items():
            hosts_count = len(config.get("hosts", []))
            ssh_clusters.append(
                {
                    "name": cluster_name,
                    "hosts_count": hosts_count,
                    "has_defaults": any(
                        key in config for key in ["user", "identity_file", "password"]
                    ),
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
):
    try:
        file_mounts = None
        workdir = None
        python_filename = None
        if python_file is not None and python_file.filename:
            # Save the uploaded file to a persistent uploads directory
            python_filename = python_file.filename
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename
            with open(file_path, "wb") as f:
                f.write(await python_file.read())
            # Mount the file to workspace/<filename> in the cluster
            file_mounts = {f"workspace/{python_filename}": str(file_path)}
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
        )
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
            clusters.append(
                ClusterStatusResponse(
                    cluster_name=record["name"],
                    status=str(record["status"]),
                    launched_at=record.get("launched_at"),
                    last_use=record.get("last_use"),
                    autostop=record.get("autostop"),
                    to_down=record.get("to_down"),
                    resources_str=record.get("resources_str"),
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
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster jobs: {str(e)}"
        )


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
            message=f"Cluster '{cluster_name}' down initiated successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to down cluster: {str(e)}")


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
        )
        return {
            "request_id": request_id,
            "message": f"Job submitted to cluster '{cluster_name}'",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")


@router.get("/ssh-node-info")
async def get_ssh_node_info(request: Request, response: Response):
    try:
        node_info = load_ssh_node_info()
        return node_info
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load SSH node info: {str(e)}"
        )


@router.get("/runpod/setup")
async def setup_runpod(request: Request, response: Response):
    """Setup RunPod configuration"""
    try:
        setup_runpod_config()
        return {"message": "RunPod configuration setup successfully"}
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
    """Get available GPU types from RunPod"""
    try:
        gpu_types = get_runpod_gpu_types()
        return {"gpu_types": gpu_types}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod GPU types: {str(e)}"
        )
