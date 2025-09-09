from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import os
import secrets

from db.db_models import LaunchHook, LaunchHookFile
from routes.auth.utils import get_current_user, requires_admin
from routes.auth.api_key_auth import enforce_csrf
from config import UPLOADS_DIR, get_db

router = APIRouter(prefix="/admin/launch-hooks", tags=["admin", "launch-hooks"], dependencies=[Depends(enforce_csrf)])

# Create hooks directory if it doesn't exist
HOOKS_DIR = UPLOADS_DIR / "hooks"
HOOKS_DIR.mkdir(exist_ok=True)


@router.get("")
async def list_launch_hooks(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """List all launch hooks for the organization"""
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID not found")
    
    hooks = db.query(LaunchHook).filter(
        LaunchHook.organization_id == org_id
    ).all()
    
    result = []
    for hook in hooks:
        # Get files for this hook
        files = db.query(LaunchHookFile).filter(
            LaunchHookFile.launch_hook_id == hook.id
        ).all()
        
        result.append({
            "id": hook.id,
            "name": hook.name,
            "description": hook.description,
            "setup_commands": hook.setup_commands,
            "is_active": hook.is_active,
            "created_at": hook.created_at,
            "updated_at": hook.updated_at,
            "files": [
                {
                    "id": file.id,
                    "original_filename": file.original_filename,
                    "file_size": file.file_size,
                    "created_at": file.created_at,
                }
                for file in files
            ]
        })
    
    return {"hooks": result}


@router.post("")
async def create_launch_hook(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    setup_commands: Optional[str] = Form(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Create a new launch hook"""
    org_id = user.get("organization_id")
    user_id = user.get("id")
    
    if not org_id or not user_id:
        raise HTTPException(status_code=400, detail="User or organization ID not found")
    
    # Check if hook name already exists
    existing_hook = db.query(LaunchHook).filter(
        LaunchHook.organization_id == org_id,
        LaunchHook.name == name,
        LaunchHook.is_active == True # noqa: E712
    ).first()
    
    if existing_hook:
        raise HTTPException(status_code=400, detail=f"Launch hook with name '{name}' already exists")
    
    # Create new hook
    hook = LaunchHook(
        organization_id=org_id,
        user_id=user_id,
        name=name,
        description=description,
        setup_commands=setup_commands,
    )
    
    db.add(hook)
    db.commit()
    db.refresh(hook)
    
    return {
        "id": hook.id,
        "name": hook.name,
        "description": hook.description,
        "setup_commands": hook.setup_commands,
        "is_active": hook.is_active,
        "created_at": hook.created_at,
        "updated_at": hook.updated_at,
        "files": []
    }


@router.get("/{hook_id}")
async def get_launch_hook(
    hook_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Get a specific launch hook by ID"""
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID not found")
    
    hook = db.query(LaunchHook).filter(
        LaunchHook.id == hook_id,
        LaunchHook.organization_id == org_id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Launch hook not found")
    
    # Get files for this hook
    files = db.query(LaunchHookFile).filter(
        LaunchHookFile.launch_hook_id == hook.id
    ).all()
    
    return {
        "id": hook.id,
        "name": hook.name,
        "description": hook.description,
        "setup_commands": hook.setup_commands,
        "is_active": hook.is_active,
        "created_at": hook.created_at,
        "updated_at": hook.updated_at,
        "files": [
            {
                "id": file.id,
                "original_filename": file.original_filename,
                "file_size": file.file_size,
                "created_at": file.created_at,
            }
            for file in files
        ]
    }


@router.put("/{hook_id}")
async def update_launch_hook(
    hook_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    setup_commands: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Update a launch hook"""
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID not found")
    
    hook = db.query(LaunchHook).filter(
        LaunchHook.id == hook_id,
        LaunchHook.organization_id == org_id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Launch hook not found")
    
    # Check if new name conflicts with existing hooks
    if name and name != hook.name:
        existing_hook = db.query(LaunchHook).filter(
            LaunchHook.organization_id == org_id,
            LaunchHook.name == name,
            LaunchHook.id != hook_id,
            LaunchHook.is_active == True # noqa: E712
        ).first()
        
        if existing_hook:
            raise HTTPException(status_code=400, detail=f"Launch hook with name '{name}' already exists")
    
    # Update fields
    if name is not None:
        hook.name = name
    if description is not None:
        hook.description = description
    if setup_commands is not None:
        hook.setup_commands = setup_commands
    if is_active is not None:
        hook.is_active = is_active
    
    db.commit()
    db.refresh(hook)
    
    return {
        "id": hook.id,
        "name": hook.name,
        "description": hook.description,
        "setup_commands": hook.setup_commands,
        "is_active": hook.is_active,
        "created_at": hook.created_at,
        "updated_at": hook.updated_at,
    }


@router.delete("/{hook_id}")
async def delete_launch_hook(
    hook_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Delete a launch hook and all its files"""
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID not found")
    
    hook = db.query(LaunchHook).filter(
        LaunchHook.id == hook_id,
        LaunchHook.organization_id == org_id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Launch hook not found")
    
    # Get all files for this hook
    files = db.query(LaunchHookFile).filter(
        LaunchHookFile.launch_hook_id == hook_id
    ).all()
    
    # Delete physical files
    for file in files:
        if os.path.exists(file.file_path):
            try:
                os.remove(file.file_path)
            except Exception as e:
                print(f"Warning: Failed to delete file {file.file_path}: {e}")
    
    # Delete database records
    for file in files:
        db.delete(file)
    
    db.delete(hook)
    db.commit()
    
    return {"message": "Launch hook deleted successfully"}


@router.post("/{hook_id}/files")
async def upload_hook_file(
    hook_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Upload a file to a launch hook"""
    org_id = user.get("organization_id")
    user_id = user.get("id")
    
    if not org_id or not user_id:
        raise HTTPException(status_code=400, detail="User or organization ID not found")
    
    # Verify hook exists and belongs to organization
    hook = db.query(LaunchHook).filter(
        LaunchHook.id == hook_id,
        LaunchHook.organization_id == org_id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Launch hook not found")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check if file with same name already exists for this hook
    existing_file = db.query(LaunchHookFile).filter(
        LaunchHookFile.launch_hook_id == hook_id,
        LaunchHookFile.original_filename == file.filename,
        LaunchHookFile.is_active == True # noqa: E712
    ).first()
    
    if existing_file:
        raise HTTPException(status_code=400, detail=f"File '{file.filename}' already exists for this hook")
    
    # Create unique filename with UUID prefix
    file_id = secrets.token_urlsafe(16)
    unique_filename = f"{file_id}_{file.filename}"
    
    # Create hook-specific directory
    hook_dir = HOOKS_DIR / hook_id
    hook_dir.mkdir(exist_ok=True)
    
    # Save file
    file_path = hook_dir / unique_filename
    file_content = await file.read()
    
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Save to database
    hook_file = LaunchHookFile(
        launch_hook_id=hook_id,
        organization_id=org_id,
        user_id=user_id,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=len(file_content),
    )
    
    db.add(hook_file)
    db.commit()
    db.refresh(hook_file)
    
    return {
        "id": hook_file.id,
        "original_filename": hook_file.original_filename,
        "file_size": hook_file.file_size,
        "created_at": hook_file.created_at,
    }


@router.delete("/{hook_id}/files/{file_id}")
async def delete_hook_file(
    hook_id: str,
    file_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Delete a file from a launch hook"""
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID not found")
    
    # Verify hook exists and belongs to organization
    hook = db.query(LaunchHook).filter(
        LaunchHook.id == hook_id,
        LaunchHook.organization_id == org_id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Launch hook not found")
    
    # Find the file
    hook_file = db.query(LaunchHookFile).filter(
        LaunchHookFile.id == file_id,
        LaunchHookFile.launch_hook_id == hook_id
    ).first()
    
    if not hook_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete physical file
    if os.path.exists(hook_file.file_path):
        try:
            os.remove(hook_file.file_path)
        except Exception as e:
            print(f"Warning: Failed to delete file {hook_file.file_path}: {e}")
    
    # Delete database record
    db.delete(hook_file)
    db.commit()
    
    return {"message": "File deleted successfully"}


@router.get("/{hook_id}/files/{file_id}/download")
async def download_hook_file(
    hook_id: str,
    file_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(requires_admin),
):
    """Download a file from a launch hook"""
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID not found")
    
    # Verify hook exists and belongs to organization
    hook = db.query(LaunchHook).filter(
        LaunchHook.id == hook_id,
        LaunchHook.organization_id == org_id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Launch hook not found")
    
    # Find the file
    hook_file = db.query(LaunchHookFile).filter(
        LaunchHookFile.id == file_id,
        LaunchHookFile.launch_hook_id == hook_id
    ).first()
    
    if not hook_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not os.path.exists(hook_file.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=hook_file.file_path,
        filename=hook_file.original_filename,
        media_type='application/octet-stream'
    )
