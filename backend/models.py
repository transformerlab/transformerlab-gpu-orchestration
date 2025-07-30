from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class LoginResponse(BaseModel):
    user: dict
    success: bool


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class Organization(BaseModel):
    id: str
    name: str
    object: str = "organization"


class OrganizationsResponse(BaseModel):
    organizations: List[Organization]
    current_organization_id: Optional[str] = None


class SSHNode(BaseModel):
    ip: str
    user: str
    identity_file: Optional[str] = None
    password: Optional[str] = None


class ClusterRequest(BaseModel):
    cluster_name: str
    user: Optional[str] = None
    identity_file: Optional[str] = None
    password: Optional[str] = None


class AddNodeRequest(BaseModel):
    cluster_name: str
    node: SSHNode


class ClusterResponse(BaseModel):
    cluster_name: str
    nodes: List[SSHNode]


class ClustersListResponse(BaseModel):
    clusters: List[str]


class LaunchClusterRequest(BaseModel):
    cluster_name: str
    command: str = "echo 'Hello SkyPilot'"
    setup: Optional[str] = None
    cloud: Optional[str] = None
    instance_type: Optional[str] = None
    cpus: Optional[str] = None
    memory: Optional[str] = None
    accelerators: Optional[str] = None
    region: Optional[str] = None
    zone: Optional[str] = None
    use_spot: bool = False
    idle_minutes_to_autostop: Optional[int] = None
    python_filename: Optional[str] = None
    launch_mode: Optional[str] = None  # "jupyter", "vscode", "ssh", "custom"
    jupyter_port: Optional[int] = None
    vscode_port: Optional[int] = None


class LaunchClusterResponse(BaseModel):
    request_id: str
    cluster_name: str
    message: str
    port_forward_info: Optional[dict] = None


class PortForwardInfo(BaseModel):
    cluster_name: str
    local_port: int
    remote_port: int
    service_type: str  # "jupyter", "vscode"
    access_url: str


class ClusterStatusResponse(BaseModel):
    cluster_name: str
    status: str
    launched_at: Optional[int] = None
    last_use: Optional[str] = None
    autostop: Optional[int] = None
    to_down: Optional[bool] = None
    resources_str: Optional[str] = None


class StatusResponse(BaseModel):
    clusters: List[ClusterStatusResponse]


class JobRecord(BaseModel):
    job_id: int
    job_name: str
    username: str
    submitted_at: float
    start_at: Optional[float] = None
    end_at: Optional[float] = None
    resources: str
    status: str
    log_path: str


class JobQueueResponse(BaseModel):
    jobs: List[JobRecord]


class JobLogsResponse(BaseModel):
    job_id: int
    logs: str


class StopClusterRequest(BaseModel):
    cluster_name: str


class StopClusterResponse(BaseModel):
    request_id: str
    cluster_name: str
    message: str


class DownClusterRequest(BaseModel):
    cluster_name: str


class DownClusterResponse(BaseModel):
    request_id: str
    cluster_name: str
    message: str


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
