from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    Response,
    Request,
    Depends,
)
from fastapi.responses import HTMLResponse
import asyncio
import base64
import os
import uuid
from werkzeug.utils import secure_filename
from routes.auth.api_key_auth import get_user_or_api_key
from routes.auth.utils import (
    get_user_from_sealed_session,
)
from utils.cluster_utils import get_cluster_platform_info
from utils.cluster_resolver import handle_cluster_name_param
import pty


router = APIRouter(include_in_schema=False)  # Hide all routes in this router from docs

# Store active connections
active_sessions = {}
active_sessions_lock = asyncio.Lock()
SESSION_TTL_SECONDS = 30 * 60


@router.get("/terminal", response_class=HTMLResponse)
async def terminal_connect(
    cluster_name: str,
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    # Get user info from request
    user_id = user["id"]
    org_id = user.get("organization_id")

    if not org_id:
        raise HTTPException(
            status_code=400,
            detail="Organization ID not found in user context",
        )

    # Resolve display name to actual cluster name
    try:
        actual_cluster_name = handle_cluster_name_param(cluster_name, user_id, org_id)
    except HTTPException:
        # If cluster name resolution fails, it means the cluster doesn't exist for this user/org
        raise HTTPException(
            status_code=404,
            detail=f"Cluster '{cluster_name}' not found",
        )

    # Verify cluster ownership using the new system
    platform_info = get_cluster_platform_info(actual_cluster_name)

    if not platform_info:
        raise HTTPException(
            status_code=404,
            detail=f"Cluster '{cluster_name}' not found",
        )

    cluster_user_id = platform_info.get("user_id")
    cluster_org_id = platform_info.get("organization_id")

    if cluster_user_id != user_id or cluster_org_id != org_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: cluster does not belong to your user or organization",
        )

    # sanitize the actual cluster name:
    actual_cluster_name = secure_filename(actual_cluster_name)

    # Generate a unique session ID
    session_id = str(uuid.uuid4())

    # Store connection parameters (with TTL) and perform cleanup under lock
    now = asyncio.get_event_loop().time()
    async with active_sessions_lock:
        # TTL cleanup
        try:
            expired = [
                sid
                for sid, data in active_sessions.items()
                if (now - data.get("created_at", now)) > SESSION_TTL_SECONDS
            ]
            for sid in expired:
                active_sessions.pop(sid, None)
        except Exception:
            pass

        active_sessions[session_id] = {
            "params": {"cluster_name": actual_cluster_name},
            "connection": None,
            "user_id": user_id,
            "organization_id": org_id,
            "created_at": now,
        }

        # Bound size to prevent unbounded growth
        try:
            if len(active_sessions) > 1000:
                oldest_key = next(iter(active_sessions))
                if oldest_key != session_id:
                    active_sessions.pop(oldest_key, None)
        except Exception:
            pass

    # Return terminal.html but replace placeholders with actual values
    with open("src/lattice/routes/terminal/terminal.html", "r") as f:
        html_content = f.read()
        html_content = html_content.replace("{{ session_id }}", session_id)
        html_content = html_content.replace("{{ cluster_name }}", actual_cluster_name)
    return HTMLResponse(content=html_content, status_code=200)


@router.websocket("/terminal/ws/{session_id}")
async def terminal_websocket(
    websocket: WebSocket,
    session_id: str,
):
    """WebSocket endpoint for terminal communication"""
    # Extract cookies from WebSocket headers
    from http.cookies import SimpleCookie

    cookies = websocket.headers.get("cookie", "")
    cookie_parser = SimpleCookie()
    cookie_parser.load(cookies)
    session_cookie = (
        cookie_parser.get("wos_session").value
        if "wos_session" in cookie_parser
        else None
    )

    # Validate the session using auth utils
    if not session_cookie:
        await websocket.close(code=1008, reason="Authentication required")
        print("WebSocket closed: Missing wos_session cookie")
        return

    # Bind user from cookie and compare with session owner
    try:
        user = get_user_from_sealed_session(session_cookie)
    except Exception as e:
        print(f"Error validating session cookie: {str(e)}")
        await websocket.close(code=1008, reason="Authentication failed")
        return

    if not user:
        await websocket.close(code=1008, reason="Authentication failed")
        print("WebSocket closed: Authentication failed")
        return

    # Accept the WebSocket connection
    await websocket.accept()

    # Validate session ID
    if session_id not in active_sessions:
        await websocket.close(code=1008, reason="Invalid session")
        print(f"WebSocket closed: Invalid session ID {session_id}")
        return

    session_data = active_sessions[session_id]
    # TTL check
    try:
        now = asyncio.get_event_loop().time()
        if (now - session_data.get("created_at", now)) > SESSION_TTL_SECONDS:
            await websocket.close(code=1008, reason="Session expired")
            async with active_sessions_lock:
                active_sessions.pop(session_id, None)
            return
    except Exception as e:
        print(f"Error during TTL check: {str(e)}")
        pass
    params = session_data["params"]

    # Enforce that the websocket user matches the session owner
    if session_data.get("user_id") != user.get("id") or session_data.get(
        "organization_id"
    ) != user.get("organization_id"):
        print("WebSocket closed: User mismatch.")
        await websocket.close(code=1008, reason="Unauthorized for session")
        return

    ssh_cmd = ["ssh", params["cluster_name"]]

    print(
        f"Starting SSH connection to {params['cluster_name']} for session {session_id}"
    )

    # Schedule forced disconnect after TTL from session creation
    ttl_task = None
    try:
        created_at = float(
            session_data.get("created_at", asyncio.get_event_loop().time())
        )
        now = asyncio.get_event_loop().time()
        remain = max(0.0, (SESSION_TTL_SECONDS - (now - created_at)))

        async def _ttl_watchdog(delay: float):
            try:
                await asyncio.sleep(delay)
                try:
                    await websocket.close(code=1008, reason="Session expired")
                except Exception:
                    pass
            except Exception:
                pass

        ttl_task = asyncio.create_task(_ttl_watchdog(remain))
    except Exception:
        ttl_task = None

    try:
        # Allocate a PTY for the SSH process
        try:
            master_fd, slave_fd = pty.openpty()
            os.set_blocking(master_fd, False)  # Make PTY non-blocking
        except Exception as e:
            error_msg = f"Failed to create PTY: {str(e)}"
            print(f"WebSocket error: {error_msg}")
            await websocket.send_text(error_msg)
            await websocket.close(code=1011, reason="PTY creation failed")
            return

        try:
            process = await asyncio.create_subprocess_exec(
                *ssh_cmd,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                close_fds=True,
            )
        except Exception as e:
            error_msg = f"Failed to start SSH process: {str(e)}"
            print(f"WebSocket error: {error_msg}")
            try:
                os.close(master_fd)
                os.close(slave_fd)
            except Exception:
                pass
            await websocket.send_text(error_msg)
            await websocket.close(code=1011, reason="SSH process failed")
            return

        os.close(slave_fd)  # We don't need the slave fd in this process
        session_data["process"] = process
        session_data["master_fd"] = master_fd

        async def reader():
            try:
                loop = asyncio.get_event_loop()
                while True:
                    try:
                        data = await loop.run_in_executor(
                            None, os.read, master_fd, 1024
                        )
                        if not data:
                            await asyncio.sleep(0.05)
                            continue
                        await websocket.send_text(
                            base64.b64encode(data).decode("utf-8")
                        )
                    except BlockingIOError:
                        await asyncio.sleep(0.05)
                    except OSError:
                        # FD closed or process exited
                        break
            except asyncio.CancelledError:
                # Task was cancelled, exit cleanly
                pass
            except Exception as e:
                error_message = f"Error in reader: {str(e)}"
                print(f"WebSocket error: {error_message}")
                try:
                    await websocket.send_text(error_message)
                except Exception:
                    pass

        reader_task = asyncio.create_task(reader())

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    decoded_data = base64.b64decode(data)
                    # Write to the PTY master fd
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, os.write, master_fd, decoded_data)
                except Exception as e:
                    error_message = f"Failed to process command: {str(e)}"
                    print(f"WebSocket error: {error_message}")
                    try:
                        await websocket.send_text(error_message)
                    except Exception:
                        pass
        except WebSocketDisconnect:
            print(f"WebSocket disconnected: Session ID {session_id}")
        except Exception as e:
            error_message = f"Connection error: {str(e)}"
            print(f"WebSocket error: {error_message}")
            try:
                await websocket.send_text(error_message)
            except Exception:
                pass
            try:
                await websocket.close(code=1011, reason="Connection error")
            except Exception as close_error:
                print(f"Error closing WebSocket: {str(close_error)}")
        finally:
            # Cleanup: cancel reader, close PTY, terminate process, remove session
            if ttl_task:
                try:
                    ttl_task.cancel()
                except Exception:
                    pass
            if reader_task:
                reader_task.cancel()
                # Close PTY and terminate process before awaiting reader_task
                try:
                    os.close(master_fd)
                except Exception:
                    pass
                try:
                    process.terminate()
                    await process.wait()
                except Exception:
                    pass
                try:
                    await asyncio.wait_for(reader_task, timeout=2)
                except Exception:
                    pass
            async with active_sessions_lock:
                active_sessions.pop(session_id, None)
    except Exception as e:
        error_message = f"Connection error: {str(e)}"
        print(f"WebSocket error: {error_message}")
        try:
            await websocket.send_text(error_message)
        except Exception:
            pass
        try:
            await websocket.close(code=1011, reason="Connection error")
        except Exception as close_error:
            print(f"Error closing WebSocket: {str(close_error)}")
        async with active_sessions_lock:
            active_sessions.pop(session_id, None)
