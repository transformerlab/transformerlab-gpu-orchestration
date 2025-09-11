from __future__ import annotations

from typing import Optional

import sky
from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.db_models import TeamMembership


def get_skypilot_status(cluster_names=None):
    """Return sanitized SkyPilot status for clusters.

    Removes sensitive/large fields from the status payload.
    """
    try:
        request_id = sky.status(
            cluster_names=cluster_names, refresh=sky.StatusRefreshMode.AUTO
        )
        result = sky.get(request_id)
        result_new = result.copy()
        for cluster in result_new:
            # Delete the credentials if they exist
            if "credentials" in cluster:
                cluster["credentials"] = None
            if "last_creation_yaml" in cluster:
                cluster["last_creation_yaml"] = ""
            if "last_update_yaml" in cluster:
                cluster["last_update_yaml"] = ""
            if "handle" in cluster:
                cluster["handle"] = ""
        return result_new
    except Exception as e:
        print(f"ERROR: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )


def generate_cost_report():
    """Proxy to SkyPilot cost report via SDK."""
    request_id = sky.client.sdk.cost_report()
    cost_report = sky.get(request_id)
    return cost_report


def get_user_team_id(
    db: Session, organization_id: str, user_id: str
) -> Optional[str]:
    """Get the team ID for a user in an organization."""
    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.organization_id == organization_id,
            TeamMembership.user_id == user_id,
        )
        .first()
    )
    return membership.team_id if membership else None

