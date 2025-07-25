import os
import runpod
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
    """Get available GPU types from RunPod"""
    try:
        # Set the API key
        if not RUNPOD_API_KEY:
            print("❌ RUNPOD_API_KEY environment variable is required")
            return []

        runpod.api_key = RUNPOD_API_KEY

        # Get GPU types using the RunPod SDK
        try:
            gpu_list = runpod.get_gpus()
            gpu_types = []

            # Extract unique GPU types from the response
            for gpu in gpu_list:
                gpu_name = gpu.get("displayName") or gpu.get("name")
                if gpu_name and gpu_name not in gpu_types:
                    gpu_types.append(gpu_name)

            if gpu_types:
                print(f"✅ Found {len(gpu_types)} GPU types from RunPod")
            else:
                print(
                    "⚠️ No GPU types found. This might indicate no GPUs are available."
                )

            return gpu_types

        except Exception as gpu_error:
            print(f"❌ Failed to get GPU types: {str(gpu_error)}")

            # Check for specific error types
            error_str = str(gpu_error).lower()
            if "unauthorized" in error_str:
                print("❌ API key authentication failed")
            elif "not found" in error_str:
                print("❌ API key not found")
            elif "timeout" in error_str:
                print("❌ Request timed out")
            return []

    except Exception as e:
        print(f"❌ Error getting GPU types: {e}")
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
