from fastapi import HTTPException
from typing import Dict
from models import (
    OrganizationsResponse,
    Organization,
    OrganizationResponse,
    CreateOrganizationRequest,
    AddMemberRequest,
    SendInvitationRequest,
    UpdateMemberRoleRequest,
)
from routes.auth.provider.work_os import provider as auth_provider


def _is_user_admin(role) -> bool:
    """Check if a user role indicates admin status"""
    if isinstance(role, dict) and role.get("slug") == "admin":
        return True
    elif isinstance(role, str) and role == "admin":
        return True
    return False


def _count_admins_in_memberships(memberships) -> int:
    """Count the number of admin users from a list of memberships"""
    admin_count = 0
    for membership in memberships:
        if _is_user_admin(membership.role):
            admin_count += 1
    return admin_count


def list_all_organizations(user: Dict) -> OrganizationsResponse:
    """Fetches all organizations a user is a member of."""
    try:
        user_memberships = auth_provider.list_organization_memberships(
            user_id=user.get("id")
        )
        org_list = []
        for membership in user_memberships:
            try:
                organization = auth_provider.get_organization(
                    organization_id=membership.organization_id
                )
                org_list.append(
                    Organization(
                        id=organization.id,
                        name=organization.name,
                        object="organization",
                    )
                )
            except Exception:
                # If an organization can't be fetched, skip it.
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


def create_organization(
    request: CreateOrganizationRequest, user: Dict
) -> OrganizationResponse:
    """Creates a new organization and adds the creator as an admin."""
    try:
        organization = auth_provider.create_organization(
            name=request.name,
            domains=request.domains,
        )
        try:
            user_id = user.get("id")
            if not user_id:
                raise Exception("User ID is missing")
            auth_provider.create_organization_membership(
                organization_id=organization.id,
                user_id=user_id,
                role_slug="admin",
            )
        except Exception as membership_error:
            # The organization was created, but adding the user as an admin failed.
            # This is not a critical failure, but should be logged.
            print(f"Could not add creator as admin to new org: {membership_error}")
            pass

        return OrganizationResponse(
            id=organization.id, name=organization.name, domains=request.domains
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create organization: {str(e)}"
        )


def get_organization_by_id(organization_id: str) -> OrganizationResponse:
    """Retrieves a specific organization by its ID."""
    try:
        organization = auth_provider.get_organization(organization_id=organization_id)
        return OrganizationResponse(
            id=organization.id,
            name=organization.name,
            domains=None,
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Organization not found: {str(e)}")


def delete_organization(organization_id: str):
    """Deletes an organization."""
    try:
        auth_provider.delete_organization(organization_id=organization_id)
        return {"message": "Organization deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete organization: {str(e)}"
        )


def add_organization_member(organization_id: str, request: AddMemberRequest):
    """Adds a user to an organization with a specific role."""
    try:
        auth_provider.create_organization_membership(
            organization_id=organization_id,
            user_id=request.user_id,
            role_slug=request.role,
        )
        return {
            "message": f"Member added to organization successfully with role: {request.role}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to add member to organization: {str(e)}"
        )


def remove_organization_member(organization_id: str, user_id: str):
    """Removes a user from an organization, preventing removal of the last admin."""
    try:
        memberships = auth_provider.list_organization_memberships(
            organization_id=organization_id
        )

        membership_to_delete = next(
            (m for m in memberships if m.user_id == user_id), None
        )

        if not membership_to_delete:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} is not a member of organization {organization_id}",
            )

        if _is_user_admin(membership_to_delete.role):
            admin_count = _count_admins_in_memberships(memberships)
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove the last admin from the organization",
                )

        auth_provider.delete_organization_membership(
            organization_membership_id=membership_to_delete.id
        )
        return {"message": "Member removed from organization successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove member from organization: {str(e)}",
        )


def update_member_role(
    organization_id: str,
    user_id: str,
    current_user: Dict,
    request: UpdateMemberRoleRequest,
):
    """Updates a member's role, preventing demotion of the last admin."""
    try:
        memberships = auth_provider.list_organization_memberships(
            organization_id=organization_id
        )

        membership_to_update = next(
            (m for m in memberships if m.user_id == user_id), None
        )

        if not membership_to_update:
            raise HTTPException(
                status_code=404,
                detail=f"User {user_id} is not a member of organization {organization_id}",
            )

        is_currently_admin = _is_user_admin(membership_to_update.role)
        if is_currently_admin and request.role != "admin":
            admin_count = _count_admins_in_memberships(memberships)
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot change the role of the last admin in the organization",
                )

        auth_provider.update_organization_membership(
            organization_membership_id=membership_to_update.id,
            role_slug=request.role,
        )

        return {
            "message": f"Member role updated successfully to {request.role}",
            "user_id": user_id,
            "organization_id": organization_id,
            "new_role": request.role,
            "is_self_update": user_id == current_user.get("id"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update member role: {str(e)}",
        )


def list_organization_members(organization_id: str, current_user: Dict):
    """Lists all members of an organization with modification permissions."""
    try:
        memberships = auth_provider.list_organization_memberships(
            organization_id=organization_id
        )
        admin_count = _count_admins_in_memberships(memberships)
        current_user_id = current_user.get("id")
        members = []

        for membership in memberships:
            user_info = auth_provider.get_user(user_id=membership.user_id)
            is_admin = _is_user_admin(membership.role)
            can_be_modified = not (is_admin and admin_count <= 1)
            members.append(
                {
                    "user_id": membership.user_id,
                    "role": membership.role,
                    "email": user_info.email,
                    "first_name": user_info.first_name,
                    "last_name": user_info.last_name,
                    "profile_picture_url": user_info.profile_picture_url,
                    "is_current_user": membership.user_id == current_user_id,
                    "can_be_removed": can_be_modified,
                    "can_change_role": can_be_modified,
                }
            )
        return {"members": members, "admin_count": admin_count}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list organization members: {str(e)}"
        )


def send_organization_invitation(
    organization_id: str, request: SendInvitationRequest
):
    """Sends an email invitation for a user to join an organization."""
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

        invitation = auth_provider.send_invitation(**invitation_params)

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

