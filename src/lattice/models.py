from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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
    resources: Optional[Dict[str, Any]] = (
        None  # e.g., {"vcpus": "4", "memory_gb": "16"}
    )


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
    user_info: Optional[dict] = None


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


# Quota Management Models
class OrganizationQuotaResponse(BaseModel):
    organization_id: str
    monthly_gpu_hours_per_user: float
    current_period_start: str
    current_period_end: str
    gpu_hours_used: float
    gpu_hours_remaining: float
    usage_percentage: float


class UpdateQuotaRequest(BaseModel):
    monthly_gpu_hours_per_user: float


class UserUsageBreakdown(BaseModel):
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    gpu_hours_used: float
    gpu_hours_limit: float
    gpu_hours_remaining: float
    usage_percentage: float


class OrganizationUserUsageResponse(BaseModel):
    organization_id: str
    period_start: str
    period_end: str
    quota_per_user: float
    total_users: int
    total_organization_usage: float
    user_breakdown: List[UserUsageBreakdown]


class GPUUsageLogResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    cluster_name: str
    job_id: Optional[int] = None
    gpu_count: int
    start_time: str
    end_time: Optional[str] = None
    duration_hours: Optional[float] = None
    instance_type: Optional[str] = None
    cloud_provider: Optional[str] = None
    cost_estimate: Optional[float] = None


class QuotaUsageResponse(BaseModel):
    organization_quota: OrganizationQuotaResponse
    recent_usage: List[GPUUsageLogResponse]
    total_usage_this_period: float


# Individual User Quota Management Models
class UserQuotaResponse(BaseModel):
    user_id: str
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    organization_id: str
    monthly_gpu_hours_per_user: float
    custom_quota: bool
    created_at: str
    updated_at: str


class UpdateUserQuotaRequest(BaseModel):
    monthly_gpu_hours_per_user: float


class UserQuotaListResponse(BaseModel):
    organization_id: str
    users: List[UserQuotaResponse]
    default_quota_per_user: float  # Organization-wide default


class CreateUserQuotaRequest(BaseModel):
    user_id: str
    monthly_gpu_hours_per_user: float


# Storage Bucket Models
class StorageBucketResponse(BaseModel):
    id: str
    name: str
    remote_path: str
    source: Optional[str] = None
    store: Optional[str] = None
    persistent: bool
    mode: str
    organization_id: str
    created_by: str
    created_at: str
    updated_at: str
    is_active: bool


class CreateStorageBucketRequest(BaseModel):
    name: str
    remote_path: str
    source: Optional[str] = None  # Local path or bucket URI
    store: Optional[str] = None  # s3, gcs, azure, r2, ibm, oci
    persistent: bool = True
    mode: str = "MOUNT"  # MOUNT, COPY, or MOUNT_CACHED


class UpdateStorageBucketRequest(BaseModel):
    name: Optional[str] = None
    remote_path: Optional[str] = None
    source: Optional[str] = None
    store: Optional[str] = None
    persistent: Optional[bool] = None
    mode: Optional[str] = None
    is_active: Optional[bool] = None


class StorageBucketListResponse(BaseModel):
    buckets: List[StorageBucketResponse]
    total_count: int


# Container Registry Models
class ContainerRegistryResponse(BaseModel):
    id: str
    name: str
    docker_username: str
    docker_server: str
    organization_id: str
    user_id: str
    created_at: str
    updated_at: str
    is_active: bool


class CreateContainerRegistryRequest(BaseModel):
    name: str
    docker_username: str
    docker_password: str
    docker_server: str


class UpdateContainerRegistryRequest(BaseModel):
    name: Optional[str] = None
    docker_username: Optional[str] = None
    docker_password: Optional[str] = None
    docker_server: Optional[str] = None
    is_active: Optional[bool] = None


class ContainerRegistryListResponse(BaseModel):
    registries: List[ContainerRegistryResponse]
    total_count: int


# SSH Key Models
class SSHKeyResponse(BaseModel):
    id: str
    name: str
    public_key: str
    fingerprint: str
    key_type: str
    created_at: str
    updated_at: str
    last_used_at: Optional[str] = None
    is_active: bool


class CreateSSHKeyRequest(BaseModel):
    name: str
    public_key: str


class UpdateSSHKeyRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class SSHKeyListResponse(BaseModel):
    ssh_keys: List[SSHKeyResponse]
    total_count: int


# Team Models
class TeamMemberResponse(BaseModel):
    user_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture_url: Optional[str] = None


class TeamResponse(BaseModel):
    id: str
    name: str
    organization_id: str
    created_by: str
    created_at: str
    updated_at: str
    members: List[TeamMemberResponse] = Field(default_factory=list)


class TeamListResponse(BaseModel):
    teams: List[TeamResponse]
    total_count: int


class CreateTeamRequest(BaseModel):
    name: str


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = None


class AddTeamMemberRequest(BaseModel):
    user_id: str


class AvailableUser(BaseModel):
    user_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    has_team: Optional[bool] = False


class AvailableUsersResponse(BaseModel):
    users: List[AvailableUser]
