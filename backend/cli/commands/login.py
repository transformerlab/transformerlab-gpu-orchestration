import time
from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.prompt import Prompt


def login_command(console: Console, username: Optional[str] = None):
    """Login to your Transformer Lab account."""
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
