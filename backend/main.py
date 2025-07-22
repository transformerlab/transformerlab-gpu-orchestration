from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import workos
import os
import yaml
from pathlib import Path
from typing import Optional, List
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


class SSHNode(BaseModel):
    ip: str
    user: str
    identity_file: Optional[str] = None
    password: Optional[str] = None


class ClusterRequest(BaseModel):
    cluster_name: str
    user: Optional[str] = None
    identity_file: Optional[str] = None
    password: Optional[str] = None


class AddNodeRequest(BaseModel):
    cluster_name: str
    node: SSHNode


class ClusterResponse(BaseModel):
    cluster_name: str
    nodes: List[SSHNode]


class ClustersListResponse(BaseModel):
    clusters: List[str]


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


# SkyPilot SSH node pool management
def get_ssh_node_pools_path():
    """Get the path to the SSH node pools YAML file"""
    sky_dir = Path.home() / ".sky"
    sky_dir.mkdir(exist_ok=True)
    return sky_dir / "ssh_node_pools.yaml"


def load_ssh_node_pools():
    """Load SSH node pools from YAML file"""
    pools_file = get_ssh_node_pools_path()
    if not pools_file.exists():
        return {}

    try:
        with open(pools_file, "r") as f:
            content = f.read()
            # Reset file pointer and parse YAML
            pools = yaml.safe_load(content) or {}
            return pools
    except Exception as e:
        print(f"Error loading SSH node pools: {e}")
        return {}


def save_ssh_node_pools(pools_data):
    """Save SSH node pools to YAML file"""
    pools_file = get_ssh_node_pools_path()
    try:
        with open(pools_file, "w") as f:
            yaml.dump(pools_data, f, default_flow_style=False, indent=2)
    except Exception as e:
        print(f"Error saving SSH node pools: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to save cluster configuration: {str(e)}"
        )


def create_cluster_in_pools(
    cluster_name: str, user: str = None, identity_file: str = None, password: str = None
):
    """Create a new cluster in SSH node pools"""
    pools = load_ssh_node_pools()

    if cluster_name in pools:
        raise HTTPException(
            status_code=400, detail=f"Cluster '{cluster_name}' already exists"
        )

    cluster_config = {"hosts": []}

    # Add default configuration if provided
    if user or identity_file or password:
        defaults = {}
        if user:
            defaults["user"] = user
        if identity_file:
            defaults["identity_file"] = identity_file
        if password:
            defaults["password"] = password
        cluster_config.update(defaults)

    pools[cluster_name] = cluster_config
    save_ssh_node_pools(pools)

    return cluster_config


def add_node_to_cluster(cluster_name: str, node: SSHNode):
    """Add a node to an existing cluster"""
    pools = load_ssh_node_pools()

    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )

    # Convert node to dict for YAML storage
    node_dict = {"ip": node.ip, "user": node.user}
    if node.identity_file:
        node_dict["identity_file"] = node.identity_file
    if node.password:
        node_dict["password"] = node.password

    # Ensure hosts array exists
    if "hosts" not in pools[cluster_name]:
        pools[cluster_name]["hosts"] = []

    # Check if node with same IP already exists
    for existing_node in pools[cluster_name]["hosts"]:
        if existing_node.get("ip") == node.ip:
            raise HTTPException(
                status_code=400,
                detail=f"Node with IP '{node.ip}' already exists in cluster '{cluster_name}'",
            )

    pools[cluster_name]["hosts"].append(node_dict)
    save_ssh_node_pools(pools)

    return pools[cluster_name]


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


# SkyPilot cluster management routes
@app.get("/api/clusters", response_model=ClustersListResponse)
async def list_clusters(user=Depends(verify_auth)):
    """List all available clusters"""
    pools = load_ssh_node_pools()
    return ClustersListResponse(clusters=list(pools.keys()))


@app.post("/api/clusters", response_model=ClusterResponse)
async def create_cluster(cluster_request: ClusterRequest, user=Depends(verify_auth)):
    """Create a new cluster"""
    create_cluster_in_pools(
        cluster_request.cluster_name,
        cluster_request.user,
        cluster_request.identity_file,
        cluster_request.password,
    )

    return ClusterResponse(cluster_name=cluster_request.cluster_name, nodes=[])


@app.get("/api/clusters/{cluster_name}", response_model=ClusterResponse)
async def get_cluster(cluster_name: str, user=Depends(verify_auth)):
    """Get cluster configuration"""
    pools = load_ssh_node_pools()

    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )

    cluster_config = pools[cluster_name]
    nodes = []

    for host in cluster_config.get("hosts", []):
        node = SSHNode(
            ip=host["ip"],
            user=host["user"],
            identity_file=host.get("identity_file"),
            password=host.get("password"),
        )
        nodes.append(node)

    return ClusterResponse(cluster_name=cluster_name, nodes=nodes)


@app.post("/api/clusters/{cluster_name}/nodes")
async def add_node(
    cluster_name: str, add_node_request: AddNodeRequest, user=Depends(verify_auth)
):
    """Add a node to an existing cluster"""
    cluster_config = add_node_to_cluster(cluster_name, add_node_request.node)

    nodes = []
    for host in cluster_config.get("hosts", []):
        node = SSHNode(
            ip=host["ip"],
            user=host["user"],
            identity_file=host.get("identity_file"),
            password=host.get("password"),
        )
        nodes.append(node)

    return ClusterResponse(cluster_name=cluster_name, nodes=nodes)


@app.delete("/api/clusters/{cluster_name}")
async def delete_cluster(cluster_name: str, user=Depends(verify_auth)):
    """Delete a cluster"""
    pools = load_ssh_node_pools()

    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )

    del pools[cluster_name]
    save_ssh_node_pools(pools)

    return {"message": f"Cluster '{cluster_name}' deleted successfully"}


@app.delete("/api/clusters/{cluster_name}/nodes/{node_ip}")
async def remove_node(cluster_name: str, node_ip: str, user=Depends(verify_auth)):
    """Remove a node from a cluster"""
    pools = load_ssh_node_pools()

    if cluster_name not in pools:
        raise HTTPException(
            status_code=404, detail=f"Cluster '{cluster_name}' not found"
        )

    hosts = pools[cluster_name].get("hosts", [])
    original_length = len(hosts)

    # Filter out the node with the specified IP
    pools[cluster_name]["hosts"] = [host for host in hosts if host.get("ip") != node_ip]

    if len(pools[cluster_name]["hosts"]) == original_length:
        raise HTTPException(
            status_code=404,
            detail=f"Node with IP '{node_ip}' not found in cluster '{cluster_name}'",
        )

    save_ssh_node_pools(pools)

    return {
        "message": f"Node with IP '{node_ip}' removed from cluster '{cluster_name}' successfully"
    }


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


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
