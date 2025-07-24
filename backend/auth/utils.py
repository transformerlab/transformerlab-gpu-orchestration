from fastapi import HTTPException, Request
from config import WORKOS_COOKIE_PASSWORD
from . import workos_client


def get_current_user(request: Request):
    """Get current user from WorkOS session"""
    try:
        session_cookie = request.cookies.get("wos_session")
        if not session_cookie:
            return None
        session = workos_client.user_management.load_sealed_session(
            sealed_session=session_cookie,
            cookie_password=WORKOS_COOKIE_PASSWORD,
        )
        auth_response = session.authenticate()
        if auth_response.authenticated:
            return auth_response.user
        return None
    except Exception as e:
        print(f"Error getting current user: {e}")
        return None


def verify_auth(request: Request):
    """Dependency to verify user is authenticated"""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
