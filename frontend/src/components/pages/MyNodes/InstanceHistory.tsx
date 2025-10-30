import React, { useState } from "react";
import {
  Box,
  Card,
  Typography,
  Table,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from "@mui/joy";
import { RefreshCw, Clock } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import useSWR from "swr";
import ResourceDisplay from "../../widgets/ResourceDisplay";

interface InstanceHistoryData {
  name: string;
  launched_at?: number;
  duration?: number;
  resources_str_full?: string;
  status?: string;
  total_cost: number;
}

const InstanceHistory: React.FC = () => {
  // Use SWR for fetching instance history with auto-refresh
  const {
    data: historyData,
    error,
    mutate,
  } = useSWR(
    "instances/cost-report",
    async () => {
      const response = await apiFetch(buildApiUrl("instances/cost-report"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch instance history");
      }
      const data = await response.json();
      return data || [];
    },
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    },
  );

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "—";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "—";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}h ` : ""}${mins > 0 ? `${mins}m ` : ""}${secs}s`;
  };

  const formatCost = (cost: number) => {
    return cost.toFixed(2);
  };

  // Filter out instances that are currently active (init or up)
  const filteredHistoryData =
    historyData?.filter((instance: InstanceHistoryData) => {
      const status = instance.status?.toLowerCase() || "";
      return !status.includes("init") && !status.includes("up");
    }) || [];

  if (!historyData && !error) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error.message}
        </Alert>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Instance Name</th>
              <th>Resources</th>
              <th>Launched At</th>
              <th>Duration</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistoryData.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  <Typography level="body-sm" color="neutral">
                    No instance history found
                  </Typography>
                </td>
              </tr>
            ) : (
              filteredHistoryData.map((instance: InstanceHistoryData) => (
                <tr key={instance.name}>
                  <td>
                    <Typography level="body-sm" fontWeight="bold">
                      {instance.name}
                    </Typography>
                  </td>
                  <td>
                    <ResourceDisplay
                      resourcesStr={instance.resources_str_full || ""}
                      variant="compact"
                      size="sm"
                    />
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDate(instance.launched_at)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDuration(instance.duration)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight="bold">
                      {formatCost(instance.total_cost)}
                    </Typography>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </>
  );
};

export default InstanceHistory;
