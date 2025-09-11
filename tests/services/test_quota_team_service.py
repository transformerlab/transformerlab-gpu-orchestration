from lattice.db.db_models import Team, TeamMembership


def test_team_quota_create_update_delete_and_response(db_session):
    from lattice.services.quota.team_quota_service import (
        create_or_update_team_quota,
        delete_team_quota,
        team_quota_to_response,
    )
    from lattice.routes.quota.utils import get_or_create_quota_period, get_organization_default_quota

    org = "orgQ1"
    # Create a team and two memberships
    team = Team(name="QuotaTeam", organization_id=org, created_by="owner1")
    db_session.add(team)
    db_session.commit()
    db_session.refresh(team)

    db_session.add_all(
        [
            TeamMembership(team_id=team.id, user_id="u1", organization_id=org),
            TeamMembership(team_id=team.id, user_id="u2", organization_id=org),
        ]
    )
    db_session.commit()

    # Set team quota
    tq = create_or_update_team_quota(db_session, org, team.id, monthly_credits_per_user=123.0)
    assert tq.monthly_credits_per_user == 123.0

    # Team quota should reflect in users' current quota periods
    p1 = get_or_create_quota_period(db_session, org, "u1")
    p2 = get_or_create_quota_period(db_session, org, "u2")
    assert p1.credits_limit == 123.0
    assert p2.credits_limit == 123.0

    # Response helper includes team name
    resp = team_quota_to_response(db_session, tq)
    assert resp.team_name == "QuotaTeam"

    # Delete team quota and ensure users revert to org default
    assert delete_team_quota(db_session, org, team.id) is True
    org_default = get_organization_default_quota(db_session, org).monthly_credits_per_user
    p1b = get_or_create_quota_period(db_session, org, "u1")
    p2b = get_or_create_quota_period(db_session, org, "u2")
    assert p1b.credits_limit == org_default
    assert p2b.credits_limit == org_default
