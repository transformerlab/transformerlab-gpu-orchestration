from fastapi import HTTPException, Request, Response
from config import WORKOS_COOKIE_PASSWORD
from . import workos_client
import logging


def get_current_user(request: Request, response: Response = None):
    """Get current user from WorkOS session, refresh session if needed"""
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
                return refreshed_session.user
        if auth_response.authenticated:
            return auth_response.user
        return None
    except Exception as e:
        print(f"Error getting current user: {e}")
        return None


def verify_auth(request: Request, response: Response = None):
    """Dependency to verify user is authenticated, refresh session if needed"""
    user = get_current_user(request, response)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
