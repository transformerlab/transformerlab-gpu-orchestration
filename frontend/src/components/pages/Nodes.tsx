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
  Modal,
  ModalDialog,
  ModalClose,
  CardContent,
  FormControl,
  FormLabel,
  Input,
  Alert,
} from "@mui/joy";
import SkyPilotClusterLauncher from "../SkyPilotClusterLauncher";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Monitor,
  Plus,
  Settings,
  Zap,
} from "lucide-react";
import ClusterManagement from "../ClusterManagement";
import { buildApiUrl, apiFetch } from "../../utils/api";
import SkyPilotClusterStatus from "../SkyPilotClusterStatus";
import useSWR from "swr";
import SubmitJobModal from "../SubmitJobModal";
import NodeSquare from "../NodeSquare";
import RunPodClusterLauncher from "../RunPodClusterLauncher";
import PageWithTitle from "../pages/templates/PageWithTitle";
import { useAuth } from "../../context/AuthContext";
import { useFakeData } from "../../context/FakeDataContext";

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

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
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
    name: "On-Premise Cluster",
    nodes: generateRandomNodes(12),
  },
  {
    id: "cluster-4",
    name: "Vector Institute Cluster",
    nodes: generateRandomNodes(278),
  },
];

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
                    <NodeSquare key={node.id} node={node} variant="mock" />
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

const CloudClusterCard: React.FC<{
  cluster: any;
  clusterName: string;
  nodeGpuInfo: Record<string, any>;
  setSelectedCloudCluster: React.Dispatch<
    React.SetStateAction<{ cluster: any; name: string } | null>
  >;
}> = ({ cluster, clusterName, nodeGpuInfo, setSelectedCloudCluster }) => {
  // State for modals
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [showLaunchJobModal, setShowLaunchJobModal] = useState(false);

  // Fetch SkyPilot cluster status to determine which clusters are running
  const { data: skyPilotStatus } = useSWR(
    buildApiUrl("skypilot/status"),
    (url: string) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 2000 }
  );

  const skyPilotClusters = skyPilotStatus?.clusters || [];
  if (!cluster || !Array.isArray(cluster.nodes) || cluster.nodes.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography level="h4" sx={{ mb: 1 }}>
          {clusterName}
        </Typography>
        <Typography level="body-md" sx={{ color: "text.secondary" }}>
          No nodes in this cluster.
        </Typography>
      </Card>
    );
  }

  // Check if this cluster is running based on SkyPilot status
  const skyPilotCluster = skyPilotClusters.find(
    (c: any) => c.cluster_name === clusterName
  );
  const isActiveCluster =
    skyPilotCluster?.status === "ClusterStatus.UP" ||
    skyPilotCluster?.status === "ClusterStatus.INIT";

  // Process nodes to ensure they have the required properties for display
  // Set nodes as inactive by default, only active if cluster is active
  const processedNodes = cluster.nodes.map((node: any, idx: number) => ({
    id: `node-${idx}`,
    type: "dedicated" as const,
    status: isActiveCluster ? ("active" as const) : ("inactive" as const),
    user: undefined, // No user assignment - all nodes are available
    gpuType: node.gpuType || undefined,
    cpuType: node.cpuType || undefined,
    vcpus: node.vcpus || undefined,
    vgpus: node.vgpus || undefined,
    ip: node.ip || "",
    jobName: node.jobName || undefined,
    experimentName: node.experimentName || undefined,
    identity_file: node.identity_file || undefined,
    password: node.password || undefined,
  }));

  const activeCount = processedNodes.filter(
    (n: Node) => n.status === "active"
  ).length;
  const assignedToYouCount = 0; // All nodes are available, none assigned

  const sortedNodes = [...processedNodes].sort(
    (a, b) =>
      getStatusOrder(a.status, a.type) - getStatusOrder(b.status, b.type)
  );

  const handleReserveNode = () => {
    setShowReserveModal(true);
  };

  const handleLaunchJob = () => {
    setShowLaunchJobModal(true);
  };

  const handleClusterLaunched = (newClusterName: string) => {
    // Refresh the page or update the cluster status
    window.location.reload();
  };

  const handleJobSubmitted = () => {
    // Refresh the page or update the job status
    window.location.reload();
  };

  return (
    <>
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
            onClick={() =>
              setSelectedCloudCluster({
                cluster: {
                  ...cluster,
                  nodes: processedNodes,
                  name: clusterName,
                },
                name: clusterName,
              })
            }
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
                {clusterName}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 0 }}>
                <Chip size="sm" color="primary" variant="soft">
                  {assignedToYouCount} Nodes Assigned To You
                </Chip>
                <Chip size="sm" color="success" variant="soft">
                  {Math.round((activeCount / processedNodes.length) * 100)}%
                  Total Capacity In Use
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
            {["dedicated"].map((nodeType, idx) => {
              const nodesOfType = sortedNodes.filter(
                (node) => node.type === nodeType
              );
              if (nodesOfType.length === 0) return null;

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
                      : nodeType.charAt(0).toUpperCase() +
                        nodeType.slice(1)}{" "}
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
                      <NodeSquare key={node.id} node={node} variant="mock" />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={handleReserveNode}>
            Reserve a Node
          </Button>
          <Button
            variant="outlined"
            onClick={handleLaunchJob}
            disabled={!isActiveCluster}
          >
            Launch Job
          </Button>
        </Stack>
      </Card>

      {/* Reserve Node Modal - Custom SkyPilotClusterLauncher with pre-filled values */}
      {showReserveModal && (
        <ReserveNodeModal
          open={showReserveModal}
          onClose={() => setShowReserveModal(false)}
          clusterName={clusterName}
          onClusterLaunched={handleClusterLaunched}
        />
      )}

      {/* Launch Job Modal - Custom SubmitJobModal with only custom mode */}
      {showLaunchJobModal && (
        <CustomSubmitJobModal
          open={showLaunchJobModal}
          onClose={() => setShowLaunchJobModal(false)}
          clusterName={clusterName}
          onJobSubmitted={handleJobSubmitted}
          isClusterLaunching={false}
          isSshCluster={false}
        />
      )}
    </>
  );
};

// Custom Reserve Node Modal that pre-fills SSH mode and cluster name
const ReserveNodeModal: React.FC<{
  open: boolean;
  onClose: () => void;
  clusterName: string;
  onClusterLaunched?: (clusterName: string) => void;
}> = ({ open, onClose, clusterName, onClusterLaunched }) => {
  const [command, setCommand] = useState("echo SkyPilot");
  const [setup, setSetup] = useState("");
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pythonFile, setPythonFile] = useState<File | null>(null);

  const resetForm = () => {
    setCommand("echo SkyPilot");
    setSetup("");
    setCpus("");
    setMemory("");
    setAccelerators("");
    setRegion("");
    setZone("");
    setPythonFile(null);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("cluster_name", clusterName);
      formData.append("command", command);
      if (setup) formData.append("setup", setup);
      formData.append("cloud", "ssh"); // Always use SSH mode
      if (cpus) formData.append("cpus", cpus);
      if (memory) formData.append("memory", memory);
      if (accelerators) formData.append("accelerators", accelerators);
      if (region) formData.append("region", region);
      if (zone) formData.append("zone", zone);
      formData.append("use_spot", "false");
      formData.append("launch_mode", "custom");
      if (pythonFile) {
        formData.append("python_file", pythonFile);
      }

      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || "Node reserved successfully");
        setTimeout(() => {
          if (onClusterLaunched) onClusterLaunched(clusterName);
          onClose();
        }, 1200);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to reserve node");
      }
    } catch (err) {
      setError("Error reserving node");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 600 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          Reserve a Node - {clusterName}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Card variant="outlined">
            <CardContent>
              {error && (
                <Alert color="danger" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert color="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              <Alert color="primary" sx={{ mb: 2 }}>
                <Typography level="body-sm">
                  <strong>Direct Connect Mode:</strong> This will reserve a node
                  from the {clusterName} cluster using direct SSH connection.
                </Typography>
              </Alert>

              <FormControl required sx={{ mb: 2 }}>
                <FormLabel>Run Command</FormLabel>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="echo SkyPilot"
                  minRows={2}
                  required
                />
              </FormControl>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Setup Command (optional)</FormLabel>
                <Textarea
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                  placeholder="pip install -r requirements.txt"
                  minRows={2}
                />
              </FormControl>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Attach Python file (optional)</FormLabel>
                <input
                  type="file"
                  accept=".py"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setPythonFile(e.target.files[0]);
                    } else {
                      setPythonFile(null);
                    }
                  }}
                  style={{ marginTop: 8 }}
                />
                {pythonFile && (
                  <Typography level="body-xs" color="primary">
                    Selected: {pythonFile.name}
                  </Typography>
                )}
              </FormControl>

              {/* Resource Configuration */}
              <Card variant="soft" sx={{ mb: 2, mt: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Resource Configuration
                </Typography>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>CPUs</FormLabel>
                  <Input
                    value={cpus}
                    onChange={(e) => setCpus(e.target.value)}
                    placeholder="e.g., 4, 8+"
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Memory (GB)</FormLabel>
                  <Input
                    value={memory}
                    onChange={(e) => setMemory(e.target.value)}
                    placeholder="e.g., 16, 32+"
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Accelerators</FormLabel>
                  <Input
                    value={accelerators}
                    onChange={(e) => setAccelerators(e.target.value)}
                    placeholder="e.g., V100, V100:2, A100:4"
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Region</FormLabel>
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Not applicable for SSH"
                    disabled
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Zone</FormLabel>
                  <Input
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="Not applicable for SSH"
                    disabled
                  />
                </FormControl>
              </Card>

              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button variant="plain" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!command || loading}
                  color="success"
                >
                  Reserve Node
                </Button>
              </Box>
            </CardContent>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

// Custom SubmitJobModal that only shows custom mode (no Jupyter/VSCode options)
const RunPodClusterCard: React.FC<{
  cluster: any;
  onClusterLaunched?: (clusterName: string) => void;
}> = ({ cluster, onClusterLaunched }) => {
  // State for modals
  const [showLaunchJobModal, setShowLaunchJobModal] = useState(false);

  const isActiveCluster =
    cluster.status === "ClusterStatus.UP" ||
    cluster.status === "ClusterStatus.INIT";

  const handleLaunchJob = () => {
    setShowLaunchJobModal(true);
  };

  const handleClusterLaunched = (newClusterName: string) => {
    window.location.reload();
  };

  const handleJobSubmitted = () => {
    window.location.reload();
  };

  return (
    <>
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
          <Typography level="h4" mb={0.5}>
            {cluster.cluster_name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 0 }}>
            <Chip size="sm" color="success" variant="soft">
              {isActiveCluster ? "Active" : "Inactive"}
            </Chip>
            <Chip size="sm" color="primary" variant="soft">
              RunPod Cluster
            </Chip>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={handleLaunchJob}
            disabled={!isActiveCluster}
          >
            Launch Job
          </Button>
        </Stack>
      </Card>

      {/* Launch Job Modal for RunPod */}
      {showLaunchJobModal && (
        <CustomSubmitJobModal
          open={showLaunchJobModal}
          onClose={() => setShowLaunchJobModal(false)}
          clusterName={cluster.cluster_name}
          onJobSubmitted={handleJobSubmitted}
          isClusterLaunching={false}
          isSshCluster={false}
        />
      )}
    </>
  );
};

const CustomSubmitJobModal: React.FC<{
  open: boolean;
  onClose: () => void;
  clusterName: string;
  onJobSubmitted?: () => void;
  isClusterLaunching?: boolean;
  isSshCluster?: boolean;
}> = ({
  open,
  onClose,
  clusterName,
  onJobSubmitted,
  isClusterLaunching = false,
  isSshCluster = false,
}) => {
  const [command, setCommand] = useState("");
  const [setup, setSetup] = useState("");
  const [pythonFile, setPythonFile] = useState<File | null>(null);
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [jobName, setJobName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setCommand("");
    setSetup("");
    setPythonFile(null);
    setCpus("");
    setMemory("");
    setAccelerators("");
    setRegion("");
    setZone("");
    setJobName("");
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();

      formData.append("command", command);
      if (setup) formData.append("setup", setup);
      if (pythonFile) formData.append("python_file", pythonFile);
      if (cpus) formData.append("cpus", cpus);
      if (memory) formData.append("memory", memory);
      if (accelerators) formData.append("accelerators", accelerators);
      if (region) formData.append("region", region);
      if (zone) formData.append("zone", zone);
      if (jobName) formData.append("job_name", jobName);

      const response = await apiFetch(
        buildApiUrl(`skypilot/jobs/${clusterName}/submit`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || "Job submitted successfully");
        resetForm();
        if (onJobSubmitted) onJobSubmitted();
        setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 1200);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to submit job");
      }
    } catch (err) {
      setError("Error submitting job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 500 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          Launch Job on {clusterName}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Card variant="outlined">
            <CardContent>
              {isClusterLaunching && (
                <Alert color="warning" sx={{ mb: 2 }}>
                  Cluster is launching. Please wait until it is ready to submit
                  jobs.
                </Alert>
              )}
              {error && (
                <Alert color="danger" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert color="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}
              <FormControl required sx={{ mb: 2 }}>
                <FormLabel>Run Command</FormLabel>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="python my_script.py"
                  minRows={2}
                  required
                  disabled={isClusterLaunching}
                />
              </FormControl>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Setup Command (optional)</FormLabel>
                <Textarea
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                  placeholder="pip install -r requirements.txt"
                  minRows={2}
                  disabled={isClusterLaunching}
                />
              </FormControl>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Attach Python file (optional)</FormLabel>
                <input
                  type="file"
                  accept=".py"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setPythonFile(e.target.files[0]);
                    } else {
                      setPythonFile(null);
                    }
                  }}
                  style={{ marginTop: 8 }}
                  disabled={isClusterLaunching}
                />
                {pythonFile && (
                  <Typography level="body-xs" color="primary">
                    Selected: {pythonFile.name}
                  </Typography>
                )}
              </FormControl>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Job Name (optional)</FormLabel>
                <Input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g., My Training Job"
                  disabled={isClusterLaunching}
                />
              </FormControl>
              {/* Resource Configuration */}
              <Card variant="soft" sx={{ mb: 2, mt: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Resource Configuration
                </Typography>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>CPUs</FormLabel>
                  <Input
                    value={cpus}
                    onChange={(e) => setCpus(e.target.value)}
                    placeholder="e.g., 4, 8+"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Memory (GB)</FormLabel>
                  <Input
                    value={memory}
                    onChange={(e) => setMemory(e.target.value)}
                    placeholder="e.g., 16, 32+"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Accelerators</FormLabel>
                  <Input
                    value={accelerators}
                    onChange={(e) => setAccelerators(e.target.value)}
                    placeholder="e.g., V100, V100:2, A100:4"
                    disabled={isClusterLaunching}
                  />
                </FormControl>
                {!isSshCluster && (
                  <>
                    <FormControl sx={{ mb: 1 }}>
                      <FormLabel>Region</FormLabel>
                      <Input
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="e.g., us-west-2, us-central1"
                        disabled={isClusterLaunching}
                      />
                    </FormControl>
                    <FormControl sx={{ mb: 1 }}>
                      <FormLabel>Zone</FormLabel>
                      <Input
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        placeholder="e.g., us-west-2a, us-central1-a"
                        disabled={isClusterLaunching}
                      />
                    </FormControl>
                  </>
                )}
              </Card>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button
                  variant="plain"
                  onClick={onClose}
                  disabled={loading || isClusterLaunching}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!command || loading || isClusterLaunching}
                  color="success"
                >
                  Submit Job
                </Button>
              </Box>
            </CardContent>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

const Nodes: React.FC = () => {
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [selectedCloudCluster, setSelectedCloudCluster] = useState<{
    cluster: any;
    name: string;
  } | null>(null);
  const [runpodConfig, setRunpodConfig] = useState<RunPodConfig>({
    api_key: "",
    allowed_gpu_types: [],
    is_configured: false,
    max_instances: 0,
  });

  // State for RunPod instance count and limits
  const [runpodInstances, setRunpodInstances] = useState<{
    current_count: number;
    max_instances: number;
    can_launch: boolean;
  }>({
    current_count: 0,
    max_instances: 0,
    can_launch: true,
  });

  // --- Node Pools/Clouds Section ---
  const fetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());
  const { data, isLoading } = useSWR(buildApiUrl("clusters"), fetcher, {
    refreshInterval: 2000,
  });
  const clusterNames = data?.clusters || [];

  // Fetch SkyPilot cluster status to determine which clusters are running
  const { data: skyPilotStatus } = useSWR(
    buildApiUrl("skypilot/status"),
    (url: string) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 2000 }
  );

  const skyPilotClusters = skyPilotStatus?.clusters || [];

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
        apiFetch(buildApiUrl(`clusters/${name}`), { credentials: "include" })
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

  const [nodeGpuInfo, setNodeGpuInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    // Fetch GPU info for all nodes
    apiFetch(buildApiUrl("skypilot/ssh-node-info"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setNodeGpuInfo(data))
      .catch(() => setNodeGpuInfo({}));

    // Fetch RunPod configuration
    apiFetch(buildApiUrl("skypilot/runpod/config"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRunpodConfig(data);
        } else {
          setRunpodConfig({
            api_key: "",
            allowed_gpu_types: [],
            is_configured: false,
            max_instances: 0,
          });
        }
      })
      .catch(() =>
        setRunpodConfig({
          api_key: "",
          allowed_gpu_types: [],
          is_configured: false,
          max_instances: 0,
        })
      );

    // Fetch RunPod instance count and limits
    apiFetch(buildApiUrl("skypilot/runpod/instances"), {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setRunpodInstances(data);
        }
      })
      .catch(() => {
        // If the endpoint doesn't exist yet, use default values
        setRunpodInstances({
          current_count: 0,
          max_instances: 0,
          can_launch: true,
        });
      });
  }, []);
  const { user } = useAuth();
  const { showFakeData } = useFakeData();

  const handleClusterLaunched = (clusterName: string) => {
    // Refresh the page or update the cluster status
    window.location.reload();
  };

  const [showRunPodLauncher, setShowRunPodLauncher] = useState(false);

  return (
    <PageWithTitle title={`${user?.organization_name}'s Node Pool`}>
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
      ) : showFakeData ? (
        mockClusters.map((cluster) => (
          <div key={cluster.id}>
            <ClusterCard
              cluster={cluster}
              setSelectedCluster={setSelectedCluster}
            />
          </div>
        ))
      ) : (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography level="body-md" sx={{ color: "text.secondary" }}>
            No fake data to display. Enable fake data in Settings to see sample
            clusters.
          </Typography>
        </Box>
      )}
      {/* --- Clouds Section --- */}
      {selectedCloudCluster ? (
        <Sheet sx={{ mb: 4, p: 2, borderRadius: "md", boxShadow: "sm" }}>
          <Button
            onClick={() => setSelectedCloudCluster(null)}
            startDecorator={<ChevronLeftIcon />}
            variant="soft"
          >
            Back
          </Button>
          <Typography level="h3" sx={{ mb: 2 }}>
            {selectedCloudCluster.name} - Instances
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
              {selectedCloudCluster.cluster.nodes.map((node: any) => {
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
        <Box sx={{ mt: 6 }}>
          <Typography level="h3" sx={{ mb: 2 }}>
            <Zap
              size={24}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            On-Demand Clusters
          </Typography>

          {/* RunPod Clusters */}
          {runpodConfig.is_configured && (
            <>
              <Typography level="h4" sx={{ mb: 2 }}>
                RunPod Clusters
              </Typography>

              {/* Instance Limits Display */}
              {runpodInstances.max_instances > 0 && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <Typography level="title-sm" sx={{ mb: 1 }}>
                    Instance Limits
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography level="body-sm">
                      {runpodInstances.current_count} /{" "}
                      {runpodInstances.max_instances} instances
                    </Typography>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={runpodInstances.can_launch ? "success" : "danger"}
                    >
                      {runpodInstances.can_launch
                        ? "Can Launch"
                        : "Limit Reached"}
                    </Chip>
                  </Stack>

                  {/* Visual representation of instances */}
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      level="body-xs"
                      sx={{ mb: 1, color: "text.secondary" }}
                    >
                      Instance Usage:
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {/* Active instances (green) */}
                      {Array.from(
                        { length: runpodInstances.current_count },
                        (_, i) => (
                          <Box
                            key={`active-${i}`}
                            sx={{
                              width: 20,
                              height: 20,
                              backgroundColor: "success.500",
                              borderRadius: "sm",
                              border: "1px solid",
                              borderColor: "success.600",
                            }}
                          />
                        )
                      )}
                      {/* Available instances (grey) */}
                      {Array.from(
                        {
                          length:
                            runpodInstances.max_instances -
                            runpodInstances.current_count,
                        },
                        (_, i) => (
                          <Box
                            key={`available-${i}`}
                            sx={{
                              width: 20,
                              height: 20,
                              backgroundColor: "neutral.300",
                              borderRadius: "sm",
                              border: "1px solid",
                              borderColor: "neutral.400",
                            }}
                          />
                        )
                      )}
                    </Box>
                  </Box>
                </Card>
              )}

              {/* Check for active RunPod clusters */}
              {skyPilotClusters.filter(
                (cluster: any) =>
                  cluster.cluster_name &&
                  (cluster.cluster_name.toLowerCase().includes("runpod") ||
                    cluster.cluster_name.toLowerCase().includes("runpod"))
              ).length > 0
                ? skyPilotClusters
                    .filter(
                      (cluster: any) =>
                        cluster.cluster_name &&
                        (cluster.cluster_name
                          .toLowerCase()
                          .includes("runpod") ||
                          cluster.cluster_name.toLowerCase().includes("runpod"))
                    )
                    .map((cluster: any) => (
                      <RunPodClusterCard
                        key={cluster.cluster_name}
                        cluster={cluster}
                        onClusterLaunched={handleClusterLaunched}
                      />
                    ))
                : null}

              {/* Always show the launch button if RunPod is configured */}
              {runpodConfig.is_configured && (
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <Typography level="h4" sx={{ mb: 2 }}>
                    Launch New RunPod Cluster
                  </Typography>
                  <Typography
                    level="body-md"
                    sx={{ color: "text.secondary", mb: 2 }}
                  >
                    Launch a new RunPod cluster for your workloads.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => setShowRunPodLauncher(true)}
                    disabled={!runpodInstances.can_launch}
                  >
                    Launch RunPod Cluster
                  </Button>
                  {!runpodInstances.can_launch && (
                    <Typography
                      level="body-xs"
                      sx={{ color: "text.secondary", mt: 1 }}
                    >
                      Instance limit reached ({runpodInstances.current_count}/
                      {runpodInstances.max_instances})
                    </Typography>
                  )}
                  {/* Debug info - remove this later */}
                  <Typography
                    level="body-xs"
                    sx={{ color: "text.secondary", mt: 1 }}
                  >
                    Debug: Current={runpodInstances.current_count}, Max=
                    {runpodInstances.max_instances}, CanLaunch=
                    {runpodInstances.can_launch ? "true" : "false"}
                  </Typography>
                </Card>
              )}
            </>
          )}

          {/* RunPod Configuration Status */}
          <Card variant="outlined">
            <Typography level="h4" sx={{ mb: 2 }}>
              RunPod Configuration
            </Typography>

            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography>API Key Configured</Typography>
                <Chip
                  variant="soft"
                  color={runpodConfig.is_configured ? "success" : "danger"}
                  size="sm"
                >
                  {runpodConfig.is_configured ? "Yes" : "No"}
                </Chip>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography>Allowed GPU Types</Typography>
                <Chip variant="soft" color="primary" size="sm">
                  {runpodConfig.allowed_gpu_types.length} selected
                </Chip>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography>Maximum Instances</Typography>
                <Chip variant="soft" color="primary" size="sm">
                  {runpodConfig.max_instances === 0
                    ? "Unlimited"
                    : runpodConfig.max_instances}
                </Chip>
              </Box>

              {!runpodConfig.is_configured && (
                <Alert color="warning">
                  RunPod is not configured. Please configure it in the Admin
                  section to use on-demand clusters.
                </Alert>
              )}

              {runpodConfig.is_configured && (
                <Alert color="success">
                  RunPod is configured and ready to use.
                </Alert>
              )}
            </Stack>
          </Card>
        </Box>
      )}

      {/* RunPod Cluster Launcher Modal */}
      <RunPodClusterLauncher
        open={showRunPodLauncher}
        onClose={() => setShowRunPodLauncher(false)}
        onClusterLaunched={handleClusterLaunched}
      />
    </PageWithTitle>
  );
};

export default Nodes;
