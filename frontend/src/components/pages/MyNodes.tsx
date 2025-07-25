import React from "react";
import { Box, Typography, Table, Chip, CircularProgress } from "@mui/joy";

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

const generateRandomNodes = (count: number): Node[] => {
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
  nodes: Node[];
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
                <th width="100px">Status</th>
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
