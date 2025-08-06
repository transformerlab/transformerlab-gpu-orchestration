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
import { useNavigate } from "react-router-dom";
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
import NodeSquare from "../widgets/NodeSquare";
import RunPodClusterLauncher from "../RunPodClusterLauncher";
import AzureClusterLauncher from "../AzureClusterLauncher";
import PageWithTitle from "./templates/PageWithTitle";
import { useAuth } from "../../context/AuthContext";
import { useFakeData } from "../../context/FakeDataContext";

interface Node {
  id: string;
  type: "dedicated" | "on-demand"; // Node type
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

interface AzureConfig {
  subscription_id: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  allowed_instance_types: string[];
  allowed_regions: string[];
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
  const types: ("dedicated" | "on-demand")[] = ["dedicated", "on-demand"];
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

// Generate dedicated nodes for RunPod and Azure clusters
const generateDedicatedNodes = (
  count: number,
  activeCount: number = 0
): Node[] => {
  const users = ["ali", "bob", "catherine"];

  return Array.from({ length: count }, (_, i) => {
    // Only the first 'activeCount' nodes should be active
    const status: "active" | "inactive" | "unhealthy" =
      i < activeCount ? "active" : "inactive";
    let user: string | undefined;
    let jobName: string | undefined;
    let experimentName: string | undefined;

    // If active, randomly assign some nodes to users
    if (status === "active" && Math.random() < 0.3) {
      user = users[Math.floor(Math.random() * users.length)];
      jobName = jobNames[Math.floor(Math.random() * jobNames.length)];
      experimentName =
        experimentNames[Math.floor(Math.random() * experimentNames.length)];
    }

    const gpuType = gpuTypes[Math.floor(Math.random() * gpuTypes.length)];
    const cpuType = cpuTypes[Math.floor(Math.random() * cpuTypes.length)];
    const vcpus = [4, 8, 16, 32, 64][Math.floor(Math.random() * 5)];
    const vgpus = [1, 2, 4, 8][Math.floor(Math.random() * 4)];

    return {
      id: `dedicated-node-${i}`,
      type: "dedicated",
      status,
      ...(user ? { user } : {}),
      ...(jobName ? { jobName } : {}),
      ...(experimentName ? { experimentName } : {}),
      gpuType,
      cpuType,
      vcpus,
      vgpus,
      ip: "", // Empty IP for Real clusters
    };
  });
};

const getStatusOrder = (status: string, type: string): number => {
  let sort1 = 0;
  let sort2 = 0;

  // Then by type
  if (type === "dedicated") sort1 = 1;
  if (type === "on-demand") sort1 = 2;

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
  onLaunchCluster?: () => void;
  launchDisabled?: boolean;
  launchButtonText?: string;
  allowedGpuTypes?: string[];
}> = ({
  cluster,
  onLaunchCluster,
  launchDisabled = false,
  launchButtonText = "Reserve a Node",
  allowedGpuTypes,
}) => {
  const navigate = useNavigate();
  const dedicatedCount = cluster.nodes.filter(
    (n) => n.type === "dedicated"
  ).length;
  const onDemandCount = cluster.nodes.filter(
    (n) => n.type === "on-demand"
  ).length;
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
          onClick={() => navigate(`/dashboard/clusters/${cluster.id}`)}
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
              {allowedGpuTypes && allowedGpuTypes.length > 0 && (
                <Chip size="sm" color="neutral" variant="soft">
                  {allowedGpuTypes.length} Allowed Instances
                </Chip>
              )}
            </Stack>
          </Box>
          <div>
            <ChevronRightIcon />
          </div>
        </Button>
      </Box>

      {/* Show only dedicated nodes */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {(() => {
            const nodesOfType = sortedNodes.filter(
              (node) => node.type === "dedicated"
            );
            if (nodesOfType.length === 0) return null;

            return (
              <Box
                sx={{
                  flex: "1 1 0",
                  minWidth: 0,
                  maxWidth: "100%",
                  mb: 3,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1px",
                    p: 2,
                    backgroundColor: "#e5e5e371",
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
          })()}
        </Box>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={onLaunchCluster}
          disabled={launchDisabled}
        >
          {launchButtonText}
        </Button>
      </Stack>
    </Card>
  );
};

const CloudClusterCard: React.FC<{
  cluster: any;
  clusterName: string;
  nodeGpuInfo: Record<string, any>;
}> = ({ cluster, clusterName, nodeGpuInfo }) => {
  const navigate = useNavigate();
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
            onClick={() => navigate(`/dashboard/clusters/${clusterName}`)}
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
            {["dedicated", "on-demand"].map((nodeType, idx) => {
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
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setCommand('echo "Welcome to Lattice"');
    setSetup("");
    setCpus("");
    setMemory("");
    setAccelerators("");
    setRegion("");
    setZone("");
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

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Setup Command (optional)</FormLabel>
                <Textarea
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                  placeholder="pip install -r requirements.txt"
                  minRows={2}
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
  const [runpodConfig, setRunpodConfig] = useState<RunPodConfig>({
    api_key: "",
    allowed_gpu_types: [],
    is_configured: false,
    max_instances: 0,
  });

  // State for Azure configuration
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    subscription_id: "",
    tenant_id: "",
    client_id: "",
    client_secret: "",
    allowed_instance_types: [],
    allowed_regions: [],
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

  // State for Azure instance count and limits
  const [azureInstances, setAzureInstances] = useState<{
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

    // Fetch Azure configuration
    apiFetch(buildApiUrl("skypilot/azure/config"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAzureConfig({
            subscription_id: data.subscription_id || "",
            tenant_id: data.tenant_id || "",
            client_id: data.client_id || "",
            client_secret: data.client_secret || "",
            allowed_instance_types: data.allowed_instance_types || [],
            allowed_regions: data.allowed_regions || [],
            is_configured: data.is_configured || false,
            max_instances: data.max_instances || 0,
          });
        } else {
          setAzureConfig({
            subscription_id: "",
            tenant_id: "",
            client_id: "",
            client_secret: "",
            allowed_instance_types: [],
            allowed_regions: [],
            is_configured: false,
            max_instances: 0,
          });
        }
      })
      .catch(() =>
        setAzureConfig({
          subscription_id: "",
          tenant_id: "",
          client_id: "",
          client_secret: "",
          allowed_instance_types: [],
          allowed_regions: [],
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

    // Fetch Azure instance count and limits
    apiFetch(buildApiUrl("skypilot/azure/instances"), {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAzureInstances({
            current_count: data.current_count || 0,
            max_instances: data.max_instances || 0,
            can_launch: data.can_launch !== undefined ? data.can_launch : true,
          });
        } else {
          setAzureInstances({
            current_count: 0,
            max_instances: 0,
            can_launch: true,
          });
        }
      })
      .catch(() => {
        // If the endpoint doesn't exist yet, use default values
        setAzureInstances({
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
  const [showAzureLauncher, setShowAzureLauncher] = useState(false);

  return (
    <PageWithTitle
      title={`${user?.organization_name}'s Node Pools`}
      subtitle="A Node Pool is a group of nodes on a single cloud. Users can start a cluster (a compute environment for a specific task) from this screen."
    >
      {/* Existing Node Pools/Clusters UI */}
      {showFakeData ? (
        mockClusters.map((cluster) => (
          <div key={cluster.id}>
            <ClusterCard cluster={cluster} />
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
      <Box sx={{ mt: 6 }}>
        {isLoading || loadingClusters ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              Loading node pools...
            </Typography>
          </Box>
        ) : (
          Object.entries(clusterDetails).map(([name, cluster]) => {
            return (
              <CloudClusterCard
                key={name}
                cluster={cluster}
                clusterName={name}
                nodeGpuInfo={nodeGpuInfo}
              />
            );
          })
        )}

        {/* RunPod Cluster */}
        {runpodConfig.is_configured && (
          <ClusterCard
            cluster={{
              id: "runpod-cluster",
              name: "Real RunPod Cluster",
              nodes: generateDedicatedNodes(
                runpodConfig.max_instances,
                runpodInstances.current_count
              ),
            }}
            onLaunchCluster={() => setShowRunPodLauncher(true)}
            launchDisabled={!runpodInstances.can_launch}
            launchButtonText="Launch RunPod Cluster"
            allowedGpuTypes={runpodConfig.allowed_gpu_types}
          />
        )}

        {/* Azure Cluster */}
        {azureConfig.is_configured && (
          <ClusterCard
            cluster={{
              id: "azure-cluster",
              name: "Real Azure Cluster",
              nodes: generateDedicatedNodes(
                azureConfig.max_instances,
                azureInstances.current_count
              ),
            }}
            onLaunchCluster={() => setShowAzureLauncher(true)}
            launchDisabled={!azureInstances.can_launch}
            launchButtonText="Launch Azure Cluster"
            allowedGpuTypes={azureConfig.allowed_instance_types}
          />
        )}
      </Box>

      {/* RunPod Cluster Launcher Modal */}
      <RunPodClusterLauncher
        open={showRunPodLauncher}
        onClose={() => setShowRunPodLauncher(false)}
        onClusterLaunched={handleClusterLaunched}
      />

      {/* Azure Cluster Launcher Modal */}
      <AzureClusterLauncher
        open={showAzureLauncher}
        onClose={() => setShowAzureLauncher(false)}
        onClusterLaunched={handleClusterLaunched}
      />
    </PageWithTitle>
  );
};

export default Nodes;
