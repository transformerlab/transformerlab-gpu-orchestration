import React from "react";
import { Box, Typography, Table, Chip, CircularProgress } from "@mui/joy";
import useSWR from "swr";
import { buildApiUrl } from "../../utils/api";

// Add a mock "held time" generator for demonstration
function randomHeldTime() {
  const hours = Math.floor(Math.random() * 72) + 1;
  return `${hours} hours`;
}

function randomIp() {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256
  )}.${Math.floor(Math.random() * 256)}`;
}

const gpuTypes = [
  "NVIDIA A100",
  "NVIDIA V100",
  "NVIDIA T4",
  "NVIDIA RTX 3090",
  "NVIDIA H100",
];
const cpuTypes = [
  "Intel Xeon Gold 6248",
  "AMD EPYC 7742",
  "Intel Core i9-12900K",
  "AMD Ryzen 9 5950X",
];
const jobNames = [
  "ImageNet Training",
  "Text Generation",
  "GAN Experiment",
  "RL Agent",
  "Protein Folding",
];
const experimentNames = [
  "Exp-Alpha",
  "Exp-Beta",
  "Exp-Gamma",
  "Exp-Delta",
  "Exp-Epsilon",
];

// Add a mock status generator for demonstration
const statuses = ["provisioning", "running", "deallocating", "held"];
function randomStatus(id: string) {
  // Simple deterministic hash based on id
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % statuses.length;
  return statuses[idx];
}

// Define a custom interface for mock nodes to avoid DOM Node conflict
interface MyNode {
  id: string;
  status: "reserved" | "requestable" | "active" | "unhealthy";
  user?: "ali" | "bob" | "catherine";
  gpuType?: string;
  cpuType?: string;
  vcpus?: number;
  vgpus?: number;
  ip: string;
  jobName?: string;
  experimentName?: string;
}

const generateRandomNodes = (count: number): MyNode[] => {
  const users = ["ali", "bob", "catherine"];
  return Array.from({ length: count }, (_, i) => {
    const rand = Math.random();
    let status: "reserved" | "requestable" | "active" | "unhealthy";
    let user: "ali" | "bob" | "catherine" | undefined;
    let jobName: string | undefined;
    let experimentName: string | undefined;
    if (rand < 0.5) {
      status = "reserved";
    } else if (rand < 0.75) {
      status = "requestable";
    } else if (rand < 0.95) {
      status = "active";
      user = users[Math.floor(Math.random() * users.length)];
      jobName = jobNames[Math.floor(Math.random() * jobNames.length)];
      experimentName =
        experimentNames[Math.floor(Math.random() * experimentNames.length)];
    } else {
      status = "unhealthy";
    }
    const gpuType = gpuTypes[Math.floor(Math.random() * gpuTypes.length)];
    const cpuType = cpuTypes[Math.floor(Math.random() * cpuTypes.length)];
    const vcpus = [4, 8, 16, 32, 64][Math.floor(Math.random() * 5)];
    const vgpus = [1, 2, 4, 8][Math.floor(Math.random() * 4)];
    const ip = randomIp();
    return {
      id: `node-${i}`,
      status,
      ...(user ? { user } : {}),
      ...(jobName ? { jobName } : {}),
      ...(experimentName ? { experimentName } : {}),
      gpuType,
      cpuType,
      vcpus,
      vgpus,
      ip,
    };
  });
};

interface Cluster {
  id: string;
  name: string;
  nodes: MyNode[];
}

const mockClusters: Cluster[] = [
  {
    id: "cluster-1",
    name: "Azure ML Cluster",
    nodes: generateRandomNodes(165),
  },
  {
    id: "cluster-2",
    name: "RunPod Cluster",
    nodes: generateRandomNodes(48),
  },
  {
    id: "cluster-3",
    name: "On-Premesis Cluster",
    nodes: generateRandomNodes(12),
  },
  {
    id: "cluster-4",
    name: "Vector Institute Cluster",
    nodes: generateRandomNodes(278),
  },
];

const MyNodes: React.FC = () => {
  // --- SkyPilot Clusters Section ---
  const skypilotFetcher = (url: string) =>
    fetch(url, { credentials: "include" }).then((res) => res.json());
  const { data: skypilotData, isLoading: skypilotLoading } = useSWR(
    buildApiUrl("skypilot/status"),
    skypilotFetcher,
    { refreshInterval: 2000 }
  );
  const myClusters = (skypilotData?.clusters || []).filter(
    (c: any) =>
      c.status &&
      (c.status.toLowerCase().includes("init") ||
        c.status.toLowerCase().includes("up"))
  );

  // Flatten all nodes held by "ali" and annotate with cluster name and held time
  const nodesHeldByAli = mockClusters
    .flatMap((cluster) =>
      cluster.nodes
        .filter((node) => node.user === "ali" && node.status === "active")
        .map((node) => ({
          ...node,
          clusterName: cluster.name,
          heldTime: randomHeldTime(),
        }))
    )
    .slice(0, 6); // Only show 6 machines

  // Group nodes by experimentName
  const groupedByExperiment: { [exp: string]: typeof nodesHeldByAli } = {};
  nodesHeldByAli.forEach((node) => {
    const exp = node.experimentName ?? "No Experiment";
    if (!groupedByExperiment[exp]) groupedByExperiment[exp] = [];
    groupedByExperiment[exp].push(node);
  });

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: 2 }}>
      {/* --- SkyPilot Clusters --- */}
      <Typography level="h2" sx={{ mb: 2 }}>
        Your SkyPilot Clusters
      </Typography>
      {skypilotLoading ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography level="body-md" sx={{ color: "text.secondary" }}>
            Loading clusters...
          </Typography>
        </Box>
      ) : myClusters.length === 0 ? (
        <Typography level="body-md" sx={{ color: "text.secondary", mt: 2 }}>
          No active or launching SkyPilot clusters.
        </Typography>
      ) : (
        myClusters.map((cluster: any) => (
          <Box key={cluster.cluster_name} sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ mb: 1 }}>
              {cluster.cluster_name}
            </Typography>
            <Table size="sm" variant="outlined" borderAxis="both" stickyHeader>
              <thead>
                <tr>
                  <th>Cluster Name</th>
                  <th>Status</th>
                  <th>Resources</th>
                  <th>Launched At</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{cluster.cluster_name}</td>
                  <td>
                    {cluster.status.toLowerCase().includes("init") ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <CircularProgress size="sm" />
                        <Typography level="body-sm">Launching</Typography>
                      </Box>
                    ) : cluster.status.toLowerCase().includes("up") ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            bgcolor: "success.500",
                            borderRadius: "50%",
                          }}
                        />
                        <Typography level="body-sm">Running</Typography>
                      </Box>
                    ) : (
                      <Chip color="neutral" variant="soft" size="sm">
                        {cluster.status}
                      </Chip>
                    )}
                  </td>
                  <td>{cluster.resources_str || "-"}</td>
                  <td>
                    {cluster.launched_at
                      ? new Date(cluster.launched_at * 1000).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              </tbody>
            </Table>
          </Box>
        ))
      )}
      {/* --- Existing held nodes tables --- */}
      <Typography level="h2" sx={{ mb: 2 }}>
        Your Held Nodes
      </Typography>
      {Object.entries(groupedByExperiment).map(([expName, nodes]) => (
        <Box key={expName} sx={{ mb: 4 }}>
          <Typography level="h4" sx={{ mb: 1 }}>
            Experiment: {expName}
          </Typography>
          <Table size="sm" variant="outlined" borderAxis="both" stickyHeader>
            <thead>
              <tr>
                <th>Status</th>
                <th>Cluster</th>
                <th>Name</th>
                <th>Status (Node)</th>
                <th>Held Time</th>
                <th>GPU</th>
                <th>CPU</th>
                <th>vCPUs</th>
                <th>vGPUs</th>
                <th>IP</th>
                <th>Job</th>
                <th>Experiment</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const statusValue = randomStatus(node.id);
                return (
                  <tr key={node.id}>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          statusValue === "running"
                            ? "success"
                            : statusValue === "provisioning"
                            ? "neutral"
                            : statusValue === "deallocating"
                            ? "warning"
                            : "success"
                        }
                        variant="soft"
                        startDecorator={
                          (statusValue == "running" ||
                            statusValue == "provisioning" ||
                            statusValue == "deallocating") && (
                            <CircularProgress
                              size="sm"
                              sx={{
                                "--CircularProgress-size": "10px",
                                "--CircularProgress-trackThickness": "2px",
                                "--CircularProgress-progressThickness": "2px",
                              }}
                            />
                          )
                        }
                      >
                        {statusValue}
                      </Chip>
                    </td>
                    <td>{node.clusterName}</td>
                    <td>{node.id}</td>
                    <td>{node.status}</td>
                    <td>{node.heldTime}</td>
                    <td>{node.gpuType}</td>
                    <td>{node.cpuType}</td>
                    <td>{node.vcpus}</td>
                    <td>{node.vgpus}</td>
                    <td>{node.ip}</td>
                    <td>{node.jobName ?? "-"}</td>
                    <td>{node.experimentName ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Box>
      ))}
    </Box>
  );
};

export default MyNodes;
