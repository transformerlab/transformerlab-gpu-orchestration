import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Card,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  Table,
  Sheet,
} from "@mui/joy";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Server, Terminal, Cloud, Zap, Globe } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import useSWR from "swr";
import { useFakeData } from "../../context/FakeDataContext";
import PageWithTitle from "./templates/PageWithTitle";
import mockClusterData from "./mockData/mockClusters.json";

interface Node {
  id: string;
  ip: string;
  identity_file?: string;
  gpu_info?: string;
  status?: string;
}

interface CloudConfig {
  api_key?: string;
  subscription_id?: string;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  allowed_gpu_types?: string[];
  allowed_instance_types?: string[];
  allowed_regions?: string[];
  max_instances: number;
  current_instances: number;
  can_launch: boolean;
  is_configured: boolean;
}

const ClusterDetails: React.FC = () => {
  const { clusterName } = useParams<{ clusterName: string }>();
  const navigate = useNavigate();
  const { showFakeData } = useFakeData();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cluster platform information
  const { data: clusterPlatforms } = useSWR(
    clusterName ? buildApiUrl("instances/cluster-platforms") : null,
    (url: string) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 5000 }
  );

  const platforms = clusterPlatforms?.platforms || {};
  const clusterPlatform = platforms[clusterName || ""] || "unknown";

  useEffect(() => {
    if (!clusterName) return;

    setLoading(true);
    setError(null);

    // Check if this is a cloud cluster based on platform information or cluster name
    const isCloudCluster =
      clusterPlatform === "runpod" ||
      clusterPlatform === "azure" ||
      clusterName?.toLowerCase().includes("runpod") ||
      clusterName?.toLowerCase().includes("azure") ||
      clusterName === "runpod-cluster" ||
      clusterName === "azure-cluster";

    if (isCloudCluster) {
      // For cloud clusters, fetch configuration instead of nodes
      // Determine which cloud platform to use
      const isRunPod =
        clusterPlatform === "runpod" ||
        clusterName?.toLowerCase().includes("runpod") ||
        clusterName === "runpod-cluster";

      const isAzure =
        clusterPlatform === "azure" ||
        clusterName?.toLowerCase().includes("azure") ||
        clusterName === "azure-cluster";

      const configEndpoint = isRunPod
        ? "clouds/runpod/config"
        : "clouds/azure/config";

      const instancesEndpoint = isRunPod
        ? "clouds/runpod/instances"
        : "clouds/azure/instances";

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
            // Handle the new multi-config structure
            let processedConfig = config;
            if (
              config.default_config &&
              config.configs &&
              config.configs[config.default_config]
            ) {
              const defaultConfig = config.configs[config.default_config];
              processedConfig = {
                ...defaultConfig,
                is_configured: config.is_configured || false,
              };
            }

            setCloudConfig({
              ...processedConfig,
              current_instances: instances?.current_count || 0,
              max_instances:
                instances?.max_instances || processedConfig.max_instances || 0,
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
      apiFetch(buildApiUrl(`node-pools/ssh-node-pools/${clusterName}`), {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch cluster: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // Build a quick lookup from node IP to GPU info from backend gpu_resources
          const nodeGpuMap = new Map<string, string>();
          const nodeGpus = data?.gpu_resources?.node_gpus || [];
          nodeGpus.forEach((ng: any) => {
            // Prefer a concise description like "RTX3090 (1/2 free)"
            const gpu = ng?.gpu ?? "-";
            const free = ng?.free ?? "-";
            const total = ng?.total ?? "-";
            const desc = `${gpu} (${free}/${total} free)`;
            if (ng?.node) nodeGpuMap.set(ng.node, desc);
          });

          // Transform the data to match our interface, enriching gpu_info per node
          const transformedNodes = (data.nodes || []).map(
            (node: any, index: number) => {
              const ip = node.ip || node.hostname || `10.0.0.${index + 1}`;
              const gpuInfoFromBackend = nodeGpuMap.get(ip);
              return {
                id: node.id || `node-${index}`,
                ip,
                identity_file: node.identity_file || node.ssh_key || "-",
                gpu_info:
                  gpuInfoFromBackend || node.gpu_info || node.gpu_type || "-",
                status: node.status || "active",
              } as Node;
            }
          );
          setNodes(transformedNodes);
        })
        .catch((err) => {
          console.error("Error fetching cluster:", err);
          setError(err.message);
          // Only show fake data if showFakeData is enabled AND API failed
          if (showFakeData) {
            const generateFakeNodes = (): Node[] => {
              return mockClusterData[0].nodes.map(
                (node: any, index: number) => ({
                  id: node.id || `node-${index}`,
                  ip: node.ip || `10.0.0.${index + 1}`,
                  identity_file: node.identity_file || "-",
                  gpu_info: node.gpuType || "-",
                  status: node.status || "active",
                })
              );
            };

            const fakeNodes = generateFakeNodes();
            setNodes(fakeNodes);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [clusterName, clusterPlatform, showFakeData]);

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
    clusterName === "azure-cluster" ||
    clusterPlatform === "runpod" ||
    clusterPlatform === "azure";

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
                Allowed GPU/Instance Types (
                {cloudConfig.allowed_gpu_types?.length ||
                  cloudConfig.allowed_instance_types?.length ||
                  0}
                )
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                {(
                  cloudConfig.allowed_gpu_types ||
                  cloudConfig.allowed_instance_types ||
                  []
                ).map((type: string, index: number) => (
                  <Chip key={index} size="sm" variant="soft" color="primary">
                    {type}
                  </Chip>
                ))}
                {(!cloudConfig.allowed_gpu_types ||
                  cloudConfig.allowed_gpu_types.length === 0) &&
                  (!cloudConfig.allowed_instance_types ||
                    cloudConfig.allowed_instance_types.length === 0) && (
                    <Typography level="body-sm" color="neutral">
                      No GPU/instance types configured
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
