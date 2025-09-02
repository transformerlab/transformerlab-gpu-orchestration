import os
from dotenv import load_dotenv
from pathlib import Path
# CORS configuration: comma-separated list of origins
from urllib.parse import urlsplit
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

# Load environment variables from .env file
load_dotenv()

DEFAULT_SQLITE_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "lattice.db"
)
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{DEFAULT_SQLITE_DB_PATH}"

# Determine backend before creating the engine so we only instantiate once
url = make_url(DATABASE_URL)

if url.get_backend_name() == "sqlite":
    from sqlalchemy import event

    def _fk_pragma_on_connect(dbapi_con, con_record):
        dbapi_con.execute("pragma foreign_keys=ON")

    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    event.listen(engine, "connect", _fk_pragma_on_connect)
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


AUTH_API_KEY = os.getenv("AUTH_API_KEY")
AUTH_CLIENT_ID = os.getenv("AUTH_CLIENT_ID")
AUTH_COOKIE_PASSWORD = (
    os.getenv("AUTH_COOKIE_PASSWORD") or "y0jN-wF1bIUoSwdKT6yWIHS5qLI4Kfq5TnqIANOxEXM="
)
# Controls cookie security flags (set True in production behind HTTPS)
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() in ("1", "true", "yes")
# SameSite strategy for cookies: "lax" | "none" | "strict"
_samesite_env = (os.getenv("COOKIE_SAMESITE", "lax") or "lax").strip().lower()
COOKIE_SAMESITE = _samesite_env if _samesite_env in ("lax", "none", "strict") else "lax"

# WebSocket policy: whether to allow null/missing Origin (for native/WebView clients)
WS_ALLOW_NULL_ORIGIN = os.getenv("WS_ALLOW_NULL_ORIGIN", "false").strip().lower() in ("1", "true", "yes")

def _coerce_origin(o: str) -> str | None:
    o = (o or "").strip().rstrip("/")
    if not o:
        return None
    if "://" not in o:
        scheme = "https" if COOKIE_SECURE else "http"
        o = f"{scheme}://{o}"
    u = urlsplit(o)
    if not u.scheme or not u.hostname:
        return None
    host = u.hostname.lower()
    port = f":{u.port}" if u.port and u.port not in (80, 443) else ""
    return f"{u.scheme.lower()}://{host}{port}"

_cors_env = os.getenv("CORS_ALLOW_ORIGINS")
if _cors_env:
    CORS_ALLOW_ORIGINS = [x for x in (_coerce_origin(o) for o in _cors_env.split(",")) if x]
else:
    # Default to FRONTEND_URL if provided, otherwise localhost dev
    _frontend = os.getenv("FRONTEND_URL")
    coerced = _coerce_origin(_frontend) if _frontend else None
    CORS_ALLOW_ORIGINS = [coerced] if coerced else ["http://localhost:3000"]

# CORS headers allowlist (comma-separated). Keep a tight default set; add x-csrf-token for CSRF patterns.
_cors_headers_env = os.getenv("CORS_ALLOW_HEADERS")
if _cors_headers_env:
    CORS_ALLOW_HEADERS = [h.strip().lower() for h in _cors_headers_env.split(",") if h.strip()]
else:
    CORS_ALLOW_HEADERS = [
        "authorization",
        "content-type",
        "x-requested-with",
        "accept",
        "origin",
        "x-csrf-token",
    ]

# CORS expose headers (comma-separated) for non-simple response headers clients may need to read
_cors_expose_env = os.getenv("CORS_EXPOSE_HEADERS")
if _cors_expose_env:
    CORS_EXPOSE_HEADERS = [h.strip() for h in _cors_expose_env.split(",") if h.strip()]
else:
    CORS_EXPOSE_HEADERS = []
AUTH_REDIRECT_URI = os.getenv("AUTH_REDIRECT_URI")

FRONTEND_URL = os.getenv("FRONTEND_URL")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


# Path to store RunPod configuration
RUNPOD_CONFIG_FILE = Path.home() / ".runpod" / "lattice_config.json"
# Path for SkyPilot's expected config.toml file
RUNPOD_CONFIG_TOML = Path.home() / ".runpod" / "config.toml"

AZURE_CONFIG_FILE = Path.home() / ".azure" / "lattice_config.json"

# CSRF enforcement (double-submit cookie pattern)
CSRF_ENABLED = os.getenv("CSRF_ENABLED", "false").strip().lower() in ("1", "true", "yes")
