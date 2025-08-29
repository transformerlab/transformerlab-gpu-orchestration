import importlib
from typing import Iterable


def _route_paths(app) -> Iterable[tuple[str, set[str]]]:
    for r in app.routes:
        path = getattr(r, "path", None)
        methods = set(getattr(r, "methods", set()) or set())
        if path:
            yield path, methods


def test_app_imports_and_exposes_auth_login_url_route():
    # Import after conftest sets env and path
    main = importlib.import_module("lattice.main")
    app = main.app

    assert app.title == "Lattice"

    # Verify a representative route is registered
    expected_path = "/api/v1/auth/login-url"
    has_route = any(
        path == expected_path and ("GET" in methods)
        for path, methods in _route_paths(app)
    )
    assert has_route, f"Expected route not found: {expected_path}"

