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
import sky

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


class LaunchClusterRequest(BaseModel):
    cluster_name: str
    command: str = "echo 'Hello SkyPilot'"
    setup: Optional[str] = None
    cloud: Optional[str] = None
    instance_type: Optional[str] = None
    cpus: Optional[str] = None
    memory: Optional[str] = None
    accelerators: Optional[str] = None
    region: Optional[str] = None
    zone: Optional[str] = None
    use_spot: bool = False
    idle_minutes_to_autostop: Optional[int] = None


class LaunchClusterResponse(BaseModel):
    request_id: str
    cluster_name: str
    message: str


class ClusterStatusResponse(BaseModel):
    cluster_name: str
    status: str
    launched_at: Optional[int] = None
    last_use: Optional[str] = None
    autostop: Optional[int] = None
    to_down: Optional[bool] = None
    resources_str: Optional[str] = None


class StatusResponse(BaseModel):
    clusters: List[ClusterStatusResponse]


class JobRecord(BaseModel):
    job_id: int
    job_name: str
    username: str
    submitted_at: float
    start_at: Optional[float] = None
    end_at: Optional[float] = None
    resources: str
    status: str
    log_path: str


class JobQueueResponse(BaseModel):
    jobs: List[JobRecord]


class JobLogsResponse(BaseModel):
    job_id: int
    logs: str


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


# SkyPilot helper functions
def launch_cluster_with_skypilot(
    cluster_name: str,
    command: str,
    setup: Optional[str] = None,
    cloud: Optional[str] = None,
    instance_type: Optional[str] = None,
    cpus: Optional[str] = None,
    memory: Optional[str] = None,
    accelerators: Optional[str] = None,
    region: Optional[str] = None,
    zone: Optional[str] = None,
    use_spot: bool = False,
    idle_minutes_to_autostop: Optional[int] = None,
):
    """Launch a cluster using SkyPilot"""
    try:
        # Create a task
        task = sky.Task(
            name=f"lattice-task-{cluster_name}",
            run=command,
            setup=setup,
        )

        # Build resources config
        resources_kwargs = {}

        # Handle infrastructure - support both cloud providers and SSH
        if cloud:
            if cloud.lower() == "ssh":
                # For SSH, we use the SSH node pools configured in ~/.sky/ssh_node_pools.yaml
                # The cluster_name should correspond to a pool name in the SSH node pools
                resources_kwargs["infra"] = "ssh"
                # For SSH clusters, we can optionally specify the pool name
                # If cluster_name exists in SSH pools, SkyPilot will use it
            else:
                # For cloud providers (aws, gcp, azure, etc.)
                resources_kwargs["infra"] = cloud

        if instance_type:
            resources_kwargs["instance_type"] = instance_type
        if cpus:
            resources_kwargs["cpus"] = cpus
        if memory:
            resources_kwargs["memory"] = memory
        if accelerators:
            resources_kwargs["accelerators"] = accelerators
        if region:
            resources_kwargs["region"] = region
        if zone:
            resources_kwargs["zone"] = zone
        if use_spot and cloud and cloud.lower() != "ssh":
            # Spot instances are not applicable for SSH clusters
            resources_kwargs["use_spot"] = use_spot

        # Set resources if any are specified
        if resources_kwargs:
            resources = sky.Resources(**resources_kwargs)
            task.set_resources(resources)

        # For SSH clusters, ensure the SSH node pool exists
        if cloud and cloud.lower() == "ssh":
            pools = load_ssh_node_pools()
            if cluster_name not in pools:
                raise HTTPException(
                    status_code=400,
                    detail=f"SSH cluster '{cluster_name}' not found in SSH node pools. "
                    f"Please create the SSH cluster first using the SSH Clusters tab.",
                )

        # Launch the cluster
        request_id = sky.launch(
            task,
            cluster_name=cluster_name,
            idle_minutes_to_autostop=idle_minutes_to_autostop,
        )

        return request_id
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


def get_skypilot_status(cluster_names: Optional[List[str]] = None):
    """Get status of SkyPilot clusters"""
    try:
        request_id = sky.status(
            cluster_names=cluster_names, refresh=sky.StatusRefreshMode.AUTO
        )
        result = sky.get(request_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )


def get_cluster_job_queue(cluster_name: str):
    """Get job queue for a specific cluster"""
    try:
        request_id = sky.queue(cluster_name)
        job_records = sky.get(request_id)
        return job_records
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get job queue: {str(e)}"
        )


def get_job_logs(cluster_name: str, job_id: int, tail_lines: int = 50):
    """Get logs for a specific job"""
    try:
        import io

        # Create a StringIO object to capture the logs
        log_stream = io.StringIO()

        # Get logs using tail_logs (this returns exit code, logs go to stream)
        sky.tail_logs(
            cluster_name=cluster_name,
            job_id=job_id,
            follow=False,  # Don't follow, just get current logs
            tail=tail_lines,
            output_stream=log_stream,
        )

        # Get the captured logs
        logs = log_stream.getvalue()
        log_stream.close()

        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


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


# SkyPilot cluster launching and status routes
@app.get("/api/skypilot/ssh-clusters")
async def list_ssh_clusters(user=Depends(verify_auth)):
    """List available SSH clusters for SkyPilot"""
    try:
        pools = load_ssh_node_pools()
        ssh_clusters = []
        for cluster_name, config in pools.items():
            hosts_count = len(config.get("hosts", []))
            ssh_clusters.append(
                {
                    "name": cluster_name,
                    "hosts_count": hosts_count,
                    "has_defaults": any(
                        key in config for key in ["user", "identity_file", "password"]
                    ),
                }
            )
        return {"ssh_clusters": ssh_clusters}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to list SSH clusters: {str(e)}"
        )


@app.post("/api/skypilot/launch", response_model=LaunchClusterResponse)
async def launch_skypilot_cluster(
    launch_request: LaunchClusterRequest, user=Depends(verify_auth)
):
    """Launch a cluster using SkyPilot"""
    try:
        request_id = launch_cluster_with_skypilot(
            cluster_name=launch_request.cluster_name,
            command=launch_request.command,
            setup=launch_request.setup,
            cloud=launch_request.cloud,
            instance_type=launch_request.instance_type,
            cpus=launch_request.cpus,
            memory=launch_request.memory,
            accelerators=launch_request.accelerators,
            region=launch_request.region,
            zone=launch_request.zone,
            use_spot=launch_request.use_spot,
            idle_minutes_to_autostop=launch_request.idle_minutes_to_autostop,
        )

        return LaunchClusterResponse(
            request_id=request_id,
            cluster_name=launch_request.cluster_name,
            message=f"Cluster '{launch_request.cluster_name}' launch initiated successfully",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to launch cluster: {str(e)}"
        )


@app.get("/api/skypilot/status", response_model=StatusResponse)
async def get_skypilot_cluster_status(
    cluster_names: Optional[str] = None, user=Depends(verify_auth)
):
    """Get status of SkyPilot clusters"""
    try:
        cluster_list = None
        if cluster_names:
            cluster_list = [name.strip() for name in cluster_names.split(",")]

        cluster_records = get_skypilot_status(cluster_list)

        clusters = []
        for record in cluster_records:
            clusters.append(
                ClusterStatusResponse(
                    cluster_name=record["name"],
                    status=str(record["status"]),
                    launched_at=record.get("launched_at"),
                    last_use=record.get("last_use"),
                    autostop=record.get("autostop"),
                    to_down=record.get("to_down"),
                    resources_str=record.get("resources_str"),
                )
            )

        return StatusResponse(clusters=clusters)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster status: {str(e)}"
        )


@app.get("/api/skypilot/request/{request_id}")
async def get_skypilot_request_status(request_id: str, user=Depends(verify_auth)):
    """Get the status and result of a SkyPilot request"""
    try:
        # Check if the request is completed
        result = sky.get(request_id)
        return {"request_id": request_id, "status": "completed", "result": result}
    except Exception as e:
        return {
            "request_id": request_id,
            "status": "failed",
            "error": str(e),
        }


@app.get("/api/skypilot/jobs/{cluster_name}", response_model=JobQueueResponse)
async def get_cluster_jobs(cluster_name: str, user=Depends(verify_auth)):
    """Get job queue for a cluster"""
    try:
        job_records = get_cluster_job_queue(cluster_name)
        print(f"Job records for cluster '{cluster_name}': {job_records}")

        jobs = []
        for record in job_records:
            print("RECORD:", record["job_id"])
            jobs.append(
                JobRecord(
                    job_id=record["job_id"],
                    job_name=record["job_name"],
                    username=record["username"],
                    submitted_at=record["submitted_at"],
                    start_at=record.get("start_at"),
                    end_at=record.get("end_at"),
                    resources=record["resources"],
                    status=str(record["status"]),
                    log_path=record["log_path"],
                )
            )

        return JobQueueResponse(jobs=jobs)
    except Exception as e:
        print(f"Error getting cluster jobs: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get cluster jobs: {str(e)}"
        )


@app.get(
    "/api/skypilot/jobs/{cluster_name}/{job_id}/logs", response_model=JobLogsResponse
)
async def get_cluster_job_logs(
    cluster_name: str, job_id: int, tail_lines: int = 50, user=Depends(verify_auth)
):
    """Get logs for a specific job"""
    try:
        logs = get_job_logs(cluster_name, job_id, tail_lines)
        return JobLogsResponse(job_id=job_id, logs=logs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job logs: {str(e)}")


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
