"""
File utilities for CLI operations including directory uploads.
"""

import os
import mimetypes
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from .auth import api_request


def collect_directory_files(directory_path: str) -> List[Tuple[str, str]]:
    """
    Recursively collect all files from a directory.
    
    Args:
        directory_path: Path to the directory to collect files from
        
    Returns:
        List of tuples (relative_path, absolute_path) for each file
    """
    directory = Path(directory_path)
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory_path}")
    
    if not directory.is_dir():
        raise NotADirectoryError(f"Path is not a directory: {directory_path}")
    
    files = []
    for file_path in directory.rglob("*"):
        if file_path.is_file():
            # Get relative path from the directory root
            relative_path = file_path.relative_to(directory)
            files.append((str(relative_path), str(file_path.absolute())))
    
    return files


def validate_directory_for_upload(directory_path: str, max_files: int = 1000, max_size_mb: int = 100) -> Dict:
    """
    Validate a directory for upload, checking file count and total size.
    
    Args:
        directory_path: Path to the directory to validate
        max_files: Maximum number of files allowed
        max_size_mb: Maximum total size in MB
        
    Returns:
        Dict with validation results and file information
    """
    files = collect_directory_files(directory_path)
    
    if len(files) > max_files:
        raise ValueError(f"Directory contains too many files ({len(files)}). Maximum allowed: {max_files}")
    
    total_size = 0
    file_info = []
    
    for relative_path, absolute_path in files:
        file_size = os.path.getsize(absolute_path)
        total_size += file_size
        
        # Get MIME type
        mime_type, _ = mimetypes.guess_type(absolute_path)
        
        file_info.append({
            "relative_path": relative_path,
            "absolute_path": absolute_path,
            "size": file_size,
            "mime_type": mime_type or "application/octet-stream"
        })
    
    total_size_mb = total_size / (1024 * 1024)
    if total_size_mb > max_size_mb:
        raise ValueError(f"Directory size too large ({total_size_mb:.2f}MB). Maximum allowed: {max_size_mb}MB")
    
    return {
        "valid": True,
        "file_count": len(files),
        "total_size_mb": total_size_mb,
        "files": file_info
    }


def upload_directory(
    directory_path: str, 
    console: Console, 
    dir_name: Optional[str] = None
) -> str:
    """
    Upload a directory to the server using the /instances/upload endpoint.
    
    Args:
        directory_path: Path to the directory to upload
        console: Rich console for progress display
        dir_name: Optional custom name for the directory
        
    Returns:
        The uploaded directory path that can be used in launch requests
    """
    # Validate directory first
    validation_result = validate_directory_for_upload(directory_path)
    files = validation_result["files"]
    
    console.print(f"[bold blue]Uploading directory:[/bold blue] {directory_path}")
    console.print(f"[dim]Files: {validation_result['file_count']}, Size: {validation_result['total_size_mb']:.2f}MB[/dim]")
    
    # Prepare files for upload
    dir_files = []
    for file_info in files:
        with open(file_info["absolute_path"], "rb") as f:
            file_content = f.read()
        
        # Create a file-like object for requests
        from io import BytesIO
        file_obj = BytesIO(file_content)
        file_obj.name = file_info["relative_path"]
        
        dir_files.append(("dir_files", (file_info["relative_path"], file_obj, file_info["mime_type"])))
    
    # Use the directory name or derive from path
    if not dir_name:
        dir_name = os.path.basename(os.path.abspath(directory_path))
    
    # Prepare form data
    form_data = {"dir_name": dir_name}
    
    # Show progress
    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]Uploading files...[/bold blue]"),
        BarColumn(),
        TaskProgressColumn(),
        transient=False,
    ) as progress:
        task = progress.add_task("", total=len(files))
        
        try:
            # Make the upload request
            resp = api_request(
                "POST", 
                "/instances/upload", 
                files=dir_files,
                data=form_data,
                auth_needed=True
            )
            
            progress.update(task, completed=len(files))
            
            if resp.status_code == 200:
                resp_data = resp.json()
                uploaded_files = resp_data.get("uploaded_files", {})
                dir_files_info = uploaded_files.get("dir_files", {})
                uploaded_dir = dir_files_info.get("uploaded_dir")
                
                if uploaded_dir:
                    console.print("[bold green]✓[/bold green] Directory uploaded successfully!")
                    return uploaded_dir
                else:
                    raise Exception("Upload response missing directory path")
            else:
                console.print("[bold red]✗[/bold red] Failed to upload directory.")
                console.print(f"[bold]Status Code:[/bold] {resp.status_code}")
                try:
                    error_data = resp.json()
                    console.print(f"[bold]Error:[/bold] {error_data.get('detail', 'Unknown error')}")
                except Exception:
                    console.print(f"[bold]Error:[/bold] {resp.text}")
                raise Exception(f"Upload failed with status {resp.status_code}")
                
        except Exception as e:
            console.print(f"[bold red]✗[/bold red] Error uploading directory: {str(e)}")
            raise
