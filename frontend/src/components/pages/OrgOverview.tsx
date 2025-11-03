import React, { useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Card,
  Table,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Badge,
  Divider,
} from "@mui/joy";
import {
  Users,
  DollarSign,
  Activity,
  Calendar,
  TrendingUp,
  User,
  Clock,
  Server,
} from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import useSWR from "swr";
import { useAuth } from "../../context/AuthContext";

interface UserUsageBreakdown {
  user_id: string;
  user_email?: string;
  user_name?: string;
  active_clusters: number;
  total_cpus: number;
  total_gpus: number;
  total_memory: number;
  clusters: Array<{
    cluster_name: string;
    actual_name: string;
    resources: {
      cpus: number;
      gpu_count: number;
      memory: number;
      gpu_type?: string;
    };
    status: string;
  }>;
  credits_limit: number;
  credits_remaining: number;
  usage_percentage: number;
}

interface OrgUsageData {
  organization_id: string;
  cluster_name: string;
  node_pool_name: string;
  period_start: string;
  period_end: string;
  quota_per_user: number;
  total_users: number;
  total_active_clusters: number;
  user_breakdown: UserUsageBreakdown[];
}

interface OrgOverviewProps {
  clusterName: string;
  organizationId: string;
}

const OrgOverview: React.FC<OrgOverviewProps> = ({
  clusterName,
  organizationId,
}) => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Fetch organization user usage data
  const fetcher = async (url: string) => {
    try {
      const res = await apiFetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    } catch (error) {
      console.error("[OrgOverview] fetch error:", error);
      throw error;
    }
  };

  const {
    data: orgUsageData,
    isLoading,
    error,
  } = useSWR<OrgUsageData>(
    organizationId && clusterName
      ? buildApiUrl(
          `quota/organization/${organizationId}/users/cluster/${encodeURIComponent(
            clusterName,
          )}`,
        )
      : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
    },
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "danger";
    if (percentage >= 75) return "warning";
    return "success";
  };

  const getUsageVariant = (percentage: number) => {
    if (percentage >= 90) return "solid";
    if (percentage >= 75) return "soft";
    return "soft";
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 200,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger" variant="soft">
        <Typography>
          Failed to load organization usage data: {error.message}
        </Typography>
      </Alert>
    );
  }

  if (!orgUsageData) {
    return (
      <Alert color="warning" variant="soft">
        <Typography>No organization usage data available</Typography>
      </Alert>
    );
  }

  const {
    user_breakdown,
    total_active_clusters,
    total_users,
    period_start,
    period_end,
  } = orgUsageData;

  // Filter users who have active instances
  const activeUsers = user_breakdown.filter((user) => user.active_clusters > 0);
  const totalActiveUsers = activeUsers.length;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography level="h3" sx={{ mb: 1 }}>
            Organization Resource Usage
          </Typography>
          <Typography level="body-md" color="neutral">
            Resource usage for {clusterName} across your organization
          </Typography>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2}>
          <Grid xs={12} sm={6} md={3}>
            <Card variant="soft" color="primary">
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Users size={20} />
                  <Typography level="body-sm" color="primary">
                    Active Users
                  </Typography>
                </Box>
                <Typography level="h3" color="primary">
                  {totalActiveUsers}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  of {total_users} total users
                </Typography>
              </Stack>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} md={3}>
            <Card variant="soft" color="success">
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Server size={20} />
                  <Typography level="body-sm" color="success">
                    Active Instances
                  </Typography>
                </Box>
                <Typography level="h3" color="success">
                  {total_active_clusters}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  currently running
                </Typography>
              </Stack>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} md={3}>
            <Card variant="soft" color="warning">
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Activity size={20} />
                  <Typography level="body-sm" color="warning">
                    Avg Instances
                  </Typography>
                </Box>
                <Typography level="h3" color="warning">
                  {totalActiveUsers > 0
                    ? (total_active_clusters / totalActiveUsers).toFixed(1)
                    : 0}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  per active user
                </Typography>
              </Stack>
            </Card>
          </Grid>

          <Grid xs={12} sm={6} md={3}>
            <Card variant="soft" color="neutral">
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Calendar size={20} />
                  <Typography level="body-sm" color="neutral">
                    Period
                  </Typography>
                </Box>
                <Typography level="body-sm" fontWeight="lg">
                  {new Date(period_start).toLocaleDateString()}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  to {new Date(period_end).toLocaleDateString()}
                </Typography>
              </Stack>
            </Card>
          </Grid>
        </Grid>

        <Divider />

        {/* User Usage Table */}
        <Card>
          <Box sx={{ p: 2, pb: 0 }}>
            <Typography level="h4" sx={{ mb: 1 }}>
              User Resource Usage
            </Typography>
            <Typography level="body-sm" color="neutral">
              Individual user usage for {clusterName}
            </Typography>
          </Box>

          {activeUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography level="body-md" color="neutral">
                No active users found for this node pool
              </Typography>
            </Box>
          ) : (
            <Table hoverRow>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Active Instances</th>
                  <th>Total CPUs</th>
                  <th>Total GPUs</th>
                  <th>Total Memory (GB)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers
                  .sort((a, b) => b.active_clusters - a.active_clusters)
                  .map((userData) => (
                    <tr key={userData.user_id}>
                      <td>
                        <Stack spacing={0.5}>
                          <Typography level="body-sm" fontWeight="lg">
                            {userData.user_name || "Unknown User"}
                          </Typography>
                          {userData.user_email && (
                            <Typography level="body-xs" color="neutral">
                              {userData.user_email}
                            </Typography>
                          )}
                        </Stack>
                      </td>
                      <td>
                        <Typography level="body-sm" fontWeight="lg">
                          {userData.active_clusters}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {userData.total_cpus}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {userData.total_gpus}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {userData.total_memory}
                        </Typography>
                      </td>
                      <td>
                        <Chip
                          size="sm"
                          color="success"
                          variant="soft"
                          startDecorator={<Server size={12} />}
                        >
                          Active
                        </Chip>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          )}
        </Card>

        {/* Resource Insights */}
        {activeUsers.length > 0 && (
          <Card variant="soft" color="neutral">
            <Box sx={{ p: 2 }}>
              <Typography level="h4" sx={{ mb: 2 }}>
                Resource Insights
              </Typography>
              <Grid container spacing={2}>
                <Grid xs={12} md={6}>
                  <Stack spacing={1}>
                    <Typography level="body-sm" fontWeight="lg">
                      Most Active User
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {activeUsers[0]?.user_name || "Unknown"} -{" "}
                      {activeUsers[0]?.active_clusters || 0} clusters
                    </Typography>
                  </Stack>
                </Grid>
                <Grid xs={12} md={6}>
                  <Stack spacing={1}>
                    <Typography level="body-sm" fontWeight="lg">
                      Total Resources
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {activeUsers.reduce((sum, u) => sum + u.total_cpus, 0)}{" "}
                      CPUs,{" "}
                      {activeUsers.reduce((sum, u) => sum + u.total_gpus, 0)}{" "}
                      GPUs
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          </Card>
        )}
      </Stack>
    </Box>
  );
};

export default OrgOverview;
