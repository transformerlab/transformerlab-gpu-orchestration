import os
import yaml
from pathlib import Path
from fastapi import HTTPException
import uuid


def get_ssh_node_pools_path():
    sky_dir = Path.home() / ".sky"
    sky_dir.mkdir(exist_ok=True)
    return sky_dir / "ssh_node_pools.yaml"





def get_user_identity_files_dir(user_id: str, organization_id: str):
    """Get the identity files directory for a specific user and organization"""
    sky_dir = Path.home() / ".sky"
    identity_dir = sky_dir / "identity_files" / organization_id / user_id
    identity_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
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








def save_named_identity_file(
    file_content: bytes, original_filename: str, display_name: str, user_id: str, organization_id: str
) -> str:
    try:
        if not is_valid_identity_file(original_filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid identity file type. Allowed: .pem, .key, .rsa, .pub, or files with no extension (e.g., id_rsa)",
            )

        if not user_id or not organization_id:
            raise HTTPException(
                status_code=400,
                detail="User ID and organization ID are required for identity file operations"
            )

        # Use user-specific directory
        identity_dir = get_user_identity_files_dir(user_id, organization_id)
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

        return str(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save identity file: {str(e)}"
        )


def save_temporary_identity_file(
    file_content: bytes, original_filename: str, user_id: str, organization_id: str
) -> str:
    """Save a temporary identity file for cluster/node creation (not managed)"""
    try:
        if not is_valid_identity_file(original_filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid identity file type. Allowed: .pem, .key, .rsa, .pub, or files with no extension (e.g., id_rsa)",
            )

        if not user_id or not organization_id:
            raise HTTPException(
                status_code=400,
                detail="User ID and organization ID are required for identity file operations"
            )

        # Use user-specific directory
        identity_dir = get_user_identity_files_dir(user_id, organization_id)
        file_extension = Path(original_filename).suffix

        # Create a unique filename for temporary files
        unique_filename = f"temp_{uuid.uuid4().hex[:4]}{file_extension}"
        file_path = identity_dir / unique_filename

        with open(file_path, "wb") as f:
            f.write(file_content)
        os.chmod(file_path, 0o600)

        return str(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save temporary identity file: {str(e)}"
        )


def get_available_identity_files(user_id: str, organization_id: str):
    """Get list of available named identity files for a specific user and organization"""
    try:
        if not user_id or not organization_id:
            raise HTTPException(
                status_code=400,
                detail="User ID and organization ID are required for identity file operations"
            )

        identity_dir = get_user_identity_files_dir(user_id, organization_id)
        files = []
        
        if identity_dir.exists():
            for file_path in identity_dir.iterdir():
                if file_path.is_file():
                    stat_info = file_path.stat()
                    files.append(
                        {
                            "path": str(file_path),
                            "display_name": file_path.name,  # Will be overridden by DB data
                            "original_filename": file_path.name,  # Will be overridden by DB data
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


def delete_named_identity_file(file_path: str, user_id: str, organization_id: str):
    """Delete a named identity file"""
    try:
        if not user_id or not organization_id:
            raise HTTPException(
                status_code=400,
                detail="User ID and organization ID are required for identity file operations"
            )

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Identity file not found")

        # Check if file is in the correct identity files directory
        expected_dir = get_user_identity_files_dir(user_id, organization_id)
        if not Path(file_path).parent.samefile(expected_dir):
            raise HTTPException(status_code=400, detail="Invalid file path")

        # Remove file
        os.remove(file_path)

        return True
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete identity file: {str(e)}"
        )


def rename_identity_file(file_path: str, new_display_name: str, user_id: str, organization_id: str):
    """Rename the display name of an identity file"""
    try:
        if not user_id or not organization_id:
            raise HTTPException(
                status_code=400,
                detail="User ID and organization ID are required for identity file operations"
            )

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Identity file not found")

        # For user-specific files, the database will handle the rename
        # This function is kept for potential future use but doesn't modify filesystem metadata
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


# File-based SSH node info functions removed - now using database-based approach


# Import cluster platform functions from the new database-based implementation
