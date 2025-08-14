from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from config import get_db
from auth.utils import get_current_user
from models import (
    OrganizationQuotaResponse,
    UpdateQuotaRequest,
    GPUUsageLogResponse,
    QuotaUsageResponse,
    OrganizationUserUsageResponse,
    UserQuotaResponse,
    UpdateUserQuotaRequest,
    UserQuotaListResponse,
    CreateUserQuotaRequest,
)
from db_models import GPUUsageLog, OrganizationQuota
from quota.utils import (
    get_or_create_organization_quota,
    get_or_create_quota_period,
    get_gpu_usage_summary,
    get_organization_user_usage_summary,
    sync_gpu_usage_from_cost_report,
    get_current_period_dates,
    get_or_create_user_quota,
    get_user_quota_limit,
    update_user_quota,
    delete_user_quota,
    get_all_user_quotas,
    populate_user_quotas_for_organization,
)

router = APIRouter(prefix="/quota")


@router.get("/organization/{organization_id}", response_model=OrganizationQuotaResponse)
async def get_organization_quota(
    organization_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get organization quota and current user's usage"""
    try:
        # Get or create organization quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Get or create current period for the current user
        current_period = get_or_create_quota_period(db, organization_id, user["id"])

        # Calculate usage percentage
        usage_percentage = (
            (current_period.gpu_hours_used / current_period.gpu_hours_limit) * 100
            if current_period.gpu_hours_limit > 0
            else 0
        )

        return OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_gpu_hours_per_user=current_period.gpu_hours_limit,  # Use user's actual limit
            current_period_start=current_period.period_start.isoformat(),
            current_period_end=current_period.period_end.isoformat(),
            gpu_hours_used=current_period.gpu_hours_used,
            gpu_hours_remaining=max(
                0, current_period.gpu_hours_limit - current_period.gpu_hours_used
            ),
            usage_percentage=min(100, usage_percentage),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get quota: {str(e)}")


@router.put("/organization/{organization_id}", response_model=OrganizationQuotaResponse)
async def update_organization_quota(
    organization_id: str,
    request: UpdateQuotaRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update organization quota per user"""
    try:
        # Get or create organization quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Update the quota per user
        org_quota.monthly_gpu_hours_per_user = request.monthly_gpu_hours_per_user
        org_quota.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(org_quota)

        # Update current period limit for the current user
        current_period = get_or_create_quota_period(db, organization_id, user["id"])
        current_period.gpu_hours_limit = request.monthly_gpu_hours_per_user
        current_period.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_period)

        # Update all non-custom user quotas to the new organization default
        from quota.utils import get_all_user_quotas

        user_quotas = get_all_user_quotas(db, organization_id)
        for user_quota in user_quotas:
            if not user_quota.custom_quota:
                user_quota.monthly_gpu_hours_per_user = (
                    request.monthly_gpu_hours_per_user
                )
                user_quota.updated_at = datetime.utcnow()
        db.commit()

        # Calculate usage percentage
        usage_percentage = (
            (current_period.gpu_hours_used / current_period.gpu_hours_limit) * 100
            if current_period.gpu_hours_limit > 0
            else 0
        )

        return OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_gpu_hours_per_user=org_quota.monthly_gpu_hours_per_user,
            current_period_start=current_period.period_start.isoformat(),
            current_period_end=current_period.period_end.isoformat(),
            gpu_hours_used=current_period.gpu_hours_used,
            gpu_hours_remaining=max(
                0, current_period.gpu_hours_limit - current_period.gpu_hours_used
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
            from utils.file_utils import get_cluster_user_info

            user_info = get_cluster_user_info(log.cluster_name)

            recent_usage.append(
                GPUUsageLogResponse(
                    id=log.id,
                    organization_id=log.organization_id,
                    user_id=log.user_id,
                    user_email=user_info.get("email") if user_info else None,
                    user_name=user_info.get("name") if user_info else None,
                    cluster_name=log.cluster_name,
                    job_id=log.job_id,
                    gpu_count=log.gpu_count,
                    start_time=log.start_time.isoformat(),
                    end_time=log.end_time.isoformat() if log.end_time else None,
                    duration_hours=log.duration_hours,
                    instance_type=log.instance_type,
                    cloud_provider=log.cloud_provider,
                    cost_estimate=log.cost_estimate,
                )
            )

        return QuotaUsageResponse(
            organization_quota=quota_response,
            recent_usage=recent_usage,
            total_usage_this_period=quota_response.gpu_hours_used,
        )
    except Exception as e:
        print(f"Failed to get usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get usage: {str(e)}")


@router.get("/check-quota/{organization_id}")
async def check_quota_availability(
    organization_id: str,
    estimated_hours: float = 1.0,
    gpu_count: int = 1,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if user has enough quota for a new cluster"""
    try:
        quota_response = await get_organization_quota(organization_id, user, db)

        required_hours = estimated_hours * gpu_count
        has_quota = quota_response.gpu_hours_remaining >= required_hours

        return {
            "has_quota": has_quota,
            "required_hours": required_hours,
            "available_hours": quota_response.gpu_hours_remaining,
            "current_usage": quota_response.gpu_hours_used,
            "quota_limit": quota_response.monthly_gpu_hours_per_user,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check quota: {str(e)}")


@router.post("/sync-from-cost-report")
async def sync_usage_from_cost_report(
    user=Depends(get_current_user), db: Session = Depends(get_db)
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
    organization_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)
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
    organization_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)
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
    "/organization/{organization_id}/usage/all", response_model=QuotaUsageResponse
)
async def get_all_organization_usage(
    organization_id: str,
    limit: int = 50,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get organization-wide usage data for all users"""
    try:
        # Get organization quota info (per-user quota)
        org_quota = get_or_create_organization_quota(db, organization_id)
        period_start, period_end = get_current_period_dates()

        # Calculate total organization usage
        total_org_usage = (
            db.query(GPUUsageLog)
            .filter(
                GPUUsageLog.organization_id == organization_id,
                GPUUsageLog.start_time
                >= datetime.combine(period_start, datetime.min.time()),
                GPUUsageLog.start_time
                <= datetime.combine(period_end, datetime.max.time()),
                GPUUsageLog.duration_hours.isnot(None),
            )
            .with_entities(func.sum(GPUUsageLog.duration_hours * GPUUsageLog.gpu_count))
            .scalar()
            or 0.0
        )

        # Create a mock quota response for organization view
        quota_response = OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_gpu_hours_per_user=org_quota.monthly_gpu_hours_per_user,
            current_period_start=period_start.isoformat(),
            current_period_end=period_end.isoformat(),
            gpu_hours_used=total_org_usage,
            gpu_hours_remaining=0.0,  # Not applicable for org-wide view
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
            from utils.file_utils import get_cluster_user_info

            user_info = get_cluster_user_info(log.cluster_name)

            recent_usage.append(
                GPUUsageLogResponse(
                    id=log.id,
                    organization_id=log.organization_id,
                    user_id=log.user_id,
                    user_email=user_info.get("email") if user_info else None,
                    user_name=user_info.get("name") if user_info else None,
                    cluster_name=log.cluster_name,
                    job_id=log.job_id,
                    gpu_count=log.gpu_count,
                    start_time=log.start_time.isoformat(),
                    end_time=log.end_time.isoformat() if log.end_time else None,
                    duration_hours=log.duration_hours,
                    instance_type=log.instance_type,
                    cloud_provider=log.cloud_provider,
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
    organization_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all user quotas for an organization"""
    try:
        # Get organization default quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Get all user quotas
        user_quotas = get_all_user_quotas(db, organization_id)

        # Get user information from auth provider
        from auth.provider.work_os import provider as auth_provider

        users = []
        for user_quota in user_quotas:
            try:
                user_info = auth_provider.get_user(user_id=user_quota.user_id)
                users.append(
                    UserQuotaResponse(
                        user_id=user_quota.user_id,
                        user_email=user_info.email,
                        user_name=f"{user_info.first_name or ''} {user_info.last_name or ''}".strip(),
                        organization_id=user_quota.organization_id,
                        monthly_gpu_hours_per_user=user_quota.monthly_gpu_hours_per_user,
                        custom_quota=user_quota.custom_quota,
                        created_at=user_quota.created_at.isoformat(),
                        updated_at=user_quota.updated_at.isoformat(),
                    )
                )
            except Exception as e:
                # If we can't get user info, still include the quota
                users.append(
                    UserQuotaResponse(
                        user_id=user_quota.user_id,
                        user_email=None,
                        user_name=None,
                        organization_id=user_quota.organization_id,
                        monthly_gpu_hours_per_user=user_quota.monthly_gpu_hours_per_user,
                        custom_quota=user_quota.custom_quota,
                        created_at=user_quota.created_at.isoformat(),
                        updated_at=user_quota.updated_at.isoformat(),
                    )
                )

        return UserQuotaListResponse(
            organization_id=organization_id,
            users=users,
            default_quota_per_user=org_quota.monthly_gpu_hours_per_user,
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
):
    """Get quota for a specific user"""
    try:
        user_quota = get_or_create_user_quota(db, organization_id, user_id)

        # Get user information from auth provider
        from auth.provider.work_os import provider as auth_provider

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
            monthly_gpu_hours_per_user=user_quota.monthly_gpu_hours_per_user,
            custom_quota=user_quota.custom_quota,
            created_at=user_quota.created_at.isoformat(),
            updated_at=user_quota.updated_at.isoformat(),
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
):
    """Update quota for a specific user"""
    try:
        updated_quota = update_user_quota(
            db, organization_id, user_id, request.monthly_gpu_hours_per_user
        )

        # Get user information from auth provider
        from auth.provider.work_os import provider as auth_provider

        try:
            user_info = auth_provider.get_user(user_id=updated_quota.user_id)
            user_name = (
                f"{user_info.first_name or ''} {user_info.last_name or ''}".strip()
            )
            user_email = user_info.email
        except Exception:
            user_name = None
            user_email = None

        return UserQuotaResponse(
            user_id=updated_quota.user_id,
            user_email=user_email,
            user_name=user_name,
            organization_id=updated_quota.organization_id,
            monthly_gpu_hours_per_user=updated_quota.monthly_gpu_hours_per_user,
            custom_quota=updated_quota.custom_quota,
            created_at=updated_quota.created_at.isoformat(),
            updated_at=updated_quota.updated_at.isoformat(),
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
):
    """Delete user quota, reverting to organization default"""
    try:
        success = delete_user_quota(db, organization_id, user_id)

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
            monthly_gpu_hours_per_user=request.monthly_gpu_hours_per_user,
            custom_quota=True,
        )
        db.add(new_quota)
        db.commit()
        db.refresh(new_quota)

        # Get user information from auth provider
        from auth.provider.work_os import provider as auth_provider

        try:
            user_info = auth_provider.get_user(user_id=new_quota.user_id)
            user_name = (
                f"{user_info.first_name or ''} {user_info.last_name or ''}".strip()
            )
            user_email = user_info.email
        except Exception:
            user_name = None
            user_email = None

        return UserQuotaResponse(
            user_id=new_quota.user_id,
            user_email=user_email,
            user_name=user_name,
            organization_id=new_quota.organization_id,
            monthly_gpu_hours_per_user=new_quota.monthly_gpu_hours_per_user,
            custom_quota=new_quota.custom_quota,
            created_at=new_quota.created_at.isoformat(),
            updated_at=new_quota.updated_at.isoformat(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create user quota: {str(e)}"
        )


@router.post("/organization/{organization_id}/populate-user-quotas")
async def populate_user_quotas_endpoint(
    organization_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)
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
