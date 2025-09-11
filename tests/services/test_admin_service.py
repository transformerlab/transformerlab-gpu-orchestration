import types
import pytest


class _M:
    def __init__(self, id, user_id, org_id, role):
        self.id = id
        self.user_id = user_id
        self.organization_id = org_id
        self.role = role


class _Org:
    def __init__(self, id, name):
        self.id = id
        self.name = name


class _User:
    def __init__(self, id, email="u@example.com", first_name="A", last_name="B", purl=None):
        self.id = id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.profile_picture_url = purl


class FakeProvider:
    def __init__(self):
        # Seed memberships for two orgs
        self.memberships_by_org = {
            "org1": [
                _M("m1", "u1", "org1", "admin"),
                _M("m2", "u2", "org1", "member"),
            ],
            "org2": [
                _M("m3", "u1", "org2", "member"),
            ],
        }
        self.orgs = {"org1": _Org("org1", "One"), "org2": _Org("org2", "Two")}

    def list_organization_memberships(self, user_id=None, organization_id=None):
        if organization_id:
            return list(self.memberships_by_org.get(organization_id, []))
        # When called with user_id, return all memberships across orgs for that user
        res = []
        for org_id, arr in self.memberships_by_org.items():
            for m in arr:
                if m.user_id == user_id:
                    res.append(m)
        return res

    def get_organization(self, organization_id):
        if organization_id == "org-missing":
            raise RuntimeError("not found")
        return self.orgs[organization_id]

    def create_organization(self, name, domains=None):
        oid = f"org-{len(self.orgs)+1}"
        org = _Org(oid, name)
        self.orgs[oid] = org
        return org

    def create_organization_membership(self, organization_id, user_id, role_slug):
        m = _M(f"m-{organization_id}-{user_id}", user_id, organization_id, role_slug)
        self.memberships_by_org.setdefault(organization_id, []).append(m)
        return m

    def delete_organization(self, organization_id):
        self.orgs.pop(organization_id, None)

    def delete_organization_membership(self, organization_membership_id):
        for arr in self.memberships_by_org.values():
            arr[:] = [m for m in arr if m.id != organization_membership_id]

    def update_organization_membership(self, organization_membership_id, role_slug):
        for arr in self.memberships_by_org.values():
            for m in arr:
                if m.id == organization_membership_id:
                    m.role = role_slug
                    return m
        raise RuntimeError("membership not found")

    def send_invitation(self, **kwargs):
        return types.SimpleNamespace(
            id="inv1",
            email=kwargs.get("email"),
            organization_id=kwargs.get("organization_id"),
            state="pending",
        )

    def get_user(self, user_id):
        return _User(user_id)


@pytest.fixture()
def monkeypatched_admin_provider(monkeypatch):
    from lattice.services.admin import admin_service

    fp = FakeProvider()
    monkeypatch.setattr(admin_service, "auth_provider", fp)
    return fp


def test_list_all_organizations(monkeypatched_admin_provider):
    from lattice.services.admin.admin_service import list_all_organizations

    user = {"id": "u1", "organization_id": "org1"}
    resp = list_all_organizations(user)
    assert resp.current_organization_id == "org1"
    ids = {o.id for o in resp.organizations}
    assert ids == {"org1", "org2"}


def test_remove_member_last_admin_blocked(monkeypatched_admin_provider):
    from lattice.services.admin.admin_service import remove_organization_member
    from fastapi import HTTPException

    # Only one admin in org1 -> cannot remove
    with pytest.raises(HTTPException) as ei:
        remove_organization_member("org1", "u1")
    assert ei.value.status_code == 400

    # Add another admin, then removal is allowed
    fp = monkeypatched_admin_provider
    fp.create_organization_membership("org1", "u3", "admin")
    out = remove_organization_member("org1", "u1")
    assert out["message"].startswith("Member removed")


def test_update_member_role_last_admin_blocked(monkeypatched_admin_provider):
    from lattice.services.admin.admin_service import update_member_role
    from lattice.models import UpdateMemberRoleRequest
    from fastapi import HTTPException

    # Reset org1 to have single admin (u3 from previous test still exists; ensure single)
    fp = monkeypatched_admin_provider
    fp.memberships_by_org["org1"] = [
        _M("m1", "u1", "org1", "admin"),
        _M("m2", "u2", "org1", "member"),
    ]

    with pytest.raises(HTTPException) as ei:
        update_member_role("org1", "u1", {"id": "u2"}, UpdateMemberRoleRequest(role="member"))
    assert ei.value.status_code == 400

    # Add second admin and allow change
    fp.create_organization_membership("org1", "u3", "admin")
    out = update_member_role("org1", "u1", {"id": "u1"}, UpdateMemberRoleRequest(role="member"))
    assert out["new_role"] == "member"
    assert out["is_self_update"] is True


def test_send_invitation_and_list_members(monkeypatched_admin_provider):
    from lattice.services.admin.admin_service import send_organization_invitation, list_organization_members
    from lattice.models import SendInvitationRequest

    inv = send_organization_invitation("org1", SendInvitationRequest(email="u4@example.com"))
    assert inv["invitation_id"] == "inv1"
    assert inv["email"] == "u4@example.com"

    listing = list_organization_members("org1", {"id": "u2"})
    assert listing["admin_count"] >= 1
    # Ensure shape of members
    assert {"user_id", "email", "first_name", "last_name", "can_be_removed"}.issubset(listing["members"][0].keys())

