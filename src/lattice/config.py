import os
from dotenv import load_dotenv
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../../lattice.db")

engine = create_engine(DATABASE_URL)

if engine.dialect.name == "sqlite":
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

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
