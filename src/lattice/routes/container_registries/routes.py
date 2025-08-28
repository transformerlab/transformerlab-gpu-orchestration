from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from config import get_db
from db_models import ContainerRegistry, validate_relationships_before_save, validate_relationships_before_delete
from lattice.models import (
    ContainerRegistryResponse,
    CreateContainerRegistryRequest,
    UpdateContainerRegistryRequest,
    ContainerRegistryListResponse,
)
from lattice.routes.auth.api_key_auth import get_user_or_api_key
from lattice.routes.auth.utils import get_current_user

router = APIRouter(
    prefix="/container-registries",
    dependencies=[Depends(get_user_or_api_key)],
    tags=["container-registries"],
)


@router.get("/", response_model=ContainerRegistryListResponse)
async def list_container_registries(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """List all container registries for the current organization"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Get registries for the organization
        registries = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        total_count = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .count()
        )

        registry_responses = []
        for registry in registries:
            registry_responses.append(
                ContainerRegistryResponse(
                    id=registry.id,
                    name=registry.name,
                    docker_username=registry.docker_username,
                    docker_server=registry.docker_server,
                    organization_id=registry.organization_id,
                    user_id=registry.user_id,
                    created_at=registry.created_at.isoformat(),
                    updated_at=registry.updated_at.isoformat(),
                    is_active=registry.is_active,
                )
            )

        return ContainerRegistryListResponse(
            registries=registry_responses, total_count=total_count
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list container registries: {str(e)}"
        )


@router.post("/", response_model=ContainerRegistryResponse)
async def create_container_registry(
    request: Request,
    response: Response,
    registry_request: CreateContainerRegistryRequest,
    db: Session = Depends(get_db),
):
    """Create a new container registry"""
    try:
        user_info = get_current_user(request, response)
        user_id = user_info.get("id")
        organization_id = user_info.get("organization_id")

        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Check if registry name already exists in the organization
        existing_registry = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.name == registry_request.name,
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .first()
        )

        if existing_registry:
            raise HTTPException(
                status_code=400,
                detail=f"Container registry with name '{registry_request.name}' already exists",
            )

        # Create new registry
        new_registry = ContainerRegistry(
            name=registry_request.name,
            docker_username=registry_request.docker_username,
            docker_password=registry_request.docker_password,
            docker_server=registry_request.docker_server,
            organization_id=organization_id,
            user_id=user_id,
        )

        # Validate relationships before saving
        validate_relationships_before_save(new_registry, db)

        db.add(new_registry)
        db.commit()
        db.refresh(new_registry)

        return ContainerRegistryResponse(
            id=new_registry.id,
            name=new_registry.name,
            docker_username=new_registry.docker_username,
            docker_server=new_registry.docker_server,
            organization_id=new_registry.organization_id,
            user_id=new_registry.user_id,
            created_at=new_registry.created_at.isoformat(),
            updated_at=new_registry.updated_at.isoformat(),
            is_active=new_registry.is_active,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create container registry: {str(e)}"
        )


@router.get("/available", response_model=List[ContainerRegistryResponse])
async def get_available_container_registries(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Get all available container registries for the current organization (for selection in cluster launching)"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        if not organization_id:
            raise HTTPException(status_code=400, detail="Organization ID required")

        # Get active registries for the organization
        registries = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .all()
        )

        registry_responses = []
        for registry in registries:
            registry_responses.append(
                ContainerRegistryResponse(
                    id=registry.id,
                    name=registry.name,
                    docker_username=registry.docker_username,
                    docker_server=registry.docker_server,
                    organization_id=registry.organization_id,
                    user_id=registry.user_id,
                    created_at=registry.created_at.isoformat(),
                    updated_at=registry.updated_at.isoformat(),
                    is_active=registry.is_active,
                )
            )

        return registry_responses
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get available container registries: {str(e)}",
        )


@router.get("/{registry_id}", response_model=ContainerRegistryResponse)
async def get_container_registry(
    registry_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Get a specific container registry by ID"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        registry = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.id == registry_id,
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .first()
        )

        if not registry:
            raise HTTPException(status_code=404, detail="Container registry not found")

        return ContainerRegistryResponse(
            id=registry.id,
            name=registry.name,
            docker_username=registry.docker_username,
            docker_server=registry.docker_server,
            organization_id=registry.organization_id,
            user_id=registry.user_id,
            created_at=registry.created_at.isoformat(),
            updated_at=registry.updated_at.isoformat(),
            is_active=registry.is_active,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get container registry: {str(e)}"
        )


@router.put("/{registry_id}", response_model=ContainerRegistryResponse)
async def update_container_registry(
    registry_id: str,
    request: Request,
    response: Response,
    registry_request: UpdateContainerRegistryRequest,
    db: Session = Depends(get_db),
):
    """Update a container registry"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        registry = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.id == registry_id,
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .first()
        )

        if not registry:
            raise HTTPException(status_code=404, detail="Container registry not found")

        # Check if new name conflicts with existing registry
        if registry_request.name and registry_request.name != registry.name:
            existing_registry = (
                db.query(ContainerRegistry)
                .filter(
                    ContainerRegistry.name == registry_request.name,
                    ContainerRegistry.organization_id == organization_id,
                    ContainerRegistry.id != registry_id,
                    ContainerRegistry.is_active,
                )
                .first()
            )

            if existing_registry:
                raise HTTPException(
                    status_code=400,
                    detail=f"Container registry with name '{registry_request.name}' already exists",
                )

        # Update fields
        update_data = registry_request.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(registry, field, value)

        registry.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(registry)

        return ContainerRegistryResponse(
            id=registry.id,
            name=registry.name,
            docker_username=registry.docker_username,
            docker_server=registry.docker_server,
            organization_id=registry.organization_id,
            user_id=registry.user_id,
            created_at=registry.created_at.isoformat(),
            updated_at=registry.updated_at.isoformat(),
            is_active=registry.is_active,
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update container registry: {str(e)}"
        )


@router.delete("/{registry_id}")
async def delete_container_registry(
    registry_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Delete a container registry (soft delete)"""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        registry = (
            db.query(ContainerRegistry)
            .filter(
                ContainerRegistry.id == registry_id,
                ContainerRegistry.organization_id == organization_id,
                ContainerRegistry.is_active,
            )
            .first()
        )

        if not registry:
            raise HTTPException(status_code=404, detail="Container registry not found")

        # Soft delete
        registry.is_active = False
        registry.updated_at = datetime.utcnow()

        db.commit()

        return {"message": f"Container registry '{registry.name}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete container registry: {str(e)}"
        )
