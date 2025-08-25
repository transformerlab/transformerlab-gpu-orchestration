from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
)
from .port_forwarding import port_forward_manager
from routes.auth.api_key_auth import get_user_or_api_key


router = APIRouter(prefix="/skypilot", dependencies=[Depends(get_user_or_api_key)])


@router.get("/port-forwards")
async def get_active_port_forwards(request: Request, response: Response):
    """Get list of active port forwards."""
    try:
        active_forwards = port_forward_manager.get_active_forwards()
        return {"port_forwards": active_forwards}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to get active port forwards: {str(e)}"
        )


@router.post("/port-forwards/{cluster_name}/stop")
async def stop_port_forward(request: Request, response: Response, cluster_name: str):
    """Stop port forwarding for a specific cluster."""
    try:
        success = port_forward_manager.stop_port_forward(cluster_name)
        if success:
            return {"message": f"Port forwarding stopped for cluster {cluster_name}"}
        else:
            raise HTTPException(
                status_code=404,
                detail=f"No active port forward found for cluster {cluster_name}",
            )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to stop port forward: {str(e)}"
        )
