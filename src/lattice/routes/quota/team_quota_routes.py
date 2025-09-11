from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from config import get_db
from db.db_models import Team
from lattice.models import TeamQuotaRequest, TeamQuotaResponse, TeamQuotaListResponse
from lattice.services.admin.teams_service import list_teams
from lattice.routes.auth.utils import (
    check_organization_admin,
    check_organization_member,
)
from lattice.services.quota.team_quota_service import (
    list_team_quotas,
    get_team_quota_by_id,
    create_or_update_team_quota,
    delete_team_quota,
    team_quota_to_response,
)
from lattice.routes.quota.utils import get_organization_default_quota
from lattice.routes.auth.api_key_auth import enforce_csrf

router = APIRouter(dependencies=[Depends(enforce_csrf)])


@router.get(
    "/organization/{organization_id}/teams/quotas",
    response_model=TeamQuotaListResponse,
    summary="List Team Quotas",
    description="List all team quotas for the organization",
)
async def list_all_team_quotas(
    organization_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_admin),
):
    """List all team quotas for the organization"""
    # Get all teams in the organization
    teams_response = list_teams(db, organization_id)

    # Get all team quotas
    team_quotas = list_team_quotas(db, organization_id)

    # Create a lookup dictionary for easier access
    quota_map = {quota.team_id: quota for quota in team_quotas}

    # Get organization default quota
    org_quota = get_organization_default_quota(db, organization_id)

    # Build response objects
    team_quota_responses = []
    for team in teams_response.teams:
        if team.id in quota_map:
            # Team has a quota set
            team_quota_responses.append(team_quota_to_response(db, quota_map[team.id]))
        else:
            # Team uses organization default
            team_quota_responses.append(
                TeamQuotaResponse(
                    team_id=team.id,
                    team_name=team.name,
                    organization_id=organization_id,
                    monthly_credits_per_user=org_quota.monthly_credits_per_user,
                    created_at=org_quota.created_at.isoformat(),
                    updated_at=org_quota.updated_at.isoformat(),
                )
            )

    return TeamQuotaListResponse(
        organization_id=organization_id,
        teams=team_quota_responses,
        default_quota_per_user=org_quota.monthly_credits_per_user,
    )


@router.get(
    "/organization/{organization_id}/teams/{team_id}/quota",
    response_model=TeamQuotaResponse,
    summary="Get Team Quota",
    description="Get quota for a specific team",
)
async def get_team_quota_endpoint(
    organization_id: str,
    team_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_member),
):
    """Get quota for a specific team"""
    # Check if team exists
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == organization_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Get team quota or use organization default
    team_quota = get_team_quota_by_id(db, organization_id, team_id)

    if team_quota:
        return team_quota_to_response(db, team_quota)
    else:
        # Return using organization default
        org_quota = get_organization_default_quota(db, organization_id)

        return TeamQuotaResponse(
            team_id=team_id,
            team_name=team.name,
            organization_id=organization_id,
            monthly_credits_per_user=org_quota.monthly_credits_per_user,
            created_at=org_quota.created_at.isoformat(),
            updated_at=org_quota.updated_at.isoformat(),
        )


@router.put(
    "/organization/{organization_id}/teams/{team_id}/quota",
    response_model=TeamQuotaResponse,
    summary="Update Team Quota",
    description="Create or update quota for a specific team",
)
async def update_team_quota_endpoint(
    organization_id: str,
    team_id: str,
    quota_request: TeamQuotaRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_admin),
):
    """Create or update quota for a specific team"""
    # Create or update team quota
    team_quota = create_or_update_team_quota(
        db, organization_id, team_id, quota_request.monthly_credits_per_user
    )

    return team_quota_to_response(db, team_quota)


@router.delete(
    "/organization/{organization_id}/teams/{team_id}/quota",
    status_code=204,
    summary="Delete Team Quota",
    description="Delete quota for a specific team",
)
async def delete_team_quota_endpoint(
    organization_id: str,
    team_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_admin),
):
    """Delete quota for a specific team"""
    success = delete_team_quota(db, organization_id, team_id)

    if not success:
        raise HTTPException(status_code=404, detail="Team quota not found")

    return Response(status_code=204)
