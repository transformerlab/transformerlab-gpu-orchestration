import subprocess
from pathlib import Path
from fastapi import HTTPException
from typing import Optional


def run_sky_check_ssh():
    """Run 'sky check ssh' to validate the SSH setup"""
    try:
        print("🔍 Running 'sky check ssh' to validate setup...")
        result = subprocess.run(
            ["sky", "check", "ssh"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print("✅ Sky check ssh completed successfully")
            return True, result.stdout + result.stderr
        else:
            print(f"❌ Sky check ssh failed with return code {result.returncode}")
            return False, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        print("❌ Sky check ssh timed out after 30 seconds")
        return False, "Sky check ssh timed out"
    except FileNotFoundError:
        print("❌ sky command not found")
        return False, "sky command not found. Please ensure SkyPilot is installed."
    except Exception as e:
        print(f"❌ Error running sky check ssh: {e}")
        return False, f"Error: {str(e)}"


def load_ssh_node_info():
    """Load SSH node information from the SSH configuration"""
    try:
        from lattice.utils.file_utils import load_ssh_node_info as load_ssh_info

        return load_ssh_info()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load SSH node info: {str(e)}"
        )
