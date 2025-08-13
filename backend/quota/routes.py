from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from config import get_db
from auth.utils import get_current_user
from models import (
    OrganizationQuotaResponse,
    UpdateQuotaRequest,
    GPUUsageLogResponse,
    QuotaUsageResponse,
)
from db_models import GPUUsageLog
from quota.utils import (
    get_or_create_organization_quota,
    get_or_create_quota_period,
    get_gpu_usage_summary,
    sync_gpu_usage_from_cost_report,
)

router = APIRouter(prefix="/quota")


@router.get("/organization/{organization_id}", response_model=OrganizationQuotaResponse)
async def get_organization_quota(
    organization_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get organization quota and current usage"""
    try:
        # Get or create organization quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Get or create current period
        current_period = get_or_create_quota_period(db, organization_id)

        # Calculate usage percentage
        usage_percentage = (
            (current_period.gpu_hours_used / current_period.gpu_hours_limit) * 100
            if current_period.gpu_hours_limit > 0
            else 0
        )

        return OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_gpu_hours=org_quota.monthly_gpu_hours,
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
    """Update organization quota"""
    try:
        # Get or create organization quota
        org_quota = get_or_create_organization_quota(db, organization_id)

        # Update the quota
        org_quota.monthly_gpu_hours = request.monthly_gpu_hours
        org_quota.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(org_quota)

        # Update current period limit
        current_period = get_or_create_quota_period(db, organization_id)
        current_period.gpu_hours_limit = request.monthly_gpu_hours
        current_period.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(current_period)

        # Calculate usage percentage
        usage_percentage = (
            (current_period.gpu_hours_used / current_period.gpu_hours_limit) * 100
            if current_period.gpu_hours_limit > 0
            else 0
        )

        return OrganizationQuotaResponse(
            organization_id=organization_id,
            monthly_gpu_hours=org_quota.monthly_gpu_hours,
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
    """Get organization quota and recent usage logs"""
    try:
        # Get organization quota
        quota_response = await get_organization_quota(organization_id, user, db)

        # Get recent usage logs
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
            total_usage_this_period=quota_response.gpu_hours_used,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage: {str(e)}")


@router.get("/check-quota/{organization_id}")
async def check_quota_availability(
    organization_id: str,
    estimated_hours: float = 1.0,
    gpu_count: int = 1,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if organization has enough quota for a new cluster"""
    try:
        quota_response = await get_organization_quota(organization_id, user, db)

        required_hours = estimated_hours * gpu_count
        has_quota = quota_response.gpu_hours_remaining >= required_hours

        return {
            "has_quota": has_quota,
            "required_hours": required_hours,
            "available_hours": quota_response.gpu_hours_remaining,
            "current_usage": quota_response.gpu_hours_used,
            "quota_limit": quota_response.monthly_gpu_hours,
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
    """Get detailed GPU usage summary for an organization"""
    try:
        summary = get_gpu_usage_summary(db, organization_id)
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get usage summary: {str(e)}"
        )
