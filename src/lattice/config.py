import os
from dotenv import load_dotenv
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
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
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


from db_models import *

AUTH_API_KEY = os.getenv("AUTH_API_KEY")
AUTH_CLIENT_ID = os.getenv("AUTH_CLIENT_ID")
AUTH_COOKIE_PASSWORD = (
    os.getenv("AUTH_COOKIE_PASSWORD") or "y0jN-wF1bIUoSwdKT6yWIHS5qLI4Kfq5TnqIANOxEXM="
)
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
