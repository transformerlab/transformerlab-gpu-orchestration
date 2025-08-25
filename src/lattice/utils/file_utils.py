import os
import yaml
from pathlib import Path
from fastapi import HTTPException
import uuid
import json


def get_ssh_node_pools_path():
    sky_dir = Path.home() / ".sky"
    sky_dir.mkdir(exist_ok=True)
    return sky_dir / "ssh_node_pools.yaml"


def get_identity_files_dir():
    sky_dir = Path.home() / ".sky"
    identity_dir = sky_dir / "identity_files"
    identity_dir.mkdir(exist_ok=True, mode=0o700)
    return identity_dir


def get_identity_files_metadata_path():
    sky_dir = Path.home() / ".sky"
    return sky_dir / "identity_files_metadata.json"


def load_identity_files_metadata():
    metadata_path = get_identity_files_metadata_path()
    if not metadata_path.exists():
        return {}
    try:
        with open(metadata_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading identity files metadata: {e}")
        return {}


def save_identity_files_metadata(metadata):
    metadata_path = get_identity_files_metadata_path()
    try:
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
    except Exception as e:
        print(f"Error saving identity files metadata: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to save identity files metadata: {str(e)}"
        )


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


def save_named_identity_file(
    file_content: bytes, original_filename: str, display_name: str
) -> str:
    try:
        if not is_valid_identity_file(original_filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid identity file type. Allowed: .pem, .key, .rsa, .pub, or files with no extension (e.g., id_rsa)",
            )

        identity_dir = get_identity_files_dir()
        file_extension = Path(original_filename).suffix

        # Create a safe filename from the display name
        safe_name = "".join(
            c for c in display_name if c.isalnum() or c in (" ", "-", "_")
        ).rstrip()
        safe_name = safe_name.replace(" ", "_")

        # Add unique suffix to avoid conflicts
        unique_filename = f"{safe_name}_{uuid.uuid4().hex[:4]}{file_extension}"
        file_path = identity_dir / unique_filename

        with open(file_path, "wb") as f:
            f.write(file_content)
        os.chmod(file_path, 0o600)

        # Save metadata
        metadata = load_identity_files_metadata()
        metadata[str(file_path)] = {
            "display_name": display_name,
            "original_filename": original_filename,
            "created_at": os.path.getctime(file_path),
            "size": len(file_content),
        }
        save_identity_files_metadata(metadata)

        return str(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save identity file: {str(e)}"
        )


def get_available_identity_files():
    """Get list of available named identity files"""
    try:
        identity_dir = get_identity_files_dir()
        metadata = load_identity_files_metadata()
        files = []

        for file_path in identity_dir.iterdir():
            if file_path.is_file():
                file_info = metadata.get(str(file_path), {})
                stat_info = file_path.stat()
                files.append(
                    {
                        "path": str(file_path),
                        "display_name": file_info.get("display_name", file_path.name),
                        "original_filename": file_info.get(
                            "original_filename", file_path.name
                        ),
                        "size": stat_info.st_size,
                        "permissions": oct(stat_info.st_mode)[-3:],
                        "created": stat_info.st_ctime,
                    }
                )

        # Sort by display name
        files.sort(key=lambda x: x["display_name"].lower())
        return files
    except Exception as e:
        print(f"Error getting available identity files: {e}")
        return []


def delete_named_identity_file(file_path: str):
    """Delete a named identity file and its metadata"""
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Identity file not found")

        # Check if file is in the identity files directory
        identity_dir = get_identity_files_dir()
        if not Path(file_path).parent.samefile(identity_dir):
            raise HTTPException(status_code=400, detail="Invalid file path")

        # Remove file
        os.remove(file_path)

        # Remove metadata
        metadata = load_identity_files_metadata()
        if file_path in metadata:
            del metadata[file_path]
            save_identity_files_metadata(metadata)

        return True
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete identity file: {str(e)}"
        )


def rename_identity_file(file_path: str, new_display_name: str):
    """Rename the display name of an identity file"""
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Identity file not found")

        metadata = load_identity_files_metadata()
        if file_path not in metadata:
            raise HTTPException(
                status_code=404, detail="Identity file metadata not found"
            )

        metadata[file_path]["display_name"] = new_display_name
        save_identity_files_metadata(metadata)

        return True
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to rename identity file: {str(e)}"
        )


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


def get_ssh_node_info_json_path():
    sky_dir = Path.home() / ".sky" / "lattice_data"
    sky_dir.mkdir(parents=True, exist_ok=True)
    return sky_dir / "ssh_node_info.json"


def load_ssh_node_info():
    json_path = get_ssh_node_info_json_path()
    if not json_path.exists():
        return {}
    try:
        import json

        with open(json_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading SSH node info JSON: {e}")
        return {}


def save_ssh_node_info(data):
    json_path = get_ssh_node_info_json_path()
    try:
        import json

        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving SSH node info JSON: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to save SSH node info: {str(e)}"
        )


# Import cluster platform functions from the new database-based implementation
