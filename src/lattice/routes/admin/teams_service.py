from typing import List, Dict
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from db_models import Team, TeamMembership
from models import (
    TeamResponse,
    TeamListResponse,
    CreateTeamRequest,
    UpdateTeamRequest,
    TeamMemberResponse,
    AddTeamMemberRequest,
    AvailableUsersResponse,
    AvailableUser,
)
from routes.auth.provider.work_os import provider as auth_provider


def _team_to_response(db: Session, team: Team) -> TeamResponse:
    memberships = db.query(TeamMembership).filter(TeamMembership.team_id == team.id).all()

    # Batch fetch user profiles to avoid N sequential external calls
    user_ids = [m.user_id for m in memberships]
    users_by_id: Dict[str, any] = {}
    if user_ids:
        try:
            users = auth_provider.get_users(user_ids=user_ids)
            users_by_id = {u.id: u for u in users}
        except Exception:
            users_by_id = {}

    members: List[TeamMemberResponse] = []
    for m in memberships:
        u = users_by_id.get(m.user_id)
        if u is not None:
            members.append(
                TeamMemberResponse(
                    user_id=m.user_id,
                    email=u.email,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    profile_picture_url=getattr(u, "profile_picture_url", None),
                )
            )
        else:
            members.append(TeamMemberResponse(user_id=m.user_id))

    return TeamResponse(
        id=team.id,
        name=team.name,
        organization_id=team.organization_id,
        created_by=team.created_by,
        created_at=team.created_at.isoformat(),
        updated_at=team.updated_at.isoformat(),
        members=members,
    )


def list_teams(db: Session, organization_id: str) -> TeamListResponse:
    teams = db.query(Team).filter(Team.organization_id == organization_id).all()
    team_responses = [_team_to_response(db, t) for t in teams]
    return TeamListResponse(teams=team_responses, total_count=len(team_responses))


def create_team(db: Session, organization_id: str, created_by_user_id: str, team_req: CreateTeamRequest) -> TeamResponse:
    # Ensure unique team name within organization
    existing = (
        db.query(Team)
        .filter(Team.organization_id == organization_id, Team.name == team_req.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Team name already exists")

    team = Team(name=team_req.name, organization_id=organization_id, created_by=created_by_user_id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return _team_to_response(db, team)


def update_team(db: Session, organization_id: str, team_id: str, team_req: UpdateTeamRequest) -> TeamResponse:
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == organization_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team_req.name and team_req.name != team.name:
        conflict = (
            db.query(Team)
            .filter(Team.organization_id == organization_id, Team.name == team_req.name, Team.id != team_id)
            .first()
        )
        if conflict:
            raise HTTPException(status_code=400, detail="Team name already exists")
        team.name = team_req.name

    team.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(team)
    return _team_to_response(db, team)


def delete_team(db: Session, organization_id: str, team_id: str) -> None:
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == organization_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    db.delete(team)
    db.commit()


def list_team_members(db: Session, organization_id: str, team_id: str) -> List[TeamMemberResponse]:
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == organization_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    memberships = db.query(TeamMembership).filter(TeamMembership.team_id == team_id).all()

    # Batch fetch user profiles
    user_ids = [m.user_id for m in memberships]
    users_by_id: Dict[str, any] = {}
    if user_ids:
        try:
            users = auth_provider.get_users(user_ids=user_ids)
            users_by_id = {u.id: u for u in users}
        except Exception:
            users_by_id = {}

    members: List[TeamMemberResponse] = []
    for m in memberships:
        u = users_by_id.get(m.user_id)
        if u is not None:
            members.append(
                TeamMemberResponse(
                    user_id=m.user_id,
                    email=u.email,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    profile_picture_url=getattr(u, "profile_picture_url", None),
                )
            )
        else:
            members.append(TeamMemberResponse(user_id=m.user_id))
    return members


def add_team_member(db: Session, organization_id: str, team_id: str, body: AddTeamMemberRequest) -> List[TeamMemberResponse]:
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == organization_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Ensure user exists (in auth provider) and is member of org
    try:
        _ = auth_provider.get_user(user_id=body.user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    membership = TeamMembership(
        team_id=team_id,
        user_id=body.user_id,
        organization_id=team.organization_id,
    )
    db.add(membership)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()

        existing_membership = (
            db.query(TeamMembership)
            .filter(TeamMembership.user_id == body.user_id)
            .first()
        )
        if existing_membership:
            existing_team = db.query(Team).filter(Team.id == existing_membership.team_id).first()
            team_name = existing_team.name if existing_team else "another team"
            raise HTTPException(
                status_code=400,
                detail=f"User is already a member of '{team_name}'. Users can only be in one team at a time.",
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="User is already a member of another team. Users can only be in one team at a time.",
            )

    return list_team_members(db, organization_id, team_id)


def get_user_team(db: Session, organization_id: str, user_id: str) -> TeamResponse:
    membership = (
        db.query(TeamMembership)
        .filter(TeamMembership.user_id == user_id)
        .first()
    )

    if not membership:
        raise HTTPException(status_code=404, detail="User is not in any team")

    team = (
        db.query(Team)
        .filter(Team.id == membership.team_id, Team.organization_id == organization_id)
        .first()
    )

    if not team:
        raise HTTPException(status_code=404, detail="Team not found or not in your organization")

    return _team_to_response(db, team)


def remove_team_member(db: Session, organization_id: str, team_id: str, user_id: str) -> List[TeamMemberResponse]:
    team = (
        db.query(Team)
        .filter(Team.id == team_id, Team.organization_id == organization_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    db.query(TeamMembership).filter(
        TeamMembership.team_id == team_id, TeamMembership.user_id == user_id
    ).delete()
    db.commit()

    return list_team_members(db, organization_id, team_id)


def list_available_users(db: Session, organization_id: str) -> AvailableUsersResponse:
    memberships = auth_provider.list_organization_memberships(organization_id=organization_id)

    existing_team_memberships = (
        db.query(TeamMembership)
        .join(Team, TeamMembership.team_id == Team.id)
        .filter(Team.organization_id == organization_id)
        .all()
    )
    users_with_teams = {membership.user_id for membership in existing_team_memberships}

    # Batch fetch user details for org memberships
    member_user_ids = [m.user_id for m in memberships]
    users_by_id: Dict[str, any] = {}
    if member_user_ids:
        try:
            users = auth_provider.get_users(user_ids=member_user_ids)
            users_by_id = {u.id: u for u in users}
        except Exception:
            users_by_id = {}

    users: List[AvailableUser] = []
    for m in memberships:
        u = users_by_id.get(m.user_id)
        if u is not None:
            users.append(
                AvailableUser(
                    user_id=u.id,
                    email=u.email,
                    first_name=u.first_name,
                    last_name=u.last_name,
                    profile_picture_url=getattr(u, "profile_picture_url", None),
                    has_team=u.id in users_with_teams,
                )
            )
        else:
            users.append(
                AvailableUser(
                    user_id=m.user_id,
                    has_team=m.user_id in users_with_teams,
                )
            )

    return AvailableUsersResponse(users=users)
