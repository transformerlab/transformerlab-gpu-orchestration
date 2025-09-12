from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from config import get_db
from routes.auth.utils import (
    get_current_user,
    check_organization_member,
    check_organization_admin,
    requires_admin,
)
from models import (
    OrganizationQuotaResponse,
    UpdateQuotaRequest,
    GPUUsageLogResponse,
    QuotaUsageResponse,
    OrganizationUserUsageResponse,
    OrganizationUserUsageByClusterResponse,
    UserQuotaResponse,
    UpdateUserQuotaRequest,
    UserQuotaListResponse,
    CreateUserQuotaRequest,
)
from db.db_models import GPUUsageLog, OrganizationQuota
from utils.cluster_utils import get_display_name_from_actual
from routes.quota.utils import (
    get_or_create_organization_quota,
    get_or_create_quota_period,
    get_gpu_usage_summary,
    get_organization_user_usage_summary,
    get_organization_user_usage_summary_by_cluster,
    sync_gpu_usage_from_cost_report,
    get_current_period_dates,
    get_or_create_user_quota,
    get_user_quota_limit,
    update_user_quota,
    delete_user_quota,
    get_all_user_quotas,
    populate_user_quotas_for_organization,
    get_current_user_quota_info,
    refresh_quota_periods_for_organization,
    refresh_quota_periods_for_user,
)
from routes.quota.team_quota_routes import router as team_quota_router
from routes.auth.api_key_auth import enforce_csrf

router = APIRouter(prefix="/quota", tags=["quota"], dependencies=[Depends(enforce_csrf)])

# Include team quota routes
router.include_router(team_quota_router)


@router.get("/organization/{organization_id}", response_model=OrganizationQuotaResponse)
async def get_organization_quota(
    organization_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_member),
):
    """Get organization quota and current user's usage"""
    try:
        # Get comprehensive quota information for the current user
        quota_info = get_current_user_quota_info(db, organization_id, user["id"])

        # Get current period dates
        period_start, period_end = get_current_period_dates()

        return OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_credits_per_user=quota_info["effective_quota_limit"],
            current_period_start=period_start.isoformat(),
            current_period_end=period_end.isoformat(),
            credits_used=quota_info["current_period_used"],
            credits_remaining=quota_info["current_period_remaining"],
            usage_percentage=min(100, quota_info["usage_percentage"]),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get quota: {str(e)}")


@router.put("/organization/{organization_id}", response_model=OrganizationQuotaResponse)
async def update_organization_quota(
    organization_id: str,
    request: UpdateQuotaRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Update organization quota per user"""
    try:
        # Get or create organization quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Update the quota per user
        org_quota.monthly_credits_per_user = request.monthly_credits_per_user
        org_quota.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(org_quota)

        # Update current period limit for the current user
        current_period = get_or_create_quota_period(db, organization_id, user["id"])
        current_period.credits_limit = request.monthly_credits_per_user
        current_period.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_period)

        # Update all non-custom user quotas to the new organization default
        user_quotas = get_all_user_quotas(db, organization_id)

        for user_quota in user_quotas:
            if not user_quota.custom_quota:
                user_quota.monthly_credits_per_user = request.monthly_credits_per_user
                user_quota.custom_quota = False
                user_quota.updated_at = datetime.utcnow()
        db.commit()

        # Refresh quota periods for all users to reflect the new limits
        refresh_quota_periods_for_organization(db, organization_id)

        # Calculate usage percentage
        usage_percentage = (
            (current_period.credits_used / current_period.credits_limit) * 100
            if current_period.credits_limit > 0
            else 0
        )

        return OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_credits_per_user=org_quota.monthly_credits_per_user,
            current_period_start=current_period.period_start.isoformat(),
            current_period_end=current_period.period_end.isoformat(),
            credits_used=current_period.credits_used,
            credits_remaining=max(
                0, current_period.credits_limit - current_period.credits_used
            ),
            usage_percentage=min(100, usage_percentage),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update quota: {str(e)}")


@router.get("/organization/{organization_id}/usage", response_model=QuotaUsageResponse)
async def get_organization_usage(
    organization_id: str,
    limit: int = 50,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_member),
):
    """Get current user's quota and recent usage logs"""
    try:
        # Get current user's quota (this is now per-user)
        quota_response = await get_organization_quota(organization_id, user, db)

        # Get recent usage logs for the current user
        usage_logs = (
            db.query(GPUUsageLog)
            .filter(
                GPUUsageLog.organization_id == organization_id,
                GPUUsageLog.user_id == user["id"],
            )
            .order_by(GPUUsageLog.start_time.desc())
            .limit(limit)
            .all()
        )

        # Convert to response models
        recent_usage = []
        for log in usage_logs:
            # Get user info from cluster platforms
            from utils.cluster_utils import get_cluster_platform_info

            platform_info = get_cluster_platform_info(log.cluster_name)
            user_info = platform_info.get("user_info", {}) if platform_info else {}

            # Get display name for user-facing response
            display_name = get_display_name_from_actual(log.cluster_name)
            cluster_display_name = display_name if display_name else log.cluster_name

            # Calculate duration in hours
            duration_hours = None
            if log.duration_seconds is not None:
                duration_hours = log.duration_seconds / 3600.0
            elif log.end_time is not None:
                # Calculate from start and end times if duration_seconds is not set
                duration_seconds = (log.end_time - log.start_time).total_seconds()
                duration_hours = duration_seconds / 3600.0

            # Map cloud provider values to frontend-expected values
            def map_cloud_provider(cloud_provider):
                if not cloud_provider:
                    return "direct"
                cloud_lower = cloud_provider.lower()
                if cloud_lower in ["azure"]:
                    return "azure"
                elif cloud_lower in ["runpod"]:
                    return "runpod"
                elif cloud_lower in ["gcp", "google", "googlecloud"]:
                    return "gcp"
                elif cloud_lower in ["aws", "amazon"]:
                    return "aws"  # Frontend will show default icon for aws
                else:
                    return "direct"

            recent_usage.append(
                GPUUsageLogResponse(
                    id=log.id,
                    organization_id=log.organization_id,
                    user_id=log.user_id,
                    user_email=user_info.get("email") if user_info else None,
                    user_name=user_info.get("name") if user_info else None,
                    cluster_name=cluster_display_name,
                    job_id=log.job_id,
                    gpu_count=log.gpu_count,
                    start_time=log.start_time.isoformat(),
                    end_time=log.end_time.isoformat() if log.end_time else None,
                    duration_seconds=log.duration_seconds,
                    duration_hours=duration_hours,
                    instance_type=log.instance_type,
                    cloud_provider=map_cloud_provider(log.cloud_provider),
                    region=log.region,
                    cost_estimate=log.cost_estimate,
                )
            )

        return QuotaUsageResponse(
            organization_quota=quota_response,
            recent_usage=recent_usage,
            total_usage_this_period=quota_response.credits_used,
        )
    except Exception as e:
        print(f"Failed to get usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get usage: {str(e)}")


@router.get("/check-quota/{organization_id}")
async def check_quota_availability(
    organization_id: str,
    estimated_hours: float = 1.0,
    gpu_count: int = 1,
    price_per_hour: float | None = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_member),
):
    """Check if user has enough quota for a new cluster.

    If `price_per_hour` is provided, uses price-based credits (recommended). Otherwise falls back to hours*gpu.
    """
    try:
        quota_response = await get_organization_quota(organization_id, user, db)

        if price_per_hour is not None:
            required_credits = float(price_per_hour) * float(estimated_hours)
            # Back-compat fields with best-effort translation to hours
            required_hours = float(estimated_hours)
            available_hours = quota_response.credits_remaining / float(price_per_hour) if price_per_hour else 0.0
        else:
            # Deprecated hours-only path
            required_credits = float(estimated_hours) * float(gpu_count)
            required_hours = float(estimated_hours) * float(gpu_count)
            available_hours = quota_response.credits_remaining

        has_quota = quota_response.credits_remaining >= required_credits

        return {
            "has_quota": has_quota,
            # New fields
            "required_credits": required_credits,
            "available_credits": quota_response.credits_remaining,
            # Deprecated fields (hours-based) for backward compatibility
            "required_hours": required_hours,
            "available_hours": available_hours,
            # Common context
            "current_usage": quota_response.credits_used,
            "quota_limit": quota_response.monthly_credits_per_user,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check quota: {str(e)}")


@router.get("/sync-from-cost-report")
async def sync_usage_from_cost_report(
    user=Depends(get_current_user), db: Session = Depends(get_db), __: dict = Depends(requires_admin)
):
    """Sync GPU usage from SkyPilot cost report"""
    try:
        result = sync_gpu_usage_from_cost_report(db)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to sync from cost report: {str(e)}"
        )


@router.get("/summary/{organization_id}")
async def get_usage_summary(
    organization_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    _: dict = Depends(check_organization_member),
):
    """Get detailed GPU usage summary for current user"""
    try:
        summary = get_gpu_usage_summary(db, organization_id, user["id"])
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get usage summary: {str(e)}"
        )


@router.get(
    "/organization/{organization_id}/users",
    response_model=OrganizationUserUsageResponse,
)
async def get_organization_user_usage(
    organization_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Get GPU usage breakdown for all users in an organization"""
    try:
        summary = get_organization_user_usage_summary(db, organization_id)
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get organization user usage: {str(e)}"
        )


@router.get(
    "/organization/{organization_id}/users/cluster/{cluster_name}",
    response_model=OrganizationUserUsageByClusterResponse,
)
async def get_organization_user_usage_by_cluster(
    organization_id: str,
    cluster_name: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Get GPU usage breakdown for all users in an organization filtered by cluster/node pool"""
    try:
        summary = get_organization_user_usage_summary_by_cluster(db, organization_id, cluster_name)
        return summary
    except Exception as e:
        print(f"Failed to get organization user usage for cluster: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get organization user usage for cluster: {str(e)}"
        )


@router.get(
    "/organization/{organization_id}/usage/all", response_model=QuotaUsageResponse
)
async def get_all_organization_usage(
    organization_id: str,
    limit: int = 50,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Get organization-wide usage data for all users"""
    try:
        # Get organization quota info (per-user quota)
        org_quota = get_or_create_organization_quota(db, organization_id)
        period_start, period_end = get_current_period_dates()

        # Calculate total organization usage (credits == price)
        total_org_usage = (
            db.query(GPUUsageLog)
            .filter(
                GPUUsageLog.organization_id == organization_id,
                GPUUsageLog.start_time
                >= datetime.combine(period_start, datetime.min.time()),
                GPUUsageLog.start_time
                <= datetime.combine(period_end, datetime.max.time()),
            )
            .with_entities(func.sum(GPUUsageLog.cost_estimate))
            .scalar()
            or 0.0
        )

        # Create a mock quota response for organization view
        quota_response = OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_credits_per_user=org_quota.monthly_credits_per_user,
            current_period_start=period_start.isoformat(),
            current_period_end=period_end.isoformat(),
            credits_used=total_org_usage,
            credits_remaining=0.0,  # Not applicable for org-wide view
            usage_percentage=0.0,  # Not applicable for org-wide view
        )

        # Get recent usage logs for all users
        usage_logs = (
            db.query(GPUUsageLog)
            .filter(GPUUsageLog.organization_id == organization_id)
            .order_by(GPUUsageLog.start_time.desc())
            .limit(limit)
            .all()
        )

        # Convert to response models
        recent_usage = []
        for log in usage_logs:
            # Get user info from cluster platforms
            from utils.cluster_utils import get_cluster_platform_info

            platform_info = get_cluster_platform_info(log.cluster_name)
            user_info = platform_info.get("user_info", {}) if platform_info else {}

            # Get display name for user-facing response
            display_name = get_display_name_from_actual(log.cluster_name)
            cluster_display_name = display_name if display_name else log.cluster_name

            # Calculate duration in hours
            duration_hours = None
            if log.duration_seconds is not None:
                duration_hours = log.duration_seconds / 3600.0
            elif log.end_time is not None:
                # Calculate from start and end times if duration_seconds is not set
                duration_seconds = (log.end_time - log.start_time).total_seconds()
                duration_hours = duration_seconds / 3600.0

            # Map cloud provider values to frontend-expected values
            def map_cloud_provider(cloud_provider):
                if not cloud_provider:
                    return "direct"
                cloud_lower = cloud_provider.lower()
                if cloud_lower in ["azure"]:
                    return "azure"
                elif cloud_lower in ["runpod"]:
                    return "runpod"
                elif cloud_lower in ["gcp", "google", "googlecloud"]:
                    return "gcp"
                elif cloud_lower in ["aws", "amazon"]:
                    return "aws"  # Frontend will show default icon for aws
                else:
                    return "direct"

            recent_usage.append(
                GPUUsageLogResponse(
                    id=log.id,
                    organization_id=log.organization_id,
                    user_id=log.user_id,
                    user_email=user_info.get("email") if user_info else None,
                    user_name=user_info.get("name") if user_info else None,
                    cluster_name=cluster_display_name,
                    job_id=log.job_id,
                    gpu_count=log.gpu_count,
                    start_time=log.start_time.isoformat(),
                    end_time=log.end_time.isoformat() if log.end_time else None,
                    duration_seconds=log.duration_seconds,
                    duration_hours=duration_hours,
                    instance_type=log.instance_type,
                    cloud_provider=map_cloud_provider(log.cloud_provider),
                    region=log.region,
                    cost_estimate=log.cost_estimate,
                )
            )

        return QuotaUsageResponse(
            organization_quota=quota_response,
            recent_usage=recent_usage,
            total_usage_this_period=total_org_usage,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get organization usage: {str(e)}"
        )


# Individual User Quota Management Routes
@router.get(
    "/organization/{organization_id}/users/quotas",
    response_model=UserQuotaListResponse,
)
async def get_organization_user_quotas(
    organization_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Get all user quotas for an organization"""
    try:
        # Get organization default quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Get all user quotas
        user_quotas = get_all_user_quotas(db, organization_id)

        # Get user information from auth provider
        from routes.auth.provider.work_os import provider as auth_provider

        users = []
        for user_quota in user_quotas:
            # Get effective quota limit and source for each user (user > team > org)
            effective_quota_limit, effective_quota_source = get_user_quota_limit(
                db, organization_id, user_quota.user_id
            )

            try:
                user_info = auth_provider.get_user(user_id=user_quota.user_id)
                users.append(
                    UserQuotaResponse(
                        user_id=user_quota.user_id,
                        user_email=user_info.email,
                        user_name=f"{user_info.first_name or ''} {user_info.last_name or ''}".strip(),
                        organization_id=user_quota.organization_id,
                        monthly_credits_per_user=user_quota.monthly_credits_per_user,
                        custom_quota=user_quota.custom_quota,
                        created_at=user_quota.created_at.isoformat(),
                        updated_at=user_quota.updated_at.isoformat(),
                        effective_quota_source=effective_quota_source,
                        effective_quota_limit=effective_quota_limit,
                    )
                )
            except Exception:
                # If we can't get user info, still include the quota
                users.append(
                    UserQuotaResponse(
                        user_id=user_quota.user_id,
                        user_email=None,
                        user_name=None,
                        organization_id=user_quota.organization_id,
                        monthly_credits_per_user=user_quota.monthly_credits_per_user,
                        custom_quota=user_quota.custom_quota,
                        created_at=user_quota.created_at.isoformat(),
                        updated_at=user_quota.updated_at.isoformat(),
                        effective_quota_source=effective_quota_source,
                        effective_quota_limit=effective_quota_limit,
                    )
                )

        return UserQuotaListResponse(
            organization_id=organization_id,
            users=users,
            default_quota_per_user=org_quota.monthly_credits_per_user,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get user quotas: {str(e)}"
        )


@router.get(
    "/organization/{organization_id}/users/{user_id}/quota",
    response_model=UserQuotaResponse,
)
async def get_user_quota(
    organization_id: str,
    user_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Get quota for a specific user"""
    try:
        user_quota = get_or_create_user_quota(db, organization_id, user_id)

        # Get effective quota limit and source (user > team > org)
        effective_quota_limit, effective_quota_source = get_user_quota_limit(
            db, organization_id, user_id
        )

        # Get user information from auth provider
        from routes.auth.provider.work_os import provider as auth_provider

        try:
            user_info = auth_provider.get_user(user_id=user_quota.user_id)
            user_name = (
                f"{user_info.first_name or ''} {user_info.last_name or ''}".strip()
            )
            user_email = user_info.email
        except Exception:
            user_name = None
            user_email = None

        return UserQuotaResponse(
            user_id=user_quota.user_id,
            user_email=user_email,
            user_name=user_name,
            organization_id=user_quota.organization_id,
            monthly_credits_per_user=user_quota.monthly_credits_per_user,
            custom_quota=user_quota.custom_quota,
            created_at=user_quota.created_at.isoformat(),
            updated_at=user_quota.updated_at.isoformat(),
            effective_quota_source=effective_quota_source,
            effective_quota_limit=effective_quota_limit,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get user quota: {str(e)}"
        )


@router.put(
    "/organization/{organization_id}/users/{user_id}/quota",
    response_model=UserQuotaResponse,
)
async def update_user_quota_endpoint(
    organization_id: str,
    user_id: str,
    request: UpdateUserQuotaRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Update quota for a specific user"""
    try:
        updated_quota = update_user_quota(
            db, organization_id, user_id, request.monthly_credits_per_user
        )

        # Refresh the user's quota period to reflect the new limit
        refresh_quota_periods_for_user(db, organization_id, user_id)

        # Get user information from auth provider
        from routes.auth.provider.work_os import provider as auth_provider

        try:
            user_info = auth_provider.get_user(user_id=updated_quota.user_id)
            user_name = (
                f"{user_info.first_name or ''} {user_info.last_name or ''}".strip()
            )
            user_email = user_info.email
        except Exception:
            user_name = None
            user_email = None

        # Get effective quota limit and source after update
        effective_quota_limit, effective_quota_source = get_user_quota_limit(
            db, organization_id, user_id
        )

        return UserQuotaResponse(
            user_id=updated_quota.user_id,
            user_email=user_email,
            user_name=user_name,
            organization_id=updated_quota.organization_id,
            monthly_credits_per_user=updated_quota.monthly_credits_per_user,
            custom_quota=updated_quota.custom_quota,
            created_at=updated_quota.created_at.isoformat(),
            updated_at=updated_quota.updated_at.isoformat(),
            effective_quota_source=effective_quota_source,
            effective_quota_limit=effective_quota_limit,
        )
    except Exception as e:
        print(f"Failed to update user quota: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update user quota: {str(e)}"
        )


@router.delete("/organization/{organization_id}/users/{user_id}/quota")
async def delete_user_quota_endpoint(
    organization_id: str,
    user_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Delete user quota, reverting to organization default"""
    try:
        success = delete_user_quota(db, organization_id, user_id)

        # Refresh the user's quota period to reflect the new limit (org default or team quota)
        refresh_quota_periods_for_user(db, organization_id, user_id)

        if success:
            return {
                "message": "User quota deleted successfully, reverting to organization default"
            }
        else:
            return {"message": "No custom user quota found, using organization default"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete user quota: {str(e)}"
        )


@router.post(
    "/organization/{organization_id}/users/{user_id}/quota",
    response_model=UserQuotaResponse,
)
async def create_user_quota_endpoint(
    organization_id: str,
    user_id: str,
    request: CreateUserQuotaRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Create a new user quota"""
    try:
        # Check if user quota already exists
        existing_quota = (
            db.query(OrganizationQuota)
            .filter(
                OrganizationQuota.organization_id == organization_id,
                OrganizationQuota.user_id == user_id,
            )
            .first()
        )

        if existing_quota:
            raise HTTPException(
                status_code=400, detail="User quota already exists. Use PUT to update."
            )

        new_quota = OrganizationQuota(
            organization_id=organization_id,
            user_id=user_id,
            monthly_credits_per_user=request.monthly_credits_per_user,
            custom_quota=True,
        )
        db.add(new_quota)
        db.commit()
        db.refresh(new_quota)

        # Refresh the user's quota period to reflect the new limit
        refresh_quota_periods_for_user(db, organization_id, user_id)

        # Get user information from auth provider
        from routes.auth.provider.work_os import provider as auth_provider

        try:
            user_info = auth_provider.get_user(user_id=new_quota.user_id)
            user_name = (
                f"{user_info.first_name or ''} {user_info.last_name or ''}".strip()
            )
            user_email = user_info.email
        except Exception:
            user_name = None
            user_email = None

        # Get effective quota limit and source
        effective_quota_limit, effective_quota_source = get_user_quota_limit(
            db, organization_id, user_id
        )

        return UserQuotaResponse(
            user_id=new_quota.user_id,
            user_email=user_email,
            user_name=user_name,
            organization_id=new_quota.organization_id,
            monthly_credits_per_user=new_quota.monthly_credits_per_user,
            custom_quota=new_quota.custom_quota,
            created_at=new_quota.created_at.isoformat(),
            updated_at=new_quota.updated_at.isoformat(),
            effective_quota_source=effective_quota_source,
            effective_quota_limit=effective_quota_limit,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create user quota: {str(e)}"
        )


@router.post("/organization/{organization_id}/populate-user-quotas")
async def populate_user_quotas_endpoint(
    organization_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Populate user quotas for all users in an organization"""
    try:
        created_quotas = populate_user_quotas_for_organization(db, organization_id)

        return {
            "message": f"Successfully populated user quotas for {len(created_quotas)} users",
            "created_count": len(created_quotas),
            "organization_id": organization_id,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to populate user quotas: {str(e)}"
        )


@router.post("/organization/{organization_id}/refresh-quota-periods")
async def refresh_quota_periods_endpoint(
    organization_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
    __: dict = Depends(check_organization_admin),
):
    """Refresh quota periods for all users in an organization"""
    try:
        refresh_quota_periods_for_organization(db, organization_id)

        return {
            "message": "Successfully refreshed quota periods for all users",
            "organization_id": organization_id,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to refresh quota periods: {str(e)}"
        )
