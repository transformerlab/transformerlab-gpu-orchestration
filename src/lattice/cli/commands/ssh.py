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


def ssh_command_listing(console: Console):
    """If no instance is provided, this command interactively
    lists all the options you have and then once you select one
    it runs the command above. in v1 have a fake list of
    "server1, server2, server3"""
    console.print("[bold blue]Available Transformer Lab Instances[/bold blue]")
    instances = ["server1", "server2", "server3"]
    for idx, instance in enumerate(instances, start=1):
        console.print(f"{idx}. [cyan]{instance}[/cyan]")

    choice = console.input(
        "[bold yellow]Select an instance by number (or type 'exit' to cancel): [/bold yellow]"
    )

    if choice.lower() == "exit":
        console.print("[bold red]Operation cancelled.[/bold red]")
        return

    try:
        instance_index = int(choice) - 1
        if 0 <= instance_index < len(instances):
            ssh_command(console, instances[instance_index])
        else:
            console.print("[bold red]Invalid selection.[/bold red]")
    except ValueError:
        console.print("[bold red]Please enter a valid number.[/bold red]")
