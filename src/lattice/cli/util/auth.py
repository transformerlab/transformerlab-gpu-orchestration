import os
import json
import requests
from typing import Optional, Dict, Union
from .api import BACKEND_URL

# Enable debug mode
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# CLI credentials path
CLI_CONFIG_DIR = os.path.expanduser("~/.lab/cli")
CREDENTIALS_FILE = os.path.join(CLI_CONFIG_DIR, "credentials")


def api_request(
    method: str,
    endpoint: str,
    headers: Optional[Dict] = None,
    json_data: Optional[Dict] = None,
    files: Optional[Dict] = None,
    auth_needed: bool = True,
) -> requests.Response:
    """
    Make an API request with consistent error handling and debug logging.

    Args:
        method: HTTP method (GET, POST, etc.)
        endpoint: API endpoint (without base URL)
        headers: Optional headers dict
        json_data: Optional JSON data for POST requests
        files: Optional files dict for multipart form data
        auth_needed: Whether to automatically add authentication headers

    Returns:
        requests.Response object
    """
    url = f"{BACKEND_URL}{endpoint}"

    # Prepare headers
    if headers is None:
        headers = {}

    # Add authentication if needed
    if auth_needed:
        api_key = get_saved_api_key()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

    if DEBUG:
        print(f"[DEBUG] Making {method} request to: {url}")
        if headers:
            # Don't log the actual API key for security
            safe_headers = headers.copy()
            if "Authorization" in safe_headers:
                safe_headers["Authorization"] = "Bearer [REDACTED]"
            print(f"[DEBUG] Headers: {json.dumps(safe_headers, indent=2)}")
        if json_data:
            print(f"[DEBUG] JSON data: {json.dumps(json_data, indent=2)}")
        if files:
            print(f"[DEBUG] Files: {list(files.keys())}")

    # Handle different request types
    if files:
        # Multipart form data with files
        response = requests.request(method, url, headers=headers, files=files)
    elif json_data:
        # JSON data
        response = requests.request(method, url, headers=headers, json=json_data)
    else:
        # No data
        response = requests.request(method, url, headers=headers)

    if DEBUG:
        print(f"[DEBUG] Response status: {response.status_code}")
        if response.text:
            print(f"[DEBUG] Response content: {response.text[:1000]}")

    return response


# CLI credentials path
CLI_CONFIG_DIR = os.path.expanduser("~/.lab/cli")
CREDENTIALS_FILE = os.path.join(CLI_CONFIG_DIR, "credentials")


def save_api_key(api_key_data):
    """Securely save the API key to the credentials file."""
    os.makedirs(CLI_CONFIG_DIR, exist_ok=True)

    # Save the API key
    with open(CREDENTIALS_FILE, "w") as f:
        f.write(api_key_data["key"])

    # Save full API key response as JSON for reference
    with open(os.path.join(CLI_CONFIG_DIR, "api_key.json"), "w") as f:
        json.dump(api_key_data, f)


def get_saved_api_key():
    """Get the saved API key if it exists."""
    if not os.path.exists(CREDENTIALS_FILE):
        return None

    with open(CREDENTIALS_FILE, "r") as f:
        return f.read().strip()


def status() -> Union[Dict, None]:
    """
    Check the current user's authentication status by calling the /me endpoint.
    Returns user information if logged in, None otherwise.
    """
    data = api_request("GET", "/auth/me", auth_needed=True)
    if data.status_code == 200:
        return data.json()
    return None
