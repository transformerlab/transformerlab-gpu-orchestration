# SSH Proxy Server (Lighthouse)
#
# Purpose: A secure SSH gateway that allows controlled access to remote machines through
# a central server without exposing their direct SSH access to the internet.
#
# Description:
# This server listens for SSH connections on port 2222 and acts as a proxy/gateway
# that authenticates users via public keys and authorizes access to specific target
# machines. It creates a secure bridge between incoming connections and outbound SSH
# sessions to the requested destinations.
#
# Key features:
# - Public key authentication (no passwords)
# - Access control based on user identity and allowed destinations
# - Transparent proxying using OpenSSH subprocesses with PTY support
# - Username format: <target_node>/<username> (e.g., "Home/bob")
# - Database integration for SSH key lookup
#
# Dependencies:
# - Python 3.6+
# - paramiko library
# - OpenSSH client installed on the system
# - SQLAlchemy and database connection
#
# How to test:
# 1) Add your SSH public key via the web UI (User Profile -> SSH Keys)
# 2) Create an instance in SkyPilot called "Home" (or change the hardcoded destination).
# 3) Run the server using `python main.py` (add --log-level=DEBUG for verbose output).
# 4) Connect using: ssh -p 2222 Home/bob@localhost
#

import socket
import threading
import paramiko
import os
import io
import select
import logging
import argparse
import subprocess
import pty
import hashlib
import base64
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, DateTime, Boolean
from sqlalchemy.orm import sessionmaker, Session

# Import SSHKey model from models.py
from lattice.db_models import SSHKey

# --- Configuration ---
HOST = "0.0.0.0"  # Listen on all interfaces
PORT = 2222  # Port for the proxy service to listen on

# --- Independent Database Setup ---
# Database URL - by default, use the same SQLite database as the main application
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///lattice.db")

# Create database engine and session
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_database_session() -> Session:
    """Get a database session"""
    return SessionLocal()


# --- Database SSH Key Lookup ---
def lookup_user_by_ssh_key(public_key: str) -> tuple[str, str]:
    """
    Look up user by SSH public key in the database.
    Returns (user_id, real_user_name) if found, raises ValueError if not found.
    """
    session = None
    try:
        # Get database session
        session = get_database_session()

        # Generate fingerprint for the provided key
        fingerprint = SSHKey.generate_fingerprint(public_key)

        # Look up the key in the database
        ssh_key = (
            session.query(SSHKey)
            .filter(SSHKey.fingerprint == fingerprint, SSHKey.is_active)
            .first()
        )

        if not ssh_key:
            raise ValueError("SSH key not found or inactive")

        # Update last_used_at
        ssh_key.update_last_used()
        session.commit()

        return ssh_key.user_id, ssh_key.name

    except Exception as e:
        if session:
            session.rollback()
        logging.error(f"Database lookup error: {e}")
        raise ValueError(f"Failed to lookup SSH key: {str(e)}")
    finally:
        if session:
            session.close()


# --- Mock ACL for now ---
# TODO: This should also be moved to database eventually
# For now, we'll use a simple mapping based on user IDs
def get_user_permissions(user_id: str) -> list[str]:
    """
    Get list of nodes/clusters the user can access.
    This is a simplified ACL - in production this should be database-driven.
    """
    # For now, all authenticated users can access "Home" cluster
    # This can be expanded to include role-based access control
    return ["Home", "node1", "node2"]


# Generate or load server host key
def get_host_key():
    host_key_path = os.path.expanduser("~/.ssh/proxy_server_rsa")
    try:
        host_key = paramiko.RSAKey(filename=host_key_path)
        logging.info(f"Loaded existing host key from {host_key_path}")
    except FileNotFoundError:
        logging.info(f"Generating new host key at {host_key_path}")
        host_key = paramiko.RSAKey.generate(2048)
        host_key.write_private_key_file(host_key_path)
        logging.info(f"New host key generated and saved to {host_key_path}")
    return host_key


class ProxySSHServer(paramiko.ServerInterface):
    def __init__(self):
        self.authenticated_user = None
        self.target_node = None
        self.channel = None
        logging.debug("ProxySSHServer instance created")

    def get_allowed_auths(self, username):
        """
        Return the authentication methods that are allowed for this user.
        Only allow public key authentication.
        """
        logging.debug(f"get_allowed_auths called for username: {username}")
        return "publickey"

    def check_auth_password(self, username, password):
        """
        Explicitly deny password authentication.
        """
        logging.warning(f"Password authentication attempted for '{username}' - DENIED")
        return paramiko.AUTH_FAILED

    def check_auth_publickey(self, username, key):
        """
        Authenticate by parsing the username for the target node
        and looking up the public key in the database.
        Expected username format: '<target_node>/<proxy_user>'
        """
        logging.info(f"Public key authentication attempt for username '{username}'")
        logging.debug(
            f"Key type: {key.get_name()}, Key fingerprint: {key.get_fingerprint().hex()}"
        )

        # 1. Parse username for target node
        try:
            target_node, proxy_user = username.split("/", 1)
            logging.debug(
                f"Parsed username - target_node: '{target_node}', proxy_user: '{proxy_user}'"
            )
        except ValueError:
            logging.error(
                f"Invalid username format. Expected '<target>/<user>', got '{username}'."
            )
            return paramiko.AUTH_FAILED

        # 2. Look up public key to identify the real user in database
        key_str = f"{key.get_name()} {key.get_base64()}"
        logging.debug(f"Looking up key in database: {key_str[:50]}...")

        try:
            user_id, key_name = lookup_user_by_ssh_key(key_str)
            logging.info(
                f"Key accepted. Real user ID: '{user_id}', Key name: '{key_name}'."
            )
        except ValueError as e:
            logging.warning(f"Key rejected: {e}")
            return paramiko.AUTH_FAILED

        # 3. Authorize against the ACL
        user_permissions = get_user_permissions(user_id)
        logging.debug(f"User '{user_id}' has permissions for: {user_permissions}")

        if target_node in user_permissions:
            logging.info(
                f"Authorization successful for user '{user_id}' to '{target_node}'."
            )
            self.authenticated_user = user_id
            self.target_node = target_node
            return paramiko.AUTH_SUCCESSFUL
        else:
            logging.warning(
                f"Authorization FAILED for user '{user_id}' to '{target_node}'."
            )
            logging.debug(f"User '{user_id}' ACL: {user_permissions}")
            return paramiko.AUTH_FAILED

    def check_channel_request(self, kind, chanid):
        logging.debug(f"Channel request: kind={kind}, chanid={chanid}")
        if kind == "session":
            return paramiko.OPEN_SUCCEEDED
        logging.warning(f"Channel request denied for kind: {kind}")
        return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

    # We now primarily expect shell or exec requests that tools will make
    def check_channel_shell_request(self, channel):
        logging.debug("Shell request received")
        return True

    def check_channel_exec_request(self, channel, command):
        logging.debug(f"Exec request received for command: {command}")
        return True

    def check_channel_pty_request(
        self, channel, term, width, height, pixelwidth, pixelheight, modes
    ):
        logging.debug(f"PTY request: term={term}, size={width}x{height}")
        return True


# (The bridge_connections function can be simplified, as we now use invoke_shell)
def bridge_connections(client_channel, target_channel):
    """Bridges I/O between two channels."""
    logging.debug("Starting connection bridge")
    bytes_transferred = {"client_to_target": 0, "target_to_client": 0}

    try:
        while True:
            r, w, e = select.select([client_channel, target_channel], [], [])
            if client_channel in r:
                data = client_channel.recv(1024)
                if len(data) == 0:
                    logging.debug("Client channel closed")
                    break
                target_channel.send(data)
                bytes_transferred["client_to_target"] += len(data)
                logging.debug(f"Forwarded {len(data)} bytes from client to target")
            if target_channel in r:
                data = target_channel.recv(1024)
                if len(data) == 0:
                    logging.debug("Target channel closed")
                    break
                client_channel.send(data)
                bytes_transferred["target_to_client"] += len(data)
                logging.debug(f"Forwarded {len(data)} bytes from target to client")
    except Exception as e:
        logging.error(f"Error in connection bridge: {e}")
    finally:
        logging.info(
            f"Connection bridge closed. Bytes transferred - C->T: {bytes_transferred['client_to_target']}, T->C: {bytes_transferred['target_to_client']}"
        )
        client_channel.close()
        target_channel.close()


def launch_ssh_subprocess(destination=""):
    """
    Launch an OpenSSH subprocess to connect to the target node.
    Returns the subprocess.Popen object.
    """
    ssh_cmd = ["ssh", destination]
    logging.debug(f"Launching SSH subprocess: {' '.join(ssh_cmd)}")
    proc = subprocess.Popen(
        ssh_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=0,
    )
    return proc


def launch_ssh_subprocess_with_pty(destination=""):
    """
    Launch an OpenSSH subprocess with a PTY to connect to the target node.
    Returns (pid, master_fd, proc).
    """
    # Create a new pseudo-terminal to attach to the subprocess
    master_fd, slave_fd = pty.openpty()
    ssh_cmd = ["ssh", destination]
    logging.debug(f"Launching SSH subprocess with PTY: {' '.join(ssh_cmd)}")
    proc = subprocess.Popen(
        ssh_cmd,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
        preexec_fn=os.setsid,
    )
    os.close(slave_fd)  # Only the child needs the slave
    return proc, master_fd


def bridge_channel_and_process(client_channel, ssh_proc):
    """
    Bridge data between the Paramiko channel and the SSH subprocess's stdin/stdout.
    """
    logging.debug("Starting bridge between client channel and SSH subprocess")
    bytes_transferred = {"client_to_target": 0, "target_to_client": 0}
    try:
        while True:
            rlist = [client_channel, ssh_proc.stdout]
            ready, _, _ = select.select(rlist, [], [])
            if client_channel in ready:
                data = client_channel.recv(1024)
                if not data:
                    logging.debug("Client channel closed")
                    break
                ssh_proc.stdin.write(data)
                ssh_proc.stdin.flush()
                bytes_transferred["client_to_target"] += len(data)
            if ssh_proc.stdout in ready:
                data = ssh_proc.stdout.read(1024)
                if not data:
                    logging.debug("SSH subprocess stdout closed")
                    break
                client_channel.send(data)
                bytes_transferred["target_to_client"] += len(data)
    except Exception as e:
        logging.error(f"Error in bridge_channel_and_process: {e}")
    finally:
        logging.info(
            f"Bridge closed. Bytes transferred - C->T: {bytes_transferred['client_to_target']}, T->C: {bytes_transferred['target_to_client']}"
        )
        try:
            client_channel.close()
        except Exception:
            pass
        try:
            ssh_proc.terminate()
        except Exception:
            pass


def bridge_channel_and_pty(client_channel, master_fd):
    """
    Bridge data between the Paramiko channel and the PTY master fd.
    """
    logging.debug("Starting bridge between client channel and SSH PTY")
    bytes_transferred = {"client_to_target": 0, "target_to_client": 0}
    try:
        while True:
            rlist = [client_channel, master_fd]
            ready, _, _ = select.select(rlist, [], [])
            if client_channel in ready:
                data = client_channel.recv(1024)
                if not data:
                    logging.debug("Client channel closed")
                    break
                os.write(master_fd, data)
                bytes_transferred["client_to_target"] += len(data)
            if master_fd in ready:
                try:
                    data = os.read(master_fd, 1024)
                except OSError:
                    logging.debug("PTY master fd closed")
                    break
                if not data:
                    logging.debug("PTY master fd EOF")
                    break
                client_channel.send(data)
                bytes_transferred["target_to_client"] += len(data)
    except Exception as e:
        logging.error(f"Error in bridge_channel_and_pty: {e}")
    finally:
        logging.info(
            f"Bridge closed. Bytes transferred - C->T: {bytes_transferred['client_to_target']}, T->C: {bytes_transferred['target_to_client']}"
        )
        try:
            client_channel.close()
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass


def handle_client_connection(client_socket):
    client_addr = client_socket.getpeername()
    logging.info(f"Handling connection from {client_addr}")

    transport = None
    try:
        transport = paramiko.Transport(client_socket)
        transport.add_server_key(get_host_key())
        server = ProxySSHServer()

        logging.debug("Starting SSH transport server")
        transport.start_server(server=server)

        logging.debug("Waiting for channel establishment")
        channel = transport.accept(20)
        if not channel or not server.target_node:
            if transport:
                transport.close()
            return

        logging.info(
            f"Establishing proxy connection for {server.authenticated_user} to {server.target_node}"
        )

        # --- Wait for shell or exec request ---
        # Paramiko sets .event for shell/exec requests, but we can check for them by waiting for a request
        # We'll use a simple approach: wait for a shell or exec request for up to 10 seconds
        shell_or_exec_requested = False
        for _ in range(100):
            if channel.closed:
                logging.error("Channel closed before shell/exec request")
                transport.close()
                return
            if channel.recv_ready() or channel.send_ready():
                # This means the client is ready to send/receive data, likely after shell/exec request
                shell_or_exec_requested = True
                break
            # Sleep briefly and check again
            import time

            time.sleep(0.1)
        if not shell_or_exec_requested:
            logging.error("No shell/exec request received from client")
            transport.close()
            return
        logging.debug(
            "Shell/exec request received, proceeding to launch SSH subprocess"
        )

        # Launch OpenSSH subprocess with PTY
        ssh_proc, master_fd = launch_ssh_subprocess_with_pty(destination="Home")

        # Do a test to see if the SSH process is running
        if ssh_proc.poll() is None:
            logging.info("SSH subprocess started successfully")
        else:
            logging.error("Failed to start SSH subprocess")

        # Bridge the connections using PTY
        bridge_thread = threading.Thread(
            target=bridge_channel_and_pty, args=(channel, master_fd)
        )
        bridge_thread.daemon = True
        bridge_thread.start()
        logging.debug("Started connection bridge thread")

        # Wait for the bridge thread to finish before cleaning up
        bridge_thread.join()

    except Exception as e:
        logging.error(
            f"Error in handle_client_connection from {client_addr}: {e}", exc_info=True
        )
    finally:
        try:
            if transport:
                transport.close()
            client_socket.close()
            logging.debug(f"Cleaned up connection from {client_addr}")
        except Exception as e:
            logging.error(f"Error during cleanup: {e}")


def setup_logging(level):
    """Configure logging with the specified level."""
    numeric_level = getattr(logging, level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"Invalid log level: {level}")

    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Set paramiko logging to WARNING to reduce noise unless we're in DEBUG mode
    if numeric_level > logging.DEBUG:
        logging.getLogger("paramiko").setLevel(logging.WARNING)


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="SSH Proxy Server")
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        default="INFO",
        help="Set the logging level (default: INFO)",
    )
    return parser.parse_args()


# (main function remains the same)
def main():
    args = parse_arguments()
    setup_logging(args.log_level)

    logging.info("Starting SSH Proxy Server")
    logging.info(f"Log level set to: {args.log_level}")
    logging.info(f"Database URL: {DATABASE_URL}")

    # Test database connection
    try:
        session = get_database_session()
        # Simple query to test connection
        key_count = session.query(SSHKey).count()
        logging.info(f"Database connection successful. Found {key_count} SSH keys.")
        session.close()
    except Exception as e:
        logging.error(f"Database connection failed: {e}")
        logging.error(
            "Make sure the database exists and the SSH keys table has been created via migration."
        )
        return

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server_socket.bind((HOST, PORT))
    server_socket.listen(5)
    logging.info(f"Lighthouse SSH proxy (username-based) listening on {HOST}:{PORT}")
    logging.debug(f"Server socket bound and listening with backlog of 5")

    try:
        while True:
            client_sock, addr = server_socket.accept()
            logging.info(f"Accepted connection from {addr}")
            threading.Thread(
                target=handle_client_connection, args=(client_sock,)
            ).start()
    except KeyboardInterrupt:
        logging.info("Received shutdown signal")
    finally:
        server_socket.close()
        logging.info("Server socket closed")


if __name__ == "__main__":
    main()
