import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Table,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListDivider,
  Textarea,
} from "@mui/joy";
import { RefreshCw, Monitor, Square, Trash2 } from "lucide-react";
import SubmitJobModal from "./SubmitJobModal";
import { buildApiUrl, apiFetch } from "../utils/api";
import useSWR from "swr";

interface ClusterStatus {
  cluster_name: string;
  status: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
  resources_str?: string;
}

interface StatusResponse {
  clusters: ClusterStatus[];
}

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

interface JobRecord {
  job_id: number;
  job_name: string;
  username: string;
  submitted_at: number;
  start_at?: number;
  end_at?: number;
  resources: string;
  status: string;
  log_path: string;
}

const fetcher = (url: string) =>
  apiFetch(url, { credentials: "include" }).then((res) => res.json());

const SkyPilotClusterStatus: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState<{
    [key: string]: boolean;
  }>({});
  const [clusterTypes, setClusterTypes] = useState<{
    [key: string]: ClusterTypeInfo;
  }>({});
  const [submitJobModalOpen, setSubmitJobModalOpen] = useState(false);
  const [jobModalCluster, setJobModalCluster] = useState<string>("");
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string>("");
  const [selectedJobLogs, setSelectedJobLogs] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // SWR for cluster status
  const { data, isLoading, mutate } = useSWR(
    buildApiUrl("skypilot/status"),
    fetcher,
    { refreshInterval: 2000 }
  );

  const clusters = data?.clusters || [];

  // Fetch cluster type info for each cluster
  useEffect(() => {
    if (!clusters.length) {
      setClusterTypes({});
      return;
    }
    let isMounted = true;
    const fetchTypes = async () => {
      const typePromises = clusters.map(async (cluster: any) => {
        try {
          const typeResponse = await apiFetch(
            buildApiUrl(`skypilot/cluster-type/${cluster.cluster_name}`),
            { credentials: "include" }
          );
          if (typeResponse.ok) {
            const typeData: ClusterTypeInfo = await typeResponse.json();
            return { [cluster.cluster_name]: typeData };
          }
        } catch (err) {
          console.error(
            `Failed to fetch cluster type for ${cluster.cluster_name}:`,
            err
          );
        }
        return null;
      });
      const typeResults = await Promise.all(typePromises);
      const typesMap: { [key: string]: ClusterTypeInfo } = {};
      typeResults.forEach((result) => {
        if (result && typeof result === "object") {
          Object.assign(typesMap, result);
        }
      });
      if (isMounted) setClusterTypes(typesMap);
    };
    fetchTypes();
    return () => {
      isMounted = false;
    };
  }, [clusters]);

  // Replace fetchClusterStatus with mutate for manual refresh
  const fetchClusterStatus = async () => {
    try {
      await mutate();
    } catch (err) {
      setError("Error fetching cluster status");
    }
  };

  // Fetch jobs for a cluster
  const fetchJobs = async (clusterName: string) => {
    setJobsLoading(true);
    setJobsError("");
    try {
      const response = await apiFetch(
        buildApiUrl(`skypilot/jobs/${clusterName}`),
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setJobsLoading(false);
    }
  };

  // Fetch jobs when a cluster is expanded
  useEffect(() => {
    if (expandedCluster) {
      fetchJobs(expandedCluster);
    }
  }, [expandedCluster, submitJobModalOpen]);

  // Fetch logs for a job
  const fetchJobLogs = async (clusterName: string, jobId: number) => {
    setLogsLoading(true);
    setSelectedJobId(jobId);
    try {
      const response = await apiFetch(
        buildApiUrl(
          `skypilot/jobs/${clusterName}/${jobId}/logs?tail_lines=100`
        ),
        { credentials: "include" }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      const data = await response.json();
      setSelectedJobLogs(data.logs || "No logs available");
    } catch (err) {
      setSelectedJobLogs(
        `Error fetching logs: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setLogsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "up":
        return "success";
      case "stopped":
        return "warning";
      case "init":
        return "primary";
      default:
        return "neutral";
    }
  };

  const getJobStatusLabel = (status: string) => {
    switch (status) {
      case "JobStatus.INIT":
        return "Initializing";
      case "JobStatus.PENDING":
        return "Pending";
      case "JobStatus.RUNNING":
        return "Running";
      case "JobStatus.SUCCEEDED":
        return "Succeeded";
      case "JobStatus.FAILED":
        return "Failed";
      case "JobStatus.CANCELLED":
        return "Cancelled";
      default:
        return status;
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "JobStatus.INIT":
        return "primary";
      case "JobStatus.PENDING":
        return "neutral";
      case "JobStatus.RUNNING":
        return "primary";
      case "JobStatus.SUCCEEDED":
        return "success";
      case "JobStatus.FAILED":
        return "danger";
      case "JobStatus.CANCELLED":
        return "warning";
      default:
        return "neutral";
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAutostop = (autostop?: number, toDown?: boolean) => {
    if (!autostop) return "-";
    const action = toDown ? "down" : "stop";
    return `${autostop}min (${action})`;
  };

  const handleStopCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: true,
      }));
      const response = await apiFetch(buildApiUrl("skypilot/stop"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (response.ok) {
        // Refresh cluster status after successful operation
        await fetchClusterStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to stop cluster");
      }
    } catch (err) {
      setError("Error stopping cluster");
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: false,
      }));
    }
  };

  const handleDownCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: true,
      }));
      const response = await apiFetch(buildApiUrl("skypilot/down"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (response.ok) {
        // Refresh cluster status after successful operation
        await fetchClusterStatus();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to down cluster");
      }
    } catch (err) {
      setError("Error downing cluster");
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: false,
      }));
    }
  };

  // Handler to open job submission modal
  const handleOpenSubmitJobModal = (clusterName: string) => {
    setJobModalCluster(clusterName);
    setSubmitJobModalOpen(true);
  };
  // Handler to close job submission modal
  const handleCloseSubmitJobModal = () => {
    setSubmitJobModalOpen(false);
    setJobModalCluster("");
  };
  // Handler to expand/collapse job list for a cluster
  const handleToggleExpandCluster = (clusterName: string) => {
    setExpandedCluster((prev) => (prev === clusterName ? null : clusterName));
  };

  return (
    <Box>
      {error && (
        <Card color="danger" variant="soft" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography color="danger">{error}</Typography>
            <Button
              variant="plain"
              size="sm"
              color="danger"
              onClick={() => setError(null)}
            >
              ×
            </Button>
          </Box>
        </Card>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Monitor size={20} />
          <Typography level="h4">SkyPilot Cluster Status</Typography>
        </Box>
        <Button
          startDecorator={<RefreshCw size={16} />}
          onClick={fetchClusterStatus}
          disabled={isLoading}
          loading={isLoading}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      <Card>
        {clusters.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              No SkyPilot clusters found.
            </Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary", mt: 1 }}>
              Launch a cluster using the SkyPilot Cluster Launcher to see it
              here.
            </Typography>
          </Box>
        ) : (
          <Table sx={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th style={{ width: "15%" }}>Cluster Name</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "25%" }}>Resources</th>
                <th style={{ width: "15%" }}>Launched At</th>
                <th style={{ width: "10%" }}>Last Use</th>
                <th style={{ width: "10%" }}>Autostop</th>
                <th style={{ width: "15%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster: ClusterStatus, index: number) => (
                <React.Fragment key={index}>
                  <tr>
                    <td>
                      <Button
                        size="sm"
                        variant="plain"
                        onClick={() =>
                          handleToggleExpandCluster(cluster.cluster_name)
                        }
                      >
                        {expandedCluster === cluster.cluster_name ? "−" : "+"}
                      </Button>
                    </td>
                    <td>
                      <Typography level="title-sm">
                        {cluster.cluster_name}
                      </Typography>
                    </td>
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
                        <Chip
                          color={getStatusColor(cluster.status)}
                          variant="soft"
                          size="sm"
                        >
                          {cluster.status}
                        </Chip>
                      )}
                    </td>
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                        title={cluster.resources_str || "-"}
                      >
                        {cluster.resources_str || "-"}
                      </Typography>
                    </td>
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatTimestamp(cluster.launched_at)}
                      </Typography>
                    </td>
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cluster.last_use || "-"}
                      </Typography>
                    </td>
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatAutostop(cluster.autostop, cluster.to_down)}
                      </Typography>
                    </td>
                    <td>
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        {/* Show stop button only for cloud clusters and if cluster is UP */}
                        {clusterTypes[cluster.cluster_name] &&
                          !clusterTypes[cluster.cluster_name].is_ssh &&
                          cluster.status.toLowerCase().includes("up") && (
                            <Button
                              size="sm"
                              variant="outlined"
                              color="warning"
                              startDecorator={<Square size={14} />}
                              onClick={() =>
                                handleStopCluster(cluster.cluster_name)
                              }
                              loading={
                                operationLoading[`stop_${cluster.cluster_name}`]
                              }
                              disabled={
                                operationLoading[`stop_${cluster.cluster_name}`]
                              }
                            >
                              Stop
                            </Button>
                          )}

                        {/* Show down button for all clusters if cluster is UP */}
                        {cluster.status.toLowerCase().includes("up") && (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="danger"
                            startDecorator={<Trash2 size={14} />}
                            onClick={() =>
                              handleDownCluster(cluster.cluster_name)
                            }
                            loading={
                              operationLoading[`down_${cluster.cluster_name}`]
                            }
                            disabled={
                              operationLoading[`down_${cluster.cluster_name}`]
                            }
                          >
                            Down
                          </Button>
                        )}

                        {/* Show cluster type indicator */}
                        {clusterTypes[cluster.cluster_name] && (
                          <Chip
                            size="sm"
                            variant="outlined"
                            color={
                              clusterTypes[cluster.cluster_name].is_ssh
                                ? "primary"
                                : "neutral"
                            }
                          >
                            {clusterTypes[
                              cluster.cluster_name
                            ].cluster_type.toUpperCase()}
                          </Chip>
                        )}

                        {/* Show Add Task button only for cloud clusters and if cluster is UP */}
                        {cluster.status.toLowerCase().includes("up") && (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="success"
                            onClick={() =>
                              handleOpenSubmitJobModal(cluster.cluster_name)
                            }
                          >
                            Add Task
                          </Button>
                        )}
                      </Box>
                    </td>
                  </tr>
                  {/* Expanded job list row */}
                  {expandedCluster === cluster.cluster_name && (
                    <tr>
                      <td colSpan={8}>
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: "background.level1",
                            borderRadius: 2,
                          }}
                        >
                          {/* Inline job list */}
                          <Typography level="title-md" sx={{ mb: 2 }}>
                            Jobs for {cluster.cluster_name}
                          </Typography>
                          {jobsError && (
                            <Alert color="danger" sx={{ mb: 2 }}>
                              {jobsError}
                            </Alert>
                          )}
                          {jobsLoading ? (
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "center",
                                p: 4,
                              }}
                            >
                              <CircularProgress />
                            </Box>
                          ) : (
                            <List sx={{ maxHeight: "40vh", overflow: "auto" }}>
                              {jobs.length === 0 ? (
                                <ListItem>
                                  <Typography
                                    level="body-sm"
                                    sx={{ color: "text.secondary" }}
                                  >
                                    No jobs found for this cluster
                                  </Typography>
                                </ListItem>
                              ) : (
                                jobs.map((job, idx) => (
                                  <React.Fragment key={job.job_id}>
                                    {idx > 0 && <ListDivider />}
                                    <ListItem>
                                      <Box sx={{ width: "100%" }}>
                                        <Box
                                          sx={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            mb: 1,
                                          }}
                                        >
                                          <Typography level="title-sm">
                                            {job.job_name}
                                          </Typography>
                                          <Chip
                                            size="sm"
                                            color={getJobStatusColor(
                                              job.status
                                            )}
                                            variant="soft"
                                          >
                                            {getJobStatusLabel(job.status)}
                                          </Chip>
                                        </Box>
                                        <Typography
                                          level="body-xs"
                                          sx={{
                                            color: "text.secondary",
                                            mb: 1,
                                          }}
                                        >
                                          Job ID: {job.job_id} | User:{" "}
                                          {job.username}
                                        </Typography>
                                        <Typography
                                          level="body-xs"
                                          sx={{
                                            color: "text.secondary",
                                            mb: 1,
                                          }}
                                        >
                                          Submitted:{" "}
                                          {formatTimestamp(job.submitted_at)}
                                        </Typography>
                                        {job.start_at && (
                                          <Typography
                                            level="body-xs"
                                            sx={{
                                              color: "text.secondary",
                                              mb: 1,
                                            }}
                                          >
                                            Started:{" "}
                                            {formatTimestamp(job.start_at)}
                                          </Typography>
                                        )}
                                        {job.end_at && (
                                          <Typography
                                            level="body-xs"
                                            sx={{
                                              color: "text.secondary",
                                              mb: 1,
                                            }}
                                          >
                                            Ended: {formatTimestamp(job.end_at)}
                                          </Typography>
                                        )}
                                        <Typography
                                          level="body-xs"
                                          sx={{
                                            color: "text.secondary",
                                            mb: 1,
                                          }}
                                        >
                                          Resources: {job.resources}
                                        </Typography>
                                        <Button
                                          size="sm"
                                          variant="outlined"
                                          onClick={() =>
                                            fetchJobLogs(
                                              cluster.cluster_name,
                                              job.job_id
                                            )
                                          }
                                          sx={{ mt: 1 }}
                                        >
                                          View Logs
                                        </Button>
                                        {selectedJobId === job.job_id && (
                                          <Box sx={{ mt: 2 }}>
                                            <Typography
                                              level="body-xs"
                                              sx={{ mb: 1 }}
                                            >
                                              Logs:
                                            </Typography>
                                            {logsLoading ? (
                                              <CircularProgress size="sm" />
                                            ) : (
                                              <Textarea
                                                value={
                                                  selectedJobLogs ||
                                                  "No logs available"
                                                }
                                                readOnly
                                                minRows={8}
                                                maxRows={12}
                                                sx={{
                                                  fontFamily: "monospace",
                                                  fontSize: "sm",
                                                  width: "100%",
                                                  "& textarea": {
                                                    resize: "none",
                                                  },
                                                }}
                                              />
                                            )}
                                          </Box>
                                        )}
                                      </Box>
                                    </ListItem>
                                  </React.Fragment>
                                ))
                              )}
                            </List>
                          )}
                        </Box>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {/* SubmitJobModal rendered at root level */}
      <SubmitJobModal
        open={submitJobModalOpen}
        onClose={handleCloseSubmitJobModal}
        clusterName={jobModalCluster}
        onJobSubmitted={() => {
          if (expandedCluster) fetchJobs(expandedCluster);
        }}
        isClusterLaunching={
          clusters
            .find((c: ClusterStatus) => c.cluster_name === jobModalCluster)
            ?.status.toLowerCase() === "init"
        }
        isSshCluster={!!clusterTypes[jobModalCluster]?.is_ssh}
      />
    </Box>
  );
};

export default SkyPilotClusterStatus;
