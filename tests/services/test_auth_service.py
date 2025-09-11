import asyncio
import types
import pytest
from urllib.parse import urlparse
from starlette.requests import Request
from starlette.responses import Response


class _AuthSession:
    def __init__(self, sealed_session="sealed", role="member", organization_id="org1"):
        self.sealed_session = sealed_session
        self.role = role
        self.organization_id = organization_id
        self.authenticated = True
        # Provide user object for refresh_user_session
        self.user = types.SimpleNamespace(
            id="u1",
            email="u1@example.com",
            profile_picture_url="",
            first_name="U",
            last_name="One",
        )

    def refresh(self):
        return self

    def get_logout_url(self):
        return "http://logout"


class _AuthCodeResult:
    def __init__(self):
        self.sealed_session = "code_sealed"
        self.user = types.SimpleNamespace(id="u1", email="u1@example.com", first_name="U", last_name="One")
        self.organization_id = None
        self._session = types.SimpleNamespace(refresh_token="rtok")


class FakeProvider:
    def __init__(self):
        self.last_redirect_uri = None

    def get_authorization_url(self, provider, redirect_uri):
        self.last_redirect_uri = redirect_uri
        return f"https://fake.auth/authorize?redirect_uri={redirect_uri}"

    def authenticate_with_code(self, code, seal_session, cookie_password):
        return _AuthCodeResult()

    def create_organization(self, name):
        return types.SimpleNamespace(id="orgX", name=name)

    def create_organization_membership(self, organization_id, user_id, role_slug):
        return types.SimpleNamespace(id="m1", organization_id=organization_id, user_id=user_id, role=role_slug)

    def authenticate_with_refresh_token(self, refresh_token, organization_id, seal_session, cookie_password):
        return _AuthSession(sealed_session="refreshed", role="admin", organization_id=organization_id)

    def load_sealed_session(self, sealed_session, cookie_password):
        return _AuthSession(sealed_session=sealed_session)


@pytest.fixture()
def monkeypatched_auth_provider(monkeypatch):
    from lattice.services.auth import auth_service

    fp = FakeProvider()
    monkeypatch.setattr(auth_service, "auth_provider", fp)
    return fp


def _req(headers=None, cookies=None, scheme="http", host="testserver", path="/"):
    headers = headers or {}
    headers.setdefault("host", host)
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    if cookies:
        cookie_header = "; ".join([f"{k}={v}" for k, v in cookies.items()])
        raw_headers.append((b"cookie", cookie_header.encode()))
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": raw_headers,
        "scheme": scheme,
        "server": (host, 80),
        "client": ("testclient", 123),
    }
    return Request(scope)


def test_generate_login_url(monkeypatched_auth_provider, monkeypatch):
    from lattice.services.auth.auth_service import generate_login_url

    req = _req()
    url = generate_login_url(req)
    assert url.startswith("https://fake.auth/authorize?")

    # Allow host/port variability between local (testserver) and CI (localhost:8000, etc.)
    redirect_uri = monkeypatched_auth_provider.last_redirect_uri
    parsed = urlparse(redirect_uri)
    assert redirect_uri.endswith("/api/v1/auth/callback")
    assert parsed.scheme in ("http", "https")
    # Must have some hostname component
    assert parsed.hostname is not None and parsed.hostname != ""

    # With explicit env override (exact match expected)
    monkeypatch.setenv("AUTH_REDIRECT_URI", "https://example.com/cb")
    req2 = _req()
    generate_login_url(req2)
    assert monkeypatched_auth_provider.last_redirect_uri == "https://example.com/cb"


def test_handle_auth_callback_sets_cookie_and_redirect(monkeypatched_auth_provider):
    from lattice.services.auth.auth_service import handle_auth_callback

    # Referer indicates localhost:3000 -> frontend URL
    req = _req(headers={"referer": "http://localhost:3000/foo"})
    resp = asyncio.get_event_loop().run_until_complete(handle_auth_callback(req, code="abc"))
    # Redirects to frontend dashboard
    assert resp.headers["location"].endswith("/dashboard")
    # Should set session cookie to refreshed value
    set_cookies = b"\n".join(v for (k, v) in resp.raw_headers if k == b"set-cookie").decode()
    assert "wos_session=refreshed" in set_cookies


def test_logout_user_paths(monkeypatched_auth_provider):
    from lattice.services.auth.auth_service import logout_user

    # With valid session cookie -> redirect to provider logout and clear cookie
    req = _req(headers={"referer": "http://localhost:3000/x"}, cookies={"wos_session": "sealed"})
    resp = asyncio.get_event_loop().run_until_complete(logout_user(req))
    assert resp.headers["location"].startswith("http://logout")
    set_cookies = b"\n".join(v for (k, v) in resp.raw_headers if k == b"set-cookie").decode()
    assert "wos_session=" in set_cookies  # cleared

    # Without session cookie -> redirect to frontend login
    req2 = _req(headers={"referer": "http://localhost:3000/x"})
    resp2 = asyncio.get_event_loop().run_until_complete(logout_user(req2))
    assert resp2.headers["location"].endswith("/login")


def test_check_user_auth_refresh(monkeypatched_auth_provider):
    from lattice.services.auth.auth_service import check_user_auth

    user = {"id": "u1", "email": "u1@example.com", "auth_method": "session", "role": "member", "organization_id": "org1"}
    req = _req(cookies={"wos_session": "sealed"})
    resp = Response()
    result = asyncio.get_event_loop().run_until_complete(check_user_auth(req, resp, user))
    assert result["authenticated"] is True
    # Our fake session keeps the same role/org; ensure cookie refresh occurred
    assert result["user"]["role"] == "member"
    set_cookies = b"\n".join(v for (k, v) in resp.raw_headers if k == b"set-cookie").decode()
    assert "wos_session=sealed" in set_cookies or "wos_session=refreshed" in set_cookies


def test_refresh_user_session(monkeypatched_auth_provider):
    from lattice.services.auth.auth_service import refresh_user_session
    from fastapi import HTTPException

    # Missing cookie -> 401
    with pytest.raises(HTTPException) as ei:
        asyncio.get_event_loop().run_until_complete(refresh_user_session(_req(), Response()))
    assert ei.value.status_code == 401

    # With cookie -> returns user dict and sets cookie
    req = _req(cookies={"wos_session": "sealed"})
    resp = Response()
    out = asyncio.get_event_loop().run_until_complete(refresh_user_session(req, resp))
    assert out["authenticated"] is True
    set_cookies = b"\n".join(v for (k, v) in resp.raw_headers if k == b"set-cookie").decode()
    assert "wos_session=" in set_cookies
