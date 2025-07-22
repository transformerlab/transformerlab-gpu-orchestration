import React, { useState, useEffect } from "react";
import { Box, Button, Card, Typography, Table, Chip } from "@mui/joy";
import { RefreshCw, Monitor } from "lucide-react";

interface ClusterStatus {
  cluster_name: string;
  status: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
  resources_str?: string;
}

interface StatusResponse {
  clusters: ClusterStatus[];
}

const SkyPilotClusterStatus: React.FC = () => {
  const [clusters, setClusters] = useState<ClusterStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClusterStatus();
  }, []);

  const fetchClusterStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/skypilot/status", {
        credentials: "include",
      });

      if (response.ok) {
        const data: StatusResponse = await response.json();
        setClusters(data.clusters);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to fetch cluster status");
      }
    } catch (err) {
      setError("Error fetching cluster status");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "up":
        return "success";
      case "stopped":
        return "warning";
      case "init":
        return "primary";
      default:
        return "neutral";
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAutostop = (autostop?: number, toDown?: boolean) => {
    if (!autostop) return "-";
    const action = toDown ? "down" : "stop";
    return `${autostop}min (${action})`;
  };

  return (
    <Box>
      {error && (
        <Card color="danger" variant="soft" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography color="danger">{error}</Typography>
            <Button
              variant="plain"
              size="sm"
              color="danger"
              onClick={() => setError(null)}
            >
              ×
            </Button>
          </Box>
        </Card>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Monitor size={20} />
          <Typography level="h4">SkyPilot Cluster Status</Typography>
        </Box>
        <Button
          startDecorator={<RefreshCw size={16} />}
          onClick={fetchClusterStatus}
          disabled={loading}
          loading={loading}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      <Card>
        {clusters.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              No SkyPilot clusters found.
            </Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary", mt: 1 }}>
              Launch a cluster using the SkyPilot Cluster Launcher to see it
              here.
            </Typography>
          </Box>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Cluster Name</th>
                <th>Status</th>
                <th>Resources</th>
                <th>Launched At</th>
                <th>Last Use</th>
                <th>Autostop</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster, index) => (
                <tr key={index}>
                  <td>
                    <Typography level="title-sm">
                      {cluster.cluster_name}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      color={getStatusColor(cluster.status)}
                      variant="soft"
                      size="sm"
                    >
                      {cluster.status}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {cluster.resources_str || "-"}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatTimestamp(cluster.launched_at)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {cluster.last_use || "-"}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatAutostop(cluster.autostop, cluster.to_down)}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Box>
  );
};

export default SkyPilotClusterStatus;
