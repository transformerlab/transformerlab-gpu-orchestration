import time
import os
from lattice.cli.util.auth import api_request
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich import box
from rich.prompt import Confirm, Prompt


def list_instances_command(console: Console):
    console.print("[bold blue]Your Transformer Lab instances[/bold blue]")

    """List all your Transformer Lab instances."""
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching instances...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        resp = api_request("GET", "/instances/status", auth_needed=True)

    # convert response object to json:
    resp_json = resp.json()

    # Parse the response
    clusters = resp_json.get("clusters", [])
    if not clusters:
        console.print("[yellow]No instances found.[/yellow]")
        return

    # Create a table with instance data
    table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("Name", style="dim")
    table.add_column("Status", justify="center")
    table.add_column("Launched At", justify="center")
    table.add_column("Last Use", justify="center")
    table.add_column("Autostop", justify="center")
    table.add_column("User", justify="center")

    for cluster in clusters:
        cluster_name = cluster.get("cluster_name") or "-"
        status = (
            cluster.get("status").replace("ClusterStatus.", "")
            if cluster.get("status")
            else "-"
        )
        launched_at = (
            time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(cluster.get("launched_at"))
            )
            if cluster.get("launched_at")
            else "-"
        )
        last_use = cluster.get("last_use") or "-"
        autostop = (
            str(cluster.get("autostop"))
            if cluster.get("autostop") != -1
            else "Disabled"
        )
        user_info = cluster.get("user_info") or {}
        user_name = user_info.get("name", "-")
        user_email = user_info.get("email", "-")
        user_display = f"{user_name} ({user_email})"

        table.add_row(
            cluster_name,
            status,
            launched_at,
            last_use,
            autostop,
            user_display,
        )

    console.print(table)
    console.print(f"[dim]Total instances: {len(clusters)}[/dim]")


def start_instance_command(console: Console, yaml_file_path: str):
    """Start a new lab instance using a YAML configuration file."""
    console.print(
        f"[bold blue]Starting lab instance with configuration: [cyan]{yaml_file_path}[/cyan][/bold blue]"
    )

    # Check if file exists
    if not os.path.exists(yaml_file_path):
        console.print(
            f"[bold red]Error:[/bold red] File '{yaml_file_path}' does not exist."
        )
        return

    # Check if file is a YAML file
    if not yaml_file_path.lower().endswith((".yaml", ".yml")):
        console.print(
            f"[bold red]Error:[/bold red] File '{yaml_file_path}' is not a YAML file (.yaml or .yml extension required)."
        )
        return

    # Show file info
    file_info = Panel(
        f"File: {yaml_file_path}\nSize: {os.path.getsize(yaml_file_path)} bytes",
        title="Configuration File",
        border_style="blue",
    )
    console.print(file_info)

    # Confirm the launch
    if not Confirm.ask(
        "[yellow]Launch instance with this configuration?[/yellow]", default=True
    ):
        console.print("[yellow]Launch cancelled.[/yellow]")
        return

    # Show progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Launching instance...[/bold blue]"),
        transient=False,
    ) as progress:
        task = progress.add_task("", total=100)

        try:
            # Prepare the multipart form data
            with open(yaml_file_path, "rb") as yaml_file:
                files = {
                    "yaml_file": (
                        os.path.basename(yaml_file_path),
                        yaml_file,
                        "application/x-yaml",
                    )
                }

                # Make the API request
                progress.update(task, completed=50)
                resp = api_request(
                    "POST", "/instances/launch", auth_needed=True, files=files
                )
                progress.update(task, completed=100)

            if resp.status_code == 200:
                resp_data = resp.json()
                console.print(
                    "[bold green]✓[/bold green] Instance launched successfully!"
                )
                console.print(
                    f"[bold]Cluster Name:[/bold] {resp_data.get('cluster_name', 'N/A')}"
                )
                console.print(f"[bold]Status:[/bold] {resp_data.get('status', 'N/A')}")
                if "message" in resp_data:
                    console.print(f"[bold]Message:[/bold] {resp_data['message']}")
            else:
                console.print("[bold red]✗[/bold red] Failed to launch instance.")
                console.print(f"[bold]Status Code:[/bold] {resp.status_code}")
                try:
                    error_data = resp.json()
                    console.print(
                        f"[bold]Error:[/bold] {error_data.get('detail', 'Unknown error')}"
                    )
                except Exception:
                    console.print(f"[bold]Error:[/bold] {resp.text}")

        except Exception as e:
            console.print(f"[bold red]✗[/bold red] Error launching instance: {str(e)}")


def request_instance_command(console, name, instance_type, region):
    console.print(
        f"[bold blue]Requesting a new instance: [cyan]{name}[/cyan][/bold blue]"
    )

    # Show configuration
    config_table = Table(show_header=False, box=box.SIMPLE)
    config_table.add_column("Property", style="bold")
    config_table.add_column("Value")

    config_table.add_row("Name", name)
    config_table.add_row("Instance Type", instance_type)
    config_table.add_row("Region", region)

    console.print(Panel(config_table, title="Configuration", border_style="blue"))

    # Confirm the request
    if not Confirm.ask("[yellow]Confirm request?[/yellow]", default=True):
        console.print("[yellow]Request canceled.[/yellow]")
        return

    # Show progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Creating instance...[/bold blue]"),
        transient=False,
    ) as progress:
        task = progress.add_task("", total=100)
        # Simulate creation process with progress
        for i in range(0, 101, 5):
            progress.update(task, completed=i)
            time.sleep(0.2)

    console.print(
        "[bold green]✓[/bold green] Instance [cyan]{}[/cyan] created successfully!".format(
            name
        )
    )
    console.print("[dim]You can connect to it using: tlab ssh {}[/dim]".format(name))
    if not Confirm.ask("[yellow]Confirm request?[/yellow]", default=True):
        console.print("[yellow]Request canceled.[/yellow]")
        return

    # Show progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Creating instance...[/bold blue]"),
        transient=False,
    ) as progress:
        task = progress.add_task("", total=100)
        # Simulate creation process with progress
        for i in range(0, 101, 5):
            progress.update(task, completed=i)
            time.sleep(0.2)

    console.print(
        "[bold green]✓[/bold green] Instance [cyan]{}[/cyan] created successfully!".format(
            name
        )
    )
    console.print("[dim]You can connect to it using: tlab ssh {}[/dim]".format(name))


def destroy_instance_command(console: Console, cluster_name: Optional[str]):
    """Destroy (terminate) a lab instance by calling the /instances/down route.

    If cluster_name is not provided, show a list of instances and prompt the user to select one.
    """
    # Fetch instances to validate/choose from
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching instances...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        resp = api_request("GET", "/instances/status", auth_needed=True)

    try:
        resp_json = resp.json()
    except Exception:
        resp_json = {}

    # The API returns { clusters: [...] }
    clusters = resp_json.get("clusters") or resp_json.get(
        "node-pools/ssh-node-pools", []
    )

    if not clusters:
        console.print("[yellow]No instances found to destroy.[/yellow]")
        return

    # Helper to extract display name
    def _get_name(c):
        return c.get("cluster_name") or c.get("name") or "-"

    # If name not provided, prompt interactively
    selected_name = None
    if not cluster_name:
        table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
        table.add_column("#", justify="right")
        table.add_column("Name")
        table.add_column("Status", justify="center")
        for idx, c in enumerate(clusters, start=1):
            status = c.get("status") or "-"
            status = (
                status.replace("ClusterStatus.", "")
                if isinstance(status, str)
                else status
            )
            table.add_row(str(idx), _get_name(c), status)
        console.print(
            Panel(table, title="Select an instance to destroy", border_style="red")
        )

        while True:
            choice = Prompt.ask(
                "Enter the number of the instance to destroy", default="1"
            )
            try:
                index = int(choice)
                if 1 <= index <= len(clusters):
                    selected_name = _get_name(clusters[index - 1])
                    break
            except Exception:
                pass
            console.print("[red]Invalid selection. Please enter a valid number.[/red]")
    else:
        selected_name = cluster_name

    if not selected_name or selected_name == "-":
        console.print("[red]Invalid cluster name.[/red]")
        return

    # Confirm destructive action
    if not Confirm.ask(
        f"[yellow]Are you sure you want to destroy [bold red]{selected_name}[/bold red]? This will delete all resources.[/yellow]",
        default=False,
    ):
        console.print("[yellow]Destroy cancelled.[/yellow]")
        return

    # Call the down endpoint
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Destroying instance...[/bold blue]"),
        transient=False,
    ) as progress:
        task = progress.add_task("", total=100)
        try:
            progress.update(task, completed=30)
            resp = api_request(
                "POST",
                "/instances/down",
                auth_needed=True,
                json_data={"cluster_name": selected_name},
            )
            progress.update(task, completed=100)

            if resp.status_code == 200:
                data = resp.json()
                console.print("[bold green]✓[/bold green] Destroy initiated.")
                msg = (
                    data.get("message")
                    or f"Cluster '{selected_name}' termination initiated successfully"
                )
                console.print(f"[bold]Message:[/bold] {msg}")
                if data.get("request_id"):
                    console.print(f"[dim]Request ID: {data['request_id']}[/dim]")
            else:
                console.print("[bold red]✗[/bold red] Failed to destroy instance.")
                console.print(f"[bold]Status Code:[/bold] {resp.status_code}")
                try:
                    error_data = resp.json()
                    console.print(
                        f"[bold]Error:[/bold] {error_data.get('detail', 'Unknown error')}"
                    )
                except Exception:
                    console.print(f"[bold]Error:[/bold] {resp.text}")
        except Exception as e:
            console.print(f"[bold red]✗[/bold red] Error destroying instance: {str(e)}")


def info_instance_command(console: Console, cluster_name: str):
    """Get comprehensive information about a specific cluster instance."""
    console.print(f"[bold blue]Getting info for cluster: [cyan]{cluster_name}[/cyan][/bold blue]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching cluster info...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        resp = api_request("GET", f"/instances/{cluster_name}/info", auth_needed=True)

    try:
        data = resp.json()
    except Exception:
        data = {}

    if resp.status_code != 200:
        console.print(f"[bold red]✗[/bold red] Failed to get cluster info.")
        console.print(f"[bold]Status Code:[/bold] {resp.status_code}")
        try:
            error_data = resp.json()
            console.print(f"[bold]Error:[/bold] {error_data.get('detail', 'Unknown error')}")
        except Exception:
            console.print(f"[bold]Error:[/bold] {resp.text}")
        return

    # Extract the data we want (excluding available operations and SSH node info)
    cluster = data.get("cluster", {})
    platform = data.get("platform", {})
    cluster_state = data.get("state")
    jobs = data.get("jobs", [])

    # Display basic cluster information
    console.print(f"\n[bold]Cluster:[/bold] {cluster.get('cluster_name', cluster_name)}")

    # Clean up status (remove "ClusterStatus." prefix)
    status = cluster.get('status', 'Unknown')
    if status and 'ClusterStatus.' in status:
        status = status.replace('ClusterStatus.', '')
    console.print(f"[bold]Status:[/bold] {status}")

    console.print(f"[bold]State:[/bold] {cluster_state or 'Unknown'}")

    if cluster.get('launched_at'):
        # Try to format timestamp if it's a number
        launched_at = cluster['launched_at']
        if isinstance(launched_at, (int, float)):
            try:
                import time
                launched_at = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(launched_at))
            except:
                pass  # Keep original format if formatting fails
        console.print(f"[bold]Launched:[/bold] {launched_at}")

    if cluster.get('last_use'):
        last_use = cluster['last_use']
        # Skip if it looks like a file path
        if not (isinstance(last_use, str) and last_use.startswith('./')):
            console.print(f"[bold]Last Use:[/bold] {last_use}")

    if cluster.get('autostop') is not None:
        autostop_val = cluster['autostop']
        autostop_display = str(autostop_val) if autostop_val != -1 else "Disabled"
        console.print(f"[bold]Autostop:[/bold] {autostop_display}")

    if cluster.get('resources_str'):
        console.print(f"[bold]Resources:[/bold] {cluster['resources_str']}")

    if cluster.get('user_info'):
        user_info = cluster['user_info']
        user_name = user_info.get('name', 'Unknown')
        user_email = user_info.get('email', 'Unknown')
        console.print(f"[bold]User:[/bold] {user_name} ({user_email})")

    # Display platform information
    if platform:
        console.print(f"\n[bold]Platform:[/bold]")
        if isinstance(platform, dict):
            if platform.get('platform'):
                console.print(f"  [dim]Provider:[/dim] {platform['platform']}")
            if platform.get('region'):
                console.print(f"  [dim]Region:[/dim] {platform['region']}")
            if platform.get('zone'):
                console.print(f"  [dim]Zone:[/dim] {platform['zone']}")
            if platform.get('user_id'):
                console.print(f"  [dim]Owner ID:[/dim] {platform['user_id']}")
        elif isinstance(platform, str):
            console.print(f"  [dim]Provider:[/dim] {platform}")

    # Display jobs information
    if jobs:
        console.print(f"\n[bold]Jobs:[/bold] {len(jobs)} total")

        # Create a table for jobs
        job_table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
        job_table.add_column("Job ID", style="dim", max_width=12)
        job_table.add_column("Name", max_width=20)
        job_table.add_column("Status", justify="center")
        job_table.add_column("Submitted", justify="center")
        job_table.add_column("Username", max_width=15)

        for job in jobs:
            job_id = str(job.get('job_id', 'N/A'))[:12]  # Truncate long IDs and convert to string
            job_name = job.get('job_name', 'N/A')

            # Clean up status (remove "JobStatus." prefix)
            status = job.get('status', 'Unknown')
            if status and 'JobStatus.' in status:
                status = status.replace('JobStatus.', '')

            # Format submitted timestamp
            submitted = job.get('submitted_at', 'N/A')
            if isinstance(submitted, (int, float)):
                try:
                    import time
                    submitted = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(submitted))
                except:
                    submitted = str(submitted)[:19]  # Truncate if formatting fails

            username = job.get('username', 'N/A')

            job_table.add_row(job_id, job_name, status, submitted, username)

        console.print(job_table)
    else:
        console.print(f"\n[bold]Jobs:[/bold] No jobs found")

    console.print(f"\n[dim]Info retrieved successfully for cluster '{cluster_name}'[/dim]")
