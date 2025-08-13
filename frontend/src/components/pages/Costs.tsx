import React, { useState, useEffect } from "react";
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

  return (
    <PageWithTitle title="Reports">
      <Typography level="h4" sx={{ mb: 2 }}>
        Costs Incurred by Instances
      </Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Card variant="soft" sx={{ mb: 2 }}>
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
                  <td>{job.resources_str_full || "-"}</td>
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
