import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Card,
  Typography,
  Table,
  Chip,
  Divider,
  Stack,
  Sheet,
  Button,
} from "@mui/joy";
import PageWithTitle from "./templates/PageWithTitle";
import { buildApiUrl } from "../../utils/api";
import { useFakeData } from "../../context/FakeDataContext";
import { useAuth } from "../../context/AuthContext";
import { CircularProgress } from "@mui/joy";
import ResourceDisplay from "../widgets/ResourceDisplay";
import CloudServiceIcon from "../widgets/CloudServiceIcon";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

function formatStatusColor(status: string) {
  switch (status) {
    case "UP":
      return "success";
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

interface CostReportJob {
  name: string;
  launched_at?: number;
  duration?: number;
  resources_str_full?: string;
  status?: string;
  total_cost: number;
  cloud_provider?: string;
}

const Reports: React.FC = () => {
  const [realData, setRealData] = useState<CostReportJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number>(100); // Default fallback
  const [quotaLoading, setQuotaLoading] = useState(false);
  const { user } = useAuth();

  const formatCloudProvider = (provider: string | undefined): string => {
    if (!provider) return "Unknown";
    if (provider === "direct") return "Direct";

    // Handle specific cloud providers
    const knownProviders: { [key: string]: string } = {
      azure: "Azure",
      runpod: "RunPod",
      gcp: "Google Cloud",
      aws: "AWS",
    };

    if (knownProviders[provider.toLowerCase()]) {
      return knownProviders[provider.toLowerCase()];
    }

    // Format unknown providers: capitalize first letter of each word
    return provider
      .split(/[\s_-]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const fetchQuotaData = async () => {
    if (!user?.organization_id) return;

    setQuotaLoading(true);
    try {
      const response = await fetch(
        buildApiUrl(`quota/organization/${user.organization_id}`),
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setQuotaLimit(data.monthly_credits_per_user || 100);
    } catch (err) {
      console.error("Failed to fetch quota data:", err);
      // Keep the default 100 if quota fetch fails
    } finally {
      setQuotaLoading(false);
    }
  };

  const fetchRealData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("instances/cost-report"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRealData(data);
    } catch (err) {
      console.error("Failed to fetch real data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch real data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotaData();
    fetchRealData();
  }, [user?.organization_id]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ""}${mins > 0 ? `${mins}m ` : ""}${secs}s`;
  };

  const formatLaunchedAt = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const dataToRender = realData || [];
  const [page, setPage] = useState(1);
  const rowsPerPage = 25;
  const totalPages = Math.max(1, Math.ceil(dataToRender.length / rowsPerPage));
  const pagedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return dataToRender.slice(start, end);
  }, [dataToRender, page]);
  const totalCost = dataToRender.reduce(
    (sum: number, job: CostReportJob) => sum + (job.total_cost || 0),
    0,
  );

  // Helper to compute week start (Monday) from a unix seconds timestamp
  const getWeekStartMs = (timestampSec: number) => {
    const d = new Date(timestampSec * 1000);
    const day = d.getDay(); // 0=Sun..6=Sat
    const diff = (day + 6) % 7; // Monday=0
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  // Generate all Monday dates for the current month
  const getAllWeeksInCurrentMonth = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    );

    // Find first Monday on or before the 1st of the month
    const firstMonday = new Date(firstDayOfMonth);
    const dayOfWeek = firstMonday.getDay();
    firstMonday.setDate(
      firstMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1),
    );

    const mondays = [];
    let currentMonday = new Date(firstMonday);

    // Add all Mondays until we're past the end of the month
    while (currentMonday <= lastDayOfMonth) {
      mondays.push(currentMonday.getTime());
      currentMonday = new Date(currentMonday);
      currentMonday.setDate(currentMonday.getDate() + 7);
    }

    return mondays;
  };

  // Prepare weekly aggregated data for the chart
  const weeklyCostData = useMemo(() => {
    const map = new Map<number, number>();

    // Add all jobs to the map
    for (const job of dataToRender as any[]) {
      if (!job?.launched_at || !job?.total_cost) continue;
      const wk = getWeekStartMs(job.launched_at);
      map.set(wk, (map.get(wk) || 0) + Number(job.total_cost || 0));
    }

    // Get all weeks in the current month
    const allWeeks = getAllWeeksInCurrentMonth();

    // Ensure all weeks in current month are included
    const result = allWeeks.map((weekStart) => {
      // Calculate week end date (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      return {
        weekStart,
        // Format as "MMM DD-DD" (e.g., "Feb 01-07")
        week: `${new Date(weekStart).toLocaleDateString(undefined, {
          month: "short",
          day: "2-digit",
        })}-${weekEnd.toLocaleDateString(undefined, {
          day: "2-digit",
        })}`,
        total: Number((map.get(weekStart) || 0).toFixed(2)),
      };
    });

    return result;
  }, [dataToRender]);

  return (
    <PageWithTitle title="Your Quota">
      {loading || quotaLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Card variant="plain" sx={{ mb: 2, height: 320 }}>
            <Typography level="title-md" sx={{ mb: 1 }}>
              Monthly Usage (Weekly Breakdown)
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyCostData}
                margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}`}
                  domain={[
                    0,
                    Math.max(quotaLimit, ...weeklyCostData.map((d) => d.total)),
                  ]}
                />
                <Tooltip
                  formatter={(value: number) => [
                    `${(value as number).toFixed(2)}`,
                    "Cost",
                  ]}
                  labelFormatter={(label) => {
                    if (typeof label === "string") {
                      return `Week of ${label}`;
                    }
                    return "";
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Cost"
                  fill="var(--joy-palette-success-300)"
                />
                <ReferenceLine
                  y={quotaLimit}
                  stroke="var(--joy-palette-danger-500)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Quota: ${quotaLimit}`,
                    position: "top",
                    fill: "var(--joy-palette-danger-500)",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card variant="soft" sx={{ mb: 2, alignItems: "center" }}>
            <Typography>
              Total Usage this Month: {totalCost.toFixed(2)}
            </Typography>
          </Card>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Cloud Provider</th>
                <th>Launched</th>
                <th>Duration</th>
                <th>Resources</th>
                <th>Status</th>
                <th>per hr</th>
                <th>Total (est.)</th>
              </tr>
            </thead>
            <tbody>
              {pagedData.map((job, index) => (
                <tr key={index}>
                  <td>{job.name}</td>
                  <td>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CloudServiceIcon
                        platform={job.cloud_provider || "direct"}
                      />
                      <Typography
                        level="body-sm"
                        sx={{
                          maxWidth: 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={formatCloudProvider(job.cloud_provider)}
                      >
                        {formatCloudProvider(job.cloud_provider)}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    {job.launched_at ? formatLaunchedAt(job.launched_at) : "-"}
                  </td>
                  <td>{job.duration ? formatDuration(job.duration) : "-"}</td>
                  <td>
                    <ResourceDisplay
                      resourcesStr={job.resources_str_full || ""}
                      variant="compact"
                      size="sm"
                    />
                  </td>
                  <td>
                    <Chip
                      variant="soft"
                      color={formatStatusColor(job?.status || "Terminated")}
                    >
                      {job.status || "Terminated"}
                    </Chip>
                  </td>
                  <td>
                    {job.duration
                      ? `${(job.total_cost / (job.duration / 3600)).toFixed(2)}`
                      : "-"}
                  </td>
                  <td>{job.total_cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mt: 1,
            }}
          >
            <Typography level="body-sm">
              Showing{" "}
              {dataToRender.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}-
              {Math.min(page * rowsPerPage, dataToRender.length)} of{" "}
              {dataToRender.length}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                size="sm"
                variant="outlined"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Typography level="body-sm">
                Page {page} of {totalPages}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </PageWithTitle>
  );
};

export default Reports;
