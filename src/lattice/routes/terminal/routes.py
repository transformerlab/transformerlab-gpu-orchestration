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
from lattice.routes.auth.api_key_auth import get_user_or_api_key
from lattice.routes.auth.utils import (
    auth_from_cookie,
)  # Import get_auth_info
from lattice.utils.cluster_utils import get_cluster_platform_info
from lattice.utils.cluster_resolver import handle_cluster_name_param
import pty


router = APIRouter()  # Add prefix to all routes

# Store active connections
active_sessions = {}


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

    # Store connection parameters for later use
    active_sessions[session_id] = {
        "params": {"cluster_name": actual_cluster_name},
        "connection": None,
    }

    # Render the xterm.js terminal
    return f"""
    <!DOCTYPE html>
    <html>
        <head>
            <title>SSH Terminal</title>
            <script src="https://cdn.jsdelivr.net/npm/xterm@5.1.0/lib/xterm.min.js"></script>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.1.0/css/xterm.css" />
            <style>
                body {{ font-family: Arial, sans-serif; padding: 20px; }}
                #terminal {{ height: 400px; border: 1px solid #ccc; border-radius: 4px; margin-top: 10px; }}
                button {{ padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }}
                button:hover {{ background-color: #45a049; }}
            </style>
        </head>
        <body>
            <div id="terminal"></div>
            <script>
                const term = new Terminal();
                term.open(document.getElementById('terminal'));

                const socket = new WebSocket(`ws://localhost:8000/api/v1/terminal/ws/{session_id}`);

                socket.onopen = () => {{
                    term.writeln('Connected to {cluster_name}');
                    term.onData(data => {{
                        socket.send(btoa(data)); // Encode input as Base64
                    }});
                }};

                socket.onmessage = (event) => {{
                    const decodedData = atob(event.data); // Decode Base64 data
                    term.write(decodedData);
                }};

                socket.onclose = () => {{
                    term.writeln('Connection closed');
                }};

                socket.onerror = (error) => {{
                    term.writeln('WebSocket error: ' + JSON.stringify(error));
                }};
            </script>
        </body>
    </html>
    """


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

    # Validate the session using get_auth_info
    if not session_cookie:
        await websocket.close(code=1008, reason="Authentication required")
        print("WebSocket closed: Missing wos_session cookie")
        return

    auth_success = auth_from_cookie(session_cookie)

    if not auth_success:
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
    params = session_data["params"]

    ssh_cmd = ["ssh", params["cluster_name"]]

    try:
        # Allocate a PTY for the SSH process
        master_fd, slave_fd = pty.openpty()
        process = await asyncio.create_subprocess_exec(
            *ssh_cmd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
        )
        os.close(slave_fd)  # We don't need the slave fd in this process
        session_data["process"] = process
        session_data["master_fd"] = master_fd

        async def reader():
            try:
                loop = asyncio.get_event_loop()
                while True:
                    data = await loop.run_in_executor(None, os.read, master_fd, 1024)
                    if not data:
                        break
                    await websocket.send_text(base64.b64encode(data).decode("utf-8"))
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
            reader_task.cancel()
            try:
                os.close(master_fd)
                process.terminate()
                await process.wait()
            except Exception as e:
                print(f"Error closing SSH process: {str(e)}")
            if session_id in active_sessions:
                del active_sessions[session_id]
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
            if session_id in active_sessions:
                del active_sessions[session_id]
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
        if session_id in active_sessions:
            del active_sessions[session_id]
            # Clean up session data
            if session_id in active_sessions:
                del active_sessions[session_id]

        # Clean up session data
        if session_id in active_sessions:
            del active_sessions[session_id]
