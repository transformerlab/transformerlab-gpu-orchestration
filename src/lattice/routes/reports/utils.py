import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from lattice.models import ReportData


def get_reports_dir() -> Path:
    """Get the reports directory path (~/.sky/reports)"""
    home_dir = Path.home()
    reports_dir = home_dir / ".sky" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def get_user_reports_dir(user_id: str) -> Path:
    """Get the user-specific reports directory"""
    reports_dir = get_reports_dir()
    user_dir = reports_dir / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def save_report_entry(user_id: str, report_type: str, data: Dict[str, Any]) -> None:
    """Save a report entry to the user's reports directory"""
    user_dir = get_user_reports_dir(user_id)
    report_file = user_dir / f"{report_type}.jsonl"

    # Add timestamp if not present
    if "timestamp" not in data:
        data["timestamp"] = time.time()

    # Add user_id if not present
    if "user_id" not in data:
        data["user_id"] = user_id

    # Append to the file
    with open(report_file, "a") as f:
        f.write(json.dumps(data) + "\n")


def load_report_entries(
    user_id: str, report_type: str, days: int = 30
) -> List[Dict[str, Any]]:
    """Load report entries for a user from the last N days"""
    user_dir = get_user_reports_dir(user_id)
    report_file = user_dir / f"{report_type}.jsonl"

    if not report_file.exists():
        return []

    cutoff_time = time.time() - (days * 24 * 60 * 60)
    entries = []

    with open(report_file, "r") as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                if entry.get("timestamp", 0) >= cutoff_time:
                    entries.append(entry)
            except json.JSONDecodeError:
                continue

    return entries


def record_usage(
    user_id: str,
    cluster_name: str,
    usage_type: str,
    node_ip: Optional[str] = None,
    job_id: Optional[int] = None,
    duration_minutes: Optional[float] = None,
) -> None:
    """Record a usage event"""
    data = {
        "cluster_name": cluster_name,
        "usage_type": usage_type,
        "node_ip": node_ip,
        "job_id": job_id,
        "duration_minutes": duration_minutes,
    }
    save_report_entry(user_id, "usage", data)


def record_availability(
    user_id: str,
    cluster_name: str,
    availability_type: str,
    total_nodes: int,
    available_nodes: int,
    node_ip: Optional[str] = None,
) -> None:
    """Record an availability event"""
    data = {
        "cluster_name": cluster_name,
        "availability_type": availability_type,
        "total_nodes": total_nodes,
        "available_nodes": available_nodes,
        "node_ip": node_ip,
    }
    save_report_entry(user_id, "availability", data)


def record_job_success(
    user_id: str,
    cluster_name: str,
    job_id: int,
    job_name: str,
    success: bool,
    duration_minutes: Optional[float] = None,
    error_message: Optional[str] = None,
) -> None:
    """Record a job success/failure event"""
    data = {
        "cluster_name": cluster_name,
        "job_id": job_id,
        "job_name": job_name,
        "success": success,
        "duration_minutes": duration_minutes,
        "error_message": error_message,
    }
    save_report_entry(user_id, "job_success", data)


def aggregate_daily_data(
    entries: List[Dict[str, Any]], value_key: str = "value"
) -> List[ReportData]:
    """Aggregate entries into daily data points"""
    daily_data = {}

    for entry in entries:
        timestamp = entry.get("timestamp", 0)
        date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
        value = entry.get(value_key, 0)

        if date not in daily_data:
            daily_data[date] = []
        daily_data[date].append(value)

    # Calculate daily averages
    result = []
    for date in sorted(daily_data.keys()):
        values = daily_data[date]
        avg_value = sum(values) / len(values) if values else 0
        result.append(ReportData(date=date, value=round(avg_value, 2)))

    return result


def get_usage_data(user_id: str, days: int = 30) -> List[ReportData]:
    """Get aggregated usage data for the last N days"""
    entries = load_report_entries(user_id, "usage", days)

    # Convert usage events to daily usage percentages
    daily_usage = {}
    for entry in entries:
        timestamp = entry.get("timestamp", 0)
        date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
        duration_minutes = entry.get("duration_minutes")
        if duration_minutes is None:
            duration = 0
        else:
            duration = duration_minutes / 60  # Convert to hours

        if date not in daily_usage:
            daily_usage[date] = 0
        daily_usage[date] += duration

    # Convert to percentage (assuming 24 hours per day)
    result = []
    for date in sorted(daily_usage.keys()):
        usage_hours = daily_usage[date]
        usage_percent = min(100, (usage_hours / 24) * 100)
        result.append(ReportData(date=date, value=round(usage_percent, 2)))

    return result


def get_availability_data(user_id: str, days: int = 30) -> List[ReportData]:
    """Get aggregated availability data for the last N days"""
    entries = load_report_entries(user_id, "availability", days)

    # Calculate daily availability percentages
    daily_availability = {}
    for entry in entries:
        timestamp = entry.get("timestamp", 0)
        date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
        total_nodes = entry.get("total_nodes", 0)
        available_nodes = entry.get("available_nodes", 0)

        if total_nodes > 0:
            availability_percent = (available_nodes / total_nodes) * 100
        else:
            availability_percent = 0

        if date not in daily_availability:
            daily_availability[date] = []
        daily_availability[date].append(availability_percent)

    # Calculate daily averages
    result = []
    for date in sorted(daily_availability.keys()):
        values = daily_availability[date]
        avg_value = sum(values) / len(values) if values else 0
        result.append(ReportData(date=date, value=round(avg_value, 2)))

    return result


def get_job_success_data(user_id: str, days: int = 30) -> List[ReportData]:
    """Get aggregated job success data for the last N days"""
    entries = load_report_entries(user_id, "job_success", days)

    # Calculate daily success rates
    daily_success = {}
    for entry in entries:
        timestamp = entry.get("timestamp", 0)
        date = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
        success = entry.get("success", False)

        if date not in daily_success:
            daily_success[date] = {"successful": 0, "total": 0}

        daily_success[date]["total"] += 1
        if success:
            daily_success[date]["successful"] += 1

    # Calculate daily success percentages
    result = []
    for date in sorted(daily_success.keys()):
        data = daily_success[date]
        if data["total"] > 0:
            success_rate = (data["successful"] / data["total"]) * 100
        else:
            success_rate = 0
        result.append(ReportData(date=date, value=round(success_rate, 2)))

    return result


def get_reports_summary(user_id: str, days: int = 30) -> Dict[str, Any]:
    """Get a summary of all reports for a user"""
    usage_data = get_usage_data(user_id, days)
    availability_data = get_availability_data(user_id, days)
    job_success_data = get_job_success_data(user_id, days)

    # Calculate summary statistics
    job_entries = load_report_entries(user_id, "job_success", days)
    total_jobs = len(job_entries)
    successful_jobs = len([e for e in job_entries if e.get("success", False)])

    usage_entries = load_report_entries(user_id, "usage", days)
    total_usage_hours = (
        sum((e.get("duration_minutes") or 0) for e in usage_entries) / 60
    )

    availability_entries = load_report_entries(user_id, "availability", days)
    if availability_entries:
        total_availability = sum(
            e.get("available_nodes", 0) for e in availability_entries
        )
        total_nodes = sum(e.get("total_nodes", 0) for e in availability_entries)
        avg_availability = (
            (total_availability / total_nodes * 100) if total_nodes > 0 else 0
        )
    else:
        avg_availability = 0

    return {
        "usage": usage_data,
        "availability": availability_data,
        "job_success": job_success_data,
        "total_jobs": total_jobs,
        "successful_jobs": successful_jobs,
        "total_usage_hours": round(total_usage_hours, 2),
        "average_availability_percent": round(avg_availability, 2),
    }
