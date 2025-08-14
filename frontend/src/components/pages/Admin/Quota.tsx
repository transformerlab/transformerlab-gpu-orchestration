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
  Divider,
  CircularProgress,
  LinearProgress,
  Switch,
  FormControl,
  FormLabel,
} from "@mui/joy";
import { Edit2, RefreshCw, RotateCcw, Users, PieChart } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import UserUsagePieChart from "../../widgets/UserUsagePieChart";

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
}

interface UserQuotaList {
  organization_id: string;
  users: UserQuota[];
  default_quota_per_user: number;
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

const Quota: React.FC = () => {
  const { user } = useAuth();
  const [openOrgModal, setOpenOrgModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotaData, setQuotaData] = useState<QuotaUsageResponse | null>(null);
  const [orgUserData, setOrgUserData] = useState<OrganizationUserUsage | null>(
    null
  );
  const [newQuotaHours, setNewQuotaHours] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncInterval, setAutoSyncInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [showOrgView, setShowOrgView] = useState(false);

  const organizationId = user?.organization_id;

  // Individual User Quota Management State
  const [userQuotas, setUserQuotas] = useState<UserQuotaList | null>(null);
  const [openUserQuotaModal, setOpenUserQuotaModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserQuota | null>(null);
  const [newUserQuotaHours, setNewUserQuotaHours] = useState<string>("");
  const [updatingUserQuota, setUpdatingUserQuota] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetIndividualQuotas, setResetIndividualQuotas] = useState(false);

  const fetchQuotaData = async (showLoading = true) => {
    if (!organizationId) {
      setError("No organization ID available");
      setLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Use different endpoints based on view mode
      const endpoint = showOrgView
        ? `quota/organization/${organizationId}/usage/all`
        : `quota/organization/${organizationId}/usage`;

      const response = await apiFetch(buildApiUrl(endpoint), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch quota data: ${response.statusText}`);
      }

      const data: QuotaUsageResponse = await response.json();
      setQuotaData(data);
      setNewQuotaHours(
        data.organization_quota.monthly_gpu_hours_per_user.toString()
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch quota data"
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchOrgUserData = async () => {
    if (!organizationId) return;

    try {
      const response = await apiFetch(
        buildApiUrl(`quota/organization/${organizationId}/users`),
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch organization user data: ${response.statusText}`
        );
      }

      const data: OrganizationUserUsage = await response.json();
      setOrgUserData(data);
    } catch (err) {
      console.error("Failed to fetch organization user data:", err);
    }
  };

  const fetchUserQuotas = async () => {
    if (!organizationId) return;

    try {
      const response = await apiFetch(
        buildApiUrl(`quota/organization/${organizationId}/users/quotas`),
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch user quotas: ${response.statusText}`);
      }

      const data: UserQuotaList = await response.json();
      setUserQuotas(data);

      // If no users found, automatically populate user quotas
      if (data.users.length === 0) {
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
          // Fetch again after populating
          const populatedResponse = await apiFetch(
            buildApiUrl(`quota/organization/${organizationId}/users/quotas`),
            { credentials: "include" }
          );
          if (populatedResponse.ok) {
            const populatedData: UserQuotaList = await populatedResponse.json();
            setUserQuotas(populatedData);
          }
        } catch (populateErr) {
          console.error(
            "Failed to automatically populate user quotas:",
            populateErr
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch user quotas:", err);
    }
  };

  const syncFromCostReport = async (showLoading = false) => {
    try {
      if (showLoading) {
        setSyncing(true);
      }

      const response = await apiFetch(
        buildApiUrl("quota/sync-from-cost-report"),
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to sync from cost report: ${response.statusText}`
        );
      }

      // Refresh the data after sync
      await fetchQuotaData(false);
      setLastSyncTime(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sync from cost report"
      );
    } finally {
      if (showLoading) {
        setSyncing(false);
      }
    }
  };

  useEffect(() => {
    if (organizationId) {
      // Initial data fetch
      fetchQuotaData();
      fetchOrgUserData();
      fetchUserQuotas(); // Fetch user quotas on mount

      // Set up automatic sync every 45 seconds
      const interval = setInterval(() => {
        syncFromCostReport(false);
        if (showOrgView) {
          fetchOrgUserData();
        }
        fetchUserQuotas(); // Sync user quotas periodically
      }, 45000); // 45 seconds

      setAutoSyncInterval(interval);

      // Cleanup on unmount
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [organizationId, showOrgView]);

  const handleEditOrg = () => {
    setOpenOrgModal(true);
  };

  const handleUpdateQuota = async () => {
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

      // Refresh the data
      await fetchQuotaData();
      setOpenOrgModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quota");
    } finally {
      setUpdating(false);
    }
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
      if (resetIndividualQuotas && userQuotas) {
        for (const userQuota of userQuotas.users) {
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
      } else {
        // Update all non-custom user quotas to the new organization default
        if (userQuotas) {
          for (const userQuota of userQuotas.users) {
            if (!userQuota.custom_quota) {
              try {
                await apiFetch(
                  buildApiUrl(
                    `quota/organization/${organizationId}/users/${userQuota.user_id}/quota`
                  ),
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
              } catch (err) {
                console.error(
                  `Failed to update quota for user ${userQuota.user_id}:`,
                  err
                );
              }
            }
          }
        }
      }

      // Refresh all data
      await Promise.all([
        fetchQuotaData(),
        fetchUserQuotas(),
        fetchOrgUserData(),
      ]);

      setOpenOrgModal(false);
      setShowResetConfirmation(false);
      setResetIndividualQuotas(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quota");
    } finally {
      setUpdating(false);
    }
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

      // Refresh the data
      await fetchUserQuotas();
      setOpenUserQuotaModal(false);
      setSelectedUser(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update user quota"
      );
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
      await fetchUserQuotas();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete user quota"
      );
    }
  };

  const handleSyncFromCostReport = async () => {
    await syncFromCostReport(true);
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
          onClick={() => fetchQuotaData()}
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
      subtitle="Set and manage per-user compute quota for your organization."
    >
      {/* View Toggle */}
      <Box sx={{ mb: 3 }}>
        <FormControl orientation="horizontal">
          <FormLabel>View Mode:</FormLabel>
          <Switch
            checked={showOrgView}
            onChange={(e) => setShowOrgView(e.target.checked)}
            startDecorator={
              showOrgView ? <Users size={16} /> : <PieChart size={16} />
            }
            endDecorator={showOrgView ? "Organization View" : "User View"}
          />
        </FormControl>
      </Box>

      {/* Organization Section */}
      <Box sx={{ mb: 4 }}>
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          {showOrgView ? "Organization Overview" : "Your Quota"}
        </Typography>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} md={6}>
              <Typography level="h4">
                {user?.organization_name || "Organization"} GPU Quota
              </Typography>
              <Typography level="body-md" color="neutral">
                Monthly GPU hour allocation per user
              </Typography>
            </Grid>
            <Grid
              xs={12}
              md={6}
              display="flex"
              justifyContent="flex-end"
              gap={1}
            >
              <Button
                startDecorator={<RotateCcw size={16} />}
                onClick={handleSyncFromCostReport}
                loading={syncing}
                variant="outlined"
              >
                Sync from Cost Report
              </Button>
              {lastSyncTime && (
                <Typography level="body-xs" color="neutral">
                  Last sync: {lastSyncTime.toLocaleTimeString()}
                </Typography>
              )}
              <Button
                startDecorator={<Edit2 size={16} />}
                onClick={handleEditOrg}
              >
                Edit Quota
              </Button>
            </Grid>
          </Grid>
        </Card>

        {/* Quota Usage Card - Only show in User View */}
        {!showOrgView && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <Grid container spacing={3}>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Monthly Limit
                </Typography>
                <Typography level="h3">
                  {formatHours(organization_quota.monthly_gpu_hours_per_user)}{" "}
                  hours per user
                </Typography>
              </Grid>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Used This Month
                </Typography>
                <Typography level="h3" color="primary">
                  {formatHours(organization_quota.gpu_hours_used)} hours
                </Typography>
              </Grid>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Remaining
                </Typography>
                <Typography level="h3" color="success">
                  {formatHours(organization_quota.gpu_hours_remaining)} hours
                </Typography>
              </Grid>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Usage
                </Typography>
                <Typography level="h3">
                  {organization_quota.usage_percentage.toFixed(1)}%
                </Typography>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
              <LinearProgress
                determinate
                value={organization_quota.usage_percentage}
                color={getQuotaUsageColor(organization_quota.usage_percentage)}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
              Period: {formatDate(organization_quota.current_period_start)} -{" "}
              {formatDate(organization_quota.current_period_end)}
            </Typography>
          </Card>
        )}
      </Box>

      {/* Organization User Breakdown */}
      {showOrgView && orgUserData && (
        <Box sx={{ mb: 4 }}>
          <Typography level="h4" component="h2" sx={{ mb: 2 }}>
            User Usage Breakdown
          </Typography>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <Grid container spacing={3}>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Quota Per User
                </Typography>
                <Typography level="h3">
                  {formatHours(orgUserData.quota_per_user)} hours
                </Typography>
              </Grid>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Total Users
                </Typography>
                <Typography level="h3" color="primary">
                  {orgUserData.total_users}
                </Typography>
              </Grid>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Total Organization Usage
                </Typography>
                <Typography level="h3" color="success">
                  {formatHours(orgUserData.total_organization_usage)} hours
                </Typography>
              </Grid>
              <Grid xs={12} md={3}>
                <Typography level="body-sm" color="neutral">
                  Period
                </Typography>
                <Typography level="h3">
                  {formatDate(orgUserData.period_start)} -{" "}
                  {formatDate(orgUserData.period_end)}
                </Typography>
              </Grid>
            </Grid>
          </Card>

          {/* User Usage Visualization */}
          <Grid container spacing={3}>
            <Grid xs={12} md={6}>
              <UserUsagePieChart data={orgUserData.user_breakdown} />
            </Grid>
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <Typography level="h4" sx={{ mb: 2 }}>
                  Individual User Usage
                </Typography>
                <Table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Used</th>
                      <th>Limit</th>
                      <th>Remaining</th>
                      <th>Usage %</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUserData.user_breakdown.map((user) => (
                      <tr key={user.user_id}>
                        <td>{user.user_name || "Unknown"}</td>
                        <td>{user.user_email || user.user_id}</td>
                        <td>{formatHours(user.gpu_hours_used)}</td>
                        <td>{formatHours(user.gpu_hours_limit)}</td>
                        <td>{formatHours(user.gpu_hours_remaining)}</td>
                        <td>{user.usage_percentage.toFixed(1)}%</td>
                        <td>
                          <Chip
                            color={
                              user.usage_percentage < 50
                                ? "success"
                                : user.usage_percentage < 80
                                ? "warning"
                                : "danger"
                            }
                            size="sm"
                          >
                            {user.usage_percentage < 50
                              ? "Good"
                              : user.usage_percentage < 80
                              ? "Warning"
                              : "Critical"}
                          </Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Individual User Quota Management */}
      {userQuotas && (
        <Box sx={{ mb: 4 }}>
          <Typography level="h4" component="h2" sx={{ mb: 2 }}>
            Individual User Quotas
          </Typography>
          <Card variant="outlined">
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              Default quota per user:{" "}
              {formatHours(userQuotas.default_quota_per_user)} hours
            </Typography>
            {userQuotas.users.length === 0 ? (
              <Alert color="neutral">Loading user quotas...</Alert>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Custom Quota</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userQuotas.users.map((userQuota) => (
                    <tr key={userQuota.user_id}>
                      <td>{userQuota.user_name || "Unknown"}</td>
                      <td>{userQuota.user_email || userQuota.user_id}</td>
                      <td>
                        {userQuota.custom_quota ? (
                          <Chip color="primary" size="sm">
                            {formatHours(userQuota.monthly_gpu_hours_per_user)}{" "}
                            hours
                          </Chip>
                        ) : (
                          <Chip color="neutral" size="sm">
                            Using Default (
                            {formatHours(userQuota.monthly_gpu_hours_per_user)}{" "}
                            hours)
                          </Chip>
                        )}
                      </td>
                      <td>
                        <Stack direction="row" spacing={1}>
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
          {showOrgView ? "All Users Recent Usage" : "Recent GPU Usage"}
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
          <Typography level="body-sm" mb={2}>
            Set the monthly GPU hour quota per user for your organization
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
            Set the monthly GPU hour quota for{" "}
            {selectedUser?.user_name || selectedUser?.user_id}
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input
              placeholder="Monthly GPU Hours Limit"
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
              <Button
                variant="outlined"
                color="danger"
                onClick={async () => {
                  await handleDeleteUserQuota(selectedUser!);
                  setOpenUserQuotaModal(false);
                  setSelectedUser(null);
                }}
                loading={updatingUserQuota}
              >
                Delete Quota
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Quota;
