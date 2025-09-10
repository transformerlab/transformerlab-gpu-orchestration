import pytest
from fastapi import HTTPException


@pytest.fixture()
def db_session():
    from lattice.config import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_create_list_get_update_delete_regenerate(db_session):
    from lattice.routes.api_keys.service import APIKeyService

    user_id = "user_service_1"
    org_id = "org_service_1"

    # Create
    api_key, rec = APIKeyService.create_api_key(
        user_id=user_id,
        name="First Key",
        organization_id=org_id,
        expires_in_days=1,
        scopes=["compute:write", "nodepools:write"],
        db=db_session,
    )
    assert api_key.startswith("lk_")
    assert rec.user_id == user_id
    assert rec.organization_id == org_id
    # key_prefix is first 8 of the actual key
    assert rec.key_prefix == api_key[:8]

    # List
    items = APIKeyService.list_api_keys(user_id=user_id, db=db_session)
    assert any(it.id == rec.id for it in items)

    # Get
    got = APIKeyService.get_api_key(key_id=rec.id, user_id=user_id, db=db_session)
    assert got.id == rec.id

    # Update
    upd = APIKeyService.update_api_key(
        key_id=rec.id,
        user_id=user_id,
        name="Renamed",
        is_active=False,
        expires_in_days=0,  # clears expiration
        scopes=["nodepools:write"],
        db=db_session,
    )
    assert upd.name == "Renamed"
    assert upd.is_active is False
    scopes_after = APIKeyService.parse_scopes(upd)
    assert scopes_after == ["nodepools:write"]

    # Regenerate
    new_key, rec2 = APIKeyService.regenerate_api_key(
        key_id=rec.id, user_id=user_id, db=db_session
    )
    assert new_key != api_key
    assert rec2.key_prefix == new_key[:8]
    # last_used_at reset on regenerate
    assert rec2.last_used_at is None

    # Delete
    ok = APIKeyService.delete_api_key(key_id=rec.id, user_id=user_id, db=db_session)
    assert ok is True
    # Ensure it is gone
    items2 = APIKeyService.list_api_keys(user_id=user_id, db=db_session)
    assert not any(it.id == rec.id for it in items2)


def test_scopes_validation_and_normalization(db_session):
    from lattice.routes.api_keys.service import APIKeyService

    user_id = "user_scopes_1"

    # Dedup + normalization
    key, rec = APIKeyService.create_api_key(
        user_id=user_id,
        name="Scoped",
        scopes=["Compute:Write", "compute:write", "  compute:write  ", "NODEPOOLS:WRITE"],
        db=db_session,
    )
    parsed = APIKeyService.parse_scopes(rec)
    assert set(parsed) == {"compute:write", "nodepools:write"}
    assert len(parsed) == 2

    # Unknown scope currently surfaces as 500 (service wraps validation)
    with pytest.raises(HTTPException) as ei:
        APIKeyService.create_api_key(
            user_id=user_id,
            name="Bad",
            scopes=["bogus"],
            db=db_session,
        )
    assert isinstance(ei.value, HTTPException)

    # 'admin' cannot be combined with others; service surfaces as 500 here
    with pytest.raises(HTTPException):
        APIKeyService.create_api_key(
            user_id=user_id,
            name="AdminMix",
            scopes=["admin", "compute:write"],
            db=db_session,
        )

    # Update flow preserves 400 behavior for invalid scopes
    key2, rec2 = APIKeyService.create_api_key(
        user_id=user_id,
        name="ToUpdate",
        scopes=["compute:write"],
        db=db_session,
    )
    with pytest.raises(HTTPException) as ei2:
        APIKeyService.update_api_key(
            key_id=rec2.id,
            user_id=user_id,
            scopes="admin",  # invalid type -> 400 expected
            db=db_session,
        )
    assert ei2.value.status_code == 400

