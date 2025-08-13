from __future__ import annotations

import os
from typing import List, Optional

import workos
from .auth_provider import (
	AuthProvider,
	AuthSession,
	AuthUser,
	Organization,
	OrganizationMembership,
	Invitation,
)


class WorkOSSession(AuthSession):
	def __init__(self, session):
		# session is a WorkOS Session/Auth response object
		self._session = session
		# Normalize common surface
		self.authenticated = bool(getattr(session, "authenticated", False))
		self.sealed_session = getattr(session, "sealed_session", None)
		self.role = getattr(session, "role", None)
		self.organization_id = getattr(session, "organization_id", None)
		# Map user if present
		w_user = getattr(session, "user", None)
		if w_user is not None:
			self.user = AuthUser(
				id=w_user.id,
				email=getattr(w_user, "email", None),
				first_name=getattr(w_user, "first_name", None),
				last_name=getattr(w_user, "last_name", None),
				profile_picture_url=getattr(w_user, "profile_picture_url", None),
			)
		else:
			self.user = None

	def authenticate(self) -> "WorkOSSession":
		auth_response = self._session.authenticate()
		return WorkOSSession(auth_response)

	def refresh(self) -> "WorkOSSession":
		refreshed = self._session.refresh()
		return WorkOSSession(refreshed)

	def get_logout_url(self) -> str:
		return self._session.get_logout_url()


class WorkOSProvider(AuthProvider):
	def __init__(
		self,
		*,
		api_key: Optional[str] = None,
		client_id: Optional[str] = None,
		workos_client: Optional["workos.WorkOSClient"] = None,
	):
		# Initialize a dedicated WorkOS client for this provider instance.
		self._client = workos_client or workos.WorkOSClient(
			api_key=api_key or os.getenv("AUTH_API_KEY"),
			client_id=client_id or os.getenv("AUTH_CLIENT_ID"),
		)

	# Authorization/Login
	def get_authorization_url(self, *, redirect_uri: str, provider: Optional[str] = None) -> str:
		return self._client.user_management.get_authorization_url(
			provider=provider or "authkit",
			redirect_uri=redirect_uri,
		)

	def authenticate_with_code(
		self, *, code: str, seal_session: bool, cookie_password: str
	) -> AuthSession:
		sess = self._client.user_management.authenticate_with_code(
			code=code,
			session={"seal_session": seal_session, "cookie_password": cookie_password},
		)
		return WorkOSSession(sess)

	def authenticate_with_refresh_token(
		self,
		*,
		refresh_token: str,
		organization_id: Optional[str],
		seal_session: bool,
		cookie_password: str,
	) -> AuthSession:
		sess = self._client.user_management.authenticate_with_refresh_token(
			refresh_token=refresh_token,
			organization_id=organization_id,
			session={"seal_session": seal_session, "cookie_password": cookie_password},
		)
		return WorkOSSession(sess)

	def load_sealed_session(self, *, sealed_session: str, cookie_password: str) -> AuthSession:
		sess = self._client.user_management.load_sealed_session(
			sealed_session=sealed_session, cookie_password=cookie_password
		)
		return WorkOSSession(sess)

	# Organizations
	def create_organization(self, *, name: str, domains: Optional[List[str]] = None) -> Organization:
		params = {"name": name}
		if domains:
			params["domain_data"] = [{"domain": d, "state": "pending"} for d in domains]
		org = self._client.organizations.create_organization(**params)
		return Organization(id=org.id, name=org.name)

	def get_organization(self, *, organization_id: str) -> Organization:
		org = self._client.organizations.get_organization(organization_id=organization_id)
		return Organization(id=org.id, name=org.name)

	def delete_organization(self, *, organization_id: str) -> None:
		self._client.organizations.delete_organization(organization_id=organization_id)

	# Memberships
	def list_organization_memberships(
		self, *, user_id: Optional[str] = None, organization_id: Optional[str] = None
	) -> List[OrganizationMembership]:
		memberships = self._client.user_management.list_organization_memberships(
			user_id=user_id, organization_id=organization_id
		)
		res: List[OrganizationMembership] = []
		for m in memberships:
			res.append(
				OrganizationMembership(
					id=m.id,
					user_id=m.user_id,
					organization_id=m.organization_id,
					role=getattr(m, "role", None),
				)
			)
		return res

	def create_organization_membership(
		self, *, organization_id: str, user_id: str, role_slug: str
	) -> OrganizationMembership:
		m = self._client.user_management.create_organization_membership(
			organization_id=organization_id, user_id=user_id, role_slug=role_slug
		)
		return OrganizationMembership(
			id=m.id, user_id=m.user_id, organization_id=m.organization_id, role=getattr(m, "role", None)
		)

	def delete_organization_membership(self, *, organization_membership_id: str) -> None:
		self._client.user_management.delete_organization_membership(
			organization_membership_id=organization_membership_id
		)

	def update_organization_membership(
		self, *, organization_membership_id: str, role_slug: str
	) -> OrganizationMembership:
		m = self._client.user_management.update_organization_membership(
			organization_membership_id=organization_membership_id, role_slug=role_slug
		)
		return OrganizationMembership(
			id=m.id, user_id=m.user_id, organization_id=m.organization_id, role=getattr(m, "role", None)
		)

	# Users
	def get_user(self, *, user_id: str) -> AuthUser:
		u = self._client.user_management.get_user(user_id=user_id)
		return AuthUser(
			id=u.id,
			email=getattr(u, "email", None),
			first_name=getattr(u, "first_name", None),
			last_name=getattr(u, "last_name", None),
			profile_picture_url=getattr(u, "profile_picture_url", None),
		)

	# Invitations
	def send_invitation(
		self,
		*,
		email: str,
		organization_id: str,
		expires_in_days: Optional[int] = None,
		inviter_user_id: Optional[str] = None,
		role_slug: Optional[str] = None,
	) -> Invitation:
		params = {"email": email, "organization_id": organization_id}
		if expires_in_days is not None:
			params["expires_in_days"] = expires_in_days
		if inviter_user_id is not None:
			params["inviter_user_id"] = inviter_user_id
		if role_slug is not None:
			params["role_slug"] = role_slug
		inv = self._client.user_management.send_invitation(**params)
		return Invitation(
			id=inv.id,
			email=inv.email,
			organization_id=inv.organization_id,
			state=getattr(inv, "state", None),
		)


# Singleton provider instance used by routes and utils
provider = WorkOSProvider()

