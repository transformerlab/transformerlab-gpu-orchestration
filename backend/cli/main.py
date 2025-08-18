#!/usr/bin/env python3
"""
Transformer Lab CLI - A beautiful command line interface for Transformer Lab
"""

import sys
from typing import Optional

from commands.ssh import ssh_command
from commands.node_pools import list_node_pools_command
from commands.login import login_command, status
from commands.instances import list_instances_command, request_instance_command
import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box

import os


# Create Typer app
app = typer.Typer(
    help="Transformer Lab CLI",
    add_completion=False,
    no_args_is_help=True,  # Ensure help is shown when no command is provided
)

# Rich console for beautiful output
console = Console()

# Set a default API base URL if not already set
os.environ.setdefault("TLAB_API_BASE_URL", "http://localhost:8000")

# Subcommands for different functionalities
instances_app = typer.Typer(help="Manage your Transformer Lab instances")
node_pools_app = typer.Typer(help="Manage your node pools")
app.add_typer(instances_app, name="instances")
app.add_typer(node_pools_app, name="node-pools")

# Create login subcommand group
login_app = typer.Typer(help="Login and authentication management")
app.add_typer(login_app, name="login")


def show_header():
    """Display a beautiful header for the CLI."""
    console.print()
    header = Text("Transformer Lab CLI", style="bold cyan")
    subheader = Text("Your AI infrastructure management tool", style="italic")
    console.print(
        Panel.fit(f"{header}\n{subheader}", border_style="bright_blue", box=box.ROUNDED)
    )
    console.print()


@login_app.callback(invoke_without_command=True)
def login_group(ctx: typer.Context, username: Optional[str] = None):
    """Login to your Transformer Lab account."""
    if ctx.invoked_subcommand is None:
        show_header()
        login_command(console, username)


@login_app.command("status")
def login_status():
    """Check your Transformer Lab login status."""
    show_header()
    user_info = status()

    if user_info:
        console.print("[bold green]✓ You are logged in[/bold green]")
        console.print(
            f"[bold]User:[/bold] {user_info['first_name']} {user_info['last_name']}"
        )
        console.print(f"[bold]Email:[/bold] {user_info['email']}")
        console.print(f"[bold]ID:[/bold] {user_info['id']}")
    else:
        console.print("[bold red]✗ You are not logged in[/bold red]")
        console.print("Run [bold]`lab login`[/bold] to authenticate.")


@instances_app.command("list")
def list_instances():
    """List all your Transformer Lab instances."""
    show_header()
    list_instances_command(console)


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
    request_instance_command(console, name, instance_type, region)


@node_pools_app.command("list")
def list_node_pools():
    """List all your node pools."""
    show_header()
    list_node_pools_command(console)


@app.command("ssh")
def ssh_to_instance(instance_name: str):
    """SSH into a specific instance."""
    show_header()
    ssh_command(console, instance_name)


if __name__ == "__main__":
    try:
        app()
    except KeyboardInterrupt:
        console.print("\n[yellow]Operation cancelled by user.[/yellow]")
        sys.exit(0)
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        sys.exit(1)
