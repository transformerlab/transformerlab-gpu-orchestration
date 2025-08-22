import React, { useState, useEffect } from "react";
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
  Card,
  Grid,
  CircularProgress,
  FormControl,
  FormLabel,
  Switch,
} from "@mui/joy";
import { RefreshCw, Search } from "lucide-react";
import useSWR, { mutate } from "swr";
import PageWithTitle from "../templates/PageWithTitle";
import { buildApiUrl, apiFetch, teamsQuotaApi } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";

interface OrganizationQuota {
  organization_id: string;
  monthly_gpu_hours_per_user: number;
  current_period_start: string;
  current_period_end: string;
  gpu_hours_used: number;
  gpu_hours_remaining: number;
  usage_percentage: number;
}

interface UserUsageBreakdown {
  user_id: string;
  user_email?: string;
  user_name?: string;
  gpu_hours_used: number;
  gpu_hours_limit: number;
  gpu_hours_remaining: number;
  usage_percentage: number;
}

interface OrganizationUserUsage {
  organization_id: string;
  period_start: string;
  period_end: string;
  quota_per_user: number;
  total_users: number;
  total_organization_usage: number;
  user_breakdown: UserUsageBreakdown[];
}

interface GPUUsageLog {
  id: string;
  organization_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  cluster_name: string;
  job_id?: number;
  gpu_count: number;
  start_time: string;
  end_time?: string;
  duration_hours?: number;
  instance_type?: string;
  cloud_provider?: string;
  cost_estimate?: number;
}

interface QuotaUsageResponse {
  organization_quota: OrganizationQuota;
  recent_usage: GPUUsageLog[];
  total_usage_this_period: number;
}

// Individual User Quota Management Interfaces
interface UserQuota {
  user_id: string;
  user_email?: string;
  user_name?: string;
  organization_id: string;
  monthly_gpu_hours_per_user: number;
  custom_quota: boolean;
  created_at: string;
  updated_at: string;
  effective_quota_source?: string;
  effective_quota_limit?: number;
}

interface UserQuotaList {
  organization_id: string;
  users: UserQuota[];
  default_quota_per_user: number;
}

// Team quotas types
type TeamQuotaItem = {
  team_id: string;
  team_name: string;
  organization_id: string;
  monthly_gpu_hours_per_user: number;
  created_at: string;
  updated_at: string;
};
type TeamQuotaList = {
  organization_id: string;
  teams: TeamQuotaItem[];
  default_quota_per_user: number;
};

const OrgQuota: React.FC = () => {
  const { user } = useAuth();
  const organizationId = user?.organization_id;

  // SWR fetcher function
  const fetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => {
      if (!res.ok) {
        throw new Error(`API request failed: ${res.statusText}`);
      }
      return res.json();
    });

  // SWR hooks for data fetching
  const {
    data: quotaData,
    error: quotaError,
    isLoading: quotaLoading,
    mutate: mutateQuotaData,
  } = useSWR<QuotaUsageResponse>(
    organizationId
      ? buildApiUrl(`quota/organization/${organizationId}/usage/all`)
      : null,
    fetcher,
    { refreshInterval: 45000 } // Refresh every 45 seconds
  );

  const {
    data: orgUserData,
    error: orgUserError,
    isLoading: orgUserLoading,
    mutate: mutateOrgUserData,
  } = useSWR<OrganizationUserUsage>(
    organizationId
      ? buildApiUrl(`quota/organization/${organizationId}/users`)
      : null,
    fetcher,
    { refreshInterval: 45000 }
  );

  const {
    data: userQuotas,
    error: userQuotasError,
    isLoading: userQuotasLoading,
    mutate: mutateUserQuotas,
  } = useSWR<UserQuotaList>(
    organizationId
      ? buildApiUrl(`quota/organization/${organizationId}/users/quotas`)
      : null,
    fetcher,
    { refreshInterval: 45000 }
  );

  const {
    data: teamQuotas,
    error: teamQuotasError,
    isLoading: teamQuotasLoading,
    mutate: mutateTeamQuotas,
  } = useSWR<TeamQuotaList>(
    organizationId ? `team-quotas-${organizationId}` : null,
    () => teamsQuotaApi.listTeamQuotas(organizationId!),
    { refreshInterval: 45000 }
  );

  // SWR hook for automatic cost report syncing
  const {
    data: syncData,
    error: syncError,
    isLoading: syncLoading,
  } = useSWR(
    organizationId ? buildApiUrl("quota/sync-from-cost-report") : null,
    fetcher,
    { refreshInterval: 45000 } // Sync every 45 seconds
  );

  // Modal and form state
  const [openOrgModal, setOpenOrgModal] = useState(false);
  const [newQuotaHours, setNewQuotaHours] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetIndividualQuotas, setResetIndividualQuotas] = useState(false);

  // Individual User Quota Management State
  const [openUserQuotaModal, setOpenUserQuotaModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserQuota | null>(null);
  const [newUserQuotaHours, setNewUserQuotaHours] = useState<string>("");
  const [updatingUserQuota, setUpdatingUserQuota] = useState(false);

  // Individuals filter
  const [individualSearch, setIndividualSearch] = useState<string>("");

  // Team quotas modal state
  const [openTeamQuotaModal, setOpenTeamQuotaModal] = useState<boolean>(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamQuotaItem | null>(null);
  const [newTeamQuotaHours, setNewTeamQuotaHours] = useState<string>("");
  const [updatingTeamQuota, setUpdatingTeamQuota] = useState<boolean>(false);

  // Derived state
  const loading = quotaLoading;
  const error =
    quotaError?.message ||
    orgUserError?.message ||
    userQuotasError?.message ||
    teamQuotasError?.message ||
    syncError?.message ||
    null;

  // Initialize newQuotaHours when quotaData changes
  useEffect(() => {
    if (quotaData?.organization_quota?.monthly_gpu_hours_per_user) {
      setNewQuotaHours(
        quotaData.organization_quota.monthly_gpu_hours_per_user.toString()
      );
    }
  }, [quotaData]);

  // Auto-populate user quotas if none exist
  useEffect(() => {
    if (userQuotas && userQuotas.users.length === 0 && organizationId) {
      const populateUserQuotas = async () => {
        try {
          await apiFetch(
            buildApiUrl(
              `quota/organization/${organizationId}/populate-user-quotas`
            ),
            {
              method: "POST",
              credentials: "include",
            }
          );
          // Revalidate user quotas data
          mutateUserQuotas();
        } catch (populateErr) {
          console.error(
            "Failed to automatically populate user quotas:",
            populateErr
          );
        }
      };
      populateUserQuotas();
    }
  }, [userQuotas, organizationId, mutateUserQuotas]);

  const handleManualSync = async () => {
    try {
      setSyncing(true);

      // Trigger a manual revalidation of the sync endpoint
      await mutate(buildApiUrl("quota/sync-from-cost-report"));

      // Also revalidate all other data
      await Promise.all([
        mutateQuotaData(),
        mutateOrgUserData(),
        mutateUserQuotas(),
        mutateTeamQuotas(),
      ]);
    } catch (err) {
      console.error("Failed to manually sync:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleEditOrg = () => {
    setOpenOrgModal(true);
  };

  const handleUpdateQuotaWithReset = async () => {
    if (!organizationId || !newQuotaHours) return;

    try {
      setUpdating(true);

      const response = await apiFetch(
        buildApiUrl(`quota/organization/${organizationId}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            monthly_gpu_hours_per_user: parseFloat(newQuotaHours),
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update quota: ${response.statusText}`);
      }

      // If user chose to reset individual quotas, delete all custom user quotas
      if (resetIndividualQuotas) {
        try {
          const userQuotasResponse = await apiFetch(
            buildApiUrl(`quota/organization/${organizationId}/users/quotas`),
            { credentials: "include" }
          );
          if (userQuotasResponse.ok) {
            const userQuotasData = await userQuotasResponse.json();
            for (const userQuota of userQuotasData.users) {
              if (userQuota.custom_quota) {
                try {
                  await apiFetch(
                    buildApiUrl(
                      `quota/organization/${organizationId}/users/${userQuota.user_id}/quota`
                    ),
                    {
                      method: "DELETE",
                      credentials: "include",
                    }
                  );
                } catch (err) {
                  console.error(
                    `Failed to reset quota for user ${userQuota.user_id}:`,
                    err
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch user quotas for reset:", err);
        }
      }

      // Refresh all data using SWR mutate
      await Promise.all([
        mutateQuotaData(),
        mutateOrgUserData(),
        mutateUserQuotas(),
      ]);

      setOpenOrgModal(false);
      setShowResetConfirmation(false);
      setResetIndividualQuotas(false);
    } catch (err) {
      console.error("Failed to update quota:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSyncFromCostReport = async () => {
    await handleManualSync();
  };

  const handleEditUserQuota = (user: UserQuota) => {
    setSelectedUser(user);
    setNewUserQuotaHours(user.monthly_gpu_hours_per_user.toString());
    setOpenUserQuotaModal(true);
  };

  const handleUpdateUserQuota = async () => {
    if (!organizationId || !selectedUser || !newUserQuotaHours) return;

    try {
      setUpdatingUserQuota(true);

      const response = await apiFetch(
        buildApiUrl(
          `quota/organization/${organizationId}/users/${selectedUser.user_id}/quota`
        ),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            monthly_gpu_hours_per_user: parseFloat(newUserQuotaHours),
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update user quota: ${response.statusText}`);
      }

      // Refresh the data using SWR mutate
      await mutateUserQuotas();
      setOpenUserQuotaModal(false);
      setSelectedUser(null);
    } catch (err) {
      console.error("Failed to update user quota:", err);
    } finally {
      setUpdatingUserQuota(false);
    }
  };

  const handleDeleteUserQuota = async (user: UserQuota) => {
    if (!organizationId) return;

    try {
      const response = await apiFetch(
        buildApiUrl(
          `quota/organization/${organizationId}/users/${user.user_id}/quota`
        ),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete user quota: ${response.statusText}`);
      }

      // Refresh the data - this will now show the user with the organization default
      await mutateUserQuotas();
    } catch (err) {
      console.error("Failed to delete user quota:", err);
    }
  };

  const formatHours = (hours: number) => {
    return new Intl.NumberFormat().format(hours);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getQuotaUsageColor = (percentage: number) => {
    if (percentage < 50) return "success";
    if (percentage < 80) return "warning";
    return "danger";
  };

  const formatDuration = (hours?: number) => {
    if (!hours) return "Running";
    return `${hours.toFixed(2)} hours`;
  };

  if (loading) {
    return (
      <PageWithTitle
        title="Quota Management"
        subtitle="Set and manage compute quota for your organization."
      >
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="200px"
        >
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  if (error) {
    return (
      <PageWithTitle
        title="Quota Management"
        subtitle="Set and manage compute quota for your organization."
      >
        <Alert color="danger" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          onClick={() => mutateQuotaData()}
          startDecorator={<RefreshCw size={16} />}
        >
          Retry
        </Button>
      </PageWithTitle>
    );
  }

  if (!quotaData) {
    return (
      <PageWithTitle
        title="Quota Management"
        subtitle="Set and manage compute quota for your organization."
      >
        <Alert color="neutral">No quota data available.</Alert>
      </PageWithTitle>
    );
  }

  const { organization_quota, recent_usage } = quotaData;

  return (
    <PageWithTitle
      title="Quota Management"
      subtitle="Set and manage compute quota for your organization."
    >
      {/* Organization Section */}
      <Box sx={{ mb: 4 }}>
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          Organization
        </Typography>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <Grid
            container
            gap={2}
            alignItems="center"
            justifyContent={"space-between"}
          >
            <Grid xs={12} md={8}>
              <Typography level="title-md">
                Monthly GPU credits per user
              </Typography>
              <Typography level="body-sm">
                Everyone in your organization will start with this amount of
                quota per month. Can be zero.
              </Typography>
            </Grid>
            <Grid>
              <Stack
                direction="row"
                spacing={1}
                alignItems={"center"}
                alignContent={"flex-end"}
                gap={2}
              >
                <Chip size="sm" color="primary">
                  {formatHours(organization_quota.monthly_gpu_hours_per_user)}{" "}
                  credits
                </Chip>
                <Button onClick={handleEditOrg}>Edit</Button>
              </Stack>
            </Grid>
          </Grid>
        </Card>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          Team
        </Typography>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <Typography level="body-sm" sx={{ mb: 2 }}>
            Set quota overrides for members of specific teams.
          </Typography>
          {teamQuotasError && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {teamQuotasError.message}
            </Alert>
          )}
          {teamQuotasLoading || !teamQuotas ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="120px"
            >
              <CircularProgress />
            </Box>
          ) : teamQuotas.teams.length === 0 ? (
            <Alert color="neutral">No teams found.</Alert>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Quota</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamQuotas.teams.map((t) => {
                  const usesDefault =
                    t.monthly_gpu_hours_per_user ===
                    teamQuotas.default_quota_per_user;
                  return (
                    <tr key={t.team_id}>
                      <td>{t.team_name}</td>
                      <td>
                        {usesDefault ? (
                          <Chip size="sm" color="neutral">
                            {formatHours(teamQuotas.default_quota_per_user)}{" "}
                            credits
                          </Chip>
                        ) : (
                          <Chip size="sm" color="primary">
                            {formatHours(t.monthly_gpu_hours_per_user)} credits
                          </Chip>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => {
                              setSelectedTeam(t);
                              setNewTeamQuotaHours(
                                String(t.monthly_gpu_hours_per_user)
                              );
                              setOpenTeamQuotaModal(true);
                            }}
                          >
                            Edit
                          </Button>
                          {!usesDefault && (
                            <Button
                              size="sm"
                              variant="outlined"
                              color="danger"
                              onClick={async () => {
                                if (!organizationId) return;
                                try {
                                  await teamsQuotaApi.deleteTeamQuota(
                                    organizationId,
                                    t.team_id
                                  );
                                  await mutateTeamQuotas();
                                } catch (err) {
                                  console.error(
                                    "Failed to reset team quota:",
                                    err
                                  );
                                }
                              }}
                            >
                              Reset
                            </Button>
                          )}
                        </Stack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </Box>

      {/* Individual User Quota Management */}
      {userQuotas && (
        <Box sx={{ mb: 4 }}>
          <Typography level="h4" component="h2" sx={{ mb: 2 }}>
            Individuals
          </Typography>
          <Card variant="outlined">
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              Set user level quotas here. Will override team and org quotas.
            </Typography>
            <Input
              placeholder="Search by name or email..."
              value={individualSearch}
              onChange={(e) => setIndividualSearch(e.target.value)}
              startDecorator={<Search size={16} />}
              sx={{ mb: 2, maxWidth: 420 }}
            />
            {userQuotas.users.length === 0 ? (
              <Alert color="neutral">Loading user quotas...</Alert>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Quota Source</th>
                    <th>Quota</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userQuotas.users
                    .filter((u) => {
                      const hay = [u.user_name, u.user_email, u.user_id]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();
                      return hay.includes(individualSearch.toLowerCase());
                    })
                    .map((userQuota) => (
                      <tr key={userQuota.user_id}>
                        <td>{userQuota.user_name || "Unknown"}</td>
                        <td>{userQuota.user_email || userQuota.user_id}</td>
                        <td>
                          {(() => {
                            const src =
                              userQuota.effective_quota_source ||
                              (userQuota.custom_quota ? "user" : "org");
                            const color =
                              src === "user"
                                ? "primary"
                                : src === "team"
                                ? "warning"
                                : "neutral";
                            const label =
                              src === "user"
                                ? "user"
                                : src === "team"
                                ? "team"
                                : "org";
                            return (
                              <Chip size="sm" color={color as any}>
                                {label}
                              </Chip>
                            );
                          })()}
                        </td>
                        <td>
                          {userQuota.custom_quota ? (
                            <Chip color="primary" size="sm">
                              {formatHours(
                                userQuota.monthly_gpu_hours_per_user
                              )}{" "}
                              credits
                            </Chip>
                          ) : (
                            <Chip
                              color={
                                (userQuota.effective_quota_source === "team"
                                  ? "warning"
                                  : "neutral") as any
                              }
                              size="sm"
                            >
                              {formatHours(
                                userQuota.effective_quota_limit ??
                                  userQuota.monthly_gpu_hours_per_user
                              )}{" "}
                              credits
                            </Chip>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                          >
                            <Button
                              size="sm"
                              variant="outlined"
                              onClick={() => handleEditUserQuota(userQuota)}
                            >
                              Edit
                            </Button>
                            {userQuota.custom_quota && (
                              <Button
                                size="sm"
                                variant="outlined"
                                color="danger"
                                onClick={() => handleDeleteUserQuota(userQuota)}
                              >
                                Reset
                              </Button>
                            )}
                          </Stack>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </Table>
            )}
          </Card>
        </Box>
      )}

      {/* Recent Usage Section */}
      <Box>
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          All Users Recent Usage
        </Typography>

        {recent_usage.length === 0 ? (
          <Alert color="neutral">No recent GPU usage found.</Alert>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Cluster</th>
                <th>User</th>
                <th>GPUs</th>
                <th>Instance Type</th>
                <th>Start Time</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent_usage.map((usage) => (
                <tr key={usage.id}>
                  <td>{usage.cluster_name}</td>
                  <td>
                    {usage.user_name || usage.user_email || usage.user_id}
                  </td>
                  <td>{usage.gpu_count}</td>
                  <td>{usage.instance_type || "Unknown"}</td>
                  <td>{new Date(usage.start_time).toLocaleString()}</td>
                  <td>{formatDuration(usage.duration_hours)}</td>
                  <td>
                    <Chip
                      color={usage.end_time ? "success" : "warning"}
                      size="sm"
                    >
                      {usage.end_time ? "Completed" : "Running"}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Box>

      {/* Organization Quota Modal */}
      <Modal open={openOrgModal} onClose={() => setOpenOrgModal(false)}>
        <ModalDialog>
          <Typography level="h4">Edit Organization Quota</Typography>
          <Typography level="body-sm" mb={1}>
            Set the monthly GPU credit quota per user for your organization
          </Typography>
          <Stack gap={2}>
            <Input
              placeholder="Monthly GPU Hours Per User"
              value={newQuotaHours}
              onChange={(e) => setNewQuotaHours(e.target.value)}
              slotProps={{
                input: {
                  type: "number",
                  min: "0",
                  step: "0.1",
                },
              }}
            />
            <Typography level="body-sm">
              Current period ends:{" "}
              {formatDate(organization_quota.current_period_end)}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={() => setShowResetConfirmation(true)}
                loading={updating}
                disabled={!newQuotaHours || parseFloat(newQuotaHours) < 0}
              >
                Save Changes
              </Button>
              <Button
                variant="outlined"
                onClick={() => setOpenOrgModal(false)}
                disabled={updating}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        open={showResetConfirmation}
        onClose={() => setShowResetConfirmation(false)}
      >
        <ModalDialog>
          <Typography level="h4">Reset Individual Quotas?</Typography>
          <Typography level="body-sm" mb={2}>
            Do you want to reset all individual user quotas to the new
            organization default?
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl>
              <FormLabel>Reset individual quotas?</FormLabel>
              <Switch
                checked={resetIndividualQuotas}
                onChange={(e) => setResetIndividualQuotas(e.target.checked)}
              />
            </FormControl>
            <Typography level="body-sm" color="neutral">
              {resetIndividualQuotas
                ? "All custom user quotas will be deleted and users will use the new organization default."
                : "Individual user quotas will remain unchanged."}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={handleUpdateQuotaWithReset}
                loading={updating}
                color="primary"
              >
                Confirm Update
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowResetConfirmation(false)}
                disabled={updating}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* User Quota Modal */}
      <Modal
        open={openUserQuotaModal}
        onClose={() => setOpenUserQuotaModal(false)}
      >
        <ModalDialog>
          <Typography level="h4">Edit User Quota</Typography>
          <Typography level="body-sm" mb={2}>
            Set the monthly GPU credit quota for{" "}
            {selectedUser?.user_name || selectedUser?.user_id}
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input
              placeholder="Monthly GPU Credit Limit"
              value={newUserQuotaHours}
              onChange={(e) => setNewUserQuotaHours(e.target.value)}
              slotProps={{
                input: {
                  type: "number",
                  min: "0",
                  step: "0.1",
                },
              }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                onClick={handleUpdateUserQuota}
                loading={updatingUserQuota}
                disabled={
                  !newUserQuotaHours || parseFloat(newUserQuotaHours) < 0
                }
              >
                Save Changes
              </Button>
              <Button
                variant="outlined"
                onClick={() => setOpenUserQuotaModal(false)}
                disabled={updatingUserQuota}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Team Quota Modal */}
      <Modal
        open={openTeamQuotaModal}
        onClose={() => setOpenTeamQuotaModal(false)}
      >
        <ModalDialog>
          <Typography level="h4">Edit Team Quota</Typography>
          <Typography level="body-sm" mb={2}>
            Set the monthly GPU credit quota per user for team{" "}
            {selectedTeam?.team_name}
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input
              placeholder="Monthly GPU Credit Limit"
              value={newTeamQuotaHours}
              onChange={(e) => setNewTeamQuotaHours(e.target.value)}
              slotProps={{
                input: { type: "number", min: "0", step: "0.1" },
              }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                onClick={async () => {
                  if (!organizationId || !selectedTeam) return;
                  const parsed = parseFloat(newTeamQuotaHours);
                  if (isNaN(parsed) || parsed < 0) return;
                  try {
                    setUpdatingTeamQuota(true);
                    await teamsQuotaApi.updateTeamQuota(
                      organizationId,
                      selectedTeam.team_id,
                      parsed
                    );
                    await mutateTeamQuotas();
                    setOpenTeamQuotaModal(false);
                  } catch (err) {
                    console.error("Failed to update team quota:", err);
                  } finally {
                    setUpdatingTeamQuota(false);
                  }
                }}
                loading={updatingTeamQuota}
                disabled={
                  !newTeamQuotaHours || parseFloat(newTeamQuotaHours) < 0
                }
              >
                Save Changes
              </Button>
              <Button
                variant="outlined"
                onClick={() => setOpenTeamQuotaModal(false)}
                disabled={updatingTeamQuota}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default OrgQuota;
