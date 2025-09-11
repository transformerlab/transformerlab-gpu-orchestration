from fastapi import Request, Response, HTTPException
from fastapi.responses import RedirectResponse
from models import UserResponse
from config import AUTH_COOKIE_PASSWORD, COOKIE_SECURE, COOKIE_SAMESITE
import secrets
from config import CSRF_ENABLED
import os
from lattice.routes.auth.provider.work_os import provider as auth_provider

def get_frontend_url(request: Request) -> str:
    """
    Determines the frontend URL based on environment variables or request headers.
    """
    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        referer = request.headers.get("referer", "")
        frontend_url = "http://localhost:3000" if ":3000" in referer else ""
    return frontend_url

def get_frontend_error_url(request: Request) -> str:
    """
    Constructs a URL to redirect to the frontend login page with an error query parameter.
    """
    frontend_url = get_frontend_url(request)
    return f"{frontend_url}/login?error=auth_failed" if frontend_url else "/login?error=auth_failed"

def _set_session_cookie(response: Response, sealed_session: str):
    """
    Sets the session cookie in the HTTP response.
    """
    response.set_cookie(
        "wos_session",
        sealed_session,
        secure=COOKIE_SECURE,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=86400 * 7,  # 7 days
        path="/",
    )
    # Set CSRF double-submit cookie if enabled (non-HttpOnly so frontend can read it)
    if CSRF_ENABLED:
        try:
            token = secrets.token_urlsafe(32)
            response.set_cookie(
                "wos_csrf",
                token,
                secure=COOKIE_SECURE,
                httponly=False,
                samesite=COOKIE_SAMESITE,
                max_age=86400 * 7,
                path="/",
            )
        except Exception:
            pass

# --- Service Logic ---

def generate_login_url(request: Request) -> str:
    """
    Generates the provider's authorization URL.
    """
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    redirect_uri = os.getenv("AUTH_REDIRECT_URI") or f"{base_url}/api/v1/auth/callback"
    return auth_provider.get_authorization_url(
        provider="authkit",
        redirect_uri=redirect_uri,
    )

async def handle_auth_callback(request: Request, code: str) -> RedirectResponse:
    """
    Handles the OAuth callback, authenticates the user, creates an organization
    if needed, and sets the session cookie.
    """
    # Authenticate with the authorization code
    auth_response = auth_provider.authenticate_with_code(
        code=code,
        seal_session=True,
        cookie_password=AUTH_COOKIE_PASSWORD,
    )

    refreshed_auth = auth_response
    # Create an organization for the user if they don't have one
    if not getattr(auth_response, "organization_id", None):
        try:
            user = auth_response.user
            name_parts = [part for part in [user.first_name, user.last_name] if part]
            org_name = (
                " ".join(name_parts) + "'s Organization"
                if name_parts
                else (
                    user.email.split("@")[0] + "'s Organization"
                    if getattr(user, "email", None)
                    else "Default Organization"
                )
            )
            organization = auth_provider.create_organization(name=org_name)
            auth_provider.create_organization_membership(
                organization_id=organization.id, user_id=user.id, role_slug="admin"
            )
            # Refresh the authentication to include the new organization
            refreshed_auth = auth_provider.authenticate_with_refresh_token(
                refresh_token=auth_response._session.refresh_token,
                organization_id=organization.id,
                seal_session=True,
                cookie_password=AUTH_COOKIE_PASSWORD,
            )
        except Exception:
            # If org creation or refresh fails, proceed with the original auth
            pass
    
    frontend_url = get_frontend_url(request)
    dashboard_url = f"{frontend_url}/dashboard" if frontend_url else "/dashboard"
    response = RedirectResponse(url=dashboard_url)
    _set_session_cookie(response, refreshed_auth.sealed_session)
    return response

def get_user_info(user: dict) -> UserResponse:
    """
    Formats the user data into a UserResponse model.
    """
    return UserResponse(
        id=user["id"],
        email=user.get("email", ""),
        first_name=user.get("first_name", ""),
        last_name=user.get("last_name", ""),
        organization_id=user.get("organization_id"),
    )

async def logout_user(request: Request) -> RedirectResponse:
    """
    Logs the user out by revoking the session and clearing the cookie.
    """
    session_cookie = request.cookies.get("wos_session")
    frontend_url = get_frontend_url(request)
    login_url = f"{frontend_url}/login" if frontend_url else "/login"

    if session_cookie:
        try:
            session = auth_provider.load_sealed_session(
                sealed_session=session_cookie,
                cookie_password=AUTH_COOKIE_PASSWORD,
            )
            logout_url = session.get_logout_url()
            response = RedirectResponse(url=logout_url)
            response.delete_cookie("wos_session")
            try:
                response.delete_cookie("wos_csrf")
            except Exception:
                pass
            return response
        except Exception:
            # If session is invalid, just clear the cookie and redirect
            pass
    
    response = RedirectResponse(url=login_url)
    response.delete_cookie("wos_session")
    try:
        response.delete_cookie("wos_csrf")
    except Exception:
        pass
    return response

async def check_user_auth(request: Request, response: Response, user: dict) -> dict:
    """
    Checks authentication status and refreshes the session if possible.
    """
    if not user:
        return {"authenticated": False}

    # Best-effort: refresh the sealed session to capture any new role/org claims
    try:
        session_cookie = request.cookies.get("wos_session")
        if session_cookie and user.get("auth_method") == "session":
            session = auth_provider.load_sealed_session(
                sealed_session=session_cookie, cookie_password=AUTH_COOKIE_PASSWORD
            )
            refreshed_session = session.refresh()
            if getattr(refreshed_session, "authenticated", False):
                _set_session_cookie(response, refreshed_session.sealed_session)
                # Prefer the refreshed role/org for the response
                user["role"] = getattr(refreshed_session, "role", user.get("role"))
                user["organization_id"] = getattr(
                    refreshed_session, "organization_id", user.get("organization_id")
                )
    except Exception:
        # If refresh fails, continue with the existing user data
        pass

    return {
        "authenticated": True,
        "user": {
            "id": user["id"],
            "email": user.get("email", ""),
            "profile_picture_url": user.get("profile_picture_url", ""),
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "role": user.get("role"),
            "organization_id": user.get("organization_id"),
        },
    }

async def refresh_user_session(request: Request, response: Response) -> dict:
    """
    Forces a session refresh to get updated user claims.
    """
    session_cookie = request.cookies.get("wos_session")
    if not session_cookie:
        raise HTTPException(status_code=401, detail="No session found")

    session = auth_provider.load_sealed_session(
        sealed_session=session_cookie,
        cookie_password=AUTH_COOKIE_PASSWORD,
    )

    refreshed_session = session.refresh()
    if not refreshed_session.authenticated:
        raise HTTPException(status_code=401, detail="Session refresh failed")

    _set_session_cookie(response, refreshed_session.sealed_session)
    
    user = refreshed_session.user
    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "profile_picture_url": user.profile_picture_url,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": refreshed_session.role,
            "organization_id": refreshed_session.organization_id,
        },
    }

