import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from config import get_db
from db_models import (
    GPUUsageLog,
    OrganizationQuota,
    QuotaPeriod,
    TeamQuota,
    TeamMembership,
)
from lattice.utils.cluster_utils import get_cluster_platform_info
from lattice.routes.skypilot.utils import generate_cost_report
import sky


def parse_resources_string(resources_str: str) -> Dict[str, Any]:
    """
    Parse a SkyPilot resources string like "1x(cpus=2, mem=4, gpu=V100:1, disk=10)"
    Returns parsed resources including GPU count and type
    """
    if not resources_str or not isinstance(resources_str, str):
        return {"gpu_count": 0, "gpu_type": None, "cpus": 0, "memory": 0}

    try:
        # Extract the count and the resource specifications
        match = re.match(r"^(\d+)x\((.+)\)$", resources_str)
        if not match:
            return {"gpu_count": 0, "gpu_type": None, "cpus": 0, "memory": 0}

        count = int(match.group(1))
        resource_specs = match.group(2)

        # Parse individual resource specifications
        specs = [s.strip() for s in resource_specs.split(",")]
        parsed = {
            "count": count,
            "gpu_count": 0,
            "gpu_type": None,
            "cpus": 0,
            "memory": 0,
        }

        for spec in specs:
            if spec.startswith("cpus="):
                parsed["cpus"] = int(spec.replace("cpus=", ""))
            elif spec.startswith("mem="):
                parsed["memory"] = int(spec.replace("mem=", ""))
            elif spec.startswith("gpu="):
                gpu_spec = spec.replace("gpu=", "")
                # Handle formats like "V100:1" or just "V100"
                if ":" in gpu_spec:
                    gpu_type, gpu_count = gpu_spec.split(":")
                    parsed["gpu_type"] = gpu_type
                    parsed["gpu_count"] = (
                        int(gpu_count) * count
                    )  # Multiply by node count
                else:
                    parsed["gpu_type"] = gpu_spec
                    parsed["gpu_count"] = count  # Assume 1 GPU per node
            elif spec.startswith("gpus="):
                gpu_spec = spec.replace("gpus=", "")
                if ":" in gpu_spec:
                    gpu_type, gpu_count = gpu_spec.split(":")
                    parsed["gpu_type"] = gpu_type
                    parsed["gpu_count"] = int(gpu_count) * count
                else:
                    parsed["gpu_type"] = gpu_spec
                    parsed["gpu_count"] = count

        return parsed
    except Exception as e:
        print(f"Error parsing resources string '{resources_str}': {e}")
        return {"gpu_count": 0, "gpu_type": None, "cpus": 0, "memory": 0}


def get_current_period_dates() -> tuple[datetime.date, datetime.date]:
    """Get the current billing period start and end dates"""
    today = datetime.now().date()
    period_start = datetime(today.year, today.month, 1).date()
    if today.month == 12:
        period_end = datetime(today.year + 1, 1, 1).date() - timedelta(days=1)
    else:
        period_end = datetime(today.year, today.month + 1, 1).date() - timedelta(days=1)
    return period_start, period_end


def get_or_create_organization_quota(
    db: Session, organization_id: str
) -> OrganizationQuota:
    """Get or create an organization quota record (organization-wide default)"""
    org_quota = get_organization_default_quota(db, organization_id)

    # Automatically populate user quotas if this is the first time accessing
    # Check if there are any user quotas for this organization
    existing_user_quotas = (
        db.query(OrganizationQuota)
        .filter(
            OrganizationQuota.organization_id == organization_id,
            OrganizationQuota.user_id.isnot(None),
        )
        .count()
    )

    if existing_user_quotas == 0:
        # No user quotas exist, populate them automatically
        populate_user_quotas_for_organization(db, organization_id)

    return org_quota


def get_or_create_user_quota(
    db: Session, organization_id: str, user_id: str
) -> OrganizationQuota:
    """Get or create a user quota record, falling back to organization default"""
    user_quota = (
        db.query(OrganizationQuota)
        .filter(
            OrganizationQuota.organization_id == organization_id,
            OrganizationQuota.user_id == user_id,
        )
        .first()
    )

    if not user_quota:
        # Get organization default quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        try:
            user_quota = OrganizationQuota(
                organization_id=organization_id,
                user_id=user_id,
                monthly_gpu_hours_per_user=org_quota.monthly_gpu_hours_per_user,
                custom_quota=False,  # Initially not custom
            )
            db.add(user_quota)
            db.commit()
            db.refresh(user_quota)
        except Exception as e:
            # If there's a unique constraint violation, try to get the existing record
            db.rollback()
            user_quota = (
                db.query(OrganizationQuota)
                .filter(
                    OrganizationQuota.organization_id == organization_id,
                    OrganizationQuota.user_id == user_id,
                )
                .first()
            )
            if not user_quota:
                # If we still can't find it, re-raise the original exception
                raise e

    return user_quota


def get_user_quota_limit(
    db: Session, organization_id: str, user_id: str
) -> Tuple[float, str]:
    """
    Get the quota limit for a specific user based on precedence:
    individual > team > organization

    Returns:
        Tuple[float, str]: (quota_limit, quota_source) where quota_source is 'user', 'team', or 'org'
    """
    # Check if user has an individual quota
    user_quota = (
        db.query(OrganizationQuota)
        .filter(
            OrganizationQuota.organization_id == organization_id,
            OrganizationQuota.user_id == user_id,
            OrganizationQuota.custom_quota == True,
        )
        .first()
    )

    if user_quota:
        return user_quota.monthly_gpu_hours_per_user, "user"

    # Check if user has a team quota
    team_id = get_user_team_id(db, organization_id, user_id)
    if team_id:
        team_quota = get_team_quota(db, organization_id, team_id)
        if team_quota:
            return team_quota.monthly_gpu_hours_per_user, "team"

    # Fall back to organization default
    org_quota = get_or_create_organization_quota(db, organization_id)
    return org_quota.monthly_gpu_hours_per_user, "org"


def get_user_team_id(db: Session, organization_id: str, user_id: str) -> Optional[str]:
    """Get the team ID for a user in an organization"""
    membership = (
        db.query(TeamMembership)
        .filter(
            TeamMembership.organization_id == organization_id,
            TeamMembership.user_id == user_id,
        )
        .first()
    )
    return membership.team_id if membership else None


def get_team_quota(
    db: Session, organization_id: str, team_id: str
) -> Optional[TeamQuota]:
    """Get the team quota for a specific team"""
    return (
        db.query(TeamQuota)
        .filter(
            TeamQuota.organization_id == organization_id,
            TeamQuota.team_id == team_id,
        )
        .first()
    )


def get_current_user_quota_info(
    db: Session, organization_id: str, user_id: str
) -> Dict[str, Any]:
    """Get comprehensive quota information for the current user"""
    # Get user's quota record and source
    quota_limit, quota_source = get_user_quota_limit(db, organization_id, user_id)

    # Get or create user's quota record
    user_quota = get_or_create_user_quota(db, organization_id, user_id)

    # Get current period
    current_period = get_or_create_quota_period(db, organization_id, user_id)

    # Get organization default for comparison
    org_quota = get_organization_default_quota(db, organization_id)

    # Get team quota information if applicable
    team_id = get_user_team_id(db, organization_id, user_id)
    team_quota_limit = None
    team_name = None

    if team_id:
        team_quota = get_team_quota(db, organization_id, team_id)
        if team_quota:
            team_quota_limit = team_quota.monthly_gpu_hours_per_user

            # Get team name via lazy import to avoid circular import
            try:
                from lattice.routes.admin.teams_service import get_team

                team = get_team(db, team_id)
                team_name = team.name if team else "Unknown Team"
            except Exception:
                team_name = "Unknown Team"

    return {
        "user_quota_limit": user_quota.monthly_gpu_hours_per_user,
        "is_custom_quota": user_quota.custom_quota,
        "organization_default": org_quota.monthly_gpu_hours_per_user,
        "team_quota_limit": team_quota_limit,
        "team_name": team_name,
        "effective_quota_limit": quota_limit,
        "effective_quota_source": quota_source,
        "current_period_limit": current_period.gpu_hours_limit,
        "current_period_used": current_period.gpu_hours_used,
        "current_period_remaining": max(
            0, current_period.gpu_hours_limit - current_period.gpu_hours_used
        ),
        "usage_percentage": (
            current_period.gpu_hours_used / current_period.gpu_hours_limit * 100
        )
        if current_period.gpu_hours_limit > 0
        else 0,
    }


def update_user_quota(
    db: Session, organization_id: str, user_id: str, monthly_gpu_hours_limit: float
) -> OrganizationQuota:
    """Update or create a user quota record"""
    user_quota = get_or_create_user_quota(db, organization_id, user_id)
    user_quota.monthly_gpu_hours_per_user = monthly_gpu_hours_limit
    user_quota.custom_quota = True  # Mark as custom when updated
    user_quota.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user_quota)

    # Update current quota period with new limit
    current_period = get_or_create_quota_period(db, organization_id, user_id)
    if current_period.gpu_hours_limit != monthly_gpu_hours_limit:
        current_period.gpu_hours_limit = monthly_gpu_hours_limit
        current_period.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_period)

    return user_quota


def delete_user_quota(db: Session, organization_id: str, user_id: str) -> bool:
    """Delete a user quota record, reverting to organization default"""
    user_quota = (
        db.query(OrganizationQuota)
        .filter(
            OrganizationQuota.organization_id == organization_id,
            OrganizationQuota.user_id == user_id,
        )
        .first()
    )

    if user_quota:
        db.delete(user_quota)
        db.commit()
        return True

    return False


def get_all_user_quotas(db: Session, organization_id: str) -> List[OrganizationQuota]:
    """Get all user quotas for an organization"""
    # First, ensure all users have quota records by calling populate
    populate_user_quotas_for_organization(db, organization_id)

    # Then return all user quotas
    return (
        db.query(OrganizationQuota)
        .filter(
            OrganizationQuota.organization_id == organization_id,
            OrganizationQuota.user_id.isnot(None),
        )
        .all()
    )


def get_organization_default_quota(
    db: Session, organization_id: str
) -> OrganizationQuota:
    """Get the organization-wide default quota"""
    org_quota = (
        db.query(OrganizationQuota)
        .filter(
            OrganizationQuota.organization_id == organization_id,
            OrganizationQuota.user_id.is_(None),  # Organization-wide default
        )
        .first()
    )

    if not org_quota:
        try:
            org_quota = OrganizationQuota(
                organization_id=organization_id,
                user_id=None,  # Organization-wide default
                monthly_gpu_hours_per_user=100.0,
                custom_quota=False,
            )
            db.add(org_quota)
            db.commit()
            db.refresh(org_quota)
        except Exception as e:
            # If there's a unique constraint violation, try to get the existing record
            db.rollback()
            org_quota = (
                db.query(OrganizationQuota)
                .filter(
                    OrganizationQuota.organization_id == organization_id,
                    OrganizationQuota.user_id.is_(None),  # Organization-wide default
                )
                .first()
            )
            if not org_quota:
                # If we still can't find it, re-raise the original exception
                raise e

    return org_quota


def refresh_quota_periods_for_organization(db: Session, organization_id: str) -> None:
    """Refresh quota periods for all users in an organization with their current quota limits"""
    from lattice.routes.auth.provider.work_os import provider as auth_provider

    try:
        # Get all users in the organization
        memberships = auth_provider.list_organization_memberships(
            organization_id=organization_id
        )

        for membership in memberships:
            # Get or create quota period for each user (this will update with current limits)
            get_or_create_quota_period(db, organization_id, membership.user_id)

    except Exception as e:
        print(
            f"Failed to refresh quota periods for organization {organization_id}: {e}"
        )


def refresh_quota_periods_for_user(
    db: Session, organization_id: str, user_id: str
) -> None:
    """Refresh quota period for a specific user with their current quota limit"""
    try:
        # Get or create quota period for the user (this will update with current limits)
        get_or_create_quota_period(db, organization_id, user_id)
    except Exception as e:
        print(
            f"Failed to refresh quota period for user {user_id} in organization {organization_id}: {e}"
        )


def populate_user_quotas_for_organization(
    db: Session, organization_id: str
) -> List[OrganizationQuota]:
    """Populate user quotas for all users in an organization"""
    from lattice.routes.auth.provider.work_os import provider as auth_provider

    try:
        # Get organization members
        memberships = auth_provider.list_organization_memberships(
            organization_id=organization_id
        )

        # Get organization default quota
        org_quota = get_organization_default_quota(db, organization_id)

        created_quotas = []
        for membership in memberships:
            # Check if user quota already exists
            existing_quota = (
                db.query(OrganizationQuota)
                .filter(
                    OrganizationQuota.organization_id == organization_id,
                    OrganizationQuota.user_id == membership.user_id,
                )
                .first()
            )

            if not existing_quota:
                # Create user quota with organization default
                user_quota = OrganizationQuota(
                    organization_id=organization_id,
                    user_id=membership.user_id,
                    monthly_gpu_hours_per_user=org_quota.monthly_gpu_hours_per_user,
                    custom_quota=False,
                )
                db.add(user_quota)
                created_quotas.append(user_quota)

        if created_quotas:
            db.commit()
            for quota in created_quotas:
                db.refresh(quota)

        return created_quotas
    except Exception as e:
        print(f"Failed to populate user quotas: {e}")
        return []


def get_or_create_quota_period(
    db: Session, organization_id: str, user_id: str = None
) -> QuotaPeriod:
    """Get or create a quota period record for the current month"""
    period_start, period_end = get_current_period_dates()

    period = (
        db.query(QuotaPeriod)
        .filter(
            QuotaPeriod.organization_id == organization_id,
            QuotaPeriod.user_id == user_id,
            QuotaPeriod.period_start == period_start,
            QuotaPeriod.period_end == period_end,
        )
        .first()
    )

    if not period:
        # Get the user-specific quota limit, falling back to team or organization default
        if user_id:
            quota_limit, _ = get_user_quota_limit(db, organization_id, user_id)
        else:
            org_quota = get_or_create_organization_quota(db, organization_id)
            quota_limit = org_quota.monthly_gpu_hours_per_user

        period = QuotaPeriod(
            organization_id=organization_id,
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            gpu_hours_used=0.0,
            gpu_hours_limit=quota_limit,
        )
        db.add(period)
        db.commit()
        db.refresh(period)
    else:
        # Update existing period with current user quota limit if it's different
        if user_id:
            current_quota_limit, _ = get_user_quota_limit(db, organization_id, user_id)
            if period.gpu_hours_limit != current_quota_limit:
                period.gpu_hours_limit = current_quota_limit
                period.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(period)
            if period.gpu_hours_limit != current_quota_limit:
                period.gpu_hours_limit = current_quota_limit
                period.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(period)

    return period


def sync_gpu_usage_from_cost_report(db: Session) -> Dict[str, Any]:
    """
    Sync GPU usage from SkyPilot cost report
    This can be used to reconcile usage data
    """
    try:
        # Generate cost report
        cost_report = generate_cost_report()

        if not cost_report:
            return {"message": "No cost report available", "updated_clusters": 0}

        updated_clusters = 0
        created_logs = 0

        # Process the cost report to update usage logs
        for cluster_data in cost_report:
            cluster_name = cluster_data.get("name")
            if not cluster_name:
                continue

            # Get user info from cluster platforms database
            platform_info = get_cluster_platform_info(cluster_name)
            if not platform_info or not platform_info.get("user_id"):
                continue

            user_id = platform_info["user_id"]
            organization_id = platform_info.get("organization_id")

            if not organization_id:
                continue

                # Parse resources to get GPU info
            resources_str = cluster_data.get("resources_str_full", "")
            parsed_resources = parse_resources_string(resources_str)
            gpu_count = parsed_resources.get("gpu_count", 0)
            gpu_type = parsed_resources.get("gpu_type")

            # Skip if no GPUs (CPU-only clusters)
            if gpu_count == 0:
                continue

            # Check if we already have a usage log for this cluster
            existing_log = (
                db.query(GPUUsageLog)
                .filter(GPUUsageLog.cluster_name == cluster_name)
                .first()
            )

            if existing_log:
                # Update existing log with cost report data
                existing_log.instance_type = gpu_type or existing_log.instance_type
                existing_log.gpu_count = gpu_count
                existing_log.cloud_provider = cluster_data.get(
                    "cloud", existing_log.cloud_provider
                )

                # Calculate duration from cost report
                duration_hours = (
                    cluster_data.get("duration", 0) / 3600
                )  # Convert seconds to hours

                # If the cluster is still running, update duration
                if (
                    existing_log.duration_hours is None
                    or existing_log.duration_hours != duration_hours
                ):
                    existing_log.duration_hours = duration_hours

                db.commit()
                updated_clusters += 1

            else:
                # Create new usage log from cost report data
                launched_at = cluster_data.get("launched_at")
                start_time = (
                    datetime.fromtimestamp(launched_at)
                    if launched_at
                    else datetime.utcnow()
                )

                duration_hours = (
                    cluster_data.get("duration", 0) / 3600
                )  # Convert seconds to hours
                end_time = (
                    start_time + timedelta(hours=duration_hours)
                    if duration_hours > 0
                    else None
                )

                usage_log = GPUUsageLog(
                    organization_id=organization_id,
                    user_id=user_id,
                    cluster_name=cluster_name,
                    gpu_count=gpu_count,
                    start_time=start_time,
                    end_time=end_time,
                    duration_hours=duration_hours,
                    instance_type=gpu_type,
                    cloud_provider=cluster_data.get("cloud"),
                    cost_estimate=cluster_data.get("total_cost"),
                )

                db.add(usage_log)
                db.commit()
                created_logs += 1

        # Update quota periods with the new data
        if created_logs > 0 or updated_clusters > 0:
            # Get all organizations that had updates
            orgs_with_updates = db.query(GPUUsageLog.organization_id).distinct().all()

            for (org_id,) in orgs_with_updates:
                try:
                    # Get all users in this organization
                    users_in_org = (
                        db.query(GPUUsageLog.user_id)
                        .filter(GPUUsageLog.organization_id == org_id)
                        .distinct()
                        .all()
                    )

                    for (user_id,) in users_in_org:
                        # Recalculate quota period usage for each user
                        current_period = get_or_create_quota_period(db, org_id, user_id)
                        total_usage = (
                            db.query(GPUUsageLog)
                            .filter(
                                GPUUsageLog.organization_id == org_id,
                                GPUUsageLog.user_id == user_id,
                                GPUUsageLog.start_time
                                >= datetime.combine(
                                    current_period.period_start, datetime.min.time()
                                ),
                                GPUUsageLog.start_time
                                <= datetime.combine(
                                    current_period.period_end, datetime.max.time()
                                ),
                                GPUUsageLog.duration_hours.isnot(None),
                            )
                            .with_entities(
                                func.sum(
                                    GPUUsageLog.duration_hours * GPUUsageLog.gpu_count
                                )
                            )
                            .scalar()
                            or 0.0
                        )

                        current_period.gpu_hours_used = total_usage
                        current_period.updated_at = datetime.utcnow()
                        db.commit()
                except Exception as e:
                    print(f"Failed to update quota period for org {org_id}: {e}")

        return {
            "message": f"Synced {updated_clusters} existing clusters and created {created_logs} new logs from cost report",
            "updated_clusters": updated_clusters,
            "created_logs": created_logs,
        }

    except Exception as e:
        print(f"Failed to sync GPU usage from cost report: {e}")
        return {
            "message": f"Failed to sync: {str(e)}",
            "updated_clusters": 0,
            "created_logs": 0,
        }


def get_gpu_usage_summary(
    db: Session, organization_id: str, user_id: str = None
) -> Dict[str, Any]:
    """
    Get a summary of GPU usage for an organization or specific user
    """
    try:
        # Get current period
        current_period = get_or_create_quota_period(db, organization_id, user_id)

        # Get all usage logs for this organization in current period
        usage_query = db.query(GPUUsageLog).filter(
            GPUUsageLog.organization_id == organization_id,
            GPUUsageLog.start_time
            >= datetime.combine(current_period.period_start, datetime.min.time()),
            GPUUsageLog.start_time
            <= datetime.combine(current_period.period_end, datetime.max.time()),
        )

        if user_id:
            usage_query = usage_query.filter(GPUUsageLog.user_id == user_id)

        usage_logs = usage_query.all()

        # Calculate summary
        total_gpu_hours = sum(log.duration_hours or 0 for log in usage_logs)
        active_clusters = len([log for log in usage_logs if log.end_time is None])
        completed_sessions = len(
            [log for log in usage_logs if log.end_time is not None]
        )

        # Group by GPU type
        gpu_type_usage = {}
        for log in usage_logs:
            gpu_type = log.instance_type or "Unknown"
            if gpu_type not in gpu_type_usage:
                gpu_type_usage[gpu_type] = {"hours": 0, "sessions": 0}
            gpu_type_usage[gpu_type]["hours"] += log.duration_hours or 0
            gpu_type_usage[gpu_type]["sessions"] += 1

        return {
            "organization_id": organization_id,
            "user_id": user_id,
            "period_start": current_period.period_start.isoformat(),
            "period_end": current_period.period_end.isoformat(),
            "quota_limit": current_period.gpu_hours_limit,
            "quota_used": current_period.gpu_hours_used,
            "quota_remaining": max(
                0, current_period.gpu_hours_limit - current_period.gpu_hours_used
            ),
            "usage_percentage": (
                current_period.gpu_hours_used / current_period.gpu_hours_limit * 100
            )
            if current_period.gpu_hours_limit > 0
            else 0,
            "total_gpu_hours": total_gpu_hours,
            "active_clusters": active_clusters,
            "completed_sessions": completed_sessions,
            "gpu_type_breakdown": gpu_type_usage,
        }

    except Exception as e:
        print(
            f"Failed to get GPU usage summary for organization {organization_id}: {e}"
        )
        return {}


def get_organization_user_usage_summary(
    db: Session, organization_id: str
) -> Dict[str, Any]:
    """
    Get a summary of GPU usage for all users in an organization
    """
    try:
        # Get organization quota
        org_quota = get_or_create_organization_quota(db, organization_id)
        period_start, period_end = get_current_period_dates()

        # Get all users in the organization with their usage
        user_usage = (
            db.query(
                GPUUsageLog.user_id,
                func.sum(GPUUsageLog.duration_hours * GPUUsageLog.gpu_count).label(
                    "total_hours"
                ),
            )
            .filter(
                GPUUsageLog.organization_id == organization_id,
                GPUUsageLog.start_time
                >= datetime.combine(period_start, datetime.min.time()),
                GPUUsageLog.start_time
                <= datetime.combine(period_end, datetime.max.time()),
                GPUUsageLog.duration_hours.isnot(None),
            )
            .group_by(GPUUsageLog.user_id)
            .all()
        )

        # Get user info for display
        user_breakdown = []
        total_org_usage = 0

        for user_id, total_hours in user_usage:
            total_hours = total_hours or 0
            total_org_usage += total_hours

            # Try to get user info from any cluster
            user_cluster = (
                db.query(GPUUsageLog.cluster_name)
                .filter(GPUUsageLog.user_id == user_id)
                .first()
            )

            user_info = {}
            if user_cluster:
                platform_info = get_cluster_platform_info(user_cluster[0])
                user_info = platform_info.get("user_info", {}) if platform_info else {}

            # Get user-specific effective quota limit (user > team > org)
            user_quota_limit, _ = get_user_quota_limit(db, organization_id, user_id)

            user_breakdown.append(
                {
                    "user_id": user_id,
                    "user_email": user_info.get("email"),
                    "user_name": user_info.get("name"),
                    "gpu_hours_used": total_hours,
                    "gpu_hours_limit": user_quota_limit,
                    "gpu_hours_remaining": max(0, user_quota_limit - total_hours),
                    "usage_percentage": (total_hours / user_quota_limit * 100)
                    if user_quota_limit > 0
                    else 0,
                }
            )

        return {
            "organization_id": organization_id,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "quota_per_user": org_quota.monthly_gpu_hours_per_user,
            "total_users": len(user_breakdown),
            "total_organization_usage": total_org_usage,
            "user_breakdown": user_breakdown,
        }

    except Exception as e:
        print(
            f"Failed to get organization user usage summary for {organization_id}: {e}"
        )
        return {}
