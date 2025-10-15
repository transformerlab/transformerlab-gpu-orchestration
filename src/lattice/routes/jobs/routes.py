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
import os
from fastapi.responses import StreamingResponse
import json
import queue
import threading
from werkzeug.utils import secure_filename
from models import (
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
from routes.clouds.azure.utils import az_get_current_config
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_info_util,
)
from routes.auth.api_key_auth import get_user_or_api_key, require_scope, enforce_csrf
from routes.auth.utils import get_current_user
from routes.reports.utils import record_usage
from typing import Optional
from pathlib import Path
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
        past_jobs = get_past_jobs(
            user_id=user["id"], organization_id=user["organization_id"]
        )
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
                        organization_id=user["organization_id"]
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

                    rp_config = rp_get_current_config(
                        organization_id=user["organization_id"]
                    )
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

        job_records = get_cluster_job_queue(
            actual_cluster_name, credentials=credentials
        )
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

        # Fetch credentials for the cluster based on the platform
        platform_info = get_cluster_platform_info_util(actual_cluster_name)
        credentials = None
        if platform_info and platform_info.get("platform"):
            platform = platform_info["platform"]
            if platform == "azure":
                try:
                    azure_config_dict = az_get_current_config(
                        organization_id=user["organization_id"]
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

                    rp_config = rp_get_current_config(
                        organization_id=user["organization_id"]
                    )
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
                            credentials=credentials,
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
    scope_check: dict = Depends(require_scope("compute:write")),
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
    num_nodes: Optional[int] = Form(None),
    yaml_file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_user_or_api_key),
    scope_check: dict = Depends(require_scope("compute:write")),
):
    try:
        # Parse YAML configuration if provided
        yaml_config = {}
        if yaml_file:
            # Validate file type
            if not yaml_file.filename or not yaml_file.filename.lower().endswith(
                (".yaml", ".yml")
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded file must be a YAML file (.yaml or .yml extension)",
                )

            # Read and parse YAML content
            yaml_content = await yaml_file.read()
            try:
                yaml_config = yaml.safe_load(yaml_content) or {}
            except yaml.YAMLError as e:
                raise HTTPException(
                    status_code=400, detail=f"Invalid YAML format: {str(e)}"
                )

            # Validate YAML structure
            if not isinstance(yaml_config, dict):
                raise HTTPException(
                    status_code=400,
                    detail="YAML file must contain a valid configuration object",
                )

        # Merge YAML config with form parameters (form parameters take precedence)
        final_config = {
            "command": command,
            "setup": setup,
            "cpus": cpus,
            "memory": memory,
            "accelerators": accelerators,
            "region": region,
            "zone": zone,
            "job_name": job_name,
            "dir_name": dir_name,
            "num_nodes": num_nodes,
        }

        # Override with YAML values where form parameters are None (excluding resource fields)
        for key, value in yaml_config.items():
            if key in final_config and final_config[key] is None:
                final_config[key] = value

        # Handle nested resources structure in YAML (only supported format)
        if "resources" in yaml_config and isinstance(yaml_config["resources"], dict):
            resources = yaml_config["resources"]
            if "cpus" in resources and final_config["cpus"] is None:
                final_config["cpus"] = resources["cpus"]
            if "accelerators" in resources and final_config["accelerators"] is None:
                final_config["accelerators"] = resources["accelerators"]

        # Validate required fields
        if not final_config["command"]:
            raise HTTPException(
                status_code=400,
                detail="command is required (either in form parameters or YAML file)",
            )

        # Extract final values
        command = final_config["command"]
        setup = final_config["setup"]
        cpus = final_config["cpus"]
        memory = final_config["memory"]
        accelerators = final_config["accelerators"]
        region = final_config["region"]
        zone = final_config["zone"]
        job_name = final_config["job_name"]
        dir_name = final_config["dir_name"]
        num_nodes = final_config["num_nodes"]

        file_mounts = None

        # Handle uploaded directory path from upload route
        if uploaded_dir_path:
            # Validate the uploaded directory exists
            if not os.path.exists(uploaded_dir_path):
                raise HTTPException(
                    status_code=400,
                    detail=f"Uploaded directory '{uploaded_dir_path}' not found. Please upload the files first using /upload endpoint.",
                )

            # Extract base name from the uploaded directory path
            base_name = os.path.basename(uploaded_dir_path)
            if "_" in base_name:
                # Remove UUID prefix if present
                base_name = "_".join(base_name.split("_")[1:])

            # Use provided dir_name if available, otherwise use extracted base_name
            if dir_name:
                base_name = secure_filename(dir_name) or base_name

            # Mount the entire directory at ~/<base_name>
            file_mounts = {f"~/{base_name}": uploaded_dir_path}

        command = command.replace("\r", "")
        setup = setup.replace("\r", "")

        # Apply secure_filename to job_name if provided
        secure_job_name = None
        if job_name:
            secure_job_name = secure_filename(job_name)

        # Resolve display name to actual cluster name
        actual_cluster_name = handle_cluster_name_param(
            cluster_name, user["id"], user["organization_id"]
        )

        # Default num_nodes to 1 if not provided or invalid
        try:
            if num_nodes is None:
                effective_num_nodes = 1
            else:
                effective_num_nodes = int(num_nodes)
                if effective_num_nodes <= 0:
                    effective_num_nodes = 1
        except Exception:
            effective_num_nodes = 1

        request_id = submit_job_to_existing_cluster(
            cluster_name=actual_cluster_name,
            command=command,
            setup=setup,
            file_mounts=file_mounts,
            cpus=cpus,
            memory=memory,
            accelerators=accelerators,
            region=region,
            zone=zone,
            job_name=secure_job_name,
            num_nodes=effective_num_nodes,
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
        # Get job logs
        logs = get_job_logs(
            cluster_name,
            job_id,
            user_id=user["id"],
            organization_id=user["organization_id"],
        )

        # Parse VSCode tunnel info from logs
        tunnel_info = get_vscode_tunnel_info(logs)

        return tunnel_info

    except Exception as e:
        print(f"Failed to get VSCode tunnel info: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get VSCode tunnel info: {str(e)}"
        )
