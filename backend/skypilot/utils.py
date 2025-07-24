from fastapi import HTTPException
import sky
from typing import Optional


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
):
    try:
        import subprocess

        if cloud and cloud.lower() == "ssh":
            from utils.file_utils import load_ssh_node_pools

            pools = load_ssh_node_pools()
            if cluster_name not in pools:
                raise HTTPException(
                    status_code=400,
                    detail=f"SSH cluster '{cluster_name}' not found in SSH node pools. "
                    f"Please create the SSH cluster first using the SSH Clusters tab.",
                )
            try:
                print(
                    f"[SkyPilot] Running: sky.client.sdk.ssh_up(infra={cluster_name})"
                )
                request_id = sky.client.sdk.ssh_up(infra=cluster_name)
                result = sky.get(request_id)
                print(f"[SkyPilot][ssh up result]:\n{result}")
            # except subprocess.CalledProcessError as e:
            #     print(f"[SkyPilot][ssh up failed]: {e.stderr}")
            #     raise HTTPException(
            #         status_code=500,
            #         detail=f"sky ssh up failed for cluster '{cluster_name}': {e.stderr or e.stdout or str(e)}",
            #     )
            except Exception as e:
                print(f"[SkyPilot][ssh up error]: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to run sky ssh up for cluster '{cluster_name}': {str(e)}",
                )
        task = sky.Task(
            name=f"lattice-task-{cluster_name}",
            run=command,
            setup=setup,
        )
        if file_mounts:
            task.set_file_mounts(file_mounts)
        # if workdir:
        #     task.set_workdir(workdir)
        resources_kwargs = {}
        if cloud:
            if cloud.lower() == "ssh":
                resources_kwargs["infra"] = "ssh"
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
        if use_spot and cloud and cloud.lower() != "ssh":
            resources_kwargs["use_spot"] = use_spot
        if resources_kwargs:
            resources = sky.Resources(**resources_kwargs)
            task.set_resources(resources)
        request_id = sky.launch(
            task,
            cluster_name=cluster_name,
            idle_minutes_to_autostop=idle_minutes_to_autostop,
        )
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
        request_id = sky.down(cluster_name=cluster_name)
        return request_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to down cluster: {str(e)}")


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
):
    try:
        task = sky.Task(
            name=job_name if job_name else f"lattice-job-{cluster_name}",
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
        return request_id
    except Exception as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")
