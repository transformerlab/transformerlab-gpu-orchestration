import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  Typography,
  Stack,
  Chip,
  IconButton,
  Table,
} from "@mui/joy";
import { Monitor } from "lucide-react";
import { buildApiUrl } from "../utils/api";

interface SSHNode {
  ip: string;
  user: string;
  identity_file?: string;
  password?: string;
}

interface Cluster {
  cluster_name: string;
  nodes: SSHNode[];
}

interface ClusterManagementProps {
  onClusterSelected?: (clusterName: string) => void;
}

const ClusterManagement: React.FC<ClusterManagementProps> = ({
  onClusterSelected,
}) => {
  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClusters();
  }, []);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl("clusters"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setClusters(data.clusters);
      } else {
        setError("Failed to fetch clusters");
      }
    } catch (err) {
      setError("Error fetching clusters");
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterDetails = async (clusterName: string) => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`clusters/${clusterName}`), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCluster(data);
        if (onClusterSelected) {
          onClusterSelected(clusterName);
        }
      } else {
        setError("Failed to fetch cluster details");
      }
    } catch (err) {
      setError("Error fetching cluster details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Card color="danger" variant="soft" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography color="danger">{error}</Typography>
          </Box>
        </Card>
      )}
      <Box sx={{ mb: 3 }}>
        <Typography level="h2">Node Pools</Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          These are the node pools (clusters) you have access to.
        </Typography>
      </Box>
      <Card sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Node Pools
        </Typography>
        {clusters.length === 0 ? (
          <Typography level="body-md" sx={{ color: "text.secondary" }}>
            No Node Pools found.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {clusters.map((clusterName) => (
              <Box
                key={clusterName}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  p: 2,
                  border: "1px solid",
                  borderColor:
                    selectedCluster?.cluster_name === clusterName
                      ? "primary.main"
                      : "neutral.300",
                  borderRadius: "md",
                  cursor: "pointer",
                  bgcolor:
                    selectedCluster?.cluster_name === clusterName
                      ? "primary.50"
                      : "transparent",
                }}
                onClick={() => fetchClusterDetails(clusterName)}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Monitor size={16} />
                  <Typography level="title-md">{clusterName}</Typography>
                  {selectedCluster?.cluster_name === clusterName && (
                    <Chip variant="soft" color="primary" size="sm">
                      Selected
                    </Chip>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Card>
      {/* Selected Cluster Details */}
      {selectedCluster && (
        <Card>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Typography level="h4">
              Node Pool: {selectedCluster.cluster_name}
            </Typography>
          </Box>
          {selectedCluster.nodes.length === 0 ? (
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              No nodes in this cluster.
            </Typography>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>User</th>
                  <th>Identity File</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {selectedCluster.nodes.map((node, index) => (
                  <tr key={index}>
                    <td>{node.ip}</td>
                    <td>{node.user}</td>
                    <td>
                      {node.identity_file ? (
                        <Chip size="sm" variant="soft">
                          {node.identity_file.split("/").pop() ||
                            node.identity_file}
                        </Chip>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{node.password ? "****" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </Box>
  );
};

export default ClusterManagement;
