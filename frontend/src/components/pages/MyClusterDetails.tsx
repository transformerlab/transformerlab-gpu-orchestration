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
  Skeleton,
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
  X,
  DollarSign,
} from "lucide-react";

// Import SVG icons
import RunPodIcon from "../widgets/icons/runpod.svg";
import AzureIcon from "../widgets/icons/azure.svg";
import { useParams, useNavigate } from "react-router-dom";
import {
  buildApiUrl,
  apiFetch,
  jobApi,
  clusterInfoApi,
  ClusterInfoResponse,
} from "../../utils/api";
import useSWR from "swr";
import PageWithTitle from "./templates/PageWithTitle";
import FakeCharts from "../widgets/FakeCharts";
import LogViewer from "../widgets/LogViewer";
import StreamingLogViewer from "../widgets/StreamingLogViewer";
import InstanceStatusChip from "../widgets/InstanceStatusChip";
import InteractiveTaskModal from "../modals/InteractiveTaskModal";
import SubmitJobModal from "../modals/SubmitJobModal";
import SSHModal from "../modals/SSHModal";
import VSCodeInfoModal from "../modals/VSCodeInfoModal";
import { parseResourcesString } from "../../utils/resourceParser";
import ResourceDisplay from "../widgets/ResourceDisplay";

interface ClusterTypeInfo {
  cluster_name: string;
  cluster_type: string;
  is_ssh: boolean;
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

interface CostInfo {
  total_cost: number;
  duration: number;
  cost_per_hour: number;
  launched_at?: number;
  status?: string;
  cloud?: string;
  region?: string;
}

const MyClusterDetails: React.FC = () => {
  const { clusterName } = useParams<{ clusterName: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedJobLogs, setSelectedJobLogs] = useState<{
    jobId: number;
    jobName: string;
    logs: string[];
  } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
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

  const [cancelLoading, setCancelLoading] = useState<{
    [key: string]: boolean;
  }>({});

  const [sshClusterName, setSshClusterName] = useState<string | null>(null);

  // VSCode modal state
  const [vscodeModal, setVscodeModal] = useState<{
    open: boolean;
    clusterName: string | null;
    jobId: number | null;
  }>({
    open: false,
    clusterName: null,
    jobId: null,
  });

  // Fetch basic cluster info (fast - no jobs or cost data)
  const {
    data: basicInfoData,
    isLoading: basicInfoLoading,
    mutate: refreshBasicInfo,
  } = useSWR(
    clusterName ? `cluster-basic-info-${clusterName}` : null,
    () => clusterInfoApi.getBasicInfo(clusterName!),
    {
      refreshInterval: 5000,
      revalidateOnFocus: false,
      dedupingInterval: 2000,
      onError: (err) => {
        console.error("Error fetching cluster basic info:", err);
        setError("Failed to fetch cluster information");
      },
    },
  );

  // Fetch jobs separately (can be slower)
  const {
    data: jobsData,
    isLoading: jobsLoading,
    mutate: refreshJobs,
  } = useSWR(
    clusterName ? `cluster-jobs-${clusterName}` : null,
    () => clusterInfoApi.getJobs(clusterName!),
    {
      refreshInterval: 5000,
      revalidateOnFocus: false,
      dedupingInterval: 2000,
      onError: (err) => {
        console.error("Error fetching cluster jobs:", err);
      },
    }
  );

  // Fetch cost info separately (can be slower)
  const {
    data: costData,
    isLoading: costLoading,
    mutate: refreshCost,
  } = useSWR(
    clusterName ? `cluster-cost-${clusterName}` : null,
    () => clusterInfoApi.getCostInfo(clusterName!),
    {
      refreshInterval: 30000, // Refresh less frequently (30s) as cost updates slowly
      revalidateOnFocus: false,
      dedupingInterval: 2000,
      onError: (err) => {
        console.error("Error fetching cluster cost info:", err);
      },
    }
  );

  // Extract data from the separate responses
  const clusterData = basicInfoData?.cluster;
  const clusterTypeInfo = basicInfoData?.cluster_type;
  const sshNodeInfo = basicInfoData?.ssh_node_info;
  const costInfo = costData?.cost_info;
  const jobs = jobsData?.jobs || [];
  const clusterPlatform = basicInfoData?.platform?.platform || "unknown";
  const clusterTemplate = basicInfoData?.state?.template;

  const handleDownCluster = async () => {
    if (!clusterName) return;

    try {
      setOperationLoading((prev) => ({
        ...prev,
        down: true,
      }));

      const response = await apiFetch(buildApiUrl("instances/down"), {
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
      } else {
        // Navigate back to instances list after successful termination
        navigate("/dashboard/my-instances");
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

  const handleDownClusterWithConfirmation = () => {
    if (!clusterName) return;

    const confirmed = confirm(
      `Are you sure you want to terminate the cluster "${clusterName}"? This action cannot be undone and will permanently delete all data on the cluster.`,
    );
    if (confirmed) {
      handleDownCluster();
    }
  };

  const handleStopCluster = async () => {
    if (!clusterName) return;

    try {
      setOperationLoading((prev) => ({
        ...prev,
        stop: true,
      }));
      const response = await apiFetch(buildApiUrl("instances/stop"), {
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
      } else {
        // Refresh cluster info after successful operation
        refreshBasicInfo();
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
    taskType: "vscode" | "jupyter",
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
    setIsStreaming(true);
    setSelectedJobLogs({ jobId, jobName, logs: [] });

    try {
      // Create EventSource for Server-Sent Events
      const eventSource = new EventSource(
        buildApiUrl(
          `jobs/${clusterName}/${jobId}/logs/stream?tail=1000&follow=true`,
        ),
        { withCredentials: true },
      );

      eventSource.onopen = () => {
        setLogsLoading(false);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.log_line) {
            setSelectedJobLogs((prev) =>
              prev
                ? {
                    ...prev,
                    logs: [...prev.logs, data.log_line],
                  }
                : null,
            );
          } else if (data.status === "completed") {
            setIsStreaming(false);
            eventSource.close();
          } else if (data.error) {
            setSelectedJobLogs((prev) =>
              prev
                ? {
                    ...prev,
                    logs: [...prev.logs, `ERROR: ${data.error}`],
                  }
                : null,
            );
            setIsStreaming(false);
            eventSource.close();
          }
        } catch (parseError) {
          console.error("Failed to parse SSE data:", parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        setSelectedJobLogs((prev) =>
          prev
            ? {
                ...prev,
                logs: [...prev.logs, "ERROR: Failed to connect to log stream"],
              }
            : null,
        );
        setLogsLoading(false);
        setIsStreaming(false);
        eventSource.close();
      };
    } catch (err) {
      setSelectedJobLogs({
        jobId,
        jobName,
        logs: [
          `ERROR: ${
            err instanceof Error ? err.message : "Failed to start log streaming"
          }`,
        ],
      });
      setLogsLoading(false);
      setIsStreaming(false);
    }
  };

  const closeJobLogs = () => {
    setSelectedJobLogs(null);
  };

  const handleCancelJob = async (jobId: number) => {
    if (!clusterName) return;

    const cancelKey = `${clusterName}_${jobId}`;
    try {
      setCancelLoading((prev) => ({ ...prev, [cancelKey]: true }));
      setError(null);

      await jobApi.cancelJob(clusterName, jobId);
      console.log("Job cancelled successfully");

      // Refresh jobs to get updated job status
      refreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancelLoading((prev) => ({ ...prev, [cancelKey]: false }));
    }
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
    if (!autostop || autostop === -1) return "No auto-stop";
    const action = toDown ? "down" : "stop";
    return `${autostop} minutes (${action})`;
  };

  const getJobStatusColor = (status: string) => {
    // Remove "JobStatus." prefix if present
    const cleanStatus = status.replace("JobStatus.", "");
    const statusLower = cleanStatus.toLowerCase();
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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

  const CLUSTER_IS_UP =
    clusterData?.status.toLowerCase().includes("up") || false;

  return (
    <PageWithTitle
      title={clusterName}
      subtitle="Cluster information and jobs"
      sticky={true}
      backButton={true}
      onBack={() => navigate("/dashboard/my-instances")}
      button={
        <Button
          variant="outlined"
          color="danger"
          startDecorator={<Trash2 />}
          loading={operationLoading.down}
          onClick={handleDownClusterWithConfirmation}
        >
          Terminate Cluster
        </Button>
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
              <>
                <MenuItem
                  onClick={() => openSubmitJobModal(clusterName!)}
                  disabled={!CLUSTER_IS_UP}
                >
                  <ListItemDecorator>
                    <Zap />
                  </ListItemDecorator>
                  Submit a Job
                </MenuItem>
                <Divider />
                <MenuItem
                  onClick={() => {
                    setSshClusterName(clusterName);
                  }}
                  disabled={!CLUSTER_IS_UP}
                >
                  <ListItemDecorator>
                    <SquareTerminalIcon />
                  </ListItemDecorator>
                  Connect via SSH
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    openInteractiveTaskModal(clusterName!, "vscode")
                  }
                  disabled={!CLUSTER_IS_UP}
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
                  disabled={!CLUSTER_IS_UP}
                >
                  <ListItemDecorator>
                    <BookOpenIcon />
                  </ListItemDecorator>
                  Jupyter
                </MenuItem>
              </>
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
              {basicInfoLoading ? (
                <Stack spacing={1.5}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Skeleton variant="text" width="30%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Skeleton variant="text" width="20%" />
                    <Skeleton
                      variant="rectangular"
                      width={100}
                      height={24}
                      sx={{ borderRadius: 12 }}
                    />
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Skeleton variant="text" width="25%" />
                    <Skeleton
                      variant="rectangular"
                      width={80}
                      height={24}
                      sx={{ borderRadius: 12 }}
                    />
                  </Box>
                  <Box>
                    <Skeleton variant="text" width="30%" sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={60} />
                  </Box>
                </Stack>
              ) : clusterData ? (
                <Stack spacing={1}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
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

                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography level="body-sm" color="neutral">
                      Status:
                    </Typography>
                    <InstanceStatusChip status={clusterData.status as any} />
                  </Box>

                  {clusterData.resources_str && (
                    <Box>
                      <Typography
                        level="body-sm"
                        color="neutral"
                        sx={{ mb: 1 }}
                      >
                        Resources:
                      </Typography>
                      <ResourceDisplay
                        resourcesStr={clusterData.resources_str}
                        variant="detailed"
                        size="md"
                      />
                    </Box>
                  )}
                </Stack>
              ) : (
                <Alert color="warning">Cluster not found</Alert>
              )}
            </Card>
          </Grid>

          {/* Usage & Credits Info Card */}
          <Grid xs={12} md={6}>
            <Card>
              <Typography
                level="title-sm"
                sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
              >
                <Clock size={16} />
                Usage & Credits Information
              </Typography>
              {basicInfoLoading ? (
                <Stack spacing={1.5}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Skeleton variant="text" width="35%" />
                    <Skeleton variant="text" width="45%" />
                  </Box>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Skeleton variant="text" width="30%" />
                    <Skeleton variant="text" width="40%" />
                  </Box>
                </Stack>
              ) : clusterData ? (
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

                  <Box
                    sx={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography level="body-sm" color="neutral">
                      Auto-stop:
                    </Typography>
                    <Typography level="body-sm">
                      {formatAutostop(
                        clusterData.autostop,
                        clusterData.to_down
                      )}
                    </Typography>
                  </Box>

                  {/* Cost info section - shows skeleton while loading */}
                  {costLoading ? (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Skeleton variant="text" width="45%" />
                        <Skeleton variant="text" width="25%" />
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Skeleton variant="text" width="30%" />
                        <Skeleton variant="text" width="35%" />
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Skeleton variant="text" width="35%" />
                        <Skeleton variant="text" width="30%" />
                      </Box>
                    </>
                  ) : costInfo ? (
                    <>
                      <Divider sx={{ my: 1 }} />

                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography level="body-sm" color="neutral">
                          Total Credits Used:
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          {costInfo.total_cost.toFixed(2)}
                        </Typography>
                      </Box>

                      {costInfo.duration > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography level="body-sm" color="neutral">
                            Duration:
                          </Typography>
                          <Typography level="body-sm">
                            {formatDuration(costInfo.duration)}
                          </Typography>
                        </Box>
                      )}

                      {costInfo.cost_per_hour > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography level="body-sm" color="neutral">
                            Credits/Hour:
                          </Typography>
                          <Typography level="body-sm">
                            {costInfo.cost_per_hour.toFixed(2)}
                          </Typography>
                        </Box>
                      )}

                      {costInfo.cloud && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Typography level="body-sm" color="neutral">
                            Cloud Provider:
                          </Typography>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            {costInfo.cloud.toLowerCase() === "runpod" && (
                              <img
                                src={RunPodIcon}
                                alt="RunPod"
                                style={{
                                  width: 20,
                                  height: 20,
                                }}
                              />
                            )}
                            {costInfo.cloud.toLowerCase() === "azure" && (
                              <img
                                src={AzureIcon}
                                alt="Azure"
                                style={{
                                  width: 20,
                                  height: 20,
                                }}
                              />
                            )}
                            <Typography level="body-sm">
                              {costInfo.cloud.charAt(0).toUpperCase() +
                                costInfo.cloud.slice(1)}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {costInfo.region && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography level="body-sm" color="neutral">
                            Region:
                          </Typography>
                          <Typography level="body-sm">
                            {costInfo.region}
                          </Typography>
                        </Box>
                      )}
                    </>
                  ) : null}
                </Stack>
              ) : null}
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
              {Object.entries(sshNodeInfo as SSHNodeInfo).map(([ip, info]) => (
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
                                (gpu: any) =>
                                  `${gpu.gpu_count || 1}x ${
                                    gpu.gpu_type || "GPU"
                                  }`,
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

        {/* Only show usage graphs for Transformer Lab template */}
        {clusterTemplate === "transformer-lab" && <FakeCharts />}

        {/* Jobs Section */}
        <Card>
          <Typography
            level="title-sm"
            sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
          >
            {jobsLoading ? (
              <Skeleton variant="text" width={80} />
            ) : (
              `Jobs (${jobs.length})`
            )}
          </Typography>

          {jobsLoading ? (
            <Stack spacing={2}>
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
                  {[1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td>
                        <Skeleton variant="text" width={40} />
                      </td>
                      <td>
                        <Skeleton variant="text" width="80%" />
                      </td>
                      <td>
                        <Skeleton
                          variant="rectangular"
                          width={80}
                          height={24}
                          sx={{ borderRadius: 12 }}
                        />
                      </td>
                      <td>
                        <Skeleton variant="text" width="60%" />
                      </td>
                      <td>
                        <Skeleton variant="text" width="90%" />
                      </td>
                      <td>
                        <Skeleton variant="text" width={50} />
                      </td>
                      <td>
                        <Skeleton variant="text" width="70%" />
                      </td>
                      <td>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Stack>
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
                      <ResourceDisplay
                        resourcesStr={job.resources || ""}
                        variant="compact"
                        size="sm"
                      />
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
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
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
                        {/* Show VSCode Info button for VSCode jobs */}
                        {job.status === "JobStatus.RUNNING" &&
                          job.job_name &&
                          (job.job_name.includes("-vscode-") ||
                            job.job_name.toLowerCase().includes("vscode") ||
                            job.job_name.startsWith("vscode")) && (
                            <IconButton
                              size="sm"
                              variant="plain"
                              color="primary"
                              onClick={() => {
                                setVscodeModal({
                                  open: true,
                                  clusterName: clusterName,
                                  jobId: job.job_id,
                                });
                              }}
                            >
                              <CodeIcon size={16} />
                            </IconButton>
                          )}
                        {/* Show cancel button only for running jobs */}
                        {(job.status === "JobStatus.RUNNING" ||
                          job.status === "JobStatus.PENDING" ||
                          job.status === "JobStatus.SETTING_UP") && (
                          <IconButton
                            size="sm"
                            variant="plain"
                            color="danger"
                            onClick={() => handleCancelJob(job.job_id)}
                            disabled={
                              cancelLoading[`${clusterName}_${job.job_id}`]
                            }
                          >
                            <X size={16} />
                          </IconButton>
                        )}
                      </Box>
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
            <StreamingLogViewer
              logs={selectedJobLogs?.logs || []}
              isLoading={logsLoading}
            />
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
        availableResources={clusterData?.resources_str || ""}
      />

      {/* SSH Modal */}
      <SSHModal
        open={!!sshClusterName}
        onClose={() => setSshClusterName(null)}
        clusterName={sshClusterName}
      />

      {/* VSCode Info Modal */}
      <VSCodeInfoModal
        open={vscodeModal.open}
        onClose={() =>
          setVscodeModal({ open: false, clusterName: null, jobId: null })
        }
        clusterName={vscodeModal.clusterName || ""}
        jobId={vscodeModal.jobId || 0}
      />
    </PageWithTitle>
  );
};

export default MyClusterDetails;
