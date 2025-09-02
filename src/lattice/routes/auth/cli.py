from fastapi import APIRouter, HTTPException, Response, Body, Request, Depends
import os
import traceback
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from ..api_keys.service import APIKeyService
from .utils import get_current_user
from .api_key_auth import get_db

# Store CLI authorization sessions
CLI_AUTH_SESSIONS: Dict[str, Dict[str, Any]] = {}

router = APIRouter(prefix="/auth/cli", tags=["auth"])


@router.post("/start")
async def start_cli_authorization(
    request: Request,
    api_key: Optional[str] = Body(None, embed=True),
    username: Optional[str] = Body(None, embed=True),
    hostname: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
):
    """
    Start the CLI authorization flow.
    If an API key is provided and valid, return success.
    Otherwise, create a session and provide a URL for web authorization.
    """
    print("[DEBUG] /cli/start endpoint called")

    # Log the current state of sessions
    print(f"[DEBUG] Current CLI sessions: {list(CLI_AUTH_SESSIONS.keys())}")

    # Get machine information from request
    client_username = username or "unknown-user"
    client_hostname = hostname or "unknown-device"
    client_ip_address = request.client.host
    print(
        f"[DEBUG] Client info - Username: {client_username}, Hostname: {client_hostname}, IP Address: {client_ip_address}"
    )
    try:
        # If API key is provided, validate it
        if api_key:
            print("[DEBUG] API key provided, validating")
            # Hash the provided key for lookup
            key_hash = None
            from db.db_models import APIKey

            try:
                key_hash = APIKey.hash_key(api_key)
            except Exception as e:
                print(f"[DEBUG] Error hashing API key: {str(e)}")
                return {"status": "error", "message": "Invalid API key format"}

            # Look up the API key in the database
            api_key_record = (
                db.query(APIKey).filter(APIKey.key_hash == key_hash).first()
            )

            if (
                api_key_record
                and not api_key_record.is_expired()
                and api_key_record.is_active
            ):
                print("[DEBUG] API key is valid")
                # Update last used time
                api_key_record.update_last_used()
                db.commit()

                return {
                    "status": "success",
                    "message": "API key is valid",
                    "user_id": api_key_record.user_id,
                    "organization_id": api_key_record.organization_id,
                }
            else:
                print("[DEBUG] API key is invalid or expired")
                # Returning 200 with error status to allow CLI to proceed with auth flow
                return {"status": "error", "message": "API key is invalid or expired"}

        # No valid API key provided, start web authorization flow
        print("[DEBUG] Starting web authorization flow")

        # Use provided hostname and username from CLI if available
        # Otherwise, use default values
        import uuid
        from datetime import datetime, timedelta

        session_id = str(uuid.uuid4())

        # Store session information with expiration (15 minutes)
        session_data = {
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=15),
            "client_ip": client_ip_address,
            "hostname": client_hostname,
            "username": client_username,
            "authorized": False,
            "api_key": None,
            "user_id": None,
        }

        CLI_AUTH_SESSIONS[session_id] = session_data
        print(f"[DEBUG] Created session with data: {session_data}")

        # Generate frontend URL for authorization
        frontend_url = os.getenv(
            "FRONTEND_URL", f"{request.url.scheme}://{request.url.netloc}"
        )
        frontend_url = f"{frontend_url.rstrip('/')}/cli-authorize/{session_id}"

        response_data = {
            "status": "pending",
            "message": "Please complete authorization in web browser",
            "session_id": session_id,
            "authorization_url": frontend_url,
            "expires_in": 900,  # 15 minutes in seconds
            "interval": 5,  # Polling interval in seconds
        }

        print(f"[DEBUG] Created CLI auth session: {session_id}")
        print(f"[DEBUG] Returning response data: {response_data}")
        return response_data
    except Exception as e:
        print(f"[DEBUG] Error in start_cli_authorization: {str(e)}")
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start CLI authorization: {str(e)}"
        )


@router.post("/poll")
async def poll_cli_authorization(session_id: str = Body(..., embed=True)):
    """
    Poll for the completion of the CLI authorization flow.
    Returns the API key if authorization is complete.
    """
    print(f"[DEBUG] /cli/poll endpoint called with session_id: {session_id}")

    try:
        # Check if session exists
        session = CLI_AUTH_SESSIONS.get(session_id)

        if not session:
            print("[DEBUG] Session not found")
            raise HTTPException(status_code=400, detail="Invalid or expired session")

        # Check if session has expired
        from datetime import datetime

        if datetime.utcnow() > session["expires_at"]:
            print("[DEBUG] Session expired")
            # Clean up expired session
            CLI_AUTH_SESSIONS.pop(session_id, None)
            raise HTTPException(status_code=400, detail="Session expired")

        # Check if authorization is complete
        if not session["authorized"]:
            print("[DEBUG] Authorization still pending")
            return Response(status_code=202, content="Authorization pending")

        # Authorization complete, return API key information
        print("[DEBUG] Authorization complete")

        # Clean up session
        api_key_data = session["api_key"]
        user_id = session["user_id"]
        CLI_AUTH_SESSIONS.pop(session_id, None)

        return {
            "status": "success",
            "message": "Authorization complete",
            "user_id": user_id,
            "api_key": api_key_data,
        }
    except Exception as e:
        print(f"[DEBUG] Error in poll_cli_authorization: {str(e)}")
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail=f"Failed to poll CLI authorization: {str(e)}"
        )


@router.get("/session/{session_id}")
async def get_cli_session(session_id: str, user=Depends(get_current_user)):
    """
    Retrieve information about a CLI authorization session.
    Requires a logged-in user.
    """
    print(f"[DEBUG] /cli/session/{session_id} endpoint called")

    # Log all available sessions for debugging
    print(f"[DEBUG] Available sessions: {list(CLI_AUTH_SESSIONS.keys())}")

    # Check if session exists
    session = CLI_AUTH_SESSIONS.get(session_id)

    if not session:
        print("[DEBUG] Session not found")
        # Instead of raising an exception, return a placeholder message
        # This helps debug the frontend without errors
        return {
            "client_ip": "unknown",
            "hostname": "unknown-device",
            "username": "unknown-user",
            "created_at": datetime.utcnow().isoformat(),
            "error": "Session not found or expired",
        }

    # Check if session has expired
    if datetime.utcnow() > session["expires_at"]:
        print("[DEBUG] Session expired")
        # Clean up expired session
        CLI_AUTH_SESSIONS.pop(session_id, None)
        # Return info instead of raising exception
        return {
            "client_ip": session["client_ip"],
            "hostname": session["hostname"],
            "username": session["username"],
            "created_at": session["created_at"].isoformat(),
            "error": "Session expired",
        }

    # Return session information for display
    return {
        "client_ip": session["client_ip"],
        "hostname": session["hostname"],
        "username": session["username"],
        "created_at": session["created_at"].isoformat(),
    }


@router.post("/authorize")
async def authorize_cli(
    session_id: str = Body(...),
    authorized: bool = Body(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Endpoint for the frontend to approve or reject CLI authorization.
    Requires a logged-in user.
    """
    print(
        f"[DEBUG] /cli/authorize endpoint called with session_id: {session_id}, authorized: {authorized}"
    )

    try:
        # Check if session exists
        session = CLI_AUTH_SESSIONS.get(session_id)

        if not session:
            print("[DEBUG] Session not found")
            raise HTTPException(status_code=400, detail="Invalid or expired session")

        # Check if session has expired
        from datetime import datetime

        if datetime.utcnow() > session["expires_at"]:
            print("[DEBUG] Session expired")
            # Clean up expired session
            CLI_AUTH_SESSIONS.pop(session_id, None)
            raise HTTPException(status_code=400, detail="Session expired")

        # If authorized, create a new API key for the user
        if authorized:
            user_id = user["id"]
            hostname = session["hostname"]
            username = session["username"]
            organization_id = user.get("organization_id")

            # Log the info we're using
            print(
                f"[DEBUG] Creating API key for user {user_id} from machine {username}@{hostname}"
            )

            # Create API key name based on user and machine
            api_key_name = f"{username}@{hostname}-cli"

            # Create API key
            api_key_value, api_key_record = APIKeyService.create_api_key(
                user_id=user_id,
                name=api_key_name,
                organization_id=organization_id,
                expires_in_days=90,  # 90-day expiration
                scopes=["cli:access"],  # Define appropriate scope for CLI access
                db=db,
            )

            # Update session with API key and mark as authorized
            session["authorized"] = True
            session["api_key"] = {
                "key": api_key_value,
                "id": str(api_key_record.id),
                "name": api_key_record.name,
                "expires_at": api_key_record.expires_at.isoformat()
                if api_key_record.expires_at
                else None,
            }
            session["user_id"] = user_id

            print(
                f"[DEBUG] Created API key with ID: {api_key_record.id} for user: {user_id}"
            )

            return {"status": "success", "message": "CLI authorized successfully"}
        else:
            # User rejected the authorization
            CLI_AUTH_SESSIONS.pop(session_id, None)
            return {"status": "rejected", "message": "CLI authorization rejected"}

    except Exception as e:
        print(f"[DEBUG] Error in authorize_cli: {str(e)}")
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process CLI authorization: {str(e)}"
        )
