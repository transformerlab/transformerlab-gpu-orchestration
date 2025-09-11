from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

# Import cloud-specific utilities (keep implementation details here)
from .azure.utils import (
    az_delete_config,
    az_get_config_for_display,
    az_get_current_config,
    az_get_instance_types,
    az_get_price_per_hour,
    az_get_regions,
    az_verify_setup,
    az_run_sky_check,
    az_set_default_config,
    az_save_config_with_setup,
    az_setup_config,
    az_test_connection,
    load_azure_config,
)
from .runpod.utils import (
    load_runpod_config,
    rp_delete_config,
    rp_get_config_for_display,
    rp_get_current_config,
    rp_get_display_options,
    rp_get_display_options_with_pricing,
    rp_get_price_per_hour,
    rp_run_sky_check,
    rp_set_default_config,
    rp_save_config_with_setup,
    rp_setup_config,
    rp_test_connection,
    rp_verify_setup,
)

from ...utils.core import get_skypilot_status, get_user_team_id
from ...utils.cluster_utils import (
    get_cluster_platform_info as get_cluster_platform_data,
)
from ...db.db_models import NodePoolAccess


def setup_cloud(cloud: str, organization_id: str) -> Dict[str, Any]:
    if cloud == "azure":
        az_setup_config(organization_id)
    elif cloud == "runpod":
        rp_setup_config(organization_id)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")
    return {"message": f"{cloud.title()} configuration setup successfully"}


def verify_cloud(cloud: str, organization_id: str) -> Dict[str, Any]:
    if cloud == "azure":
        is_valid = bool(az_verify_setup(organization_id))
    elif cloud == "runpod":
        # Align with previous behavior using rp_verify_setup (not runtime sky check)
        is_valid = bool(rp_verify_setup(organization_id=organization_id))
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")
    return {"valid": is_valid}


def get_cloud_config(
    cloud: str, organization_id: str, db: Session
) -> Dict[str, Any]:
    # Base config via cloud utils
    if cloud == "azure":
        config = az_get_config_for_display(organization_id, db)
    elif cloud == "runpod":
        config = rp_get_config_for_display(organization_id, db)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

    # Enrich with allowed_team_ids from NodePoolAccess
    try:
        configs = config.get("configs", {})
        for key in list(configs.keys()):
            access = (
                db.query(NodePoolAccess)
                .filter(
                    NodePoolAccess.organization_id == organization_id,
                    NodePoolAccess.provider == cloud,
                    NodePoolAccess.pool_key == key,
                )
                .first()
            )
            if access and access.allowed_team_ids is not None:
                configs[key]["allowed_team_ids"] = access.allowed_team_ids
            else:
                configs[key]["allowed_team_ids"] = []
    except Exception:
        # Non-fatal enrichment
        pass
    return config


def get_cloud_credentials(
    organization_id: str,
    db: Session,
    config_key: Optional[str] = None,
) -> Dict[str, Any]:
    # Only Azure supports credentials endpoint currently
    config_data = load_azure_config(organization_id, db)
    if config_key:
        if config_key in config_data.get("configs", {}):
            cfg = config_data["configs"][config_key]
            # Enrich with allowed_team_ids from DB
            try:
                access = (
                    db.query(NodePoolAccess)
                    .filter(
                        NodePoolAccess.organization_id == organization_id,
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
        raise HTTPException(status_code=404, detail=f"Azure config '{config_key}' not found")
    config = az_get_current_config(organization_id, db)
    if not config:
        raise HTTPException(status_code=404, detail="No Azure configuration found")
    return config


def save_cloud_config(
    cloud: str,
    organization_id: str,
    user_id: str,
    *,
    # Azure
    name: Optional[str] = None,
    subscription_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    allowed_instance_types: Optional[List[str]] = None,
    allowed_regions: Optional[List[str]] = None,
    # RunPod
    api_key: Optional[str] = None,
    allowed_gpu_types: Optional[List[str]] = None,
    allowed_display_options: Optional[List[str]] = None,
    # Common
    max_instances: int = 0,
    config_key: Optional[str] = None,
    allowed_team_ids: Optional[List[str]] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    if cloud == "azure":
        if not all([
            name,
            subscription_id,
            tenant_id,
            client_id,
            client_secret,
            allowed_instance_types is not None,
            allowed_regions is not None,
        ]):
            raise HTTPException(status_code=400, detail="Invalid config request for Azure")
        result = az_save_config_with_setup(
            name,
            subscription_id,
            tenant_id,
            client_id,
            client_secret,
            allowed_instance_types or [],
            allowed_regions or [],
            max_instances,
            config_key,
            allowed_team_ids,
            organization_id=organization_id,
            user_id=user_id,
        )
        # Persist team access in DB keyed by config key
        _persist_team_access(
            db=db,
            organization_id=organization_id,
            provider="azure",
            name=name or "",
            config_key=config_key,
            allowed_team_ids=allowed_team_ids or [],
        )
        return result
    elif cloud == "runpod":
        if not all([name, allowed_gpu_types is not None]):
            raise HTTPException(status_code=400, detail="Invalid config request for RunPod")
        result = rp_save_config_with_setup(
            name,
            api_key,
            allowed_gpu_types or [],
            max_instances,
            config_key,
            allowed_display_options,
            allowed_team_ids,
            organization_id=organization_id,
            user_id=user_id,
        )
        _persist_team_access(
            db=db,
            organization_id=organization_id,
            provider="runpod",
            name=name or "",
            config_key=config_key,
            allowed_team_ids=allowed_team_ids or [],
        )
        return result
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")


def set_cloud_default_config(
    cloud: str, organization_id: str, config_key: str, db: Session
) -> Dict[str, Any]:
    if cloud == "azure":
        return az_set_default_config(config_key, organization_id, db)  # type: ignore[name-defined]
    elif cloud == "runpod":
        return rp_set_default_config(config_key, organization_id, db)  # type: ignore[name-defined]
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")


def delete_cloud_config(cloud: str, organization_id: str, config_key: str, db: Session) -> Dict[str, Any]:
    if cloud == "azure":
        az_delete_config(config_key, organization_id, db)
    elif cloud == "runpod":
        rp_delete_config(config_key, organization_id, db)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")
    return {"message": f"{cloud.title()} config '{config_key}' deleted successfully"}


def test_cloud_connection(
    cloud: str,
    *,
    # Azure
    subscription_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    auth_mode: Optional[str] = None,
    # RunPod
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    if cloud == "azure":
        if not subscription_id:
            raise HTTPException(status_code=400, detail="Invalid test request for Azure")
        is_valid = az_test_connection(
            subscription_id,
            tenant_id or "",
            client_id or "",
            client_secret or "",
            auth_mode or "service_principal",
        )
    elif cloud == "runpod":
        if not api_key:
            raise HTTPException(status_code=400, detail="Invalid test request for RunPod")
        is_valid = rp_test_connection(api_key)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"{cloud.title()} connection test failed")
    return {"message": f"{cloud.title()} connection test successful"}


def get_cloud_instances(
    cloud: str, organization_id: str, user_id: str, db: Session
) -> Dict[str, Any]:
    if cloud == "azure":
        config = az_get_current_config(organization_id, db)
    elif cloud == "runpod":
        config = rp_get_current_config(organization_id, db)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")

    sky_pilot_status = get_skypilot_status()

    user_cloud_clusters = []
    for cluster in sky_pilot_status:
        cluster_name = cluster.get("name", "")
        platform_info = get_cluster_platform_data(cluster_name)
        if (
            platform_info
            and platform_info.get("platform") == cloud
            and platform_info.get("user_id") == user_id
            and platform_info.get("organization_id") == organization_id
        ):
            user_cloud_clusters.append(cluster)

    current_count = len(user_cloud_clusters)
    max_instances = config.get("max_instances", 0) if config else 0

    # Team access enforcement: check default config access
    access_allowed = True
    try:
        if cloud == "azure":
            cfg_data = load_azure_config(organization_id, db)
        else:
            cfg_data = load_runpod_config(organization_id, db)
        default_key = cfg_data.get("default_config")
        if default_key:
            access_row = (
                db.query(NodePoolAccess)
                .filter(
                    NodePoolAccess.organization_id == organization_id,
                    NodePoolAccess.provider == cloud,
                    NodePoolAccess.pool_key == default_key,
                )
                .first()
            )
            allowed_team_ids = (
                access_row.allowed_team_ids if access_row and access_row.allowed_team_ids else []
            )
            if allowed_team_ids:
                user_team_id = get_user_team_id(db, organization_id, user_id) if db else None
                access_allowed = user_team_id is not None and user_team_id in allowed_team_ids
    except Exception:
        pass

    return {
        "current_count": current_count,
        "max_instances": max_instances,
        "can_launch": (max_instances == 0 or current_count < max_instances) and access_allowed,
    }


def get_cloud_info(cloud: str) -> Dict[str, Any]:
    if cloud == "azure":
        return {
            "instance_types": az_get_instance_types(),
            "regions": az_get_regions(),
        }
    elif cloud == "runpod":
        return {
            "display_options": rp_get_display_options(),
            "display_options_with_pricing": rp_get_display_options_with_pricing(),
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported cloud: {cloud}")


def get_cloud_price(
    cloud: str,
    *,
    instance_type: Optional[str] = None,
    region: Optional[str] = None,
    display_option: Optional[str] = None,
) -> Dict[str, Any]:
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


def _persist_team_access(
    *,
    db: Optional[Session],
    organization_id: str,
    provider: str,
    name: str,
    config_key: Optional[str],
    allowed_team_ids: List[str],
) -> None:
    if db is None:
        return
    try:
        final_key = name.lower().replace(" ", "_").replace("-", "_")
        # If the config was renamed, remove old access row
        if config_key and config_key != final_key:
            try:
                old = (
                    db.query(NodePoolAccess)
                    .filter(
                        NodePoolAccess.organization_id == organization_id,
                        NodePoolAccess.provider == provider,
                        NodePoolAccess.pool_key == config_key,
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
                NodePoolAccess.organization_id == organization_id,
                NodePoolAccess.provider == provider,
                NodePoolAccess.pool_key == final_key,
            )
            .first()
        )
        if not access:
            access = NodePoolAccess(
                organization_id=organization_id,
                provider=provider,
                pool_key=final_key,
                allowed_team_ids=allowed_team_ids or [],
            )
            db.add(access)
        else:
            access.allowed_team_ids = allowed_team_ids or []
        db.commit()
    except Exception:
        # Non-fatal persistence best-effort
        pass

