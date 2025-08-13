import datetime
from fastapi import HTTPException, Request, Response, Depends, status
from config import WORKOS_COOKIE_PASSWORD
from . import workos_client
import logging


def get_auth_info(request: Request, response: Response = None):
    """Get auth info from WorkOS session, refresh session if needed"""
    try:
        session_cookie = request.cookies.get("wos_session")
        if not session_cookie:
            return None
        session = workos_client.user_management.load_sealed_session(
            sealed_session=session_cookie,
            cookie_password=WORKOS_COOKIE_PASSWORD,
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
                    secure=False,
                    samesite="lax",
                    max_age=86400 * 7,
                    path="/",
                )
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

    session = workos_client.user_management.load_sealed_session(
        sealed_session=session_cookie,
        cookie_password=WORKOS_COOKIE_PASSWORD,
    )

    auth_response = session.authenticate()

    if auth_response.authenticated:
        logging.info("Session authenticated successfully")
        return True

    logging.info("Session auth failed")
    return False


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

    def __call__(self, auth_info=Depends(verify_auth)):
        if not hasattr(auth_info, "role") or auth_info.role != self.required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return auth_info.user


requires_admin = RoleChecker(required_role="admin")
requires_member = RoleChecker(required_role="member")
