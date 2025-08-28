import sky
from typing import Optional, Dict, Any
from datetime import datetime
from config import get_db
from db_models import SkyPilotRequest, validate_relationships_before_save, validate_relationships_before_delete
from concurrent.futures import ThreadPoolExecutor


class SkyPilotTracker:
    """Utility class for tracking SkyPilot requests and streaming logs"""

    def __init__(self):
        self._executor = ThreadPoolExecutor(
            max_workers=10, thread_name_prefix="skypilot-tracker"
        )

    def store_request(
        self,
        user_id: str,
        organization_id: str,
        task_type: str,
        request_id: str,
        cluster_name: Optional[str] = None,
    ) -> str:
        """
        Store a SkyPilot request in the database

        Args:
            user_id: User ID
            organization_id: Organization ID
            task_type: Type of task (launch, stop, down, status, etc.)
            request_id: SkyPilot request ID
            cluster_name: Associated cluster name if applicable

        Returns:
            Database record ID
        """
        db = next(get_db())
        try:
            skypilot_request = SkyPilotRequest(
                user_id=user_id,
                organization_id=organization_id,
                task_type=task_type,
                request_id=request_id,
                cluster_name=cluster_name,
                status="pending",
            )
            
            # Validate relationships before saving
            validate_relationships_before_save(skypilot_request, db)
            
            db.add(skypilot_request)
            db.commit()
            db.refresh(skypilot_request)
            return skypilot_request.id
        except Exception as e:
            db.rollback()
            print(f"Error storing SkyPilot request: {e}")
            raise
        finally:
            db.close()

    def update_request_status(
        self,
        request_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ):
        """
        Update the status of a SkyPilot request

        Args:
            request_id: SkyPilot request ID
            status: New status (pending, completed, failed, cancelled)
            result: Result data from SkyPilot
            error_message: Error message if failed
        """
        db = next(get_db())
        try:
            skypilot_request = (
                db.query(SkyPilotRequest)
                .filter(SkyPilotRequest.request_id == request_id)
                .first()
            )

            if skypilot_request:
                skypilot_request.status = status
                if result:
                    skypilot_request.result = result
                if error_message:
                    skypilot_request.error_message = error_message
                if status in ["completed", "failed", "cancelled"]:
                    skypilot_request.completed_at = datetime.utcnow()

                db.commit()
        except Exception as e:
            db.rollback()
            print(f"Error updating SkyPilot request status: {e}")
            raise
        finally:
            db.close()

    def get_request_by_id(self, request_id: str) -> Optional[SkyPilotRequest]:
        """
        Get a SkyPilot request by its request ID

        Args:
            request_id: SkyPilot request ID

        Returns:
            SkyPilotRequest object or None if not found
        """
        db = next(get_db())
        try:
            return (
                db.query(SkyPilotRequest)
                .filter(SkyPilotRequest.request_id == request_id)
                .first()
            )
        finally:
            db.close()

    def get_user_requests(
        self,
        user_id: str,
        organization_id: str,
        task_type: Optional[str] = None,
        limit: int = 50,
    ) -> list[SkyPilotRequest]:
        """
        Get SkyPilot requests for a user

        Args:
            user_id: User ID
            organization_id: Organization ID
            task_type: Filter by task type (optional)
            limit: Maximum number of results

        Returns:
            List of SkyPilotRequest objects
        """
        db = next(get_db())
        try:
            query = db.query(SkyPilotRequest).filter(
                SkyPilotRequest.user_id == user_id,
                SkyPilotRequest.organization_id == organization_id,
            )

            if task_type:
                query = query.filter(SkyPilotRequest.task_type == task_type)

            return query.order_by(SkyPilotRequest.created_at.desc()).limit(limit).all()
        finally:
            db.close()

    def stream_and_track_request(
        self,
        request_id: str,
        user_id: str,
        organization_id: str,
        task_type: str,
        cluster_name: Optional[str] = None,
        output_stream=None,
    ):
        """
        Stream logs for a SkyPilot request and track its progress

        Args:
            request_id: SkyPilot request ID
            user_id: User ID
            organization_id: Organization ID
            task_type: Type of task
            cluster_name: Associated cluster name
            output_stream: Output stream for logs (defaults to print)
        """
        # Store the request first
        self.store_request(
            user_id=user_id,
            organization_id=organization_id,
            task_type=task_type,
            request_id=request_id,
            cluster_name=cluster_name,
        )

        def stream_and_update():
            try:
                # Stream the logs and get the result
                result = sky.stream_and_get(
                    request_id=request_id, output_stream=output_stream
                )

                # Update the request status
                self.update_request_status(
                    request_id=request_id, status="completed", result=result
                )

                return result
            except Exception as e:
                # Update the request status with error
                self.update_request_status(
                    request_id=request_id, status="failed", error_message=str(e)
                )
                raise

        # Run in thread pool to avoid blocking
        future = self._executor.submit(stream_and_update)
        return future

    def get_request_logs(
        self,
        request_id: str,
        tail: Optional[int] = None,
        follow: bool = True,
        output_stream=None,
    ):
        """
        Get logs for a specific request

        Args:
            request_id: SkyPilot request ID
            tail: Number of lines to show from the end
            follow: Whether to follow the logs
            output_stream: Output stream for logs
        """
        return sky.stream_and_get(
            request_id=request_id, tail=tail, follow=follow, output_stream=output_stream
        )

    def cancel_request(self, request_id: str) -> bool:
        """
        Cancel a SkyPilot request

        Args:
            request_id: SkyPilot request ID

        Returns:
            True if cancelled successfully, False otherwise
        """
        try:
            sky.api_cancel(request_id)
            self.update_request_status(request_id, "cancelled")
            return True
        except Exception as e:
            print(f"Error cancelling request {request_id}: {e}")
            return False


# Global instance
skypilot_tracker = SkyPilotTracker()
