from fastapi import APIRouter, Depends
from models import (
    OrganizationsResponse,
    OrganizationResponse,
    CreateOrganizationRequest,
    AddMemberRequest,
    SendInvitationRequest,
    UpdateMemberRoleRequest,
)
from routes.auth.utils import (
    get_current_user,
    check_organization_admin,
    check_organization_member,
)
<<<<<<< Updated upstream
<<<<<<< Updated upstream
from lattice.services.admin import admin_service as svc
from lattice.routes.auth.api_key_auth import enforce_csrf
=======
from . import admin_service as svc
from routes.auth.api_key_auth import enforce_csrf
>>>>>>> Stashed changes
=======
from . import admin_service as svc
from routes.auth.api_key_auth import enforce_csrf
>>>>>>> Stashed changes

router = APIRouter(prefix="/admin/orgs", tags=["admin"], dependencies=[Depends(enforce_csrf)])


@router.get("", response_model=OrganizationsResponse)
async def list_all_organizations(user=Depends(get_current_user)):
    """Get organizations that the current user is a member of (admin endpoint)"""
    return svc.list_all_organizations(user=user)


@router.post("", response_model=OrganizationResponse)
async def create_organization(
    request: CreateOrganizationRequest, user=Depends(get_current_user)
):
    """Create a new organization (admin endpoint)"""
    return svc.create_organization(request=request, user=user)


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: str,
    user=Depends(get_current_user),
    _: dict = Depends(check_organization_member),
):
    """Get a specific organization by ID (admin endpoint)"""
    return svc.get_organization_by_id(organization_id=organization_id)


@router.delete("/{organization_id}")
async def delete_organization(
    organization_id: str,
    user=Depends(get_current_user),
    __: dict = Depends(check_organization_admin),
):
    """Delete an organization (admin endpoint)"""
    return svc.delete_organization(organization_id=organization_id)


@router.post("/{organization_id}/members")
async def add_organization_member(
    organization_id: str,
    request: AddMemberRequest,
    user=Depends(get_current_user),
    __: dict = Depends(check_organization_admin),
):
    """Add a member to an organization with specified role (admin endpoint)"""
    return svc.add_organization_member(organization_id=organization_id, request=request)


@router.delete("/{organization_id}/members/{user_id}")
async def remove_organization_member(
    organization_id: str,
    user_id: str,
    user=Depends(get_current_user),
    __: dict = Depends(check_organization_admin),
):
    """Remove a member from an organization (admin endpoint)"""
    return svc.remove_organization_member(
        organization_id=organization_id, user_id=user_id
    )


@router.put("/{organization_id}/members/{user_id}/role")
async def update_member_role(
    organization_id: str,
    user_id: str,
    request: UpdateMemberRoleRequest,
    user=Depends(get_current_user),
    __: dict = Depends(check_organization_admin),
):
    """Update a member's role in an organization (admin endpoint)"""
    return svc.update_member_role(
        organization_id=organization_id,
        user_id=user_id,
        current_user=user,
        request=request,
    )


@router.get("/{organization_id}/members")
async def list_organization_members(
    organization_id: str,
    user=Depends(get_current_user),
    __: dict = Depends(check_organization_admin),
):
    """List all members of an organization (admin endpoint)"""
    return svc.list_organization_members(
        organization_id=organization_id, current_user=user
    )


@router.post("/{organization_id}/invitations")
async def send_organization_invitation(
    organization_id: str,
    request: SendInvitationRequest,
    user=Depends(get_current_user),
    __: dict = Depends(check_organization_admin),
):
    """Send an invitation to a user to join an organization (admin endpoint)"""
    return svc.send_organization_invitation(
        organization_id=organization_id, request=request
    )
