from fastapi import FastAPI, HTTPException, Depends, Request
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

app = FastAPI(title="Lattice API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
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
@app.get("/")
async def root():
    return {"message": "Lattice API"}


@app.get("/auth/login-url")
async def get_login_url():
    """Generate WorkOS AuthKit login URL"""
    try:
        authorization_url = workos_client.user_management.get_authorization_url(
            provider="authkit",
            redirect_uri=os.getenv(
                "WORKOS_REDIRECT_URI", "http://localhost:8000/auth/callback"
            ),
        )
        return {"login_url": authorization_url}
    except Exception as e:
        print(f"Error generating login URL: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate login URL: {str(e)}"
        )


@app.get("/auth/callback")
async def auth_callback(request: Request, code: str):
    """Handle OAuth callback from WorkOS"""
    try:
        # Exchange authorization code for user session
        auth_response = workos_client.user_management.authenticate_with_code(
            code=code,
            session={"seal_session": True, "cookie_password": cookie_password},
        )

        # Create response with redirect to frontend
        response = RedirectResponse(url="http://localhost:3000/dashboard")

        # Set secure session cookie
        response.set_cookie(
            "wos_session",
            auth_response.sealed_session,
            secure=False,  # Set to True in production with HTTPS
            httponly=True,
            samesite="lax",
            max_age=86400 * 7,  # 7 days
        )

        return response
    except Exception as e:
        print(f"Authentication failed: {e}")
        return RedirectResponse(url="http://localhost:3000/login?error=auth_failed")


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(user=Depends(verify_auth)):
    """Get current user info"""
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@app.get("/auth/logout")
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
            return RedirectResponse(url="http://localhost:3000/login")
    except Exception as e:
        print(f"Logout error: {e}")
        response = RedirectResponse(url="http://localhost:3000/login")
        response.delete_cookie("wos_session")
        return response


# Health check for session
@app.get("/auth/check")
async def check_auth(request: Request):
    """Check if user is authenticated"""
    user = get_current_user(request)
    if user:
        return {"authenticated": True, "user": {"id": user.id, "email": user.email}}
    return {"authenticated": False}


# Mount static files for production (when frontend build exists)
frontend_build_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "frontend", "build"
)
if os.path.exists(frontend_build_path):
    # Mount static files
    app.mount(
        "/static",
        StaticFiles(directory=os.path.join(frontend_build_path, "static")),
        name="static",
    )

    # Serve index.html for all other routes (SPA routing)
    from fastapi.responses import FileResponse

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve React app for all non-API routes"""
        # If path starts with 'api' or 'auth', let FastAPI handle it
        if path.startswith(("api", "auth", "docs", "openapi.json")):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        # For all other paths, serve the React app
        index_file = os.path.join(frontend_build_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")


# Print the redirect URI being used
redirect_uri = os.getenv("WORKOS_REDIRECT_URI", "http://localhost:8000/auth/callback")
print(f"🔗 Backend using WORKOS_REDIRECT_URI: {redirect_uri}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
