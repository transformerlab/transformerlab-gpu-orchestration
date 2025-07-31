import React, { useState, useEffect } from "react";
import { Box, Button, Typography, Table, Sheet, Chip, Stack } from "@mui/joy";
import { ChevronLeftIcon } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useFakeData } from "../../context/FakeDataContext";
import PageWithTitle from "./templates/PageWithTitle";

interface Node {
  id: string;
  ip: string;
  identity_file?: string;
  gpu_info?: string;
  status?: string;
}

const ClusterDetails: React.FC = () => {
  const { clusterId } = useParams<{ clusterId: string }>();
  const navigate = useNavigate();
  const { showFakeData } = useFakeData();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) return;

    setLoading(true);
    setError(null);

    // Always try to fetch from API first, regardless of showFakeData setting
    apiFetch(buildApiUrl(`clusters/${clusterId}`), { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch cluster: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Cluster data:", data);
        // Transform the data to match our interface
        const transformedNodes = (data.nodes || []).map(
          (node: any, index: number) => ({
            id: node.id || `node-${index}`,
            ip: node.ip || node.hostname || `10.0.0.${index + 1}`,
            identity_file: node.identity_file || node.ssh_key || "-",
            gpu_info: node.gpu_info || node.gpu_type || "-",
            status: node.status || "active",
          })
        );
        setNodes(transformedNodes);
      })
      .catch((err) => {
        console.error("Error fetching cluster:", err);
        setError(err.message);
        // Only show fake data if showFakeData is enabled AND API failed
        if (showFakeData) {
          const generateFakeNodes = (count: number): Node[] => {
            const gpuTypes = [
              "NVIDIA A100",
              "NVIDIA V100",
              "NVIDIA H100",
              "NVIDIA RTX 4090",
              "NVIDIA T4",
            ];
            const statuses = ["active", "inactive", "unhealthy"];

            return Array.from({ length: count }, (_, i) => ({
              id: `node-${i + 1}`,
              ip: `10.0.${Math.floor(Math.random() * 256)}.${Math.floor(
                Math.random() * 256
              )}`,
              identity_file: `/home/user/.ssh/id_rsa_${clusterId}`,
              gpu_info: gpuTypes[Math.floor(Math.random() * gpuTypes.length)],
              status: statuses[Math.floor(Math.random() * statuses.length)] as
                | "active"
                | "inactive"
                | "unhealthy",
            }));
          };

          const nodeCount = Math.floor(Math.random() * 11) + 15; // 15-25 nodes
          const fakeNodes = generateFakeNodes(nodeCount);
          setNodes(fakeNodes);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clusterId, showFakeData]);

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <PageWithTitle title="Loading...">
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography level="body-md" sx={{ color: "text.secondary" }}>
            Loading cluster details...
          </Typography>
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle title={`${clusterId} - Cluster Details`}>
      <Sheet sx={{ mb: 4, p: 2, borderRadius: "md", boxShadow: "sm" }}>
        <Button
          onClick={handleBack}
          startDecorator={<ChevronLeftIcon />}
          variant="soft"
          sx={{ mb: 2 }}
        >
          Back
        </Button>

        <Box sx={{ mb: 2 }}>
          <Typography level="h3" sx={{ mb: 1 }}>
            {clusterId} - Cluster Details
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip size="sm" color="primary" variant="soft">
              {nodes.length} Total Nodes
            </Chip>
            {error && (
              <Chip size="sm" color="danger" variant="soft">
                API Error: {error}
              </Chip>
            )}
          </Stack>
        </Box>

        <Box sx={{ overflowX: "auto" }}>
          <Table stickyHeader sx={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "15%", wordWrap: "break-word" }}>
                  Node ID
                </th>
                <th style={{ width: "20%", wordWrap: "break-word" }}>
                  IP Address
                </th>
                <th style={{ width: "30%", wordWrap: "break-word" }}>
                  Identity File
                </th>
                <th style={{ width: "25%", wordWrap: "break-word" }}>
                  GPU Info
                </th>
                <th style={{ width: "10%", wordWrap: "break-word" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td
                    style={{
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {node.id}
                  </td>
                  <td
                    style={{
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {node.ip}
                  </td>
                  <td
                    style={{
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {node.identity_file}
                  </td>
                  <td
                    style={{
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {node.gpu_info}
                  </td>
                  <td
                    style={{
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        node.status === "active"
                          ? "success"
                          : node.status === "inactive"
                          ? "neutral"
                          : "warning"
                      }
                    >
                      {node.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </Sheet>
    </PageWithTitle>
  );
};

export default ClusterDetails;
