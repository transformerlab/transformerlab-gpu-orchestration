from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response
from pydantic import BaseModel

from ..auth.api_key_auth import get_user_or_api_key
from lattice.routes.auth.api_key_auth import enforce_csrf
from lattice.services.clouds import (
    delete_cloud_config as svc_delete_cloud_config,
    get_cloud_config as svc_get_cloud_config,
    get_cloud_credentials as svc_get_cloud_credentials,
    get_cloud_info as svc_get_cloud_info,
    get_cloud_instances as svc_get_cloud_instances,
    get_cloud_price as svc_get_cloud_price,
    save_cloud_config as svc_save_cloud_config,
    set_cloud_default_config as svc_set_cloud_default_config,
    setup_cloud as svc_setup_cloud,
    test_cloud_connection as svc_test_cloud_connection,
    verify_cloud as svc_verify_cloud,
)
from routes.clouds.ssh.routes import router as ssh_router
from routes.auth.utils import requires_admin
from config import get_db
from sqlalchemy.orm import Session
# All business logic is delegated to services for testability


# Configuration models
class AzureConfigRequest(BaseModel):
    name: str
    subscription_id: str
    tenant_id: str
    client_id: str
    client_secret: str
    allowed_instance_types: list[str]
    allowed_regions: list[str]
    max_instances: int = 0
    config_key: str = None
    # Teams allowed to use this pool (team IDs)
    allowed_team_ids: list[str] = []


class RunPodConfigRequest(BaseModel):
    name: str
    api_key: str | None = None
    allowed_gpu_types: list[str]
    allowed_display_options: list[str] = None
    max_instances: int = 0
    config_key: str = None
    # Teams allowed to use this pool (team IDs)
    allowed_team_ids: list[str] = []


class AzureTestRequest(BaseModel):
    subscription_id: str
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    auth_mode: str = "service_principal"


class RunPodTestRequest(BaseModel):
    api_key: str


# Create main clouds router
router = APIRouter(
    prefix="/clouds",
    dependencies=[Depends(get_user_or_api_key), Depends(enforce_csrf)],
    tags=["clouds"],
)

# Include SSH router

router.include_router(ssh_router, prefix="/ssh")


@router.get("/{cloud}/setup")
async def setup_cloud(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    user: dict = Depends(get_user_or_api_key),
):
    """Setup cloud configuration"""
    try:
        return svc_setup_cloud(cloud, user.get("organization_id"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup {cloud}: {str(e)}")


@router.get("/{cloud}/verify")
async def verify_cloud(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    user: dict = Depends(get_user_or_api_key),
):
    """Verify cloud setup"""
    try:
        return svc_verify_cloud(cloud, user.get("organization_id"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify {cloud} setup: {str(e)}")


@router.get("/{cloud}/config")
async def get_cloud_config(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    request: Request = None,
    response: Response = None,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Get current cloud configuration"""
    try:
        return svc_get_cloud_config(cloud, user.get("organization_id"), db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load {cloud} configuration: {str(e)}")


@router.get("/{cloud}/credentials")
async def get_cloud_credentials(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    config_key: str = None,
    request: Request = None,
    response: Response = None,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    """Get cloud configuration with actual credentials (Azure only)"""
    if cloud != "azure":
        raise HTTPException(status_code=400, detail="Credentials endpoint only available for Azure")
    try:
        return svc_get_cloud_credentials(user.get("organization_id"), db, config_key)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load Azure credentials: {str(e)}")


@router.post("/{cloud}/config")
async def save_cloud_config(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    config_request: AzureConfigRequest | RunPodConfigRequest = None,
    request: Request = None,
    response: Response = None,
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
    __: dict = Depends(requires_admin),
):
    """Save cloud configuration"""
    try:
        if cloud == "azure" and not isinstance(config_request, AzureConfigRequest):
            raise HTTPException(status_code=400, detail="Invalid config request for Azure")
        if cloud == "runpod" and not isinstance(config_request, RunPodConfigRequest):
            raise HTTPException(status_code=400, detail="Invalid config request for RunPod")

        return svc_save_cloud_config(
            cloud,
            organization_id=user.get("organization_id"),
            user_id=user.get("id"),
            db=db,
            # Azure
            name=getattr(config_request, "name", None),
            subscription_id=getattr(config_request, "subscription_id", None),
            tenant_id=getattr(config_request, "tenant_id", None),
            client_id=getattr(config_request, "client_id", None),
            client_secret=getattr(config_request, "client_secret", None),
            allowed_instance_types=getattr(config_request, "allowed_instance_types", None),
            allowed_regions=getattr(config_request, "allowed_regions", None),
            # RunPod
            api_key=getattr(config_request, "api_key", None),
            allowed_gpu_types=getattr(config_request, "allowed_gpu_types", None),
            allowed_display_options=getattr(config_request, "allowed_display_options", None),
            # Common
            max_instances=getattr(config_request, "max_instances", 0) or 0,
            config_key=getattr(config_request, "config_key", None),
            allowed_team_ids=getattr(config_request, "allowed_team_ids", None),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save {cloud} configuration: {str(e)}")


@router.post("/{cloud}/config/{config_key}/set-default")
async def set_cloud_default_config(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    config_key: str = None,
    __: dict = Depends(requires_admin),
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Set a specific cloud config as default"""
    try:
        return svc_set_cloud_default_config(
            cloud, user.get("organization_id"), config_key, db
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set {cloud} default config: {str(e)}")


@router.delete("/{cloud}/config/{config_key}")
async def delete_cloud_config(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    config_key: str = None,
    __: dict = Depends(requires_admin),
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Delete a cloud configuration"""
    try:
        return svc_delete_cloud_config(
            cloud, user.get("organization_id"), config_key, db
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete {cloud} config: {str(e)}")


@router.post("/{cloud}/test")
async def test_cloud_connection(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    test_request: AzureTestRequest | RunPodTestRequest = None,
    __: dict = Depends(requires_admin),
):
    """Test cloud API connection"""
    try:
        if cloud == "azure" and not isinstance(test_request, AzureTestRequest):
            raise HTTPException(status_code=400, detail="Invalid test request for Azure")
        if cloud == "runpod" and not isinstance(test_request, RunPodTestRequest):
            raise HTTPException(status_code=400, detail="Invalid test request for RunPod")

        return svc_test_cloud_connection(
            cloud,
            subscription_id=getattr(test_request, "subscription_id", None),
            tenant_id=getattr(test_request, "tenant_id", None),
            client_id=getattr(test_request, "client_id", None),
            client_secret=getattr(test_request, "client_secret", None),
            auth_mode=getattr(test_request, "auth_mode", None),
            api_key=getattr(test_request, "api_key", None),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test {cloud} connection: {str(e)}")


@router.get("/{cloud}/instances")
async def get_cloud_instances(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Get current cloud instance count and limits"""
    try:
        return svc_get_cloud_instances(
            cloud, user.get("organization_id"), user.get("id"), db
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get {cloud} instance count: {str(e)}")


@router.get("/{cloud}/info")
async def get_cloud_info(cloud: str = Path(..., pattern="^(azure|runpod)$")):
    """Get cloud-specific information (instance types, regions, GPU types, display options, etc.)"""
    try:
        return svc_get_cloud_info(cloud)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get {cloud} info: {str(e)}")


@router.get("/{cloud}/price")
async def get_cloud_price(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    instance_type: str | None = None,
    region: str | None = None,
    display_option: str | None = None,
):
    """Get price per hour for a specific cloud configuration.

    - For azure: provide `instance_type` and optional `region`.
    - For runpod: provide `display_option` (e.g., "A100:1" or "CPU:8-32GB").
    """
    try:
        return svc_get_cloud_price(
            cloud, instance_type=instance_type, region=region, display_option=display_option
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get {cloud} price: {str(e)}")
