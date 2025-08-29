from fastapi import HTTPException, Security, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import and_
from config import SessionLocal
from db.db_models import APIKey
from .utils import get_current_user
from typing import Optional
import json
from .provider.work_os import provider as auth_provider
from config import CSRF_ENABLED, CORS_ALLOW_ORIGINS

security = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_api_key_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db),
) -> Optional[dict]:
    """
    Validate API key and return user information.
    Returns None if no valid API key is provided.
    """
    if not credentials or not credentials.credentials:
        return None

    api_key = credentials.credentials

    # Check if it's a lattice API key
    if not api_key.startswith("lk_"):
        return None

    try:
        # Hash the provided key
        key_hash = APIKey.hash_key(api_key)

        # Find the API key in the database
        api_key_record = (
            db.query(APIKey)
            .filter(and_(APIKey.key_hash == key_hash, APIKey.is_active == True))  # noqa: E712
            .first()
        )

        if not api_key_record:
            return None

        # Check if the key is expired
        if api_key_record.is_expired():
            return None

        # If org missing, try to infer from user's memberships and persist
        try:
            if not api_key_record.organization_id:
                memberships = auth_provider.list_organization_memberships(
                    user_id=api_key_record.user_id
                )
                if memberships:
                    # choose the first membership as default
                    api_key_record.organization_id = memberships[0].organization_id
        except Exception as _org_err:
            pass

        # Update last used time and persist any inferred org
        api_key_record.update_last_used()
        db.commit()

        # Parse scopes robustly (treat invalid as []) and normalize to lowercase
        scopes = []
        try:
            if api_key_record.scopes:
                parsed = json.loads(api_key_record.scopes)
                if isinstance(parsed, list):
                    norm = []
                    seen = set()
                    for s in parsed:
                        if isinstance(s, str):
                            v = s.strip().lower()
                            if v and v not in seen:
                                seen.add(v)
                                norm.append(v)
                    scopes = norm
        except Exception:
            scopes = []

        return {
            "id": api_key_record.user_id,
            "organization_id": api_key_record.organization_id,
            "api_key_id": api_key_record.id,
            "api_key_name": api_key_record.name,
            "scopes": scopes,
            "auth_method": "api_key",
        }

    except Exception as e:
        # Log the error but don't expose it
        print(f"API key validation error: {str(e)}")
        return None


async def get_user_or_api_key(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> dict:
    """
    Get user from either API key or session authentication.
    Prioritizes API key authentication if present.
    """
    # First try API key authentication
    api_user = await get_api_key_user(credentials, db)
    if api_user:
        return api_user

    # Fall back to session authentication
    try:
        session_user = get_current_user(request, response)
        if session_user:
            session_user["auth_method"] = "session"
            return session_user
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Invalid authentication credentials")


def require_scope(required_scope: str):
    """
    Dependency to check if the authenticated user has a required scope.
    Only applies to API key authentication - session users have full access.
    """

    async def scope_checker(
        request: Request, response: Response, user: dict = Depends(get_user_or_api_key)
    ) -> dict:
        # Session users have full access
        if user.get("auth_method") == "session":
            return user

        # API key users need to have the required scope
        user_scopes = user.get("scopes", [])
        if required_scope not in user_scopes and "admin" not in user_scopes:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required scope: {required_scope}",
            )

        return user

    return scope_checker


def enforce_csrf(
    request: Request,
    response: Response,
    user: dict = Depends(get_user_or_api_key),
):
    """Dependency to enforce CSRF on state-changing requests when using session auth.

    Skips enforcement for API key-authenticated requests.
    """
    if not CSRF_ENABLED:
        return True

    method = request.method.upper()
    if method not in ("POST", "PUT", "PATCH", "DELETE"):
        return True

    # Skip for API key flows
    if isinstance(user, dict) and user.get("auth_method") == "api_key":
        return True

    header_token = request.headers.get("x-csrf-token")
    cookie_token = request.cookies.get("wos_csrf")
    if header_token and cookie_token and header_token == cookie_token:
        return True

    # Fallback: strict Origin/Referer allow-list match (defense-in-depth, supports clients without header echo)
    try:
        from urllib.parse import urlsplit

        def _normalize_origin(o: str | None) -> str | None:
            if not o:
                return None
            u = urlsplit(o.strip())
            if not u.scheme or not u.hostname:
                return None
            host = u.hostname.lower()
            port = f":{u.port}" if u.port and u.port not in (80, 443) else ""
            return f"{u.scheme.lower()}://{host}{port}"

        allowed = {_normalize_origin(x) for x in (CORS_ALLOW_ORIGINS or [])}
        origin = _normalize_origin(request.headers.get("origin"))
        if origin and origin in allowed:
            return True
        referer = _normalize_origin(request.headers.get("referer"))
        if referer and referer in allowed:
            return True
    except Exception:
        pass

    raise HTTPException(status_code=403, detail="CSRF check failed")
    return True
