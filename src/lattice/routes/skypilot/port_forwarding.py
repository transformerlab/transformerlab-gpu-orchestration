import asyncio
import subprocess
import threading
import time
import socket
from typing import Optional, Dict, List


class PortForwardManager:
    def __init__(self):
        self.active_forwards: Dict[str, Dict] = {}
        self._lock = threading.Lock()

    def find_available_port(self, start_port: int = 8888) -> int:
        """Find an available local port starting from start_port."""
        for port in range(start_port, start_port + 100):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("localhost", port))
                    return port
            except OSError:
                continue
        raise RuntimeError(
            f"No available ports found in range {start_port}-{start_port + 100}"
        )

    def start_port_forward(
        self, cluster_name: str, remote_port: int, service_type: str
    ) -> Optional[Dict]:
        """Start port forwarding for a cluster."""
        try:
            local_port = self.find_available_port(remote_port)

            # Check if already forwarding this cluster
            with self._lock:
                if cluster_name in self.active_forwards:
                    print(f"Port forward already active for cluster {cluster_name}")
                    return self.active_forwards[cluster_name]

            # Start SSH port forwarding in background
            cmd = [
                "ssh",
                "-L",
                f"{local_port}:localhost:{remote_port}",
                cluster_name,
                "-N",
                "-f",  # -N: don't execute command, -f: background
            ]

            print(f"Starting port forward: {' '.join(cmd)}")

            # Run the SSH command
            process = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )

            # Wait a moment to see if it starts successfully
            time.sleep(2)

            if process.poll() is None:  # Process is still running
                forward_info = {
                    "cluster_name": cluster_name,
                    "local_port": local_port,
                    "remote_port": remote_port,
                    "service_type": service_type,
                    "access_url": f"http://localhost:{local_port}",
                    "process": process,
                }

                with self._lock:
                    self.active_forwards[cluster_name] = forward_info

                print(
                    f"Port forward started: {cluster_name}:{remote_port} -> localhost:{local_port}"
                )
                return forward_info
            else:
                stdout, stderr = process.communicate()
                # print(f"Port forward failed: {stderr}")
                forward_info = {
                    "cluster_name": cluster_name,
                    "local_port": local_port,
                    "remote_port": remote_port,
                    "service_type": service_type,
                    "access_url": f"http://localhost:{local_port}",
                }
                return forward_info

        except Exception as e:
            print(f"Error starting port forward: {e}")
            return None

    def stop_port_forward(self, cluster_name: str) -> bool:
        """Stop port forwarding for a cluster."""
        try:
            with self._lock:
                if cluster_name not in self.active_forwards:
                    return False

                forward_info = self.active_forwards[cluster_name]
                process = forward_info.get("process")

                if process and process.poll() is None:
                    process.terminate()
                    process.wait(timeout=5)

                del self.active_forwards[cluster_name]
                print(f"Port forward stopped for cluster {cluster_name}")
                return True

        except Exception as e:
            print(f"Error stopping port forward: {e}")
            return False

    def get_active_forwards(self) -> List[Dict]:
        """Get list of active port forwards."""
        with self._lock:
            return [
                {
                    "cluster_name": info["cluster_name"],
                    "local_port": info["local_port"],
                    "remote_port": info["remote_port"],
                    "service_type": info["service_type"],
                    "access_url": info["access_url"],
                }
                for info in self.active_forwards.values()
            ]

    def cleanup_all(self):
        """Clean up all active port forwards."""
        cluster_names = list(self.active_forwards.keys())
        for cluster_name in cluster_names:
            self.stop_port_forward(cluster_name)


# Global instance
port_forward_manager = PortForwardManager()


def setup_port_forwarding_for_cluster(
    cluster_name: str,
    launch_mode: str,
    jupyter_port: Optional[int] = None,
    vscode_port: Optional[int] = None,
) -> Optional[Dict]:
    """Setup port forwarding based on launch mode."""
    try:
        if launch_mode == "jupyter" and jupyter_port:
            return port_forward_manager.start_port_forward(
                cluster_name, jupyter_port, "jupyter"
            )
        elif launch_mode == "vscode" and vscode_port:
            return port_forward_manager.start_port_forward(
                cluster_name, vscode_port, "vscode"
            )
        else:
            print(f"No port forwarding needed for mode: {launch_mode}")
            return None
    except Exception as e:
        print(f"Error setting up port forwarding: {e}")
        return None


def wait_for_cluster_ready(cluster_name: str, timeout: int = 300) -> bool:
    """Wait for cluster to be ready for SSH connection."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            # Try to connect to the cluster
            result = subprocess.run(
                ["ssh", "-o", "ConnectTimeout=10", cluster_name, "echo", "ready"],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0:
                print(f"Cluster {cluster_name} is ready")
                return True
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
            pass

        print(f"Waiting for cluster {cluster_name} to be ready...")
        time.sleep(10)

    print(f"Cluster {cluster_name} not ready after {timeout} seconds")
    return False


def check_service_running(cluster_name: str, service_type: str, port: int) -> bool:
    """Check if the service is running on the cluster."""
    try:
        if service_type == "jupyter":
            # Check if jupyter is running
            result = subprocess.run(
                [
                    "ssh",
                    "-o",
                    "ConnectTimeout=10",
                    cluster_name,
                    "pgrep",
                    "-f",
                    "jupyter",
                ],
                capture_output=True,
                text=True,
                timeout=15,
            )
            return result.returncode == 0
        elif service_type == "vscode":
            # Check if code-server is running
            result = subprocess.run(
                [
                    "ssh",
                    "-o",
                    "ConnectTimeout=10",
                    cluster_name,
                    "pgrep",
                    "-f",
                    "code-server",
                ],
                capture_output=True,
                text=True,
                timeout=15,
            )
            return result.returncode == 0
        return False
    except Exception as e:
        print(f"Error checking service status: {e}")
        return False


async def setup_port_forwarding_async(
    cluster_name: str,
    launch_mode: str,
    jupyter_port: Optional[int] = None,
    vscode_port: Optional[int] = None,
) -> Optional[Dict]:
    """Async wrapper for setting up port forwarding."""
    loop = asyncio.get_event_loop()

    # Wait for cluster to be ready
    ready = await loop.run_in_executor(None, wait_for_cluster_ready, cluster_name)
    if not ready:
        print(f"Cluster {cluster_name} not ready for port forwarding")
        return None

    # Wait for service to be running (up to 2 minutes)
    service_ready = False
    service_type = "jupyter" if launch_mode == "jupyter" else "vscode"
    port = jupyter_port if launch_mode == "jupyter" else vscode_port

    for _ in range(12):  # Check for 2 minutes (12 * 10 seconds)
        service_ready = await loop.run_in_executor(
            None, check_service_running, cluster_name, service_type, port
        )
        if service_ready:
            print(f"Service {service_type} is running on cluster {cluster_name}")
            break
        print(
            f"Waiting for {service_type} service to start on cluster {cluster_name}..."
        )
        await asyncio.sleep(10)

    if not service_ready:
        print(
            f"Service {service_type} not running on cluster {cluster_name} after 2 minutes"
        )
        # Still try to setup port forwarding in case the service starts later
        return await loop.run_in_executor(
            None,
            setup_port_forwarding_for_cluster,
            cluster_name,
            launch_mode,
            jupyter_port,
            vscode_port,
        )

    # Setup port forwarding
    return await loop.run_in_executor(
        None,
        setup_port_forwarding_for_cluster,
        cluster_name,
        launch_mode,
        jupyter_port,
        vscode_port,
    )
