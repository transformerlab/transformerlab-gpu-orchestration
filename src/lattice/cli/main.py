#!/usr/bin/env python3
"""
Transformer Lab CLI - A beautiful command line interface for Transformer Lab
"""

import sys
from typing import Optional

from lattice.cli.commands.ssh import ssh_command_listing, ssh_command
from lattice.cli.util.common import show_header
from lattice.cli.util.auth import status

# from lattice.cli.commands.ssh import ssh_command
from lattice.cli.commands.node_pools import list_node_pools_command
from lattice.cli.commands.login import login_command, logout_command
from lattice.cli.commands.instances import (
    list_instances_command,
    start_instance_command,
    destroy_instance_command,
    info_instance_command,
)
import typer
from rich.console import Console

import os


# Create Typer app
app = typer.Typer(
    name="lab",
    help="Transformer Lab CLI - Manage and interact with your AI models",
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


@app.command("logout")
def login_logout():
    """Logout from your Transformer Lab account."""
    show_header()
    logout_command(console)


@instances_app.command("list")
def list_instances():
    """List all your Transformer Lab instances."""
    list_instances_command(console)


@instances_app.command("request")
def start_instance(
    yaml_file: str = typer.Argument(..., help="Path to YAML configuration file"),
):
    """Start a new lab instance using a YAML configuration file."""
    start_instance_command(console, yaml_file)


@instances_app.command("destroy")
def destroy_instance(
    cluster_name: Optional[str] = typer.Argument(
        None, help="Cluster name to destroy. If omitted, you'll be prompted to select."
    ),
):
    """Destroy (terminate) a lab instance."""
    destroy_instance_command(console, cluster_name)


@instances_app.command("info")
def info_instance(
    instance_name: str = typer.Argument(..., help="Name of the instance to get information about"),
):
    """Get comprehensive information about a specific instance."""
    info_instance_command(console, instance_name)


@node_pools_app.command("list")
def list_node_pools():
    """List all your node pools."""
    list_node_pools_command(console)


@app.command("ssh")
def ssh_to_instance(instance_name: Optional[str] = typer.Argument(None)):
    """SSH into a specific instance, or say hello world if no instance is provided."""
    show_header()
    if instance_name is None:
        ssh_command_listing(console)
    else:
        ssh_command(console, instance_name)


@app.command()
def hello(name: Optional[str] = None):
    show_header()
    """Say hello to the user."""
    if name:
        typer.echo(f"Hello {name}!")
    else:
        typer.echo("Hello from Transformer Lab!")


@app.command()
def version():
    """Show the version of the CLI."""
    typer.echo("Transformer Lab CLI v0.1.0")


if __name__ == "__main__":
    try:
        app()
    except KeyboardInterrupt:
        console.print("\n[yellow]Operation cancelled by user.[/yellow]")
        sys.exit(0)
    except Exception as e:
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        sys.exit(1)
