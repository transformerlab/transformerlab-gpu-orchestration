import types
import pytest


class _User:
    def __init__(self, id, email=None, first_name=None, last_name=None, profile_picture_url=None):
        self.id = id
        self.email = email or f"{id}@ex.com"
        self.first_name = first_name or "F"
        self.last_name = last_name or "L"
        self.profile_picture_url = profile_picture_url


class FakeProvider:
    def get_user(self, user_id):
        return _User(user_id)

    def get_users(self, user_ids):
        return [_User(uid) for uid in user_ids]

    def list_organization_memberships(self, organization_id):
        # Simulate three org users
        def M(uid):
            return types.SimpleNamespace(user_id=uid)
        return [M("u100"), M("u200"), M("u300")]


@pytest.fixture()
def monkeypatched_team_provider(monkeypatch):
    from lattice.services.admin import teams_service

    fp = FakeProvider()
    monkeypatch.setattr(teams_service, "auth_provider", fp)
    return fp


def test_team_crud_and_memberships(db_session, monkeypatched_team_provider):
    from lattice.services.admin.teams_service import (
        create_team,
        list_teams,
        add_team_member,
        list_team_members,
        remove_team_member,
        get_user_team,
        update_team,
        list_available_users,
    )
    from lattice.models import CreateTeamRequest, AddTeamMemberRequest, UpdateTeamRequest

    org = "orgT1"
    creator = "creator1"

    # Create
    t = create_team(db_session, org, creator, CreateTeamRequest(name="Alpha"))
    assert t.name == "Alpha"
    assert t.organization_id == org
    team_id = t.id

    # List
    lst = list_teams(db_session, org)
    assert lst.total_count == 1

    # Add member
    members = add_team_member(db_session, org, team_id, AddTeamMemberRequest(user_id="u100"))
    assert any(m.user_id == "u100" for m in members)

    # List members (details pulled from provider)
    members = list_team_members(db_session, org, team_id)
    assert members[0].email.endswith("@ex.com")

    # Get user's team
    user_team = get_user_team(db_session, org, "u100")
    assert user_team.id == team_id

    # Available users should include u100 with has_team True and others False
    av = list_available_users(db_session, org)
    by_id = {u.user_id: u for u in av.users}
    assert by_id["u100"].has_team is True
    assert by_id["u200"].has_team is False

    # Update team name
    t2 = update_team(db_session, org, team_id, UpdateTeamRequest(name="Alpha2"))
    assert t2.name == "Alpha2"

    # Remove member
    members = remove_team_member(db_session, org, team_id, "u100")
    assert all(m.user_id != "u100" for m in members)
