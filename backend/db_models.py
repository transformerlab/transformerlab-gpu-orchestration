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
    organization_id = Column(String, nullable=False, unique=True)
    monthly_gpu_hours_per_user = Column(
        Float, nullable=False, default=100.0
    )  # Default 100 GPU hours per month per user
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


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
