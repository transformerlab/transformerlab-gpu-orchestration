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
from lattice.models import (
    JobQueueResponse,
    JobLogsResponse,
    JobRecord,
)
from lattice.services.jobs import (
    list_past_jobs as svc_list_past_jobs,
    get_past_job_logs as svc_get_past_job_logs,
    get_cluster_jobs as svc_get_cluster_jobs,
    get_cluster_job_logs as svc_get_cluster_job_logs,
    stream_job_logs_generator as svc_stream_job_logs_generator,
    cancel_cluster_job as svc_cancel_cluster_job,
    submit_job as svc_submit_job,
    extract_vscode_info_from_logs as svc_extract_vscode_info,
)
from routes.auth.api_key_auth import get_user_or_api_key, require_scope, enforce_csrf
from typing import Optional
import yaml


router = APIRouter(
    prefix="/jobs",
    dependencies=[Depends(get_user_or_api_key), Depends(enforce_csrf)],
    tags=["jobs"],
)


@router.get("/past-jobs")
async def get_past_jobs_endpoint(
    request: Request, response: Response, user: dict = Depends(get_user_or_api_key)
):
    """Get past jobs from saved files for the current user and organization."""
    try:
        return svc_list_past_jobs(user_id=user["id"], organization_id=user["organization_id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get past jobs: {str(e)}")


@router.get("/past-jobs/{cluster_name}/{job_id}/logs")
async def get_past_job_logs(
    cluster_name: str,
    job_id: int,
    request: Request,
    response: Response,
):
    """Get logs for a past job."""
    try:
        return svc_get_past_job_logs(cluster_name, job_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get past job logs: {str(e)}")


@router.get("/{cluster_name}", response_model=JobQueueResponse)
async def get_cluster_jobs(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    try:
        data = svc_get_cluster_jobs(
            cluster_name, user["id"], user["organization_id"]
        )
        return JobQueueResponse(jobs=[JobRecord(**j) for j in data.get("jobs", [])])
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
        data = svc_get_cluster_job_logs(
            cluster_name, job_id, tail_lines, user["id"], user["organization_id"]
        )
        return JobLogsResponse(job_id=data["job_id"], logs=data["logs"])
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
        return StreamingResponse(
            svc_stream_job_logs_generator(
                cluster_name,
                job_id,
                tail,
                follow,
                user["id"],
                user["organization_id"],
            ),
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
    scope_check: dict = Depends(require_scope("compute:write")),
):
    """Cancel a job on a SkyPilot cluster."""
    try:
        return svc_cancel_cluster_job(
            cluster_name, job_id, user["id"], user["organization_id"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")


@router.post("/{cluster_name}/submit")
async def submit_job_to_cluster(
    request: Request,
    response: Response,
    cluster_name: str,
    command: Optional[str] = Form(None),
    setup: Optional[str] = Form(None),
    cpus: Optional[str] = Form(None),
    memory: Optional[str] = Form(None),
    accelerators: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    zone: Optional[str] = Form(None),
    job_name: Optional[str] = Form(None),
    dir_name: Optional[str] = Form(None),
    uploaded_dir_path: Optional[str] = Form(None),
    yaml_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_user_or_api_key),
    scope_check: dict = Depends(require_scope("compute:write")),
):
    try:
        yaml_config = {}
        if yaml_file:
            if not yaml_file.filename or not yaml_file.filename.lower().endswith((".yaml", ".yml")):
                raise HTTPException(status_code=400, detail="Uploaded file must be a YAML file (.yaml or .yml extension)")
            yaml_content = await yaml_file.read()
            try:
                yaml_config = yaml.safe_load(yaml_content) or {}
            except yaml.YAMLError as e:
                raise HTTPException(status_code=400, detail=f"Invalid YAML format: {str(e)}")
            if not isinstance(yaml_config, dict):
                raise HTTPException(status_code=400, detail="YAML file must contain a valid configuration object")

        return svc_submit_job(
            cluster_name=cluster_name,
            user_id=user["id"],
            organization_id=user["organization_id"],
            command=command,
            setup=setup,
            cpus=cpus,
            memory=memory,
            accelerators=accelerators,
            region=region,
            zone=zone,
            job_name=job_name,
            dir_name=dir_name,
            uploaded_dir_path=uploaded_dir_path,
            yaml_config=yaml_config,
        )
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
        return svc_extract_vscode_info(
            cluster_name, job_id, user["id"], user["organization_id"]
        )
    except Exception as e:
        print(f"Failed to get VSCode tunnel info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get VSCode tunnel info: {str(e)}")
