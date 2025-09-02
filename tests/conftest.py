import os
import sys
from pathlib import Path


def pytest_sessionstart(session):
    """Configure test environment before any tests run.

    - Ensure `src` is on `sys.path` so `import lattice` works without install.
    - Use in-memory SQLite to avoid touching the local filesystem DB.
    - Point HOME to a temp folder inside the repo so any code that writes to
      `~/.sky` or similar does not touch the developer's actual home.
    """
    repo_root = Path(__file__).resolve().parents[1]
    src_path = repo_root / "src"
    lattice_src_path = src_path / "lattice"
    # Add both `src` (for `import lattice`) and `src/lattice` (to support
    # the app's top-level imports like `from config import ...`).
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
    if str(lattice_src_path) not in sys.path:
        sys.path.insert(0, str(lattice_src_path))

    # Use a file-based SQLite DB for tests to ensure one shared connection
    # across sessions and subprocesses inside the same run.
    test_db_path = (repo_root / "tests" / ".tmp_home" / "test.db").resolve()
    test_db_path.parent.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{test_db_path}")

    # Isolate $HOME for tests to keep any side-effects contained in repo
    test_home = repo_root / "tests" / ".tmp_home"
    test_home.mkdir(parents=True, exist_ok=True)
    os.environ["HOME"] = str(test_home)

    # Map legacy package imports to canonical lattice.* modules to avoid
    # duplicate model definitions (e.g., both 'db.db_models' and
    # 'lattice.db.db_models' being imported).
    import importlib
    import sys as _sys
    try:
        _lattice_config = importlib.import_module("lattice.config")
        _sys.modules.setdefault("config", _lattice_config)
    except Exception:
        pass
    try:
        _lattice_db = importlib.import_module("lattice.db")
        _sys.modules.setdefault("db", _lattice_db)
        _sys.modules.setdefault("db.base", importlib.import_module("lattice.db.base"))
        _sys.modules.setdefault(
            "db.db_models", importlib.import_module("lattice.db.db_models")
        )
    except Exception:
        pass

    # Create database schema up front
    try:
        # Delay imports until after sys.path and env are set
        from lattice.db.base import Base
        import lattice.db.db_models  # noqa: F401  # register models
        from lattice.config import engine

        Base.metadata.create_all(bind=engine)
    except Exception as e:
        # Do not fail early; individual tests can still handle lazy creation
        print(f"[tests] Warning: failed to pre-create DB schema: {e}")
