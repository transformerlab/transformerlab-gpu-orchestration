from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
)
from typing import Optional

from .utils import (
    run_sky_check_ssh,
    load_ssh_node_info,
)
from routes.auth.api_key_auth import get_user_or_api_key


router = APIRouter()


@router.get("/sky-check")
async def run_sky_check_ssh_route(request: Request, response: Response):
    """Run 'sky check ssh' to validate the SSH setup"""
    try:
        is_valid, output = run_sky_check_ssh()
        return {
            "valid": is_valid,
            "output": output,
            "message": "Sky check ssh completed successfully"
            if is_valid
            else "Sky check ssh failed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run sky check ssh: {str(e)}"
        )


@router.get("/node-info")
async def get_ssh_node_info(request: Request, response: Response):
    """Get SSH node information"""
    try:
        node_info = load_ssh_node_info()
        return node_info
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to load SSH node info: {str(e)}"
        )
