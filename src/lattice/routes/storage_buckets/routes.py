from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from config import get_db
from db_models import StorageBucket, validate_relationships_before_save
from lattice.models import (
    StorageBucketResponse,
    CreateStorageBucketRequest,
    UpdateStorageBucketRequest,
    StorageBucketListResponse,
)
from lattice.routes.auth.api_key_auth import get_user_or_api_key
from lattice.routes.auth.utils import get_current_user

router = APIRouter(
    prefix="/storage-buckets",
    dependencies=[Depends(get_user_or_api_key)],
    tags=["storage-buckets"],
)


@router.get("/", response_model=StorageBucketListResponse)
async def list_storage_buckets(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List all storage buckets for the current organization"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Get buckets for the organization
        buckets = (
            db.query(StorageBucket)
            .filter(
                StorageBucket.organization_id == organization_id,
                StorageBucket.is_active == True,  # noqa: E712
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        total_count = (
            db.query(StorageBucket)
            .filter(
                StorageBucket.organization_id == organization_id,
                StorageBucket.is_active == True,  # noqa: E712
            )
            .count()
        )

        bucket_responses = []
        for bucket in buckets:
            bucket_responses.append(
                StorageBucketResponse(
                    id=bucket.id,
                    name=bucket.name,
                    remote_path=bucket.remote_path,
                    source=bucket.source,
                    store=bucket.store,
                    persistent=bucket.persistent,
                    mode=bucket.mode,
                    organization_id=bucket.organization_id,
                    created_by=bucket.created_by,
                    created_at=bucket.created_at.isoformat(),
                    updated_at=bucket.updated_at.isoformat(),
                    is_active=bucket.is_active,
                )
            )

        return StorageBucketListResponse(
            buckets=bucket_responses, total_count=total_count
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list storage buckets: {str(e)}"
        )


@router.post("/", response_model=StorageBucketResponse)
async def create_storage_bucket(
    request: Request,
    response: Response,
    bucket_request: CreateStorageBucketRequest,
    db: Session = Depends(get_db),
):
    """Create a new storage bucket"""
    try:
        user_info = get_current_user(request, response)
        user_id = user_info.get("id")
        organization_id = user_info.get("organization_id")

        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Check if bucket name already exists
        existing_bucket = (
            db.query(StorageBucket)
            .filter(StorageBucket.name == bucket_request.name)
            .first()
        )

        if existing_bucket:
            raise HTTPException(
                status_code=400,
                detail=f"Storage bucket with name '{bucket_request.name}' already exists",
            )

        # Validate mode
        valid_modes = ["MOUNT", "COPY", "MOUNT_CACHED"]
        if bucket_request.mode not in valid_modes:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode. Must be one of: {', '.join(valid_modes)}",
            )

        # Validate store if provided
        valid_stores = ["auto", "s3", "gcs", "azure", "r2", "ibm", "oci"]
        if bucket_request.store and bucket_request.store not in valid_stores:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid store. Must be one of: {', '.join(valid_stores)}",
            )

        # Create new bucket
        new_bucket = StorageBucket(
            name=bucket_request.name,
            remote_path=bucket_request.remote_path,
            source=bucket_request.source,
            store=bucket_request.store,
            persistent=bucket_request.persistent,
            mode=bucket_request.mode,
            organization_id=organization_id,
            created_by=user_id,
        )

        # Validate relationships before saving
        validate_relationships_before_save(new_bucket, db)

        db.add(new_bucket)
        db.commit()
        db.refresh(new_bucket)

        return StorageBucketResponse(
            id=new_bucket.id,
            name=new_bucket.name,
            remote_path=new_bucket.remote_path,
            source=new_bucket.source,
            store=new_bucket.store,
            persistent=new_bucket.persistent,
            mode=new_bucket.mode,
            organization_id=new_bucket.organization_id,
            created_by=new_bucket.created_by,
            created_at=new_bucket.created_at.isoformat(),
            updated_at=new_bucket.updated_at.isoformat(),
            is_active=new_bucket.is_active,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create storage bucket: {str(e)}"
        )


@router.get("/available", response_model=List[StorageBucketResponse])
async def get_available_storage_buckets(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Get all available storage buckets for the current organization (for selection in cluster launching)"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Get active buckets for the organization
        buckets = (
            db.query(StorageBucket)
            .filter(
                StorageBucket.organization_id == organization_id,
                StorageBucket.is_active == True,  # noqa: E712
            )
            .all()
        )

        bucket_responses = []
        for bucket in buckets:
            bucket_responses.append(
                StorageBucketResponse(
                    id=bucket.id,
                    name=bucket.name,
                    remote_path=bucket.remote_path,
                    source=bucket.source,
                    store=bucket.store,
                    persistent=bucket.persistent,
                    mode=bucket.mode,
                    organization_id=bucket.organization_id,
                    created_by=bucket.created_by,
                    created_at=bucket.created_at.isoformat(),
                    updated_at=bucket.updated_at.isoformat(),
                    is_active=bucket.is_active,
                )
            )

        return bucket_responses
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get available storage buckets: {str(e)}"
        )


@router.get("/{bucket_id}", response_model=StorageBucketResponse)
async def get_storage_bucket(
    bucket_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Get a specific storage bucket by ID"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = (
            db.query(StorageBucket)
            .filter(
                StorageBucket.id == bucket_id,
                StorageBucket.organization_id == organization_id,
                StorageBucket.is_active == True,  # noqa: E712
            )
            .first()
        )

        if not bucket:
            raise HTTPException(status_code=404, detail="Storage bucket not found")

        return StorageBucketResponse(
            id=bucket.id,
            name=bucket.name,
            remote_path=bucket.remote_path,
            source=bucket.source,
            store=bucket.store,
            persistent=bucket.persistent,
            mode=bucket.mode,
            organization_id=bucket.organization_id,
            created_by=bucket.created_by,
            created_at=bucket.created_at.isoformat(),
            updated_at=bucket.updated_at.isoformat(),
            is_active=bucket.is_active,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get storage bucket: {str(e)}"
        )


@router.put("/{bucket_id}", response_model=StorageBucketResponse)
async def update_storage_bucket(
    bucket_id: str,
    request: Request,
    response: Response,
    bucket_request: UpdateStorageBucketRequest,
    db: Session = Depends(get_db),
):
    """Update a storage bucket"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = (
            db.query(StorageBucket)
            .filter(
                StorageBucket.id == bucket_id,
                StorageBucket.organization_id == organization_id,
                StorageBucket.is_active == True,  # noqa: E712
            )
            .first()
        )

        if not bucket:
            raise HTTPException(status_code=404, detail="Storage bucket not found")

        # Check if new name conflicts with existing bucket
        if bucket_request.name and bucket_request.name != bucket.name:
            existing_bucket = (
                db.query(StorageBucket)
                .filter(
                    StorageBucket.name == bucket_request.name,
                    StorageBucket.id != bucket_id,
                )
                .first()
            )

            if existing_bucket:
                raise HTTPException(
                    status_code=400,
                    detail=f"Storage bucket with name '{bucket_request.name}' already exists",
                )

        # Validate mode if provided
        if bucket_request.mode:
            valid_modes = ["MOUNT", "COPY", "MOUNT_CACHED"]
            if bucket_request.mode not in valid_modes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid mode. Must be one of: {', '.join(valid_modes)}",
                )

        # Validate store if provided
        if bucket_request.store:
            valid_stores = ["auto", "s3", "gcs", "azure", "r2", "ibm", "oci"]
            if bucket_request.store not in valid_stores:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid store. Must be one of: {', '.join(valid_stores)}",
                )

        # Update fields
        update_data = bucket_request.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(bucket, field, value)

        bucket.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(bucket)

        return StorageBucketResponse(
            id=bucket.id,
            name=bucket.name,
            remote_path=bucket.remote_path,
            source=bucket.source,
            store=bucket.store,
            persistent=bucket.persistent,
            mode=bucket.mode,
            organization_id=bucket.organization_id,
            created_by=bucket.created_by,
            created_at=bucket.created_at.isoformat(),
            updated_at=bucket.updated_at.isoformat(),
            is_active=bucket.is_active,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update storage bucket: {str(e)}"
        )


@router.delete("/{bucket_id}")
async def delete_storage_bucket(
    bucket_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Delete a storage bucket (soft delete)"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = (
            db.query(StorageBucket)
            .filter(
                StorageBucket.id == bucket_id,
                StorageBucket.organization_id == organization_id,
                StorageBucket.is_active == True,  # noqa: E712
            )
            .first()
        )

        if not bucket:
            raise HTTPException(status_code=404, detail="Storage bucket not found")

        # Soft delete
        bucket.is_active = False
        bucket.updated_at = datetime.utcnow()

        db.commit()

        return {"message": f"Storage bucket '{bucket.name}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete storage bucket: {str(e)}"
        )
