from fastapi import HTTPException
from concurrent.futures import ThreadPoolExecutor
import threading
from utils.file_utils import (
    load_ssh_node_pools,
    save_ssh_node_pools,
)
from models import SSHNode
import os
from datetime import datetime
from ..instances.utils import fetch_and_parse_gpu_resources
from config import SessionLocal
from db_models import SSHNodePool as SSHNodePoolDB, validate_relationships_before_save, validate_relationships_before_delete


async def update_gpu_resources_for_node_pool(node_pool_name: str):
    """
    Update GPU resources for a specific node pool.
    This should be called when launching or stopping clusters.
    """
    try:
        # Fetch fresh GPU resources
        gpu_resources = await fetch_and_parse_gpu_resources(node_pool_name)

        # Update the database
        db = SessionLocal()
        try:
            pool = (
                db.query(SSHNodePoolDB)
                .filter(SSHNodePoolDB.name == node_pool_name)
                .first()
            )
            if pool:
                current_other_data = pool.other_data or {}
                current_other_data.update(
                    {
                        "gpu_resources": gpu_resources,
                        "last_updated": datetime.utcnow().isoformat(),
                    }
                )
                pool.other_data = current_other_data

                # Explicitly mark the field as modified so SQLAlchemy detects the change
                from sqlalchemy.orm.attributes import flag_modified

                flag_modified(pool, "other_data")

                db.commit()
                print(f"Successfully updated GPU resources for {node_pool_name}")
            else:
                print(f"Node pool not found: {node_pool_name}")
        except Exception as e:
            print(f"Error updating GPU resources for {node_pool_name}: {e}")
            db.rollback()
        finally:
            db.close()
    except Exception as e:
        print(f"Error in update_gpu_resources_for_node_pool for {node_pool_name}: {e}")


_gpu_update_executor = ThreadPoolExecutor(
    max_workers=4, thread_name_prefix="gpu-update"
)
_inflight_updates_lock = threading.Lock()
_inflight_updates: set[str] = set()


def _schedule_gpu_resources_update(node_pool_name: str):
    """Schedule async GPU resources update using a thread pool and avoid duplicates per pool."""
    try:
        import asyncio

        with _inflight_updates_lock:
            if node_pool_name in _inflight_updates:
                return
            _inflight_updates.add(node_pool_name)

        def run_async_update():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(
                    update_gpu_resources_for_node_pool(node_pool_name)
                )
            except Exception as e:
                print(
                    f"Background thread: Failed to update GPU resources for {node_pool_name}: {e}"
                )
            finally:
                try:
                    loop.close()
                except Exception:
                    pass
                finally:
                    with _inflight_updates_lock:
                        _inflight_updates.discard(node_pool_name)

        _gpu_update_executor.submit(run_async_update)
    except Exception as e:
        print(f"Failed to schedule GPU resources update for {node_pool_name}: {e}")


def schedule_gpu_resources_update(node_pool_name: str):
    """Public helper to schedule GPU resources update in background."""
    _schedule_gpu_resources_update(node_pool_name)


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
                return cached_data
            print(f"No cached GPU resources found for {node_pool_name}")
            return {}
        finally:
            db.close()
    except Exception as e:
        print(f"Error getting cached GPU resources for {node_pool_name}: {e}")
        return {}


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
            new_pool = SSHNodePoolDB(
                name=cluster_name,
                user_id=user_id,
                organization_id=organization_id,
                default_user=user,
                identity_file_path=identity_file,
                password=password,
                resources=resources,
            )
            
            # Validate relationships before saving
            validate_relationships_before_save(new_pool, db)
            
            db.add(new_pool)
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

    # Get all nodes from JSON field
    nodes = pool.nodes or []

    total_vcpus = 0
    total_memory = 0

    # Calculate total resources from all nodes
    for node in nodes:
        resources = node.get("resources") if isinstance(node, dict) else None
        if resources:
            vcpus = int(resources.get("vcpus", "0") or "0")
            memory = int(resources.get("memory_gb", "0") or "0")
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


def add_node_to_cluster(cluster_name: str, node: SSHNode):
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
            pool = SSHNodePoolDB(name=cluster_name, nodes=[])
            
            # Validate relationships before saving
            validate_relationships_before_save(pool, db)
            
            db.add(pool)
            db.commit()
            db.refresh(pool)

        # Ensure nodes list exists
        current_nodes = list(pool.nodes or [])
        # Prevent duplicates by IP
        for existing in current_nodes:
            if isinstance(existing, dict) and existing.get("ip") == node.ip:
                # Already exists in DB representation
                break
        else:
            # Append new node dict, using identity_file key for JSON
            new_node = {"ip": node.ip, "user": node.user}
            if node.name:
                new_node["name"] = node.name
            if node.identity_file:
                new_node["identity_file"] = node.identity_file
            if node.password:
                new_node["password"] = node.password
            if node.resources:
                new_node["resources"] = node.resources
            current_nodes.append(new_node)

            # Assign back and flag as modified
            pool.nodes = current_nodes
            from sqlalchemy.orm.attributes import flag_modified

            flag_modified(pool, "nodes")
            db.commit()

            # Update pool resources to reflect the maximum available resources
            update_pool_resources(pool, db)
    except Exception as e:
        print(f"Warning: Failed to persist SSH node to DB (JSON): {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass

    # Trigger a background GPU resources update for this node pool
    _schedule_gpu_resources_update(cluster_name)

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
    yaml_file_found = cluster_name in pools
    
    # Delete from YAML file if it exists there
    if yaml_file_found:
        del pools[cluster_name]
        save_ssh_node_pools(pools)
    else:
        print(f"Warning: Cluster '{cluster_name}' not found in YAML file, but will attempt to delete from database")
    
    # Always try to delete from database
    try:
        db = SessionLocal()
        pool = (
            db.query(SSHNodePoolDB).filter(SSHNodePoolDB.name == cluster_name).first()
        )
        if pool is not None:
            # Validate relationships before deleting
            validate_relationships_before_delete(pool, db)
            
            db.delete(pool)
            db.commit()
            print(f"Successfully deleted cluster '{cluster_name}' from database")
        else:
            # If not found in YAML file and not found in database, raise 404
            if not yaml_file_found:
                raise HTTPException(
                    status_code=404, detail=f"Cluster '{cluster_name}' not found in database or YAML file"
                )
    except HTTPException:
        # Re-raise HTTP exceptions (like 404)
        raise
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
            current_nodes = list(pool.nodes or [])
            new_nodes = [
                n
                for n in current_nodes
                if not (isinstance(n, dict) and n.get("ip") == node_ip)
            ]
            if len(new_nodes) != len(current_nodes):
                pool.nodes = new_nodes
                from sqlalchemy.orm.attributes import flag_modified

                flag_modified(pool, "nodes")
                db.commit()

                # Update pool resources after removing the node
                update_pool_resources(pool, db)
    except Exception as e:
        print(f"Warning: Failed to delete SSH node from DB (JSON): {e}")
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

        # Check each node's identity file from JSON
        for node in pool.nodes or []:
            if not isinstance(node, dict):
                continue
            identity_file_path = node.get("identity_file")
            if identity_file_path and not os.path.exists(identity_file_path):
                missing_files.append(identity_file_path)

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
        hosts = []
        for n in pool.nodes or []:
            if not isinstance(n, dict):
                continue
            host = {"ip": n.get("ip")}
            if n.get("user"):
                host["user"] = n.get("user")
            if n.get("name"):
                host["name"] = n.get("name")
            if n.get("identity_file"):
                host["identity_file"] = n.get("identity_file")
            if n.get("password"):
                host["password"] = n.get("password")
            if n.get("resources"):
                host["resources"] = n.get("resources")
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
