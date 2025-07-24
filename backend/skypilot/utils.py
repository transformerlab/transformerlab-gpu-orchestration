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
                print(f"[SkyPilot] Running: sky ssh up")
                result = subprocess.run(
                    ["sky", "ssh", "up", "--infra", cluster_name],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                print(f"[SkyPilot][ssh up stdout]:\n{result.stdout}")
                if result.stderr:
                    print(f"[SkyPilot][ssh up stderr]:\n{result.stderr}")
            except subprocess.CalledProcessError as e:
                print(f"[SkyPilot][ssh up failed]: {e.stderr}")
                raise HTTPException(
                    status_code=500,
                    detail=f"sky ssh up failed for cluster '{cluster_name}': {e.stderr or e.stdout or str(e)}",
                )
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
        if workdir:
            task.set_workdir(workdir)
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
        import io

        log_stream = io.StringIO()
        sky.tail_logs(
            cluster_name=cluster_name,
            job_id=job_id,
            follow=False,
            tail=tail_lines,
            output_stream=log_stream,
        )
        logs = log_stream.getvalue()
        log_stream.close()
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
