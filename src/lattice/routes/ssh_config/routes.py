import os
from datetime import datetime

from config import get_db
from db_models import SSHKey
from fastapi import APIRouter, Depends, HTTPException, status
from models import (
    CreateSSHKeyRequest,
    SSHKeyListResponse,
    SSHKeyResponse,
    UpdateSSHKeyRequest,
)
from routes.auth.api_key_auth import get_user_or_api_key
from routes.auth.utils import get_current_user
from routes.ssh_config.utils import validate_ssh_public_key, parse_ssh_config
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from lattice.utils.cluster_utils import get_cluster_platform_info
from lattice.utils.cluster_resolver import handle_cluster_name_param

router = APIRouter(prefix="/ssh-config", tags=["SSH Config"])


@router.post(
    "/ssh-keys", response_model=SSHKeyResponse, status_code=status.HTTP_201_CREATED
)
async def create_ssh_key(
    request: CreateSSHKeyRequest,
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Create a new SSH public key for the current user."""
    try:
        # Validate the SSH public key
        key_type, cleaned_key = validate_ssh_public_key(request.public_key)

        # Generate fingerprint
        fingerprint = SSHKey.generate_fingerprint(cleaned_key)

        # Check if fingerprint already exists (prevent duplicate keys)
        existing_key = (
            session.query(SSHKey).filter(SSHKey.fingerprint == fingerprint).first()
        )

        if existing_key:
            if existing_key.user_id == user["id"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You already have this SSH key registered",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This SSH key is already registered by another user",
                )

        # Create new SSH key
        ssh_key = SSHKey(
            user_id=user["id"],
            name=request.name,
            public_key=cleaned_key,
            fingerprint=fingerprint,
            key_type=key_type,
        )

        session.add(ssh_key)
        session.commit()
        session.refresh(ssh_key)

        return SSHKeyResponse(
            id=ssh_key.id,
            name=ssh_key.name,
            public_key=ssh_key.public_key,
            fingerprint=ssh_key.fingerprint,
            key_type=ssh_key.key_type,
            created_at=ssh_key.created_at.isoformat(),
            updated_at=ssh_key.updated_at.isoformat(),
            last_used_at=ssh_key.last_used_at.isoformat()
            if ssh_key.last_used_at
            else None,
            is_active=ssh_key.is_active,
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except IntegrityError as e:
        session.rollback()
        if "uq_ssh_keys_user_name" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an SSH key with this name",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create SSH key due to database constraint",
        )


@router.get("/ssh-keys", response_model=SSHKeyListResponse)
async def list_ssh_keys(
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """List all SSH keys for the current user."""
    ssh_keys = (
        session.query(SSHKey)
        .filter(SSHKey.user_id == user["id"])
        .order_by(SSHKey.created_at.desc())
        .all()
    )

    ssh_key_responses = [
        SSHKeyResponse(
            id=key.id,
            name=key.name,
            public_key=key.public_key,
            fingerprint=key.fingerprint,
            key_type=key.key_type,
            created_at=key.created_at.isoformat(),
            updated_at=key.updated_at.isoformat(),
            last_used_at=key.last_used_at.isoformat() if key.last_used_at else None,
            is_active=key.is_active,
        )
        for key in ssh_keys
    ]

    return SSHKeyListResponse(
        ssh_keys=ssh_key_responses, total_count=len(ssh_key_responses)
    )


@router.get("/ssh-keys/{key_id}", response_model=SSHKeyResponse)
async def get_ssh_key(
    key_id: str,
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Get a specific SSH key by ID."""
    ssh_key = (
        session.query(SSHKey)
        .filter(SSHKey.id == key_id, SSHKey.user_id == user["id"])
        .first()
    )

    if not ssh_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found"
        )

    return SSHKeyResponse(
        id=ssh_key.id,
        name=ssh_key.name,
        public_key=ssh_key.public_key,
        fingerprint=ssh_key.fingerprint,
        key_type=ssh_key.key_type,
        created_at=ssh_key.created_at.isoformat(),
        updated_at=ssh_key.updated_at.isoformat(),
        last_used_at=ssh_key.last_used_at.isoformat() if ssh_key.last_used_at else None,
        is_active=ssh_key.is_active,
    )


@router.put("/ssh-keys/{key_id}", response_model=SSHKeyResponse)
async def update_ssh_key(
    key_id: str,
    request: UpdateSSHKeyRequest,
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Update an SSH key."""
    ssh_key = (
        session.query(SSHKey)
        .filter(SSHKey.id == key_id, SSHKey.user_id == user["id"])
        .first()
    )

    if not ssh_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found"
        )

    try:
        # Update fields if provided
        if request.name is not None:
            ssh_key.name = request.name
        if request.is_active is not None:
            ssh_key.is_active = request.is_active

        ssh_key.updated_at = datetime.utcnow()

        session.commit()
        session.refresh(ssh_key)

        return SSHKeyResponse(
            id=ssh_key.id,
            name=ssh_key.name,
            public_key=ssh_key.public_key,
            fingerprint=ssh_key.fingerprint,
            key_type=ssh_key.key_type,
            created_at=ssh_key.created_at.isoformat(),
            updated_at=ssh_key.updated_at.isoformat(),
            last_used_at=ssh_key.last_used_at.isoformat()
            if ssh_key.last_used_at
            else None,
            is_active=ssh_key.is_active,
        )

    except IntegrityError as e:
        session.rollback()
        if "uq_ssh_keys_user_name" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an SSH key with this name",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update SSH key due to database constraint",
        )


@router.delete("/ssh-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ssh_key(
    key_id: str,
    user=Depends(get_current_user),
    session: Session = Depends(get_db),
):
    """Delete an SSH key."""
    ssh_key = (
        session.query(SSHKey)
        .filter(SSHKey.id == key_id, SSHKey.user_id == user["id"])
        .first()
    )

    if not ssh_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found"
        )

    session.delete(ssh_key)
    session.commit()


# Utility endpoint for SSH proxy server to lookup keys
@router.get("/ssh-keys/lookup/by-key", response_model=dict)
async def lookup_user_by_ssh_key(
    public_key: str,
    session: Session = Depends(get_db),
):
    """
    Internal endpoint for SSH proxy server to lookup user by SSH public key.
    This endpoint is intended for use by the SSH proxy server only.
    """
    try:
        # Generate fingerprint for the provided key
        fingerprint = SSHKey.generate_fingerprint(public_key)

        # Look up the key in the database
        ssh_key = (
            session.query(SSHKey)
            .filter(SSHKey.fingerprint == fingerprint, SSHKey.is_active)
            .first()
        )

        if not ssh_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SSH key not found or inactive",
            )

        # Update last_used_at
        ssh_key.update_last_used()
        session.commit()

        return {
            "user_id": ssh_key.user_id,
            "key_name": ssh_key.name,
            "key_type": ssh_key.key_type,
            "last_used_at": ssh_key.last_used_at.isoformat(),
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid SSH key format: {str(e)}",
        )


@router.get("/{instance_name}")
async def get_cluster_ssh_config(
    instance_name: str,
    user=Depends(get_user_or_api_key),
):
    """
    Get SSH configuration for a specific cluster.
    Returns the SSH config as JSON along with the identity file contents.
    """
    try:
        # Get user info from request
        user_id = user["id"]
        org_id = user.get("organization_id")

        if not org_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization ID not found in user context",
            )

        # Resolve display name to actual cluster name
        try:
            actual_cluster_name = handle_cluster_name_param(
                instance_name, user_id, org_id
            )
        except HTTPException:
            # If cluster name resolution fails, it means the cluster doesn't exist for this user/org
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cluster '{instance_name}' not found",
            )

        # Verify cluster ownership using the new system
        platform_info = get_cluster_platform_info(actual_cluster_name)

        if not platform_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cluster '{instance_name}' not found",
            )

        cluster_user_id = platform_info.get("user_id")
        cluster_org_id = platform_info.get("organization_id")

        if cluster_user_id != user_id or cluster_org_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: cluster does not belong to your user or organization",
            )

        # Read SSH config file using the actual cluster name
        ssh_config_dir = os.path.expanduser("~/.sky/generated/ssh")
        ssh_config_file = os.path.join(ssh_config_dir, actual_cluster_name)

        if not os.path.exists(ssh_config_file):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SSH config file for cluster '{instance_name}' not found",
            )

        # Parse SSH config
        with open(ssh_config_file, "r") as f:
            ssh_config_content = f.read()

        ssh_config_json = parse_ssh_config(ssh_config_content)

        # Read identity file if present
        identity_file_content = None
        identity_file_path = ssh_config_json.get("IdentityFile")

        if identity_file_path and os.path.exists(identity_file_path):
            try:
                with open(identity_file_path, "r") as f:
                    identity_file_content = f.read()
            except Exception as e:
                print(
                    f"Warning: Could not read identity file {identity_file_path}: {e}"
                )

        return {
            "instance_name": instance_name,
            "ssh_config": ssh_config_json,
            "identity_file_content": identity_file_content,
            "raw_config": ssh_config_content,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading SSH config: {str(e)}",
        )
