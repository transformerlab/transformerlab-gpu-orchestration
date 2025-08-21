import React from "react";
import {
  Box,
  Typography,
  Table,
  Button,
  Chip,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Alert,
  Avatar,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Card,
  FormControl,
  FormLabel,
  CircularProgress,
} from "@mui/joy";
import { Plus, UserPlus, Trash2, Users, Search, X, Pencil } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useAuth } from "../../../context/AuthContext";
import { teamsApi } from "../../../utils/api";
// Fake data removed; always use real API

const Teams: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openManageTeam, setOpenManageTeam] = React.useState(false);
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = React.useState<string | null>(null);
  const [teams, setTeams] = React.useState<
    Array<{
      id: string;
      name: string;
      members: Array<{ user_id: string; email?: string; first_name?: string; last_name?: string; profile_picture_url?: string }>;
    }>
  >([]);
  const [allUsers, setAllUsers] = React.useState<
    Array<{ 
      user_id: string; 
      email?: string; 
      first_name?: string; 
      last_name?: string; 
      profile_picture_url?: string;
      has_team?: boolean;
    }>
  >([]);
  const [newTeamName, setNewTeamName] = React.useState("");
  const [editTeamName, setEditTeamName] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [userSearch, setUserSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const isAdmin = user?.role === "admin";

  // Helpers similar to Users page for consistent display
  const getDisplayName = (u: { first_name?: string; last_name?: string; email?: string; user_id: string }) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    return name || u.email || u.user_id;
  };

  const getAvatarUrl = (user: { email?: string; profile_picture_url?: string }) => {
    // Use profile_picture_url if available, otherwise fall back to placeholder
    if (user.profile_picture_url) {
      return user.profile_picture_url;
    }

    // Generate a simple avatar based on email hash as fallback
    if (!user.email) return undefined;
    const hash = user.email
      .split("")
      .reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
    return `https://i.pravatar.cc/150?img=${Math.abs(hash) % 70}`;
  };

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        teamsApi.listTeams(),
        teamsApi.availableUsers(),
      ]);
      setTeams(teamsRes.teams);
      setAllUsers(usersRes.users);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Remove member state
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<
    { user_id: string; email?: string; first_name?: string; last_name?: string; profile_picture_url?: string } | null
  >(null);

  // Delete team state
  const [deleteTeamDialogOpen, setDeleteTeamDialogOpen] = React.useState(false);
  const [teamToDelete, setTeamToDelete] = React.useState<{ id: string; name: string } | null>(null);
  const [deletingTeam, setDeletingTeam] = React.useState(false);

  const openRemoveMember = (member: { user_id: string; email?: string; first_name?: string; last_name?: string; profile_picture_url?: string }) => {
    setMemberToRemove(member);
    setRemoveDialogOpen(true);
  };

  const openDeleteTeam = (team: { id: string; name: string }) => {
    setTeamToDelete(team);
    setDeleteTeamDialogOpen(true);
  };

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    try {
      setDeletingTeam(true);
      await teamsApi.deleteTeam(teamToDelete.id);
      setDeleteTeamDialogOpen(false);
      setTeamToDelete(null);
      refresh();
    } catch (e: any) {
      setError(e.message || "Failed to delete team");
    } finally {
      setDeletingTeam(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedTeamId || !memberToRemove) return;
    const teamId = selectedTeamId;
    const userId = memberToRemove.user_id;
    // Snapshot previous state for rollback
    const prevTeam = teams.find((t) => t.id === teamId);
    const prevMembers = prevTeam ? [...prevTeam.members] : [];
    const prevAllUsers = [...allUsers];

    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, members: t.members.filter((m) => m.user_id !== userId) }
          : t
      )
    );
    setAllUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, has_team: false } : u))
    );
    setRemoveDialogOpen(false);
    setMemberToRemove(null);

    try {
      await teamsApi.removeMember(teamId, userId);
    } catch (e: any) {
      // Rollback on error
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, members: prevMembers } : t))
      );
      setAllUsers(prevAllUsers);
      setError(e.message || "Failed to remove member");
    }
  };

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PageWithTitle
      title="Teams"
      subtitle="Manage teams and add users to teams."
      button={
        isAdmin ? (
          <Button
            variant="solid"
            color="primary"
            startDecorator={<Plus size={16} />}
            onClick={() => setOpenCreate(true)}
          >
            Create Team
          </Button>
        ) : undefined
      }
    >
          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {authLoading || loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Users</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td>{team.name}</td>
                    <td>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        {team.members.map((m) => (
                          <Chip key={m.user_id} size="sm">
                            {m.first_name || m.last_name || m.email || m.user_id}
                          </Chip>
                        ))}
                      </Stack>
                    </td>
                    <td>
                      {isAdmin ? (
                        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                          <Button
                            size="sm"
                            variant="outlined"
                            startDecorator={<Users size={14} />}
                            onClick={() => {
                              setSelectedTeamName(team.name);
                              setSelectedTeamId(team.id);
                              setEditTeamName(team.name);
                              setOpenManageTeam(true);
                            }}
                          >
                            Manage
                          </Button>
                          <IconButton
                            size="sm"
                            variant="outlined"
                            color="danger"
                            onClick={() => openDeleteTeam({ id: team.id, name: team.name })}
                            title="Delete team"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Box>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

  {/* Create Team Modal */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)}>
        <ModalDialog>
          <Typography level="h4">Create Team</Typography>
          <Input
            placeholder="Team name"
            sx={{ my: 2 }}
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <Stack direction="row" spacing={1}>
            <Button
              onClick={async () => {
                try {
                  await teamsApi.createTeam(newTeamName.trim());
                  setNewTeamName("");
                  setOpenCreate(false);
                  refresh();
                } catch (e: any) {
                  setError(e.message);
                }
              }}
              disabled={!newTeamName.trim()}
            >
              Create
            </Button>
            <Button variant="plain" onClick={() => setOpenCreate(false)}>
              Cancel
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Manage Team Modal */}
      <Modal
        open={openManageTeam}
        onClose={() => {
          setOpenManageTeam(false);
          setEditTeamName("");
          setRenaming(false);
          setEditingTitle(false);
        }}
      >
        <ModalDialog
          sx={{
            width: { xs: "90vw", sm: "80vw", md: "700px" },
            maxWidth: "800px",
            maxHeight: "90vh",
            overflow: "auto",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}>
              <Users size={24} />
              <Typography level="h3" sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                Manage Team: <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedTeamName}</span>
                {isAdmin && (
                  <IconButton
                    size="sm"
                    variant="plain"
                    onClick={() => {
                      setEditTeamName(selectedTeamName || "");
                      setEditingTitle(true);
                    }}
                    title="Rename team"
                  >
                    <Pencil size={18} />
                  </IconButton>
                )}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button
                size="sm"
                variant="outlined"
                color="danger"
                startDecorator={<Trash2 size={16} />}
                onClick={() => {
                  if (selectedTeamId && selectedTeamName) {
                    openDeleteTeam({ id: selectedTeamId, name: selectedTeamName });
                    setOpenManageTeam(false);
                  }
                }}
              >
                Delete Team
              </Button>
              <IconButton
                variant="plain"
                color="neutral"
                onClick={() => {
                  setOpenManageTeam(false);
                  setEditTeamName("");
                  setRenaming(false);
                  setEditingTitle(false);
                }}
                sx={{ borderRadius: "50%" }}
              >
                <X size={20} />
              </IconButton>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Rename Team Section (when editing) */}
          {editingTitle && (
            <Box sx={{ mb: 3 }}>
              <FormControl>
                <FormLabel>Edit Team Name</FormLabel>
                <Input
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  size="md"
                  autoFocus
                  placeholder="Team name"
                />
              </FormControl>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button
                  variant="solid"
                  size="sm"
                  disabled={!selectedTeamId || !editTeamName.trim() || editTeamName.trim() === selectedTeamName || renaming}
                  loading={renaming}
                  onClick={async () => {
                    if (!selectedTeamId) return;
                    const teamId = selectedTeamId;
                    const newName = editTeamName.trim();
                    if (!newName || newName === selectedTeamName) return;

                    const prevTeams = [...teams];
                    const prevName = selectedTeamName;
                    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: newName } : t)));
                    setSelectedTeamName(newName);
                    setRenaming(true);
                    try {
                      await teamsApi.updateTeam(teamId, newName);
                      setEditingTitle(false);
                      setEditTeamName("");
                    } catch (e: any) {
                      setTeams(prevTeams);
                      if (prevName) setSelectedTeamName(prevName);
                      setError(e.message || "Failed to rename team");
                    } finally {
                      setRenaming(false);
                    }
                  }}
                >
                  Save
                </Button>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => {
                    setEditingTitle(false);
                    setEditTeamName("");
                  }}
                >
                  Cancel
                </Button>
              </Stack>
            </Box>
          )}


          {/* Current Members Section */}
          <Box sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
              <Users size={18} />
              Current Members
              <Chip size="sm" variant="soft" color="primary">
                {(teams.find((t) => t.id === selectedTeamId)?.members || []).length}
              </Chip>
            </Typography>

            <Stack spacing={1}>
              {authLoading || loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size="sm" />
                </Box>
              ) : (
                (teams.find((t) => t.id === selectedTeamId)?.members || []).map((member) => (
                  <Card key={member.user_id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar src={getAvatarUrl(member)} size="md">
                          {getDisplayName(member).charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography level="body-md" fontWeight="md">
                            {getDisplayName(member)}
                          </Typography>
                          {member.email && (
                            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                              {member.email}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                        {isAdmin && (
                        <IconButton
                          size="sm"
                          variant="outlined"
                          color="danger"
                          onClick={() => openRemoveMember(member)}
                          title="Remove from team"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </Box>
                  </Card>
                ))
              )}
            </Stack>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Add Members Section */}
          {isAdmin && (
            <Box>
              <Typography level="h4" sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <UserPlus size={18} />
                Add Members
              </Typography>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Search for users to add</FormLabel>
                <Input
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  startDecorator={<Search size={16} />}
                  sx={{ mb: 2 }}
                />
              </FormControl>

              <Stack spacing={1} sx={{ maxHeight: "300px", overflow: "auto" }}>
                {(() => {
                  if (authLoading || loading) {
                    return (
                      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                        <CircularProgress size="sm" />
                      </Box>
                    );
                  }

                  const memberIds = new Set(
                    (teams.find((t) => t.id === selectedTeamId)?.members || []).map((m) => m.user_id)
                  );
                  const filteredUsers = allUsers
                    .filter((u) => !memberIds.has(u.user_id))
                    .filter((u) =>
                      [u.first_name, u.last_name, u.email, u.user_id]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase()
                        .includes(userSearch.toLowerCase())
                    );

                  if (filteredUsers.length === 0) {
                    return (
                      <Box sx={{ textAlign: "center", py: 3 }}>
                        <Typography level="body-md" sx={{ color: "text.secondary" }}>
                          {userSearch ? "No users found matching your search" : "All users are already in teams"}
                        </Typography>
                      </Box>
                    );
                  }

                  return filteredUsers.map((u) => {
                    const isInAnotherTeam = u.has_team;
                    return (
                      <Card key={u.user_id} variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Avatar src={getAvatarUrl(u)} size="md">
                              {getDisplayName(u).charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography level="body-md" fontWeight="md">
                                {getDisplayName(u)}
                                {isInAnotherTeam && (
                                  <Chip size="sm" color="warning" sx={{ ml: 1 }}>
                                    In Team
                                  </Chip>
                                )}
                              </Typography>
                              {u.email && (
                                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                                  {u.email}
                                </Typography>
                              )}
                              {isInAnotherTeam && (
                                <Typography level="body-sm" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                                  Already in another team
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Button
                            size="sm"
                            variant={isInAnotherTeam ? "outlined" : "solid"}
                            color={isInAnotherTeam ? "neutral" : "primary"}
                            startDecorator={<UserPlus size={14} />}
                            disabled={isInAnotherTeam}
                            onClick={async () => {
                              if (!selectedTeamId || isInAnotherTeam) return;
                              const teamId = selectedTeamId;
                              const userId = u.user_id;
                              // Construct member object from available user
                              const newMember = {
                                user_id: u.user_id,
                                email: u.email,
                                first_name: u.first_name,
                                last_name: u.last_name,
                                profile_picture_url: u.profile_picture_url,
                              };
                              // Snapshot previous state for rollback
                              const prevTeam = teams.find((t) => t.id === teamId);
                              const prevMembers = prevTeam ? [...prevTeam.members] : [];
                              const prevAllUsers = [...allUsers];

                              setTeams((prev) =>
                                prev.map((t) =>
                                  t.id === teamId
                                    ? { ...t, members: [...t.members, newMember] }
                                    : t
                                )
                              );
                              setAllUsers((prev) =>
                                prev.map((au) =>
                                  au.user_id === userId ? { ...au, has_team: true } : au
                                )
                              );
                              setUserSearch("");

                              try {
                                await teamsApi.addMember(teamId, userId);
                              } catch (e: any) {
                                // Rollback on error
                                setTeams((prev) =>
                                  prev.map((t) =>
                                    t.id === teamId ? { ...t, members: prevMembers } : t
                                  )
                                );
                                setAllUsers(prevAllUsers);
                                setError(e.message || "Failed to add member");
                              }
                            }}
                            title={isInAnotherTeam ? "User is already in another team" : "Add to team"}
                          >
                            {isInAnotherTeam ? "In Team" : "Add to Team"}
                          </Button>
                        </Box>
                      </Card>
                    );
                  });
                })()}
              </Stack>
            </Box>
          )}
        </ModalDialog>
      </Modal>

      {/* Confirm Remove Member */}
  <Modal open={removeDialogOpen} onClose={() => setRemoveDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Remove Member</DialogTitle>
          <DialogContent>
            <Typography>
              Remove <strong>{memberToRemove ? getDisplayName(memberToRemove) : ""}</strong> from
              {" "}
              <strong>{selectedTeamName}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
    <Button variant="plain" color="neutral" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
    <Button variant="solid" color="danger" onClick={handleRemoveMember}>
              Remove
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Confirm Delete Team */}
      <Modal open={deleteTeamDialogOpen} onClose={() => setDeleteTeamDialogOpen(false)}>
        <ModalDialog>
          <DialogTitle>Delete Team</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the team <strong>{teamToDelete?.name}</strong>?
            </Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary", mt: 1 }}>
              This action cannot be undone. All team members will be removed from the team.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button 
              variant="plain" 
              color="neutral" 
              onClick={() => setDeleteTeamDialogOpen(false)} 
              disabled={deletingTeam}
            >
              Cancel
            </Button>
            <Button 
              variant="solid" 
              color="danger" 
              onClick={handleDeleteTeam} 
              loading={deletingTeam}
            >
              Delete Team
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Teams;
