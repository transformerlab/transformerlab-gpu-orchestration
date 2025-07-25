import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Stack,
  Chip,
  Tooltip,
  Table,
  Sheet,
  IconButton,
} from "@mui/joy";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Monitor,
  Plus,
  Settings,
} from "lucide-react";
import ClusterManagement from "../ClusterManagement";
import { buildApiUrl } from "../../utils/api";

interface Node {
  id: string;
  status: "reserved" | "requestable" | "active" | "unhealthy";
  user?: "ali" | "bob" | "catherine";
  gpuType: string;
  cpuType: string;
  vcpus: number;
  vgpus: number;
  ip: string;
  jobName?: string;
  experimentName?: string;
}

interface Cluster {
  id: string;
  name: string;
  nodes: Node[];
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

function randomIp() {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256
  )}.${Math.floor(Math.random() * 256)}`;
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

const getStatusColor = (status: string) => {
  switch (status) {
    case "reserved":
      return "#10b981"; // emerald-500
    case "requestable":
      return "#6b7280"; // gray-500
    case "active":
      return "#3b82f6"; // blue-500 (light blue)
    case "unhealthy":
      return "#ef4444"; // red-500
    default:
      return "#6b7280"; // gray-500
  }
};

const getStatusOrder = (status: string): number => {
  switch (status) {
    case "active":
      return 1;
    case "reserved":
      return 2;
    case "requestable":
      return 3;
    case "unhealthy":
      return 4;
    default:
      return 5;
  }
};

const NodeSquare: React.FC<{ node: Node }> = ({ node }) => (
  <Tooltip
    title={
      <Box>
        <Typography level="body-sm">
          <b>Name:</b> {node.id}
        </Typography>
        <Typography level="body-sm">
          <b>GPU:</b> {node.gpuType}
        </Typography>
        <Typography level="body-sm">
          <b>CPU:</b> {node.cpuType}
        </Typography>
        <Typography level="body-sm">
          <b>vCPUs:</b> {node.vcpus}
        </Typography>
        <Typography level="body-sm">
          <b>vGPUs:</b> {node.vgpus}
        </Typography>
        <Typography level="body-sm">
          <b>IP:</b> {node.ip}
        </Typography>
        {node.status === "active" && node.user && (
          <>
            <Typography level="body-sm">
              <b>Assigned To:</b> {node.user}
            </Typography>
            <Typography level="body-sm">
              <b>Job:</b> {node.jobName}
            </Typography>
            <Typography level="body-sm">
              <b>Experiment:</b> {node.experimentName}
            </Typography>
          </>
        )}
      </Box>
    }
    variant="soft"
    size="sm"
    arrow
  >
    <Box
      sx={{
        width: 12,
        height: 12,
        backgroundColor:
          node.user === "ali" ? "#3b83f61e" : getStatusColor(node.status),
        borderRadius: "2px",
        margin: "1px",
        transition: "all 0.2s ease",
        cursor: "pointer",
        border: node.user === "ali" ? "2px solid #3b82f6" : undefined,
        boxSizing: "border-box",
        "&:hover": {
          transform: "scale(1.2)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        },
      }}
    />
  </Tooltip>
);

const ClusterCard: React.FC<{ cluster: Cluster }> = ({ cluster }) => {
  const reservedCount = cluster.nodes.filter(
    (n) => n.status === "reserved"
  ).length;
  const requestableCount = cluster.nodes.filter(
    (n) => n.status === "requestable"
  ).length;
  const activeCount = cluster.nodes.filter((n) => n.status === "active").length;
  const unhealthyCount = cluster.nodes.filter(
    (n) => n.status === "unhealthy"
  ).length;
  const assignedToYouCount = cluster.nodes.filter(
    (n) => n.user === "ali"
  ).length;

  const sortedNodes = [...cluster.nodes].sort(
    (a, b) => getStatusOrder(a.status) - getStatusOrder(b.status)
  );

  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        mb: 3,
        transition: "all 0.2s ease",
        "&:hover": {
          boxShadow: "md",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={"space-between"}
        >
          <Typography level="h4" sx={{ mb: 1 }}>
            {cluster.name}
          </Typography>
          <>
            <ChevronRightIcon />
          </>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mb: 0 }}>
          <Chip size="sm" color="primary" variant="plain">
            {assignedToYouCount} Assigned To You
          </Chip>
          <Chip size="sm" color="success" variant="soft">
            {reservedCount} Reserved
          </Chip>
          <Chip size="sm" color="neutral" variant="soft">
            {requestableCount} Requestable
          </Chip>
          <Chip size="sm" color="warning" variant="soft">
            {activeCount} Active
          </Chip>
          <Chip size="sm" color="danger" variant="soft">
            {unhealthyCount} Unhealthy
          </Chip>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1px",
          p: 2,
          backgroundColor: "background.level1",
          borderRadius: "md",
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        {sortedNodes.map((node) => (
          <NodeSquare key={node.id} node={node} />
        ))}
      </Box>
    </Card>
  );
};

const Nodes: React.FC = () => {
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        p: 2,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography level="h2">Square Bank's Nodes</Typography>
      </Box>

      {selectedCluster ? (
        <Sheet sx={{ mb: 4, p: 2, borderRadius: "md", boxShadow: "sm" }}>
          <Button
            onClick={() => setSelectedCluster(null)}
            startDecorator={<ChevronLeftIcon />}
            variant="soft"
          >
            Back
          </Button>
          <Typography level="h3" sx={{ mb: 2 }}>
            {selectedCluster.name} - Instances
          </Typography>

          <Table size="sm" variant="outlined" borderAxis="both" stickyHeader>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>User</th>
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
              {selectedCluster.nodes.map((node) => (
                <tr key={node.id}>
                  <td>{node.id}</td>
                  <td>{node.status}</td>
                  <td>{node.user ?? "-"}</td>
                  <td>{node.gpuType}</td>
                  <td>{node.cpuType}</td>
                  <td>{node.vcpus}</td>
                  <td>{node.vgpus}</td>
                  <td>{node.ip}</td>
                  <td>{node.jobName ?? "-"}</td>
                  <td>{node.experimentName ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      ) : (
        mockClusters.map((cluster) => (
          <div
            key={cluster.id}
            style={{ cursor: "pointer" }}
            onClick={() => setSelectedCluster(cluster)}
          >
            <ClusterCard cluster={cluster} />
          </div>
        ))
      )}
    </Box>
  );
};

export default Nodes;
