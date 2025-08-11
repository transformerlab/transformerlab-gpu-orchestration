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

# Create Typer app
app = typer.Typer(
    help="Transformer Lab CLI",
    add_completion=False,
)

# Rich console for beautiful output
console = Console()

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
        # Simulate fetching process
        time.sleep(1.5)

    # Create a table with node pool data
    table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("Name", style="dim")
    table.add_column("Nodes", justify="center")
    table.add_column("Type", justify="center")
    table.add_column("Provider", justify="center")
    table.add_column("Status", justify="center")

    # Add some sample data
    table.add_row("production-pool", "5/5", "A100", "AWS", "[green]Active[/green]")
    table.add_row("training-pool", "2/3", "H100", "Azure", "[yellow]Scaling[/yellow]")
    table.add_row("testing-pool", "0/2", "CPU", "GCP", "[red]Inactive[/red]")

    console.print(table)
    console.print("[dim]Total node pools: 3[/dim]")


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
