from fastapi import APIRouter, Depends
from ..auth.api_key_auth import get_user_or_api_key

# Import sub-routers
from .azure.routes import router as azure_router
from .runpod.routes import router as runpod_router

# Create main clouds router
router = APIRouter(prefix="/clouds", dependencies=[Depends(get_user_or_api_key)])

# Include sub-routers
router.include_router(azure_router, prefix="/azure")
router.include_router(runpod_router, prefix="/runpod")
