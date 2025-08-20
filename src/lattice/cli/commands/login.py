import os
import time
import webbrowser
import json
from typing import Optional, Dict, Union

import requests


from lattice.cli.util.api import BACKEND_URL
from lattice.cli.util.auth import save_api_key, get_saved_api_key, api_request
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.prompt import Prompt


# Enable debug mode
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"


def debug_print(console, message):
    """Print debug information if DEBUG is enabled."""
    if DEBUG:
        console.print(f"[dim][DEBUG] {message}[/dim]")


def login_command(console: Console, username: Optional[str] = None):
    """Login to your Transformer Lab account."""
    console.print("[bold blue]Login to your Transformer Lab account[/bold blue]")

    # Debug: Print backend URL
    debug_print(console, f"Using backend URL: {BACKEND_URL}")

    # Check if we already have an API key
    current_api_key = get_saved_api_key()

    # Step 1: Start the CLI authorization flow
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Initiating login process...[/bold blue]"),
        transient=True if not DEBUG else False,  # Don't hide progress if debugging
    ) as progress:
        progress.add_task("", total=None)
        try:
            auth_url = f"{BACKEND_URL}/auth/cli/start"
            debug_print(console, f"Making POST request to: {auth_url}")

            # Get machine information
            import socket
            import getpass

            hostname = socket.gethostname()
            username = getpass.getuser()
            debug_print(
                console, f"Machine info - Username: {username}, Hostname: {hostname}"
            )

            # Send the current API key and machine info
            auth_data = {"username": username, "hostname": hostname}

            if current_api_key:
                auth_data["api_key"] = current_api_key
                debug_print(console, "Sending existing API key for validation")

            response = api_request(
                "POST", "/auth/cli/start", json_data=auth_data, auth_needed=False
            )

            # Debug response details
            debug_print(console, f"Response status: {response.status_code}")
            debug_print(
                console,
                f"Response headers: {json.dumps(dict(response.headers), indent=2)}",
            )

            try:
                debug_print(console, f"Response content: {response.text[:1000]}")
            except Exception as e:
                debug_print(console, f"Error printing response content: {str(e)}")

            response.raise_for_status()
            data = response.json()
            debug_print(console, f"Parsed JSON data: {json.dumps(data, indent=2)}")

            # Check if API key was valid
            if data.get("status") == "success":
                console.print(
                    "\n[bold green]✓[/bold green] API key is valid, you are already logged in."
                )
                return

            # Get web authorization details
            if data.get("status") != "pending" or "authorization_url" not in data:
                console.print("[bold red]Error: Unexpected response format[/bold red]")
                return

            authorization_url = data["authorization_url"]
            session_id = data["session_id"]
            interval = data["interval"]

            debug_print(console, f"Got authorization_url: {authorization_url}")
            debug_print(console, f"Got session_id: {session_id}")
            debug_print(console, f"Got polling interval: {interval}")

        except requests.RequestException as e:
            console.print(
                f"[bold red]Error starting login process: {str(e)}[/bold red]"
            )
            if DEBUG and hasattr(e, "response") and e.response:
                debug_print(console, f"Error response status: {e.response.status_code}")
                debug_print(
                    console, f"Error response content: {e.response.text[:1000]}"
                )
            return

    # Step 2: Open the browser for authorization
    console.print("\n[bold blue]Opening your browser to complete login...[/bold blue]")
    debug_print(console, f"Opening browser at URL: {authorization_url}")
    webbrowser.open(authorization_url)

    # Step 3: Poll for authorization completion
    console.print("\n[dim]Waiting for authorization to complete in browser...[/dim]")
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Waiting for authorization confirmation...[/bold blue]"),
        transient=False,
    ) as progress:
        progress.add_task("", total=None)

        poll_count = 0
        debug_print(console, f"Will poll URL: {BACKEND_URL}/auth/cli/poll")

        while True:
            try:
                time.sleep(interval)
                poll_count += 1
                debug_print(console, f"Poll attempt #{poll_count}")

                poll_data = {"session_id": session_id}
                debug_print(console, f"Sending data: {json.dumps(poll_data)}")

                poll_response = api_request(
                    "POST", "/auth/cli/poll", json_data=poll_data, auth_needed=False
                )

                debug_print(
                    console, f"Poll response status: {poll_response.status_code}"
                )
                if poll_response.text:
                    debug_print(
                        console, f"Poll response content: {poll_response.text[:1000]}"
                    )

                if poll_response.status_code == 200:
                    # Success - we got the API key
                    result = poll_response.json()
                    debug_print(
                        console, f"Success response: {json.dumps(result, indent=2)}"
                    )

                    if result.get("status") != "success" or "api_key" not in result:
                        console.print(
                            "[bold red]Error: Invalid response format[/bold red]"
                        )
                        return

                    # Save the API key
                    api_key_data = result["api_key"]
                    debug_print(console, "Saving API key to ~/.lab/cli/credentials")
                    save_api_key(api_key_data)
                    break

                elif poll_response.status_code == 202:
                    # Still waiting
                    debug_print(console, "Still waiting for authorization...")
                    continue
                else:
                    # Error
                    console.print(
                        f"[bold red]Authorization failed or timed out. Status: {poll_response.status_code}[/bold red]"
                    )
                    debug_print(console, f"Error response: {poll_response.text}")
                    return

            except requests.RequestException as e:
                console.print(
                    f"[bold red]Error communicating with server: {str(e)}[/bold red]"
                )
                debug_print(console, f"Exception details: {str(e)}")
                return

    console.print(
        "\n[bold green]✓[/bold green] Successfully logged in to Transformer Lab"
    )
    console.print("[dim]Your API key has been saved.[/dim]")


def logout_command(console: Console):
    """Logout from your Transformer Lab account by deleting the saved API key."""
    console.print("[bold blue]Logging out of your Transformer Lab account[/bold blue]")

    # Check if we have an API key to delete
    current_api_key = get_saved_api_key()

    if not current_api_key:
        console.print("[bold yellow]⚠[/bold yellow] You are not currently logged in.")
        return

    # Ask for confirmation before proceeding
    confirm = Prompt.ask(
        "[bold yellow]Are you sure you want to log out? This will delete your saved API key (yes/no)[/bold yellow]",
        choices=["yes", "no"],
        default="no",
    )

    if confirm.lower() != "yes":
        console.print("[bold yellow]Logout cancelled.[/bold yellow]")
        return

    try:
        # Delete the API key from storage
        import os
        from pathlib import Path

        # Get the credentials file path (same as used in save_api_key)
        credentials_dir = Path.home() / ".lab" / "cli"
        credentials_file = credentials_dir / "credentials"

        if credentials_file.exists():
            credentials_file.unlink()  # Delete the file
            console.print("[bold green]✓[/bold green] Successfully logged out.")
            console.print("[dim]Your API key has been deleted.[/dim]")
        else:
            console.print("[bold yellow]⚠[/bold yellow] No credentials file found.")

    except Exception as e:
        console.print(f"[bold red]Error during logout: {str(e)}[/bold red]")
        debug_print(console, f"Logout error details: {str(e)}")
