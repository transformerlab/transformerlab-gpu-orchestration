from fastapi import HTTPException
from utils.file_utils import (
    load_ssh_node_pools,
    save_ssh_node_pools,
)
from models import SSHNode
import threading
import os
import asyncio
from datetime import datetime
from ..instances.utils import fetch_and_parse_gpu_resources
from config import SessionLocal
from db_models import SSHNodePool as SSHNodePoolDB, SSHNodeEntry as SSHNodeDB


def create_cluster_in_pools(
    cluster_name: str,
    user: str = None,
    identity_file: str = None,
    password: str = None,
    resources: dict = None,
    user_id: str = None,
    organization_id: str = None,
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
                    user_id=user_id,
                    organization_id=organization_id,
                    default_user=user,
                    identity_file_path=identity_file,
                    password=password,
                    resources=resources,
                )
            )
        else:
            existing.user_id = user_id
            existing.organization_id = organization_id
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

    # Note: GPU resources will be updated synchronously when /node-pools endpoint is called

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
        from routes.instances.utils import get_skypilot_status

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


def list_cluster_names_from_db_by_org(organization_id: str) -> list[str]:
    db = SessionLocal()
    try:
        return [
            row.name
            for row in db.query(SSHNodePoolDB)
            .filter(SSHNodePoolDB.organization_id == organization_id)
            .all()
        ]
    finally:
        db.close()


def validate_node_pool_identity_files(node_pool_name: str) -> list[str]:
    """
    Validate that all identity files for nodes in a node pool still exist.

    Args:
        node_pool_name: Name of the node pool to validate

    Returns:
        List of missing identity file paths (empty if all exist)

    Raises:
        HTTPException: If node pool not found
    """
    missing_files = []
    db = SessionLocal()
    try:
        pool = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == node_pool_name).first()
        )
        if pool is None:
            raise HTTPException(
                status_code=404, detail=f"Node pool '{node_pool_name}' not found"
            )

        # Check pool default identity file
        if pool.identity_file_path and not os.path.exists(pool.identity_file_path):
            missing_files.append(pool.identity_file_path)

        # Check each node's identity file
        nodes = db.query(SSHNodeDB).filter(SSHNodeDB.pool_id == pool.id).all()
        for node in nodes:
            if node.identity_file_path and not os.path.exists(node.identity_file_path):
                missing_files.append(node.identity_file_path)

        return missing_files
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


async def update_node_pool_gpu_resources_background(node_pool_name: str):
    """
    Background task to update GPU resources for a node pool.
    This function runs asynchronously and updates the other_data column.
    """
    try:
        print(
            f"Starting background GPU resource update for node pool: {node_pool_name}"
        )

        # Fetch GPU resources using the existing function
        gpu_resources = await fetch_and_parse_gpu_resources(node_pool_name)
        print(f"Fetched GPU resources: {gpu_resources}")

        # Update the database with the new GPU resources
        db = SessionLocal()
        try:
            pool = (
                db.query(SSHNodePoolDB)
                .filter(SSHNodePoolDB.name == node_pool_name)
                .first()
            )
            if pool:
                print(f"Found pool: {pool.name}, current other_data: {pool.other_data}")
                # Update other_data with GPU resources and timestamp
                current_other_data = pool.other_data or {}
                current_other_data.update(
                    {
                        "gpu_resources": gpu_resources,
                        "last_updated": datetime.utcnow().isoformat(),
                    }
                )
                pool.other_data = current_other_data
                print(f"About to commit new other_data: {pool.other_data}")
                try:
                    db.commit()
                    print(f"Commit successful for {node_pool_name}")
                except Exception as commit_error:
                    print(f"Commit failed for {node_pool_name}: {commit_error}")
                    db.rollback()
                    raise
                print(
                    f"Successfully updated GPU resources for node pool: {node_pool_name}"
                )
            else:
                print(f"Node pool not found: {node_pool_name}")
        except Exception as e:
            print(f"Error updating GPU resources in database for {node_pool_name}: {e}")
            db.rollback()
        finally:
            db.close()

    except Exception as e:
        print(f"Error in background GPU resource update for {node_pool_name}: {e}")


def trigger_gpu_resource_updates_for_user(user_id: str, organization_id: str):
    """
    Trigger background GPU resource updates for all SSH node pools accessible to a user.
    This function starts background tasks for each node pool that belongs to the user's organization.
    """
    try:
        db = SessionLocal()
        try:
            # Get SSH node pools that belong to the user's organization
            pools = (
                db.query(SSHNodePoolDB)
                .filter(SSHNodePoolDB.organization_id == organization_id)
                .all()
            )

            for pool in pools:
                # Start background task for each pool
                # Note: In a real implementation, you'd use a proper task queue like Celery
                # For now, we'll use threading to simulate background execution
                def run_update(pool_name):
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        loop.run_until_complete(
                            update_node_pool_gpu_resources_background(pool_name)
                        )
                    finally:
                        loop.close()

                thread = threading.Thread(target=run_update, args=(pool.name,))
                thread.daemon = True
                thread.start()

        finally:
            db.close()

    except Exception as e:
        print(f"Error triggering GPU resource updates: {e}")


def get_cached_gpu_resources(node_pool_name: str) -> dict:
    """
    Get cached GPU resources for a node pool from the database.
    Returns empty dict if no cached data is available.
    """
    try:
        db = SessionLocal()
        try:
            pool = (
                db.query(SSHNodePoolDB)
                .filter(SSHNodePoolDB.name == node_pool_name)
                .first()
            )
            if pool and pool.other_data and pool.other_data.get("gpu_resources"):
                cached_data = pool.other_data["gpu_resources"]
                print(
                    f"Retrieved cached GPU resources for {node_pool_name}: {cached_data}"
                )
                return cached_data
            print(f"No cached GPU resources found for {node_pool_name}")
            return {}
        finally:
            db.close()
    except Exception as e:
        print(f"Error getting cached GPU resources for {node_pool_name}: {e}")
        return {}
