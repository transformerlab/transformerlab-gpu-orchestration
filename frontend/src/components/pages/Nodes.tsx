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
  CircularProgress,
  List,
  ListItem,
  ListDivider,
  Textarea,
  ButtonGroup,
  Link,
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
import SkyPilotClusterStatus from "../SkyPilotClusterStatus";
import useSWR from "swr";
import SubmitJobModal from "../SubmitJobModal";

interface Node {
  id: string;
  status: "reserved" | "requestable" | "active" | "unhealthy";
  user?: string;
  gpuType?: string;
  cpuType?: string;
  vcpus?: number;
  vgpus?: number;
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

const NodeSquare: React.FC<{ node: any }> = ({ node }) => (
  <Tooltip
    title={
      <Box>
        <Typography level="body-sm">
          <b>IP:</b> {node.ip}
        </Typography>
        <Typography level="body-sm">
          <b>User:</b> {node.user}
        </Typography>
        {node.identity_file && (
          <Typography level="body-sm">
            <b>Identity File:</b> {node.identity_file}
          </Typography>
        )}
        {node.password && (
          <Typography level="body-sm">
            <b>Password:</b> ****
          </Typography>
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
        ...(node.user === "ali"
          ? {
              animation: "pulseFill 2.5s infinite",
              "@keyframes pulseFill": {
                "0%": {
                  backgroundColor: "#3b83f61e",
                },
                "50%": {
                  backgroundColor: "#3b83f666",
                },
                "100%": {
                  backgroundColor: "#3b83f61e",
                },
              },
            }
          : {}),
      }}
    />
  </Tooltip>
);

const ClusterCard: React.FC<{
  cluster: Cluster;
  setSelectedCluster: React.Dispatch<React.SetStateAction<Cluster | null>>;
}> = ({ cluster, setSelectedCluster }) => {
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
        },
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Button
          onClick={() => setSelectedCluster(cluster)}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 0,
            margin: 0,
            mb: 1,
          }}
          variant="plain"
        >
          <Typography level="h4">{cluster.name}</Typography>
          <>
            <ChevronRightIcon />
          </>
        </Button>
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
      <Stack direction="row" spacing={1}>
        <Button variant="plain">Reserve a Node</Button>
        <Button variant="plain">Start a Job</Button>
      </Stack>
    </Card>
  );
};

const Nodes: React.FC = () => {
  console.error("NODES COMPONENT MOUNTED");
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);

  // --- Node Pools/Clouds Section ---
  const fetcher = (url: string) =>
    fetch(url, { credentials: "include" }).then((res) => res.json());
  const { data, isLoading } = useSWR(buildApiUrl("clusters"), fetcher, {
    refreshInterval: 2000,
  });
  const clusterNames = data?.clusters || [];

  // State for all cluster details
  const [clusterDetails, setClusterDetails] = useState<{
    [name: string]: Cluster | null;
  }>({});
  const [loadingClusters, setLoadingClusters] = useState(false);

  useEffect(() => {
    if (!Array.isArray(clusterNames) || clusterNames.length === 0) return;
    setLoadingClusters(true);
    Promise.all(
      clusterNames.map((name: string) =>
        fetch(buildApiUrl(`clusters/${name}`), { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => ({ name, data }))
          .catch(() => ({ name, data: null }))
      )
    ).then((results) => {
      const details: { [name: string]: Cluster | null } = {};
      results.forEach(({ name, data }) => {
        details[name] = data;
      });
      setClusterDetails(details);
      setLoadingClusters(false);
    });
  }, [JSON.stringify(clusterNames)]);

  // State for expanded all-nodes table and selected node per cluster
  const [expandedCloudCluster, setExpandedCloudCluster] = useState<
    string | null
  >(null);
  const [selectedCloudNode, setSelectedCloudNode] = useState<{
    [clusterName: string]: number | null;
  }>({});

  // NodeSquare for SSHNode
  const NodeSquare: React.FC<{ node: any }> = ({ node }) => (
    <Tooltip
      title={
        <Box>
          <Typography level="body-sm">
            <b>IP:</b> {node.ip}
          </Typography>
          <Typography level="body-sm">
            <b>User:</b> {node.user}
          </Typography>
          {node.identity_file && (
            <Typography level="body-sm">
              <b>Identity File:</b> {node.identity_file}
            </Typography>
          )}
          {node.password && (
            <Typography level="body-sm">
              <b>Password:</b> ****
            </Typography>
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
          backgroundColor: "#f63bddff",
          borderRadius: "2px",
          margin: "1px",
          transition: "all 0.2s ease",
          cursor: "pointer",
          boxSizing: "border-box",
          "&:hover": {
            transform: "scale(1.2)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          },
        }}
      />
    </Tooltip>
  );

  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        p: 2,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography level="h2">Square Bank's Node Pool</Typography>
      </Box>
      {/* Existing Node Pools/Clusters UI */}
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
          <Table stickyHeader>
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
          <div key={cluster.id} style={{ cursor: "pointer" }}>
            <ClusterCard
              cluster={cluster}
              setSelectedCluster={setSelectedCluster}
            />
          </div>
        ))
      )}
      {/* --- Clouds Section --- */}
      <Box sx={{ mt: 6 }}>
        <Typography level="h3" sx={{ mb: 2 }}>
          Cloud Node Pools
        </Typography>
        {isLoading || loadingClusters ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              Loading node pools...
            </Typography>
          </Box>
        ) : (
          Object.entries(clusterDetails).map(([name, cluster]) => {
            const isExpanded = expandedCloudCluster === name;
            return (
              <Card
                key={name}
                sx={{
                  mb: 3,
                  cursor: "pointer",
                  border: isExpanded ? "2px solid #3b82f6" : undefined,
                }}
                onClick={(e) => {
                  // Only toggle if the card itself is clicked, not the grid
                  if (
                    (e.target as HTMLElement).getAttribute(
                      "data-cluster-card"
                    ) === "true"
                  ) {
                    setExpandedCloudCluster(isExpanded ? null : name);
                    // Clear selected node for all clusters except the one being expanded
                    setSelectedCloudNode((prev) =>
                      isExpanded ? prev : { [name]: null }
                    );
                  }
                }}
              >
                <Typography level="h4" sx={{ mb: 1 }} data-cluster-card="true">
                  {name}
                </Typography>
                {/* Node grid is always visible */}
                {cluster &&
                Array.isArray(cluster.nodes) &&
                cluster.nodes.length > 0 ? (
                  <>
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
                      onClick={(e) => e.stopPropagation()} // Prevent card click when clicking node
                    >
                      {cluster.nodes.map((node: any, idx: number) => {
                        const isSelected = selectedCloudNode[name] === idx;
                        return (
                          <Box
                            key={idx}
                            onClick={() => {
                              setSelectedCloudNode((prev) => ({
                                ...prev,
                                [name]: idx,
                              }));
                              setExpandedCloudCluster(null);
                            }}
                            sx={{
                              cursor: "pointer",
                              border: isSelected
                                ? "2px solid #f59e42"
                                : "2px solid #3b82f6",
                              borderRadius: "4px",
                              boxShadow: isSelected
                                ? "0 0 0 2px #f59e42"
                                : undefined,
                              m: 0.5,
                              transition: "border 0.2s, box-shadow 0.2s",
                              "&:hover": {
                                border: "2px solid #f59e42",
                                boxShadow: "0 0 0 2px #f59e42",
                              },
                            }}
                          >
                            <NodeSquare node={node} />
                          </Box>
                        );
                      })}
                    </Box>
                    {/* Table for selected node */}
                    {selectedCloudNode[name] != null &&
                      cluster.nodes[selectedCloudNode[name]] && (
                        <Box sx={{ mt: 2 }}>
                          <Typography level="h4" sx={{ mb: 1 }}>
                            Node Details
                          </Typography>
                          <Table
                            size="sm"
                            variant="outlined"
                            borderAxis="both"
                            stickyHeader
                          >
                            <thead>
                              <tr>
                                <th>IP Address</th>
                                <th>User</th>
                                <th>Identity File</th>
                                <th>Password</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>
                                  {cluster.nodes[selectedCloudNode[name]].ip ||
                                    "-"}
                                </td>
                                <td>
                                  {cluster.nodes[selectedCloudNode[name]]
                                    .user || "-"}
                                </td>
                                <td>
                                  {cluster.nodes[selectedCloudNode[name]]
                                    .identity_file || "-"}
                                </td>
                                <td>
                                  {cluster.nodes[selectedCloudNode[name]]
                                    .password
                                    ? "****"
                                    : "-"}
                                </td>
                              </tr>
                            </tbody>
                          </Table>
                        </Box>
                      )}
                    {/* Table of all nodes, toggled by card click */}
                    {isExpanded && (
                      <Box sx={{ mt: 2 }}>
                        <Typography level="h4" sx={{ mb: 1 }}>
                          All Nodes
                        </Typography>
                        <Table
                          size="sm"
                          variant="outlined"
                          borderAxis="both"
                          stickyHeader
                        >
                          <thead>
                            <tr>
                              <th>IP Address</th>
                              <th>User</th>
                              <th>Identity File</th>
                              <th>Password</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cluster.nodes.map((node: any, idx: number) => (
                              <tr
                                key={idx}
                                style={{
                                  background:
                                    selectedCloudNode[name] === idx
                                      ? "#f5f5f5"
                                      : undefined,
                                }}
                              >
                                <td>{node.ip || "-"}</td>
                                <td>{node.user || "-"}</td>
                                <td>{node.identity_file || "-"}</td>
                                <td>{node.password ? "****" : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography level="body-md" sx={{ color: "text.secondary" }}>
                    No nodes in this cluster.
                  </Typography>
                )}
              </Card>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default Nodes;
