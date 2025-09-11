from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional
from routes.auth.utils import get_current_user
from routes.reports.utils import get_reports_summary
from models import ReportsResponse

router = APIRouter(
    prefix="/reports", dependencies=[Depends(get_current_user)], tags=["reports"]
)


@router.get("", response_model=ReportsResponse)
async def get_user_reports(
    request: Request, response: Response, days: Optional[int] = 30
):
    """Get all reports for the current user"""
    try:
        user = get_current_user(request, response)
        user_id = user["id"]

        # Get reports summary
        summary = get_reports_summary(user_id, days)

        return ReportsResponse(
            usage=summary["usage"],
            availability=summary["availability"],
            job_success=summary["job_success"],
            total_jobs=summary["total_jobs"],
            successful_jobs=summary["successful_jobs"],
            total_usage_hours=summary["total_usage_hours"],
            average_availability_percent=summary["average_availability_percent"],
        )
    except Exception as e:
        print(f"Failed to get reports: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get reports: {str(e)}")


@router.get("/usage")
async def get_usage_reports(
    request: Request, response: Response, days: Optional[int] = 30
):
    """Get usage reports for the current user"""
    try:
        user = get_current_user(request, response)
        user_id = user["id"]

        from routes.reports.utils import get_usage_data

        usage_data = get_usage_data(user_id, days)

        return {"usage": usage_data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get usage reports: {str(e)}"
        )


@router.get("/availability")
async def get_availability_reports(
    request: Request, response: Response, days: Optional[int] = 30
):
    """Get availability reports for the current user"""
    try:
        user = get_current_user(request, response)
        user_id = user["id"]

        from .utils import get_availability_data

        availability_data = get_availability_data(user_id, days)

        return {"availability": availability_data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get availability reports: {str(e)}"
        )


@router.get("/job-success")
async def get_job_success_reports(
    request: Request, response: Response, days: Optional[int] = 30
):
    """Get job success reports for the current user"""
    try:
        user = get_current_user(request, response)
        user_id = user["id"]

        from .utils import get_job_success_data

        job_success_data = get_job_success_data(user_id, days)

        return {"job_success": job_success_data}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get job success reports: {str(e)}"
        )
