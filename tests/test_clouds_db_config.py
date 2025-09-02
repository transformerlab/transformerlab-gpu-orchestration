import os
from typing import Dict

import pytest
from fastapi.testclient import TestClient


def _fake_user(org: str = "org_test", uid: str = "user_test") -> Dict[str, str]:
    return {
        "id": uid,
        "email": f"{uid}@example.com",
        "first_name": "Test",
        "last_name": "User",
        "organization_id": org,
        "role": "admin",
        "auth_method": "api_key",
    }


@pytest.fixture()
def db_session():
    # Use the same SessionLocal as the app
    from lattice.config import SessionLocal
    from lattice.db.base import Base
    from lattice.config import engine

    # Ensure schema exists (idempotent)
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def app_client(db_session) -> TestClient:
    # Import after DB is configured
    from lattice.main import app
    from lattice.routes.auth.api_key_auth import get_user_or_api_key, enforce_csrf
    from routes.auth.api_key_auth import (
        get_user_or_api_key as r_get_user_or_api_key,
        enforce_csrf as r_enforce_csrf,
    )
    # Import requires_admin from both import paths to guarantee override matches
    from lattice.routes.auth.utils import requires_admin as la_requires_admin
    from routes.auth.utils import requires_admin as r_requires_admin
    from lattice.config import get_db as app_get_db
    import config as cfg_mod

    # Dependency overrides
    def _override_user(*args, **kwargs):
        return _fake_user()

    def _override_csrf(*args, **kwargs):
        return True

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Override both absolute and relative-imported dependencies
    app.dependency_overrides[get_user_or_api_key] = _override_user
    app.dependency_overrides[r_get_user_or_api_key] = _override_user
    app.dependency_overrides[enforce_csrf] = _override_csrf
    app.dependency_overrides[r_enforce_csrf] = _override_csrf
    def _allow_admin(*args, **kwargs):
        return {"ok": True}

    app.dependency_overrides[la_requires_admin] = _allow_admin  # treat caller as admin
    app.dependency_overrides[r_requires_admin] = _allow_admin
    app.dependency_overrides[app_get_db] = _override_get_db
    # Also override using the top-level 'config.get_db' to match any Depends imports
    app.dependency_overrides[cfg_mod.get_db] = _override_get_db

    return TestClient(app)


def test_azure_save_load_set_default_and_delete(db_session):
    from lattice.routes.clouds.azure.utils import (
        az_save_config,
        load_azure_config,
        az_get_current_config,
        az_set_default_config,
        az_delete_config,
    )

    org = "org_az_1"

    # Create first config (should become default)
    cfg1 = az_save_config(
        name="Azure One",
        subscription_id="sub1",
        tenant_id="ten1",
        client_id="cli1",
        client_secret="sec1",
        allowed_instance_types=["Standard_NC6"],
        allowed_regions=["eastus"],
        max_instances=3,
        organization_id=org,
        user_id="u1",
        db=db_session,
    )
    assert cfg1["default_config"] == "azure_one"
    assert cfg1["is_configured"] is True
    assert "azure_one" in cfg1["configs"]

    # Create second config (not default yet)
    cfg2 = az_save_config(
        name="Azure Two",
        subscription_id="sub2",
        tenant_id="ten2",
        client_id="cli2",
        client_secret="sec2",
        allowed_instance_types=["Standard_NC4as_T4_v3"],
        allowed_regions=["westus2"],
        max_instances=1,
        organization_id=org,
        user_id="u1",
        db=db_session,
    )
    assert "azure_two" in cfg2["configs"]
    # Default remains first until explicitly changed
    assert cfg2["default_config"] == "azure_one"

    # Switch default to second
    res = az_set_default_config("azure_two", organization_id=org, db=db_session)
    assert res["message"].startswith("Azure config 'azure_two' set as default")
    loaded = load_azure_config(organization_id=org, db=db_session)
    assert loaded["default_config"] == "azure_two"

    # Delete default; ensure remaining becomes default
    after_delete = az_delete_config("azure_two", organization_id=org, db=db_session)
    assert after_delete["default_config"] == "azure_one"
    assert set(after_delete["configs"].keys()) == {"azure_one"}

    # Current config returns default
    current = az_get_current_config(organization_id=org, db=db_session)
    assert current["subscription_id"] == "sub1"


def test_azure_masked_update_and_rename(db_session):
    from lattice.routes.clouds.azure.utils import az_save_config

    org = "org_az_2"

    az_save_config(
        name="My Azure",
        subscription_id="subX",
        tenant_id="tenX",
        client_id="cliX",
        client_secret="secX",
        allowed_instance_types=[],
        allowed_regions=[],
        organization_id=org,
        user_id="u1",
        db=db_session,
    )

    # Update with masked fields and rename
    cfg = az_save_config(
        name="My Azure Prod",
        subscription_id="***masked***",
        tenant_id="***masked***",
        client_id="***masked***",
        client_secret="***masked***",
        allowed_instance_types=["A"],
        allowed_regions=["B"],
        config_key="my_azure",
        organization_id=org,
        user_id="u1",
        db=db_session,
    )

    assert cfg["default_config"] in cfg["configs"]
    # Ensure credentials preserved from original values and key renamed
    assert "my_azure_prod" in cfg["configs"]
    new = cfg["configs"]["my_azure_prod"]
    assert new["subscription_id"] == "subX"
    assert new["tenant_id"] == "tenX"
    assert new["client_id"] == "cliX"
    assert new["client_secret"] == "secX"


def test_azure_verify_setup(monkeypatch, db_session):
    from lattice.routes.clouds.azure import utils as az

    org = "org_az_verify"
    # Prepare a valid default config
    az.az_save_config(
        name="AZ",
        subscription_id="sub",
        tenant_id="ten",
        client_id="cli",
        client_secret="sec",
        allowed_instance_types=[],
        allowed_regions=[],
        organization_id=org,
        db=db_session,
    )

    class DummyProc:
        def __init__(self, returncode=0):
            self.returncode = returncode
            self.stdout = "ok"
            self.stderr = ""

    # CLI present -> True because config exists with creds
    monkeypatch.setattr(az.subprocess, "run", lambda *a, **k: DummyProc(0))
    assert az.az_verify_setup(organization_id=org) is True

    # CLI missing -> False
    def _raise(*a, **k):
        raise RuntimeError("az not found")

    monkeypatch.setattr(az.subprocess, "run", _raise)
    assert az.az_verify_setup(organization_id=org) is False


def test_runpod_save_load_set_default_and_delete(db_session, monkeypatch, tmp_path):
    from lattice.routes.clouds.runpod.utils import (
        rp_save_config,
        load_runpod_config,
        rp_set_default_config,
        rp_delete_config,
        RUNPOD_CONFIG_TOML,
    )

    org = "org_rp_1"

    # Create first config (becomes default)
    cfg1 = rp_save_config(
        name="RunPod One",
        api_key="rk_1234567890",
        allowed_gpu_types=["A100"],
        max_instances=2,
        organization_id=org,
        user_id="u1",
        db=db_session,
    )
    assert cfg1["default_config"] == "runpod_one"
    assert cfg1["is_configured"] is True

    # Create second config
    rp_save_config(
        name="RunPod Two",
        api_key="rk_ABCDEFGH",
        allowed_gpu_types=["4090"],
        max_instances=1,
        organization_id=org,
        user_id="u1",
        db=db_session,
    )

    # Switch default to second; this should also write TOML
    res = rp_set_default_config("runpod_two", organization_id=org, db=db_session)
    assert res["message"].startswith("RunPod config 'runpod_two' set as default")
    cfg_loaded = load_runpod_config(organization_id=org, db=db_session)
    assert cfg_loaded["default_config"] == "runpod_two"
    assert os.path.exists(RUNPOD_CONFIG_TOML)
    with open(RUNPOD_CONFIG_TOML, "r") as f:
        s = f.read()
        assert "api_key = \"rk_ABCDEFGH\"" in s

    # Delete default; remaining becomes default
    after = rp_delete_config("runpod_two", organization_id=org, db=db_session)
    assert after["default_config"] == "runpod_one"


def test_runpod_masked_update_and_display_mask(db_session):
    from lattice.routes.clouds.runpod.utils import (
        rp_save_config,
        rp_get_config_for_display,
    )

    org = "org_rp_2"
    rp_save_config(
        name="RP A",
        api_key="abcd1234wxyz",
        allowed_gpu_types=["T4"],
        organization_id=org,
        db=db_session,
    )

    # Update with masked api_key and rename
    rp_save_config(
        name="RP A2",
        api_key="***hidden***",
        allowed_gpu_types=["L4"],
        organization_id=org,
        db=db_session,
        config_key="rp_a",
    )

    display = rp_get_config_for_display(organization_id=org, db=db_session)
    assert "rp_a2" in display["configs"]
    masked = display["configs"]["rp_a2"]["api_key"]
    # Expect masked form like 'abcd...wxyz'
    assert masked.startswith("abcd") and masked.endswith("wxyz") and "..." in masked


def test_cloud_routes_config_and_credentials(app_client, db_session, monkeypatch):
    # Use utils to create configs, then verify route GETs and default flips
    from lattice.routes.clouds.runpod.utils import rp_save_config_with_setup
    from lattice.routes.clouds.azure.utils import az_save_config_with_setup
    from lattice.db.db_models import NodePoolAccess

    org = _fake_user()["organization_id"]

    # Stub sky checks
    import lattice.routes.clouds.runpod.utils as rp
    import lattice.routes.clouds.azure.utils as az
    monkeypatch.setattr(rp, "rp_run_sky_check", lambda organization_id=None: (True, "ok"))
    monkeypatch.setattr(az, "az_run_sky_check", lambda: (True, "ok"))

    # Create RunPod config via utils; set allowed_team_ids via DB
    rp_save_config_with_setup(
        name="My RP",
        api_key="rk_XYZ12345",
        allowed_gpu_types=["A100"],
        max_instances=2,
        config_key=None,
        allowed_display_options=None,
        allowed_team_ids=None,
        organization_id=org,
        user_id="user-1",
    )
    existing = (
        db_session.query(NodePoolAccess)
        .filter(
            NodePoolAccess.organization_id == org,
            NodePoolAccess.provider == "runpod",
            NodePoolAccess.pool_key == "my_rp",
        )
        .first()
    )
    if not existing:
        access = NodePoolAccess(
            organization_id=org,
            provider="runpod",
            pool_key="my_rp",
            allowed_team_ids=["team-1", "team-2"],
        )
        db_session.add(access)
    else:
        existing.allowed_team_ids = ["team-1", "team-2"]
    db_session.commit()

    # GET config via route function to avoid ASGI dependency stack
    import asyncio
    from lattice.routes.clouds.routes import get_cloud_config as route_get_cloud_config
    data = asyncio.get_event_loop().run_until_complete(
        route_get_cloud_config(
            cloud="runpod",
            request=None,
            response=None,
            user=_fake_user(),
            db=db_session,
        )
    )
    assert data["default_config"] == "my_rp"
    assert data["configs"]["my_rp"]["allowed_team_ids"] == ["team-1", "team-2"]

    # Create second RunPod config via utils
    rp_save_config_with_setup(
        name="My RP 2",
        api_key="rk_SECOND",
        allowed_gpu_types=["L4"],
        max_instances=1,
        organization_id=org,
        user_id="user-1",
    )

    # Flip default back to first using route function
    from lattice.routes.clouds.routes import set_cloud_default_config as route_set_default
    _ = asyncio.get_event_loop().run_until_complete(
        route_set_default(
            cloud="runpod",
            config_key="my_rp",
            __={"ok": True},
            user=_fake_user(),
            db=db_session,
        )
    )
    after = asyncio.get_event_loop().run_until_complete(
        route_get_cloud_config(
            cloud="runpod",
            request=None,
            response=None,
            user=_fake_user(),
            db=db_session,
        )
    )
    assert after["default_config"] == "my_rp"

    # Create Azure config via utils
    az_save_config_with_setup(
        name="My Azure",
        subscription_id="s1",
        tenant_id="t1",
        client_id="c1",
        client_secret="k1",
        allowed_instance_types=["Standard_NC6"],
        allowed_regions=["eastus"],
        max_instances=1,
        config_key=None,
        allowed_team_ids=["team-9"],
        organization_id=org,
        user_id="user-1",
    )

    # Credentials endpoint should return full creds for current default (call function)
    from lattice.routes.clouds.routes import get_cloud_credentials as route_get_creds
    creds = asyncio.get_event_loop().run_until_complete(
        route_get_creds(
            cloud="azure",
            config_key=None,
            request=None,
            response=None,
            user=_fake_user(),
            db=db_session,
            __={"ok": True},
        )
    )
    assert creds["subscription_id"] == "s1"
    assert creds["tenant_id"] == "t1"
    assert creds["client_id"] == "c1"
    assert creds["client_secret"] == "k1"


def test_rp_setup_and_verify(monkeypatch, db_session):
    from lattice.routes.clouds.runpod import utils as rp

    org = "org_rp_setup"

    # Seed a config and set default
    rp.rp_save_config(
        name="Seed RP",
        api_key="rk_TEST_SETUP",
        allowed_gpu_types=["A100"],
        organization_id=org,
        db=db_session,
    )
    rp.rp_set_default_config("seed_rp", organization_id=org, db=db_session)

    # Stub sky check to succeed
    monkeypatch.setattr(rp, "rp_run_sky_check", lambda org_id=None: (True, "ok"))

    # rp_setup_config should succeed without raising
    assert rp.rp_setup_config(organization_id=org) is True

    # rp_verify_setup should attempt runpod.get_user; stub it
    class DummyUser:
        def __init__(self):
            self.id = "user-1"

    monkeypatch.setattr(rp.runpod, "get_user", lambda: {"id": "user-1"})
    assert rp.rp_verify_setup(organization_id=org) is True


def test_azure_save_config_with_setup_runs_sky_check(monkeypatch, db_session):
    from lattice.routes.clouds.azure import utils as az

    org = "org_az_setup"

    # Stub sky check
    monkeypatch.setattr(az, "az_run_sky_check", lambda: (True, "ok"))

    result = az.az_save_config_with_setup(
        name="Cfg A",
        subscription_id="sub",
        tenant_id="ten",
        client_id="cli",
        client_secret="sec",
        allowed_instance_types=[],
        allowed_regions=[],
        organization_id=org,
        user_id="user",
    )
    assert result["default_config"] == "cfg_a"
    assert result.get("sky_check_result", {}).get("valid") is True


def test_azure_setup_config(monkeypatch, db_session):
    from lattice.routes.clouds.azure import utils as az

    org = "org_az_setup2"
    # Seed a valid default config
    az.az_save_config(
        name="Seed AZ",
        subscription_id="sub",
        tenant_id="ten",
        client_id="cli",
        client_secret="sec",
        allowed_instance_types=[],
        allowed_regions=[],
        organization_id=org,
        db=db_session,
    )

    class DummyProc:
        def __init__(self, returncode=0):
            self.returncode = returncode
            self.stdout = "ok"
            self.stderr = ""

    # CLI present
    monkeypatch.setattr(az.subprocess, "run", lambda *a, **k: DummyProc(0))
    # Connection test OK
    monkeypatch.setattr(az, "az_test_connection", lambda *a, **k: True)
    assert az.az_setup_config(organization_id=org) is True
