import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  Avatar,
  Chip,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  Input,
  Select,
  Option,
} from "@mui/joy";
import { Plus, Trash2, Mail, Edit } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useAuth } from "../../../context/AuthContext";
import { buildApiUrl, apiFetch } from "../../../utils/api";

interface OrganizationMember {
  user_id: string;
  role: string | { slug: string };
  email: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
  is_current_user?: boolean;
  can_be_removed?: boolean;
  can_change_role?: boolean;
}

interface OrganizationMembersResponse {
  members: OrganizationMember[];
  admin_count?: number;
}

interface InvitationRequest {
  email: string;
  role_slug?: string;
  expires_in_days?: number;
}

interface UpdateRoleRequest {
  role: string;
}

const Users: React.FC = () => {
  const { user, loading: authLoading, checkAuth, refreshSession } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<OrganizationMember | null>(
    null
  );

  // Invitation modal state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState<InvitationRequest>({
    email: "",
    role_slug: "member",
    expires_in_days: 7,
  });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<OrganizationMember | null>(null);
  const [newRole, setNewRole] = useState<string>("member");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!user) {
        // User is still loading, don't set error yet
        return;
      }

      if (!user.organization_id) {
        setError("No organization ID available");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(
          buildApiUrl(`admin/orgs/${user.organization_id}/members`),
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch organization members");
        }

        const data: OrganizationMembersResponse = await response.json();
        console.log("API Response:", data);
        setMembers(calculatePermissions(data.members));
      } catch (err) {
        console.error("Error fetching members:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch members"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [user]);

  const getDisplayName = (member: OrganizationMember) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name} ${member.last_name}`;
    }
    return member.email;
  };

  const getAvatarUrl = (member: OrganizationMember) => {
    // Use profile_picture_url if available, otherwise fall back to placeholder
    if (member.profile_picture_url) {
      return member.profile_picture_url;
    }

    // Generate a simple avatar based on email hash as fallback
    const hash = member.email.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `https://i.pravatar.cc/150?img=${Math.abs(hash) % 70}`;
  };

  // Helper function to calculate permissions based on current member list
  const calculatePermissions = (memberList: OrganizationMember[]) => {
    const adminCount = memberList.filter(m => {
      const role = typeof m.role === "string" ? m.role : m.role?.slug;
      return role === "admin";
    }).length;

    return memberList.map(member => {
      const memberRole = typeof member.role === "string" ? member.role : member.role?.slug;
      const isAdmin = memberRole === "admin";
      const isOnlyAdmin = isAdmin && adminCount === 1;

      return {
        ...member,
        can_be_removed: !isOnlyAdmin,
        can_change_role: !isOnlyAdmin
      };
    });
  };

  const handleRemoveUser = async (member: OrganizationMember) => {
    if (!user?.organization_id) {
      setError("No organization ID available");
      return;
    }

    try {
      setRemovingUserId(member.user_id);
      setError(null);

      const response = await apiFetch(
        buildApiUrl(
          `admin/orgs/${user.organization_id}/members/${member.user_id}`
        ),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove user from organization");
      }

      // Remove the user from the local state and recalculate permissions
      const updatedMembers = members.filter((m) => m.user_id !== member.user_id);
      setMembers(calculatePermissions(updatedMembers));
      setRemoveDialogOpen(false);
      setUserToRemove(null);
    } catch (err) {
      console.error("Error removing user:", err);
      setError(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setRemovingUserId(null);
    }
  };

  const openRemoveDialog = (member: OrganizationMember) => {
    setUserToRemove(member);
    setRemoveDialogOpen(true);
  };

  const handleInviteUser = async () => {
    if (!user?.organization_id) {
      setInviteError("No organization ID available");
      return;
    }

    if (!inviteForm.email.trim()) {
      setInviteError("Email is required");
      return;
    }

    try {
      setInviting(true);
      setInviteError(null);
      setInviteSuccess(null);

      const response = await apiFetch(
        buildApiUrl(`admin/orgs/${user.organization_id}/invitations`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: inviteForm.email.trim(),
            role_slug: inviteForm.role_slug,
            expires_in_days: inviteForm.expires_in_days,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to send invitation");
      }

      const data = await response.json();
      setInviteSuccess(`Invitation sent successfully to ${inviteForm.email}`);

      setInviteForm({
        email: "",
        role_slug: "member",
        expires_in_days: 7,
      });

      setTimeout(() => {
        setInviteDialogOpen(false);
        setInviteSuccess(null);
      }, 1000);
    } catch (err) {
      console.error("Error sending invitation:", err);
      setInviteError(
        err instanceof Error ? err.message : "Failed to send invitation"
      );
    } finally {
      setInviting(false);
    }
  };

  const openInviteDialog = () => {
    setInviteDialogOpen(true);
    setInviteError(null);
    setInviteSuccess(null);
    setInviteForm({
      email: "",
      role_slug: "member",
      expires_in_days: 7,
    });
  };

  const openRoleDialog = (member: OrganizationMember) => {
    setUserToChangeRole(member);
    setNewRole(
      typeof member.role === "string" 
        ? member.role 
        : member.role?.slug || "member"
    );
    setRoleDialogOpen(true);
    setRoleError(null);
    setRoleSuccess(null);
  };

  const handleRoleChange = async () => {
    if (!user?.organization_id || !userToChangeRole) {
      setRoleError("Missing organization or user information");
      return;
    }

    try {
      setChangingRole(true);
      setRoleError(null);
      setRoleSuccess(null);

      const response = await apiFetch(
        buildApiUrl(
          `admin/orgs/${user.organization_id}/members/${userToChangeRole.user_id}/role`
        ),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            role: newRole,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to update member role");
      }

      const responseData = await response.json();

      // Update the local state and recalculate permissions
      const updatedMembers = members.map(member => 
        member.user_id === userToChangeRole.user_id 
          ? { ...member, role: newRole }
          : member
      );
      setMembers(calculatePermissions(updatedMembers));

      if (responseData.is_self_update) {
        setRoleSuccess(`Role updated successfully to ${newRole}. Refreshing session...`);
        try {
          await refreshSession();
          setRoleSuccess(`Role updated successfully to ${newRole}`);
        } catch (error) {
          console.error("Failed to refresh session:", error);
          setRoleSuccess(`Role updated successfully to ${newRole}. Please refresh the page to see changes.`);
        }
        setTimeout(() => {
          setRoleDialogOpen(false);
          setRoleSuccess(null);
          setUserToChangeRole(null);
        }, 1000);
      } else {
        setRoleSuccess(`Role updated successfully to ${newRole}`);
        setTimeout(() => {
          setRoleDialogOpen(false);
          setRoleSuccess(null);
          setUserToChangeRole(null);
        }, 1000);
      }
    } catch (err) {
      console.error("Error updating role:", err);
      setRoleError(
        err instanceof Error ? err.message : "Failed to update role"
      );
    } finally {
      setChangingRole(false);
    }
  };

  if (authLoading || loading) {
    return (
      <PageWithTitle
        title="Users"
        subtitle={`All users at ${user?.organization_name || "Loading..."}`}
        button={
          isAdmin ? (
            <Button
              variant="solid"
              color="primary"
              startDecorator={<Mail size={16} />}
              onClick={openInviteDialog}
            >
              Invite User
            </Button>
          ) : undefined
        }
      >
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  if (error) {
    return (
      <PageWithTitle
        title="Users"
        subtitle={`All users at ${
          user?.organization_name || "Unknown Organization"
        }`}
        button={
          isAdmin ? (
            <Button
              variant="solid"
              color="primary"
              startDecorator={<Mail size={16} />}
              onClick={openInviteDialog}
            >
              Invite User
            </Button>
          ) : undefined
        }
      >
        <Alert color="danger" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title="Users"
      subtitle={`All users at ${
        user?.organization_name || "Unknown Organization"
      }`}
      button={
        isAdmin ? (
          <Button
            variant="solid"
            color="primary"
            startDecorator={<Mail size={16} />}
            onClick={openInviteDialog}
          >
            Invite User
          </Button>
        ) : undefined
      }
    >
      <Box
        sx={{
          maxWidth: 1000,
          mx: "auto",
        }}
      >
        {members.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography level="body-lg" sx={{ color: "text.secondary" }}>
              No users found in this organization
            </Typography>
          </Box>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.user_id}>
                  <td>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar
                        src={getAvatarUrl(member)}
                        alt={getDisplayName(member)}
                        size="sm"
                      />
                      <Box>
                        <Typography level="body-md">
                          {getDisplayName(member)}
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "text.secondary" }}
                        >
                          {member.email}
                        </Typography>
                      </Box>
                    </Box>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      color={
                        (typeof member.role === "string" &&
                          member.role === "admin") ||
                        (typeof member.role === "object" &&
                          member.role?.slug === "admin")
                          ? "primary"
                          : "neutral"
                      }
                    >
                      {typeof member.role === "string"
                        ? member.role
                        : member.role?.slug || "unknown"}
                    </Chip>
                  </td>
                  <td>
                    {!isAdmin ? (
                      <Typography
                        level="body-sm"
                        sx={{ color: "text.secondary" }}
                      ></Typography>
                    ) : (
                      <Box sx={{ display: "flex", gap: 1 }}>
                        {member.can_change_role !== false && (
                          <IconButton
                            size="sm"
                            color="primary"
                            variant="plain"
                            onClick={() => openRoleDialog(member)}
                            disabled={changingRole}
                            title={
                              !member.can_change_role
                                ? "Cannot change role of the last admin"
                                : "Change role"
                            }
                          >
                            <Edit size={16} />
                          </IconButton>
                        )}
                        {member.can_be_removed !== false && (
                          <IconButton
                            size="sm"
                            color="danger"
                            variant="plain"
                            onClick={() => openRemoveDialog(member)}
                            disabled={removingUserId === member.user_id}
                            title={
                              !member.can_be_removed
                                ? "Cannot remove the last admin"
                                : "Remove user"
                            }
                          >
                            {removingUserId === member.user_id ? (
                              <CircularProgress size="sm" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </IconButton>
                        )}
                        {(!member.can_change_role &&
                          !member.can_be_removed) && (
                            <Typography
                              level="body-sm"
                              sx={{ color: "text.secondary", fontStyle: "italic" }}
                            >
                              Cannot edit or remove only admin
                            </Typography>
                          )}
                      </Box>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Box>

      {/* Remove User Confirmation Dialog */}
      <Modal open={removeDialogOpen} onClose={() => setRemoveDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Remove User</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to remove{" "}
              <strong>
                {userToRemove ? getDisplayName(userToRemove) : ""}
              </strong>{" "}
              from the organization? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={() => userToRemove && handleRemoveUser(userToRemove)}
              loading={removingUserId !== null}
            >
              Remove User
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Invite User Dialog */}
      <Modal open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Invite User to Organization</DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
            >
              {inviteError && (
                <Alert color="danger" size="sm">
                  {inviteError}
                </Alert>
              )}
              {inviteSuccess && (
                <Alert color="success" size="sm">
                  {inviteSuccess}
                </Alert>
              )}

              <FormControl>
                <FormLabel>Email Address</FormLabel>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  disabled={inviting}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Role</FormLabel>
                <Select
                  value={inviteForm.role_slug}
                  onChange={(_, value) =>
                    setInviteForm({
                      ...inviteForm,
                      role_slug: value || "member",
                    })
                  }
                  disabled={inviting}
                >
                  <Option value="member">Member</Option>
                  <Option value="admin">Admin</Option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Invitation Expires In (Days)</FormLabel>
                <Select
                  value={inviteForm.expires_in_days?.toString()}
                  onChange={(_, value) =>
                    setInviteForm({
                      ...inviteForm,
                      expires_in_days: parseInt(value || "7"),
                    })
                  }
                  disabled={inviting}
                >
                  <Option value="1">1 day</Option>
                  <Option value="3">3 days</Option>
                  <Option value="7">7 days</Option>
                  <Option value="14">14 days</Option>
                  <Option value="30">30 days</Option>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleInviteUser}
              loading={inviting}
              disabled={!inviteForm.email.trim()}
            >
              Send Invitation
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <Modal open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Change User Role</DialogTitle>
          <DialogContent>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
            >
              {roleError && (
                <Alert color="danger" size="sm">
                  {roleError}
                </Alert>
              )}
              {roleSuccess && (
                <Alert color="success" size="sm">
                  {roleSuccess}
                </Alert>
              )}

              <Typography level="body-md">
                Change role for{" "}
                <strong>
                  {userToChangeRole ? getDisplayName(userToChangeRole) : ""}
                </strong>
              </Typography>

              <FormControl>
                <FormLabel>New Role</FormLabel>
                <Select
                  value={newRole}
                  onChange={(_, value) => setNewRole(value || "member")}
                  disabled={changingRole}
                >
                  <Option value="member">Member</Option>
                  <Option value="admin">Admin</Option>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setRoleDialogOpen(false)}
              disabled={changingRole}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleRoleChange}
              loading={changingRole}
            >
              Update Role
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Users;
