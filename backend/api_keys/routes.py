from fastapi import APIRouter, Request, Response, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from auth.utils import get_current_user
from config import SessionLocal
from db_models import APIKey
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import json


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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


router = APIRouter(prefix="/api-keys")


@router.post("", response_model=CreateAPIKeyResponse)
async def create_api_key(
    request: CreateAPIKeyRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new API key for the current user"""
    try:
        # Generate the API key
        api_key, key_hash, key_prefix = APIKey.generate_api_key()
        
        # Calculate expiration if provided
        expires_at = None
        if request.expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
        
        # Serialize scopes to JSON if provided
        scopes_json = None
        if request.scopes:
            scopes_json = json.dumps(request.scopes)
        
        # Create the API key record
        api_key_record = APIKey(
            name=request.name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            user_id=user.get("id"),
            organization_id=user.get("organization_id"),
            expires_at=expires_at,
            scopes=scopes_json
        )
        
        db.add(api_key_record)
        db.commit()
        db.refresh(api_key_record)
        
        # Parse scopes back for response
        scopes_list = None
        if api_key_record.scopes:
            scopes_list = json.loads(api_key_record.scopes)
        
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
            scopes=scopes_list
        )
        
        return CreateAPIKeyResponse(
            api_key=api_key,
            key_info=key_info
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create API key: {str(e)}"
        )


@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API keys for the current user"""
    try:
        api_keys = db.query(APIKey).filter(
            APIKey.user_id == user.get("id")
        ).order_by(APIKey.created_at.desc()).all()
        
        result = []
        for api_key in api_keys:
            # Parse scopes back for response
            scopes_list = None
            if api_key.scopes:
                scopes_list = json.loads(api_key.scopes)
            
            result.append(APIKeyResponse(
                id=api_key.id,
                name=api_key.name,
                key_prefix=api_key.key_prefix,
                user_id=api_key.user_id,
                organization_id=api_key.organization_id,
                is_active=api_key.is_active,
                created_at=api_key.created_at,
                last_used_at=api_key.last_used_at,
                expires_at=api_key.expires_at,
                scopes=scopes_list
            ))
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list API keys: {str(e)}"
        )


@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific API key by ID"""
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.user_id == user.get("id")
            )
        ).first()
        
        if not api_key:
            raise HTTPException(
                status_code=404,
                detail="API key not found"
            )
        
        # Parse scopes back for response
        scopes_list = None
        if api_key.scopes:
            scopes_list = json.loads(api_key.scopes)
        
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
            scopes=scopes_list
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get API key: {str(e)}"
        )


@router.put("/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: str,
    request: UpdateAPIKeyRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an API key"""
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.user_id == user.get("id")
            )
        ).first()
        
        if not api_key:
            raise HTTPException(
                status_code=404,
                detail="API key not found"
            )
        
        # Update fields if provided
        if request.name is not None:
            api_key.name = request.name
        
        if request.is_active is not None:
            api_key.is_active = request.is_active
        
        if request.expires_in_days is not None:
            if request.expires_in_days > 0:
                api_key.expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
            else:
                api_key.expires_at = None
        
        if request.scopes is not None:
            api_key.scopes = json.dumps(request.scopes)
        
        db.commit()
        db.refresh(api_key)
        
        # Parse scopes back for response
        scopes_list = None
        if api_key.scopes:
            scopes_list = json.loads(api_key.scopes)
        
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
            scopes=scopes_list
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update API key: {str(e)}"
        )


@router.delete("/{key_id}")
async def delete_api_key(
    key_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an API key"""
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.user_id == user.get("id")
            )
        ).first()
        
        if not api_key:
            raise HTTPException(
                status_code=404,
                detail="API key not found"
            )
        
        db.delete(api_key)
        db.commit()
        
        return {"message": "API key deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete API key: {str(e)}"
        )


@router.post("/{key_id}/regenerate", response_model=CreateAPIKeyResponse)
async def regenerate_api_key(
    key_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate an API key (creates a new key value but keeps the same record)"""
    try:
        api_key = db.query(APIKey).filter(
            and_(
                APIKey.id == key_id,
                APIKey.user_id == user.get("id")
            )
        ).first()
        
        if not api_key:
            raise HTTPException(
                status_code=404,
                detail="API key not found"
            )
        
        # Generate a new key
        new_api_key, new_key_hash, new_key_prefix = APIKey.generate_api_key()
        
        # Update the existing record
        api_key.key_hash = new_key_hash
        api_key.key_prefix = new_key_prefix
        api_key.last_used_at = None  # Reset last used time
        
        db.commit()
        db.refresh(api_key)
        
        # Parse scopes back for response
        scopes_list = None
        if api_key.scopes:
            scopes_list = json.loads(api_key.scopes)
        
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
            scopes=scopes_list
        )
        
        return CreateAPIKeyResponse(
            api_key=new_api_key,
            key_info=key_info
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate API key: {str(e)}"
        )
