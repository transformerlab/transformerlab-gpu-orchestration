# lighthouse_proxy.py
# This script runs on your central server (lighthouse)

# This file is an initial attempt to make it work using Paramiko. To use it, run python main.py on this file
# But first copy in your SSH public key in the KEY_DATABASE
# Then you can connect to the proxy server using SSH using this command:
# ssh -p 2222 DirectAli/bob@localhost and see the output.

# Problems:
# 1 Must be run on the skypilot server
# 2 Can't get Paramiko to honour all of the SSH config (a) It can't handle Includes, and even when I point it right at the
# correct config in the ~/.sky/generated/ssh folder, the connection doesn't happen for Direct SSH -- there are too many
# complicated things in the config

# Suggestion: try using an openssh based library. Checking this in as v1 first

import socket
import threading
import paramiko
import os
import io
import select
import logging
import argparse

# --- Configuration ---
HOST = "0.0.0.0"  # Listen on all interfaces
PORT = 2222  # Port for the proxy service to listen on

# --- Mock Database and ACL ---
# In a real application, this would be a database query.
# The format is 'ssh-rsa AAAA...' (the content of a .pub file)
KEY_DATABASE = {
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAA7428uJAvZ ali@Alis-M1-MacBook-Pro.local": "alice",
    "ssh-rsa AAAAB3NzaC1yc2EI5PSWb51oSUHw==": "bob",
}

# Access Control List (ACL): Maps users to the nodes they can access.
ACL = {"alice": ["node1", "node2", "DirectAli"], "bob": ["node2", "DirectAli"]}


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

        # 2. Look up public key to identify the real user
        key_str = f"{key.get_name()} {key.get_base64()}"
        logging.debug(f"Looking up key in database: {key_str[:50]}...")
        real_user = KEY_DATABASE.get(key_str)

        if not real_user:
            logging.warning("Key rejected. User not found in database.")
            logging.debug(f"Available keys in database: {list(KEY_DATABASE.keys())}")
            return paramiko.AUTH_FAILED

        logging.info(f"Key accepted. Real user identified as '{real_user}'.")

        # 3. Authorize against the ACL
        user_permissions = ACL.get(real_user, [])
        logging.debug(f"User '{real_user}' has permissions for: {user_permissions}")

        if target_node in user_permissions:
            logging.info(
                f"Authorization successful for '{real_user}' to '{target_node}'."
            )
            self.authenticated_user = real_user
            self.target_node = target_node
            return paramiko.AUTH_SUCCESSFUL
        else:
            logging.warning(
                f"Authorization FAILED for '{real_user}' to '{target_node}'."
            )
            logging.debug(f"User '{real_user}' ACL: {user_permissions}")
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


def handle_client_connection(client_socket):
    client_addr = client_socket.getpeername()
    logging.info(f"Handling connection from {client_addr}")

    try:
        transport = paramiko.Transport(client_socket)
        transport.add_server_key(get_host_key())
        server = ProxySSHServer()

        logging.debug("Starting SSH transport server")
        transport.start_server(server=server)

        logging.debug("Waiting for channel establishment")
        channel = transport.accept(20)
        if not channel or not server.target_node:
            logging.error("Auth/authz failed or no channel established.")
            transport.close()
            return

        logging.info(
            f"Establishing proxy connection for {server.authenticated_user} to {server.target_node}"
        )

        # Connect to the backend target node using OpenSSH config
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        # Load OpenSSH config
        ssh_config_path = os.path.expanduser("~/.sky/generated/ssh/DirectAli")
        ssh_config = paramiko.SSHConfig()
        if os.path.exists(ssh_config_path):
            logging.debug(f"Loading SSH config from {ssh_config_path}")
            with open(ssh_config_path) as f:
                ssh_config.parse(f)
        else:
            logging.warning(f"SSH config file not found at {ssh_config_path}")

        # Get host-specific configuration
        host_config = ssh_config.lookup(server.target_node)
        hostname = host_config.get("hostname", server.target_node)
        port = int(host_config.get("port", 22))
        username = host_config.get("user")
        key_filename = host_config.get("identityfile", None)

        logging.info(f"Connecting to target: {hostname}:{port} as {username}")
        logging.debug(f"Using key file: {key_filename}")

        # Connect to the target node
        ssh_client.connect(
            hostname=hostname,
            port=port,
            username=username,
            key_filename=key_filename,
            look_for_keys=True,
        )

        logging.info(f"Successfully connected to target node {server.target_node}")

        # Open a channel to the target and bridge it
        target_channel = ssh_client.invoke_shell()
        logging.debug("Invoked shell on target node")

        # Bridge the connections
        bridge_thread = threading.Thread(
            target=bridge_connections, args=(channel, target_channel)
        )
        bridge_thread.daemon = True
        bridge_thread.start()
        logging.debug("Started connection bridge thread")

    except Exception as e:
        logging.error(
            f"Error in handle_client_connection from {client_addr}: {e}", exc_info=True
        )
    finally:
        try:
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
