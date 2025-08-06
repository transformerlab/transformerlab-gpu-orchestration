from sqlalchemy import Column, String, DateTime, Boolean, Text
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
    key_hash = Column(String, nullable=False, unique=True)  # Hashed version of the API key
    key_prefix = Column(String, nullable=False)  # First 8 characters for identification
    user_id = Column(String, nullable=False)  # WorkOS user ID
    organization_id = Column(String, nullable=True)  # WorkOS organization ID
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
