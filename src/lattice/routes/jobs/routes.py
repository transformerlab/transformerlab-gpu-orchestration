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
from fastapi.responses import StreamingResponse
import uuid
import os
import json
import queue
import threading
from config import UPLOADS_DIR
from werkzeug.utils import secure_filename
from lattice.models import (
    JobQueueResponse,
    JobLogsResponse,
    JobRecord,
)
from .utils import (
    get_cluster_job_queue,
    get_job_logs,
    cancel_job_with_skypilot,
    submit_job_to_existing_cluster,
    get_past_jobs,
)
from routes.jobs.vscode_parser import get_vscode_tunnel_info
from utils.cluster_resolver import (
    handle_cluster_name_param,
)
from routes.auth.api_key_auth import get_user_or_api_key
from routes.auth.utils import get_current_user
from routes.reports.utils import record_usage
from typing import Optional, List
from pathlib import Path


router = APIRouter(
    prefix="/jobs", dependencies=[Depends(get_user_or_api_key)], tags=["jobs"]
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
        # Look for the log file in the saved logs directory
        lattice_dir = Path.home() / ".sky" / "lattice_data"
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


@router.get("/{cluster_name}", response_model=JobQueueResponse)
async def get_cluster_jobs(
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

        job_records = get_cluster_job_queue(actual_cluster_name)
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


@router.get("/{cluster_name}/{job_id}/logs", response_model=JobLogsResponse)
async def get_cluster_job_logs(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
    tail_lines: int = 50,
    user: dict = Depends(get_user_or_api_key),
):
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        logs = get_job_logs(
            actual_cluster_name,
            job_id,
            tail_lines,
            user["id"],
            user["organization_id"],
        )
        return JobLogsResponse(job_id=job_id, logs=logs)
    except Exception as e:
        print(f"Failed to get job logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


@router.get("/{cluster_name}/{job_id}/logs/stream")
async def stream_job_logs(
    cluster_name: str,
    job_id: int,
    tail: Optional[int] = 1000,
    follow: bool = True,
    request: Request = None,
    response: Response = None,
    user: dict = Depends(get_user_or_api_key),
):
    """
    Stream logs for a specific job in real-time using sky.tail_logs
    """
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        def generate_logs():
            try:
                import sky

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
                        # Use sky.tail_logs to stream job logs
                        sky.tail_logs(
                            cluster_name=actual_cluster_name,
                            job_id=str(job_id),
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

                yield f"data: {json.dumps({'status': 'completed'})}\n\n"

            except Exception as e:
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream logs: {str(e)}")


@router.post("/{cluster_name}/{job_id}/cancel")
async def cancel_cluster_job(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Cancel a job on a SkyPilot cluster."""
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        result = cancel_job_with_skypilot(actual_cluster_name, job_id)
        return {
            "request_id": result["request_id"],
            "job_id": job_id,
            "cluster_name": cluster_name,  # Return display name
            "message": result["message"],
            "result": result["result"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")


@router.post("/{cluster_name}/submit")
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
    dir_name: Optional[str] = Form(None),
    dir_files: Optional[List[UploadFile]] = File(None),
    job_type: Optional[str] = Form(None),
    jupyter_port: Optional[int] = Form(None),
    vscode_port: Optional[int] = Form(None),
    user: dict = Depends(get_user_or_api_key),
):
    try:
        file_mounts = None
        workdir = None

        # If a directory was uploaded, reconstruct it under a unique folder
        if dir_files:
            # Sanitize provided dir_name, or derive from files
            base_name = dir_name or "project"
            base_name = os.path.basename(base_name.strip())
            base_name = secure_filename(base_name) or "project"

            unique_dir = UPLOADS_DIR / f"{uuid.uuid4()}_{base_name}"
            unique_dir.mkdir(parents=True, exist_ok=True)

            for up_file in dir_files:
                # Filename includes relative path as sent by frontend
                raw_rel = up_file.filename or ""
                # Normalize path, remove leading separators and traversal
                norm_rel = os.path.normpath(raw_rel).lstrip(os.sep).replace("\\", "/")
                parts = [p for p in norm_rel.split("/") if p not in ("..", "")]
                safe_rel = Path(*[secure_filename(p) for p in parts])
                target_path = unique_dir / safe_rel
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with open(target_path, "wb") as f:
                    f.write(await up_file.read())

            # Mount the entire directory at ~/<base_name>
            file_mounts = {f"~/{base_name}": str(unique_dir)}
            workdir = f"~/{base_name}"

        # For VSCode, we need to remove the carriage return
        command = command.replace("\r", "")

        # Apply secure_filename to job_name if provided
        secure_job_name = None
        if job_name:
            secure_job_name = secure_filename(job_name)

        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        request_id = submit_job_to_existing_cluster(
            cluster_name=actual_cluster_name,
            command=command,
            setup=setup,
            file_mounts=file_mounts,
            workdir=workdir,
            cpus=cpus,
            memory=memory,
            accelerators=accelerators,
            region=region,
            zone=zone,
            job_name=secure_job_name,
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


@router.get("/{cluster_name}/{job_id}/vscode-info")
async def get_vscode_tunnel_info_endpoint(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Get VSCode tunnel information from job logs."""
    try:
        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )
        # Get job logs
        logs = get_job_logs(
            actual_cluster_name,
            job_id,
            user["id"],
            user["organization_id"],
        )

        # Parse VSCode tunnel info from logs
        tunnel_info = get_vscode_tunnel_info(logs)

        return tunnel_info

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get VSCode tunnel info: {str(e)}"
        )
