import time

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
