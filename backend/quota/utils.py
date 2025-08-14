import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from db_models import GPUUsageLog, OrganizationQuota, QuotaPeriod
from utils.file_utils import get_cluster_user_info, get_cluster_platform
from skypilot.utils import generate_cost_report
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
    """Get or create an organization quota record"""
    quota = (
        db.query(OrganizationQuota)
        .filter(OrganizationQuota.organization_id == organization_id)
        .first()
    )

    if not quota:
        quota = OrganizationQuota(
            organization_id=organization_id,
            monthly_gpu_hours_per_user=100.0,  # Default quota per user
        )
        db.add(quota)
        db.commit()
        db.refresh(quota)

    return quota


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
        # Get the organization quota to set the limit
        org_quota = get_or_create_organization_quota(db, organization_id)

        period = QuotaPeriod(
            organization_id=organization_id,
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            gpu_hours_used=0.0,
            gpu_hours_limit=org_quota.monthly_gpu_hours_per_user,
        )
        db.add(period)
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

            # Get user info from cluster_platforms.json
            user_info = get_cluster_user_info(cluster_name)
            if not user_info or not user_info.get("id"):
                continue

            user_id = user_info["id"]
            organization_id = user_info.get("organization_id")

            if not organization_id:
                continue

                # Parse resources to get GPU info
            resources_str = cluster_data.get("resources_str_full", "")
            parsed_resources = parse_resources_string(resources_str)
            gpu_count = parsed_resources.get("gpu_count", 0)
            gpu_type = parsed_resources.get("gpu_type")

            # Skip if no GPUs (CPU-only clusters)
            if gpu_count == 0:
                print(f"No GPUs detected in cluster {cluster_name}, skipping")
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
        from utils.file_utils import get_cluster_user_info

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
                user_info = get_cluster_user_info(user_cluster[0]) or {}

            user_breakdown.append(
                {
                    "user_id": user_id,
                    "user_email": user_info.get("email"),
                    "user_name": user_info.get("name"),
                    "gpu_hours_used": total_hours,
                    "gpu_hours_limit": org_quota.monthly_gpu_hours_per_user,
                    "gpu_hours_remaining": max(
                        0, org_quota.monthly_gpu_hours_per_user - total_hours
                    ),
                    "usage_percentage": (
                        total_hours / org_quota.monthly_gpu_hours_per_user * 100
                    )
                    if org_quota.monthly_gpu_hours_per_user > 0
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
