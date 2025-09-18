from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
    File,
    UploadFile,
    Form,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
import json
import fsspec
import importlib.util
from pydantic import BaseModel, Field

from config import get_db
from db.db_models import StorageBucket
from routes.auth.api_key_auth import (
    get_user_or_api_key,
    require_scope,
    enforce_csrf,
)
from routes.auth.utils import get_current_user
from routes.clouds.azure.utils import az_get_current_config

router = APIRouter(
    prefix="/storage-buckets",
    dependencies=[Depends(get_user_or_api_key), Depends(enforce_csrf)],
    tags=["storage-buckets-browse"],
)

# @TODO: ensure this user has access to this storage bucket


# --- Pydantic Models ---
class PathRequest(BaseModel):
    """Request body for operations that target a specific path within a bucket."""

    path: str = Field(
        ..., example="/my-folder/", description="The path within the bucket."
    )
    storage_options: Optional[Dict[str, Any]] = Field(
        None, description="Additional options for the filesystem."
    )


class ListResponse(BaseModel):
    items: List[Dict[str, Any]]
    path: str


class FileOperationResponse(BaseModel):
    status: str
    path: str


# --- Helper Functions ---
def get_bucket_info(bucket_id: str, db: Session, organization_id: Optional[str]):
    """Get storage bucket information from the database"""
    if not organization_id:
        raise HTTPException(status_code=400, detail="Organization ID required")

    bucket = (
        db.query(StorageBucket)
        .filter(
            StorageBucket.id == bucket_id,
            StorageBucket.organization_id == organization_id,
            StorageBucket.is_active == True,  # noqa: E712
        )
        .first()
    )

    if not bucket:
        raise HTTPException(status_code=404, detail="Storage bucket not found")

    return bucket


def get_filesystem(
    bucket: StorageBucket, storage_options: Optional[Dict[str, Any]] = None
):
    """Initialize filesystem based on bucket information"""
    try:
        # Combine bucket credentials with any additional storage options
        options = storage_options or {}

        # Determine the protocol from the source/remote_path
        # This is a simplified version - in production you'd have more sophisticated logic
        protocol = "file"  # Default to local filesystem
        base_path = bucket.remote_path  # Default base path
        if bucket.source:
            if bucket.source.startswith("s3://"):
                protocol = "s3"
                # Check if s3fs is installed
                if not importlib.util.find_spec("s3fs"):
                    raise ImportError(
                        "s3fs package is required for S3 access. Install with 'pip install s3fs'"
                    )
                # Remove unsupported keys that might be forwarded to AioSession
                for k in [
                    "source",
                    "mode",
                    "store",
                    "persistent",
                    "name",
                    "remote_path",
                ]:
                    if k in options:
                        options.pop(k, None)
                # Get AWS profile from cloud account settings if available
                if not options.get("profile") and not options.get("profile_name"):
                    try:
                        from routes.clouds.aws.utils import load_aws_config
                        aws_config = load_aws_config(organization_id=bucket.organization_id)
                        if aws_config.get("default_config"):
                            default_config = aws_config["configs"].get(aws_config["default_config"], {})
                            profile_name = default_config.get("profile_name")
                            if profile_name:
                                options["profile"] = profile_name
                    except Exception as e:
                        print(f"Failed to load AWS config; falling back to default AWS credential chain: {e}")
                # Prefer 'profile' over 'profile_name' for aiobotocore compatibility
                if options.get("profile_name") and not options.get("profile"):
                    options["profile"] = options.pop("profile_name")
                # Allow-list known s3fs/fsspec options to avoid passing unexpected kwargs
                allowed_s3_options = {
                    "profile",
                    "anon",
                    "use_ssl",
                    "client_kwargs",
                    "config_kwargs",
                    "s3_additional_kwargs",
                    "endpoint_url",
                    "key",
                    "secret",
                    "token",
                    "requester_pays",
                    "region_name",
                    "version_aware",
                    "default_cache_type",
                    "default_fill_cache",
                    "skip_instance_cache",
                }
                options = {k: v for k, v in options.items() if k in allowed_s3_options}
                # For S3, use the bucket path from source (e.g., s3://<bucketname>)
                base_path = bucket.source
            elif bucket.source.startswith("gs://") or bucket.source.startswith(
                "gcs://"
            ):
                protocol = "gcs"
                # Check if gcsfs is installed
                if not importlib.util.find_spec("gcsfs"):
                    raise ImportError(
                        "gcsfs package is required for Google Cloud Storage access. Install with 'pip install gcsfs'"
                    )
            elif bucket.source.startswith("https://") and 'blob.core.windows.net' in bucket.source:
                # For Azure, we need to use 'az' protocol for standard blob storage
                protocol = "az"
                # Check if adlfs is installed
                if not importlib.util.find_spec("adlfs"):
                    raise ImportError(
                        "adlfs package is required for Azure Storage access. Install with 'pip install adlfs'"
                    )

                # Parse the URL to extract account and container information
                url_parts = bucket.source.replace("https://", "").split(".")
                if len(url_parts) >= 1:
                    account_name = url_parts[0]
                    # Extract container name from path - it's the first path segment after the domain
                    container_parts = bucket.source.split("/")
                    if len(container_parts) > 3:
                        # For https://account.blob.core.windows.net/container/path
                        # container_parts[3] is the container name
                        container_path = container_parts[3]
                    else:
                        container_path = ""

                # Remove unsupported keys that might be forwarded from bucket configuration
                for k in [
                    "source",
                    "mode",
                    "store",
                    "persistent",
                    "name",
                    "remote_path",
                ]:
                    if k in options:
                        options.pop(k, None)

                # Set these options, overriding any that might have been provided
                options["account_name"] = account_name
                if container_path:
                    options["container_name"] = container_path

                # For Azure blob storage with az protocol, use empty base path since container is specified in options
                base_path = ""

                # Use Azure credentials from the configured Azure account
                try:
                    # We need to pass organization_id to az_get_current_config
                    # Extract organization_id from the bucket
                    org_id = bucket.organization_id
                    azure_config = az_get_current_config(organization_id=org_id)
                    if azure_config:
                        # Override any credentials in options with ones from config
                        options["client_id"] = azure_config.get("client_id")
                        options["client_secret"] = azure_config.get("client_secret")
                        options["tenant_id"] = azure_config.get("tenant_id")
                except Exception as e:
                    print(f"Failed to load Azure credentials from config: {e}")
                    print(
                        "WARNING: No Azure credentials found. Using default credential chain."
                    )
            elif (
                bucket.source.startswith("https://")
                and "blob.core.windows.net" in bucket.source
            ):
                # Detect Azure blob URLs in the format https://account.blob.core.windows.net/container
                # Use 'az' protocol for standard Azure Blob Storage (not Data Lake Gen2)
                protocol = "az"
                print(f"Detected Azure blob URL: {bucket.source}")

                # Check if adlfs is installed
                if not importlib.util.find_spec("adlfs"):
                    raise ImportError(
                        "adlfs package is required for Azure Storage access. Install with 'pip install adlfs'"
                    )

                # Parse the URL to extract account and container information
                url_parts = bucket.source.replace("https://", "").split(".")
                print(f"URL parts: {url_parts}")
                if len(url_parts) >= 1:
                    account_name = url_parts[0]
                    # Extract container name from path - it's the first path segment after the domain
                    container_parts = bucket.source.split("/")
                    if len(container_parts) > 3:
                        # For https://account.blob.core.windows.net/container/path
                        # container_parts[3] is the container name
                        container_path = container_parts[3]
                    else:
                        container_path = ""
                    print(
                        f"Extracted account: {account_name}, container: {container_path}"
                    )

                # Remove unsupported keys that might be forwarded from bucket configuration
                for k in [
                    "source",
                    "mode",
                    "store",
                    "persistent",
                    "name",
                    "remote_path",
                ]:
                    if k in options:
                        options.pop(k, None)

                # Set these options, overriding any that might have been provided
                options["account_name"] = account_name
                if container_path:
                    options["container_name"] = container_path
                print(f"Set account_name: {account_name}, container_name: {container_path}")

                # For Azure blob storage with az protocol, use empty base path since container is specified in options
                base_path = ""

                # Use Azure credentials from the configured Azure account
                try:
                    # We need to pass organization_id to az_get_current_config
                    org_id = bucket.organization_id
                    azure_config = az_get_current_config(organization_id=org_id)
                    if azure_config:
                        print(
                            f"Found Azure configuration for org {org_id}, using credentials from config"
                        )
                        # Override any credentials in options with ones from config
                        options["client_id"] = azure_config.get("client_id")
                        options["client_secret"] = azure_config.get("client_secret")
                        options["tenant_id"] = azure_config.get("tenant_id")
                except Exception as e:
                    print(f"Failed to load Azure credentials from config: {e}")
                    print(
                        "WARNING: No Azure credentials found. Using default credential chain."
                    )
            # Add other protocols as needed

        # In production, you would fetch credentials from a secure store based on the bucket.store
        # For now, we assume credentials are passed in storage_options or available via environment

        # Try to initialize the filesystem with the determined protocol
        try:
            fs = fsspec.filesystem(protocol, **options)
            return fs, base_path
        except ModuleNotFoundError as e:
            if protocol in ["azure", "abfs", "az"]:
                raise ImportError(
                    "adlfs package is required for Azure Storage access. Install with 'pip install adlfs'"
                ) from e
            elif protocol == "s3":
                raise ImportError(
                    "s3fs package is required for S3 access. Install with 'pip install s3fs'"
                ) from e
            elif protocol in ["gs", "gcs"]:
                raise ImportError(
                    "gcsfs package is required for Google Cloud Storage access. Install with 'pip install gcsfs'"
                ) from e
            else:
                raise
    except ImportError as ie:
        # Handle missing dependency errors with helpful instructions
        raise HTTPException(
            status_code=400, detail=f"Missing required package: {str(ie)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to initialize filesystem for bucket: {e}"
        )


# --- API Endpoints ---
@router.post("/{bucket_id}/list", response_model=ListResponse)
async def list_files(
    bucket_id: str,
    req: PathRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Lists the contents of a directory within a storage bucket."""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = get_bucket_info(bucket_id, db, organization_id)
        fs, base_path = get_filesystem(bucket, req.storage_options)

        # Combine the base path with the requested path
        if base_path:
            if req.path == "/" or req.path == "":
                # For root directory, just use the base path without trailing slash
                full_path = base_path.rstrip('/')
            else:
                full_path = f"{base_path.rstrip('/')}/{req.path.lstrip('/')}"
        else:
            # For Azure with az protocol, use just the requested path
            full_path = req.path.lstrip('/') if req.path != "/" else ""

        # print("DEBUG INFO:")
        # print(f"Bucket ID: {bucket_id}")
        # print(f"Request path: {req.path}")
        # print(f"Base path: {base_path}")
        # print(f"Full path: {full_path}")
        # print(f"Protocol: {fs.protocol}")
        # print(f"Storage options: {req.storage_options}")
        # print(f"Bucket source: {bucket.source}")

        # Additional Azure-specific debug info
        # if hasattr(fs, "account_name"):
        #     print(f"Azure account name: {fs.account_name}")
        # if hasattr(fs, "container_name"):
        #     print(f"Azure container name: {fs.container_name}")

        # print(f"Listing files in bucket {bucket_id} at path: {full_path}")

        try:
            # For Azure, get container name from the source URL
            container_name = None
            if hasattr(fs, "account_name"):
                # Get container name from the bucket source URL
                container_parts = bucket.source.split("/")
                container_name = container_parts[3] if len(container_parts) > 3 else None
                
                # Use the specific container directly
                if container_name:
                    listing = fs.ls(container_name, detail=True)
                else:
                    raise HTTPException(status_code=400, detail="Could not extract container name from source URL")
            else:
                # Fallback for non-Azure filesystems
                listing = fs.ls(full_path, detail=True)
            # print(f"Successfully listed path, found {len(listing)} items")
            # Transform the listing to ensure consistent output format
            items = []
            for item in listing:
                # Extract just the relative path from the full path
                name = item["name"].replace(full_path, "")
                if name == "":  # This is the directory itself
                    continue

                items.append(
                    {
                        "name": name,
                        "size": item.get("size", 0),
                        "type": item.get("type", "unknown"),
                        "last_modified": item.get("last_modified", None),
                    }
                )

            return ListResponse(
                items=sorted(items, key=lambda x: (x["type"], x["name"])), path=req.path
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Path not found: {req.path}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to list files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@router.post("/{bucket_id}/get-file")
async def get_file(
    bucket_id: str,
    req: PathRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Downloads a single file from a storage bucket."""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = get_bucket_info(bucket_id, db, organization_id)
        fs, base_path = get_filesystem(bucket, req.storage_options)

        # Combine the base path with the requested file path
        if base_path:
            full_path = f"{base_path.rstrip('/')}/{req.path.lstrip('/')}"
        else:
            # For Azure with az protocol, use just the requested path
            full_path = req.path.lstrip('/') if req.path != "/" else ""

        
        # For Azure, we need to check if the file exists in the container
        if fs.protocol == "az" or fs.protocol == "abfs":
            # Get container name from the bucket source URL
            container_parts = bucket.source.split("/")
            container_name = container_parts[3] if len(container_parts) > 3 else None
            
            if container_name:
                # List files in the container to find the exact path
                try:
                    listing = fs.ls(container_name, detail=True)
                                        
                    # Check if the file exists in the listing
                    file_found = False
                    for item in listing:
                        if item["name"].endswith(full_path) or item["name"] == full_path:
                            full_path = item["name"]  # Use the full path from the listing
                            file_found = True
                            break
                    
                    if not file_found:
                        print(f"File not found in container listing")
                        raise HTTPException(status_code=404, detail=f"File not found: {req.path}")
                        
                except Exception as e:
                    print(f"Error listing Azure container: {e}")
                    import traceback
                    traceback.print_exc()
                    raise HTTPException(status_code=500, detail=f"Failed to access Azure container: {str(e)}")
            else:
                print("No container name found")
        
        try:
            # Check if it's a file
            if not fs.isfile(full_path):
                raise HTTPException(status_code=400, detail="Path is not a file.")

            file_info = fs.info(full_path)
            file_size = file_info.get("size", 0)
            file_name = req.path.split("/")[-1]

            def file_iterator():
                with fs.open(full_path, "rb") as f:
                    yield from f

            return StreamingResponse(
                file_iterator(),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f'attachment; filename="{file_name}"',
                    "Content-Length": str(file_size),
                },
            )
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"File not found: {req.path}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to download file: {str(e)}"
        )


@router.post("/{bucket_id}/upload-file", response_model=FileOperationResponse)
async def upload_file(
    bucket_id: str,
    request: Request,
    response: Response,
    file: UploadFile = File(...),
    path: str = Form(...),
    storage_options: str = Form("{}"),
    db: Session = Depends(get_db),
    __: dict = Depends(require_scope("storage:write")),
):
    """Uploads a file to a specified path within a storage bucket."""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = get_bucket_info(bucket_id, db, organization_id)
        fs, base_path = get_filesystem(bucket, json.loads(storage_options))

        # Ensure the target directory exists
        if base_path:
            target_dir = f"{base_path.rstrip('/')}/{path.lstrip('/')}"
            target_path = f"{target_dir.rstrip('/')}/{file.filename}"
        else:
            # For Azure with az protocol, use just the requested path
            target_dir = path.lstrip('/') if path != "/" else ""
            target_path = f"{target_dir.rstrip('/')}/{file.filename}" if target_dir else file.filename

        try:
            # Create directory if it doesn't exist
            if not fs.exists(target_dir):
                fs.makedirs(target_dir, exist_ok=True)

            with fs.open(target_path, "wb") as f:
                # Read file in chunks to handle large files
                while content := await file.read(1024 * 1024):  # Read 1MB chunks
                    f.write(content)

            return FileOperationResponse(
                status="success", path=f"{path.rstrip('/')}/{file.filename}"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.post("/{bucket_id}/delete-file", response_model=FileOperationResponse)
async def delete_file(
    bucket_id: str,
    req: PathRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(require_scope("storage:write")),
):
    """Deletes a file or directory within a storage bucket."""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = get_bucket_info(bucket_id, db, organization_id)
        fs, base_path = get_filesystem(bucket, req.storage_options)

        # Combine the base path with the requested path
        if base_path:
            full_path = f"{base_path.rstrip('/')}/{req.path.lstrip('/')}"
        else:
            # For Azure with az protocol, use just the requested path
            full_path = req.path.lstrip('/') if req.path != "/" else ""

        try:
            if not fs.exists(full_path):
                raise HTTPException(
                    status_code=404, detail=f"Path not found: {req.path}"
                )

            fs.rm(full_path, recursive=True)  # Use recursive to delete directories
            return FileOperationResponse(status="success", path=req.path)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail=f"Path not found: {req.path}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@router.post("/{bucket_id}/create-dir", response_model=FileOperationResponse)
async def create_dir(
    bucket_id: str,
    req: PathRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    __: dict = Depends(require_scope("storage:write")),
):
    """Creates a new directory within a storage bucket."""
    try:
        user_info = get_current_user(request, response)
        organization_id = user_info.get("organization_id")

        bucket = get_bucket_info(bucket_id, db, organization_id)
        fs, base_path = get_filesystem(bucket, req.storage_options)

        # Combine the base path with the requested path
        if base_path:
            full_path = f"{base_path.rstrip('/')}/{req.path.lstrip('/')}"
        else:
            # For Azure with az protocol, use just the requested path
            full_path = req.path.lstrip('/') if req.path != "/" else ""

        try:
            fs.mkdir(full_path, create_parents=True)
            return FileOperationResponse(status="success", path=req.path)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to create directory: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create directory: {str(e)}"
        )
