import json
import time

import pytest
from fastapi import HTTPException


def test_create_list_get_update_delete_regenerate_api_keys(db_session):
    from lattice.services.api_keys.service import APIKeyService
    from lattice.db.db_models import APIKey

    user_id = "user_ak_1"
    org_id = "org_ak_1"

    # Create first key with scopes and expiration
    key1_plain, key1_rec = APIKeyService.create_api_key(
        user_id=user_id,
        name="First Key",
        organization_id=org_id,
        expires_in_days=1,
        scopes=["compute:write", "storage:write", "compute:write"],  # dedupe
        db=db_session,
    )
    assert key1_plain.startswith("lk_")
    assert key1_rec.user_id == user_id
    assert key1_rec.organization_id == org_id
    assert key1_rec.expires_at is not None
    # Scopes are stored as JSON list, deduped and lower-cased
    scopes_list = json.loads(key1_rec.scopes)
    assert scopes_list == ["compute:write", "storage:write"]

    # Create second key later so list order can be checked
    time.sleep(0.01)
    key2_plain, key2_rec = APIKeyService.create_api_key(
        user_id=user_id,
        name="Second Key",
        organization_id=org_id,
        db=db_session,
    )

    # List keys should include both keys (order may be DB-dependent)
    keys = APIKeyService.list_api_keys(user_id=user_id, db=db_session)
    ids = {k.id for k in keys}
    assert {key1_rec.id, key2_rec.id}.issubset(ids)

    # Get specific key
    got = APIKeyService.get_api_key(key1_rec.id, user_id, db=db_session)
    assert got.id == key1_rec.id

    # Update key1: change name, deactivate, clear expiry, set scopes
    updated = APIKeyService.update_api_key(
        key_id=key1_rec.id,
        user_id=user_id,
        name="First Key Updated",
        is_active=False,
        expires_in_days=0,  # clears expiry
        scopes=["cli:access"],
        db=db_session,
    )
    assert updated.name == "First Key Updated"
    assert updated.is_active is False
    assert updated.expires_at is None
    assert json.loads(updated.scopes) == ["cli:access"]

    # Regenerate second key
    prev_hash, prev_prefix = key2_rec.key_hash, key2_rec.key_prefix
    new_plain, new_rec = APIKeyService.regenerate_api_key(
        key_id=key2_rec.id, user_id=user_id, db=db_session
    )
    assert new_plain != key2_plain
    assert new_rec.key_hash != prev_hash
    assert new_rec.key_prefix != prev_prefix
    assert new_rec.last_used_at is None

    # Delete first key
    assert APIKeyService.delete_api_key(key1_rec.id, user_id, db=db_session) is True
    assert db_session.query(APIKey).filter(APIKey.id == key1_rec.id).first() is None

    # Not found cases
    with pytest.raises(HTTPException) as ei:
        APIKeyService.get_api_key("does-not-exist", user_id, db=db_session)
    assert ei.value.status_code == 404


def test_api_key_scopes_validation(db_session):
    from lattice.services.api_keys.service import APIKeyService

    # Unknown scope -> 400
    with pytest.raises(HTTPException) as ei:
        APIKeyService.create_api_key(
            user_id="u1",
            name="bad",
            scopes=["not-a-scope"],
            db=db_session,
        )
    assert ei.value.status_code == 400

    # 'admin' cannot be combined with others
    with pytest.raises(HTTPException) as ei:
        APIKeyService.create_api_key(
            user_id="u1",
            name="bad2",
            scopes=["admin", "compute:write"],
            db=db_session,
        )
    assert ei.value.status_code == 400
