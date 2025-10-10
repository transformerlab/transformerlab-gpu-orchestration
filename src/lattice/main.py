from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from config import (
    AUTH_REDIRECT_URI,
    CORS_ALLOW_ORIGINS,
    CORS_ALLOW_HEADERS,
    CORS_EXPOSE_HEADERS,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
)

# Import and include routers
from routes.auth.routes import router as auth_router
from routes.auth.cli import router as auth_cli_router
from routes.admin.routes import router as admin_router
from routes.admin.teams_routes import router as teams_admin_router
from routes.admin.launch_hooks_routes import router as launch_hooks_router
from routes.clouds.routes import router as clouds_router
from routes.jobs.routes import router as jobs_router
from routes.instances.routes import router as instances_router
from routes.reports.routes import router as reports_router
from routes.api_keys.routes import router as api_keys_router
from routes.node_pools.routes import router as node_pools_router
from routes.terminal.routes import router as terminal_router
from routes.quota.routes import router as quota_router
from routes.storage_buckets.routes import router as storage_buckets_router
from routes.ssh_config.routes import router as ssh_config_router
from routes.container_registries.routes import router as container_registries_router
from routes.admin.machine_size_templates_routes import router as mst_router
from routes.storage_buckets.browse import router as storage_buckets_browse_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup checks for cookie security vs SameSite policy
    # Enforce secure setting when SameSite=None
    if (COOKIE_SAMESITE or "lax").lower() == "none" and not COOKIE_SECURE:
        raise RuntimeError(
            "COOKIE_SAMESITE=None requires COOKIE_SECURE=True for modern browsers."
        )
    yield


# Create main app
app = FastAPI(title="Lattice", version="1.0.0", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=CORS_ALLOW_HEADERS,
    expose_headers=CORS_EXPOSE_HEADERS,
)


api_v1_prefix = "/api/v1"
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(auth_cli_router, prefix=api_v1_prefix)
app.include_router(admin_router, prefix=api_v1_prefix)
app.include_router(teams_admin_router, prefix=api_v1_prefix)
app.include_router(launch_hooks_router, prefix=api_v1_prefix)
app.include_router(mst_router, prefix=api_v1_prefix)
app.include_router(clouds_router, prefix=api_v1_prefix)
app.include_router(jobs_router, prefix=api_v1_prefix)
app.include_router(instances_router, prefix=api_v1_prefix)
app.include_router(reports_router, prefix=api_v1_prefix)
app.include_router(api_keys_router, prefix=api_v1_prefix)
app.include_router(node_pools_router, prefix=api_v1_prefix)
app.include_router(terminal_router, prefix=api_v1_prefix)
app.include_router(quota_router, prefix=api_v1_prefix)
app.include_router(storage_buckets_router, prefix=api_v1_prefix)
app.include_router(ssh_config_router, prefix=api_v1_prefix)
app.include_router(container_registries_router, prefix=api_v1_prefix)
app.include_router(storage_buckets_browse_router, prefix=api_v1_prefix)

# Mount static files for production (when frontend build exists)
frontend_build_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "build"
)
if os.path.exists(frontend_build_path):
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(frontend_build_path, "assets")),
        name="assets",
    )
    from fastapi.responses import FileResponse
    from fastapi import HTTPException

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_frontend(path: str):
        if path.startswith(("api", "docs", "openapi.json", "redoc")):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        index_file = os.path.join(frontend_build_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")


print(f"🔗 Backend using AUTH_REDIRECT_URI: {AUTH_REDIRECT_URI}")

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
