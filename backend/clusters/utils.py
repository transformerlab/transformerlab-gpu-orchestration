from fastapi import HTTPException
from utils.file_utils import (
    load_ssh_node_pools,
    save_ssh_node_pools,
    load_ssh_node_info,
    save_ssh_node_info,
)
from models import SSHNode
import threading
from skypilot.utils import fetch_and_parse_gpu_resources
from config import SessionLocal
from db_models import SSHNodePool as SSHNodePoolDB, SSHNodeEntry as SSHNodeDB


def create_cluster_in_pools(
    cluster_name: str,
    user: str = None,
    identity_file: str = None,
    password: str = None,
    resources: dict = None,
):
    pools = load_ssh_node_pools()
    if cluster_name in pools:
        raise HTTPException(
            status_code=400, detail=f"Cluster '{cluster_name}' already exists"
        )
    cluster_config = {"hosts": []}
    if user or identity_file or password or resources:
        defaults = {}
        if user:
            defaults["user"] = user
        if identity_file:
            defaults["identity_file"] = identity_file
        if password:
            defaults["password"] = password
        if resources:
            defaults["resources"] = resources
        cluster_config.update(defaults)
    pools[cluster_name] = cluster_config
    save_ssh_node_pools(pools)
    try:
        db = SessionLocal()
        existing = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
        )
        if existing is None:
            db.add(
                SSHNodePoolDB(
                    name=cluster_name,
                    default_user=user,
                    identity_file_path=identity_file,
                    password=password,
                    resources=resources,
                )
            )
        else:
            existing.default_user = user
            existing.identity_file_path = identity_file
            existing.password = password
            existing.resources = resources
        db.commit()
    except Exception as e:
        print(f"Warning: Failed to persist SSH node pool to DB: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass
    return cluster_config


def update_pool_resources(pool: SSHNodePoolDB, db):
    """Update pool resources to reflect the maximum available resources across all nodes"""
    if not pool:
        return

    # Get all nodes in this pool
    nodes = db.query(SSHNodeDB).filter(SSHNodeDB.pool_id == pool.id).all()

    total_vcpus = 0
    total_memory = 0

    # Calculate total resources from all nodes
    for node in nodes:
        if node.resources:
            vcpus = int(node.resources.get("vcpus", "0") or "0")
            memory = int(node.resources.get("memory_gb", "0") or "0")
            total_vcpus += vcpus
            total_memory += memory

    # Start with existing pool resources
    pool_resources = pool.resources or {}

    # Add or update with total values from nodes
    if total_vcpus > 0:
        pool_resources["vcpus"] = str(total_vcpus)
    if total_memory > 0:
        pool_resources["memory_gb"] = str(total_memory)

    pool.resources = pool_resources if pool_resources else None
    db.commit()

    print(f"Updated pool {pool.name} resources: {pool.resources}")


def add_node_to_cluster(cluster_name: str, node: SSHNode, background_tasks=None):
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    node_dict = {"ip": node.ip, "user": node.user}
    if node.identity_file:
        node_dict["identity_file"] = node.identity_file
    if node.password:
        node_dict["password"] = node.password
    if node.resources:
        node_dict["resources"] = node.resources
        print(f"Adding node {node.ip} with resources: {node.resources}")
    if "hosts" not in pools[cluster_name]:
        pools[cluster_name]["hosts"] = []
    for existing_node in pools[cluster_name]["hosts"]:
        if existing_node.get("ip") == node.ip:
            raise HTTPException(
                status_code=400,
                detail=f"Node with IP '{node.ip}' already exists in cluster '{cluster_name}'",
            )
    pools[cluster_name]["hosts"].append(node_dict)
    save_ssh_node_pools(pools)

    try:
        db = SessionLocal()
        pool = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
        )
        if pool is None:
            pool = SSHNodePoolDB(name=cluster_name)
            db.add(pool)
            db.commit()
            db.refresh(pool)
        existing_node = (
            db.query(SSHNodeDB)
            .filter(SSHNodeDB.pool_id == pool.id, SSHNodeDB.ip == node.ip)
            .first()
        )
        if existing_node is None:
            db.add(
                SSHNodeDB(
                    pool_id=pool.id,
                    ip=node.ip,
                    user=node.user,
                    identity_file_path=node.identity_file,
                    password=node.password,
                    resources=node.resources,
                )
            )
            db.commit()

            # Update pool resources to reflect the maximum available resources
            update_pool_resources(pool, db)
    except Exception as e:
        print(f"Warning: Failed to persist SSH node to DB: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass

    def update_gpu_info_thread():
        import asyncio

        try:
            gpu_info = asyncio.run(fetch_and_parse_gpu_resources(cluster_name))
            node_info = load_ssh_node_info()
            node_info[node.ip] = {"gpu_resources": gpu_info}
            save_ssh_node_info(node_info)
        except Exception as e:
            print(f"Warning: Failed to fetch/store GPU info for node {node.ip}: {e}")

    if background_tasks is not None:
        background_tasks.add_task(
            lambda: threading.Thread(target=update_gpu_info_thread).start()
        )
    else:
        threading.Thread(target=update_gpu_info_thread).start()

    return pools[cluster_name]


def is_ssh_cluster(cluster_name: str):
    db = SessionLocal()
    try:
        return (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
            is not None
        )
    finally:
        db.close()


def is_down_only_cluster(cluster_name: str):
    """
    Check if a cluster only supports 'down' operation (not 'stop').
    This includes SSH clusters and RunPod clusters.
    """
    try:
        # Check if it's an SSH cluster (DB-backed)
        if is_ssh_cluster(cluster_name):
            return True

        # Check if it's a RunPod cluster by looking at SkyPilot status
        from skypilot.utils import get_skypilot_status

        cluster_records = get_skypilot_status([cluster_name])
        for record in cluster_records:
            if record.get("name") == cluster_name:
                # Check if it's a RunPod cluster by looking at resources
                resources_str = record.get("resources_str_full", "")
                if "runpod" in resources_str.lower():
                    return True
                break

        return False
    except Exception:
        return False


def delete_cluster_in_pools(cluster_name: str):
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    del pools[cluster_name]
    save_ssh_node_pools(pools)
    try:
        db = SessionLocal()
        pool = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
        )
        if pool is not None:
            db.delete(pool)
            db.commit()
    except Exception as e:
        print(f"Warning: Failed to delete SSH node pool from DB: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass


def remove_node_from_cluster(cluster_name: str, node_ip: str):
    pools = load_ssh_node_pools()
    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )
    hosts = pools[cluster_name].get("hosts", [])
    filtered = [host for host in hosts if host.get("ip") != node_ip]
    if len(filtered) == len(hosts):
        raise HTTPException(
            status_code=404,
            detail=f"Node with IP '{node_ip}' not found in cluster '{cluster_name}'",
        )
    pools[cluster_name]["hosts"] = filtered
    save_ssh_node_pools(pools)
    try:
        db = SessionLocal()
        pool = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
        )
        if pool is not None:
            node_rec = (
                db.query(SSHNodeDB)
                .filter(SSHNodeDB.pool_id == pool.id, SSHNodeDB.ip == node_ip)
                .first()
            )
            if node_rec is not None:
                db.delete(node_rec)
                db.commit()

                # Update pool resources after removing the node
                update_pool_resources(pool, db)
    except Exception as e:
        print(f"Warning: Failed to delete SSH node from DB: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass


def list_cluster_names_from_db() -> list[str]:
    db = SessionLocal()
    try:
        return [row.name for row in db.query(SSHNodePoolDB).all()]
    finally:
        db.close()


def get_cluster_config_from_db(cluster_name: str) -> dict:
    db = SessionLocal()
    try:
        pool = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
        )
        if pool is None:
            raise HTTPException(
                status_code=404, detail=f"Cluster '{cluster_name}' not found"
            )
        nodes = db.query(SSHNodeDB).filter(SSHNodeDB.pool_id == pool.id).all()
        hosts = []
        for n in nodes:
            host = {"ip": n.ip}
            if n.user:
                host["user"] = n.user
            if n.identity_file_path:
                host["identity_file"] = n.identity_file_path
            if n.password:
                host["password"] = n.password
            if n.resources:
                host["resources"] = n.resources
            hosts.append(host)
        cfg: dict = {"hosts": hosts}
        if pool.default_user:
            cfg["user"] = pool.default_user
        if pool.identity_file_path:
            cfg["identity_file"] = pool.identity_file_path
        if pool.password:
            cfg["password"] = pool.password
        if pool.resources:
            cfg["resources"] = pool.resources
        return cfg
    finally:
        db.close()
