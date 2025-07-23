import React, { useState, useEffect } from "react";
import { Box, Button, Card, Typography, Table, Chip } from "@mui/joy";
import { RefreshCw, Monitor, Terminal, Square, Trash2 } from "lucide-react";
import TaskOutputModal from "./TaskOutputModal";
import { buildApiUrl } from "../utils/api";

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

interface ClusterTypeInfo {
  cluster_name: string;
  cluster_type: string;
  is_ssh: boolean;
  available_operations: string[];
  recommendations: {
    stop: string;
    down: string;
  };
}

const SkyPilotClusterStatus: React.FC = () => {
  const [clusters, setClusters] = useState<ClusterStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputModalOpen, setOutputModalOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string>("");
  const [operationLoading, setOperationLoading] = useState<{
    [key: string]: boolean;
  }>({});
  const [clusterTypes, setClusterTypes] = useState<{
    [key: string]: ClusterTypeInfo;
  }>({});

  useEffect(() => {
    fetchClusterStatus();
  }, []);

  const fetchClusterStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(buildApiUrl("skypilot/status"), {
        credentials: "include",
      });

      if (response.ok) {
        const data: StatusResponse = await response.json();
        setClusters(data.clusters);

        // Fetch cluster type info for each cluster
        const typePromises = data.clusters.map(async (cluster) => {
          try {
            const typeResponse = await fetch(
              buildApiUrl(`skypilot/cluster-type/${cluster.cluster_name}`),
              {
                credentials: "include",
              }
            );
            if (typeResponse.ok) {
              const typeData: ClusterTypeInfo = await typeResponse.json();
              return { [cluster.cluster_name]: typeData };
            }
          } catch (err) {
            console.error(
              `Failed to fetch cluster type for ${cluster.cluster_name}:`,
              err
            );
          }
          return null;
        });

        const typeResults = await Promise.all(typePromises);
        const typesMap: { [key: string]: ClusterTypeInfo } = {};

        typeResults.forEach((result) => {
          if (result && typeof result === "object") {
            Object.assign(typesMap, result);
          }
        });

        setClusterTypes(typesMap);
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

  const handleViewOutput = (clusterName: string) => {
    setSelectedCluster(clusterName);
    setOutputModalOpen(true);
  };

  const handleStopCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: true,
      }));
      const response = await fetch(buildApiUrl("skypilot/stop"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (response.ok) {
        // Refresh cluster status after successful operation
        await fetchClusterStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to stop cluster");
      }
    } catch (err) {
      setError("Error stopping cluster");
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: false,
      }));
    }
  };

  const handleDownCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: true,
      }));
      const response = await fetch(buildApiUrl("skypilot/down"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (response.ok) {
        // Refresh cluster status after successful operation
        await fetchClusterStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to down cluster");
      }
    } catch (err) {
      setError("Error downing cluster");
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: false,
      }));
    }
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
                <th>Actions</th>
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
                  <td>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        size="sm"
                        variant="outlined"
                        startDecorator={<Terminal size={14} />}
                        onClick={() => handleViewOutput(cluster.cluster_name)}
                        disabled={
                          cluster.status.toLowerCase() !== "up" &&
                          !cluster.status.toLowerCase().includes("up")
                        }
                      >
                        Output
                      </Button>

                      {/* Show stop button only for cloud clusters and if cluster is UP */}
                      {clusterTypes[cluster.cluster_name] &&
                        !clusterTypes[cluster.cluster_name].is_ssh &&
                        cluster.status.toLowerCase().includes("up") && (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="warning"
                            startDecorator={<Square size={14} />}
                            onClick={() =>
                              handleStopCluster(cluster.cluster_name)
                            }
                            loading={
                              operationLoading[`stop_${cluster.cluster_name}`]
                            }
                            disabled={
                              operationLoading[`stop_${cluster.cluster_name}`]
                            }
                          >
                            Stop
                          </Button>
                        )}

                      {/* Show down button for all clusters if cluster is UP */}
                      {cluster.status.toLowerCase().includes("up") && (
                        <Button
                          size="sm"
                          variant="outlined"
                          color="danger"
                          startDecorator={<Trash2 size={14} />}
                          onClick={() =>
                            handleDownCluster(cluster.cluster_name)
                          }
                          loading={
                            operationLoading[`down_${cluster.cluster_name}`]
                          }
                          disabled={
                            operationLoading[`down_${cluster.cluster_name}`]
                          }
                        >
                          Down
                        </Button>
                      )}

                      {/* Show cluster type indicator */}
                      {clusterTypes[cluster.cluster_name] && (
                        <Chip
                          size="sm"
                          variant="outlined"
                          color={
                            clusterTypes[cluster.cluster_name].is_ssh
                              ? "primary"
                              : "neutral"
                          }
                        >
                          {clusterTypes[
                            cluster.cluster_name
                          ].cluster_type.toUpperCase()}
                        </Chip>
                      )}
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <TaskOutputModal
        open={outputModalOpen}
        onClose={() => setOutputModalOpen(false)}
        clusterName={selectedCluster}
      />
    </Box>
  );
};

export default SkyPilotClusterStatus;
