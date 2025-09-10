import os
import json
from pathlib import Path


def test_get_cluster_job_queue_success_and_error(monkeypatch):
    import lattice.routes.jobs.utils as ju

    # Success path
    monkeypatch.setattr(ju.sky, "queue", lambda cluster_name, credentials=None: "req-1")
    monkeypatch.setattr(ju.sky, "get", lambda req_id: [{"job_id": 1}])
    out = ju.get_cluster_job_queue("c1")
    assert isinstance(out, list) and out[0]["job_id"] == 1

    # Error path
    def _boom(*a, **k):
        raise RuntimeError("fail")

    monkeypatch.setattr(ju.sky, "queue", _boom)
    try:
        ju.get_cluster_job_queue("c2")
    except Exception as e:
        # HTTPException from FastAPI is expected
        from fastapi import HTTPException

        assert isinstance(e, HTTPException) and e.status_code == 500


def test_get_job_logs_file_and_dir(monkeypatch, tmp_path):
    import lattice.routes.jobs.utils as ju

    # Avoid creds lookup by returning None platform info
    monkeypatch.setattr(ju, "get_cluster_platform_info_util", lambda name: None)

    # Case 1: direct file path
    log_file = tmp_path / "job.log"
    log_file.write_text("line1\nline2\nline3\n")
    monkeypatch.setattr(
        ju.sky, "download_logs", lambda cluster, job_ids, credentials=None: {"123": str(log_file)}
    )
    logs = ju.get_job_logs("c1", 123, tail_lines=2)
    assert logs.strip().splitlines() == ["line2", "line3"]

    # Case 2: directory containing run.log
    run_dir = tmp_path / "job_dir"
    run_dir.mkdir()
    (run_dir / "run.log").write_text("abc\n")
    monkeypatch.setattr(
        ju.sky, "download_logs", lambda cluster, job_ids, credentials=None: {"124": str(run_dir)}
    )
    logs2 = ju.get_job_logs("c1", 124)
    assert "abc" in logs2

    # Case 3: missing file -> 404
    monkeypatch.setattr(
        ju.sky,
        "download_logs",
        lambda cluster, job_ids, credentials=None: {"125": str(tmp_path / "missing")},
    )
    from fastapi import HTTPException

    try:
        ju.get_job_logs("c1", 125)
        assert False, "expected 404"
    except HTTPException as e:
        assert e.status_code == 404


def test_save_and_get_past_jobs(monkeypatch, tmp_path):
    import lattice.routes.jobs.utils as ju
    from lattice.utils.cluster_utils import create_cluster_platform_entry
    from lattice.config import SessionLocal

    # Ensure HOME/.sky/lattice_data exists under test HOME already set in conftest
    home = Path(os.path.expanduser("~"))
    lattice_dir = home / ".sky" / "lattice_data"
    (lattice_dir / "jobs").mkdir(parents=True, exist_ok=True)
    (lattice_dir / "logs").mkdir(parents=True, exist_ok=True)

    # Monkeypatch get_job_logs to avoid sky
    monkeypatch.setattr(ju, "get_job_logs", lambda *a, **k: "LOGS")

    # Create a cluster display name in DB for filtering
    db = SessionLocal()
    try:
        user = "u-j"
        org = "o-j"
        create_cluster_platform_entry("display1", "runpod", user, org, db=db)

        # Save jobs for that display name
        path = ju.save_cluster_jobs(
            cluster_name="display1",
            jobs=[{"job_id": 7, "job_name": "A", "resources": "", "status": "RUNNING", "username": "u"}],
            user_id=user,
            organization_id=org,
        )
        assert path and Path(path).exists()

        # Read back with get_past_jobs
        res = ju.get_past_jobs(user_id=user, organization_id=org)
        assert isinstance(res, list) and any(item.get("cluster_name") == "display1" for item in res)
    finally:
        db.close()

