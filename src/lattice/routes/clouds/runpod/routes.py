from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
)
from pydantic import BaseModel
import os

from .utils import (
    verify_runpod_setup,
    get_runpod_gpu_types_with_pricing,
    get_runpod_display_options,
    get_runpod_display_options_with_pricing,
    setup_runpod_config,
    save_runpod_config,
    get_runpod_config_for_display,
    test_runpod_connection,
    run_sky_check_runpod,
    create_runpod_config_toml,
    set_runpod_default_config,
    delete_runpod_config,
    get_current_runpod_config,
)
from routes.instances.utils import get_skypilot_status
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_data,
)
from routes.auth.api_key_auth import get_user_or_api_key


# RunPod configuration models
class RunPodConfigRequest(BaseModel):
    name: str
    api_key: str
    allowed_gpu_types: list[str]  # Keep for backward compatibility
    allowed_display_options: list[str] = None  # New field for display options
    max_instances: int = 0
    config_key: str = None  # Optional config key for updating existing configs


class RunPodTestRequest(BaseModel):
    api_key: str


router = APIRouter()


@router.get("/setup")
async def setup_runpod(request: Request, response: Response):
    """Setup RunPod configuration"""
    try:
        setup_runpod_config()
        # Run sky check to validate the setup
        is_valid, output = run_sky_check_runpod()
        return {
            "message": "RunPod configuration setup successfully",
            "sky_check_valid": is_valid,
            "sky_check_output": output,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup RunPod: {str(e)}")


@router.get("/verify")
async def verify_runpod(request: Request, response: Response):
    """Verify RunPod setup"""
    try:
        is_valid = verify_runpod_setup()
        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify RunPod setup: {str(e)}"
        )


@router.get("/gpu-types")
async def get_runpod_gpu_types_route(request: Request, response: Response):
    """Get available GPU types from RunPod with pricing information"""
    try:
        gpu_types_with_pricing = get_runpod_gpu_types_with_pricing()
        # Return both the detailed format and the simple format for backward compatibility
        gpu_types_simple = [gpu["name"] for gpu in gpu_types_with_pricing]
        return {
            "gpu_types": gpu_types_simple,
            "gpu_types_with_pricing": gpu_types_with_pricing,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod GPU types: {str(e)}"
        )


@router.get("/gpu-types-with-pricing")
async def get_runpod_gpu_types_with_pricing_route(request: Request, response: Response):
    """Get available GPU types from RunPod with detailed pricing information."""
    try:
        gpu_types_with_pricing = get_runpod_gpu_types_with_pricing()
        return {"gpu_types_with_pricing": gpu_types_with_pricing}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get RunPod GPU types with pricing: {str(e)}",
        )


@router.get("/display-options")
async def get_runpod_display_options_route(request: Request, response: Response):
    """Get available RunPod options with user-friendly display names"""
    try:
        display_options = get_runpod_display_options()
        return {"display_options": display_options}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod display options: {str(e)}"
        )


@router.get("/display-options-with-pricing")
async def get_runpod_display_options_with_pricing_route(
    request: Request, response: Response
):
    """Get available RunPod options with user-friendly display names and pricing information."""
    try:
        display_options_with_pricing = get_runpod_display_options_with_pricing()
        return {"display_options_with_pricing": display_options_with_pricing}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get RunPod display options with pricing: {str(e)}",
        )


@router.get("/config")
async def get_runpod_config(request: Request, response: Response):
    """Get current RunPod configuration"""
    try:
        config = get_runpod_config_for_display()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load RunPod configuration: {str(e)}"
        )


@router.post("/config")
async def save_runpod_config_route(
    request: Request, response: Response, config_request: RunPodConfigRequest
):
    """Save RunPod configuration"""
    try:
        print(
            f"🔍 RunPod config request - allowed_gpu_types: {config_request.allowed_gpu_types}"
        )
        print(
            f"🔍 RunPod config request - allowed_display_options: {config_request.allowed_display_options}"
        )

        # Save the configuration using utility function
        config = save_runpod_config(
            config_request.name,
            config_request.api_key,
            config_request.allowed_gpu_types,
            config_request.max_instances,
            config_request.config_key,
        )

        # If display options are provided, update the config
        if config_request.allowed_display_options:
            config["allowed_display_options"] = config_request.allowed_display_options

        # Set environment variable for current session only if a real API key was provided
        if config_request.api_key and not config_request.api_key.startswith("*"):
            os.environ["RUNPOD_API_KEY"] = config_request.api_key
        elif config.get("api_key"):
            # Use the saved API key from config
            os.environ["RUNPOD_API_KEY"] = config["api_key"]

        # Set the new config as default
        config_key = config_request.name.lower().replace(" ", "_").replace("-", "_")
        set_runpod_default_config(config_key)

        # Create config.toml file and run sky check if API key is provided
        sky_check_result = None
        if config.get("api_key"):
            try:
                # Create the config.toml file
                if create_runpod_config_toml(config["api_key"]):
                    # Run sky check to validate the setup
                    is_valid, output = run_sky_check_runpod()
                    sky_check_result = {
                        "valid": is_valid,
                        "output": output,
                        "message": "Sky check runpod completed successfully"
                        if is_valid
                        else "Sky check runpod failed",
                    }
                else:
                    sky_check_result = {
                        "valid": False,
                        "output": "Failed to create config.toml file",
                        "message": "Failed to create RunPod config.toml file",
                    }
            except Exception as e:
                sky_check_result = {
                    "valid": False,
                    "output": str(e),
                    "message": f"Error during RunPod setup: {str(e)}",
                }

        # Return the saved config with sky check results
        result = get_runpod_config_for_display()
        if sky_check_result:
            result["sky_check_result"] = sky_check_result

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save RunPod configuration: {str(e)}"
        )


@router.post("/config/{config_key}/set-default")
async def set_runpod_default_config_route(
    request: Request, response: Response, config_key: str
):
    """Set a specific RunPod config as default"""
    try:
        result = set_runpod_default_config(config_key)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to set RunPod default config: {str(e)}"
        )


@router.delete("/config/{config_key}")
async def delete_runpod_config_route(
    request: Request, response: Response, config_key: str
):
    """Delete a RunPod configuration"""
    try:
        delete_runpod_config(config_key)
        return {"message": f"RunPod config '{config_key}' deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete RunPod config: {str(e)}"
        )


@router.post("/test")
async def test_runpod_connection_route(
    request: Request, response: Response, test_request: RunPodTestRequest
):
    """Test RunPod API connection"""
    try:
        # Test the connection using utility function
        is_valid = test_runpod_connection(test_request.api_key)
        if is_valid:
            return {"message": "RunPod connection test successful"}
        else:
            raise HTTPException(status_code=400, detail="RunPod connection test failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to test RunPod connection: {str(e)}"
        )


@router.get("/sky-check")
async def run_sky_check_runpod_route(request: Request, response: Response):
    """Run 'sky check runpod' to validate the RunPod setup"""
    try:
        is_valid, output = run_sky_check_runpod()
        return {
            "valid": is_valid,
            "output": output,
            "message": "Sky check runpod completed successfully"
            if is_valid
            else "Sky check runpod failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check runpod: {str(e)}"
        )


@router.get("/instances")
async def get_runpod_instances(
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Get current RunPod instance count and limits"""
    try:
        # Get current configuration
        config = get_current_runpod_config()

        # Count current RunPod clusters using platform information
        skyPilotStatus = get_skypilot_status()

        user_runpod_clusters = []
        for cluster in skyPilotStatus:
            cluster_name = cluster.get("name", "")
            platform_info = get_cluster_platform_data(cluster_name)

            # Check if this is a RunPod cluster belonging to current user
            if (
                platform_info
                and platform_info.get("platform") == "runpod"
                and platform_info.get("user_id") == user["id"]
                and platform_info.get("organization_id") == user["organization_id"]
            ):
                user_runpod_clusters.append(cluster)

        current_count = len(user_runpod_clusters)
        max_instances = config.get("max_instances", 0) if config else 0

        return {
            "current_count": current_count,
            "max_instances": max_instances,
            "can_launch": max_instances == 0 or current_count < max_instances,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get RunPod instance count: {str(e)}"
        )
