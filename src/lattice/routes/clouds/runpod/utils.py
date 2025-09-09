import os
import runpod
from pathlib import Path
from typing import Dict, Optional

from sqlalchemy.orm import Session

from config import get_db
from db.db_models import CloudAccount
from routes.clouds.utils import normalize_key, require_org_id

# Legacy config.toml path (no longer required)
RUNPOD_CONFIG_TOML = Path.home() / ".runpod" / "config.toml"


def load_runpod_config(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Load RunPod configuration from DB and return legacy-compatible shape.

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
            CloudAccount.provider == "runpod",
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
                "api_key": creds.get("api_key", ""),
                "allowed_gpu_types": settings.get("allowed_gpu_types", []),
                "allowed_display_options": settings.get("allowed_display_options", []),
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
        print(f"Error loading RunPod config from DB: {e}")
        return {"configs": {}, "default_config": None, "is_configured": False}
    finally:
        if should_close:
            db.close()


def rp_get_api_key(organization_id: Optional[str] = None) -> Optional[str]:
    """Get RunPod API key from DB (default config) or environment variable."""
    cfg = load_runpod_config(organization_id)
    default_key = cfg.get("default_config")
    if default_key:
        c = cfg.get("configs", {}).get(default_key) or {}
        if c.get("api_key"):
            return c.get("api_key")
    return os.getenv("RUNPOD_API_KEY", None)


def rp_save_config(
    name: str,
    api_key: str,
    allowed_gpu_types: list[str],
    max_instances: int = 0,
    config_key: Optional[str] = None,
    allowed_team_ids: Optional[list[str]] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
    allowed_display_options: Optional[list[str]] = None,
    db: Optional[Session] = None,
):
    """Upsert RunPod configuration in DB.

    Handles masked credential placeholders by falling back to existing stored values.
    Performs safe rename by updating the existing row's key instead of delete+insert when possible.

    Returns legacy-compatible config shape via load_runpod_config().
    """
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        key_new = normalize_key(name)

        # Find existing row (prefer config_key for updates/renames)
        row = None
        if config_key:
            q_old = db.query(CloudAccount).filter(
                CloudAccount.provider == "runpod",
                CloudAccount.key == config_key,
            )
            q_old = q_old.filter(CloudAccount.organization_id == org_id)
            row = q_old.first()
        if row is None:
            q_new = db.query(CloudAccount).filter(
                CloudAccount.provider == "runpod",
                CloudAccount.key == key_new,
            )
            q_new = q_new.filter(CloudAccount.organization_id == org_id)
            row = q_new.first()

        # Build credentials with masked fallback
        def _unmask(val: Optional[str], existing: Optional[str]) -> str:
            if val is None:
                return existing or ""
            if isinstance(val, str) and val.strip().startswith("*"):
                return existing or ""
            return val

        existing_creds = (row.credentials if row and row.credentials else {}) if row else {}
        credentials = {"api_key": _unmask(api_key, existing_creds.get("api_key"))}
        settings = {
            "allowed_gpu_types": allowed_gpu_types or [],
            "allowed_display_options": allowed_display_options or [],
        }

        # Determine default if none exists for this org/provider
        default_exists_q = db.query(CloudAccount).filter(
            CloudAccount.provider == "runpod",
            CloudAccount.organization_id == org_id,
        )
        default_exists_q = default_exists_q.filter(CloudAccount.is_default == True)  # noqa: E712
        default_exists = default_exists_q.first() is not None

        if not row:
            row = CloudAccount(
                organization_id=org_id,
                provider="runpod",
                key=key_new,
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
            if row.key != key_new:
                conflict_q = db.query(CloudAccount).filter(
                    CloudAccount.provider == "runpod",
                    CloudAccount.key == key_new,
                    CloudAccount.organization_id == org_id,
                )
                conflict = conflict_q.first()
                if conflict is None:
                    row.key = key_new
                else:
                    # Merge values into conflict row and delete old
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
        return load_runpod_config(org_id, db)
    finally:
        if should_close:
            db.close()


def rp_get_config_for_display(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Get RunPod configuration for display (with masked API key)."""
    config_data = load_runpod_config(organization_id, db)

    display_configs: Dict[str, Dict] = {}
    for key, config in config_data.get("configs", {}).items():
        display_config = dict(config)
        if display_config.get("api_key"):
            val = display_config["api_key"]
            display_config["api_key"] = f"{val[:4]}...{val[-4:]}"
        display_configs[key] = display_config

    return {
        "configs": display_configs,
        "default_config": config_data.get("default_config"),
        "is_configured": bool(config_data.get("default_config")),
    }


def rp_get_current_config(
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Get the current default RunPod configuration from DB."""
    config_data = load_runpod_config(organization_id, db)
    default_key = config_data.get("default_config")
    if default_key and default_key in config_data.get("configs", {}):
        return config_data["configs"][default_key]
    return None


def rp_set_default_config(
    config_key: str,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Set a specific RunPod config as default in DB and update environment."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        # Verify exists
        org_id = require_org_id(organization_id)
        cfg = load_runpod_config(org_id, db)
        if config_key not in cfg.get("configs", {}):
            raise ValueError(f"RunPod config '{config_key}' not found")

        # Update defaults in DB
        q = db.query(CloudAccount).filter(
            CloudAccount.provider == "runpod",
            CloudAccount.organization_id == org_id,
        )
        for row in q.all():
            row.is_default = (row.key == config_key)
        db.commit()

        # Return masked config (as used by display) to avoid exposing API key
        masked = rp_get_config_for_display(org_id, db).get("configs", {}).get(config_key, {})
        return {
            "message": f"RunPod config '{config_key}' set as default",
            "config": masked,
        }
    finally:
        if should_close:
            db.close()


def rp_delete_config(
    config_key: str,
    organization_id: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Delete a RunPod configuration from DB and maintain default if needed."""
    should_close = False
    if db is None:
        db = next(get_db())
        should_close = True
    try:
        org_id = require_org_id(organization_id)
        target = db.query(CloudAccount).filter(
            CloudAccount.provider == "runpod",
            CloudAccount.key == config_key,
            CloudAccount.organization_id == org_id,
        )
        row = target.first()
        if not row:
            raise ValueError(f"RunPod config '{config_key}' not found")
        was_default = bool(row.is_default)
        db.delete(row)
        db.commit()

        if was_default:
            # Pick another as default if any
            q = db.query(CloudAccount).filter(
                CloudAccount.provider == "runpod",
                CloudAccount.organization_id == org_id,
            )
            remaining = q.all()
            if remaining:
                remaining[0].is_default = True
                db.commit()

        return load_runpod_config(org_id, db)
    finally:
        if should_close:
            db.close()


def rp_test_connection(api_key: str):
    """Test RunPod API connection with a specific API key (without config.toml)."""
    try:
        return rp_verify_setup(api_key)
    except Exception as e:
        print(f"Error testing RunPod connection: {e}")
        return False


def rp_setup_config(organization_id: Optional[str] = None):
    """No-op setup: ensure an API key exists; SkyPilot receives credentials directly."""
    api_key = rp_get_api_key(organization_id)
    if not api_key:
        raise ValueError(
            "RunPod API key is required. Please configure it in the Admin section."
        )
    # Optionally set for SDK calls in-process
    runpod.api_key = api_key
    return True


def rp_verify_setup(test_api_key: str = None, organization_id: Optional[str] = None):
    """
    Verify that RunPod is properly configured and API is accessible

    Optionally takes a test api key parameter to override the saved key.
    This is useful for verifying an API key before saving to config.
    """
    try:
        # Use the provided API key if given, otherwise fetch from config
        api_key = test_api_key or rp_get_api_key(organization_id)
        if not api_key:
            print(
                "❌ RunPod API key is required. Please configure it in the Admin section."
            )
            return False

        # Use the API key directly with the RunPod SDK (no config.toml required)
        runpod.api_key = api_key

        # Test API connectivity by trying to get user info
        try:
            user_info = runpod.get_user()
            print("✅ RunPod API connectivity verified")
            print(f"✅ Connected as user: {user_info.get('id', 'Unknown')}")
            return True
        except Exception as api_error:
            print(f"❌ RunPod API connectivity failed: {str(api_error)}")

            # Check for specific error types
            error_str = str(api_error).lower()
            if "unauthorized" in error_str or "invalid" in error_str:
                print("❌ Invalid API key. Please check your RUNPOD_API_KEY.")
            elif "not found" in error_str:
                print("❌ API key not found. Please check your RUNPOD_API_KEY.")
            elif "timeout" in error_str:
                print("❌ Request timed out. Please check your internet connection.")
            else:
                print("❌ API connectivity issue. Please check your internet connection and RunPod service status.")
        return False

    except Exception as e:
        print(f"❌ Error verifying RunPod setup: {e}")
        return False


def rp_run_sky_check(organization_id: Optional[str] = None):
    """Stubbed 'sky check runpod' that avoids external commands.

    Returns a successful status with a note that the check was skipped.
    Present to satisfy tests that monkeypatch this symbol.
    """
    msg = "Skipped external 'sky check runpod'; assuming valid setup."
    print(f"ℹ️ {msg}")
    return True, msg


def map_runpod_display_to_instance_type(display_string: str) -> str:
    """
    Maps user-friendly display strings to actual RunPod instance types.

    Examples:
    - "RTX 4090:1" -> "NVIDIA RTX 4090"
    - "CPU:8" -> "CPU-8"
    - "A100:4" -> "NVIDIA A100"
    """
    try:
        from sky.catalog.common import read_catalog

        # Read the RunPod catalog
        df = read_catalog("runpod/vms.csv")

        # Handle CPU instances (format: "CPU:vCPUs-MemoryGiB")
        if display_string.startswith("CPU:"):
            try:
                # Parse CPU:vCPUs-MemoryGiB format
                parts = display_string.split(":")
                if len(parts) == 2:
                    cpu_memory_part = parts[1]
                    if "-" in cpu_memory_part:
                        vcpus_str, memory_part = cpu_memory_part.split("-", 1)
                        vcpus = int(vcpus_str)
                        memory_gb = int(memory_part.replace("GB", ""))

                        # Find matching CPU instance
                        cpu_rows = df[
                            (df["AcceleratorName"].isna())
                            | (df["AcceleratorName"] == "")
                            | (df["AcceleratorName"].str.lower() == "nan")
                        ]

                        # Find the row with matching vCPUs and memory
                        matching_row = cpu_rows[
                            (cpu_rows["vCPUs"] == vcpus)
                            & (cpu_rows["MemoryGiB"] == memory_gb)
                        ]
                        if not matching_row.empty:
                            return matching_row.iloc[0]["InstanceType"]
                    else:
                        # Fallback to old format: CPU:vCPUs
                        vcpus = int(cpu_memory_part)
                        cpu_rows = df[
                            (df["AcceleratorName"].isna())
                            | (df["AcceleratorName"] == "")
                            | (df["AcceleratorName"].str.lower() == "nan")
                        ]

                        # Find the row with matching vCPUs
                        matching_row = cpu_rows[cpu_rows["vCPUs"] == vcpus]
                        if not matching_row.empty:
                            return matching_row.iloc[0]["InstanceType"]
            except (ValueError, IndexError):
                pass

        # Handle GPU instances (format: "GPU_NAME:COUNT")
        elif ":" in display_string:
            gpu_name, count_str = display_string.split(":", 1)
            try:
                count = int(count_str)

                # Find matching GPU instance
                gpu_rows = df[
                    (df["AcceleratorName"] == gpu_name)
                    & (df["AcceleratorCount"] == count)
                ]

                if not gpu_rows.empty:
                    return gpu_rows.iloc[0]["InstanceType"]
            except (ValueError, IndexError):
                pass

        # If no mapping found, return the original string
        print(f"⚠️ No instance type mapping found for '{display_string}', using as-is")
        return display_string

    except Exception as e:
        print(f"❌ Error mapping display string to instance type: {e}")
        return display_string


def rp_get_display_options():
    """
    Get available RunPod options with user-friendly display names.
    Returns both GPU instances (AcceleratorName:Count) and CPU instances (CPU:vCPUs).
    """
    try:
        from sky.catalog.common import read_catalog

        # Read the RunPod catalog using SkyPilot's read_catalog function
        df = read_catalog("runpod/vms.csv")

        display_options = set()  # Use set to avoid duplicates

        # Extract GPU instances from the catalog
        for _, row in df.iterrows():
            accelerator_name = str(row.get("AcceleratorName", "")).strip()
            accelerator_count_raw = row.get("AcceleratorCount", 1)
            vcpus = row.get("vCPUs", 0)

            # Skip rows with NaN or empty values for required fields
            if (
                accelerator_name
                and accelerator_name != "AcceleratorName"
                and accelerator_name.lower() != "nan"
                and accelerator_count_raw is not None
                and str(accelerator_count_raw).lower() != "nan"
            ):
                # Convert count to integer to ensure consistent format
                try:
                    accelerator_count = int(float(accelerator_count_raw))
                except (ValueError, TypeError):
                    accelerator_count = 1

                # Format: GPU_NAME:COUNT
                display_option = f"{accelerator_name}:{accelerator_count}"
                display_options.add(display_option)

        # Extract CPU instances (where AcceleratorName is blank/NaN)
        for _, row in df.iterrows():
            accelerator_name = str(row.get("AcceleratorName", "")).strip()
            vcpus = row.get("vCPUs", 0)

            # Include CPU instances (no accelerator or empty accelerator name)
            if (
                (
                    not accelerator_name
                    or accelerator_name == ""
                    or accelerator_name.lower() == "nan"
                    or accelerator_name == "AcceleratorName"
                )
                and vcpus is not None
                and str(vcpus).lower() != "nan"
                and vcpus > 0
            ):
                try:
                    vcpus_int = int(float(vcpus))
                    memory_gb = row.get("MemoryGiB", 0)
                    memory_int = (
                        int(float(memory_gb))
                        if memory_gb and str(memory_gb).lower() != "nan"
                        else 0
                    )
                    # Format: CPU:vCPUs-MemoryGiB
                    display_option = f"CPU:{vcpus_int}-{memory_int}GB"
                    display_options.add(display_option)
                except (ValueError, TypeError):
                    continue

        display_options_list = sorted(list(display_options))

        if display_options_list:
            print(
                f"✅ Found {len(display_options_list)} display options from SkyPilot RunPod catalog"
            )
        else:
            print("⚠️ No display options found in SkyPilot RunPod catalog")

        return display_options_list

    except Exception as e:
        print(f"❌ Error getting display options from SkyPilot catalog: {e}")
        return []


def rp_get_display_options_with_pricing():
    """
    Get available RunPod options with user-friendly display names and pricing information.
    Returns both GPU instances (AcceleratorName:Count) and CPU instances (CPU:vCPUs).
    """
    try:
        from sky.catalog.common import read_catalog

        # Read the RunPod catalog using SkyPilot's read_catalog function
        df = read_catalog("runpod/vms.csv")

        display_options = {}  # Use dict to store detailed info

        # Extract GPU instances from the catalog
        for _, row in df.iterrows():
            accelerator_name = str(row.get("AcceleratorName", "")).strip()
            accelerator_count_raw = row.get("AcceleratorCount", 1)
            price_per_hour = row.get("Price", None)
            vcpus = row.get("vCPUs", 0)
            memory_gb = row.get("MemoryGiB", 0)

            # Skip rows with NaN or empty values for required fields
            if (
                accelerator_name
                and accelerator_name != "AcceleratorName"
                and accelerator_name.lower() != "nan"
                and accelerator_count_raw is not None
                and str(accelerator_count_raw).lower() != "nan"
            ):
                # Convert count to integer to ensure consistent format
                try:
                    accelerator_count = int(float(accelerator_count_raw))
                except (ValueError, TypeError):
                    accelerator_count = 1

                # Format: GPU_NAME:COUNT
                display_option = f"{accelerator_name}:{accelerator_count}"

                # Format price information
                price_str = "Unknown"
                if price_per_hour is not None and str(price_per_hour).lower() != "nan":
                    try:
                        price_float = float(price_per_hour)
                        price_str = f"${price_float:.2f}"
                    except (ValueError, TypeError):
                        price_str = "Unknown"

                display_options[display_option] = {
                    "name": display_option,
                    "display_name": f"{accelerator_name} ({accelerator_count}x)",
                    "type": "GPU",
                    "accelerator_name": accelerator_name,
                    "accelerator_count": str(accelerator_count),
                    "vcpus": str(vcpus),
                    "memory_gb": str(memory_gb),
                    "price": price_str,
                    "price_per_hour": price_per_hour,
                }

        # Extract CPU instances (where AcceleratorName is blank/NaN)
        for _, row in df.iterrows():
            accelerator_name = str(row.get("AcceleratorName", "")).strip()
            price_per_hour = row.get("Price", None)
            vcpus = row.get("vCPUs", 0)
            memory_gb = row.get("MemoryGiB", 0)

            # Include CPU instances (no accelerator or empty accelerator name)
            if (
                (
                    not accelerator_name
                    or accelerator_name == ""
                    or accelerator_name.lower() == "nan"
                    or accelerator_name == "AcceleratorName"
                )
                and vcpus is not None
                and str(vcpus).lower() != "nan"
                and vcpus > 0
            ):
                try:
                    vcpus_int = int(float(vcpus))
                    memory_gb = row.get("MemoryGiB", 0)
                    memory_int = (
                        int(float(memory_gb))
                        if memory_gb and str(memory_gb).lower() != "nan"
                        else 0
                    )
                    # Format: CPU:vCPUs-MemoryGiB
                    display_option = f"CPU:{vcpus_int}-{memory_int}GB"

                    # Format price information
                    price_str = "Unknown"
                    if (
                        price_per_hour is not None
                        and str(price_per_hour).lower() != "nan"
                    ):
                        try:
                            price_float = float(price_per_hour)
                            price_str = f"${price_float:.2f}"
                        except (ValueError, TypeError):
                            price_str = "Unknown"

                    display_options[display_option] = {
                        "name": display_option,
                        "display_name": f"CPU ({vcpus_int} vCPUs, {memory_int}GB RAM)",
                        "type": "CPU",
                        "accelerator_name": None,
                        "accelerator_count": "0",
                        "vcpus": str(vcpus_int),
                        "memory_gb": str(memory_int),
                        "price": price_str,
                        "price_per_hour": price_per_hour,
                    }
                except (ValueError, TypeError):
                    continue

        display_options_list = list(display_options.values())

        if display_options_list:
            print(
                f"✅ Found {len(display_options_list)} display options from SkyPilot RunPod catalog with pricing"
            )
        else:
            print("⚠️ No display options found in SkyPilot RunPod catalog")

        return display_options_list

    except Exception as e:
        print(
            f"❌ Error getting display options with pricing from SkyPilot catalog: {e}"
        )
        return []


# Keep the old functions for backward compatibility
def get_runpod_gpu_types():
    """Get available GPU types from SkyPilot's RunPod catalog (legacy function)"""
    return rp_get_display_options()


def get_runpod_gpu_types_with_pricing():
    """Get available GPU types from SkyPilot's RunPod catalog with pricing information (legacy function)"""
    return rp_get_display_options_with_pricing()


def create_runpod_sky_yaml(
    cluster_name, command, setup=None, accelerators=None, region=None
):
    """Create a SkyPilot YAML configuration for RunPod"""
    config = {"resources": {"cloud": "runpod"}}

    if accelerators:
        config["resources"]["accelerators"] = accelerators

    if region:
        config["resources"]["region"] = region

    if setup:
        config["setup"] = setup

    config["run"] = command

    return config


def rp_get_price_per_hour(display_option: str) -> float | None:
    """Return the price per hour for a given RunPod selection.

    Accepts either:
    - Exact display option name returned by rp_get_display_options_with_pricing() (e.g., "NVIDIA A100 80GB:1"), or
    - Short token format like "A100:1" or "CPU:8-32GB" (best-effort match).
    Returns None if not found.
    """
    try:
        sel = str(display_option)
        options = rp_get_display_options_with_pricing()

        # First attempt: exact match on the canonical name
        for opt in options:
            if str(opt.get("name")) == sel:
                price = opt.get("price_per_hour")
                try:
                    return float(price) if price is not None and str(price).lower() != "nan" else None
                except Exception:
                    return None

        # Second attempt: normalize short GPU token like "A100:1"
        if ":" in sel and not sel.upper().startswith("CPU"):
            token, count_str = sel.split(":", 1)
            token = token.strip().lower()
            try:
                count = int(float(count_str.strip()))
            except Exception:
                count = None
            for opt in options:
                accel_name = str(opt.get("accelerator_name", "")).lower()
                accel_count = opt.get("accelerator_count")
                try:
                    accel_count = int(float(accel_count)) if accel_count is not None else None
                except Exception:
                    accel_count = None
                if token and token in accel_name and (count is None or accel_count == count):
                    price = opt.get("price_per_hour")
                    try:
                        return float(price) if price is not None and str(price).lower() != "nan" else None
                    except Exception:
                        return None

        # Third attempt: CPU token match "CPU:8-32GB"
        if sel.upper().startswith("CPU"):
            # Match by type CPU and vcpus/memory if present in name
            for opt in options:
                if str(opt.get("type")).upper() == "CPU":
                    if str(opt.get("name")) == sel:
                        price = opt.get("price_per_hour")
                        try:
                            return float(price) if price is not None and str(price).lower() != "nan" else None
                        except Exception:
                            return None
        return None
    except Exception as e:
        print(f"Error getting RunPod price for '{display_option}': {e}")
        return None


def rp_save_config_with_setup(
    name: str,
    api_key: str,
    allowed_gpu_types: list[str],
    max_instances: int = 0,
    config_key: str = None,
    allowed_display_options: list[str] = None,
    allowed_team_ids: list[str] = None,
    organization_id: Optional[str] = None,
    user_id: Optional[str] = None,
):
    """Save RunPod configuration (DB-backed) without config.toml or sky check."""

    # Save the configuration
    _ = rp_save_config(
        name,
        api_key,
        allowed_gpu_types,
        max_instances,
        config_key,
        allowed_team_ids,
        organization_id=organization_id,
        user_id=user_id,
        allowed_display_options=allowed_display_options,
    )

    # Ensure the new config is set as default
    config_key_normalized = normalize_key(name)
    try:
        rp_set_default_config(config_key_normalized, organization_id)
    except Exception:
        pass

    # Return the final result
    result = rp_get_config_for_display(organization_id)
    return result
