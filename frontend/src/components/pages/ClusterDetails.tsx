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
  const { clusterName } = useParams<{ clusterName: string }>();
  const navigate = useNavigate();
  const { showFakeData } = useFakeData();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloudConfig, setCloudConfig] = useState<any>(null);

  useEffect(() => {
    if (!clusterName) return;

    setLoading(true);
    setError(null);

    // Check if this is a cloud cluster (RunPod or Azure)
    const isCloudCluster =
      clusterName.toLowerCase().includes("runpod") ||
      clusterName.toLowerCase().includes("azure") ||
      clusterName === "runpod-cluster" ||
      clusterName === "azure-cluster";

    if (isCloudCluster) {
      // For cloud clusters, fetch configuration instead of nodes
      const configEndpoint = clusterName.toLowerCase().includes("runpod")
        ? "skypilot/runpod/config"
        : "skypilot/azure/config";

      const instancesEndpoint = clusterName.toLowerCase().includes("runpod")
        ? "skypilot/runpod/instances"
        : "skypilot/azure/instances";

      Promise.all([
        apiFetch(buildApiUrl(configEndpoint), { credentials: "include" }),
        apiFetch(buildApiUrl(instancesEndpoint), { credentials: "include" }),
      ])
        .then(([configRes, instancesRes]) => {
          const configData = configRes.ok ? configRes.json() : null;
          const instancesData = instancesRes.ok ? instancesRes.json() : null;

          return Promise.all([configData, instancesData]);
        })
        .then(([config, instances]) => {
          if (config) {
            setCloudConfig({
              ...config,
              current_instances: instances?.current_count || 0,
              max_instances:
                instances?.max_instances || config.max_instances || 0,
              can_launch:
                instances?.can_launch !== undefined
                  ? instances.can_launch
                  : true,
            });
          } else {
            setError("Failed to fetch cloud cluster configuration");
          }
        })
        .catch((err) => {
          console.error("Error fetching cloud cluster config:", err);
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // For regular clusters, fetch nodes as before
      apiFetch(buildApiUrl(`clusters/${clusterName}`), {
        credentials: "include",
      })
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
                identity_file: `/home/user/.ssh/id_rsa_${clusterName}`,
                gpu_info: gpuTypes[Math.floor(Math.random() * gpuTypes.length)],
                status: statuses[
                  Math.floor(Math.random() * statuses.length)
                ] as "active" | "inactive" | "unhealthy",
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
    }
  }, [clusterName, showFakeData]);

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

  // Check if this is a cloud cluster
  const isCloudCluster =
    clusterName?.toLowerCase().includes("runpod") ||
    clusterName?.toLowerCase().includes("azure") ||
    clusterName === "runpod-cluster" ||
    clusterName === "azure-cluster";

  return (
    <PageWithTitle
      title={`${clusterName}`}
      backButton={true}
      onBack={handleBack}
    >
      <Sheet sx={{ mb: 4, p: 2, borderRadius: "md", boxShadow: "sm" }}>
        {isCloudCluster && cloudConfig ? (
          // Show cloud configuration table
          <Box sx={{ mb: 2 }}>
            <Typography level="h3" sx={{ mb: 1 }}>
              {clusterName} - Cloud Configuration
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography level="title-lg" sx={{ mb: 2 }}>
                Instance Limits
              </Typography>
              <Table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Current Instances</td>
                    <td>{cloudConfig.current_instances}</td>
                  </tr>
                  <tr>
                    <td>Maximum Instances</td>
                    <td>{cloudConfig.max_instances}</td>
                  </tr>
                  <tr>
                    <td>Available Instances</td>
                    <td>
                      {cloudConfig.max_instances -
                        cloudConfig.current_instances}
                    </td>
                  </tr>
                  <tr>
                    <td>Can Launch New Instances</td>
                    <td>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={cloudConfig.can_launch ? "success" : "warning"}
                      >
                        {cloudConfig.can_launch ? "Yes" : "No"}
                      </Chip>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography level="title-lg" sx={{ mb: 2 }}>
                Allowed GPU Types ({cloudConfig.allowed_gpu_types?.length || 0})
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                {cloudConfig.allowed_gpu_types?.map(
                  (gpuType: string, index: number) => (
                    <Chip key={index} size="sm" variant="soft" color="primary">
                      {gpuType}
                    </Chip>
                  )
                ) || (
                  <Typography level="body-sm" color="neutral">
                    No GPU types configured
                  </Typography>
                )}
              </Box>
            </Box>

            {cloudConfig.allowed_regions &&
              cloudConfig.allowed_regions.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography level="title-lg" sx={{ mb: 2 }}>
                    Allowed Regions ({cloudConfig.allowed_regions.length})
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    {cloudConfig.allowed_regions.map(
                      (region: string, index: number) => (
                        <Chip
                          key={index}
                          size="sm"
                          variant="soft"
                          color="neutral"
                        >
                          {region}
                        </Chip>
                      )
                    )}
                  </Box>
                </Box>
              )}
          </Box>
        ) : (
          // Show regular cluster nodes table
          <>
            <Box sx={{ mb: 2 }}>
              <Typography level="h3" sx={{ mb: 1 }}>
                {clusterName} - Cluster Details
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip size="sm" color="primary" variant="soft">
                  {nodes.length} Total Nodes
                </Chip>
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
                    <th style={{ width: "10%", wordWrap: "break-word" }}>
                      Status
                    </th>
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
          </>
        )}
      </Sheet>
    </PageWithTitle>
  );
};

export default ClusterDetails;
