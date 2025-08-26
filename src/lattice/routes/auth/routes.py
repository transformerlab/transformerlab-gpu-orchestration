from fastapi import APIRouter, Request, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from models import UserResponse
from config import AUTH_COOKIE_PASSWORD
import os
from .provider.work_os import provider as auth_provider
from .api_key_auth import get_user_or_api_key


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login-url")
async def get_login_url(request: Request):
    try:
        base_url = f"{request.url.scheme}://{request.url.netloc}"
        authorization_url = auth_provider.get_authorization_url(
            provider="authkit",
            redirect_uri=(
                os.getenv("AUTH_REDIRECT_URI") or f"{base_url}/api/v1/auth/callback"
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
        auth_response = auth_provider.authenticate_with_code(
            code=code,
            seal_session=True,
            cookie_password=AUTH_COOKIE_PASSWORD,
        )

        # If the user doesn't have an organization, create one
        refreshed_auth = auth_response
        try:
            if not getattr(auth_response, "organization_id", None):
                user = auth_response.user
                name_parts = [
                    part for part in [user.first_name, user.last_name] if part
                ]
                if name_parts:
                    org_name = " ".join(name_parts) + "'s Organization"
                else:
                    org_name = (
                        user.email.split("@")[0] + "'s Organization"
                        if getattr(user, "email", None)
                        else "Default Organization"
                    )

                organization = auth_provider.create_organization(name=org_name)

                try:
                    auth_provider.create_organization_membership(
                        organization_id=organization.id,
                        user_id=user.id,
                        role_slug="admin",
                    )
                except Exception:
                    pass

                try:
                    refreshed_auth = auth_provider.authenticate_with_refresh_token(
                        refresh_token=auth_response._session.refresh_token,  # type: ignore[attr-defined]
                        organization_id=organization.id,
                        seal_session=True,
                        cookie_password=AUTH_COOKIE_PASSWORD,
                    )
                except Exception:
                    pass
        except Exception:
            pass
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
            refreshed_auth.sealed_session,
            secure=False,
            httponly=True,
            samesite="lax",
            max_age=86400 * 7,
            path="/",
        )
        return response
    except Exception:
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
    request: Request, response: Response, user=Depends(get_user_or_api_key)
):
    return UserResponse(
        id=user["id"],
        email=user.get("email", ""),
        first_name=user.get("first_name", ""),
        last_name=user.get("last_name", ""),
        organization_id=user.get("organization_id"),
    )


@router.get("/logout")
async def logout(request: Request, user=Depends(get_user_or_api_key)):
    try:
        session_cookie = request.cookies.get("wos_session")
        if session_cookie:
            session = auth_provider.load_sealed_session(
                sealed_session=session_cookie,
                cookie_password=AUTH_COOKIE_PASSWORD,
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
    except Exception:
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
    request: Request, response: Response, user=Depends(get_user_or_api_key)
):
    if user:
        # Best-effort: refresh the sealed session to capture any new role/org claims
        try:
            session_cookie = request.cookies.get("wos_session")
            if session_cookie:
                session = auth_provider.load_sealed_session(
                    sealed_session=session_cookie, cookie_password=AUTH_COOKIE_PASSWORD
                )
                refreshed_session = session.refresh()
                if getattr(refreshed_session, "authenticated", False):
                    response.set_cookie(
                        key="wos_session",
                        value=refreshed_session.sealed_session,
                        httponly=True,
                        secure=False,
                        samesite="lax",
                        max_age=86400 * 7,
                        path="/",
                    )
                    # If this was a session user, prefer the refreshed role/org
                    if user.get("auth_method") == "session":
                        user["role"] = getattr(
                            refreshed_session, "role", user.get("role")
                        )
                        user["organization_id"] = getattr(
                            refreshed_session,
                            "organization_id",
                            user.get("organization_id"),
                        )
        except Exception:
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
    return {"authenticated": False}


@router.post("/refresh")
async def refresh_session(
    request: Request, response: Response, user=Depends(get_user_or_api_key)
):
    """Force refresh the session to get updated user info"""
    try:
        session_cookie = request.cookies.get("wos_session")
        if not session_cookie:
            raise HTTPException(status_code=401, detail="No session found")

        session = auth_provider.load_sealed_session(
            sealed_session=session_cookie,
            cookie_password=AUTH_COOKIE_PASSWORD,
        )

        refreshed_session = session.refresh()
        if refreshed_session.authenticated:
            response.set_cookie(
                key="wos_session",
                value=refreshed_session.sealed_session,
                httponly=True,
                secure=False,
                samesite="lax",
                max_age=86400 * 7,
                path="/",
            )

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
        else:
            raise HTTPException(status_code=401, detail="Session refresh failed")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to refresh session: {str(e)}"
        )
