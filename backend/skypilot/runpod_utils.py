import os
import runpod
import csv
from pathlib import Path
from config import RUNPOD_API_KEY


def setup_runpod_config():
    """Setup RunPod configuration for SkyPilot integration"""
    if not RUNPOD_API_KEY:
        raise ValueError(
            "RUNPOD_API_KEY environment variable is required for RunPod integration"
        )

    # Set the API key for the RunPod SDK
    runpod.api_key = RUNPOD_API_KEY
    print("✅ RunPod API key configured")
    return True


def verify_runpod_setup():
    """Verify that RunPod is properly configured and API is accessible"""
    try:
        # Set the API key
        if not RUNPOD_API_KEY:
            print("❌ RUNPOD_API_KEY environment variable is required")
            return False

        runpod.api_key = RUNPOD_API_KEY

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
        # Find the SkyPilot catalog directory
        sky_home = Path.home() / ".sky"
        catalogs_dir = sky_home / "catalogs"

        if not catalogs_dir.exists():
            print("❌ SkyPilot catalogs directory not found")
            return []

        # Find the version directory (v7, v8, etc.)
        version_dirs = [
            d for d in catalogs_dir.iterdir() if d.is_dir() and d.name.startswith("v")
        ]
        if not version_dirs:
            print("❌ No version directory found in SkyPilot catalogs")
            return []

        # Use the first (and should be only) version directory
        version_dir = version_dirs[0]
        runpod_catalog_dir = version_dir / "runpod"

        if not runpod_catalog_dir.exists():
            print(f"❌ RunPod catalog directory not found at {runpod_catalog_dir}")
            return []

        # Find CSV files in the runpod catalog directory
        csv_files = list(runpod_catalog_dir.glob("*.csv"))
        if not csv_files:
            print(f"❌ No CSV files found in {runpod_catalog_dir}")
            return []

        gpu_types = set()  # Use set to avoid duplicates

        # Read all CSV files
        for csv_file in csv_files:
            try:
                with open(csv_file, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        accelerator_name = row.get("AcceleratorName", "").strip()
                        accelerator_count = row.get("AcceleratorCount", "1").strip()

                        if accelerator_name and accelerator_name != "AcceleratorName":
                            # Format: GPU_NAME:COUNT
                            gpu_type = f"{accelerator_name}:{accelerator_count}"
                            gpu_types.add(gpu_type)

            except Exception as csv_error:
                print(f"⚠️ Error reading {csv_file}: {csv_error}")
                continue

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
