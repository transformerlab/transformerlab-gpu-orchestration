from fastapi import HTTPException, Request, Response
from config import WORKOS_COOKIE_PASSWORD
from . import workos_client


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
        try:
            auth_response = session.authenticate()
        except Exception as e:
            # Try to refresh session if access token expired
            try:
                refreshed_session = session.refresh()
                if response is not None:
                    response.set_cookie(
                        "wos_session",
                        refreshed_session.sealed_session,
                        secure=False,
                        httponly=True,
                        samesite="lax",
                        max_age=86400 * 7,
                        path="/",
                    )
                auth_response = refreshed_session.authenticate()
            except Exception as refresh_e:
                print(f"Error refreshing session: {refresh_e}")
                return None
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
