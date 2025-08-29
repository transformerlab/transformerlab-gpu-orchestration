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

    # Use in-memory SQLite by default for tests
    os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

    # Isolate $HOME for tests to keep any side-effects contained in repo
    test_home = repo_root / "tests" / ".tmp_home"
    test_home.mkdir(parents=True, exist_ok=True)
    os.environ["HOME"] = str(test_home)
