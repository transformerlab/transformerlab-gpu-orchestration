from typing import Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich import box

import openapi_client
from openapi_client.api import default_api

from util.api import TLAB_API_BASE_URL
from util.auth import get_saved_api_key


def list_node_pools_command(console: Console):
    console.print("[bold blue]Your Node Pools[/bold blue]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Fetching node pools...[/bold blue]"),
        transient=True,
    ) as progress:
        progress.add_task("", total=None)
        current_api_key = get_saved_api_key()

        try:
            base_url = TLAB_API_BASE_URL
            config = (
                openapi_client.Configuration(host=base_url)
                if base_url
                else openapi_client.Configuration()
            )
            # Add the hardcoded Bearer token
            config.access_token = current_api_key
            with openapi_client.ApiClient(config) as api_client:
                api = default_api.DefaultApi(api_client)
                resp = api.list_node_pools_api_v1_skypilot_node_pools_get(
                    _request_timeout=10
                )
        except openapi_client.exceptions.ApiException as e:
            console.print(f"[bold red]API Error:[/bold red] {e}")
            return
        except Exception as e:
            console.print(f"[bold red]Error fetching node pools:[/bold red] {e}")
            return

    def _to_dict(obj):
        # Best-effort conversion to dict
        try:
            return obj.to_dict()
        except Exception:
            try:
                return obj.dict()
            except Exception:
                if isinstance(obj, dict):
                    return obj
                return getattr(obj, "__dict__", {"value": str(obj)})

    # Normalize response into a list of items
    items = []
    if isinstance(resp, (list, tuple)):
        items = list(resp)
    else:
        # Try common wrappers: items/data/node_pools
        rd = _to_dict(resp)
        items = rd.get("items") or rd.get("data") or rd.get("node_pools") or []
        if not isinstance(items, list):
            items = [items] if items else []

    # Create a table with node pool data
    table = Table(show_header=True, header_style="bold magenta", box=box.ROUNDED)
    table.add_column("Name", style="dim")
    table.add_column("Nodes", justify="center")
    table.add_column("Type", justify="center")
    table.add_column("Provider", justify="center")
    table.add_column("Status", justify="center")

    def colorize_status(s: Optional[str]) -> str:
        if not s:
            return "-"
        sl = str(s).lower()
        if any(k in sl for k in ["active", "ready", "running", "up", "healthy"]):
            return f"[green]{s}[/green]"
        if any(k in sl for k in ["scal", "provision", "init", "pending", "creating"]):
            return f"[yellow]{s}[/yellow]"
        if any(
            k in sl for k in ["inactive", "stopp", "error", "fail", "down", "degrad"]
        ):
            return f"[red]{s}[/red]"
        return s

    count = 0
    for it in items:
        d = _to_dict(it)

        name = d.get("name") or d.get("id") or d.get("pool_name") or "-"
        ready = (
            d.get("ready_nodes")
            or d.get("ready")
            or d.get("nodes_ready")
            or d.get("available_nodes")
        )
        total = d.get("total_nodes") or d.get("nodes") or d.get("node_count")
        nodes = (
            f"{ready}/{total}"
            if (ready is not None and total is not None)
            else (str(total or ready) if (total or ready) is not None else "-")
        )

        type_ = (
            d.get("type")
            or d.get("instance_type")
            or d.get("accelerator")
            or d.get("machine_type")
            or "-"
        )
        provider = (
            d.get("provider") or d.get("cloud") or d.get("cluster_provider") or "-"
        )
        status = d.get("status") or d.get("state") or "-"

        table.add_row(
            str(name), str(nodes), str(type_), str(provider), colorize_status(status)
        )
        count += 1

    if count == 0:
        console.print("[yellow]No node pools found.[/yellow]")
        return

    console.print(table)
    console.print(f"[dim]Total node pools: {count}[/dim]")
