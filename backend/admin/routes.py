from fastapi import APIRouter, Request, Response, Depends, HTTPException
from models import OrganizationsResponse, Organization
from auth.utils import get_current_user
from auth import workos_client
from typing import List, Optional
from pydantic import BaseModel


class CreateOrganizationRequest(BaseModel):
    name: str
    domains: Optional[List[str]] = None


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = None
    domains: Optional[List[str]] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    domains: Optional[List[str]] = None
    object: str = "organization"


class AddMemberRequest(BaseModel):
    user_id: str
    role: Optional[str] = "member"  # "admin" or "member"


class SendInvitationRequest(BaseModel):
    email: str
    organization_id: Optional[str] = None
    expires_in_days: Optional[int] = None
    inviter_user_id: Optional[str] = None
    role_slug: Optional[str] = None


class UpdateMemberRoleRequest(BaseModel):
    role: str  # "admin" or "member"


router = APIRouter(prefix="/admin/orgs")


@router.get("", response_model=OrganizationsResponse)
async def list_all_organizations(
    request: Request, response: Response, user=Depends(get_current_user)
):
    """Get organizations that the current user is a member of (admin endpoint)"""
    try:
        user_memberships = workos_client.user_management.list_organization_memberships(
            user_id=user.get("id")
        )
        org_list = []
        for membership in user_memberships:
            try:
                organization = workos_client.organizations.get_organization(
                    organization_id=membership.organization_id
                )
                org_list.append(
                    Organization(
                        id=organization.id,
                        name=organization.name,
                        object="organization",
                    )
                )
            except Exception as org_error:
                pass
        response_data = {
            "organizations": org_list,
            "current_organization_id": user.get("organization_id"),
        }
        return OrganizationsResponse(**response_data)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch organizations: {str(e)}"
        )


@router.post("", response_model=OrganizationResponse)
async def create_organization(
    request: CreateOrganizationRequest, user=Depends(get_current_user)
):
    """Create a new organization (admin endpoint)"""
    try:
        org_params = {"name": request.name}

        if request.domains:
            domain_data = []
            for domain in request.domains:
                domain_data.append(
                    {
                        "domain": domain,
                        "state": "pending",
                    }
                )
            org_params["domain_data"] = domain_data

        organization = workos_client.organizations.create_organization(**org_params)
        try:
            if not user.get("id"):
                raise Exception("User ID is missing")

            membership = workos_client.user_management.create_organization_membership(
                organization_id=organization.id,
                user_id=user.get("id"),
                role_slug="admin",
            )
        except Exception as membership_error:
            pass

        response = OrganizationResponse(
            id=organization.id, name=organization.name, domains=request.domains
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create organization: {str(e)}"
        )


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(organization_id: str, user=Depends(get_current_user)):
    """Get a specific organization by ID (admin endpoint)"""
    try:
        organization = workos_client.organizations.get_organization(
            organization_id=organization_id
        )
        return OrganizationResponse(
            id=organization.id,
            name=organization.name,
            domains=None,
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Organization not found: {str(e)}")


@router.delete("/{organization_id}")
async def delete_organization(organization_id: str, user=Depends(get_current_user)):
    """Delete an organization (admin endpoint)"""
    try:
        workos_client.organizations.delete_organization(organization_id=organization_id)
        return {"message": "Organization deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete organization: {str(e)}"
        )


@router.post("/{organization_id}/members")
async def add_organization_member(
    organization_id: str,
    request: AddMemberRequest,
    user=Depends(get_current_user),
):
    """Add a member to an organization with specified role (admin endpoint)"""
    try:
        workos_client.user_management.create_organization_membership(
            organization_id=organization_id, user_id=request.user_id, role=request.role
        )
        return {
            "message": f"Member added to organization successfully with role: {request.role}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to add member to organization: {str(e)}"
        )


@router.delete("/{organization_id}/members/{user_id}")
async def remove_organization_member(
    organization_id: str, user_id: str, user=Depends(get_current_user)
):
    """Remove a member from an organization (admin endpoint)"""
    try:
        # First, get the organization membership to find the membership ID
        memberships = workos_client.user_management.list_organization_memberships(
            organization_id=organization_id
        )

        # Find the membership for the specific user
        membership_id = None
        for membership in memberships:
            if membership.user_id == user_id:
                membership_id = membership.id
                break

        if not membership_id:
            print(f"User {user_id} is not a member of organization {organization_id}")
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} is not a member of organization {organization_id}",
            )

        workos_client.user_management.delete_organization_membership(
            organization_membership_id=membership_id
        )
        return {"message": "Member removed from organization successfully"}
    except Exception as e:
        print(f"Error removing member from organization: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove member from organization: {str(e)}",
        )


@router.put("/{organization_id}/members/{user_id}/role")
async def update_member_role(
    organization_id: str,
    user_id: str,
    request: UpdateMemberRoleRequest,
    user=Depends(get_current_user),
):
    """Update a member's role in an organization (admin endpoint)"""
    try:
        # First, get the organization membership to find the membership ID
        memberships = workos_client.user_management.list_organization_memberships(
            organization_id=organization_id
        )

        # Find the membership for the specific user
        membership_id = None
        for membership in memberships:
            if membership.user_id == user_id:
                membership_id = membership.id
                break

        if not membership_id:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} is not a member of organization {organization_id}",
            )

        # Update the membership role
        workos_client.user_management.update_organization_membership(
            organization_membership_id=membership_id,
            role_slug=request.role
        )
        
        return {
            "message": f"Member role updated successfully to {request.role}",
            "user_id": user_id,
            "organization_id": organization_id,
            "new_role": request.role
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update member role: {str(e)}",
        )


@router.get("/{organization_id}/members")
async def list_organization_members(
    organization_id: str, user=Depends(get_current_user)
):
    """List all members of an organization (admin endpoint)"""
    try:
        memberships = workos_client.user_management.list_organization_memberships(
            organization_id=organization_id
        )
        members = []
        for membership in memberships:
            user_info = workos_client.user_management.get_user(
                user_id=membership.user_id
            )
            members.append(
                {
                    "user_id": membership.user_id,
                    "role": membership.role,
                    "email": user_info.email,
                    "first_name": user_info.first_name,
                    "last_name": user_info.last_name,
                    "profile_picture_url": user_info.profile_picture_url,
                }
            )
        return {"members": members}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list organization members: {str(e)}"
        )


@router.post("/{organization_id}/invitations")
async def send_organization_invitation(
    organization_id: str,
    request: SendInvitationRequest,
    user=Depends(get_current_user),
):
    """Send an invitation to a user to join an organization (admin endpoint)"""
    try:
        invitation_params = {
            "email": request.email,
            "organization_id": organization_id,
        }

        if request.expires_in_days is not None:
            invitation_params["expires_in_days"] = request.expires_in_days
        if request.inviter_user_id is not None:
            invitation_params["inviter_user_id"] = request.inviter_user_id
        if request.role_slug is not None:
            invitation_params["role_slug"] = request.role_slug

        invitation = workos_client.user_management.send_invitation(**invitation_params)
        print(invitation)
        return {
            "message": f"Invitation sent successfully to {request.email}",
            "invitation_id": invitation.id,
            "email": invitation.email,
            "organization_id": invitation.organization_id,
            "state": invitation.state,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to send invitation: {str(e)}"
        )
