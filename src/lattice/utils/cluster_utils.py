"""
Cluster utilities for managing cluster platforms and name mapping with database storage.
"""

from pathlib import Path
from typing import Optional, Dict, Any
from nanoid import generate
from sqlalchemy.orm import Session
from fastapi import HTTPException

from config import SessionLocal
from db.db_models import ClusterPlatform, validate_relationships_before_save, validate_relationships_before_delete


def generate_unique_cluster_name(display_name: str) -> str:
    """
    Generate a unique cluster name by prepending a nanoid to the display name.

    Args:
        display_name: The name specified by the user

    Returns:
        Unique cluster name with format: {nanoid}
    """
    # Generate an 8-character nanoid for uniqueness
    # Use only alphanumeric characters to avoid invalid chars like underscore
    nanoid = generate(
        size=8,
        alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.",
    )

    # Ensure it starts with a letter (not a number) as required by the regex
    if not nanoid[0].isalpha():
        nanoid = "t" + nanoid
    if not nanoid[-1].isalpha():
        nanoid = nanoid + "t"

    return nanoid


def get_actual_cluster_name(
    display_name: str, user_id: str, organization_id: str, db: Optional[Session] = None
) -> Optional[str]:
    """
    Get the actual cluster name from the display name for a specific user and org.

    Args:
        display_name: The display name shown to users
        user_id: User ID
        organization_id: Organization ID
        db: Optional database session

    Returns:
        The actual cluster name used internally, or None if not found
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        cluster = (
            db.query(ClusterPlatform)
            .filter(
                ClusterPlatform.display_name == display_name,
                ClusterPlatform.user_id == user_id,
                ClusterPlatform.organization_id == organization_id,
            )
            .first()
        )
        return cluster.cluster_name if cluster else None
    finally:
        if should_close_db:
            db.close()


def get_display_name_from_actual(
    cluster_name: str, db: Optional[Session] = None
) -> Optional[str]:
    """
    Get the display name from the actual cluster name.

    Args:
        cluster_name: The actual cluster name used internally
        db: Optional database session

    Returns:
        The display name shown to users, or None if not found
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        cluster = (
            db.query(ClusterPlatform)
            .filter(ClusterPlatform.cluster_name == cluster_name)
            .first()
        )
        return cluster.display_name if cluster else None
    finally:
        if should_close_db:
            db.close()


def _generate_unique_display_name(
    display_name: str, user_id: str, organization_id: str, db: Session
) -> str:
    """
    Generate a unique display name by appending a number if the original already exists.

    Args:
        display_name: The original display name
        user_id: User ID
        organization_id: Organization ID
        db: Database session

    Returns:
        A unique display name for the user+org combination
    """
    # Check if the original display name is available
    existing = (
        db.query(ClusterPlatform)
        .filter(
            ClusterPlatform.display_name == display_name,
            ClusterPlatform.user_id == user_id,
            ClusterPlatform.organization_id == organization_id,
        )
        .first()
    )

    if not existing:
        return display_name

    # If the original exists, try appending numbers until we find a unique one
    counter = 2
    while True:
        candidate_name = f"{display_name}-{counter}"
        existing = (
            db.query(ClusterPlatform)
            .filter(
                ClusterPlatform.display_name == candidate_name,
                ClusterPlatform.user_id == user_id,
                ClusterPlatform.organization_id == organization_id,
            )
            .first()
        )

        if not existing:
            return candidate_name

        counter += 1


def create_cluster_platform_entry(
    display_name: str,
    platform: str,
    user_id: str,
    organization_id: str,
    user_info: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None,
) -> str:
    """
    Create a new cluster platform entry in the database.

    Args:
        display_name: The display name specified by the user
        platform: The platform (runpod, azure, ssh, etc.)
        user_id: User ID
        organization_id: Organization ID
        user_info: Optional user info dictionary
        db: Optional database session

    Returns:
        The generated actual cluster name

    Note:
        If display name already exists for user+org, automatically generates
        a unique variant by appending a number (e.g., "my-cluster-2")
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        # Generate a unique display name if the original already exists
        unique_display_name = _generate_unique_display_name(
            display_name, user_id, organization_id, db
        )

        # Generate unique cluster name using the unique display name
        cluster_name = generate_unique_cluster_name(unique_display_name)

        # Ensure the generated name is globally unique
        while (
            db.query(ClusterPlatform)
            .filter(ClusterPlatform.cluster_name == cluster_name)
            .first()
        ):
            cluster_name = generate_unique_cluster_name(unique_display_name)

        # Create new cluster platform entry
        cluster_platform = ClusterPlatform(
            cluster_name=cluster_name,
            display_name=unique_display_name,
            platform=platform,
            user_id=user_id,
            organization_id=organization_id,
            user_info=user_info or {},
        )

        # Validate relationships before saving
        validate_relationships_before_save(cluster_platform, db)

        db.add(cluster_platform)
        db.commit()
        db.refresh(cluster_platform)

        return cluster_name

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to create cluster platform entry: {str(e)}"
        )
    finally:
        if should_close_db:
            db.close()


def get_cluster_platform_info(
    cluster_name: str, db: Optional[Session] = None
) -> Optional[Dict[str, Any]]:
    """
    Get cluster platform information by actual cluster name.

    Args:
        cluster_name: The actual cluster name
        db: Optional database session

    Returns:
        Dictionary with platform info or None if not found
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        cluster = (
            db.query(ClusterPlatform)
            .filter(ClusterPlatform.cluster_name == cluster_name)
            .first()
        )

        if not cluster:
            return None

        return {
            "platform": cluster.platform,
            "user_info": cluster.user_info or {},
            "state": cluster.state,
            "display_name": cluster.display_name,
            "user_id": cluster.user_id,
            "organization_id": cluster.organization_id,
        }
    finally:
        if should_close_db:
            db.close()


def get_user_clusters(
    user_id: str, organization_id: str, db: Optional[Session] = None
) -> list[Dict[str, Any]]:
    """
    Get all clusters for a specific user and organization.

    Args:
        user_id: User ID
        organization_id: Organization ID
        db: Optional database session

    Returns:
        List of cluster information dictionaries
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        clusters = (
            db.query(ClusterPlatform)
            .filter(
                ClusterPlatform.user_id == user_id,
                ClusterPlatform.organization_id == organization_id,
            )
            .all()
        )

        return [
            {
                "cluster_name": cluster.cluster_name,
                "display_name": cluster.display_name,
                "platform": cluster.platform,
                "state": cluster.state,
                "user_info": cluster.user_info or {},
                "created_at": cluster.created_at.isoformat()
                if cluster.created_at
                else None,
            }
            for cluster in clusters
        ]
    finally:
        if should_close_db:
            db.close()


def delete_cluster_platform_entry(
    cluster_name: str, db: Optional[Session] = None
) -> bool:
    """
    Delete a cluster platform entry.

    Args:
        cluster_name: The actual cluster name
        db: Optional database session

    Returns:
        True if deleted, False if not found
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        cluster = (
            db.query(ClusterPlatform)
            .filter(ClusterPlatform.cluster_name == cluster_name)
            .first()
        )

        if not cluster:
            return False

        # Validate relationships before deleting
        validate_relationships_before_delete(cluster, db)

        db.delete(cluster)
        db.commit()
        return True

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete cluster platform entry: {str(e)}"
        )
    finally:
        if should_close_db:
            db.close()


# Legacy compatibility functions to maintain backward compatibility
def get_cluster_platforms_path():
    """Legacy function - kept for backward compatibility."""
    sky_dir = Path.home() / ".sky" / "lattice_data"
    return sky_dir / "cluster_platforms.json"


def load_cluster_platforms():
    """Legacy function - returns empty dict to maintain compatibility."""
    return {}


def save_cluster_platforms(platforms_data):
    """Legacy function - does nothing to maintain compatibility."""
    pass


def set_cluster_platform(
    cluster_name: str, platform: str, user_info: dict = None
):
    """
    Legacy function updated to use database storage.
    Note: This function doesn't handle display names since legacy code doesn't provide user context.
    """
    # For legacy compatibility, we'll just try to update if the cluster exists
    db = SessionLocal()
    try:
        cluster = (
            db.query(ClusterPlatform)
            .filter(ClusterPlatform.cluster_name == cluster_name)
            .first()
        )
        if cluster:
            cluster.platform = platform
            cluster.user_info = user_info or {}
            db.commit()
    except Exception as e:
        print(f"Warning: Failed to update cluster platform for {cluster_name}: {e}")
    finally:
        db.close()


def get_cluster_platform(cluster_name: str) -> str:
    """Legacy function updated to use database storage."""
    info = get_cluster_platform_info(cluster_name)
    return info["platform"] if info else "unknown"


def get_cluster_user_info(cluster_name: str) -> dict:
    """Legacy function updated to use database storage."""
    info = get_cluster_platform_info(cluster_name)
    return info["user_info"] if info else {}


def get_cluster_state(cluster_name: str) -> str:
    """Get cluster state from database storage."""
    info = get_cluster_platform_info(cluster_name)
    return info["state"] if info else "active"


def update_cluster_state(cluster_name: str, state: str, db: Optional[Session] = None) -> bool:
    """
    Update cluster state in the database.
    
    Args:
        cluster_name: The actual cluster name
        state: The new state (e.g., 'active', 'terminating')
        db: Optional database session
        
    Returns:
        True if updated successfully, False if cluster not found
    """
    should_close_db = db is None
    if db is None:
        db = SessionLocal()

    try:
        cluster = (
            db.query(ClusterPlatform)
            .filter(ClusterPlatform.cluster_name == cluster_name)
            .first()
        )

        if not cluster:
            return False

        cluster.state = state
        db.commit()
        return True

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update cluster state: {str(e)}"
        )
    finally:
        if should_close_db:
            db.close()


def remove_cluster_platform(cluster_name: str):
    """Legacy function updated to use database storage."""
    delete_cluster_platform_entry(cluster_name)
