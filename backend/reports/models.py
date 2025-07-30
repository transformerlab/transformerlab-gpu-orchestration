from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ReportEntry(BaseModel):
    """Base model for a single report entry"""
    timestamp: float
    user_id: str
    value: float
    metadata: Optional[Dict[str, Any]] = None


class UsageReport(BaseModel):
    """Usage report entry - tracks when users use nodes/clusters"""
    timestamp: float
    user_id: str
    cluster_name: str
    node_ip: Optional[str] = None
    job_id: Optional[int] = None
    usage_type: str  # "job_launch", "node_reservation", "interactive_session"
    duration_minutes: Optional[float] = None


class AvailabilityReport(BaseModel):
    """Availability report entry - tracks when nodes/clusters become available"""
    timestamp: float
    user_id: str
    cluster_name: str
    node_ip: Optional[str] = None
    availability_type: str  # "node_added", "cluster_launched", "node_freed"
    total_nodes: int
    available_nodes: int


class JobSuccessReport(BaseModel):
    """Job success report entry - tracks job completion status"""
    timestamp: float
    user_id: str
    cluster_name: str
    job_id: int
    job_name: str
    success: bool
    duration_minutes: Optional[float] = None
    error_message: Optional[str] = None


class ReportData(BaseModel):
    """Aggregated report data for API responses"""
    date: str
    value: float


class ReportsResponse(BaseModel):
    """Response model for reports API"""
    usage: List[ReportData]
    availability: List[ReportData]
    job_success: List[ReportData]
    total_jobs: int
    successful_jobs: int
    total_usage_hours: float
    average_availability_percent: float 