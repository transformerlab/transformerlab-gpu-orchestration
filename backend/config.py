import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

WORKOS_API_KEY = os.getenv("WORKOS_API_KEY")
WORKOS_CLIENT_ID = os.getenv("WORKOS_CLIENT_ID")
WORKOS_COOKIE_PASSWORD = os.getenv(
    "WORKOS_COOKIE_PASSWORD", "y0jN-wF1bIUoSwdKT6yWIHS5qLI4Kfq5TnqIANOxEXM="
)
WORKOS_REDIRECT_URI = os.getenv("WORKOS_REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# RunPod Configuration
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")
