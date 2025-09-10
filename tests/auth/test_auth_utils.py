import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response


def _make_request(headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    return Request({"type": "http", "headers": headers or []})


def test_get_user_from_sealed_session_success(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    class FakeAuthResp:
        def __init__(self):
            self.authenticated = True

            class U:
                id = "u1"
                email = "u1@example.com"
                first_name = "U"
                last_name = "One"

            self.user = U()

    class FakeSession:
        def authenticate(self):
            return FakeAuthResp()

    class FakeProvider:
        def load_sealed_session(self, *, sealed_session: str, cookie_password: str):
            assert sealed_session == "token123"
            assert isinstance(cookie_password, str)
            return FakeSession()

    monkeypatch.setattr(auth_utils, "auth_provider", FakeProvider())
    out = auth_utils.get_user_from_sealed_session("token123")
    assert out == {
        "id": "u1",
        "email": "u1@example.com",
        "first_name": "U",
        "last_name": "One",
        "role": None,
        "organization_id": None,
    }


def test_get_user_from_sealed_session_failure_returns_none(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    class FakeProvider:
        def load_sealed_session(self, *, sealed_session: str, cookie_password: str):
            raise RuntimeError("boom")

    monkeypatch.setattr(auth_utils, "auth_provider", FakeProvider())
    assert auth_utils.get_user_from_sealed_session("whatever") is None


def test_rolechecker_allows_when_role_matches(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    rc = auth_utils.RoleChecker(required_role="admin")

    class AuthInfo:
        role = "admin"

        class U:
            id = "u1"

        user = U()

    req = _make_request()
    resp = Response()
    out = rc(req, resp, auth_info=AuthInfo())
    assert out is AuthInfo.user


def test_rolechecker_revalidates_and_allows_on_fresh_role(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    rc = auth_utils.RoleChecker(required_role="admin")

    class AuthInfo:
        role = "member"

        class U:
            id = "u1"

        user = U()
        organization_id = "org1"

    # Force revalidation success
    monkeypatch.setattr(auth_utils, "_revalidate_and_refresh_session", lambda **_: "admin")

    req = _make_request()
    resp = Response()
    out = rc(req, resp, auth_info=AuthInfo())
    assert out is AuthInfo.user


def test_rolechecker_forbidden_on_failed_revalidation(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    rc = auth_utils.RoleChecker(required_role="admin")

    class AuthInfo:
        role = "member"

        class U:
            id = "u1"

        user = U()
        organization_id = "org1"

    monkeypatch.setattr(auth_utils, "_revalidate_and_refresh_session", lambda **_: None)

    req = _make_request()
    resp = Response()
    with pytest.raises(HTTPException) as ei:
        _ = rc(req, resp, auth_info=AuthInfo())
    assert ei.value.status_code == 403


def test_check_organization_member_mismatch_403(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    class AuthInfo:
        organization_id = "org-A"
        role = "member"

    # Bypass actual verification
    monkeypatch.setattr(auth_utils, "verify_auth", lambda request, response=None: AuthInfo())

    req = _make_request()
    with pytest.raises(HTTPException) as ei:
        auth_utils.check_organization_member("org-B", req, Response())
    assert ei.value.status_code == 403


def test_check_organization_member_revalidate_passes(monkeypatch):
    import lattice.routes.auth.utils as auth_utils

    class AuthInfo:
        organization_id = "org-A"
        # Not accepted initially; will revalidate
        role = "viewer"
        user = type("U", (), {"id": "u1"})()

    monkeypatch.setattr(auth_utils, "verify_auth", lambda request, response=None: AuthInfo())
    monkeypatch.setattr(auth_utils, "_revalidate_and_refresh_session", lambda **_: "member")

    req = _make_request()
    out = auth_utils.check_organization_member("org-A", req, Response())
    assert out["ok"] is True and out["role"] == "member"

