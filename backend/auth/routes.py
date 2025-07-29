from fastapi import APIRouter, Request, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from models import UserResponse
from auth.utils import get_current_user
from config import WORKOS_COOKIE_PASSWORD
import os
from . import workos_client

router = APIRouter(prefix="/auth")


@router.get("/login-url")
async def get_login_url(request: Request):
    try:
        base_url = f"{request.url.scheme}://{request.url.netloc}"
        authorization_url = workos_client.user_management.get_authorization_url(
            provider="authkit",
            redirect_uri=os.getenv(
                "WORKOS_REDIRECT_URI", f"{base_url}/api/v1/auth/callback"
            ),
        )
        return {"login_url": authorization_url}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate login URL: {str(e)}"
        )


@router.get("/callback")
async def auth_callback(request: Request, code: str):
    try:
        auth_response = workos_client.user_management.authenticate_with_code(
            code=code,
            session={"seal_session": True, "cookie_password": WORKOS_COOKIE_PASSWORD},
        )
        frontend_url = os.getenv("FRONTEND_URL")
        if not frontend_url:
            referer = request.headers.get("referer", "")
            if ":3000" in referer:
                frontend_url = "http://localhost:3000"
            else:
                frontend_url = ""
        dashboard_url = f"{frontend_url}/dashboard" if frontend_url else "/dashboard"
        response = RedirectResponse(url=dashboard_url)
        response.set_cookie(
            "wos_session",
            auth_response.sealed_session,
            secure=False,
            httponly=True,
            samesite="lax",
            max_age=86400 * 7,
            path="/",
        )
        return response
    except Exception as e:
        frontend_url = os.getenv("FRONTEND_URL")
        if not frontend_url:
            referer = request.headers.get("referer", "")
            if ":3000" in referer:
                frontend_url = "http://localhost:3000"
            else:
                frontend_url = ""
        error_url = (
            f"{frontend_url}/login?error=auth_failed"
            if frontend_url
            else "/login?error=auth_failed"
        )
        return RedirectResponse(url=error_url)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    request: Request, response: Response, user=Depends(get_current_user)
):
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@router.get("/logout")
async def logout(request: Request):
    try:
        session_cookie = request.cookies.get("wos_session")
        if session_cookie:
            session = workos_client.user_management.load_sealed_session(
                sealed_session=session_cookie,
                cookie_password=WORKOS_COOKIE_PASSWORD,
            )
            logout_url = session.get_logout_url()
            response = RedirectResponse(url=logout_url)
            response.delete_cookie("wos_session")
            return response
        else:
            frontend_url = os.getenv("FRONTEND_URL")
            if not frontend_url:
                referer = request.headers.get("referer", "")
                if ":3000" in referer:
                    frontend_url = "http://localhost:3000"
                else:
                    frontend_url = ""
            login_url = f"{frontend_url}/login" if frontend_url else "/login"
            return RedirectResponse(url=login_url)
    except Exception as e:
        frontend_url = os.getenv("FRONTEND_URL")
        if not frontend_url:
            referer = request.headers.get("referer", "")
            if ":3000" in referer:
                frontend_url = "http://localhost:3000"
            else:
                frontend_url = ""
        login_url = f"{frontend_url}/login" if frontend_url else "/login"
        response = RedirectResponse(url=login_url)
        response.delete_cookie("wos_session")
        return response


@router.get("/check")
async def check_auth(
    request: Request, response: Response, user=Depends(get_current_user)
):
    if user:
        return {
            "authenticated": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "profile_picture_url": user.profile_picture_url,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
        }
    return {"authenticated": False}
