from fastapi import APIRouter, Depends, HTTPException
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
)
from clusters.utils import is_ssh_cluster
from utils.file_utils import load_ssh_node_pools
from auth.utils import verify_auth
from typing import Optional
import asyncio

router = APIRouter(prefix="/skypilot")


@router.get("/ssh-clusters")
async def list_ssh_clusters(user=Depends(verify_auth)):
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


@router.get("/stream-logs/{logfile}")
async def stream_skypilot_logs(logfile: str, user=Depends(verify_auth)):
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
    launch_request: LaunchClusterRequest, user=Depends(verify_auth)
):
    try:
        request_id = launch_cluster_with_skypilot(
            cluster_name=launch_request.cluster_name,
            command=launch_request.command,
            setup=launch_request.setup,
            cloud=launch_request.cloud,
            instance_type=launch_request.instance_type,
            cpus=launch_request.cpus,
            memory=launch_request.memory,
            accelerators=launch_request.accelerators,
            region=launch_request.region,
            zone=launch_request.zone,
            use_spot=launch_request.use_spot,
            idle_minutes_to_autostop=launch_request.idle_minutes_to_autostop,
        )
        return LaunchClusterResponse(
            request_id=request_id,
            cluster_name=launch_request.cluster_name,
            message=f"Cluster '{launch_request.cluster_name}' launch initiated successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


@router.get("/status", response_model=StatusResponse)
async def get_skypilot_cluster_status(
    cluster_names: Optional[str] = None, user=Depends(verify_auth)
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
async def get_skypilot_request_status(request_id: str, user=Depends(verify_auth)):
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
async def get_cluster_jobs(cluster_name: str, user=Depends(verify_auth)):
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
    cluster_name: str, job_id: int, tail_lines: int = 50, user=Depends(verify_auth)
):
    try:
        logs = get_job_logs(cluster_name, job_id, tail_lines)
        return JobLogsResponse(job_id=job_id, logs=logs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


@router.post("/stop", response_model=StopClusterResponse)
async def stop_skypilot_cluster(
    stop_request: StopClusterRequest, user=Depends(verify_auth)
):
    try:
        cluster_name = stop_request.cluster_name
        if is_ssh_cluster(cluster_name):
            raise HTTPException(
                status_code=400,
                detail=f"SSH cluster '{cluster_name}' cannot be stopped. Use down operation instead.",
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
    down_request: DownClusterRequest, user=Depends(verify_auth)
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
async def get_cluster_type(cluster_name: str, user=Depends(verify_auth)):
    try:
        is_ssh = is_ssh_cluster(cluster_name)
        cluster_type = "ssh" if is_ssh else "cloud"
        available_operations = ["down"]
        if not is_ssh:
            available_operations.append("stop")
        return {
            "cluster_name": cluster_name,
            "cluster_type": cluster_type,
            "is_ssh": is_ssh,
            "available_operations": available_operations,
            "recommendations": {
                "stop": "Stops the cluster while preserving disk data (cloud clusters only)",
                "down": "Tears down the cluster and deletes all resources (SSH and cloud clusters)",
            },
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster type: {str(e)}"
        )
