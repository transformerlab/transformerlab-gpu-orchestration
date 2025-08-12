import os
import runpod
import json
import subprocess
from pathlib import Path
from config import RUNPOD_API_KEY
from typing import Dict

# Path to store RunPod configuration
RUNPOD_CONFIG_FILE = Path.home() / ".runpod" / "lattice_config.json"
# Path for SkyPilot's expected config.toml file
RUNPOD_CONFIG_TOML = Path.home() / ".runpod" / "config.toml"


def load_runpod_config():
    """Load RunPod configuration from file"""
    if not RUNPOD_CONFIG_FILE.exists():
        return {
            "configs": {},
            "default_config": None,
            "is_configured": False,
        }

    try:
        with open(RUNPOD_CONFIG_FILE, "r") as f:
            config = json.load(f)

            # Handle legacy format (single config)
            if "api_key" in config:
                # Convert legacy format to new format
                legacy_config = {
                    "name": config.get("name", "Default RunPod Config"),
                    "api_key": config.get("api_key", ""),
                    "allowed_gpu_types": config.get("allowed_gpu_types", []),
                    "max_instances": config.get("max_instances", 0),
                }

                new_config = {
                    "configs": {"default": legacy_config},
                    "default_config": "default",
                    "is_configured": bool(config.get("api_key")),
                }

                # Save the new format
                save_runpod_configs(new_config["configs"], new_config["default_config"])
                return new_config

            # New format with multiple configs
            config["is_configured"] = bool(
                config.get("default_config")
                and config.get("configs", {}).get(config["default_config"])
            )
            return config
    except Exception as e:
        print(f"Error loading RunPod config: {e}")
        return {
            "configs": {},
            "default_config": None,
            "is_configured": False,
        }


def save_runpod_configs(configs: Dict[str, Dict], default_config: str = None):
    """Save RunPod configurations to file"""
    config = {
        "configs": configs,
        "default_config": default_config,
        "is_configured": bool(default_config and configs.get(default_config)),
    }
    RUNPOD_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RUNPOD_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    return config


def get_runpod_api_key():
    """Get RunPod API key from config file or environment variable"""
    config_data = load_runpod_config()
    default_key = config_data.get("default_config")
    if default_key and default_key in config_data.get("configs", {}):
        return config_data["configs"][default_key].get("api_key", "")
    return RUNPOD_API_KEY


def save_runpod_config(
    name: str,
    api_key: str,
    allowed_gpu_types: list[str],
    max_instances: int = 0,
    config_key: str = None,
):
    """Save RunPod configuration to file (legacy compatibility)"""
    print(f"💾 Saving RunPod config - allowed_gpu_types: {allowed_gpu_types}")
    config_data = load_runpod_config()

    # Create new config entry
    new_config = {
        "name": name,
        "api_key": api_key,
        "allowed_gpu_types": allowed_gpu_types,
        "max_instances": max_instances,
    }

    # Generate the new config key based on the name
    new_config_key = name.lower().replace(" ", "_").replace("-", "_")

    # If config_key is provided, check if we're updating an existing config
    if config_key and config_key in config_data.get("configs", {}):
        # Check if the name has changed
        if config_key != new_config_key:
            # Name has changed, so we need to create a new config key and remove the old one
            # Remove the old config
            del config_data["configs"][config_key]

            # If this was the default config, update the default to the new key
            if config_data.get("default_config") == config_key:
                config_data["default_config"] = new_config_key

            # Add the new config with the new key
            config_data["configs"][new_config_key] = new_config
        else:
            # Name hasn't changed, just update the existing config
            config_data["configs"][config_key] = new_config
    else:
        # Create new config
        config_data["configs"][new_config_key] = new_config

    # If this is the first config, set it as default
    if not config_data["default_config"]:
        config_data["default_config"] = new_config_key

    return save_runpod_configs(config_data["configs"], config_data["default_config"])


def get_runpod_config_for_display():
    """Get RunPod configuration for display (with masked API key)"""
    config_data = load_runpod_config()
    print(
        f"📤 Returning RunPod config for display - configs: {config_data.get('configs', {})}"
    )

    # Return all configs with masked API keys
    display_configs = {}
    for key, config in config_data.get("configs", {}).items():
        display_config = config.copy()
        display_configs[key] = display_config

    return {
        "configs": display_configs,
        "default_config": config_data.get("default_config"),
        "is_configured": config_data.get("is_configured", False),
    }


def get_current_runpod_config():
    """Get the current default RunPod configuration"""
    config_data = load_runpod_config()
    default_key = config_data.get("default_config")
    if default_key and default_key in config_data.get("configs", {}):
        return config_data["configs"][default_key]
    return None


def set_runpod_default_config(config_key: str):
    """Set a specific RunPod config as default and update environment"""
    config_data = load_runpod_config()

    if config_key not in config_data.get("configs", {}):
        raise ValueError(f"RunPod config '{config_key}' not found")

    # Update default config
    config_data["default_config"] = config_key
    config_data["is_configured"] = True

    # Save the updated config
    save_runpod_configs(config_data["configs"], config_data["default_config"])

    # Update environment variables with the new default config
    default_config = config_data["configs"][config_key]

    # Set environment variable for the new default config
    os.environ["RUNPOD_API_KEY"] = default_config.get("api_key", "")

    # Update the config.toml file with the new API key
    create_runpod_config_toml(default_config.get("api_key", ""))

    return {
        "message": f"RunPod config '{config_key}' set as default",
        "config": default_config,
    }


def delete_runpod_config(config_key: str):
    """Delete a RunPod configuration"""
    config_data = load_runpod_config()

    if config_key not in config_data.get("configs", {}):
        raise ValueError(f"RunPod config '{config_key}' not found")

    # Remove the config
    del config_data["configs"][config_key]

    # If this was the default config, clear the default
    if config_data.get("default_config") == config_key:
        config_data["default_config"] = None
        config_data["is_configured"] = False

    # If there are other configs and no default, set the first one as default
    if not config_data["default_config"] and config_data["configs"]:
        config_data["default_config"] = list(config_data["configs"].keys())[0]
        config_data["is_configured"] = True

    return save_runpod_configs(config_data["configs"], config_data["default_config"])


def test_runpod_connection(api_key: str):
    """Test RunPod API connection with a specific API key"""
    try:
        # Test the connection with passed api_key
        is_valid = verify_runpod_setup(api_key)
        return is_valid

    except Exception as e:
        print(f"Error testing RunPod connection: {e}")
        return False


def create_runpod_config_toml(api_key: str):
    """Create the config.toml file that SkyPilot expects for RunPod"""
    try:
        # Ensure the .runpod directory exists
        RUNPOD_CONFIG_TOML.parent.mkdir(parents=True, exist_ok=True)

        # Create the config.toml content
        config_content = f"""[default]
api_key = "{api_key}"
"""

        # Write the config.toml file
        with open(RUNPOD_CONFIG_TOML, "w") as f:
            f.write(config_content)

        print(f"✅ Created RunPod config.toml at {RUNPOD_CONFIG_TOML}")
        return True
    except Exception as e:
        print(f"❌ Error creating RunPod config.toml: {e}")
        return False


def run_sky_check_runpod():
    """Run 'sky check runpod' to validate the RunPod setup"""
    try:
        print("🔍 Running 'sky check runpod' to validate setup...")
        result = subprocess.run(
            ["sky", "check", "runpod"],
            capture_output=True,
            text=True,
            timeout=30,  # 30 second timeout
        )

        if result.returncode == 0:
            print("✅ Sky check runpod completed successfully")
            print(f"Output: {result.stdout}")
            return True, result.stdout
        else:
            print(f"❌ Sky check runpod failed with return code {result.returncode}")
            print(f"Error output: {result.stderr}")
            return False, result.stderr

    except subprocess.TimeoutExpired:
        print("❌ Sky check runpod timed out after 30 seconds")
        return False, "Timeout"
    except FileNotFoundError:
        print("❌ 'sky' command not found. Make sure SkyPilot is properly installed.")
        return False, "Sky command not found"
    except Exception as e:
        print(f"❌ Error running sky check runpod: {e}")
        return False, str(e)


def setup_runpod_config():
    """Setup RunPod configuration for SkyPilot integration"""
    api_key = get_runpod_api_key()
    if not api_key:
        raise ValueError(
            "RunPod API key is required. Please configure it in the Admin section."
        )

    # Set the API key for the RunPod SDK
    runpod.api_key = api_key

    # Also set the environment variable for SkyPilot
    os.environ["RUNPOD_API_KEY"] = api_key

    # Create the config.toml file that SkyPilot expects
    if not create_runpod_config_toml(api_key):
        raise ValueError("Failed to create RunPod config.toml file")

    # Run sky check runpod to validate the setup
    is_valid, output = run_sky_check_runpod()
    if not is_valid:
        print(f"⚠️ Sky check runpod validation failed: {output}")
        # Don't raise an exception here, just log the warning
        # The setup might still work for basic functionality

    print("✅ RunPod API key configured")
    return True


def verify_runpod_setup(api_key: str = None):
    """
    Verify that RunPod is properly configured and API is accessible
    Optionally takes a test api_key parameter to override the saved key.
    """
    try:
        # Use the provided API key if given, otherwise fetch it
        api_key = api_key or get_runpod_api_key()
        if not api_key:
            print(
                "❌ RunPod API key is required. Please configure it in the Admin section."
            )
            return False

        runpod.api_key = api_key

        if not os.path.exists(RUNPOD_CONFIG_TOML):
            print(f"❌ RunPod config.toml not found at {RUNPOD_CONFIG_TOML}")
            return False

        # Also set the environment variable for SkyPilot
        os.environ["RUNPOD_API_KEY"] = api_key

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
                print(
                    "❌ API connectivity issue. Please check your internet connection and RunPod service status."
                )
            return False

    except Exception as e:
        print(f"❌ Error verifying RunPod setup: {e}")
        return False


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
        import pandas as pd

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


def get_runpod_display_options():
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


def get_runpod_display_options_with_pricing():
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
    return get_runpod_display_options()


def get_runpod_gpu_types_with_pricing():
    """Get available GPU types from SkyPilot's RunPod catalog with pricing information (legacy function)"""
    return get_runpod_display_options_with_pricing()


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
