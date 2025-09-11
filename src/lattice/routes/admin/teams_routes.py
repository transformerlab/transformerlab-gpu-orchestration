from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import List

from config import get_db
from models import (
    TeamResponse,
    TeamListResponse,
    CreateTeamRequest,
    UpdateTeamRequest,
    TeamMemberResponse,
    AddTeamMemberRequest,
    AvailableUsersResponse,
)
from routes.auth.utils import get_current_user, requires_admin
<<<<<<< Updated upstream
<<<<<<< Updated upstream
from lattice.routes.auth.api_key_auth import enforce_csrf
from lattice.services.admin.teams_service import (
=======
=======
>>>>>>> Stashed changes
from routes.auth.api_key_auth import enforce_csrf
from .teams_service import (
>>>>>>> Stashed changes
    list_teams as svc_list_teams,
    create_team as svc_create_team,
    update_team as svc_update_team,
    delete_team as svc_delete_team,
    list_team_members as svc_list_team_members,
    add_team_member as svc_add_team_member,
    get_user_team as svc_get_user_team,
    remove_team_member as svc_remove_team_member,
    list_available_users as svc_list_available_users,
)


router = APIRouter(prefix="/admin/teams", tags=["admin"], dependencies=[Depends(enforce_csrf)])


@router.get("/", response_model=TeamListResponse)
async def list_teams(
    request: Request, response: Response, db: Session = Depends(get_db)
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_list_teams(db, org_id)


# Allow both '/admin/teams' and '/admin/teams/' for GET
@router.get("", response_model=TeamListResponse)
async def list_teams_no_slash(
    request: Request, response: Response, db: Session = Depends(get_db)
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_list_teams(db, org_id)


@router.post("/", response_model=TeamResponse)
async def create_team(
    team_req: CreateTeamRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    user_info = get_current_user(request, response)
    user_id = user_info.get("id")
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_create_team(db, org_id, user_id, team_req)


# Allow both '/admin/teams' and '/admin/teams/' for POST
@router.post("", response_model=TeamResponse)
async def create_team_no_slash(
    team_req: CreateTeamRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    user_info = get_current_user(request, response)
    user_id = user_info.get("id")
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_create_team(db, org_id, user_id, team_req)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: str,
    team_req: UpdateTeamRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_update_team(db, org_id, team_id, team_req)


@router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    svc_delete_team(db, org_id, team_id)
    return {"message": "Team deleted"}


@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: str, request: Request, response: Response, db: Session = Depends(get_db)
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_list_team_members(db, org_id, team_id)


@router.post("/{team_id}/members", response_model=List[TeamMemberResponse])
async def add_team_member(
    team_id: str,
    body: AddTeamMemberRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    members = svc_add_team_member(db, org_id, team_id, body)
    return members


@router.get("/user/{user_id}/team", response_model=TeamResponse)
async def get_user_team(
    user_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Get the team that a user is currently in (if any)."""
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_get_user_team(db, org_id, user_id)


@router.get("/current-user/team", response_model=TeamResponse)
async def get_current_user_team(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Get the team that the current user is in (if any)."""
    user_info = get_current_user(request, response)
    user_id = user_info.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")

    return await get_user_team(user_id, request, response, db)


@router.delete("/{team_id}/members/{user_id}", response_model=List[TeamMemberResponse])
async def remove_team_member(
    team_id: str,
    user_id: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    members = svc_remove_team_member(db, org_id, team_id, user_id)
    return members


@router.get("/available-users", response_model=AvailableUsersResponse)
async def list_available_users(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    """List users in the current organization to add to teams.
    Uses the auth provider's organization memberships to identify users.
    """
    user_info = get_current_user(request, response)
    org_id = user_info.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    return svc_list_available_users(db, org_id)
