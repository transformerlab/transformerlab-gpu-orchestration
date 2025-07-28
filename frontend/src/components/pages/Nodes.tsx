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
  type: "dedicated" | "on-demand" | "spot"; // Node type
  status: "active" | "inactive" | "unhealthy"; // Node status
  user?: string; // User assignment
  gpuType?: string;
  cpuType?: string;
  vcpus?: number;
  vgpus?: number;
  ip: string;
  jobName?: string;
  experimentName?: string;
  identity_file?: string;
  password?: string;
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
  const types: ("dedicated" | "on-demand" | "spot")[] = [
    "dedicated",
    "on-demand",
    "spot",
  ];
  const statuses: ("active" | "inactive" | "unhealthy")[] = [
    "active",
    "inactive",
    "unhealthy",
  ];

  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const statusRand = Math.random();
    let status: "active" | "inactive" | "unhealthy";
    let user: string | undefined;
    let jobName: string | undefined;
    let experimentName: string | undefined;

    if (statusRand < 0.6) {
      status = "active";
      // Assign user if active
      if (Math.random() < 0.7) {
        user = users[Math.floor(Math.random() * users.length)];
        jobName = jobNames[Math.floor(Math.random() * jobNames.length)];
        experimentName =
          experimentNames[Math.floor(Math.random() * experimentNames.length)];
      }
    } else if (statusRand < 0.9) {
      status = "inactive";
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
      type,
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

const getStatusBackground = (status: string, type: string) => {
  // Background based on status
  if (status === "active") return "#10b981"; // green
  if (status === "inactive") return "unset"; // grey
  if (status === "unhealthy") return "#f59e0b"; // orange
  return "#6b7280"; // default grey
};

const getStatusBorderColor = (status: string, type: string) => {
  // Border based on status
  if (status === "active") return "#10b981"; // green
  if (status === "inactive") return "#6b7280"; // grey
  if (status === "unhealthy") return "#f59e0b"; // red
  return "#6b7280"; // default grey
};

const getStatusOrder = (status: string, type: string): number => {
  let sort1 = 0;
  let sort2 = 0;

  // Then by type
  if (type === "dedicated") sort1 = 1;
  if (type === "on-demand") sort1 = 2;
  if (type === "spot") sort1 = 3;

  // First sort by status priority
  if (status === "active") sort2 = 1;
  if (status === "inactive") sort2 = 2;
  if (status === "unhealthy") sort2 = 3;

  return sort1 * 10 + sort2;
};

const NodeSquare: React.FC<{ node: any }> = ({ node }) => (
  <Tooltip
    title={
      <Box>
        <Typography level="body-sm">
          <b>Type:</b> {node.type}
        </Typography>
        <Typography level="body-sm">
          <b>Status:</b> {node.status}
        </Typography>
        <Typography level="body-sm">
          <b>IP:</b> {node.ip}
        </Typography>
        <Typography level="body-sm">
          <b>User:</b> {node.user || "Unassigned"}
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
        height: 26,
        backgroundColor: getStatusBackground(node.status, node.type),
        borderRadius: "2px",
        margin: "1px",
        transition: "all 0.2s ease",
        cursor: "pointer",
        border: `2px solid ${getStatusBorderColor(node.status, node.type)}`,
        boxSizing: "border-box",
        position: "relative",
        "&:hover": {
          transform: "scale(1.2)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        },
      }}
      onClick={(e) => {
        e.stopPropagation();
        window.location.href = `/dashboard/nodes/node/${encodeURIComponent(
          node.id
        )}`;
      }}
    >
      {node.user === "ali" && (
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#1a2f5dff",
          }}
        />
      )}
    </Box>
  </Tooltip>
);

const ClusterCard: React.FC<{
  cluster: Cluster;
  setSelectedCluster: React.Dispatch<React.SetStateAction<Cluster | null>>;
}> = ({ cluster, setSelectedCluster }) => {
  const dedicatedCount = cluster.nodes.filter(
    (n) => n.type === "dedicated"
  ).length;
  const onDemandCount = cluster.nodes.filter(
    (n) => n.type === "on-demand"
  ).length;
  const spotCount = cluster.nodes.filter((n) => n.type === "spot").length;
  const activeCount = cluster.nodes.filter((n) => n.status === "active").length;
  const unhealthyCount = cluster.nodes.filter(
    (n) => n.status === "unhealthy"
  ).length;
  const assignedToYouCount = cluster.nodes.filter(
    (n) => n.user === "ali"
  ).length;

  const sortedNodes = [...cluster.nodes].sort(
    (a, b) =>
      getStatusOrder(a.status, a.type) - getStatusOrder(b.status, b.type)
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
            "&:hover": {
              backgroundColor: "unset",
            },
          }}
          variant="plain"
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <Typography level="h4" mb={0.5}>
              {cluster.name}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 0 }}>
              <Chip size="sm" color="primary" variant="soft">
                {assignedToYouCount} Nodes Assigned To You
              </Chip>
              <Chip size="sm" color="success" variant="soft">
                {Math.round((activeCount / cluster.nodes.length) * 100)}% Total
                Capacity In Use
              </Chip>
            </Stack>
          </Box>
          <div>
            <ChevronRightIcon />
          </div>
        </Button>
      </Box>

      {/* Group nodes by type, display in two columns */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {["dedicated", "on-demand", "spot"].map((nodeType, idx) => {
            const nodesOfType = sortedNodes.filter(
              (node) => node.type === nodeType
            );
            if (nodesOfType.length === 0) return null;

            // Distribute node types into two columns: 0,2 left; 1 right
            const isLeftColumn = idx % 2 === 0;

            return (
              <Box
                key={nodeType}
                sx={{
                  flex: "1 1 0",
                  minWidth: 0,
                  maxWidth: "50%",
                  mb: 3,
                }}
              >
                <Typography
                  level="title-sm"
                  sx={{ mb: 1, textTransform: "capitalize" }}
                >
                  {nodeType === "on-demand"
                    ? "On-Demand"
                    : nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}{" "}
                  Nodes ({nodesOfType.length})
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1px",
                    p: 2,
                    backgroundColor: "background.level1",
                    borderRadius: "md",
                    maxHeight: 1000,
                    overflow: "auto",
                  }}
                >
                  {nodesOfType.map((node) => (
                    <NodeSquare key={node.id} node={node} />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button variant="outlined">Reserve a Node</Button>
        <Button variant="outlined">Start a Job</Button>
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

  const [nodeGpuInfo, setNodeGpuInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    // Fetch GPU info for all nodes
    fetch(buildApiUrl("skypilot/ssh-node-info"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setNodeGpuInfo(data))
      .catch(() => setNodeGpuInfo({}));
  }, []);

  // NodeSquare for SSHNode
  const NodeSquare: React.FC<{ node: any }> = ({ node }) => {
    let gpuDisplay = "-";
    const gpuInfo = nodeGpuInfo[node.ip]?.gpu_resources;
    if (gpuInfo && gpuInfo.gpus && gpuInfo.gpus.length > 0) {
      gpuDisplay = gpuInfo.gpus
        .map((g: any) => {
          const qty = g.requestable_qty_per_node;
          if (qty && /^\d+$/.test(qty.trim())) {
            return `${g.gpu} (x${qty.trim()})`;
          } else if (qty && qty.trim().length > 0) {
            return `${g.gpu} (${qty.trim()})`;
          } else {
            return g.gpu;
          }
        })
        .join(", ");
    } else if (node.gpuType) {
      gpuDisplay = node.gpuType;
    }
    return (
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
            <Typography level="body-sm">
              <b>GPUs:</b> {gpuDisplay}
            </Typography>
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
            backgroundColor: "#3b82f6",
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
  };

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
                <th>Type</th>
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
              {selectedCluster.nodes.map((node) => {
                let gpuDisplay = "-";
                const gpuInfo = nodeGpuInfo[node.ip]?.gpu_resources;
                if (gpuInfo && gpuInfo.gpus && gpuInfo.gpus.length > 0) {
                  gpuDisplay = gpuInfo.gpus
                    .map((g: any) => {
                      const qty = g.requestable_qty_per_node;
                      if (qty && /^\d+$/.test(qty.trim())) {
                        return `${g.gpu} (x${qty.trim()})`;
                      } else if (qty && qty.trim().length > 0) {
                        return `${g.gpu} (${qty.trim()})`;
                      } else {
                        return g.gpu;
                      }
                    })
                    .join(", ");
                } else if (node.gpuType) {
                  gpuDisplay = node.gpuType;
                }
                return (
                  <tr key={node.id}>
                    <td>{node.id}</td>
                    <td>{node.type}</td>
                    <td>{node.status}</td>
                    <td>{node.user ?? "-"}</td>
                    <td>{gpuDisplay}</td>
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
        </Sheet>
      ) : (
        mockClusters.map((cluster) => (
          <div key={cluster.id}>
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
                                <th>GPUs</th>
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
                                <td>
                                  {(() => {
                                    const node =
                                      cluster.nodes[selectedCloudNode[name]];
                                    let gpuDisplay = "-";
                                    const gpuInfo =
                                      nodeGpuInfo[node.ip]?.gpu_resources;
                                    if (
                                      gpuInfo &&
                                      gpuInfo.gpus &&
                                      gpuInfo.gpus.length > 0
                                    ) {
                                      gpuDisplay = gpuInfo.gpus
                                        .map((g: any) => {
                                          const qty =
                                            g.requestable_qty_per_node;
                                          if (qty && /^\d+$/.test(qty.trim())) {
                                            return `${g.gpu} (x${qty.trim()})`;
                                          } else if (
                                            qty &&
                                            qty.trim().length > 0
                                          ) {
                                            return `${g.gpu} (${qty.trim()})`;
                                          } else {
                                            return g.gpu;
                                          }
                                        })
                                        .join(", ");
                                    } else if (node.gpuType) {
                                      gpuDisplay = node.gpuType;
                                    }
                                    return gpuDisplay;
                                  })()}
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
                              <th>GPUs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cluster.nodes.map((node: any, idx: number) => {
                              let gpuDisplay = "-";
                              const gpuInfo =
                                nodeGpuInfo[node.ip]?.gpu_resources;
                              if (
                                gpuInfo &&
                                gpuInfo.gpus &&
                                gpuInfo.gpus.length > 0
                              ) {
                                gpuDisplay = gpuInfo.gpus
                                  .map((g: any) => {
                                    const qty = g.requestable_qty_per_node;
                                    if (qty && /^\d+$/.test(qty.trim())) {
                                      return `${g.gpu} (x${qty.trim()})`;
                                    } else if (qty && qty.trim().length > 0) {
                                      return `${g.gpu} (${qty.trim()})`;
                                    } else {
                                      return g.gpu;
                                    }
                                  })
                                  .join(", ");
                              } else if (node.gpuType) {
                                gpuDisplay = node.gpuType;
                              }
                              return (
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
                                  <td>{gpuDisplay}</td>
                                </tr>
                              );
                            })}
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
