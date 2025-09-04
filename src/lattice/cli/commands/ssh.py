import os
from lattice.cli.util.auth import api_request
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

SSH_PROXY_URL = os.getenv("TLAB_SSH_PROXY_URL", "localhost")


def resolve_cluster_name_via_api(display_name: str) -> str:
    """
    Resolve display name to actual cluster name using the API endpoint.
    """
    try:
        resp = api_request(
            "GET", f"/instances/resolve-name/{display_name}", auth_needed=True
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("actual_name", display_name)
        elif resp.status_code == 404:
            # Cluster not found, return original name
            return display_name
        else:
            print(
                f"Warning: Failed to resolve cluster name (status {resp.status_code})"
            )
            return display_name
    except Exception as e:
        print(f"Warning: API call failed: {e}")
        return display_name


def _get_actual_cluster_name(display_name: str) -> str:
    """Map display name to actual cluster name for SSH connections."""
    return resolve_cluster_name_via_api(display_name)


def ssh_command(console: Console, instance_name: str):
    """SSH into a specific instance."""
    console.print("[bold blue]SSH into Transformer Lab instance[/bold blue]")
    console.print(
        f"[bold blue]Connecting to instance: [cyan]{instance_name}[/cyan][/bold blue]"
    )

    # Map display name to actual cluster name for SSH connection
    actual_cluster_name = _get_actual_cluster_name(instance_name)
    if actual_cluster_name != instance_name:
        console.print(
            f"[dim]Using actual cluster name: [cyan]{actual_cluster_name}[/cyan][/dim]"
        )

    # SSH command using actual cluster name
    ssh_command = f"ssh -p 2222 {actual_cluster_name}@{SSH_PROXY_URL}"
    console.print(f"[bold blue]Running command: [cyan]{ssh_command}[/cyan][/bold blue]")

    # Execute the SSH command
    os.system(ssh_command)


def ssh_command_listing(console: Console):
    """If no instance is provided, this command interactively
    lists all the options you have and then once you select one
    it runs the command above."""
    # Fetch available clusters from API
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching instances...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        resp = api_request("GET", "/instances/status", auth_needed=True)

    resp_json = resp.json()
    # The API returns { clusters: [...] } - use the correct field
    clusters = resp_json.get("clusters", [])
    if not clusters:
        console.print("[yellow]No instances found.[/yellow]")
        return

    console.print("[bold blue]Available Transformer Lab Instances[/bold blue]")
    for idx, cluster in enumerate(clusters, start=1):
        cluster_name = cluster.get("cluster_name", str(cluster))
        status = cluster.get("status", "")
        # Clean up status (remove "ClusterStatus." prefix if present)
        if status and "ClusterStatus." in status:
            status = status.replace("ClusterStatus.", "")
        console.print(f"{idx}. [cyan]{cluster_name}[/cyan] - Status: {status}")

    choice = console.input(
        "[bold yellow]Select an instance by number (or type 'q' to cancel): [/bold yellow]"
    )

    if choice.lower() == "q":
        console.print("[bold red]Operation cancelled.[/bold red]")
        return

    try:
        instance_index = int(choice) - 1
        if 0 <= instance_index < len(clusters):
            display_name = clusters[instance_index].get(
                "cluster_name", str(clusters[instance_index])
            )
            ssh_command(console, display_name)
        else:
            console.print("[bold red]Invalid selection.[/bold red]")
    except ValueError:
        console.print("[bold red]Please enter a valid number.[/bold red]")
