from __future__ import annotations

from typing import Any, Dict, List, Optional
import json
import queue
import threading
import os

from fastapi import HTTPException
from sqlalchemy.orm import Session

from lattice.routes.instances.utils import (
    down_cluster_with_skypilot,
    launch_cluster_with_skypilot_isolated,
    stop_cluster_with_skypilot,
)
from utils.cluster_resolver import handle_cluster_name_param
from utils.cluster_utils import (
    create_cluster_platform_entry,
    get_cluster_state,
    get_cluster_user_info,
    get_display_name_from_actual,
    get_cluster_platform,
    load_cluster_platforms,
    get_cluster_platform_info as get_cluster_platform_info_util,
)
from lattice.routes.node_pools.utils import is_down_only_cluster, is_ssh_cluster
from utils.core import get_skypilot_status, generate_cost_report
from lattice.services.clouds.azure.utils import az_get_current_config


def get_instance_status(*, user_id: str, organization_id: str) -> List[Dict[str, Any]]:
    cluster_records = get_skypilot_status(None)
    clusters: List[Dict[str, Any]] = []
    for record in cluster_records:
        user_info = get_cluster_user_info(record["name"])
        if not user_info or not user_info.get("id"):
            continue
        if not (
            user_info.get("id") == user_id
            and user_info.get("organization_id") == organization_id
        ):
            continue
        display_name = get_display_name_from_actual(record["name"]) or record["name"]
        state = get_cluster_state(record["name"])
        clusters.append(
            {
                "cluster_name": display_name,
                "status": str(record["status"]),
                "state": state,
                "launched_at": record.get("launched_at"),
                "last_use": record.get("last_use"),
                "autostop": record.get("autostop"),
                "to_down": record.get("to_down"),
                "resources_str": record.get("resources_str_full") or record.get("resources_str"),
                "user_info": user_info,
            }
        )
    return clusters


def get_cluster_type(*, user_id: str, organization_id: str, display_name: str) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(display_name, user_id, organization_id)
    is_ssh = is_ssh_cluster(actual_cluster_name)
    return {
        "cluster_name": display_name,
        "cluster_type": "ssh" if is_ssh else "cloud",
        "is_ssh": is_ssh,
    }


def get_platform_info(*, user_id: str, organization_id: str, display_name: str) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(display_name, user_id, organization_id)
    return get_cluster_platform(actual_cluster_name)


def get_all_platforms() -> Dict[str, Any]:
    return {"platforms": load_cluster_platforms()}


def get_cost_report_filtered(*, user_id: str, organization_id: str) -> List[Dict[str, Any]]:
    report = generate_cost_report()
    if not report:
        return []
    filtered: List[Dict[str, Any]] = []
    for cluster_data in report:
        cluster_name = cluster_data.get("name")
        if not cluster_name:
            continue
        platform_info = get_cluster_platform_info_util(cluster_name)
        if not platform_info or not platform_info.get("user_id"):
            continue
        if (
            platform_info.get("user_id") == user_id
            and platform_info.get("organization_id") == organization_id
        ):
            display_name = get_display_name_from_actual(cluster_name) or cluster_name
            item = cluster_data.copy()
            item["name"] = display_name
            item["cloud_provider"] = platform_info.get("platform", "direct")
            filtered.append(item)
    return filtered


def resolve_cluster_name(*, user_id: str, organization_id: str, display_name: str) -> Dict[str, str]:
    actual = handle_cluster_name_param(display_name, user_id, organization_id)
    return {"display_name": display_name, "actual_name": actual}


def get_cluster_info(
    *, user_id: str, organization_id: str, display_name: str
) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(display_name, user_id, organization_id)
    cluster_records = get_skypilot_status([actual_cluster_name])
    cluster_data = None
    for record in cluster_records:
        user_info = get_cluster_user_info(record["name"])
        if not user_info or not user_info.get("id"):
            continue
        if not (
            user_info.get("id") == user_id
            and user_info.get("organization_id") == organization_id
        ):
            continue
        disp = get_display_name_from_actual(record["name"]) or record["name"]
        cluster_data = {
            "cluster": {
                "cluster_name": disp,
                "status": str(record["status"]),
                "launched_at": record.get("launched_at"),
                "last_use": record.get("last_use"),
                "autostop": record.get("autostop"),
                "to_down": record.get("to_down"),
                "resources_str": record.get("resources_str_full") or record.get("resources_str"),
                "user_info": user_info,
            }
        }
        break
    if cluster_data is None:
        raise HTTPException(status_code=404, detail="Cluster not found")

    is_ssh = is_ssh_cluster(actual_cluster_name)
    cluster_type_info = {
        "cluster_name": display_name,
        "cluster_type": "ssh" if is_ssh else "cloud",
        "is_ssh": is_ssh,
    }
    platform_info = get_cluster_platform(actual_cluster_name)
    state = get_cluster_state(actual_cluster_name)

    jobs: List[Dict[str, Any]] = []
    try:
        platform_info_jobs = get_cluster_platform_info_util(actual_cluster_name)
        credentials = None
        if platform_info_jobs and platform_info_jobs.get("platform"):
            platform = platform_info_jobs["platform"]
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
                except Exception:
                    credentials = None
            elif platform == "runpod":
                try:
                    from lattice.services.clouds.runpod.utils import rp_get_current_config

                    rp_config = rp_get_current_config(organization_id=organization_id)
                    if rp_config and rp_config.get("api_key"):
                        credentials = {"runpod": {"api_key": rp_config.get("api_key")}}
                except Exception:
                    credentials = None
        from lattice.routes.jobs.utils import get_cluster_job_queue

        job_records = get_cluster_job_queue(actual_cluster_name, credentials=credentials)
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
    except Exception:
        jobs = []

    ssh_node_info = None
    if is_ssh:
        try:
            from lattice.routes.node_pools.utils import get_cached_gpu_resources

            cached_gpu_resources = get_cached_gpu_resources(actual_cluster_name)
            if cached_gpu_resources:
                ssh_node_info = {actual_cluster_name: {"gpu_resources": cached_gpu_resources}}
        except Exception:
            ssh_node_info = None

    cost_info = None
    try:
        report = generate_cost_report()
        if report:
            for cluster_cost_data in report:
                if cluster_cost_data.get("name") == actual_cluster_name:
                    total_cost = cluster_cost_data.get("total_cost", 0)
                    duration = cluster_cost_data.get("duration", 0)
                    cost_per_hour = 0
                    if duration and duration > 0:
                        cost_per_hour = total_cost / (duration / 3600)
                    cost_info = {
                        "total_cost": total_cost,
                        "duration": duration,
                        "cost_per_hour": cost_per_hour,
                        "launched_at": cluster_cost_data.get("launched_at"),
                        "status": cluster_cost_data.get("status"),
                        "cloud": cluster_cost_data.get("cloud"),
                        "region": cluster_cost_data.get("region"),
                    }
                    break
    except Exception:
        cost_info = None

    return {
        "cluster": cluster_data["cluster"],
        "cluster_type": cluster_type_info,
        "platform": platform_info,
        "state": state,
        "jobs": jobs,
        "ssh_node_info": ssh_node_info,
        "cost_info": cost_info,
    }


def get_user_requests(*, user_id: str, organization_id: str, task_type: Optional[str], limit: int) -> Dict[str, Any]:
    from utils.skypilot_tracker import skypilot_tracker

    requests = skypilot_tracker.get_user_requests(
        user_id=user_id,
        organization_id=organization_id,
        task_type=task_type,
        limit=limit,
    )
    result = []
    for req in requests:
        result.append(
            {
                "id": req.id,
                "user_id": req.user_id,
                "organization_id": req.organization_id,
                "task_type": req.task_type,
                "request_id": req.request_id,
                "cluster_name": req.cluster_name,
                "status": req.status,
                "result": req.result,
                "error_message": req.error_message,
                "created_at": req.created_at.isoformat() if req.created_at else None,
                "completed_at": req.completed_at.isoformat() if req.completed_at else None,
            }
        )
    return {"requests": result}


def get_request_details(*, user_id: str, organization_id: str, request_id: str) -> Dict[str, Any]:
    from utils.skypilot_tracker import skypilot_tracker

    request = skypilot_tracker.get_request_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.user_id != user_id or request.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": request.id,
        "user_id": request.user_id,
        "organization_id": request.organization_id,
        "task_type": request.task_type,
        "request_id": request.request_id,
        "cluster_name": request.cluster_name,
        "status": request.status,
        "result": request.result,
        "error_message": request.error_message,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "completed_at": request.completed_at.isoformat() if request.completed_at else None,
    }


def get_request_status(*, user_id: str, organization_id: str, request_id: str) -> Dict[str, Any]:
    from utils.skypilot_tracker import skypilot_tracker

    request = skypilot_tracker.get_request_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.user_id != user_id or request.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "request_id": request.request_id,
        "status": request.status,
        "task_type": request.task_type,
        "cluster_name": request.cluster_name,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "completed_at": request.completed_at.isoformat() if request.completed_at else None,
    }


def stream_request_logs_generator(*, user_id: str, organization_id: str, request_id: str, tail: Optional[int], follow: bool):
    from utils.skypilot_tracker import skypilot_tracker

    request = skypilot_tracker.get_request_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.user_id != user_id or request.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Access denied")

    log_queue: "queue.Queue[str]" = queue.Queue()
    streaming_complete = threading.Event()

    class LogCaptureStream:
        def __init__(self, q: "queue.Queue[str]"):
            self.q = q

        def write(self, text: str) -> None:
            if text and text.strip():
                self.q.put(text.strip())

        def flush(self) -> None:
            return None

    capture_stream = LogCaptureStream(log_queue)

    def stream_logs():
        try:
            skypilot_tracker.get_request_logs(
                request_id=request_id,
                tail=tail,
                follow=follow,
                output_stream=capture_stream,
            )
            streaming_complete.set()
        except Exception as e:
            log_queue.put(f"ERROR: {str(e)}")
            streaming_complete.set()

    t = threading.Thread(target=stream_logs, daemon=True)
    t.start()

    while not streaming_complete.is_set() or not log_queue.empty():
        try:
            ln = log_queue.get(timeout=0.1)
            yield f"data: {json.dumps({'log_line': str(ln)})}\n\n"
        except queue.Empty:
            continue
    skypilot_tracker.update_request_status(request_id=request_id, status="completed")
    yield f"data: {json.dumps({'status': 'completed'})}\n\n"


def cancel_request(*, user_id: str, organization_id: str, request_id: str) -> Dict[str, str]:
    from utils.skypilot_tracker import skypilot_tracker

    request = skypilot_tracker.get_request_by_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.user_id != user_id or request.organization_id != organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if request.status in ["completed", "failed", "cancelled"]:
        raise HTTPException(status_code=400, detail=f"Request is already {request.status}")
    success = skypilot_tracker.cancel_request(request_id)
    if success:
        return {"message": f"Request {request_id} cancelled successfully"}
    raise HTTPException(status_code=500, detail="Failed to cancel request")


def list_machine_size_templates(
    *, db: Session, organization_id: str, cloud_type: Optional[str] = None, cloud_identifier: Optional[str] = None
) -> List[Dict[str, Any]]:
    from db.db_models import MachineSizeTemplate

    q = db.query(MachineSizeTemplate).filter(
        MachineSizeTemplate.organization_id == organization_id
    )
    if cloud_type:
        q = q.filter(MachineSizeTemplate.cloud_type == cloud_type)
    if cloud_identifier is not None:
        q = q.filter(MachineSizeTemplate.cloud_identifier == cloud_identifier)
    rows = q.order_by(MachineSizeTemplate.updated_at.desc()).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "description": m.description,
            "cloud_type": m.cloud_type,
            "cloud_identifier": m.cloud_identifier,
            "resources_json": m.resources_json or {},
            "organization_id": m.organization_id,
            "created_by": m.created_by,
            "created_at": m.created_at.isoformat() if m.created_at else "",
            "updated_at": m.updated_at.isoformat() if m.updated_at else "",
        }
        for m in rows
    ]


def stop_instance(
    *, db: Session, organization_id: str, user_id: str, display_name: str
) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(display_name, user_id, organization_id)
    if is_down_only_cluster(actual_cluster_name):
        cluster_type = "SSH" if is_ssh_cluster(actual_cluster_name) else "RunPod"
        raise HTTPException(
            status_code=400,
            detail=f"{cluster_type} cluster '{display_name}' cannot be stopped. Use down operation instead.",
        )
    request_id = stop_cluster_with_skypilot(
        actual_cluster_name,
        user_id=user_id,
        organization_id=organization_id,
        display_name=display_name,
        db=db,
    )
    return {
        "request_id": request_id,
        "cluster_name": display_name,
        "message": f"Cluster '{display_name}' stop initiated successfully",
    }


def down_instance(
    *, db: Session, organization_id: str, user_id: str, display_name: str
) -> Dict[str, Any]:
    actual_cluster_name = handle_cluster_name_param(display_name, user_id, organization_id)
    # Update state is done by caller (route) to maintain current behavior
    request_id = down_cluster_with_skypilot(
        actual_cluster_name,
        display_name,
        user_id=user_id,
        organization_id=organization_id,
        db=db,
    )
    return {
        "request_id": request_id,
        "cluster_name": display_name,
        "message": f"Cluster '{display_name}' termination initiated successfully",
    }


def launch_instance(
    *,
    organization_id: str,
    user_id: str,
    cluster_name: str,
    command: Optional[str],
    setup: Optional[str],
    cloud: Optional[str],
    instance_type: Optional[str],
    cpus: Optional[str],
    memory: Optional[str],
    accelerators: Optional[str],
    disk_space: Optional[str],
    region: Optional[str],
    zone: Optional[str],
    use_spot: Optional[bool],
    idle_minutes_to_autostop: Optional[int],
    python_file_path: Optional[str],
    uploaded_dir_path: Optional[str],
    dir_name: Optional[str],
    storage_bucket_ids: Optional[List[str]],
    node_pool_name: Optional[str],
    docker_image_id: Optional[str],
    yaml_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    from werkzeug.utils import secure_filename
    from lattice.routes.reports.utils import record_usage
    from utils.cluster_utils import get_display_name_from_actual

    # Merge YAML with provided params (form overrides YAML)
    cfg = {
        "cluster_name": cluster_name,
        "command": command,
        "setup": setup,
        "cloud": cloud,
        "instance_type": instance_type,
        "cpus": cpus,
        "memory": memory,
        "accelerators": accelerators,
        "disk_space": disk_space,
        "region": region,
        "zone": zone,
        "use_spot": use_spot,
        "idle_minutes_to_autostop": idle_minutes_to_autostop,
        "node_pool_name": node_pool_name,
        "docker_image_id": docker_image_id,
    }
    for k, v in (yaml_config or {}).items():
        if k in cfg and cfg[k] is None:
            cfg[k] = v

    if not cfg["cluster_name"]:
        raise HTTPException(status_code=400, detail="cluster_name is required (either in form parameters or YAML file)")

    # Build file mounts
    file_mounts: Optional[Dict[str, str]] = None
    if python_file_path:
        python_filename = python_file_path.split(os.sep)[-1]
        file_mounts = {f"workspace/{python_filename}": python_file_path}

    if uploaded_dir_path:
        if not os.path.exists(uploaded_dir_path):
            raise HTTPException(status_code=400, detail=f"Uploaded directory '{uploaded_dir_path}' not found. Please upload the files first using /upload endpoint.")
        base_name = os.path.basename(uploaded_dir_path)
        if "_" in base_name:
            base_name = "_".join(base_name.split("_")[1:])
        if dir_name:
            base_name = secure_filename(dir_name) or base_name
        if file_mounts is None:
            file_mounts = {}
        file_mounts[f"~/{base_name}"] = uploaded_dir_path

    # Create cluster platform entry and resolve actual name
    cluster_user_info = {
        "name": "",
        "email": "",
        "id": user_id,
        "organization_id": organization_id,
    }
    actual_cluster_name = create_cluster_platform_entry(
        display_name=cfg["cluster_name"],
        platform=(cfg["cloud"] or "multi-cloud"),
        user_id=user_id,
        organization_id=organization_id,
        user_info=cluster_user_info,
    )

    # Convert disk space
    disk_size: Optional[int] = None
    if cfg["disk_space"]:
        try:
            disk_size = int(cfg["disk_space"])
        except ValueError:
            disk_size = None

    request_id = launch_isolated(
        actual_cluster_name=actual_cluster_name,
        command=(cfg["command"] or "echo 'Hello SkyPilot'"),
        setup=cfg["setup"],
        cloud=cfg["cloud"],
        instance_type=cfg["instance_type"],
        cpus=cfg["cpus"],
        memory=cfg["memory"],
        accelerators=cfg["accelerators"],
        region=cfg["region"],
        zone=cfg["zone"],
        use_spot=bool(cfg["use_spot"] or False),
        idle_minutes_to_autostop=cfg["idle_minutes_to_autostop"],
        file_mounts=file_mounts,
        disk_size=disk_size,
        storage_bucket_ids=storage_bucket_ids,
        node_pool_name=cfg["node_pool_name"],
        docker_image_id=cfg["docker_image_id"],
        user_id=user_id,
        organization_id=organization_id,
        display_name=cfg["cluster_name"],
        credentials=None,
    )

    try:
        record_usage(
            user_id=user_id,
            cluster_name=actual_cluster_name,
            usage_type="cluster_launch",
            duration_minutes=None,
        )
    except Exception:
        pass

    return {
        "request_id": request_id,
        "cluster_name": cfg["cluster_name"],
        "message": f"Cluster '{cfg['cluster_name']}' launch initiated successfully",
    }


def launch_isolated(**params) -> str:
    # The route launches in a separate process using the isolated helper.
    # Keep the same behavior by delegating to the util.
    try:
        return launch_cluster_with_skypilot_isolated(**params)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch cluster: {str(e)}")
