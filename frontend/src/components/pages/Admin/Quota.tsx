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
} from "@mui/joy";
import { Edit2, RefreshCw, RotateCcw } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";

interface OrganizationQuota {
  organization_id: string;
  monthly_gpu_hours: number;
  current_period_start: string;
  current_period_end: string;
  gpu_hours_used: number;
  gpu_hours_remaining: number;
  usage_percentage: number;
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
  const [newQuotaHours, setNewQuotaHours] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncInterval, setAutoSyncInterval] =
    useState<NodeJS.Timeout | null>(null);

  const organizationId = user?.organization_id;

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

      const response = await apiFetch(
        buildApiUrl(`quota/organization/${organizationId}/usage`),
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch quota data: ${response.statusText}`);
      }

      const data: QuotaUsageResponse = await response.json();
      setQuotaData(data);
      setNewQuotaHours(data.organization_quota.monthly_gpu_hours.toString());
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

      // Set up automatic sync every 45 seconds
      const interval = setInterval(() => {
        syncFromCostReport(false);
      }, 45000); // 45 seconds

      setAutoSyncInterval(interval);

      // Cleanup on unmount
      return () => {
        if (interval) {
          clearInterval(interval);
        }
      };
    }
  }, [organizationId]);

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
            monthly_gpu_hours: parseFloat(newQuotaHours),
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
      subtitle="Set and manage compute quota for your organization."
    >
      {/* Organization Section */}
      <Box sx={{ mb: 4 }}>
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          Organization Quota
        </Typography>
        <Card variant="outlined" sx={{ mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} md={6}>
              <Typography level="h4">
                {user?.organization_name || "Organization"} GPU Quota
              </Typography>
              <Typography level="body-md" color="neutral">
                Monthly GPU hour allocation
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

        {/* Quota Usage Card */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <Grid container spacing={3}>
            <Grid xs={12} md={3}>
              <Typography level="body-sm" color="neutral">
                Monthly Limit
              </Typography>
              <Typography level="h3">
                {formatHours(organization_quota.monthly_gpu_hours)} hours
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
      </Box>

      {/* Recent Usage Section */}
      <Box>
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          Recent GPU Usage
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
            Set the monthly GPU hour quota for your organization
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Input
              placeholder="Monthly GPU Hours"
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
                onClick={handleUpdateQuota}
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
    </PageWithTitle>
  );
};

export default Quota;
