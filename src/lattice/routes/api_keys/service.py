from sqlalchemy.orm import Session
from sqlalchemy import and_
from db_models import APIKey, validate_relationships_before_save, validate_relationships_before_delete
from datetime import datetime, timedelta
from fastapi import HTTPException
from config import SessionLocal
import json
from typing import List, Optional


class APIKeyService:
    @staticmethod
    def get_db():
        db = SessionLocal()
        try:
            return db
        except Exception:
            db.close()
            raise

    @staticmethod
    def close_db(db):
        if db:
            db.close()

    @classmethod
    def create_api_key(
        cls,
        user_id: str,
        name: str,
        organization_id: Optional[str] = None,
        expires_in_days: Optional[int] = None,
        scopes: Optional[List[str]] = None,
        db: Session = None,
    ):
        """Create a new API key for a user"""
        db_provided = db is not None
        if not db_provided:
            db = cls.get_db()

        try:
            # Generate the API key
            api_key, key_hash, key_prefix = APIKey.generate_api_key()

            # Calculate expiration if provided
            expires_at = None
            if expires_in_days:
                expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

            # Serialize scopes to JSON if provided
            scopes_json = None
            if scopes:
                scopes_json = json.dumps(scopes)

            # Create the API key record
            api_key_record = APIKey(
                name=name,
                key_hash=key_hash,
                key_prefix=key_prefix,
                user_id=user_id,
                organization_id=organization_id,
                expires_at=expires_at,
                scopes=scopes_json,
            )

            # Validate relationships before saving
            validate_relationships_before_save(api_key_record, db)

            db.add(api_key_record)
            db.commit()
            db.refresh(api_key_record)

            return api_key, api_key_record

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Failed to create API key: {str(e)}"
            )
        finally:
            if not db_provided:
                cls.close_db(db)

    @classmethod
    def list_api_keys(cls, user_id: str, db: Session = None):
        """List all API keys for a user"""
        db_provided = db is not None
        if not db_provided:
            db = cls.get_db()

        try:
            return (
                db.query(APIKey)
                .filter(APIKey.user_id == user_id)
                .order_by(APIKey.created_at.desc())
                .all()
            )

        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to list API keys: {str(e)}"
            )
        finally:
            if not db_provided:
                cls.close_db(db)

    @classmethod
    def get_api_key(cls, key_id: str, user_id: str, db: Session = None):
        """Get a specific API key by ID"""
        db_provided = db is not None
        if not db_provided:
            db = cls.get_db()

        try:
            api_key = (
                db.query(APIKey)
                .filter(and_(APIKey.id == key_id, APIKey.user_id == user_id))
                .first()
            )

            if not api_key:
                raise HTTPException(status_code=404, detail="API key not found")

            return api_key

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to get API key: {str(e)}"
            )
        finally:
            if not db_provided:
                cls.close_db(db)

    @classmethod
    def update_api_key(
        cls,
        key_id: str,
        user_id: str,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        expires_in_days: Optional[int] = None,
        scopes: Optional[List[str]] = None,
        db: Session = None,
    ):
        """Update an API key"""
        db_provided = db is not None
        if not db_provided:
            db = cls.get_db()

        try:
            api_key = cls.get_api_key(key_id, user_id, db)

            # Update fields if provided
            if name is not None:
                api_key.name = name

            if is_active is not None:
                api_key.is_active = is_active

            if expires_in_days is not None:
                if expires_in_days > 0:
                    api_key.expires_at = datetime.utcnow() + timedelta(
                        days=expires_in_days
                    )
                else:
                    api_key.expires_at = None

            if scopes is not None:
                api_key.scopes = json.dumps(scopes)

            db.commit()
            db.refresh(api_key)

            return api_key

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Failed to update API key: {str(e)}"
            )
        finally:
            if not db_provided:
                cls.close_db(db)

    @classmethod
    def delete_api_key(cls, key_id: str, user_id: str, db: Session = None):
        """Delete an API key"""
        db_provided = db is not None
        if not db_provided:
            db = cls.get_db()

        try:
            api_key = cls.get_api_key(key_id, user_id, db)

            # Validate relationships before deleting
            validate_relationships_before_delete(api_key, db)

            db.delete(api_key)
            db.commit()

            return True

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Failed to delete API key: {str(e)}"
            )
        finally:
            if not db_provided:
                cls.close_db(db)

    @classmethod
    def regenerate_api_key(cls, key_id: str, user_id: str, db: Session = None):
        """Regenerate an API key (creates a new key value but keeps the same record)"""
        db_provided = db is not None
        if not db_provided:
            db = cls.get_db()

        try:
            api_key = cls.get_api_key(key_id, user_id, db)

            # Generate a new key
            new_api_key, new_key_hash, new_key_prefix = APIKey.generate_api_key()

            # Update the existing record
            api_key.key_hash = new_key_hash
            api_key.key_prefix = new_key_prefix
            api_key.last_used_at = None  # Reset last used time

            db.commit()
            db.refresh(api_key)

            return new_api_key, api_key

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Failed to regenerate API key: {str(e)}"
            )
        finally:
            if not db_provided:
                cls.close_db(db)

    @staticmethod
    def parse_scopes(api_key):
        """Helper method to parse scopes from JSON"""
        if api_key.scopes:
            return json.loads(api_key.scopes)
        return None
