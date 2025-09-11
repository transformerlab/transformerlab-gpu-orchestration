from typing import Optional


def normalize_key(name: str) -> str:
    return str(name or "").strip().lower().replace(" ", "_").replace("-", "_")


def require_org_id(organization_id: Optional[str]) -> str:
    if not organization_id or not str(organization_id).strip():
        raise ValueError("organization_id is required")
    return str(organization_id)

