from fastapi import APIRouter, Request, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from models import UserResponse
from lattice.services.auth import auth_service
from .api_key_auth import get_user_or_api_key

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login-url")
async def get_login_url(request: Request):
    """
    Generates and returns the authentication provider's login URL.
    """
    try:
        login_url = auth_service.generate_login_url(request)
        return {"login_url": login_url}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate login URL: {str(e)}"
        )


@router.get("/callback")
async def auth_callback(request: Request, code: str):
    """
    Handles the authentication callback from the provider after a user logs in.
    It creates a session and redirects the user to the dashboard.
    """
    try:
        return await auth_service.handle_auth_callback(request, code)
    except Exception:
        error_url = auth_service.get_frontend_error_url(request)
        return RedirectResponse(url=error_url)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user=Depends(get_user_or_api_key)):
    """
    Returns information about the currently authenticated user.
    """
    return auth_service.get_user_info(user)


@router.get("/logout")
async def logout(request: Request):
    """
    Logs out the current user by invalidating their session and redirecting.
    """
    return await auth_service.logout_user(request)


@router.get("/allowed-scopes")
async def get_allowed_scopes():
    """Return the list of allowed API key scopes from the server.

    This serves as the single source of truth for the UI and clients.
    """
    try:
        from lattice.services.api_keys.service import ALLOWED_SCOPES

        return {"scopes": sorted(list(ALLOWED_SCOPES))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load scopes: {str(e)}")


@router.get("/check")
async def check_auth(request: Request, response: Response, user=Depends(get_user_or_api_key)):
    """
    Checks if a user is currently authenticated and returns their information.
    It also attempts to refresh the session cookie.
    """
    return await auth_service.check_user_auth(request, response, user)


@router.post("/refresh")
async def refresh_session(request: Request, response: Response):
    """
    Forces a refresh of the user's session to get updated information
    and returns the new user data.
    """
    try:
        session_data = await auth_service.refresh_user_session(request, response)
        return session_data
    except HTTPException as he:
        # Re-raise HTTP exceptions to let FastAPI handle them
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to refresh session: {str(e)}"
        )
