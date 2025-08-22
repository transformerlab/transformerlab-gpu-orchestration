"""
Utilities for resolving cluster display names to actual names in API routes.
"""

from functools import wraps
from typing import Callable
from fastapi import HTTPException
from .cluster_utils import get_actual_cluster_name, get_display_name_from_actual


def resolve_cluster_name(f: Callable) -> Callable:
    """
    Decorator to automatically resolve display names to actual cluster names.

    This decorator:
    1. Looks for 'cluster_name' parameter in the function arguments
    2. Treats it as a display name and resolves it to the actual cluster name
    3. Updates the cluster_name parameter with the actual name before calling the function
    4. Requires user context to be available (either via dependency injection or request)

    Usage:
        @resolve_cluster_name
        async def some_route(cluster_name: str, request: Request, user: dict = Depends(get_user_or_api_key)):
            # cluster_name will be the actual cluster name here
            pass
    """

    @wraps(f)
    async def wrapper(*args, **kwargs):
        # Find cluster_name in kwargs
        if "cluster_name" not in kwargs:
            return await f(*args, **kwargs)

        display_name = kwargs["cluster_name"]

        # Try to get user context from kwargs (dependency injection)
        user = kwargs.get("user")

        # If no user in kwargs, try to get from request
        if not user and "request" in kwargs:
            request = kwargs["request"]
            try:
                # Get user from request using the auth dependency
                from ..routes.auth.api_key_auth import get_user_or_api_key
                from ..config import SessionLocal

                db = SessionLocal()
                try:
                    user = await get_user_or_api_key(request, None, db)
                finally:
                    db.close()
            except Exception as e:
                print(
                    f"Warning: Could not get user context for cluster resolution: {e}"
                )
                # If we can't get user context, pass through unchanged
                return await f(*args, **kwargs)

        if not user:
            # If still no user context, pass through unchanged
            return await f(*args, **kwargs)

        # Resolve display name to actual cluster name
        actual_name = get_actual_cluster_name(
            display_name,
            user.get("id") if isinstance(user, dict) else user.id,
            user.get("organization_id")
            if isinstance(user, dict)
            else user.organization_id,
        )

        if actual_name:
            kwargs["cluster_name"] = actual_name
        else:
            # If no mapping found, the cluster might not exist for this user
            # or it could be a legacy cluster name - let the original function handle it
            pass

        return await f(*args, **kwargs)

    return wrapper


def resolve_display_name_in_response(f: Callable) -> Callable:
    """
    Decorator to convert actual cluster names back to display names in responses.

    This decorator:
    1. Calls the original function
    2. Looks for 'cluster_name' fields in the response
    3. Converts actual cluster names back to display names

    Usage:
        @resolve_display_name_in_response
        async def some_route(...):
            return {"cluster_name": "actual_name", "status": "running"}
            # Will return {"cluster_name": "display_name", "status": "running"}
    """

    @wraps(f)
    async def wrapper(*args, **kwargs):
        result = await f(*args, **kwargs)

        # Convert actual names back to display names in the response
        if isinstance(result, dict):
            if "cluster_name" in result:
                display_name = get_display_name_from_actual(result["cluster_name"])
                if display_name:
                    result["cluster_name"] = display_name
        elif hasattr(result, "cluster_name"):
            display_name = get_display_name_from_actual(result.cluster_name)
            if display_name:
                result.cluster_name = display_name

        return result

    return wrapper


def handle_cluster_name_param(
    display_name: str, user_id: str, organization_id: str
) -> str:
    """
    Helper function to resolve a display name to actual cluster name.

    Args:
        display_name: The cluster name provided by the user
        user_id: User ID
        organization_id: Organization ID

    Returns:
        The actual cluster name to use for operations

    Raises:
        HTTPException: If cluster not found for this user/org
    """
    actual_name = get_actual_cluster_name(display_name, user_id, organization_id)

    if not actual_name:
        raise HTTPException(
            status_code=404,
            detail=f"Cluster '{display_name}' not found for this user and organization",
        )

    return actual_name


def get_display_name_for_response(actual_name: str) -> str:
    """
    Helper function to get display name for API responses.

    Args:
        actual_name: The actual cluster name used internally

    Returns:
        The display name to show to users, or actual name if no mapping found
    """
    display_name = get_display_name_from_actual(actual_name)
    return display_name if display_name else actual_name
