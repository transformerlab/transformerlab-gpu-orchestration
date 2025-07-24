import os
import yaml
from pathlib import Path
from fastapi import HTTPException
import uuid


def get_ssh_node_pools_path():
    sky_dir = Path.home() / ".sky"
    sky_dir.mkdir(exist_ok=True)
    return sky_dir / "ssh_node_pools.yaml"


def get_identity_files_dir():
    sky_dir = Path.home() / ".sky"
    identity_dir = sky_dir / "identity_files"
    identity_dir.mkdir(exist_ok=True, mode=0o700)
    return identity_dir


def is_valid_identity_file(filename: str) -> bool:
    allowed_exts = {".pem", ".key", ".rsa", ".pub", ""}
    ext = Path(filename).suffix
    # Allow files with no extension (e.g., id_rsa, id_ecdsa, id_ed25519)
    if ext in allowed_exts:
        return True
    # Also allow common SSH private key names with no extension
    basename = Path(filename).name
    if basename in {"id_rsa", "id_ecdsa", "id_ed25519"} or basename.startswith("id_"):
        return True
    return False


def save_identity_file(file_content: bytes, original_filename: str) -> str:
    try:
        if not is_valid_identity_file(original_filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid identity file type. Allowed: .pem, .key, .rsa, .pub, or files with no extension (e.g., id_rsa)",
            )
        identity_dir = get_identity_files_dir()
        file_extension = Path(original_filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = identity_dir / unique_filename
        with open(file_path, "wb") as f:
            f.write(file_content)
        os.chmod(file_path, 0o600)
        return str(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save identity file: {str(e)}"
        )


def cleanup_identity_file(file_path: str):
    try:
        if file_path and os.path.exists(file_path):
            identity_dir = get_identity_files_dir()
            if Path(file_path).parent == identity_dir:
                os.remove(file_path)
    except Exception as e:
        print(f"Warning: Failed to cleanup identity file {file_path}: {e}")


def load_ssh_node_pools():
    pools_file = get_ssh_node_pools_path()
    if not pools_file.exists():
        return {}
    try:
        with open(pools_file, "r") as f:
            content = f.read()
            pools = yaml.safe_load(content) or {}
            return pools
    except Exception as e:
        print(f"Error loading SSH node pools: {e}")
        return {}


def save_ssh_node_pools(pools_data):
    pools_file = get_ssh_node_pools_path()
    try:
        with open(pools_file, "w") as f:
            yaml.dump(pools_data, f, default_flow_style=False, indent=2)
    except Exception as e:
        print(f"Error saving SSH node pools: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to save cluster configuration: {str(e)}"
        )
