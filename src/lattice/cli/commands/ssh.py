import os
from pathlib import Path
from lattice.cli.util.auth import api_request
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn


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
        response = api_request("GET", f"/ssh-config/{instance_name}")
        data = response.json()

        # Print the the instance name which is at data['instance_name']
        console.print(
            f"[bold blue]Instance Name: [cyan]{data['instance_name']}[/cyan][/bold blue]"
        )

        ssh_config = data.get("ssh_config")
        # ssh_config is json from which we can get the Host and User:
        ssh_host = ssh_config.get("Host")
        ssh_user = ssh_config.get("User")

        # console.print(f"[bold blue]SSH Host: [cyan]{ssh_host}[/cyan][/bold blue]")
        # console.print(f"[bold blue]SSH User: [cyan]{ssh_user}[/cyan][/bold blue]")

        # Now grab the raw_config part of data and save it to a temporary place in
        # ~/.lab/ssh/<instance_name>/config
        config_dir = Path.home() / ".lab" / "ssh" / instance_name
        config_dir.mkdir(parents=True, exist_ok=True)

        # Now grab the Identity file from identity_file_content and save it near the config:
        identity_file = data.get("identity_file_content")
        if identity_file:
            with open(config_dir / "ssh_key", "w") as f:
                f.write(identity_file)
            # Set the appropriate permissions
            os.chmod(config_dir / "ssh_key", 0o600)

        ssh_config = data.get("raw_config")
        # Edit the config so that the line that looks like:
        #   IdentityFile /Users/ali/.sky/clients/ac345ac0/ssh/sky-key
        # gets rewritten to the path of the new ssh_key file we just wrote above
        if ssh_config:
            # ssh_config = "\n".join(
            #     line
            #     if not line.strip().startswith("IdentityFile")
            #     else f"IdentityFile {config_dir / 'ssh_key'}"
            #     for line in ssh_config.splitlines()
            # )
            with open(config_dir / "config", "w") as f:
                f.write(ssh_config)

        console.print("[bold green]✓[/bold green] SSH configuration saved.")
        console.print("[bold blue]Connecting directly to your instance:[/bold blue]")

        # Print out the command so the user can use it later:
        console.print(
            f"[bold blue]SSH Command:[/bold blue] ssh -F {config_dir / 'config'} -i {config_dir / 'ssh_key'} {ssh_user}@{ssh_host}"
        )

        # Run ssh directly for the user
        ssh_command = [
            "ssh",
            "-F",
            str(config_dir / "config"),
            "-i",
            str(config_dir / "ssh_key"),
            f"{ssh_user}@{ssh_host}",
        ]
        os.execvp("ssh", ssh_command)


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
