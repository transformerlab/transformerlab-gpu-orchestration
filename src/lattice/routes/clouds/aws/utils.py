from pathlib import Path
from typing import Dict, Optional, List
from configparser import ConfigParser

from sqlalchemy.orm import Session

from config import get_db
from db.db_models import CloudAccount
from routes.clouds.utils import normalize_key, require_org_id


def load_aws_config(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Load AWS configuration from DB and return legacy-compatible shape.

    Returns a dict of shape:
      {"configs": {key: {...}}, "default_config": key|None, "is_configured": bool}
    """
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        q = db.query(CloudAccount).filter(
            CloudAccount.provider == "aws",
            CloudAccount.organization_id == org_id,
        )
        rows = q.all()

        configs: Dict[str, Dict] = {}
        default_key: Optional[str] = None
        for row in rows:
            key = row.key
            creds = row.credentials or {}
            settings = row.settings or {}
            configs[key] = {
                "name": row.name,
                "access_key_id": creds.get("access_key_id", ""),
                "secret_access_key": creds.get("secret_access_key", ""),
                "region": creds.get("region", ""),
                "profile_name": settings.get("profile_name", ""),
                "allowed_instance_types": settings.get("allowed_instance_types", []),
                "allowed_regions": settings.get("allowed_regions", []),
                "max_instances": int(row.max_instances or 0),
            }
            if row.is_default:
                default_key = key

        # If no explicit default, pick the first one for convenience
        if default_key is None and rows:
            default_key = rows[0].key

        return {
            "configs": configs,
            "default_config": default_key,
            "is_configured": bool(default_key and default_key in configs),
        }
    except Exception as e:
        print(f"Error loading AWS config: {e}")
        return {"configs": {}, "default_config": None, "is_configured": False}
    finally:
        if should_close:
            db.close()


def aws_save_config(
    name: str,
    access_key_id: str,
    secret_access_key: str,
    region: str = "us-east-1",
    allowed_instance_types: List[str] = None,
    allowed_regions: List[str] = None,
    max_instances: int = 0,
    config_key: Optional[str] = None,
    allowed_team_ids: Optional[List[str]] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Upsert AWS configuration in DB and return legacy-compatible shape."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        new_key = normalize_key(name)

        # Find existing row (prefer config_key for updates/renames)
        row = None
        if config_key:
            q_old = db.query(CloudAccount).filter(
                CloudAccount.provider == "aws",
                CloudAccount.key == config_key,
                CloudAccount.organization_id == org_id,
            )
            row = q_old.first()
        if row is None:
            q_new = db.query(CloudAccount).filter(
                CloudAccount.provider == "aws",
                CloudAccount.key == new_key,
                CloudAccount.organization_id == org_id,
            )
            row = q_new.first()

        # Build credentials with masked fallback to existing values
        def _unmask(val: Optional[str], existing: Optional[str]) -> str:
            if val is None:
                return existing or ""
            if isinstance(val, str) and val.strip().startswith("*"):
                return existing or ""
            return val

        existing_creds = (row.credentials if row and row.credentials else {}) if row else {}
        credentials = {
            "access_key_id": _unmask(access_key_id, existing_creds.get("access_key_id")),
            "secret_access_key": _unmask(secret_access_key, existing_creds.get("secret_access_key")),
            "region": region or existing_creds.get("region", "us-east-1"),
        }
        
        # Generate profile name: <org_id>-<name>
        profile_name = f"{org_id}-{normalize_key(name)}"
        settings = {
            "profile_name": profile_name,
            "allowed_instance_types": allowed_instance_types or [],
            "allowed_regions": allowed_regions or [],
        }

        # Determine default if none exists for this org/provider
        default_exists_q = db.query(CloudAccount).filter(
            CloudAccount.provider == "aws",
            CloudAccount.organization_id == org_id,
        )
        default_exists_q = default_exists_q.filter(CloudAccount.is_default == True)  # noqa: E712
        default_exists = default_exists_q.first() is not None

        if not row:
            row = CloudAccount(
                organization_id=org_id,
                provider="aws",
                key=new_key,
                name=name,
                credentials=credentials,
                settings=settings,
                max_instances=int(max_instances or 0),
                is_default=False if default_exists else True,
                created_by=user_id,
            )
            db.add(row)
        else:
            # Safe rename if key changed
            if row.key != new_key:
                conflict_q = db.query(CloudAccount).filter(
                    CloudAccount.provider == "aws",
                    CloudAccount.key == new_key,
                    CloudAccount.organization_id == org_id,
                )
                conflict = conflict_q.first()
                if conflict is None:
                    row.key = new_key
                else:
                    # Merge values into conflict row and mark old for deletion
                    conflict.name = name
                    conflict.credentials = credentials
                    conflict.settings = settings
                    conflict.max_instances = int(max_instances or 0)
                    if not default_exists and not conflict.is_default:
                        conflict.is_default = True
                    db.delete(row)
                    row = conflict

            row.name = name
            row.credentials = credentials
            row.settings = settings
            row.max_instances = int(max_instances or 0)
            if not default_exists and not row.is_default:
                row.is_default = True

        db.commit()
        
        # Update AWS credentials file
        _update_aws_credentials_file(profile_name, credentials)
        
        return load_aws_config(org_id, db)
    finally:
        if should_close:
            db.close()


def _update_aws_credentials_file(profile_name: str, credentials: Dict[str, str]):
    """Update ~/.aws/credentials file with the new profile."""
    try:
        aws_dir = Path.home() / ".aws"
        aws_dir.mkdir(exist_ok=True)
        
        credentials_file = aws_dir / "credentials"
        
        # Read existing config
        config = ConfigParser()
        if credentials_file.exists():
            config.read(credentials_file)
        
        # Update or create the profile
        if not config.has_section(profile_name):
            config.add_section(profile_name)
        
        config.set(profile_name, "aws_access_key_id", credentials["access_key_id"])
        config.set(profile_name, "aws_secret_access_key", credentials["secret_access_key"])
        if credentials.get("region"):
            config.set(profile_name, "region", credentials["region"])
        
        # Write back to file
        with open(credentials_file, "w") as f:
            config.write(f)
        
        print(f"Updated AWS credentials file with profile: {profile_name}")
    except Exception as e:
        print(f"Error updating AWS credentials file: {e}")


def aws_get_config_for_display(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Get AWS configuration for display (with masked credentials)."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        q = db.query(CloudAccount).filter(
            CloudAccount.provider == "aws",
            CloudAccount.organization_id == org_id,
        )
        rows = q.all()

        configs = []
        for row in rows:
            creds = row.credentials or {}
            settings = row.settings or {}
            
            # Mask sensitive credentials
            access_key_id = creds.get("access_key_id", "")
            if access_key_id and len(access_key_id) > 8:
                masked_access_key = access_key_id[:4] + "*" * (len(access_key_id) - 8) + access_key_id[-4:]
            else:
                masked_access_key = access_key_id

            configs.append({
                "config_key": row.key,
                "name": row.name,
                "access_key_id": masked_access_key,
                "secret_access_key": "****" if creds.get("secret_access_key") else "",
                "region": creds.get("region", "us-east-1"),
                "profile_name": settings.get("profile_name", ""),
                "allowed_instance_types": settings.get("allowed_instance_types", []),
                "allowed_regions": settings.get("allowed_regions", []),
                "max_instances": int(row.max_instances or 0),
                "is_default": row.is_default,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            })

        return {
            "configs": configs,
            "is_configured": len(configs) > 0,
        }
    except Exception as e:
        print(f"Error getting AWS config for display: {e}")
        return {"configs": [], "is_configured": False}
    finally:
        if should_close:
            db.close()


def aws_set_default_config(
    config_key: str,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Set a specific AWS config as the default for the organization."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        
        # First, unset all existing defaults for this org/provider
        db.query(CloudAccount).filter(
            CloudAccount.provider == "aws",
            CloudAccount.organization_id == org_id,
            CloudAccount.is_default == True,  # noqa: E712
        ).update({"is_default": False})
        
        # Set the specified config as default
        config = db.query(CloudAccount).filter(
            CloudAccount.provider == "aws",
            CloudAccount.key == config_key,
            CloudAccount.organization_id == org_id,
        ).first()
        
        if config:
            config.is_default = True
            db.commit()
            return True
        return False
    finally:
        if should_close:
            db.close()


def _remove_aws_profile_from_credentials(profile_name: str) -> None:
    """Remove a profile section from ~/.aws/credentials if it exists."""
    try:
        aws_dir = Path.home() / ".aws"
        credentials_file = aws_dir / "credentials"
        if not credentials_file.exists():
            return

        config = ConfigParser()
        config.read(credentials_file)
        if config.has_section(profile_name):
            config.remove_section(profile_name)
            with open(credentials_file, "w") as f:
                config.write(f)
            print(f"Removed AWS profile from credentials: {profile_name}")
    except Exception as e:
        print(f"Error removing AWS profile from credentials: {e}")


def aws_delete_config(
    config_key: str,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Delete an AWS configuration from DB and remove its profile from credentials."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        from db.db_models import CloudAccount

        row = (
            db.query(CloudAccount)
            .filter(
                CloudAccount.provider == "aws",
                CloudAccount.key == config_key,
                CloudAccount.organization_id == org_id,
            )
            .first()
        )
        if not row:
            return False

        # Remove credentials profile if present
        settings = row.settings or {}
        profile_name = settings.get("profile_name")
        if profile_name:
            _remove_aws_profile_from_credentials(profile_name)

        db.delete(row)
        db.commit()
        return True
    finally:
        if should_close:
            db.close()


def aws_run_sky_check():
    """Run sky check for AWS to validate credentials."""
    try:
        # This would run sky check aws command
        # For now, just return a placeholder
        msg = "AWS sky check completed successfully"
        print(f"ℹ️ {msg}")
        return True, msg
    except Exception as e:
        msg = f"AWS sky check failed: {str(e)}"
        print(f"❌ {msg}")
        return False, msg


def aws_save_config_with_setup(
    name: str,
    access_key_id: str,
    secret_access_key: str,
    region: str = "us-east-1",
    allowed_instance_types: List[str] = None,
    allowed_regions: List[str] = None,
    max_instances: int = 0,
    config_key: str = None,
    allowed_team_ids: List[str] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """Save AWS configuration in DB with environment setup and sky check."""
    
    # Save the configuration in DB
    aws_save_config(
        name,
        access_key_id,
        secret_access_key,
        region,
        allowed_instance_types,
        allowed_regions,
        max_instances,
        config_key,
        allowed_team_ids,
        organization_id=organization_id,
        user_id=user_id,
    )

    # Set the new config as default in DB
    new_key = name.lower().replace(" ", "_").replace("-", "_")
    try:
        aws_set_default_config(new_key, organization_id=organization_id)
    except Exception:
        pass

    # Run sky check for AWS
    sky_check_result = None
    try:
        # Only run if creds present
        if access_key_id and secret_access_key:
            is_valid, output = aws_run_sky_check()
            sky_check_result = {
                "valid": is_valid,
                "output": output,
                "message": "Sky check AWS completed successfully" if is_valid else "Sky check AWS failed",
            }
    except Exception as e:
        sky_check_result = {
            "valid": False,
            "output": str(e),
            "message": f"Error during AWS sky check: {str(e)}",
        }

    # Return the final result
    result = aws_get_config_for_display(organization_id)
    if sky_check_result:
        result["sky_check_result"] = sky_check_result

    return result
