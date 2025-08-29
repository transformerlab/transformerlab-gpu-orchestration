from fastapi import HTTPException, Request, Response, Depends, status
from config import AUTH_COOKIE_PASSWORD, COOKIE_SECURE, COOKIE_SAMESITE, CSRF_ENABLED
import secrets
from .provider.work_os import provider as auth_provider
import logging
from typing import Optional


def get_auth_info(request: Request, response: Response = None):
    """Get auth info from session, refresh session if needed"""
    try:
        session_cookie = request.cookies.get("wos_session")
        if not session_cookie:
            return None
        session = auth_provider.load_sealed_session(
            sealed_session=session_cookie,
            cookie_password=AUTH_COOKIE_PASSWORD,
        )
        auth_response = session.authenticate()
        if not auth_response.authenticated:
            logging.info("Auth failed, refreshing session...")
            refreshed_session = session.refresh()
            if refreshed_session.authenticated and response is not None:
                response.set_cookie(
                    key="wos_session",
                    value=refreshed_session.sealed_session,
                    httponly=True,
                    secure=COOKIE_SECURE,
                    samesite=COOKIE_SAMESITE,
                    max_age=86400 * 7,
                    path="/",
                )
                # Ensure CSRF cookie exists if enabled
                if CSRF_ENABLED:
                    try:
                        if not request.cookies.get("wos_csrf"):
                            response.set_cookie(
                                key="wos_csrf",
                                value=secrets.token_urlsafe(32),
                                httponly=False,
                                secure=COOKIE_SECURE,
                                samesite=COOKIE_SAMESITE,
                                max_age=86400 * 7,
                                path="/",
                            )
                    except Exception:
                        pass
                logging.info("Session refreshed successfully")
                return refreshed_session
        if auth_response.authenticated:
            return auth_response
        return None
    except Exception as e:
        print(f"Error getting auth info: {e}")
        return None


def auth_from_cookie(wos_cookie: str):
    """Get auth info from cookies string"""
    session_cookie = wos_cookie
    if not session_cookie:
        return False

    session = auth_provider.load_sealed_session(
        sealed_session=session_cookie,
        cookie_password=AUTH_COOKIE_PASSWORD,
    )

    auth_response = session.authenticate()

    if auth_response.authenticated:
        logging.info("Session authenticated successfully")
        return True

    logging.info("Session auth failed")
    return False


def get_user_from_sealed_session(wos_cookie: str):
    """
    Load a sealed session and return a minimal user dict if authenticated, else None.
    Safe for WebSocket usage where Request/Response are unavailable.
    """
    try:
        if not wos_cookie:
            return None
        session = auth_provider.load_sealed_session(
            sealed_session=wos_cookie,
            cookie_password=AUTH_COOKIE_PASSWORD,
        )
        auth_response = session.authenticate()
        if getattr(auth_response, "authenticated", False) and getattr(auth_response, "user", None):
            u = auth_response.user
            return {
                "id": getattr(u, "id", None),
                "email": getattr(u, "email", None),
                "first_name": getattr(u, "first_name", None),
                "last_name": getattr(u, "last_name", None),
                "role": getattr(auth_response, "role", None),
                "organization_id": getattr(auth_response, "organization_id", None),
            }
        return None
    except Exception as _:
        return None


def verify_auth(request: Request, response: Response = None):
    """Dependency to verify user is authenticated, refresh session if needed"""
    auth_info = get_auth_info(request, response)
    if not auth_info or not auth_info.authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return auth_info


def get_current_user(request: Request, response: Response = None):
    """FastAPI dependency for getting the current authenticated user"""
    auth_info = verify_auth(request, response)
    user = auth_info.user
    return {
        "id": user.id,
        "email": user.email,
        "profile_picture_url": user.profile_picture_url,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": auth_info.role,
        "organization_id": auth_info.organization_id,
    }


class RoleChecker:
    def __init__(self, required_role: str):
        self.required_role = required_role

    def __call__(
        self,
        request: Request,
        response: Response,
        auth_info=Depends(verify_auth),
    ):
        """Check role, revalidating with WorkOS if stale.

        This ensures demotions/promotions take effect without logout by
        fetching the latest membership role when the cached role doesn't satisfy
        the requirement. On successful revalidation, it also attempts to refresh
        the session cookie to embed the latest claims.
        """
        current_role = _role_slug(getattr(auth_info, "role", None))
        if current_role == self.required_role:
            return auth_info.user

        # Revalidate against WorkOS memberships and try to refresh cookie
        try:
            user_id = getattr(auth_info.user, "id", None)
            org_id = getattr(auth_info, "organization_id", None)
            if user_id and org_id:
                fresh_role = _revalidate_and_refresh_session(
                    request=request,
                    response=response,
                    user_id=user_id,
                    organization_id=org_id,
                )
                if fresh_role == self.required_role:
                    return auth_info.user
        except Exception as e:
            logging.warning(f"RoleChecker revalidation failed: {e}")

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

requires_admin = RoleChecker(required_role="admin")
requires_member = RoleChecker(required_role="member")


# Helpers to normalize role representations from providers
def _role_slug(role_val):
    """Return a normalized role slug string from various role representations."""
    if role_val is None:
        return None
    if isinstance(role_val, str):
        return role_val
    if isinstance(role_val, dict):
        # common keys: slug, name
        return role_val.get("slug") or role_val.get("name")
    # fallback to string conversion
    try:
        return str(role_val)
    except Exception:
        return None


def check_organization_member(
    organization_id: str,
    request: Request,
    response: Response = None,
):
    """FastAPI dependency to ensure the user is a member of the organization.

    Accepts admins as members as well. Verifies the authenticated session's
    organization matches the path parameter.
    """
    auth_info = verify_auth(request, response)

    # Validate organization match
    user_org = getattr(auth_info, "organization_id", None)
    if not user_org or user_org != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch")

    role = _role_slug(getattr(auth_info, "role", None))
    if role not in ("member", "admin"):
        # Revalidate role via WorkOS memberships and refresh cookie if possible
        try:
            user_id = getattr(auth_info.user, "id", None)
            fresh_role = _revalidate_and_refresh_session(
                request=request,
                response=response,
                user_id=user_id,
                organization_id=organization_id,
            )
            if fresh_role in ("member", "admin"):
                return {"ok": True, "role": fresh_role, "organization_id": user_org}
        except Exception as e:
            logging.warning(f"Member revalidation failed: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    return {"ok": True, "role": role, "organization_id": user_org}


def check_organization_admin(
    organization_id: str,
    request: Request,
    response: Response = None,
):
    """FastAPI dependency to ensure the user is an admin in the organization."""
    auth_info = verify_auth(request, response)

    # Validate organization match
    user_org = getattr(auth_info, "organization_id", None)
    if not user_org or user_org != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization mismatch")

    role = _role_slug(getattr(auth_info, "role", None))
    if role != "admin":
        # Revalidate role via WorkOS memberships and refresh cookie if possible
        try:
            user_id = getattr(auth_info.user, "id", None)
            fresh_role = _revalidate_and_refresh_session(
                request=request,
                response=response,
                user_id=user_id,
                organization_id=organization_id,
            )
            if fresh_role == "admin":
                return {"ok": True, "role": fresh_role, "organization_id": user_org}
        except Exception as e:
            logging.warning(f"Admin revalidation failed: {e}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    return {"ok": True, "role": role, "organization_id": user_org}


def _revalidate_and_refresh_session(
    request: Request,
    response: Optional[Response],
    user_id: Optional[str],
    organization_id: Optional[str],
) -> Optional[str]:
    """
    Revalidates user role against WorkOS and refreshes session cookie on success.
    Returns the fresh role slug if revalidation is successful, otherwise None.
    """
    try:
        if not user_id or not organization_id:
            return None

        memberships = auth_provider.list_organization_memberships(
            user_id=user_id, organization_id=organization_id
        )
        fresh_role: Optional[str] = None
        for m in memberships:
            if getattr(m, "organization_id", None) == organization_id:
                fresh_role = _role_slug(getattr(m, "role", None))
                break

        if fresh_role:
            # Best-effort: refresh cookie to embed latest claims
            try:
                session_cookie = request.cookies.get("wos_session")
                if session_cookie and response is not None:
                    session = auth_provider.load_sealed_session(
                        sealed_session=session_cookie,
                        cookie_password=AUTH_COOKIE_PASSWORD,
                    )
                    refreshed_session = session.refresh()
                    if getattr(refreshed_session, "authenticated", False):
                        response.set_cookie(
                            key="wos_session",
                            value=refreshed_session.sealed_session,
                            httponly=True,
                            secure=COOKIE_SECURE,
                            samesite=COOKIE_SAMESITE,
                            max_age=86400 * 7,
                            path="/",
                        )
                        if CSRF_ENABLED:
                            try:
                                if not request.cookies.get("wos_csrf"):
                                    response.set_cookie(
                                        key="wos_csrf",
                                        value=secrets.token_urlsafe(32),
                                        httponly=False,
                                        secure=COOKIE_SECURE,
                                        samesite=COOKIE_SAMESITE,
                                        max_age=86400 * 7,
                                        path="/",
                                    )
                            except Exception:
                                pass

            except Exception as e:
                logging.warning(f"Session cookie refresh failed: {e}")
        return fresh_role
    except Exception as e:
        logging.warning(f"Failed to revalidate user role: {e}")
        return None
