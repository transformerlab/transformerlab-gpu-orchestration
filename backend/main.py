from fastapi import FastAPI, HTTPException, Depends, Request, APIRouter
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import workos
import os
from typing import Optional
import uvicorn
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize WorkOS Client
workos_client = workos.WorkOSClient(
    api_key=os.getenv("WORKOS_API_KEY"), client_id=os.getenv("WORKOS_CLIENT_ID")
)

# Create main app
app = FastAPI(title="Lattice", version="1.0.0")

# Create API router for v1 endpoints
api_v1_router = APIRouter(prefix="/api/v1")

# CORS middleware - allow same origin since we're serving from same port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow same origin requests
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()


# Pydantic models
class LoginResponse(BaseModel):
    user: dict
    success: bool


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


# WorkOS session helpers
cookie_password = os.getenv(
    "WORKOS_COOKIE_PASSWORD", "y0jN-wF1bIUoSwdKT6yWIHS5qLI4Kfq5TnqIANOxEXM="
)


def get_current_user(request: Request):
    """Get current user from WorkOS session"""
    try:
        session_cookie = request.cookies.get("wos_session")
        if not session_cookie:
            return None

        session = workos_client.user_management.load_sealed_session(
            sealed_session=session_cookie,
            cookie_password=cookie_password,
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


# Routes
@api_v1_router.get("/")
async def api_root():
    return {"message": "Lattice API v1"}


@api_v1_router.get("/auth/login-url")
async def get_login_url(request: Request):
    """Generate WorkOS AuthKit login URL"""
    try:
        # Get the base URL from the request
        base_url = f"{request.url.scheme}://{request.url.netloc}"

        print("BASE URL:", base_url)

        authorization_url = workos_client.user_management.get_authorization_url(
            provider="authkit",
            redirect_uri=os.getenv(
                "WORKOS_REDIRECT_URI", f"{base_url}/api/v1/auth/callback"
            ),
        )
        return {"login_url": authorization_url}
    except Exception as e:
        print(f"Error generating login URL: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate login URL: {str(e)}"
        )


@api_v1_router.get("/auth/callback")
async def auth_callback(request: Request, code: str):
    """Handle OAuth callback from WorkOS"""
    try:
        # Exchange authorization code for user session
        auth_response = workos_client.user_management.authenticate_with_code(
            code=code,
            session={"seal_session": True, "cookie_password": cookie_password},
        )

        # Determine redirect URL based on environment
        frontend_url = os.getenv("FRONTEND_URL")
        if not frontend_url:
            # Auto-detect based on referer or use unified mode
            referer = request.headers.get("referer", "")
            print(f"DEBUG: Referer header: {referer}")

            # If referer contains :3000, we're in development mode with separate frontend
            if ":3000" in referer:
                frontend_url = "http://localhost:3000"
            else:
                # Default to unified mode (relative URLs)
                frontend_url = ""

        # Create response with redirect to frontend dashboard
        dashboard_url = f"{frontend_url}/dashboard" if frontend_url else "/dashboard"
        print(f"DEBUG: Redirecting to: {dashboard_url}")
        response = RedirectResponse(url=dashboard_url)

        # Set secure session cookie
        response.set_cookie(
            "wos_session",
            auth_response.sealed_session,
            secure=False,  # Set to True in production with HTTPS
            httponly=True,
            samesite="lax",
            max_age=86400 * 7,  # 7 days
            path="/",  # Ensure cookie is available for all paths
        )

        return response
    except Exception as e:
        print(f"Authentication failed: {e}")
        # Handle error redirect similarly
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


@api_v1_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(user=Depends(verify_auth)):
    """Get current user info"""
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@api_v1_router.get("/auth/logout")
async def logout(request: Request):
    """Logout user and clear session"""
    try:
        session_cookie = request.cookies.get("wos_session")
        if session_cookie:
            session = workos_client.user_management.load_sealed_session(
                sealed_session=session_cookie,
                cookie_password=cookie_password,
            )
            logout_url = session.get_logout_url()

            response = RedirectResponse(url=logout_url)
            response.delete_cookie("wos_session")
            return response
        else:
            # Handle redirect for development vs unified mode
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
        print(f"Logout error: {e}")
        # Handle error redirect similarly
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


# Health check for session
@api_v1_router.get("/auth/check")
async def check_auth(request: Request):
    """Check if user is authenticated"""
    session_cookie = request.cookies.get("wos_session")
    print(f"DEBUG auth/check: Cookie present: {bool(session_cookie)}")

    user = get_current_user(request)
    if user:
        print(f"DEBUG auth/check: User authenticated: {user.email}")
        return {"authenticated": True, "user": {"id": user.id, "email": user.email}}

    print("DEBUG auth/check: User not authenticated")
    return {"authenticated": False}


# Include the API router
app.include_router(api_v1_router)

# Mount static files for production (when frontend build exists)
frontend_build_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "frontend", "build"
)
if os.path.exists(frontend_build_path):
    # Mount static files
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(frontend_build_path, "assets")),
        name="assets",
    )

    # Serve index.html for all other routes (SPA routing)
    from fastapi.responses import FileResponse

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve React app for all non-API routes"""
        # If path starts with 'api', 'docs', 'openapi.json', let FastAPI handle it
        if path.startswith(("api", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        # For all other paths, serve the React app
        index_file = os.path.join(frontend_build_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")


# Print the redirect URI being used
base_url = os.getenv("BASE_URL", "http://localhost:8000")
redirect_uri = os.getenv("WORKOS_REDIRECT_URI", f"{base_url}/api/v1/auth/callback")
print(f"🔗 Backend using WORKOS_REDIRECT_URI: {redirect_uri}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
