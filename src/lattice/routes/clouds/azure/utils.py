import os
import json
import subprocess
from typing import List, Dict
from pathlib import Path

AZURE_CONFIG_FILE = Path.home() / ".azure" / "lattice_config.json"


def load_azure_config():
    """Load Azure configuration from file"""
    if not AZURE_CONFIG_FILE.exists():
        return {
            "configs": {},
            "default_config": None,
            "is_configured": False,
        }

    try:
        with open(AZURE_CONFIG_FILE, "r") as f:
            config = json.load(f)

            # Handle legacy format (single config)
            if "subscription_id" in config:
                # Convert legacy format to new format
                legacy_config = {
                    "name": config.get("name", "Default Azure Config"),
                    "subscription_id": config.get("subscription_id", ""),
                    "tenant_id": config.get("tenant_id", ""),
                    "client_id": config.get("client_id", ""),
                    "client_secret": config.get("client_secret", ""),
                    "allowed_instance_types": config.get("allowed_instance_types", []),
                    "allowed_regions": config.get("allowed_regions", []),
                    "max_instances": config.get("max_instances", 0),
                    "auth_method": "service_principal",
                }

                new_config = {
                    "configs": {"default": legacy_config},
                    "default_config": "default",
                    "is_configured": bool(config.get("subscription_id")),
                }

                # Save the new format
                save_azure_configs(new_config["configs"], new_config["default_config"])
                return new_config

            # New format with multiple configs
            config["is_configured"] = bool(
                config.get("default_config")
                and config.get("configs", {}).get(config["default_config"])
            )
            return config
    except Exception as e:
        print(f"Error loading Azure config: {e}")
        return {
            "configs": {},
            "default_config": None,
            "is_configured": False,
        }


def save_azure_configs(configs: Dict[str, Dict], default_config: str = None):
    """Save Azure configurations to file"""
    print("COMING INTO SAVE AZURE CONFIGS with configs: ", configs)
    config = {
        "configs": configs,
        "default_config": default_config,
        "is_configured": bool(default_config and configs.get(default_config)),
    }
    AZURE_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(AZURE_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    return config


def save_azure_config(
    name: str,
    subscription_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    allowed_instance_types: List[str],
    allowed_regions: List[str],
    max_instances: int = 0,
    config_key: str = None,
):
    """Save Azure configuration to file (legacy compatibility)"""
    config_data = load_azure_config()
    print("CONFIG DATA: ", config_data)

    # Create new config entry
    new_config = {
        "name": name,
        "subscription_id": subscription_id,
        "tenant_id": tenant_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "allowed_instance_types": allowed_instance_types,
        "allowed_regions": allowed_regions,
        "max_instances": max_instances,
        "auth_method": "service_principal",
    }

    # Generate the new config key based on the name
    new_config_key = name.lower().replace(" ", "_").replace("-", "_")

    # If config_key is provided, check if we're updating an existing config
    if config_key and config_key in config_data.get("configs", {}):
        # Check if the name has changed
        if config_key != new_config_key:
            # Name has changed, so we need to create a new config key and remove the old one
            # Remove the old config
            del config_data["configs"][config_key]

            # If this was the default config, update the default to the new key
            if config_data.get("default_config") == config_key:
                config_data["default_config"] = new_config_key

            # Add the new config with the new key
            config_data["configs"][new_config_key] = new_config
        else:
            # Name hasn't changed, just update the existing config
            config_data["configs"][config_key] = new_config
    else:
        # Create new config
        config_data["configs"][new_config_key] = new_config

    # If this is the first config, set it as default
    if not config_data["default_config"]:
        config_data["default_config"] = new_config_key

    return save_azure_configs(config_data["configs"], config_data["default_config"])


def get_azure_config_for_display():
    """Get Azure configuration for display (with masked credentials)"""
    config_data = load_azure_config()

    # Return all configs with masked credentials
    display_configs = {}
    for key, config in config_data.get("configs", {}).items():
        display_config = config.copy()

        display_configs[key] = display_config

    return {
        "configs": display_configs,
        "default_config": config_data.get("default_config"),
        "is_configured": config_data.get("is_configured", False),
    }


def get_current_azure_config():
    """Get the current default Azure configuration"""
    config_data = load_azure_config()
    default_key = config_data.get("default_config")
    if default_key and default_key in config_data.get("configs", {}):
        return config_data["configs"][default_key]
    return None


def set_azure_default_config(config_key: str):
    """Set a specific Azure config as default and update environment"""
    config_data = load_azure_config()

    if config_key not in config_data.get("configs", {}):
        raise ValueError(f"Azure config '{config_key}' not found")

    # Update default config
    config_data["default_config"] = config_key
    config_data["is_configured"] = True

    # Save the updated config
    save_azure_configs(config_data["configs"], config_data["default_config"])

    # Update environment variables with the new default config
    default_config = config_data["configs"][config_key]

    # Set environment variables for the new default config
    os.environ["AZURE_SUBSCRIPTION_ID"] = default_config.get("subscription_id", "")
    os.environ["AZURE_TENANT_ID"] = default_config.get("tenant_id", "")
    os.environ["AZURE_CLIENT_ID"] = default_config.get("client_id", "")
    os.environ["AZURE_CLIENT_SECRET"] = default_config.get("client_secret", "")

    return {
        "message": f"Azure config '{config_key}' set as default",
        "config": default_config,
    }


def delete_azure_config(config_key: str):
    """Delete an Azure configuration"""
    config_data = load_azure_config()

    if config_key not in config_data.get("configs", {}):
        raise ValueError(f"Azure config '{config_key}' not found")

    # Remove the config
    del config_data["configs"][config_key]

    # If this was the default config, clear the default
    if config_data.get("default_config") == config_key:
        config_data["default_config"] = None
        config_data["is_configured"] = False

    # If there are other configs and no default, set the first one as default
    if not config_data["default_config"] and config_data["configs"]:
        config_data["default_config"] = list(config_data["configs"].keys())[0]
        config_data["is_configured"] = True

    return save_azure_configs(config_data["configs"], config_data["default_config"])


def test_azure_connection(
    subscription_id: str,
    tenant_id: str,
    client_id: str,
    client_secret: str,
    auth_mode: str = "service_principal",
):
    """Test Azure connection with service principal credentials"""
    try:
        # Temporarily set the Azure credentials
        original_subscription = os.environ.get("AZURE_SUBSCRIPTION_ID")
        original_tenant = os.environ.get("AZURE_TENANT_ID")
        original_client = os.environ.get("AZURE_CLIENT_ID")
        original_secret = os.environ.get("AZURE_CLIENT_SECRET")

        os.environ["AZURE_SUBSCRIPTION_ID"] = subscription_id
        os.environ["AZURE_TENANT_ID"] = tenant_id
        os.environ["AZURE_CLIENT_ID"] = client_id
        os.environ["AZURE_CLIENT_SECRET"] = client_secret

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
            if result.returncode != 0:
                print(result.stderr)
                return False

            # Now test if we can access the subscription
            result2 = subprocess.run(
                ["az", "account", "show"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result2.returncode != 0:
                print(result2.stderr)
                return False

            return True
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
    """Verify Azure setup by checking if Azure CLI is installed and service principal is configured"""
    try:
        # Check if Azure CLI is installed
        result = subprocess.run(
            ["az", "--version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return False

        # Check if service principal is configured
        config = load_azure_config()
        return bool(
            config.get("subscription_id")
            and config.get("tenant_id")
            and config.get("client_id")
            and config.get("client_secret")
        )

    except Exception as e:
        print(f"Error verifying Azure setup: {e}")
        return False


def setup_azure_config():
    """Setup Azure configuration - now only supports service principal authentication"""
    try:
        # Check if Azure CLI is installed
        result = subprocess.run(
            ["az", "--version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            raise Exception("Azure CLI is not installed. Please install it first.")

        # Load existing config
        config = load_azure_config()
        default_config = config.get("default_config")
        config = config.get("configs", {}).get(default_config, {})

        # Check if service principal credentials are configured
        if not (
            config.get("subscription_id")
            and config.get("tenant_id")
            and config.get("client_id")
            and config.get("client_secret")
        ):
            raise Exception(
                "Azure service principal credentials are not configured. Please configure them in the admin panel."
            )

        # Test the connection
        if not test_azure_connection(
            config["subscription_id"],
            config["tenant_id"],
            config["client_id"],
            config["client_secret"],
        ):
            raise Exception(
                "Azure service principal authentication failed. Please check your credentials."
            )

        # Update config to mark as configured
        config["is_configured"] = True
        config["auth_method"] = "service_principal"
        save_azure_config(
            config["name"],
            config["subscription_id"],
            config["tenant_id"],
            config["client_id"],
            config["client_secret"],
            config.get("allowed_instance_types", []),
            config.get("allowed_regions", []),
            config.get("max_instances", 0),
        )

        return True

    except Exception as e:
        print(f"Error setting up Azure config: {e}")
        raise


def get_azure_regions():
    """Get available Azure regions from SkyPilot's Azure catalog"""
    try:
        from sky.catalog.common import read_catalog

        # Read the Azure catalog using SkyPilot's read_catalog function
        df = read_catalog("azure/vms.csv")

        regions = set()  # Use set to avoid duplicates

        # Extract regions from the catalog
        for _, row in df.iterrows():
            region = str(row.get("Region", "")).strip()

            # Skip rows with NaN or empty values
            if region and region != "Region" and region.lower() != "nan":
                regions.add(region)

        regions_list = sorted(list(regions))

        if regions_list:
            print(f"✅ Found {len(regions_list)} regions from SkyPilot Azure catalog")
        else:
            print("⚠️ No regions found in SkyPilot Azure catalog")

        return regions_list

    except Exception as e:
        print(f"❌ Error getting regions from SkyPilot catalog: {e}")
        return []


def get_azure_instance_types():
    """Get available Azure instance types from SkyPilot's Azure catalog"""
    try:
        from sky.catalog.common import read_catalog

        # Read the Azure catalog using SkyPilot's read_catalog function
        df = read_catalog("azure/vms.csv")

        instance_types = set()  # Use set to avoid duplicates

        # Extract instance types from the catalog
        for _, row in df.iterrows():
            instance_type = str(row.get("InstanceType", "")).strip()

            # Skip rows with NaN or empty values
            if (
                instance_type
                and instance_type != "InstanceType"
                and instance_type.lower() != "nan"
            ):
                instance_types.add(instance_type)

        instance_types_list = sorted(list(instance_types))

        if instance_types_list:
            print(
                f"✅ Found {len(instance_types_list)} instance types from SkyPilot Azure catalog"
            )
        else:
            print("⚠️ No instance types found in SkyPilot Azure catalog")

        return instance_types_list

    except Exception as e:
        print(f"❌ Error getting instance types from SkyPilot catalog: {e}")
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
    load_azure_config()

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


def run_sky_check_azure():
    """Run 'sky check azure' to validate the Azure setup"""
    try:
        print("🔍 Running 'sky check azure' to validate setup...")
        result = subprocess.run(
            ["sky", "check", "azure"],
            capture_output=True,
            text=True,
            timeout=30,  # 30 second timeout
        )

        if result.returncode == 0:
            print("✅ Sky check azure completed successfully")
            print(f"Output: {result.stdout}")
            return True, result.stdout
        else:
            print(f"❌ Sky check azure failed with return code {result.returncode}")
            print(f"Error output: {result.stderr}")
            return False, result.stderr

    except subprocess.TimeoutExpired:
        print("❌ Sky check azure timed out after 30 seconds")
        return False, "Timeout"
    except FileNotFoundError:
        print("❌ 'sky' command not found. Make sure SkyPilot is properly installed.")
        return False, "Sky command not found"
    except Exception as e:
        print(f"❌ Error running sky check azure: {e}")
        return False, str(e)
