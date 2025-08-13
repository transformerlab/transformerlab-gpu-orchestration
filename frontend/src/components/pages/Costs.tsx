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
} from "@mui/joy";
import PageWithTitle from "./templates/PageWithTitle";
import { buildApiUrl } from "../../utils/api";
import { useFakeData } from "../../context/FakeDataContext";
import { CircularProgress } from "@mui/joy";
import ResourceDisplay from "../widgets/ResourceDisplay";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const Reports: React.FC = () => {
  const [realData, setRealData] = useState<RealReportsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showFakeData } = useFakeData();

  const fetchRealData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(
        "Fetching real data from: ",
        buildApiUrl("skypilot/cost-report")
      );
      const response = await fetch(buildApiUrl("skypilot/cost-report"), {
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
        err instanceof Error ? err.message : "Failed to fetch real data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealData();
  }, []);

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
  const totalCost = dataToRender.reduce(
    (sum, job) => sum + (job.total_cost || 0),
    0
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

  // Prepare weekly aggregated data for the chart
  const weeklyCostData = useMemo(() => {
    const map = new Map<number, number>();
    for (const job of dataToRender as any[]) {
      if (!job?.launched_at || !job?.total_cost) continue;
      const wk = getWeekStartMs(job.launched_at);
      map.set(wk, (map.get(wk) || 0) + Number(job.total_cost || 0));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ms, total]) => ({
        week: new Date(ms).toLocaleDateString(undefined, {
          year: "2-digit",
          month: "short",
          day: "numeric",
        }),
        total: Number(total.toFixed(2)),
      }));
  }, [dataToRender]);

  return (
    <PageWithTitle title="Costs Incurred by Instances">
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Card variant="plain" sx={{ mb: 2, height: 320 }}>
            <Typography level="title-md" sx={{ mb: 1 }}>
              Weekly Costs
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyCostData}
                margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [
                    `$${(value as number).toFixed(2)}`,
                    "Cost",
                  ]}
                  labelFormatter={(label) => `Week of ${label}`}
                />
                <Bar
                  dataKey="total"
                  name="Cost"
                  fill="var(--joy-palette-success-300)"
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card variant="soft" sx={{ mb: 2, alignItems: "center" }}>
            <Typography>Total Cost: ${totalCost.toFixed(2)}</Typography>
          </Card>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Launched</th>
                <th>Duration</th>
                <th>Resources</th>
                <th>Status</th>
                <th>Cost/hr</th>
                <th>Cost (est.)</th>
              </tr>
            </thead>
            <tbody>
              {dataToRender.map((job, index) => (
                <tr key={index}>
                  <td>{job.name}</td>
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
                      color={
                        job.status === "UP" || job.status === null
                          ? "success"
                          : "neutral"
                      }
                    >
                      {job.status || "TERMINATED"}
                    </Chip>
                  </td>
                  <td>
                    {job.duration
                      ? `${(job.total_cost / (job.duration / 3600)).toFixed(2)}`
                      : "-"}
                  </td>
                  <td>${job.total_cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      )}
    </PageWithTitle>
  );
};

export default Reports;
