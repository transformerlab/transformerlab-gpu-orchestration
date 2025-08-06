import os
import runpod
import json
import subprocess
from pathlib import Path
from config import RUNPOD_API_KEY

# Path to store RunPod configuration
RUNPOD_CONFIG_FILE = Path.home() / ".runpod" / "lattice_config.json"
# Path for SkyPilot's expected config.toml file
RUNPOD_CONFIG_TOML = Path.home() / ".runpod" / "config.toml"


def load_runpod_config():
    """Load RunPod configuration from file"""
    if not RUNPOD_CONFIG_FILE.exists():
        return {
            "api_key": "",
            "allowed_gpu_types": [],
            "is_configured": False,
            "max_instances": 0,
        }

    try:
        with open(RUNPOD_CONFIG_FILE, "r") as f:
            config = json.load(f)
            config["is_configured"] = bool(config.get("api_key"))
            # Set defaults for new fields if they don't exist
            if "max_instances" not in config:
                config["max_instances"] = 0
            return config
    except Exception as e:
        print(f"Error loading RunPod config: {e}")
        return {
            "api_key": "",
            "allowed_gpu_types": [],
            "is_configured": False,
            "max_instances": 0,
        }


def get_runpod_api_key():
    """Get RunPod API key from config file or environment variable"""
    config = load_runpod_config()
    if config.get("api_key"):
        return config["api_key"]
    return RUNPOD_API_KEY


def save_runpod_config(
    name: str, api_key: str, allowed_gpu_types: list[str], max_instances: int = 0
):
    """Save RunPod configuration to file"""
    # Load existing config to preserve the real API key if the new one is masked
    existing_config = load_runpod_config()

    # If the provided API key is masked (all asterisks), keep the existing real API key
    if api_key and api_key.startswith("*") and len(api_key) > 0:
        api_key = existing_config.get("api_key", "")

    config = {
        "name": name,
        "api_key": api_key,
        "allowed_gpu_types": allowed_gpu_types,
        "max_instances": max_instances,
        "is_configured": bool(api_key),
    }
    RUNPOD_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RUNPOD_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    return config


def get_runpod_config_for_display():
    """Get RunPod configuration for display (with masked API key)"""
    config = load_runpod_config()
    # Create a copy for display with masked API key
    display_config = config.copy()
    # display_config["api_key"] = (
    #     "*" * len(config["api_key"]) if config["api_key"] else ""
    # )
    return display_config


def test_runpod_connection(api_key: str):
    """Test RunPod API connection with a specific API key"""
    try:
        # Temporarily set the API key
        original_key = os.environ.get("RUNPOD_API_KEY")
        os.environ["RUNPOD_API_KEY"] = api_key

        try:
            # Test the connection
            is_valid = verify_runpod_setup()
            return is_valid
        finally:
            # Restore original key
            if original_key:
                os.environ["RUNPOD_API_KEY"] = original_key
            else:
                os.environ.pop("RUNPOD_API_KEY", None)

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


def verify_runpod_setup():
    """Verify that RunPod is properly configured and API is accessible"""
    try:
        # Set the API key
        api_key = get_runpod_api_key()
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


def get_runpod_gpu_types():
    """Get available GPU types from SkyPilot's RunPod catalog"""
    try:
        from sky.catalog.common import read_catalog

        # Read the RunPod catalog using SkyPilot's read_catalog function
        df = read_catalog("runpod/vms.csv")

        gpu_types = set()  # Use set to avoid duplicates

        # Extract GPU types from the catalog
        for _, row in df.iterrows():
            accelerator_name = str(row.get("AcceleratorName", "")).strip()
            accelerator_count = str(row.get("AcceleratorCount", "1"))
            price = row.get("Price", "0")

            # Skip rows with NaN or empty values
            if (
                accelerator_name
                and accelerator_name != "AcceleratorName"
                and accelerator_name.lower() != "nan"
                and accelerator_count.lower() != "nan"
            ):
                # Format: GPU_NAME:COUNT
                gpu_type = f"{accelerator_name}:{accelerator_count}:{price}"
                gpu_types.add(gpu_type)

        gpu_types_list = sorted(list(gpu_types))

        if gpu_types_list:
            print(
                f"✅ Found {len(gpu_types_list)} GPU types from SkyPilot RunPod catalog"
            )
        else:
            print("⚠️ No GPU types found in SkyPilot RunPod catalog")

        return gpu_types_list

    except Exception as e:
        print(f"❌ Error getting GPU types from SkyPilot catalog: {e}")
        return []


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
