from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response
from pydantic import BaseModel

from ..auth.api_key_auth import get_user_or_api_key
from lattice.routes.auth.api_key_auth import enforce_csrf
from .azure.utils import (
    az_verify_setup,
    az_get_instance_types,
    az_get_regions,
    az_setup_config,
    az_save_config_with_setup,
    az_get_config_for_display,
    az_test_connection,
    load_azure_config,
    az_run_sky_check,
    az_set_default_config,
    az_delete_config,
    az_get_current_config,
    az_get_price_per_hour,
)
from .runpod.utils import (
    rp_verify_setup,
    rp_get_display_options,
    rp_get_display_options_with_pricing,
    rp_setup_config,
    rp_save_config_with_setup,
    rp_get_config_for_display,
    rp_test_connection,
    rp_run_sky_check,
    rp_set_default_config,
    rp_delete_config,
    rp_get_current_config,
    load_runpod_config,
    rp_get_price_per_hour,
)
from routes.instances.utils import get_skypilot_status
from utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_data,
)
from routes.clouds.ssh.routes import router as ssh_router
from routes.auth.utils import requires_admin
from config import get_db
from sqlalchemy.orm import Session
from db.db_models import NodePoolAccess, CloudAccount
from routes.quota.utils import get_user_team_id


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
    api_key: str
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
async def setup_cloud(cloud: str = Path(..., pattern="^(azure|runpod)$")):
    """Setup cloud configuration"""
    try:
        if cloud == "azure":
            az_setup_config()
            return {"message": f"{cloud.title()} configuration setup successfully"}
        elif cloud == "runpod":
            rp_setup_config()
            try:
                is_valid, output = rp_run_sky_check()
                return {
                    "message": f"{cloud.title()} configuration setup successfully",
                    "sky_check_valid": is_valid,
                    "sky_check_output": output,
                }
            except Exception as e:
                return {
                    "message": f"{cloud.title()} configuration setup successfully",
                    "sky_check_valid": False,
                    "sky_check_output": str(e),
                }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to setup {cloud}: {str(e)}"
        )


@router.get("/{cloud}/verify")
async def verify_cloud(cloud: str = Path(..., pattern="^(azure|runpod)$")):
    """Verify cloud setup"""
    try:
        if cloud == "azure":
            is_valid = az_verify_setup()
        elif cloud == "runpod":
            is_valid = rp_verify_setup()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to verify {cloud} setup: {str(e)}"
        )


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
        if cloud == "azure":
            config = az_get_config_for_display()
        elif cloud == "runpod":
            config = rp_get_config_for_display()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        # Enrich with allowed_team_ids from DB per config
        try:
            configs = config.get("configs", {})
            for key in list(configs.keys()):
                access = (
                    db.query(NodePoolAccess)
                    .filter(
                        NodePoolAccess.organization_id == user["organization_id"],
                        NodePoolAccess.provider == cloud,
                        NodePoolAccess.pool_key == key,
                    )
                    .first()
                )
                if access and access.allowed_team_ids is not None:
                    configs[key]["allowed_team_ids"] = access.allowed_team_ids
                else:
                    configs[key]["allowed_team_ids"] = []
        except Exception as _:
            pass

        return config
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load {cloud} configuration: {str(e)}"
        )


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
        raise HTTPException(
            status_code=400, detail="Credentials endpoint only available for Azure"
        )

    try:
        config_data = load_azure_config()

        if config_key:
            if config_key in config_data.get("configs", {}):
                cfg = config_data["configs"][config_key]
                # Enrich with allowed_team_ids from DB
                try:
                    access = (
                        db.query(NodePoolAccess)
                        .filter(
                            NodePoolAccess.organization_id == user["organization_id"],
                            NodePoolAccess.provider == "azure",
                            NodePoolAccess.pool_key == config_key,
                        )
                        .first()
                    )
                    if access and access.allowed_team_ids is not None:
                        cfg = cfg.copy()
                        cfg["allowed_team_ids"] = access.allowed_team_ids
                except Exception:
                    pass
                return cfg
            else:
                raise HTTPException(
                    status_code=404, detail=f"Azure config '{config_key}' not found"
                )
        else:
            config = az_get_current_config()
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
        if cloud == "azure":
            if not isinstance(config_request, AzureConfigRequest):
                raise HTTPException(
                    status_code=400, detail="Invalid config request for Azure"
                )

            result = az_save_config_with_setup(
                config_request.name,
                config_request.subscription_id,
                config_request.tenant_id,
                config_request.client_id,
                config_request.client_secret,
                config_request.allowed_instance_types,
                config_request.allowed_regions,
                config_request.max_instances,
                config_request.config_key,
                config_request.allowed_team_ids,
            )

            # Persist team access in DB keyed by config key
            try:
                final_key = (
                    config_request.name.lower().replace(" ", "_").replace("-", "_")
                )
                # If the config was renamed, remove old access row
                if config_request.config_key and config_request.config_key != final_key:
                    try:
                        old = (
                            db.query(NodePoolAccess)
                            .filter(
                                NodePoolAccess.organization_id
                                == user["organization_id"],
                                NodePoolAccess.provider == "azure",
                                NodePoolAccess.pool_key == config_request.config_key,
                            )
                            .first()
                        )
                        if old:
                            db.delete(old)
                            db.commit()
                    except Exception:
                        pass
                access = (
                    db.query(NodePoolAccess)
                    .filter(
                        NodePoolAccess.organization_id == user["organization_id"],
                        NodePoolAccess.provider == "azure",
                        NodePoolAccess.pool_key == final_key,
                    )
                    .first()
                )
                if not access:
                    access = NodePoolAccess(
                        organization_id=user["organization_id"],
                        provider="azure",
                        pool_key=final_key,
                        allowed_team_ids=config_request.allowed_team_ids or [],
                    )
                    db.add(access)
                else:
                    access.allowed_team_ids = config_request.allowed_team_ids or []
                db.commit()
            except Exception as _:
                pass

            # Persist cloud account + credentials in DB
            try:
                final_key = config_request.name.lower().replace(" ", "_").replace("-", "_")
                # If renamed, remove old CloudAccount row
                if config_request.config_key and config_request.config_key != final_key:
                    try:
                        old_ca = (
                            db.query(CloudAccount)
                            .filter(
                                CloudAccount.organization_id == user["organization_id"],
                                CloudAccount.provider == "azure",
                                CloudAccount.key == config_request.config_key,
                            )
                            .first()
                        )
                        if old_ca:
                            db.delete(old_ca)
                            db.commit()
                    except Exception:
                        pass

                # Determine default after save
                try:
                    cfg_data = load_azure_config()
                    is_default = cfg_data.get("default_config") == final_key
                except Exception:
                    is_default = False

                credentials = {
                    "subscription_id": config_request.subscription_id,
                    "tenant_id": config_request.tenant_id,
                    "client_id": config_request.client_id,
                    "client_secret": config_request.client_secret,
                    "auth_method": "service_principal",
                }
                settings = {
                    "allowed_instance_types": config_request.allowed_instance_types or [],
                    "allowed_regions": config_request.allowed_regions or [],
                }

                ca = (
                    db.query(CloudAccount)
                    .filter(
                        CloudAccount.organization_id == user["organization_id"],
                        CloudAccount.provider == "azure",
                        CloudAccount.key == final_key,
                    )
                    .first()
                )
                if not ca:
                    ca = CloudAccount(
                        organization_id=user["organization_id"],
                        provider="azure",
                        key=final_key,
                        name=config_request.name,
                        credentials=credentials,
                        settings=settings,
                        max_instances=int(config_request.max_instances or 0),
                        is_default=bool(is_default),
                        created_by=user.get("id"),
                    )
                    db.add(ca)
                else:
                    ca.name = config_request.name
                    ca.credentials = credentials
                    ca.settings = settings
                    ca.max_instances = int(config_request.max_instances or 0)
                    ca.is_default = bool(is_default)
                db.commit()
            except Exception:
                # Don't block on DB persistence
                pass

            return result

        elif cloud == "runpod":
            if not isinstance(config_request, RunPodConfigRequest):
                raise HTTPException(
                    status_code=400, detail="Invalid config request for RunPod"
                )

            result = rp_save_config_with_setup(
                config_request.name,
                config_request.api_key,
                config_request.allowed_gpu_types,
                config_request.max_instances,
                config_request.config_key,
                config_request.allowed_display_options,
                config_request.allowed_team_ids,
            )

            # Persist team access in DB keyed by config key
            try:
                final_key = (
                    config_request.name.lower().replace(" ", "_").replace("-", "_")
                )
                # If the config was renamed, remove old access row
                if config_request.config_key and config_request.config_key != final_key:
                    try:
                        old = (
                            db.query(NodePoolAccess)
                            .filter(
                                NodePoolAccess.organization_id
                                == user["organization_id"],
                                NodePoolAccess.provider == "runpod",
                                NodePoolAccess.pool_key == config_request.config_key,
                            )
                            .first()
                        )
                        if old:
                            db.delete(old)
                            db.commit()
                    except Exception:
                        pass
                access = (
                    db.query(NodePoolAccess)
                    .filter(
                        NodePoolAccess.organization_id == user["organization_id"],
                        NodePoolAccess.provider == "runpod",
                        NodePoolAccess.pool_key == final_key,
                    )
                    .first()
                )
                if not access:
                    access = NodePoolAccess(
                        organization_id=user["organization_id"],
                        provider="runpod",
                        pool_key=final_key,
                        allowed_team_ids=config_request.allowed_team_ids or [],
                    )
                    db.add(access)
                else:
                    access.allowed_team_ids = config_request.allowed_team_ids or []
                db.commit()
            except Exception as _:
                pass

            # Persist cloud account + credentials in DB
            try:
                final_key = config_request.name.lower().replace(" ", "_").replace("-", "_")
                # If renamed, remove old CloudAccount row
                if config_request.config_key and config_request.config_key != final_key:
                    try:
                        old_ca = (
                            db.query(CloudAccount)
                            .filter(
                                CloudAccount.organization_id == user["organization_id"],
                                CloudAccount.provider == "runpod",
                                CloudAccount.key == config_request.config_key,
                            )
                            .first()
                        )
                        if old_ca:
                            db.delete(old_ca)
                            db.commit()
                    except Exception:
                        pass

                # Determine default after save
                try:
                    cfg_data = load_runpod_config()
                    is_default = cfg_data.get("default_config") == final_key
                except Exception:
                    is_default = False

                credentials = {"api_key": config_request.api_key}
                settings = {
                    "allowed_gpu_types": config_request.allowed_gpu_types or [],
                    "allowed_display_options": config_request.allowed_display_options or [],
                }

                ca = (
                    db.query(CloudAccount)
                    .filter(
                        CloudAccount.organization_id == user["organization_id"],
                        CloudAccount.provider == "runpod",
                        CloudAccount.key == final_key,
                    )
                    .first()
                )
                if not ca:
                    ca = CloudAccount(
                        organization_id=user["organization_id"],
                        provider="runpod",
                        key=final_key,
                        name=config_request.name,
                        credentials=credentials,
                        settings=settings,
                        max_instances=int(config_request.max_instances or 0),
                        is_default=bool(is_default),
                        created_by=user.get("id"),
                    )
                    db.add(ca)
                else:
                    ca.name = config_request.name
                    ca.credentials = credentials
                    ca.settings = settings
                    ca.max_instances = int(config_request.max_instances or 0)
                    ca.is_default = bool(is_default)
                db.commit()
            except Exception:
                # Don't block on DB persistence
                pass

            return result
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to save {cloud} configuration: {str(e)}"
        )


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
        if cloud == "azure":
            result = az_set_default_config(config_key)
        elif cloud == "runpod":
            result = rp_set_default_config(config_key)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        # Mark default in DB for this org+provider
        try:
            q = db.query(CloudAccount).filter(
                CloudAccount.organization_id == user["organization_id"],
                CloudAccount.provider == cloud,
            )
            for ca in q.all():
                ca.is_default = (ca.key == config_key)
            db.commit()
        except Exception:
            pass

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to set {cloud} default config: {str(e)}"
        )


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
        if cloud == "azure":
            az_delete_config(config_key)
        elif cloud == "runpod":
            rp_delete_config(config_key)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        # Remove CloudAccount row
        try:
            ca = (
                db.query(CloudAccount)
                .filter(
                    CloudAccount.organization_id == user["organization_id"],
                    CloudAccount.provider == cloud,
                    CloudAccount.key == config_key,
                )
                .first()
            )
            if ca:
                db.delete(ca)
                db.commit()
        except Exception:
            pass

        return {"message": f"{cloud.title()} config '{config_key}' deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete {cloud} config: {str(e)}"
        )


@router.post("/{cloud}/test")
async def test_cloud_connection(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    test_request: AzureTestRequest | RunPodTestRequest = None,
    __: dict = Depends(requires_admin),
):
    """Test cloud API connection"""
    try:
        if cloud == "azure":
            if not isinstance(test_request, AzureTestRequest):
                raise HTTPException(
                    status_code=400, detail="Invalid test request for Azure"
                )

            is_valid = az_test_connection(
                test_request.subscription_id,
                test_request.tenant_id or "",
                test_request.client_id or "",
                test_request.client_secret or "",
                test_request.auth_mode,
            )
        elif cloud == "runpod":
            if not isinstance(test_request, RunPodTestRequest):
                raise HTTPException(
                    status_code=400, detail="Invalid test request for RunPod"
                )

            is_valid = rp_test_connection(test_request.api_key)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        if is_valid:
            return {"message": f"{cloud.title()} connection test successful"}
        else:
            raise HTTPException(
                status_code=400, detail=f"{cloud.title()} connection test failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to test {cloud} connection: {str(e)}"
        )


@router.get("/{cloud}/sky-check")
async def run_cloud_sky_check(cloud: str = Path(..., pattern="^(azure|runpod)$")):
    """Run 'sky check' to validate the cloud setup"""
    try:
        if cloud == "azure":
            is_valid, output = az_run_sky_check()
        elif cloud == "runpod":
            is_valid, output = rp_run_sky_check()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        return {
            "valid": is_valid,
            "output": output,
            "message": f"Sky check {cloud} completed successfully"
            if is_valid
            else f"Sky check {cloud} failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check {cloud}: {str(e)}"
        )


@router.get("/{cloud}/instances")
async def get_cloud_instances(
    cloud: str = Path(..., pattern="^(azure|runpod)$"),
    user: dict = Depends(get_user_or_api_key),
    db: Session = Depends(get_db),
):
    """Get current cloud instance count and limits"""
    try:
        if cloud == "azure":
            config = az_get_current_config()
        elif cloud == "runpod":
            config = rp_get_current_config()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        skyPilotStatus = get_skypilot_status()

        user_cloud_clusters = []
        for cluster in skyPilotStatus:
            cluster_name = cluster.get("name", "")
            platform_info = get_cluster_platform_data(cluster_name)

            if (
                platform_info
                and platform_info.get("platform") == cloud
                and platform_info.get("user_id") == user["id"]
                and platform_info.get("organization_id") == user["organization_id"]
            ):
                user_cloud_clusters.append(cluster)

        current_count = len(user_cloud_clusters)
        max_instances = config.get("max_instances", 0) if config else 0

        # Team access enforcement: check default config access
        access_allowed = True
        try:
            # Get default config key
            default_key = None
            if cloud == "azure":
                cfg_data = load_azure_config()
            else:
                cfg_data = load_runpod_config()
            default_key = cfg_data.get("default_config")
            if default_key:
                access_row = (
                    db.query(NodePoolAccess)
                    .filter(
                        NodePoolAccess.organization_id == user["organization_id"],
                        NodePoolAccess.provider == cloud,
                        NodePoolAccess.pool_key == default_key,
                    )
                    .first()
                )
                allowed_team_ids = (
                    access_row.allowed_team_ids if access_row and access_row.allowed_team_ids else []
                )
                if allowed_team_ids:
                    user_team_id = get_user_team_id(db, user["organization_id"], user["id"]) if db else None
                    access_allowed = user_team_id is not None and user_team_id in allowed_team_ids
        except Exception:
            pass

        return {
            "current_count": current_count,
            "max_instances": max_instances,
            "can_launch": (max_instances == 0 or current_count < max_instances) and access_allowed,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get {cloud} instance count: {str(e)}"
        )


@router.get("/{cloud}/info")
async def get_cloud_info(cloud: str = Path(..., pattern="^(azure|runpod)$")):
    """Get cloud-specific information (instance types, regions, GPU types, display options, etc.)"""
    try:
        if cloud == "azure":
            # Get Azure-specific information
            instance_types = az_get_instance_types()
            regions = az_get_regions()

            return {
                "instance_types": instance_types,
                "regions": regions,
            }
        elif cloud == "runpod":
            # Get RunPod-specific information
            display_options = rp_get_display_options()
            display_options_with_pricing = rp_get_display_options_with_pricing()

            return {
                "display_options": display_options,
                "display_options_with_pricing": display_options_with_pricing,
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get {cloud} info: {str(e)}"
        )


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
        if cloud == "azure":
            if not instance_type:
                raise HTTPException(status_code=400, detail="instance_type is required for Azure pricing")
            price = az_get_price_per_hour(instance_type, region=region)
        elif cloud == "runpod":
            if not display_option:
                raise HTTPException(status_code=400, detail="display_option is required for RunPod pricing")
            price = rp_get_price_per_hour(display_option)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

        if price is None:
            raise HTTPException(status_code=404, detail="Price not found for the specified configuration")
        return {"price_per_hour": float(price)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get {cloud} price: {str(e)}")
