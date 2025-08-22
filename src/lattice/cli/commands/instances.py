import time
import os
from lattice.cli.util.auth import api_request

from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich import box
from rich.prompt import Confirm


def list_instances_command(console: Console):
    console.print("[bold blue]Your Transformer Lab instances[/bold blue]")

    """List all your Transformer Lab instances."""
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching instances...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        resp = api_request("GET", "/skypilot/status", auth_needed=True)

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
