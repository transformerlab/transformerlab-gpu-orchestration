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
import fabric
import os
import uuid
import paramiko
from werkzeug.utils import secure_filename
from ..auth.api_key_auth import get_user_or_api_key
from ..auth.utils import (
    auth_from_cookie,
)  # Import get_auth_info


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
    # sanitize the client name:
    cluster_name = secure_filename(cluster_name)

    # Using the client name, look in ~/.sky/generated/ssh/<client_name> and open that file:
    ssh_config_path = os.path.expanduser(f"~/.sky/generated/ssh/{cluster_name}")
    if not os.path.exists(ssh_config_path):
        raise HTTPException(status_code=404, detail="SSH config not found")

    with open(ssh_config_path) as f:
        ssh_config = f.read()

    # The file looks like this:
    # Added by sky (use `sky stop/down tes3` to remove)
    # Host client_name
    #   HostName 213.192.2.70
    #   User root
    #   IdentityFile /Users/ali/.sky/clients/9c5e9924/ssh/sky-key
    #   IdentitiesOnly yes
    #   StrictHostKeyChecking no
    #   UserKnownHostsFile=/dev/null
    #   GlobalKnownHostsFile=/dev/null
    #   Port 41285
    # parse it to get the hostname, user, identity file and port:
    hostname = None
    username = None
    id_file = None
    port = None

    for line in ssh_config.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):  # Skip empty lines or comments
            continue
        if line.startswith("Host "):
            parts = line.split(maxsplit=1)
            if len(parts) > 1 and parts[1] == cluster_name:
                continue
        elif line.startswith("HostName"):
            parts = line.split(maxsplit=1)
            if len(parts) > 1:
                hostname = parts[1]
        elif line.startswith("User"):
            parts = line.split(maxsplit=1)
            if len(parts) > 1:
                username = parts[1]
        elif line.startswith("IdentityFile"):
            parts = line.split(maxsplit=1)
            if len(parts) > 1:
                id_file = parts[1]
        elif line.startswith("Port"):
            parts = line.split(maxsplit=1)
            if len(parts) > 1:
                port = int(parts[1])

    if not hostname or not username or not id_file or not port:
        print(ssh_config)
        raise HTTPException(status_code=400, detail="Invalid SSH config")

    """Render xterm.js terminal pre-logged in with provided parameters"""
    # Validate parameters
    if not cluster_name:
        raise HTTPException(status_code=400, detail="Client name is required")
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not isinstance(port, int) or port <= 0:
        raise HTTPException(status_code=400, detail="Invalid port number")
    if not id_file:
        raise HTTPException(status_code=400, detail="Identity file is required")

    # Validate that the identity file exists
    if not os.path.exists(id_file):
        raise HTTPException(
            status_code=400, detail=f"Identity file not found: {id_file}"
        )

    # Generate a unique session ID
    session_id = str(uuid.uuid4())

    # Store connection parameters for later use
    active_sessions[session_id] = {
        "params": {
            "hostname": hostname,
            "port": port,
            "username": username,
            "id_file": id_file,
        },
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
                    term.writeln('Connected to {hostname}:{port} as {username}');
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

    try:
        # Create SSH client using Fabric with host key checking disabled
        client = fabric.Connection(
            host=params["hostname"],
            user=params["username"],
            port=params["port"],
            connect_kwargs={
                "key_filename": params["id_file"],
                "allow_agent": False,
                "look_for_keys": False,
                "timeout": 60,  # Increase SSH connection timeout to 60 seconds
            },
            config=fabric.Config(overrides={"load_ssh_config": False}),
        )

        # Disable host key checking
        client.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        # Test the SSH connection
        try:
            client.open()
        except Exception as ssh_error:
            error_message = f"SSH connection failed: {str(ssh_error)}"
            print(f"WebSocket closed: {error_message}")
            try:
                await websocket.send_text(error_message)  # Send decoded error message
            except:
                pass  # Ignore errors when sending after close
            await websocket.close(code=1011, reason="SSH connection failed")
            return

        # Store the connection
        session_data["connection"] = client

        # Open a channel for interactive shell
        transport = client.client.get_transport()
        channel = transport.open_session()
        channel.get_pty(term="xterm")
        channel.invoke_shell()

        # Set up async reading
        async def reader():
            try:
                while not channel.exit_status_ready():
                    if channel.recv_ready():
                        data = channel.recv(1024)
                        if data:
                            # print(f"Data received from SSH: {data.decode('utf-8')}")
                            # Send data to websocket with safe encoding
                            await websocket.send_text(
                                base64.b64encode(data).decode("utf-8")
                            )
                    else:
                        await asyncio.sleep(0.1)
            except Exception as e:
                error_message = f"Error in reader: {str(e)}"
                print(f"WebSocket error: {error_message}")
                try:
                    await websocket.send_text(
                        error_message
                    )  # Send decoded error message
                except:
                    pass  # Ignore errors when sending after close

        # Start reader task
        reader_task = asyncio.create_task(reader())

        try:
            while True:
                # Receive data from websocket
                data = await websocket.receive_text()
                # print(f"Data received from WebSocket: {data}")
                try:
                    # Decode and send to SSH channel
                    decoded_data = base64.b64decode(data)
                    channel.send(decoded_data)
                except Exception as e:
                    error_message = f"Failed to process command: {str(e)}"
                    print(f"WebSocket error: {error_message}")
                    try:
                        await websocket.send_text(
                            error_message
                        )  # Send decoded error message
                    except:
                        pass  # Ignore errors when sending after close
        except WebSocketDisconnect:
            print(f"WebSocket disconnected: Session ID {session_id}")
            reader_task.cancel()
            try:
                channel.close()
                client.close()
            except Exception as e:
                print(f"Error closing SSH connection: {str(e)}")

            # Clean up session data
            if session_id in active_sessions:
                del active_sessions[session_id]

    except Exception as e:
        error_message = f"Connection error: {str(e)}"
        print(f"WebSocket error: {error_message}")
        try:
            await websocket.send_text(error_message)  # Send decoded error message
        except:
            pass  # Ignore errors when sending after close
        try:
            await websocket.close(code=1011, reason="Connection error")
        except Exception as close_error:
            print(f"Error closing WebSocket: {str(close_error)}")

        # Clean up session data
        if session_id in active_sessions:
            del active_sessions[session_id]
