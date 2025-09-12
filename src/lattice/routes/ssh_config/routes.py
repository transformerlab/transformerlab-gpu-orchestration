from datetime import datetime

from config import get_db
from db.db_models import SSHKey
from fastapi import APIRouter, Depends, HTTPException, status
from models import (
    CreateSSHKeyRequest,
    SSHKeyListResponse,
    SSHKeyResponse,
    UpdateSSHKeyRequest,
)
from routes.auth.utils import get_current_user
from routes.auth.api_key_auth import enforce_csrf
from routes.ssh_config.utils import validate_ssh_public_key
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


router = APIRouter(prefix="/ssh-config", tags=["ssh-config"], dependencies=[Depends(enforce_csrf)])


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
            organization_id=user["organization_id"],
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
            organization_id=ssh_key.organization_id,
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
        if "uq_ssh_keys_org_user_name" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an SSH key with this name in this organization",
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
        .filter(
            SSHKey.user_id == user["id"],
            SSHKey.organization_id == user["organization_id"],
        )
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
            organization_id=key.organization_id,
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
        .filter(
            SSHKey.id == key_id,
            SSHKey.user_id == user["id"],
            SSHKey.organization_id == user["organization_id"],
        )
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
        organization_id=ssh_key.organization_id,
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
        .filter(
            SSHKey.id == key_id,
            SSHKey.user_id == user["id"],
            SSHKey.organization_id == user["organization_id"],
        )
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
            organization_id=ssh_key.organization_id,
            created_at=ssh_key.created_at.isoformat(),
            updated_at=ssh_key.updated_at.isoformat(),
            last_used_at=ssh_key.last_used_at.isoformat()
            if ssh_key.last_used_at
            else None,
            is_active=ssh_key.is_active,
        )

    except IntegrityError as e:
        session.rollback()
        if "uq_ssh_keys_org_user_name" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have an SSH key with this name in this organization",
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
        .filter(
            SSHKey.id == key_id,
            SSHKey.user_id == user["id"],
            SSHKey.organization_id == user["organization_id"],
        )
        .first()
    )

    if not ssh_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found"
        )

    session.delete(ssh_key)
    session.commit()


# # Utility endpoint for SSH proxy server to lookup keys
# We hide this as it is a security issue to make it public
# The SSH proxy accesses the DB directly so this is not needed
# @router.get("/ssh-keys/lookup/by-key", response_model=dict)
# async def lookup_user_by_ssh_key(
#     public_key: str,
#     session: Session = Depends(get_db),
# ):
#     """
#     Internal endpoint for SSH proxy server to lookup user by SSH public key.
#     This endpoint is intended for use by the SSH proxy server only.
#     """
#     try:
#         # Generate fingerprint for the provided key
#         fingerprint = SSHKey.generate_fingerprint(public_key)

#         # Look up the key in the database
#         ssh_key = (
#             session.query(SSHKey)
#             .filter(SSHKey.fingerprint == fingerprint, SSHKey.is_active)
#             .first()
#         )

#         if not ssh_key:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="SSH key not found or inactive",
#             )

#         # Update last_used_at
#         ssh_key.update_last_used()
#         session.commit()

#         return {
#             "user_id": ssh_key.user_id,
#             "key_name": ssh_key.name,
#             "key_type": ssh_key.key_type,
#             "last_used_at": ssh_key.last_used_at.isoformat(),
#         }

#     except ValueError as e:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail=f"Invalid SSH key format: {str(e)}",
#         )
