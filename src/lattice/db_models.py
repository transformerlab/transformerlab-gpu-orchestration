from sqlalchemy import (
    Column,
    String,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    JSON,
    Integer,
    Float,
    Date,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from config import Base
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    name = Column(String, nullable=False)  # Human-readable name for the key
    key_hash = Column(
        String, nullable=False, unique=True
    )  # Hashed version of the API key
    key_prefix = Column(String, nullable=False)  # First 8 characters for identification
    user_id = Column(String, nullable=False)
    organization_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Optional expiration
    scopes = Column(Text, nullable=True)  # JSON string of permissions/scopes

    @staticmethod
    def hash_key(api_key: str) -> str:
        """Hash an API key for secure storage"""
        return hashlib.sha256(api_key.encode()).hexdigest()

    @staticmethod
    def generate_api_key() -> tuple[str, str, str]:
        """Generate a new API key and return (full_key, hash, prefix)"""
        # Generate a secure random key
        key = f"lk_{secrets.token_urlsafe(32)}"  # lk = lattice key
        key_hash = APIKey.hash_key(key)
        key_prefix = key[:8]  # Store first 8 chars for identification
        return key, key_hash, key_prefix

    def is_expired(self) -> bool:
        """Check if the API key is expired"""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    def update_last_used(self):
        """Update the last_used_at timestamp"""
        self.last_used_at = datetime.utcnow()


class SSHNodePool(Base):
    __tablename__ = "ssh_node_pools"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    # Cluster/pool name used by SkyPilot (must be unique)
    name = Column(String, nullable=False, unique=True)
    # Optional defaults applied to nodes in this pool
    default_user = Column(String, nullable=True)
    identity_file_path = Column(Text, nullable=True)
    # Note: storing passwords in plaintext is discouraged; prefer key-based auth
    password = Column(Text, nullable=True)
    # Resource specifications for nodes in this pool (JSON format)
    resources = Column(JSON, nullable=True)  # e.g., {"vcpus": "4", "memory_gb": "16"}
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class SSHNodeEntry(Base):
    __tablename__ = "ssh_nodes"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    pool_id = Column(
        String, ForeignKey("ssh_node_pools.id", ondelete="CASCADE"), nullable=False
    )
    ip = Column(String, nullable=False)
    user = Column(String, nullable=True)
    identity_file_path = Column(Text, nullable=True)
    # Note: storing passwords in plaintext is discouraged; prefer key-based auth
    password = Column(Text, nullable=True)
    # Resource specifications for this specific node (JSON format)
    resources = Column(JSON, nullable=True)  # e.g., {"vcpus": "4", "memory_gb": "16"}
    created_at = Column(DateTime, default=func.now())


class OrganizationQuota(Base):
    __tablename__ = "organization_quotas"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    organization_id = Column(String, nullable=False)
    user_id = Column(
        String, nullable=True
    )  # NULL for org-wide default, user_id for per-user quota
    monthly_gpu_hours_per_user = Column(
        Float, nullable=False, default=100.0
    )  # GPU hours per month per user
    custom_quota = Column(Boolean, default=False)  # True if this is a custom user quota
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Composite unique constraint to ensure one quota per user per organization
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_quotas_org_user"),
    )


class QuotaPeriod(Base):
    __tablename__ = "quota_periods"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    organization_id = Column(String, nullable=False)
    user_id = Column(
        String, nullable=True
    )  # NULL for org-wide periods, user_id for per-user periods
    period_start = Column(Date, nullable=False)  # First day of the billing period
    period_end = Column(Date, nullable=False)  # Last day of the billing period
    gpu_hours_used = Column(Float, default=0.0)  # Total GPU hours used in this period
    gpu_hours_limit = Column(Float, nullable=False)  # Quota limit for this period
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class GPUUsageLog(Base):
    __tablename__ = "gpu_usage_logs"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    organization_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    cluster_name = Column(String, nullable=False)
    job_id = Column(Integer, nullable=True)  # Optional job ID if this was a job
    gpu_count = Column(Integer, nullable=False, default=1)  # Number of GPUs used
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)  # NULL if still running
    duration_hours = Column(Float, nullable=True)  # Calculated duration in hours
    instance_type = Column(String, nullable=True)  # e.g., "g4dn.xlarge", "V100"
    cloud_provider = Column(String, nullable=True)  # e.g., "aws", "azure", "gcp"
    cost_estimate = Column(Float, nullable=True)  # Estimated cost in USD
    created_at = Column(DateTime, default=func.now())


class StorageBucket(Base):
    __tablename__ = "storage_buckets"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    name = Column(
        String, nullable=False, unique=True
    )  # Human-readable name for the bucket
    remote_path = Column(
        String, nullable=False
    )  # Mount path on the VM (e.g., /mnt/data)
    source = Column(String, nullable=True)  # Source path (local path or bucket URI)
    store = Column(
        String, nullable=True
    )  # Storage provider (s3, gcs, azure, r2, ibm, oci)
    persistent = Column(
        Boolean, default=True
    )  # Whether bucket persists after task completion
    mode = Column(String, default="MOUNT")  # MOUNT, COPY, or MOUNT_CACHED
    organization_id = Column(String, nullable=False)
    created_by = Column(String, nullable=False)  # User ID who created the bucket
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    is_active = Column(
        Boolean, default=True
    )  # Whether the bucket is active and available


class SSHKey(Base):
    __tablename__ = "ssh_keys"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    user_id = Column(String, nullable=False)  # WorkOS user ID
    name = Column(String, nullable=False)  # Human-readable name for the key
    public_key = Column(Text, nullable=False)  # The SSH public key content
    fingerprint = Column(
        String, nullable=False, unique=True
    )  # SHA256 fingerprint for deduplication
    key_type = Column(String, nullable=False)  # ssh-rsa, ssh-ed25519, etc.
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_used_at = Column(
        DateTime, nullable=True
    )  # Track when key was last used for SSH
    is_active = Column(Boolean, default=True)  # Whether the key is active

    # Composite unique constraint to prevent duplicate key names per user
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_ssh_keys_user_name"),
    )

    @staticmethod
    def generate_fingerprint(public_key: str) -> str:
        """Generate SHA256 fingerprint for SSH public key"""
        import hashlib
        import base64

        # Remove key type and comment, keep only the key data
        parts = public_key.strip().split()
        if len(parts) < 2:
            raise ValueError("Invalid SSH public key format")

        key_data = parts[1]
        key_bytes = base64.b64decode(key_data)
        fingerprint = hashlib.sha256(key_bytes).hexdigest()
        return f"SHA256:{fingerprint}"

    def update_last_used(self):
        """Update the last_used_at timestamp"""
        self.last_used_at = datetime.utcnow()


class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    name = Column(String, nullable=False)
    organization_id = Column(String, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Team name must be unique within an organization
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_teams_org_name"),
    )


class TeamMembership(Base):
    __tablename__ = "team_memberships"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    team_id = Column(String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False)
    organization_id = Column(String, nullable=False)  # Denormalized for constraint
    created_at = Column(DateTime, default=func.now())

    # A user can only be in one team per organization (not globally)
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_team_memberships_org_user"),
    )


class TeamQuota(Base):
    __tablename__ = "team_quotas"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    organization_id = Column(String, nullable=False)
    team_id = Column(String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    monthly_gpu_hours_per_user = Column(Float, nullable=False, default=100.0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Composite unique constraint to ensure one quota per team per organization
    __table_args__ = (
        UniqueConstraint("organization_id", "team_id", name="uq_team_quotas_org_team"),
    )
    
class ContainerRegistry(Base):
    __tablename__ = "container_registries"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    name = Column(String, nullable=False)  # Human-readable name for the registry
    docker_username = Column(String, nullable=False)  # Docker registry username
    docker_password = Column(Text, nullable=False)  # Docker registry password/token
    docker_server = Column(String, nullable=False)  # Docker registry server URL
    organization_id = Column(String, nullable=False)  # Organization that owns this registry
    user_id = Column(String, nullable=False)  # User who created this registry
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)  # Whether the registry is active

    # Registry name must be unique within an organization
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_container_registries_org_name"),
    )


class ClusterPlatform(Base):
    __tablename__ = "cluster_platforms"

    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(16))
    # The actual cluster name used by SkyPilot (with nanoid prefix)
    cluster_name = Column(String, nullable=False, unique=True)
    # The display name that users see and specify
    display_name = Column(String, nullable=False)
    # Platform: runpod, azure, ssh, etc.
    platform = Column(String, nullable=False)
    # Template used for cluster creation
    template = Column(String, nullable=True)
    # User who owns this cluster
    user_id = Column(String, nullable=False)
    # Organization the cluster belongs to
    organization_id = Column(String, nullable=False)
    # User info JSON (name, email, etc.)
    user_info = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Display name must be unique within user+organization scope
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", "display_name", name="uq_cluster_platforms_user_org_display"),
    )
