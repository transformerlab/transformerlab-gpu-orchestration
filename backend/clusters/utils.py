from fastapi import HTTPException
from utils.file_utils import load_ssh_node_pools, save_ssh_node_pools
from models import SSHNode


def create_cluster_in_pools(
    cluster_name: str, user: str = None, identity_file: str = None, password: str = None
):
    pools = load_ssh_node_pools()
    if cluster_name in pools:
        raise HTTPException(
            status_code=400, detail=f"Cluster '{cluster_name}' already exists"
        )
    cluster_config = {"hosts": []}
    if user or identity_file or password:
        defaults = {}
        if user:
            defaults["user"] = user
        if identity_file:
            defaults["identity_file"] = identity_file
        if password:
            defaults["password"] = password
        cluster_config.update(defaults)
    pools[cluster_name] = cluster_config
    save_ssh_node_pools(pools)
    return cluster_config


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
    return pools[cluster_name]


def is_ssh_cluster(cluster_name: str):
    try:
        pools = load_ssh_node_pools()
        return cluster_name in pools
    except Exception:
        return False
