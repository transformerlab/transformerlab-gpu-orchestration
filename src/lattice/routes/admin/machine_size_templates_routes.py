from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import get_db
from db.db_models import MachineSizeTemplate
from models import (
    MachineSizeTemplateResponse,
    MachineSizeTemplateListResponse,
    CreateMachineSizeTemplateRequest,
    UpdateMachineSizeTemplateRequest,
)
from lattice.routes.auth.api_key_auth import enforce_csrf
from lattice.routes.auth.utils import get_current_user, requires_admin


router = APIRouter(
    prefix="/admin/machine-size-templates", tags=["admin", "machine-templates"], dependencies=[Depends(enforce_csrf)]
)


def _to_response(m: MachineSizeTemplate) -> MachineSizeTemplateResponse:
    return MachineSizeTemplateResponse(
        id=m.id,
        name=m.name,
        description=m.description,
        cloud_type=m.cloud_type,
        cloud_identifier=m.cloud_identifier,
        resources_json=m.resources_json or {},
        organization_id=m.organization_id,
        created_by=m.created_by,
        created_at=m.created_at.isoformat() if m.created_at else "",
        updated_at=m.updated_at.isoformat() if m.updated_at else "",
    )


@router.get("", response_model=MachineSizeTemplateListResponse)
async def list_templates(
    cloud_type: Optional[str] = None,
    cloud_identifier: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    __: dict = Depends(requires_admin),
):
    q = db.query(MachineSizeTemplate).filter(
        MachineSizeTemplate.organization_id == user.get("organization_id")
    )
    if cloud_type:
        q = q.filter(MachineSizeTemplate.cloud_type == cloud_type)
    if cloud_identifier is not None:
        q = q.filter(MachineSizeTemplate.cloud_identifier == cloud_identifier)
    rows: List[MachineSizeTemplate] = q.order_by(MachineSizeTemplate.updated_at.desc()).all()
    return MachineSizeTemplateListResponse(templates=[_to_response(r) for r in rows], total_count=len(rows))


@router.post("", response_model=MachineSizeTemplateResponse)
async def create_template(
    req: CreateMachineSizeTemplateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    __: dict = Depends(requires_admin),
):
    org_id = user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Missing organization context")

    # Basic validation by cloud_type
    cloud = (req.cloud_type or "").lower()
    if cloud not in ("runpod", "azure", "ssh"):
        raise HTTPException(status_code=400, detail="cloud_type must be one of: runpod, azure, ssh")
    if cloud == "ssh" and not req.cloud_identifier:
        raise HTTPException(status_code=400, detail="cloud_identifier (node pool name) is required for ssh")

    m = MachineSizeTemplate(
        name=req.name,
        description=req.description,
        cloud_type=cloud,
        cloud_identifier=req.cloud_identifier,
        resources_json=req.resources_json or {},
        organization_id=org_id,
        created_by=user.get("id"),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_response(m)


@router.get("/{template_id}", response_model=MachineSizeTemplateResponse)
async def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    __: dict = Depends(requires_admin),
):
    m = (
        db.query(MachineSizeTemplate)
        .filter(MachineSizeTemplate.id == template_id, MachineSizeTemplate.organization_id == user.get("organization_id"))
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Template not found")
    return _to_response(m)


@router.put("/{template_id}", response_model=MachineSizeTemplateResponse)
async def update_template(
    template_id: str,
    req: UpdateMachineSizeTemplateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    __: dict = Depends(requires_admin),
):
    m = (
        db.query(MachineSizeTemplate)
        .filter(MachineSizeTemplate.id == template_id, MachineSizeTemplate.organization_id == user.get("organization_id"))
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Template not found")

    if req.name is not None:
        m.name = req.name
    if req.description is not None:
        m.description = req.description
    if req.cloud_type is not None:
        cloud = (req.cloud_type or "").lower()
        if cloud not in ("runpod", "azure", "ssh"):
            raise HTTPException(status_code=400, detail="cloud_type must be one of: runpod, azure, ssh")
        m.cloud_type = cloud
    if req.cloud_identifier is not None:
        m.cloud_identifier = req.cloud_identifier
    if req.resources_json is not None:
        m.resources_json = req.resources_json

    db.commit()
    db.refresh(m)
    return _to_response(m)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    __: dict = Depends(requires_admin),
):
    m = (
        db.query(MachineSizeTemplate)
        .filter(MachineSizeTemplate.id == template_id, MachineSizeTemplate.organization_id == user.get("organization_id"))
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(m)
    db.commit()
    return {"message": "Template deleted"}


