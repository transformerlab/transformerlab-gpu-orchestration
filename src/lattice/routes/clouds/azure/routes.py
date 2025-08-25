from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
)
from pydantic import BaseModel
import os
from typing import Optional

from .utils import (
    verify_azure_setup,
    get_azure_instance_types,
    get_azure_regions,
    setup_azure_config,
    save_azure_config,
    get_azure_config_for_display,
    test_azure_connection,
    load_azure_config,
    run_sky_check_azure,
    set_azure_default_config,
    delete_azure_config,
    get_current_azure_config,
)
from routes.skypilot.utils import get_skypilot_status
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_data,
)
from routes.auth.api_key_auth import get_user_or_api_key


# Azure configuration models
class AzureConfigRequest(BaseModel):
    name: str
    subscription_id: str
    tenant_id: str
    client_id: str
    client_secret: str
    allowed_instance_types: list[str]
    allowed_regions: list[str]
    max_instances: int = 0
    config_key: str = None  # Optional config key for updating existing configs


class AzureTestRequest(BaseModel):
    subscription_id: str
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    auth_mode: str = "service_principal"  # Only service_principal supported


router = APIRouter()


@router.get("/setup")
async def setup_azure(request: Request, response: Response):
    """Setup Azure configuration"""
    try:
        setup_azure_config()
        return {"message": "Azure configuration setup successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup Azure: {str(e)}")


@router.get("/verify")
async def verify_azure(request: Request, response: Response):
    """Verify Azure setup"""
    try:
        is_valid = verify_azure_setup()
        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify Azure setup: {str(e)}"
        )


@router.get("/instance-types")
async def get_azure_instance_types_route(request: Request, response: Response):
    """Get available Azure instance types"""
    try:
        instance_types = get_azure_instance_types()
        return {"instance_types": instance_types}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get Azure instance types: {str(e)}"
        )


@router.get("/regions")
async def get_azure_regions_route(request: Request, response: Response):
    """Get available Azure regions"""
    try:
        regions = get_azure_regions()
        return {"regions": regions}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get Azure regions: {str(e)}"
        )


@router.get("/config")
async def get_azure_config(request: Request, response: Response):
    """Get current Azure configuration"""
    try:
        config = get_azure_config_for_display()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load Azure configuration: {str(e)}"
        )


@router.get("/config/actual")
async def get_azure_config_actual(request: Request, response: Response):
    """Get current Azure configuration with actual credentials (for testing)"""
    try:
        config = load_azure_config()
        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load Azure configuration: {str(e)}"
        )


@router.get("/credentials")
async def get_azure_credentials(
    request: Request, response: Response, config_key: str = None
):
    """Get Azure configuration with actual credentials (for display)"""
    try:
        config_data = load_azure_config()

        if config_key:
            # Return specific config's actual credentials
            if config_key in config_data.get("configs", {}):
                return config_data["configs"][config_key]
            else:
                raise HTTPException(
                    status_code=404, detail=f"Azure config '{config_key}' not found"
                )
        else:
            # Return current default config's actual credentials
            config = get_current_azure_config()
            if config:
                return config
            else:
                raise HTTPException(
                    status_code=404, detail="No Azure configuration found"
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load Azure credentials: {str(e)}"
        )


@router.post("/config")
async def save_azure_config_route(
    request: Request, response: Response, config_request: AzureConfigRequest
):
    """Save Azure configuration"""
    try:
        # Save the configuration using utility function
        config = save_azure_config(
            config_request.name,
            config_request.subscription_id,
            config_request.tenant_id,
            config_request.client_id,
            config_request.client_secret,
            config_request.allowed_instance_types,
            config_request.allowed_regions,
            config_request.max_instances,
            config_request.config_key,
        )

        # Set environment variables for current session only if real credentials were provided
        if (
            config_request.subscription_id
            and not config_request.subscription_id.startswith("*")
        ):
            os.environ["AZURE_SUBSCRIPTION_ID"] = config_request.subscription_id
        elif config.get("subscription_id"):
            os.environ["AZURE_SUBSCRIPTION_ID"] = config["subscription_id"]

        if config_request.tenant_id and not config_request.tenant_id.startswith("*"):
            os.environ["AZURE_TENANT_ID"] = config_request.tenant_id
        elif config.get("tenant_id"):
            os.environ["AZURE_TENANT_ID"] = config["tenant_id"]

        if config_request.client_id and not config_request.client_id.startswith("*"):
            os.environ["AZURE_CLIENT_ID"] = config_request.client_id
        elif config.get("client_id"):
            os.environ["AZURE_CLIENT_ID"] = config["client_id"]

        if config_request.client_secret and not config_request.client_secret.startswith(
            "*"
        ):
            os.environ["AZURE_CLIENT_SECRET"] = config_request.client_secret
        elif config.get("client_secret"):
            os.environ["AZURE_CLIENT_SECRET"] = config["client_secret"]

        # Set the new config as default
        config_key = config_request.name.lower().replace(" ", "_").replace("-", "_")
        set_azure_default_config(config_key)

        # Run sky check to validate the setup if credentials are provided
        sky_check_result = None
        if (
            config.get("subscription_id")
            and config.get("tenant_id")
            and config.get("client_id")
            and config.get("client_secret")
        ):
            try:
                # Run sky check to validate the setup
                is_valid, output = run_sky_check_azure()
                sky_check_result = {
                    "valid": is_valid,
                    "output": output,
                    "message": "Sky check azure completed successfully"
                    if is_valid
                    else "Sky check azure failed",
                }
            except Exception as e:
                sky_check_result = {
                    "valid": False,
                    "output": str(e),
                    "message": f"Error during Azure sky check: {str(e)}",
                }

        # Return the saved config with sky check results
        result = get_azure_config_for_display()
        if sky_check_result:
            result["sky_check_result"] = sky_check_result

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save Azure configuration: {str(e)}"
        )


@router.post("/config/{config_key}/set-default")
async def set_azure_default_config_route(
    request: Request, response: Response, config_key: str
):
    """Set a specific Azure config as default"""
    try:
        result = set_azure_default_config(config_key)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to set Azure default config: {str(e)}"
        )


@router.delete("/config/{config_key}")
async def delete_azure_config_route(
    request: Request, response: Response, config_key: str
):
    """Delete an Azure configuration"""
    try:
        result = delete_azure_config(config_key)
        return {"message": f"Azure config '{config_key}' deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete Azure config: {str(e)}"
        )


@router.post("/test")
async def test_azure_connection_route(
    request: Request, response: Response, test_request: AzureTestRequest
):
    """Test Azure API connection"""
    try:
        # Test the connection using utility function
        is_valid = test_azure_connection(
            test_request.subscription_id,
            test_request.tenant_id or "",
            test_request.client_id or "",
            test_request.client_secret or "",
            test_request.auth_mode,
        )
        if is_valid:
            return {"message": "Azure connection test successful"}
        else:
            raise HTTPException(status_code=400, detail="Azure connection test failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to test Azure connection: {str(e)}"
        )


@router.get("/instances")
async def get_azure_instances(
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Get current Azure instance count and limits"""
    try:
        # Get current configuration
        config = get_current_azure_config()

        # Count current Azure clusters using platform information
        skyPilotStatus = get_skypilot_status()

        user_azure_clusters = []
        for cluster in skyPilotStatus:
            cluster_name = cluster.get("name", "")
            platform_info = get_cluster_platform_data(cluster_name)

            # Check if this is an Azure cluster belonging to current user
            if (
                platform_info
                and platform_info.get("platform") == "azure"
                and platform_info.get("user_id") == user["id"]
                and platform_info.get("organization_id") == user["organization_id"]
            ):
                user_azure_clusters.append(cluster)

        current_count = len(user_azure_clusters)
        max_instances = config.get("max_instances", 0) if config else 0

        return {
            "current_count": current_count,
            "max_instances": max_instances,
            "can_launch": max_instances == 0 or current_count < max_instances,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get Azure instance count: {str(e)}"
        )


@router.get("/sky-check")
async def run_sky_check_azure_route(request: Request, response: Response):
    """Run 'sky check azure' to validate the Azure setup"""
    try:
        is_valid, output = run_sky_check_azure()
        return {
            "valid": is_valid,
            "output": output,
            "message": "Sky check azure completed successfully"
            if is_valid
            else "Sky check azure failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check azure: {str(e)}"
        )
