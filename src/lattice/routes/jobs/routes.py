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
from typing import Optional
from pathlib import Path
import typing as _typing

try:
    import sky  # type: ignore
except Exception:  # pragma: no cover
    sky = None  # Fallback if SkyPilot is not available at import time


router = APIRouter(prefix="/jobs", dependencies=[Depends(get_user_or_api_key)])


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

        logs = get_job_logs(actual_cluster_name, job_id, tail_lines)
        return JobLogsResponse(job_id=job_id, logs=logs)
    except Exception as e:
        print(f"Failed to get job logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


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
    python_file: Optional[UploadFile] = File(None),
    job_type: Optional[str] = Form(None),
    jupyter_port: Optional[int] = Form(None),
    vscode_port: Optional[int] = Form(None),
    user: dict = Depends(get_user_or_api_key),
):
    try:
        file_mounts = None
        python_filename = None
        workdir = None
        if python_file is not None and python_file.filename:
            python_filename = python_file.filename
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename
            with open(file_path, "wb") as f:
                f.write(await python_file.read())
            file_mounts = {f"/root/{python_filename}": str(file_path)}
            workdir = "/root"

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


@router.post("/managed/launch")
async def launch_managed_job(
    request: Request,
    response: Response,
    command: str = Form(...),
    setup: Optional[str] = Form(None),
    cpus: Optional[str] = Form(None),
    memory: Optional[str] = Form(None),
    accelerators: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    zone: Optional[str] = Form(None),
    job_name: Optional[str] = Form(None),
    pool_name: Optional[str] = Form(None),
    python_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_user_or_api_key),
):
    """Launch a managed job using SkyPilot managed jobs (sky.jobs.launch).

    This does not target an existing cluster; SkyPilot will provision as needed.
    """
    if sky is None:
        raise HTTPException(
            status_code=500, detail="SkyPilot is not installed on the server"
        )

    try:
        file_mounts = None
        python_filename = None

        if python_file is not None and python_file.filename:
            python_filename = python_file.filename
            unique_filename = f"{uuid.uuid4()}_{python_filename}"
            file_path = UPLOADS_DIR / unique_filename
            with open(file_path, "wb") as f:
                f.write(await python_file.read())
            file_mounts = {f"/root/{python_filename}": str(file_path)}

        # Normalize command newlines
        command = command.replace("\r", "")

        secure_job_name = None
        if job_name:
            secure_job_name = secure_filename(job_name)

        # Build SkyPilot task
        task_kwargs: _typing.Dict[str, _typing.Any] = {}
        if setup:
            task_kwargs["setup"] = setup
        task = sky.Task(run=command, **task_kwargs)

        # Optional file mounts / workdir
        if file_mounts:
            task.set_file_mounts(file_mounts)

        # Optional resources
        resources_kwargs: _typing.Dict[str, _typing.Any] = {}
        if accelerators:
            resources_kwargs["accelerators"] = accelerators
        if cpus:
            resources_kwargs["cpus"] = cpus
        if memory:
            resources_kwargs["memory"] = memory
        if region:
            resources_kwargs["region"] = region
        if zone:
            resources_kwargs["zone"] = zone
        if resources_kwargs:
            task.set_resources(sky.Resources(**resources_kwargs))

        # Launch managed job (asynchronous; returns a request ID)
        try:
            if secure_job_name:
                request_id = sky.jobs.launch(
                    task, name=secure_job_name, pool_name=pool_name
                )
            else:
                request_id = sky.jobs.launch(task)
        except TypeError:
            # Fallback if "name" is not supported in this SkyPilot version
            request_id = sky.jobs.launch(task)

        # Record usage
        try:
            user_info = get_current_user(request, response)
            user_id = user_info["id"]
            record_usage(
                user_id=user_id,
                cluster_name=None,
                usage_type="managed_job_launch",
                job_id=request_id,
                duration_minutes=None,
            )
        except Exception as e:
            print(f"Warning: Failed to record usage event: {e}")

        return {
            "request_id": request_id,
            "message": "Managed job submitted",
            "job_name": secure_job_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch managed job: {str(e)}"
        )


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
        logs = get_job_logs(actual_cluster_name, job_id)

        # Parse VSCode tunnel info from logs
        tunnel_info = get_vscode_tunnel_info(logs)

        return tunnel_info

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get VSCode tunnel info: {str(e)}"
        )
