import os
from pathlib import Path
from lattice.cli.util.auth import api_request
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

SSH_PROXY_URL = os.getenv("TLAB_SSH_PROXY_URL", "localhost")


def ssh_command(console: Console, instance_name: str):
    """SSH into a specific instance."""
    console.print("[bold blue]SSH into Transformer Lab instance[/bold blue]")
    console.print(
        f"[bold blue]Connecting to instance: [cyan]{instance_name}[/cyan][/bold blue]"
    )

    # Simplified SSH command
    ssh_command = f"ssh -p 2222 {instance_name}@{SSH_PROXY_URL}"
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
    clusters = resp_json.get("clusters", [])
    if not clusters:
        console.print("[yellow]No instances found.[/yellow]")
        return

    console.print("[bold blue]Available Transformer Lab Instances[/bold blue]")
    for idx, cluster in enumerate(clusters, start=1):
        cluster_name = cluster.get("cluster_name", str(cluster))
        console.print(f"{idx}. [cyan]{cluster_name}[/cyan]")

    choice = console.input(
        "[bold yellow]Select an instance by number (or type 'q' to cancel): [/bold yellow]"
    )

    if choice.lower() == "q":
        console.print("[bold red]Operation cancelled.[/bold red]")
        return

    try:
        instance_index = int(choice) - 1
        if 0 <= instance_index < len(clusters):
            cluster_name = clusters[instance_index].get(
                "cluster_name", str(clusters[instance_index])
            )
            ssh_command(console, cluster_name)
        else:
            console.print("[bold red]Invalid selection.[/bold red]")
    except ValueError:
        console.print("[bold red]Please enter a valid number.[/bold red]")
