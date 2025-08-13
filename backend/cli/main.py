#!/usr/bin/env python3
"""
Transformer Lab CLI - A beautiful command line interface for Transformer Lab
"""

import sys
import time
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.text import Text
from rich import box
from rich.prompt import Prompt, Confirm

import os
import openapi_client
from openapi_client.api import default_api

# Create Typer app
app = typer.Typer(
    help="Transformer Lab CLI",
    add_completion=False,
)

# Rich console for beautiful output
console = Console()

# Set a default API base URL if not already set
os.environ.setdefault("TLAB_API_BASE_URL", "http://localhost:8000")
ACCESS_TOKEN = os.getenv("TLAB_API_ACCESS_TOKEN", "your_access_token_here")

# Subcommands for different functionalities
instances_app = typer.Typer(help="Manage your Transformer Lab instances")
node_pools_app = typer.Typer(help="Manage your node pools")
app.add_typer(instances_app, name="instances")
app.add_typer(node_pools_app, name="node-pools")


def show_header():
    """Display a beautiful header for the CLI."""
    console.print()
    header = Text("Transformer Lab CLI", style="bold cyan")
    subheader = Text("Your AI infrastructure management tool", style="italic")
    console.print(
        Panel.fit(f"{header}\n{subheader}", border_style="bright_blue", box=box.ROUNDED)
    )
    console.print()


@app.command("login")
def login(username: Optional[str] = None):
    """Login to your Transformer Lab account."""
    show_header()
    console.print("[bold blue]Login to your Transformer Lab account[/bold blue]")

    if not username:
        username = Prompt.ask("[yellow]Username[/yellow]")

    # Password input (in real app this would be hidden)
    password = Prompt.ask("[yellow]Password[/yellow]", password=True)

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Authenticating...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        # Simulate authentication process
        time.sleep(2)

    console.print(
        "[bold green]✓[/bold green] Successfully logged in as [bold]{0}[/bold]".format(
            username
        )
    )
    console.print("[dim]Your authentication token has been saved.[/dim]")


@instances_app.command("list")
def list_instances():
    """List all your Transformer Lab instances."""
    show_header()
    console.print("[bold blue]Your Transformer Lab instances[/bold blue]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching instances...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        # Simulate fetching process
        time.sleep(1.5)

    # Create a table with instance data
    table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("Name", style="dim")
    table.add_column("Status", justify="center")
    table.add_column("Type", justify="center")
    table.add_column("Region", justify="center")
    table.add_column("IP Address", justify="center")
    table.add_column("Created", justify="center")

    # Add some sample data
    table.add_row(
        "llm-server-1",
        "[green]Running[/green]",
        "gpu-a100",
        "us-west-2",
        "192.168.1.101",
        "2 days ago",
    )
    table.add_row(
        "training-cluster",
        "[yellow]Starting[/yellow]",
        "gpu-h100",
        "us-east-1",
        "192.168.1.102",
        "1 hour ago",
    )
    table.add_row(
        "inference-api",
        "[red]Stopped[/red]",
        "cpu-large",
        "eu-central-1",
        "192.168.1.103",
        "5 days ago",
    )

    console.print(table)
    console.print("[dim]Total instances: 3[/dim]")


@instances_app.command("request")
def request_instance(
    name: str = typer.Option(..., help="Name of the instance"),
    instance_type: str = typer.Option(
        "gpu-a100", help="Type of instance (cpu, gpu-a100, gpu-h100)"
    ),
    region: str = typer.Option("us-west-2", help="Region to deploy the instance"),
):
    """Request a new Transformer Lab instance."""
    show_header()
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


@node_pools_app.command("list")
def list_node_pools():
    """List all your node pools."""
    show_header()
    console.print("[bold blue]Your Node Pools[/bold blue]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching node pools...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        try:
            base_url = os.getenv("TLAB_API_BASE_URL")
            config = (
                openapi_client.Configuration(host=base_url)
                if base_url
                else openapi_client.Configuration()
            )
            # Add the hardcoded Bearer token
            config.access_token = ACCESS_TOKEN
            with openapi_client.ApiClient(config) as api_client:
                api = default_api.DefaultApi(api_client)
                resp = api.list_node_pools_api_v1_skypilot_node_pools_get(
                    _request_timeout=10
                )
        except openapi_client.exceptions.ApiException as e:
            console.print(f"[bold red]API Error:[/bold red] {e}")
            return
        except Exception as e:
            console.print(f"[bold red]Error fetching node pools:[/bold red] {e}")
            return

    def _to_dict(obj):
        # Best-effort conversion to dict
        try:
            return obj.to_dict()
        except Exception:
            try:
                return obj.dict()
            except Exception:
                if isinstance(obj, dict):
                    return obj
                return getattr(obj, "__dict__", {"value": str(obj)})

    # Normalize response into a list of items
    items = []
    if isinstance(resp, (list, tuple)):
        items = list(resp)
    else:
        # Try common wrappers: items/data/node_pools
        rd = _to_dict(resp)
        items = rd.get("items") or rd.get("data") or rd.get("node_pools") or []
        if not isinstance(items, list):
            items = [items] if items else []

    # Create a table with node pool data
    table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("Name", style="dim")
    table.add_column("Nodes", justify="center")
    table.add_column("Type", justify="center")
    table.add_column("Provider", justify="center")
    table.add_column("Status", justify="center")

    def colorize_status(s: Optional[str]) -> str:
        if not s:
            return "-"
        sl = str(s).lower()
        if any(k in sl for k in ["active", "ready", "running", "up", "healthy"]):
            return f"[green]{s}[/green]"
        if any(k in sl for k in ["scal", "provision", "init", "pending", "creating"]):
            return f"[yellow]{s}[/yellow]"
        if any(
            k in sl for k in ["inactive", "stopp", "error", "fail", "down", "degrad"]
        ):
            return f"[red]{s}[/red]"
        return s

    count = 0
    for it in items:
        d = _to_dict(it)

        name = d.get("name") or d.get("id") or d.get("pool_name") or "-"
        ready = (
            d.get("ready_nodes")
            or d.get("ready")
            or d.get("nodes_ready")
            or d.get("available_nodes")
        )
        total = d.get("total_nodes") or d.get("nodes") or d.get("node_count")
        nodes = (
            f"{ready}/{total}"
            if (ready is not None and total is not None)
            else (str(total or ready) if (total or ready) is not None else "-")
        )

        type_ = (
            d.get("type")
            or d.get("instance_type")
            or d.get("accelerator")
            or d.get("machine_type")
            or "-"
        )
        provider = (
            d.get("provider") or d.get("cloud") or d.get("cluster_provider") or "-"
        )
        status = d.get("status") or d.get("state") or "-"

        table.add_row(
            str(name), str(nodes), str(type_), str(provider), colorize_status(status)
        )
        count += 1

    if count == 0:
        console.print("[yellow]No node pools found.[/yellow]")
        return

    console.print(table)
    console.print(f"[dim]Total node pools: {count}[/dim]")


@app.command("ssh")
def ssh_to_instance(instance_name: str):
    """SSH into a specific instance."""
    show_header()
    console.print(
        f"[bold blue]Connecting to instance: [cyan]{instance_name}[/cyan][/bold blue]"
    )

    # Show connection animation
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Establishing SSH connection...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        # Simulate connection process
        time.sleep(2)

    if instance_name == "training-cluster":
        console.print(
            "[yellow]Warning: This instance is still starting up. Connection might be unstable.[/yellow]"
        )
    elif instance_name == "inference-api":
        console.print("[red]Error: Cannot connect to stopped instance.[/red]")
        return

    console.print(
        "[bold green]✓[/bold green] Connected to [cyan]{}[/cyan]".format(instance_name)
    )
    console.print(
        Panel.fit(
            "[dim]In a real implementation, this would establish an actual SSH session.\n"
            "For this demo, we're just simulating the connection.[/dim]",
            border_style="dim",
            box=box.SIMPLE,
        )
    )


if __name__ == "__main__":
    try:
        app()
    except KeyboardInterrupt:
        console.print("\n[yellow]Operation cancelled by user.[/yellow]")
        sys.exit(0)
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        sys.exit(1)
