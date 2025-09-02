import subprocess
from typing import List, Dict, Optional

from sqlalchemy.orm import Session

from config import get_db
from db.db_models import CloudAccount
from routes.clouds.utils_shared import normalize_key, require_org_id


def load_azure_config(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Load Azure configuration from DB and return legacy-compatible shape."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        q = db.query(CloudAccount).filter(
            CloudAccount.provider == "azure",
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
                "subscription_id": creds.get("subscription_id", ""),
                "tenant_id": creds.get("tenant_id", ""),
                "client_id": creds.get("client_id", ""),
                "client_secret": creds.get("client_secret", ""),
                "allowed_instance_types": settings.get("allowed_instance_types", []),
                "allowed_regions": settings.get("allowed_regions", []),
                "max_instances": int(row.max_instances or 0),
                "auth_method": creds.get("auth_method", "service_principal"),
            }
            if row.is_default:
                default_key = key

        if default_key is None and rows:
            default_key = rows[0].key

        return {
            "configs": configs,
            "default_config": default_key,
            "is_configured": bool(default_key and default_key in configs),
        }
    except Exception as e:
        print(f"Error loading Azure config from DB: {e}")
        return {"configs": {}, "default_config": None, "is_configured": False}
    finally:
        if should_close:
            db.close()


def az_save_config(
    name: str,
    subscription_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    allowed_instance_types: List[str],
    allowed_regions: List[str],
    max_instances: int = 0,
    config_key: Optional[str] = None,
    allowed_team_ids: Optional[List[str]] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Upsert Azure configuration in DB and return legacy-compatible shape."""
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
                CloudAccount.provider == "azure",
                CloudAccount.key == config_key,
                CloudAccount.organization_id == org_id,
            )
            row = q_old.first()
        if row is None:
            q_new = db.query(CloudAccount).filter(
                CloudAccount.provider == "azure",
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
            "subscription_id": _unmask(subscription_id, existing_creds.get("subscription_id")),
            "tenant_id": _unmask(tenant_id, existing_creds.get("tenant_id")),
            "client_id": _unmask(client_id, existing_creds.get("client_id")),
            "client_secret": _unmask(client_secret, existing_creds.get("client_secret")),
            "auth_method": "service_principal",
        }
        settings = {
            "allowed_instance_types": allowed_instance_types or [],
            "allowed_regions": allowed_regions or [],
        }

        default_exists_q = db.query(CloudAccount).filter(
            CloudAccount.provider == "azure",
            CloudAccount.organization_id == org_id,
        )
        default_exists_q = default_exists_q.filter(CloudAccount.is_default == True)  # noqa: E712
        default_exists = default_exists_q.first() is not None

        if not row:
            row = CloudAccount(
                organization_id=org_id,
                provider="azure",
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
                    CloudAccount.provider == "azure",
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
        return load_azure_config(org_id, db)
    finally:
        if should_close:
            db.close()


def az_get_config_for_display(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Get Azure configuration for display (with masked credentials)"""
    org_id = require_org_id(organization_id)
    config_data = load_azure_config(org_id, db)

    # Return all configs with masked credentials
    display_configs = {}
    for key, config in config_data.get("configs", {}).items():
        display_config = config.copy()

        # Mask sensitive fields to avoid exposing secrets
        def _mask(val: Optional[str]) -> str:
            if not val:
                return ""
            return "********"  # start with * so UI updates can treat as placeholder

        for sens_key in ("subscription_id", "tenant_id", "client_id", "client_secret"):
            if sens_key in display_config:
                display_config[sens_key] = _mask(display_config.get(sens_key))

        display_configs[key] = display_config

    return {
        "configs": display_configs,
        "default_config": config_data.get("default_config"),
        "is_configured": bool(config_data.get("default_config")),
    }


def az_get_current_config(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Get the current default Azure configuration"""
    config_data = load_azure_config(organization_id, db)
    default_key = config_data.get("default_config")
    if default_key and default_key in config_data.get("configs", {}):
        return config_data["configs"][default_key]
    return None


def az_set_default_config(
    config_key: str,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Set a specific Azure config as default and update environment"""
    org_id = require_org_id(organization_id)
    config_data = load_azure_config(org_id, db)

    if config_key not in config_data.get("configs", {}):
        raise ValueError(f"Azure config '{config_key}' not found")

    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        q = db.query(CloudAccount).filter(
            CloudAccount.provider == "azure",
            CloudAccount.organization_id == org_id,
        )
        for row in q.all():
            row.is_default = (row.key == config_key)
        db.commit()

        # Return masked config in response to avoid exposing secrets
        masked = az_get_config_for_display(org_id, db).get("configs", {}).get(config_key, {})
        return {
            "message": f"Azure config '{config_key}' set as default",
            "config": masked,
        }
    finally:
        if should_close:
            db.close()


def az_delete_config(
    config_key: str,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Delete an Azure configuration from DB and maintain default if needed."""
    should_close = False
    org_id = require_org_id(organization_id)
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        target = db.query(CloudAccount).filter(
            CloudAccount.provider == "azure",
            CloudAccount.key == config_key,
            CloudAccount.organization_id == org_id,
        )
        row = target.first()
        if not row:
            raise ValueError(f"Azure config '{config_key}' not found")
        was_default = bool(row.is_default)
        db.delete(row)
        db.commit()

        if was_default:
            q = db.query(CloudAccount).filter(
                CloudAccount.provider == "azure",
                CloudAccount.organization_id == org_id,
            )
            remaining = q.all()
            if remaining:
                remaining[0].is_default = True
                db.commit()

        return load_azure_config(org_id, db)
    finally:
        if should_close:
            db.close()


def az_test_connection(
    subscription_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    auth_mode: str = "service_principal",
):
    """Test Azure connection with service principal credentials"""
    try:
        # Test the connection using Azure CLI with service principal
        result = subprocess.run(
            [
                "az",
                "login",
                "--service-principal",
                "--username",
                client_id,
                "--password",
                client_secret,
                "--tenant",
                tenant_id,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            print(result.stderr)
            return False

        # Ensure intended subscription is selected and matches
        set_res = subprocess.run(
            ["az", "account", "set", "--subscription", subscription_id],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if set_res.returncode != 0:
            print(set_res.stderr)
            return False

        show_res = subprocess.run(
            ["az", "account", "show", "--query", "id", "-o", "tsv"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if show_res.returncode != 0:
            print(show_res.stderr)
            return False

        current_sub_id = (show_res.stdout or "").strip()
        if current_sub_id != subscription_id:
            return False

        return True

    except Exception as e:
        print(f"Error testing Azure connection: {e}")
        return False


def az_verify_setup(organization_id: Optional[str] = None):
    """Verify Azure setup by checking CLI and presence of credentials in current config."""
    try:
        try:
            subprocess.run(
                ["az", "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
        except Exception:
            return False

        current = az_get_current_config(organization_id)
        if not current:
            return False

        return bool(
            current.get("subscription_id")
            and current.get("tenant_id")
            and current.get("client_id")
            and current.get("client_secret")
        )
    except Exception as e:
        print(f"Error verifying Azure setup: {e}")
        return False


def az_setup_config(organization_id: Optional[str] = None):
    """Setup Azure configuration - now only supports service principal authentication"""
    try:
        # Check if Azure CLI is installed
        result = subprocess.run(
            ["az", "--version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            raise Exception("Azure CLI is not installed. Please install it first.")

        # Load existing config
        config = load_azure_config(organization_id)
        default_config = config.get("default_config")
        config = config.get("configs", {}).get(default_config, {})

        # Check if service principal credentials are configured
        if not (
            config.get("subscription_id")
            and config.get("tenant_id")
            and config.get("client_id")
            and config.get("client_secret")
        ):
            raise Exception(
                "Azure service principal credentials are not configured. Please configure them in the admin panel."
            )

        # Test the connection
        if not az_test_connection(
            config["subscription_id"],
            config["tenant_id"],
            config["client_id"],
            config["client_secret"],
        ):
            raise Exception(
                "Azure service principal authentication failed. Please check your credentials."
            )

        # Update config to mark as configured
        config["is_configured"] = True
        config["auth_method"] = "service_principal"
        az_save_config(
            config["name"],
            config["subscription_id"],
            config["tenant_id"],
            config["client_id"],
            config["client_secret"],
            config.get("allowed_instance_types", []),
            config.get("allowed_regions", []),
            config.get("max_instances", 0),
            organization_id=organization_id,
        )

        return True

    except Exception as e:
        print(f"Error setting up Azure config: {e}")
        raise


def az_get_regions():
    """Get available Azure regions from SkyPilot's Azure catalog"""
    try:
        from sky.catalog.common import read_catalog

        # Read the Azure catalog using SkyPilot's read_catalog function
        df = read_catalog("azure/vms.csv")

        regions = set()  # Use set to avoid duplicates

        # Extract regions from the catalog
        for _, row in df.iterrows():
            region = str(row.get("Region", "")).strip()

            # Skip rows with NaN or empty values
            if region and region != "Region" and region.lower() != "nan":
                regions.add(region)

        regions_list = sorted(list(regions))

        if regions_list:
            print(f"✅ Found {len(regions_list)} regions from SkyPilot Azure catalog")
        else:
            print("⚠️ No regions found in SkyPilot Azure catalog")

        return regions_list

    except Exception as e:
        print(f"❌ Error getting regions from SkyPilot catalog: {e}")
        return []


def az_get_instance_types():
    """Get available Azure instance types from SkyPilot's Azure catalog"""
    try:
        from sky.catalog.common import read_catalog

        # Read the Azure catalog using SkyPilot's read_catalog function
        df = read_catalog("azure/vms.csv")

        instance_types = set()  # Use set to avoid duplicates

        # Extract instance types from the catalog
        for _, row in df.iterrows():
            instance_type = str(row.get("InstanceType", "")).strip()

            # Skip rows with NaN or empty values
            if (
                instance_type
                and instance_type != "InstanceType"
                and instance_type.lower() != "nan"
            ):
                instance_types.add(instance_type)

        instance_types_list = sorted(list(instance_types))

        if instance_types_list:
            print(
                f"✅ Found {len(instance_types_list)} instance types from SkyPilot Azure catalog"
            )
        else:
            print("⚠️ No instance types found in SkyPilot Azure catalog")

        return instance_types_list

    except Exception as e:
        print(f"❌ Error getting instance types from SkyPilot catalog: {e}")
        return []


def create_azure_sky_yaml(
    cluster_name: str,
    command: str,
    setup: str = None,
    instance_type: str = None,
    region: str = None,
    zone: str = None,
    use_spot: bool = False,
    idle_minutes_to_autostop: int = None,
):
    """Create a SkyPilot YAML configuration for Azure cluster"""

    yaml_content = f"""# SkyPilot YAML for Azure cluster
name: {cluster_name}

resources:
  cloud: azure
"""

    if instance_type:
        yaml_content += f"  instance_type: {instance_type}\n"

    if region:
        yaml_content += f"  region: {region}\n"

    if zone:
        yaml_content += f"  zone: {zone}\n"

    if use_spot:
        yaml_content += "  use_spot: true\n"

    if idle_minutes_to_autostop:
        yaml_content += f"  idle_minutes_to_autostop: {idle_minutes_to_autostop}\n"

    yaml_content += f"""
setup: |
  # Azure cluster setup
  {setup or "# No additional setup required"}

run: |
  {command}
"""

    return yaml_content


def az_run_sky_check():
    """Run 'sky check azure' to validate the Azure setup"""
    try:
        print("🔍 Running 'sky check azure' to validate setup...")
        result = subprocess.run(
            ["sky", "check", "azure"],
            capture_output=True,
            text=True,
            timeout=30,  # 30 second timeout
        )

        if result.returncode == 0:
            print("✅ Sky check azure completed successfully")
            print(f"Output: {result.stdout}")
            return True, result.stdout
        else:
            print(f"❌ Sky check azure failed with return code {result.returncode}")
            print(f"Error output: {result.stderr}")
            return False, result.stderr

    except subprocess.TimeoutExpired:
        print("❌ Sky check azure timed out after 30 seconds")
        return False, "Timeout"
    except FileNotFoundError:
        print("❌ 'sky' command not found. Make sure SkyPilot is properly installed.")
        return False, "Sky command not found"
    except Exception as e:
        print(f"❌ Error running sky check azure: {e}")
        return False, str(e)


def az_save_config_with_setup(
    name: str,
    subscription_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    allowed_instance_types: list[str],
    allowed_regions: list[str],
    max_instances: int = 0,
    config_key: str = None,
    allowed_team_ids: list[str] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """Save Azure configuration in DB with environment setup and sky check."""

    # Save the configuration in DB
    az_save_config(
        name,
        subscription_id,
        tenant_id,
        client_id,
        client_secret,
        allowed_instance_types,
        allowed_regions,
        max_instances,
        config_key,
        allowed_team_ids,
        organization_id=organization_id,
        user_id=user_id,
    )

    # Avoid process-wide env mutation here; az CLI login uses arguments

    # Set the new config as default in DB
    new_key = name.lower().replace(" ", "_").replace("-", "_")
    try:
        az_set_default_config(new_key, organization_id=organization_id)
    except Exception:
        pass

    # Run sky check for Azure
    sky_check_result = None
    try:
        # Only run if creds present
        if subscription_id and tenant_id and client_id and client_secret:
            is_valid, output = az_run_sky_check()
            sky_check_result = {
                "valid": is_valid,
                "output": output,
                "message": "Sky check azure completed successfully" if is_valid else "Sky check azure failed",
            }
    except Exception as e:
        sky_check_result = {
            "valid": False,
            "output": str(e),
            "message": f"Error during Azure sky check: {str(e)}",
        }

    # Return the final result
    result = az_get_config_for_display(organization_id)
    if sky_check_result:
        result["sky_check_result"] = sky_check_result

    return result


def az_get_price_per_hour(instance_type: str, region: str | None = None) -> float | None:
    """Return the price per hour for a given Azure instance type, optionally filtered by region.

    Returns None if not found or price unavailable.
    """
    try:
        from sky.catalog.common import read_catalog

        df = read_catalog("azure/vms.csv")
        if df is None:
            return None

        # Validate required columns exist
        if "InstanceType" not in df.columns:
            return None

        # Normalize and filter by instance type
        base = df.copy()
        try:
            base["InstanceType"] = base["InstanceType"].astype(str)
        except Exception:
            return None
        subset = base[base["InstanceType"] == str(instance_type)]

        # Optional region filter; if no rows after filtering, fall back to any region
        if region and "Region" in subset.columns:
            try:
                tmp = subset.copy()
                tmp["Region"] = tmp["Region"].astype(str)
                tmp = tmp[tmp["Region"] == str(region)]
                if len(tmp) > 0:
                    subset = tmp
            except Exception:
                # Ignore region filtering on failure
                pass

        if subset is None or len(subset) == 0:
            return None

        # Prefer first row
        row = subset.iloc[0]
        price = row.get("Price", None) if "Price" in subset.columns else None
        try:
            return float(price) if price is not None and str(price).lower() != "nan" else None
        except Exception:
            return None
    except Exception as e:
        print(f"Error getting Azure price for '{instance_type}' ({region}): {e}")
        return None


def az_infer_gpu_count(instance_type: str) -> int:
    """Infer GPU count for a given Azure instance type using SkyPilot catalog.

    Returns 0 if the instance is CPU-only or unknown. Falls back to 0 on errors.
    """
    try:
        from sky.catalog.common import read_catalog

        df = read_catalog("azure/vms.csv")
        if df is None:
            return 0

        # Ensure required column exists
        if "InstanceType" not in df.columns:
            return 0
        # Normalize and filter by InstanceType
        try:
            df["InstanceType"] = df["InstanceType"].astype(str)
        except Exception:
            return 0
        rows = df[df["InstanceType"] == str(instance_type)]
        if rows is None or len(rows) == 0:
            return 0

        row = rows.iloc[0]

        # Common column names for accelerator counts
        for key in (
            "AcceleratorCount",
            "GPUs",
            "GpuCount",
            "GPUCount",
            "NumAccelerators",
            "num_accelerators",
        ):
            if key in row and str(row[key]).lower() != "nan":
                try:
                    return max(0, int(float(row[key])))
                except Exception:
                    continue

        # If accelerator name exists and is non-empty, assume 1 GPU
        for key in ("AcceleratorName", "GPU", "Gpu", "Accelerator"):
            if key in row and str(row[key]).strip().lower() not in ("", "nan", "none"):
                return 1

        return 0
    except Exception as e:
        print(f"Error inferring Azure GPU count for {instance_type}: {e}")
        return 0
