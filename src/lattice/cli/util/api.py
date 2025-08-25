import os


TLAB_API_BASE_URL = os.environ.get("TLAB_API_BASE_URL", "http://localhost:8000")
BACKEND_URL = f"{TLAB_API_BASE_URL}/api/v1"
TLAB_SSH_PROXY_URL = os.environ.get("TLAB_SSH_PROXY_URL", "localhost")
