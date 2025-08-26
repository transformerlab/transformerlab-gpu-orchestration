from fastapi import APIRouter, Depends
from lattice.routes.auth.utils import get_current_user
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from lattice.routes.api_keys.service import APIKeyService


class CreateAPIKeyRequest(BaseModel):
    name: str
    expires_in_days: Optional[int] = None
    scopes: Optional[List[str]] = None


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    user_id: str
    organization_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    scopes: Optional[List[str]] = None


class CreateAPIKeyResponse(BaseModel):
    api_key: str  # Full key - only returned once
    key_info: APIKeyResponse


class UpdateAPIKeyRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    expires_in_days: Optional[int] = None
    scopes: Optional[List[str]] = None


router = APIRouter(prefix="/api-keys", tags=["auth"])


@router.post("", response_model=CreateAPIKeyResponse)
async def create_api_key(request: CreateAPIKeyRequest, user=Depends(get_current_user)):
    """Create a new API key for the current user"""
    api_key, api_key_record = APIKeyService.create_api_key(
        user_id=user.get("id"),
        name=request.name,
        organization_id=user.get("organization_id"),
        expires_in_days=request.expires_in_days,
        scopes=request.scopes,
    )

    scopes_list = APIKeyService.parse_scopes(api_key_record)

    key_info = APIKeyResponse(
        id=api_key_record.id,
        name=api_key_record.name,
        key_prefix=api_key_record.key_prefix,
        user_id=api_key_record.user_id,
        organization_id=api_key_record.organization_id,
        is_active=api_key_record.is_active,
        created_at=api_key_record.created_at,
        last_used_at=api_key_record.last_used_at,
        expires_at=api_key_record.expires_at,
        scopes=scopes_list,
    )

    return CreateAPIKeyResponse(api_key=api_key, key_info=key_info)


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(user=Depends(get_current_user)):
    """List all API keys for the current user"""
    api_keys = APIKeyService.list_api_keys(user_id=user.get("id"))

    result = []
    for api_key in api_keys:
        scopes_list = APIKeyService.parse_scopes(api_key)

        result.append(
            APIKeyResponse(
                id=api_key.id,
                name=api_key.name,
                key_prefix=api_key.key_prefix,
                user_id=api_key.user_id,
                organization_id=api_key.organization_id,
                is_active=api_key.is_active,
                created_at=api_key.created_at,
                last_used_at=api_key.last_used_at,
                expires_at=api_key.expires_at,
                scopes=scopes_list,
            )
        )

    return result


@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(key_id: str, user=Depends(get_current_user)):
    """Get a specific API key by ID"""
    api_key = APIKeyService.get_api_key(key_id=key_id, user_id=user.get("id"))
    scopes_list = APIKeyService.parse_scopes(api_key)

    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        user_id=api_key.user_id,
        organization_id=api_key.organization_id,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        scopes=scopes_list,
    )


@router.put("/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: str, request: UpdateAPIKeyRequest, user=Depends(get_current_user)
):
    """Update an API key"""
    api_key = APIKeyService.update_api_key(
        key_id=key_id,
        user_id=user.get("id"),
        name=request.name,
        is_active=request.is_active,
        expires_in_days=request.expires_in_days,
        scopes=request.scopes,
    )

    scopes_list = APIKeyService.parse_scopes(api_key)

    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        user_id=api_key.user_id,
        organization_id=api_key.organization_id,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        scopes=scopes_list,
    )


@router.delete("/{key_id}")
async def delete_api_key(key_id: str, user=Depends(get_current_user)):
    """Delete an API key"""
    APIKeyService.delete_api_key(key_id=key_id, user_id=user.get("id"))
    return {"message": "API key deleted successfully"}


@router.post("/{key_id}/regenerate", response_model=CreateAPIKeyResponse)
async def regenerate_api_key(key_id: str, user=Depends(get_current_user)):
    """Regenerate an API key (creates a new key value but keeps the same record)"""
    new_api_key, api_key = APIKeyService.regenerate_api_key(
        key_id=key_id, user_id=user.get("id")
    )

    scopes_list = APIKeyService.parse_scopes(api_key)

    key_info = APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        user_id=api_key.user_id,
        organization_id=api_key.organization_id,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        scopes=scopes_list,
    )

    return CreateAPIKeyResponse(api_key=new_api_key, key_info=key_info)
