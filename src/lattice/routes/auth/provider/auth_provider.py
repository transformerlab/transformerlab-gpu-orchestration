from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class AuthUser:
	id: str
	email: Optional[str] = None
	first_name: Optional[str] = None
	last_name: Optional[str] = None
	profile_picture_url: Optional[str] = None


@dataclass
class Organization:
	id: str
	name: str


@dataclass
class OrganizationMembership:
	id: str
	user_id: str
	organization_id: str
	# role slug or role object; use slug string for simplicity
	role: str | dict


@dataclass
class Invitation:
	id: str
	email: str
	organization_id: str
	state: Optional[str] = None


class AuthSession(ABC):
	"""Abstract authenticated session wrapper returned by providers."""

	authenticated: bool
	sealed_session: Optional[str]
	user: Optional[AuthUser]
	role: Optional[str | dict]
	organization_id: Optional[str]
	refresh_token: Optional[str]

	@abstractmethod
	def authenticate(self) -> "AuthSession":
		"""Authenticate the session; returns the updated session wrapper."""
		raise NotImplementedError

	@abstractmethod
	def refresh(self) -> "AuthSession":
		"""Refresh the session; returns the refreshed session wrapper."""
		raise NotImplementedError

	@abstractmethod
	def get_logout_url(self) -> str:
		raise NotImplementedError


class AuthProvider(ABC):
	"""Base abstraction for auth/user management providers."""

	# Authorization/Login
	@abstractmethod
	def get_authorization_url(self, *, redirect_uri: str, provider: Optional[str] = None) -> str:
		raise NotImplementedError

	@abstractmethod
	def authenticate_with_code(
		self,
		*,
		code: str,
		seal_session: bool,
		cookie_password: str,
	) -> AuthSession:
		raise NotImplementedError

	@abstractmethod
	def authenticate_with_refresh_token(
		self,
		*,
		refresh_token: str,
		organization_id: Optional[str],
		seal_session: bool,
		cookie_password: str,
	) -> AuthSession:
		raise NotImplementedError

	@abstractmethod
	def load_sealed_session(self, *, sealed_session: str, cookie_password: str) -> AuthSession:
		raise NotImplementedError

	# Organizations
	@abstractmethod
	def create_organization(self, *, name: str, domains: Optional[List[str]] = None) -> Organization:
		raise NotImplementedError

	@abstractmethod
	def get_organization(self, *, organization_id: str) -> Organization:
		raise NotImplementedError

	@abstractmethod
	def delete_organization(self, *, organization_id: str) -> None:
		raise NotImplementedError

	# Memberships
	@abstractmethod
	def list_organization_memberships(
		self, *, user_id: Optional[str] = None, organization_id: Optional[str] = None
	) -> List[OrganizationMembership]:
		raise NotImplementedError

	@abstractmethod
	def create_organization_membership(
		self, *, organization_id: str, user_id: str, role_slug: str
	) -> OrganizationMembership:
		raise NotImplementedError

	@abstractmethod
	def delete_organization_membership(self, *, organization_membership_id: str) -> None:
		raise NotImplementedError

	@abstractmethod
	def update_organization_membership(
		self, *, organization_membership_id: str, role_slug: str
	) -> OrganizationMembership:
		raise NotImplementedError

	# Users
	@abstractmethod
	def get_user(self, *, user_id: str) -> AuthUser:
		raise NotImplementedError

	@abstractmethod
	def get_users(self, *, user_ids: List[str]) -> List[AuthUser]:
		"""Fetch multiple users in parallel and return them in the same order as user_ids."""
		raise NotImplementedError

	# Invitations
	@abstractmethod
	def send_invitation(
		self,
		*,
		email: str,
		organization_id: str,
		expires_in_days: Optional[int] = None,
		inviter_user_id: Optional[str] = None,
		role_slug: Optional[str] = None,
	) -> Invitation:
		raise NotImplementedError

