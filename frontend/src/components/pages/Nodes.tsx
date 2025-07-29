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
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Monitor,
  Plus,
  Settings,
} from "lucide-react";
import ClusterManagement from "../ClusterManagement";
import { buildApiUrl, apiFetch } from "../../utils/api";
import SkyPilotClusterStatus from "../SkyPilotClusterStatus";
import useSWR from "swr";
import SubmitJobModal from "../SubmitJobModal";
import NodeSquare from "../NodeSquare";
import PageWithTitle from "../pages/templates/PageWithTitle";
import { useAuth } from "../../context/AuthContext";

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
    name: "On-Premesis Cluster",
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
                  <strong>SSH Mode:</strong> This will reserve a node from the {clusterName} cluster using direct SSH connection.
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
                <Button
                  variant="plain"
                  onClick={onClose}
                  disabled={loading}
                >
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

  // --- Node Pools/Clouds Section ---
  const fetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());
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
  }, []);
  const { user } = useAuth();

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
              return (
                <CloudClusterCard
                  key={name}
                  cluster={cluster}
                  clusterName={name}
                  nodeGpuInfo={nodeGpuInfo}
                  setSelectedCloudCluster={setSelectedCloudCluster}
                />
              );
            })
          )}
        </Box>
      )}
    </PageWithTitle>
  );
};

export default Nodes;
