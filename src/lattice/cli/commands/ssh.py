import time
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import box


def ssh_command(console: Console, instance_name: str):
    """SSH into a specific instance."""
    console.print("[bold blue]SSH into Transformer Lab instance[/bold blue]")
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
