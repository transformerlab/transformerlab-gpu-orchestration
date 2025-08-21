from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from db_models import TeamQuota, Team, TeamMembership
from lattice.models import TeamQuotaResponse
from lattice.routes.quota.utils import refresh_quota_periods_for_user

def get_team_quota_by_id(db: Session, organization_id: str, team_id: str) -> Optional[TeamQuota]:
    """Get a team quota by team ID"""
    return (
        db.query(TeamQuota)
        .filter(
            TeamQuota.organization_id == organization_id,
            TeamQuota.team_id == team_id,
        )
        .first()
    )

def list_team_quotas(db: Session, organization_id: str) -> List[TeamQuota]:
    """List all team quotas for an organization"""
    return (
        db.query(TeamQuota)
        .filter(TeamQuota.organization_id == organization_id)
        .all()
    )

def create_or_update_team_quota(
    db: Session, organization_id: str, team_id: str, monthly_gpu_hours_per_user: float
) -> TeamQuota:
    """Create or update a team quota"""
    # Verify team exists
    team = db.query(Team).filter(Team.id == team_id, Team.organization_id == organization_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team_quota = get_team_quota_by_id(db, organization_id, team_id)
    
    if team_quota:
        # Update existing quota
        team_quota.monthly_gpu_hours_per_user = monthly_gpu_hours_per_user
        team_quota.updated_at = datetime.utcnow()
    else:
        # Create new quota
        team_quota = TeamQuota(
            organization_id=organization_id,
            team_id=team_id,
            monthly_gpu_hours_per_user=monthly_gpu_hours_per_user,
        )
        db.add(team_quota)
    
    db.commit()
    db.refresh(team_quota)
    
    # Refresh quota periods for all team members
    refresh_quota_periods_for_team_members(db, organization_id, team_id)
    
    return team_quota

def delete_team_quota(db: Session, organization_id: str, team_id: str) -> bool:
    """Delete a team quota"""
    team_quota = get_team_quota_by_id(db, organization_id, team_id)
    if not team_quota:
        return False
    
    db.delete(team_quota)
    db.commit()
    
    # Refresh quota periods for all team members
    refresh_quota_periods_for_team_members(db, organization_id, team_id)
    
    return True

def refresh_quota_periods_for_team_members(db: Session, organization_id: str, team_id: str) -> None:
    """Refresh quota periods for all members of a team"""
    team_members = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.organization_id == organization_id,
            TeamMembership.team_id == team_id,
        )
        .all()
    )
    
    for member in team_members:
        refresh_quota_periods_for_user(db, organization_id, member.user_id)

def team_quota_to_response(db: Session, team_quota: TeamQuota) -> TeamQuotaResponse:
    """Convert TeamQuota db model to TeamQuotaResponse"""
    team = db.query(Team).filter(Team.id == team_quota.team_id).first()
    
    return TeamQuotaResponse(
        team_id=team_quota.team_id,
        team_name=team.name if team else "Unknown Team",
        organization_id=team_quota.organization_id,
        monthly_gpu_hours_per_user=team_quota.monthly_gpu_hours_per_user,
        created_at=team_quota.created_at.isoformat(),
        updated_at=team_quota.updated_at.isoformat(),
    )
