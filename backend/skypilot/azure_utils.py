import os
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any

# Path to store Azure configuration
AZURE_CONFIG_FILE = Path.home() / ".azure" / "lattice_config.json"


def load_azure_config():
    """Load Azure configuration from file"""
    if not AZURE_CONFIG_FILE.exists():
        return {
            "subscription_id": "",
            "tenant_id": "",
            "client_id": "",
            "client_secret": "",
            "is_configured": False,
            "auth_method": "cli",  # Default to CLI auth
            "allowed_instance_types": [],
            "max_instances": 0,
        }

    try:
        with open(AZURE_CONFIG_FILE, "r") as f:
            config = json.load(f)
            config["is_configured"] = bool(config.get("subscription_id"))
            # Set defaults for new fields if they don't exist
            if "max_instances" not in config:
                config["max_instances"] = 0
            if "allowed_instance_types" not in config:
                config["allowed_instance_types"] = []
            return config
    except Exception as e:
        print(f"Error loading Azure config: {e}")
        return {
            "subscription_id": "",
            "tenant_id": "",
            "client_id": "",
            "client_secret": "",
            "is_configured": False,
            "allowed_instance_types": [],
            "max_instances": 0,
        }


def save_azure_config(
    subscription_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    allowed_instance_types: List[str],
    max_instances: int = 0,
):
    """Save Azure configuration to file"""
    # Load existing config to preserve the real credentials if the new ones are masked
    existing_config = load_azure_config()

    # If the provided credentials are masked (all asterisks), keep the existing real credentials
    if subscription_id and subscription_id.startswith("*") and len(subscription_id) > 0:
        subscription_id = existing_config.get("subscription_id", "")
    if tenant_id and tenant_id.startswith("*") and len(tenant_id) > 0:
        tenant_id = existing_config.get("tenant_id", "")
    if client_id and client_id.startswith("*") and len(client_id) > 0:
        client_id = existing_config.get("client_id", "")
    if client_secret and client_secret.startswith("*") and len(client_secret) > 0:
        client_secret = existing_config.get("client_secret", "")

    # Determine auth method
    auth_method = (
        "service_principal" if (tenant_id and client_id and client_secret) else "cli"
    )

    config = {
        "subscription_id": subscription_id,
        "tenant_id": tenant_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "allowed_instance_types": allowed_instance_types,
        "max_instances": max_instances,
        "auth_method": auth_method,
        "is_configured": bool(
            subscription_id
            and (auth_method == "cli" or (tenant_id and client_id and client_secret))
        ),
    }
    AZURE_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(AZURE_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    return config


def get_azure_config_for_display():
    """Get Azure configuration for display (with masked credentials)"""
    config = load_azure_config()
    # Create a copy for display with masked credentials
    display_config = config.copy()
    display_config["subscription_id"] = (
        "*" * len(config["subscription_id"]) if config["subscription_id"] else ""
    )
    display_config["tenant_id"] = (
        "*" * len(config["tenant_id"]) if config["tenant_id"] else ""
    )
    display_config["client_id"] = (
        "*" * len(config["client_id"]) if config["client_id"] else ""
    )
    display_config["client_secret"] = (
        "*" * len(config["client_secret"]) if config["client_secret"] else ""
    )
    return display_config


def test_azure_connection(
    subscription_id: str, tenant_id: str, client_id: str, client_secret: str
):
    """Test Azure connection with specific credentials"""
    try:
        # Check if this is CLI authentication (no service principal credentials)
        if not tenant_id or not client_id or not client_secret:
            # Use CLI authentication
            result = subprocess.run(
                ["az", "account", "show"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0
        else:
            # Use service principal authentication
            # Temporarily set the Azure credentials
            original_subscription = os.environ.get("AZURE_SUBSCRIPTION_ID")
            original_tenant = os.environ.get("AZURE_TENANT_ID")
            original_client = os.environ.get("AZURE_CLIENT_ID")
            original_secret = os.environ.get("AZURE_CLIENT_SECRET")

            os.environ["AZURE_SUBSCRIPTION_ID"] = subscription_id
            os.environ["AZURE_TENANT_ID"] = tenant_id
            os.environ["AZURE_CLIENT_ID"] = client_id
            os.environ["AZURE_CLIENT_SECRET"] = client_secret

            print(f"AZURE_SUBSCRIPTION_ID: {os.environ['AZURE_SUBSCRIPTION_ID']}")
            print(f"AZURE_TENANT_ID: {os.environ['AZURE_TENANT_ID']}")
            print(f"AZURE_CLIENT_ID: {os.environ['AZURE_CLIENT_ID']}")
            print(f"AZURE_CLIENT_SECRET: {os.environ['AZURE_CLIENT_SECRET']}")

            try:
                # Test the connection using Azure CLI with service principal
                result = subprocess.run(
                    [
                        "az",
                        "login",
                        "--service-principal",
                        "--username",
                        client_id,
                        "--password",
                        client_secret,
                        "--tenant",
                        tenant_id,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result.returncode == 0:
                    # Now test if we can access the subscription
                    result2 = subprocess.run(
                        ["az", "account", "show"],
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    return result2.returncode == 0
                return False
            finally:
                # Restore original credentials
                if original_subscription:
                    os.environ["AZURE_SUBSCRIPTION_ID"] = original_subscription
                else:
                    os.environ.pop("AZURE_SUBSCRIPTION_ID", None)
                if original_tenant:
                    os.environ["AZURE_TENANT_ID"] = original_tenant
                else:
                    os.environ.pop("AZURE_TENANT_ID", None)
                if original_client:
                    os.environ["AZURE_CLIENT_ID"] = original_client
                else:
                    os.environ.pop("AZURE_CLIENT_ID", None)
                if original_secret:
                    os.environ["AZURE_CLIENT_SECRET"] = original_secret
                else:
                    os.environ.pop("AZURE_CLIENT_SECRET", None)

    except Exception as e:
        print(f"Error testing Azure connection: {e}")
        return False


def verify_azure_setup():
    """Verify Azure setup by checking if Azure CLI is installed and authenticated"""
    try:
        # Check if Azure CLI is installed
        result = subprocess.run(
            ["az", "--version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return False

        # Check if user is logged in
        result = subprocess.run(
            ["az", "account", "show"], capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0

    except Exception as e:
        print(f"Error verifying Azure setup: {e}")
        return False


def verify_azure_cli_login():
    """Verify Azure CLI interactive login"""
    try:
        # Check if user is logged in via Azure CLI
        result = subprocess.run(
            ["az", "account", "show"], capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            # Parse the account info to get subscription
            account_info = json.loads(result.stdout)
            subscription_id = account_info.get("id")
            return True, subscription_id
        return False, None
    except Exception as e:
        print(f"Error verifying Azure CLI login: {e}")
        return False, None


def setup_azure_config():
    """Setup Azure configuration by ensuring Azure CLI is installed and user is logged in"""
    try:
        # Check if Azure CLI is installed
        result = subprocess.run(
            ["az", "--version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            raise Exception("Azure CLI is not installed. Please install it first.")

        # Check if user is logged in via CLI
        is_logged_in, subscription_id = verify_azure_cli_login()
        if not is_logged_in:
            raise Exception(
                "Azure CLI is not authenticated. Please run 'az login' first."
            )

        # Update config with current subscription from CLI
        config = load_azure_config()
        config["subscription_id"] = subscription_id
        config["is_configured"] = True
        config["auth_method"] = "cli"  # Mark as using CLI authentication
        save_azure_config(
            subscription_id,
            config.get("tenant_id", ""),
            config.get("client_id", ""),
            config.get("client_secret", ""),
            config.get("allowed_instance_types", []),
            config.get("max_instances", 0),
        )

        return True

    except Exception as e:
        print(f"Error setting up Azure config: {e}")
        raise


def get_azure_instance_types():
    """Get available Azure instance types"""
    try:
        # This is a simplified list of common Azure instance types
        # In a real implementation, you might want to query Azure API for available types
        instance_types = [
            "Standard_D2s_v3",
            "Standard_D4s_v3",
            "Standard_D8s_v3",
            "Standard_D16s_v3",
            "Standard_D32s_v3",
            "Standard_D64s_v3",
            "Standard_E2s_v3",
            "Standard_E4s_v3",
            "Standard_E8s_v3",
            "Standard_E16s_v3",
            "Standard_E32s_v3",
            "Standard_E64s_v3",
            "Standard_NC6s_v3",
            "Standard_NC12s_v3",
            "Standard_NC24s_v3",
            "Standard_NC24rs_v3",
            "Standard_ND6s",
            "Standard_ND12s",
            "Standard_ND24s",
            "Standard_ND24rs",
            "Standard_NV6",
            "Standard_NV12",
            "Standard_NV24",
            "Standard_NV48",
        ]
        return instance_types
    except Exception as e:
        print(f"Error getting Azure instance types: {e}")
        return []


def create_azure_sky_yaml(
    cluster_name: str,
    command: str,
    setup: str = None,
    instance_type: str = None,
    region: str = None,
    zone: str = None,
    use_spot: bool = False,
    idle_minutes_to_autostop: int = None,
):
    """Create a SkyPilot YAML configuration for Azure cluster"""
    config = load_azure_config()

    yaml_content = f"""# SkyPilot YAML for Azure cluster
name: {cluster_name}

resources:
  cloud: azure
"""

    if instance_type:
        yaml_content += f"  instance_type: {instance_type}\n"

    if region:
        yaml_content += f"  region: {region}\n"

    if zone:
        yaml_content += f"  zone: {zone}\n"

    if use_spot:
        yaml_content += "  use_spot: true\n"

    if idle_minutes_to_autostop:
        yaml_content += f"  idle_minutes_to_autostop: {idle_minutes_to_autostop}\n"

    yaml_content += f"""
setup: |
  # Azure cluster setup
  {setup or "# No additional setup required"}

run: |
  {command}
"""

    return yaml_content
