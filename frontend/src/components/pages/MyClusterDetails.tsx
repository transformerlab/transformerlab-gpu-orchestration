import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemContent,
  Card,
  Table,
  Button,
  Grid,
  Badge,
  Modal,
  ModalDialog,
  ModalClose,
  Textarea,
  IconButton,
  ButtonGroup,
  Dropdown,
  Menu,
  MenuButton,
  MenuItem,
  ListItemDecorator,
} from "@mui/joy";
import {
  Info,
  Server,
  Globe,
  Terminal,
  Cloud,
  Zap,
  ArrowLeft,
  Play,
  Trash2,
  Clock,
  Calendar,
  Activity,
  Users,
  HardDrive,
  FileText,
  EllipsisIcon,
  Trash2Icon,
  StopCircleIcon,
  ContainerIcon,
  SquareTerminalIcon,
  BookOpenIcon,
  CodeIcon,
  TextIcon,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { buildApiUrl, apiFetch } from "../../utils/api";
import useSWR from "swr";
import PageWithTitle from "./templates/PageWithTitle";
import FakeCharts from "../widgets/FakeCharts";
import LogViewer from "../widgets/LogViewer";
import InstanceStatusChip from "../widgets/InstanceStatusChip";
import InteractiveTaskModal from "../InteractiveTaskModal";
import SubmitJobModal from "../SubmitJobModal";

interface ClusterTypeInfo {
  cluster_name: string;
  cluster_type: string;
  is_ssh: boolean;
  available_operations: string[];
  recommendations: {
    stop: string;
    down: string;
  };
}

interface SSHNodeInfo {
  [ip: string]: {
    gpu_resources?: {
      node_gpus?: Array<{
        node: string;
        gpu_type?: string;
        gpu_count?: number;
      }>;
    };
  };
}

interface JobRecord {
  job_id: number;
  job_name: string;
  username: string;
  submitted_at: number;
  start_at?: number;
  end_at?: number;
  resources: string;
  status: string;
}

interface ClusterData {
  cluster_name: string;
  status: string;
  resources_str?: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
}

const MyClusterDetails: React.FC = () => {
  const { clusterName } = useParams<{ clusterName: string }>();
  const navigate = useNavigate();
  const [clusterTypeInfo, setClusterTypeInfo] =
    useState<ClusterTypeInfo | null>(null);
  const [sshNodeInfo, setSshNodeInfo] = useState<SSHNodeInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedJobLogs, setSelectedJobLogs] = useState<{
    jobId: number;
    jobName: string;
    logs: string;
  } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [interactiveTaskModal, setInteractiveTaskModal] = useState<{
    open: boolean;
    clusterName: string;
    taskType: "vscode" | "jupyter";
  }>({
    open: false,
    clusterName: "",
    taskType: "vscode",
  });

  const [submitJobModal, setSubmitJobModal] = useState<{
    open: boolean;
    clusterName: string;
  }>({
    open: false,
    clusterName: "",
  });

  // Fetch cluster status data
  const { data: statusData, isLoading: statusLoading } = useSWR(
    clusterName ? buildApiUrl("skypilot/status") : null,
    (url) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 5000 }
  );

  // Get current cluster data
  const clusterData = statusData?.clusters?.find(
    (c: ClusterData) => c.cluster_name === clusterName
  );

  // Fetch jobs for this cluster
  const { data: jobsData, isLoading: jobsLoading } = useSWR(
    clusterName ? buildApiUrl(`skypilot/jobs/${clusterName}`) : null,
    (url) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 10000 }
  );

  const jobs = jobsData?.jobs || [];

  // Fetch cluster platform information
  const { data: clusterPlatforms } = useSWR(
    clusterName ? buildApiUrl("skypilot/cluster-platforms") : null,
    (url: string) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 5000 }
  );

  const platforms = clusterPlatforms?.platforms || {};
  const clusterPlatform = platforms[clusterName || ""] || "unknown";

  useEffect(() => {
    if (clusterName) {
      fetchClusterInfo();
    }
  }, [clusterName]);

  const fetchClusterInfo = async () => {
    if (!clusterName) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch cluster type information
      const typeResponse = await apiFetch(
        buildApiUrl(`skypilot/cluster-type/${clusterName}`),
        { credentials: "include" }
      );

      let typeData = null;
      if (typeResponse.ok) {
        typeData = await typeResponse.json();
        setClusterTypeInfo(typeData);
      }

      // If it's an SSH cluster, fetch SSH node information
      if (typeData?.is_ssh) {
        const sshResponse = await apiFetch(
          buildApiUrl("skypilot/ssh-node-info"),
          { credentials: "include" }
        );

        if (sshResponse.ok) {
          const sshData = await sshResponse.json();
          setSshNodeInfo(sshData);
        }
      }
    } catch (err) {
      setError("Failed to fetch cluster information");
      console.error("Error fetching cluster info:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownCluster = async () => {
    if (!clusterName) return;

    try {
      setOperationLoading((prev) => ({
        ...prev,
        down: true,
      }));

      const response = await apiFetch(buildApiUrl("skypilot/down"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to terminate cluster:", errorData.detail);
      }
    } catch (err) {
      console.error("Error downing cluster:", err);
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        down: false,
      }));
    }
  };

  const handleStopCluster = async () => {
    if (!clusterName) return;

    try {
      setOperationLoading((prev) => ({
        ...prev,
        stop: true,
      }));
      const response = await apiFetch(buildApiUrl("skypilot/stop"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to stop cluster:", errorData.detail);
      }
    } catch (err) {
      console.error("Error stopping cluster:", err);
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        stop: false,
      }));
    }
  };

  const openInteractiveTaskModal = (
    clusterName: string,
    taskType: "vscode" | "jupyter"
  ) => {
    setInteractiveTaskModal({
      open: true,
      clusterName,
      taskType,
    });
  };

  const closeInteractiveTaskModal = () => {
    setInteractiveTaskModal({
      open: false,
      clusterName: "",
      taskType: "vscode",
    });
  };

  const openSubmitJobModal = (clusterName: string) => {
    setSubmitJobModal({
      open: true,
      clusterName,
    });
  };

  const closeSubmitJobModal = () => {
    setSubmitJobModal({
      open: false,
      clusterName: "",
    });
  };

  const handleViewJobLogs = async (jobId: number, jobName: string) => {
    if (!clusterName) return;

    setLogsLoading(true);
    try {
      const response = await apiFetch(
        buildApiUrl(`skypilot/jobs/${clusterName}/${jobId}/logs`),
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedJobLogs({
          jobId,
          jobName,
          logs: data.logs,
        });
      } else {
        console.error("Failed to fetch job logs");
      }
    } catch (err) {
      console.error("Error fetching job logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const closeJobLogs = () => {
    setSelectedJobLogs(null);
  };

  const getClusterTypeDisplay = () => {
    if (!clusterTypeInfo) return "Unknown";

    if (clusterTypeInfo.is_ssh) {
      return "SSH Cluster";
    }

    // Use platform information from backend instead of checking cluster names
    if (clusterPlatform === "azure") {
      return "Azure Cluster";
    } else if (clusterPlatform === "runpod") {
      return "RunPod Cluster";
    } else if (clusterPlatform === "aws") {
      return "AWS Cluster";
    } else if (clusterPlatform === "gcp") {
      return "GCP Cluster";
    }

    return "Cloud Cluster";
  };

  const getClusterTypeIcon = () => {
    if (!clusterTypeInfo) return <Server size={20} />;

    if (clusterTypeInfo.is_ssh) {
      return <Terminal size={20} />;
    }

    // Use platform information from backend instead of checking cluster names
    if (clusterPlatform === "azure") {
      return <Cloud size={20} />;
    } else if (clusterPlatform === "runpod") {
      return <Zap size={20} />;
    }

    return <Globe size={20} />;
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAutostop = (autostop?: number, toDown?: boolean) => {
    if (!autostop) return "No auto-stop";
    const action = toDown ? "down" : "stop";
    return `${autostop} minutes (${action})`;
  };

  const getJobStatusColor = (status: string) => {
    // Remove "JobStatus." prefix if present
    const cleanStatus = status.replace("JobStatus.", "");
    const statusLower = cleanStatus.toLowerCase();
    console.log("Job status:", status, "Cleaned:", cleanStatus);
    if (statusLower.includes("running") || statusLower.includes("pending")) {
      return "success";
    } else if (
      statusLower.includes("failed") ||
      statusLower.includes("error")
    ) {
      return "danger";
    } else if (
      statusLower.includes("completed") ||
      statusLower.includes("succeeded")
    ) {
      return "neutral";
    }
    return "warning";
  };

  const formatJobStatus = (status: string) => {
    // Remove "JobStatus." prefix and format nicely
    return status.replace("JobStatus.", "").replace(/_/g, " ");
  };

  const formatClusterStatus = (status: string) => {
    // Remove "ClusterStatus." prefix if present
    return status.replace("ClusterStatus.", "");
  };

  const formatJobDuration = (startAt?: number, endAt?: number) => {
    if (!startAt) return "-";
    const start = new Date(startAt * 1000);
    const end = endAt ? new Date(endAt * 1000) : new Date();
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!clusterName) {
    return (
      <PageWithTitle
        title="Cluster Details"
        subtitle="Cluster information and jobs"
        backButton={true}
        onBack={() => navigate("/dashboard/my-instances")}
      >
        <Alert color="danger">Cluster name not provided</Alert>
      </PageWithTitle>
    );
  }

  if (statusLoading || loading) {
    return (
      <PageWithTitle
        title={clusterName}
        subtitle="Cluster information and jobs"
        backButton={true}
        onBack={() => navigate("/dashboard/my-instances")}
      >
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  if (error) {
    return (
      <PageWithTitle
        title={clusterName}
        subtitle="Cluster information and jobs"
        backButton={true}
        onBack={() => navigate("/dashboard/my-instances")}
      >
        <Alert color="danger">{error}</Alert>
      </PageWithTitle>
    );
  }

  if (!clusterData) {
    return (
      <PageWithTitle
        title={clusterName}
        subtitle="Cluster information and jobs"
        backButton={true}
        onBack={() => navigate("/dashboard/my-instances")}
      >
        <Alert color="warning">Cluster not found</Alert>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title={clusterName}
      subtitle="Cluster information and jobs"
      sticky={true}
      backButton={true}
      onBack={() => navigate("/dashboard/my-instances")}
      button={
        clusterData.status.toLowerCase().includes("up") && (
          <Button
            variant="outlined"
            color="danger"
            startDecorator={<Trash2 />}
            loading={operationLoading.down}
            onClick={handleDownCluster}
          >
            Terminate Cluster
          </Button>
        )
      }
    >
      <Stack spacing={2}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Dropdown>
            <MenuButton variant="outlined" size="sm">
              Actions
              <ChevronDown />
            </MenuButton>
            <Menu size="sm" variant="soft" placement="bottom-end">
              {clusterData.status.toLowerCase().includes("up") && (
                <>
                  <MenuItem onClick={() => openSubmitJobModal(clusterName!)}>
                    <ListItemDecorator>
                      <Zap />
                    </ListItemDecorator>
                    Submit a Job
                  </MenuItem>
                </>
              )}
              <Divider />
              <MenuItem
                onClick={() => openInteractiveTaskModal(clusterName!, "vscode")}
              >
                <ListItemDecorator>
                  <CodeIcon />
                </ListItemDecorator>
                VSCode
              </MenuItem>
              <MenuItem
                onClick={() =>
                  openInteractiveTaskModal(clusterName!, "jupyter")
                }
              >
                <ListItemDecorator>
                  <BookOpenIcon />
                </ListItemDecorator>
                Jupyter
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  // Navigate to jobs page or show logs
                  console.log("View logs for cluster:", clusterName);
                }}
              >
                <ListItemDecorator>
                  <TextIcon />
                </ListItemDecorator>
                Logs
              </MenuItem>
            </Menu>
          </Dropdown>
        </Box>
      </Stack>

      <Stack gap={3} mt={3}>
        {/* Cluster Information Cards */}
        <Grid container spacing={2}>
          {/* Basic Info Card */}
          <Grid xs={12} md={6}>
            <Card>
              <Stack spacing={1}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" color="neutral">
                    Cluster Name:
                  </Typography>
                  <Typography level="body-sm" fontWeight="bold">
                    {clusterName}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography level="body-sm" color="neutral">
                    Type:
                  </Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    startDecorator={getClusterTypeIcon()}
                  >
                    {getClusterTypeDisplay()}
                  </Chip>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" color="neutral">
                    Status:
                  </Typography>
                  <InstanceStatusChip status={clusterData.status} />
                </Box>

                {clusterData.resources_str && (
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography level="body-sm" color="neutral">
                      Resources:
                    </Typography>
                    <Typography level="body-sm">
                      {clusterData.resources_str}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Card>
          </Grid>

          {/* Timing Info Card */}
          <Grid xs={12} md={6}>
            <Card>
              <Stack spacing={1}>
                {clusterData.launched_at && (
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography level="body-sm" color="neutral">
                      Launched At:
                    </Typography>
                    <Typography level="body-sm">
                      {formatTimestamp(clusterData.launched_at)}
                    </Typography>
                  </Box>
                )}

                {clusterData.last_use && (
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography level="body-sm" color="neutral">
                      Last Use:
                    </Typography>
                    <Typography level="body-sm">
                      {clusterData.last_use}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" color="neutral">
                    Auto-stop:
                  </Typography>
                  <Typography level="body-sm">
                    {formatAutostop(clusterData.autostop, clusterData.to_down)}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        </Grid>

        {/* SSH Cluster Specific Information */}
        {clusterTypeInfo?.is_ssh && sshNodeInfo && (
          <Card>
            <Typography
              level="title-sm"
              sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Terminal size={16} />
              SSH Nodes
            </Typography>
            <List size="sm">
              {Object.entries(sshNodeInfo).map(([ip, info]) => (
                <ListItem key={ip}>
                  <ListItemContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography level="body-sm" fontWeight="bold">
                        {ip}
                      </Typography>
                      {info.gpu_resources?.node_gpus &&
                        info.gpu_resources.node_gpus.length > 0 && (
                          <Chip size="sm" variant="soft" color="success">
                            {info.gpu_resources.node_gpus
                              .map(
                                (gpu) =>
                                  `${gpu.gpu_count || 1}x ${
                                    gpu.gpu_type || "GPU"
                                  }`
                              )
                              .join(", ")}
                          </Chip>
                        )}
                    </Box>
                  </ListItemContent>
                </ListItem>
              ))}
            </List>
          </Card>
        )}

        <Divider />

        <FakeCharts />

        {/* Jobs Section */}
        <Card>
          <Typography
            level="title-sm"
            sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
          >
            Jobs ({jobs.length})
          </Typography>

          {jobsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : jobs.length === 0 ? (
            <Alert color="neutral">No jobs found for this cluster</Alert>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Resources</th>
                  <th>Submitted</th>
                  <th>Duration</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job: JobRecord) => (
                  <tr key={job.job_id}>
                    <td>
                      <Typography level="body-sm" fontWeight="bold">
                        {job.job_id}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm">{job.job_name}</Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={getJobStatusColor(job.status)}
                        variant="soft"
                      >
                        {formatJobStatus(job.status)}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm">{job.resources}</Typography>
                    </td>
                    <td>
                      <Typography level="body-sm">
                        {formatTimestamp(job.submitted_at)}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm">
                        {formatJobDuration(job.start_at, job.end_at)}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm">{job.username}</Typography>
                    </td>
                    <td>
                      <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() =>
                          handleViewJobLogs(job.job_id, job.job_name)
                        }
                        disabled={logsLoading}
                      >
                        <FileText size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Stack>

      {/* Job Logs Modal */}
      <Modal open={!!selectedJobLogs || logsLoading} onClose={closeJobLogs}>
        <ModalDialog
          size="lg"
          sx={{
            maxWidth: "90vw",
            maxHeight: "90vh",
            width: "100%",
            height: "100%",
          }}
        >
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Job Logs -{" "}
            {logsLoading ? (
              <>&nbsp;</>
            ) : (
              `${selectedJobLogs?.jobName} (ID: ${selectedJobLogs?.jobId})`
            )}
          </Typography>
          {logsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <LogViewer log={selectedJobLogs?.logs} />
          )}
        </ModalDialog>
      </Modal>

      {/* Interactive Task Modal */}
      <InteractiveTaskModal
        open={interactiveTaskModal.open}
        onClose={closeInteractiveTaskModal}
        clusterName={interactiveTaskModal.clusterName}
        taskType={interactiveTaskModal.taskType}
        onTaskSubmitted={() => {
          console.log("Task submitted successfully");
        }}
        isClusterLaunching={false}
      />

      {/* Submit Job Modal */}
      <SubmitJobModal
        open={submitJobModal.open}
        onClose={closeSubmitJobModal}
        clusterName={submitJobModal.clusterName}
        onJobSubmitted={() => {
          console.log("Job submitted successfully");
        }}
        isClusterLaunching={false}
        isSshCluster={false}
      />
    </PageWithTitle>
  );
};

export default MyClusterDetails;
