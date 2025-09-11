from __future__ import annotations

import json
import os
import queue
import threading
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

from fastapi import HTTPException

from lattice.routes.jobs.utils import (
    cancel_job_with_skypilot,
    get_cluster_job_queue,
    get_job_logs,
    submit_job_to_existing_cluster,
)
from lattice.routes.jobs.vscode_parser import get_vscode_tunnel_info as get_vscode_tunnel_info_mod
from utils.cluster_resolver import handle_cluster_name_param
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_info_util,
)
from lattice.services.clouds.azure.utils import az_get_current_config


def _get_credentials_for_cluster(actual_cluster_name: str, organization_id: str) -> Optional[Dict[str, Any]]:
    """Compute cloud credentials for a cluster based on its platform info."""
    platform_info = get_cluster_platform_info_util(actual_cluster_name)
    credentials = None
    if platform_info and platform_info.get("platform"):
        platform = platform_info["platform"]
        if platform == "azure":
            try:
                azure_config_dict = az_get_current_config(organization_id=organization_id)
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
                from lattice.services.clouds.runpod.utils import rp_get_current_config

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
    return credentials


def list_past_jobs(user_id: str, organization_id: str) -> Dict[str, Any]:
    from lattice.routes.jobs.utils import get_past_jobs as _get_past_jobs

    past_jobs = _get_past_jobs(user_id=user_id, organization_id=organization_id)
    return {"past_jobs": past_jobs}


def get_past_job_logs(cluster_name: str, job_id: int) -> Dict[str, str]:
    lattice_dir = Path.home() / ".sky" / "lattice_data"
    logs_dir = lattice_dir / "logs"

    if not logs_dir.exists():
        raise HTTPException(status_code=404, detail="No saved logs found")

    log_files = list(logs_dir.glob(f"{cluster_name}_{job_id}_*.log"))
    if not log_files:
        raise HTTPException(status_code=404, detail="Log file not found for this job")

    log_file = sorted(log_files)[-1]
    with open(log_file, "r") as f:
        logs = f.read()
    return {"logs": logs}


def get_cluster_jobs(
    cluster_name: str, user_id: str, organization_id: str
) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(
        cluster_name, user_id, organization_id
    )
    credentials = _get_credentials_for_cluster(actual_cluster_name, organization_id)
    job_records = get_cluster_job_queue(actual_cluster_name, credentials=credentials)
    jobs: List[Dict[str, Any]] = []
    for record in job_records:
        jobs.append(
            {
                "job_id": record["job_id"],
                "job_name": record["job_name"],
                "username": record["username"],
                "submitted_at": record["submitted_at"],
                "start_at": record.get("start_at"),
                "end_at": record.get("end_at"),
                "resources": record["resources"],
                "status": str(record["status"]),
                "log_path": record["log_path"],
            }
        )
    return {"jobs": jobs}


def get_cluster_job_logs(
    cluster_name: str, job_id: int, tail_lines: int, user_id: str, organization_id: str
) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(
        cluster_name, user_id, organization_id
    )
    logs = get_job_logs(
        actual_cluster_name, job_id, tail_lines, user_id, organization_id
    )
    return {"job_id": job_id, "logs": logs}


def stream_job_logs_generator(
    cluster_name: str,
    job_id: int,
    tail: Optional[int],
    follow: bool,
    user_id: str,
    organization_id: str,
) -> Generator[str, None, None]:
    actual_cluster_name = handle_cluster_name_param(
        cluster_name, user_id, organization_id
    )
    credentials = _get_credentials_for_cluster(actual_cluster_name, organization_id)

    try:
        import sky

        log_queue: "queue.Queue[str]" = queue.Queue()
        streaming_complete = threading.Event()

        class LogCaptureStream:
            def __init__(self, q: "queue.Queue[str]"):
                self.q = q

            def write(self, text: str) -> None:
                if text and text.strip():
                    self.q.put(text.strip())

            def flush(self) -> None:  # noqa: D401
                return None

        capture_stream = LogCaptureStream(log_queue)

        def stream_logs() -> None:
            try:
                sky.tail_logs(
                    cluster_name=actual_cluster_name,
                    job_id=str(job_id),
                    tail=tail,
                    follow=follow,
                    output_stream=capture_stream,
                    credentials=credentials,
                )
                streaming_complete.set()
            except Exception as e:
                log_queue.put(f"ERROR: {str(e)}")
                streaming_complete.set()

        t = threading.Thread(target=stream_logs, daemon=True)
        t.start()

        while not streaming_complete.is_set() or not log_queue.empty():
            try:
                line = log_queue.get(timeout=0.1)
                yield f"data: {json.dumps({'log_line': str(line)})}\n\n"
            except queue.Empty:
                continue
        yield f"data: {json.dumps({'status': 'completed'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e), 'status': 'failed'})}\n\n"


def cancel_cluster_job(
    cluster_name: str, job_id: int, user_id: str, organization_id: str
) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(
        cluster_name, user_id, organization_id
    )
    result = cancel_job_with_skypilot(actual_cluster_name, job_id)
    return {
        "request_id": result["request_id"],
        "job_id": job_id,
        "cluster_name": cluster_name,
        "message": result["message"],
        "result": result["result"],
    }


def submit_job(
    *,
    cluster_name: str,
    user_id: str,
    organization_id: str,
    # inputs
    command: Optional[str],
    setup: Optional[str],
    cpus: Optional[str],
    memory: Optional[str],
    accelerators: Optional[str],
    region: Optional[str],
    zone: Optional[str],
    job_name: Optional[str],
    dir_name: Optional[str],
    uploaded_dir_path: Optional[str],
    yaml_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    from werkzeug.utils import secure_filename
    from lattice.routes.reports.utils import record_usage

    yaml_data = yaml_config or {}
    final_config: Dict[str, Any] = {
        "command": command,
        "setup": setup,
        "cpus": cpus,
        "memory": memory,
        "accelerators": accelerators,
        "region": region,
        "zone": zone,
        "job_name": job_name,
        "dir_name": dir_name,
    }

    for k, v in yaml_data.items():
        if k in final_config and final_config[k] is None:
            final_config[k] = v

    if not final_config["command"]:
        raise HTTPException(
            status_code=400,
            detail="command is required (either in form parameters or YAML file)",
        )

    command = str(final_config["command"]).replace("\r", "")
    setup = final_config["setup"]
    cpus = final_config["cpus"]
    memory = final_config["memory"]
    accelerators = final_config["accelerators"]
    region = final_config["region"]
    zone = final_config["zone"]
    job_name = final_config["job_name"]
    dir_name = final_config["dir_name"]

    file_mounts = None
    if uploaded_dir_path:
        if not os.path.exists(uploaded_dir_path):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Uploaded directory '{uploaded_dir_path}' not found. Please upload the files first using /upload endpoint."
                ),
            )
        base_name = os.path.basename(uploaded_dir_path)
        if "_" in base_name:
            base_name = "_".join(base_name.split("_")[1:])
        if dir_name:
            base_name = secure_filename(dir_name) or base_name
        file_mounts = {f"~/{base_name}": uploaded_dir_path}

    secure_job_name = None
    if job_name:
        secure_job_name = secure_filename(job_name)

    actual_cluster_name = handle_cluster_name_param(
        cluster_name, user_id, organization_id
    )

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
    )

    try:
        record_usage(
            user_id=user_id,
            cluster_name=cluster_name,
            usage_type="job_launch",
            job_id=request_id,
            duration_minutes=None,
        )
    except Exception as e:
        print(f"Warning: Failed to record usage event: {e}")

    return {"request_id": request_id, "message": f"Job submitted to cluster '{cluster_name}'"}


def extract_vscode_info_from_logs(
    cluster_name: str, job_id: int, user_id: str, organization_id: str
) -> Dict[str, Any]:
    logs = get_job_logs(
        cluster_name, job_id, user_id=user_id, organization_id=organization_id
    )
    # Prefer the routes module implementation for exact behavior
    info = get_vscode_tunnel_info_mod(logs)
    return info
