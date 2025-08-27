import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Table,
  CircularProgress,
  Chip,
  Textarea,
  Button,
} from "@mui/joy";
import { X } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useFakeData } from "../../../context/FakeDataContext";
import VSCodeInfoModal from "../../modals/VSCodeInfoModal";
import StreamingLogViewer from "../../widgets/StreamingLogViewer";

interface Job {
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

interface Cluster {
  cluster_name: string;
  status: string;
  resources_str?: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
}

interface ClusterWithJobs extends Cluster {
  jobs: Job[];
  jobsLoading: boolean;
  jobsError?: string;
}

interface PastJobCluster {
  cluster_name: string;
  saved_at: string;
  jobs: Job[];
}

// Generate fake jobs for demonstration
const generateFakeJobs = () => {
  const fakeJobs = [];
  const jobNames = [
    "jupyter-notebook-port8888",
    "vscode-server-port8080",
    "training-script-001",
    "inference-job-002",
    "data-processing-003",
    "model-evaluation-004",
  ];
  const statuses = [
    "JobStatus.RUNNING",
    "JobStatus.SUCCEEDED",
    "JobStatus.PENDING",
    "JobStatus.FAILED",
  ];
  const resources = [
    "1x NVIDIA A100",
    "2x NVIDIA V100",
    "4x NVIDIA T4",
    "1x NVIDIA H100",
  ];

  for (let i = 0; i < 6; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const submittedAt =
      Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400); // Random time in last 24h
    const startAt =
      status !== "JobStatus.PENDING"
        ? submittedAt + Math.floor(Math.random() * 300)
        : undefined;
    const endAt =
      status === "JobStatus.SUCCEEDED" || status === "JobStatus.FAILED"
        ? (startAt || submittedAt) + Math.floor(Math.random() * 3600)
        : undefined;

    fakeJobs.push({
      job_id: 1000 + i,
      job_name: jobNames[i],
      username: "ali",
      submitted_at: submittedAt,
      start_at: startAt,
      end_at: endAt,
      resources: resources[Math.floor(Math.random() * resources.length)],
      status: status,
      log_path: `/tmp/job_${1000 + i}.log`,
    });
  }
  return fakeJobs;
};

interface JobsProps {
  skypilotLoading: boolean;
  myClusters: Cluster[];
}

const Jobs: React.FC<JobsProps> = ({ skypilotLoading, myClusters }) => {
  const [clustersWithJobs, setClustersWithJobs] = useState<ClusterWithJobs[]>(
    []
  );
  const [pastJobClusters, setPastJobClusters] = useState<PastJobCluster[]>([]);
  const [pastJobsLoading, setPastJobsLoading] = useState(false);
  const [showPastJobs, setShowPastJobs] = useState(false);
  const { showFakeData } = useFakeData();
  const [selectedJobLogs, setSelectedJobLogs] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedClusterName, setSelectedClusterName] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<{
    [key: string]: boolean;
  }>({});
  const [error, setError] = useState<string | null>(null);

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

  // Fetch jobs for each cluster
  useEffect(() => {
    if (myClusters.length === 0) {
      setClustersWithJobs([]);
      return;
    }

    const fetchJobsForClusters = async () => {
      const clustersWithJobsData: ClusterWithJobs[] = [];

      for (const cluster of myClusters) {
        const clusterWithJobs: ClusterWithJobs = {
          ...cluster,
          jobs: [],
          jobsLoading: true,
        };

        try {
          const response = await apiFetch(
            buildApiUrl(`jobs/${cluster.cluster_name}`),
            { credentials: "include" }
          );

          if (response.ok) {
            const data = await response.json();
            clusterWithJobs.jobs = data.jobs || [];
          } else {
            clusterWithJobs.jobsError = `Failed to fetch jobs: ${response.statusText}`;
          }
        } catch (err) {
          clusterWithJobs.jobsError = "Failed to fetch jobs";
        } finally {
          clusterWithJobs.jobsLoading = false;
        }

        clustersWithJobsData.push(clusterWithJobs);
      }

      setClustersWithJobs(clustersWithJobsData);
    };

    fetchJobsForClusters();
  }, [myClusters]);

  // Fetch past jobs
  const fetchPastJobs = async () => {
    setPastJobsLoading(true);
    try {
      const response = await apiFetch(buildApiUrl("jobs/past-jobs"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPastJobClusters(data.past_jobs || []);
      } else {
        setError("Failed to fetch past jobs");
      }
    } catch (err) {
      setError("Failed to fetch past jobs");
    } finally {
      setPastJobsLoading(false);
    }
  };

  // Fetch logs for past jobs
  const fetchPastJobLogs = async (clusterName: string, jobId: number) => {
    setLogsLoading(true);
    setSelectedJobId(jobId);
    setSelectedClusterName(clusterName);
    setSelectedJobLogs([]);
    try {
      const response = await apiFetch(
        buildApiUrl(`jobs/past-jobs/${clusterName}/${jobId}/logs`),
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        // Split the logs string into an array of lines and filter out empty lines
        const logLines = (data.logs || "No logs available")
          .split("\n")
          .filter((line: string) => line.trim() !== "");
        setSelectedJobLogs(logLines);
      } else {
        setSelectedJobLogs(["Failed to fetch logs"]);
      }
    } catch (err) {
      setSelectedJobLogs(["Failed to fetch logs"]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Monitor job status changes for port forwarding
  useEffect(() => {
    if (clustersWithJobs.length === 0) return;

    const interval = setInterval(async () => {
      const updatedClustersWithJobs = await Promise.all(
        clustersWithJobs.map(async (cluster) => {
          try {
            const response = await apiFetch(
              buildApiUrl(`jobs/${cluster.cluster_name}`),
              { credentials: "include" }
            );

            if (response.ok) {
              const data = await response.json();
              const currentJobs = data.jobs || [];

              return {
                ...cluster,
                jobs: currentJobs,
                jobsLoading: false,
              };
            }
          } catch (err) {
            console.error(
              `Error monitoring jobs for cluster ${cluster.cluster_name}:`,
              err
            );
          }
          return cluster;
        })
      );

      setClustersWithJobs(updatedClustersWithJobs);
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [clustersWithJobs]);

  const fetchJobLogs = async (clusterName: string, jobId: number) => {
    setLogsLoading(true);
    setIsStreaming(true);
    setSelectedJobId(jobId);
    setSelectedClusterName(clusterName);
    setSelectedJobLogs([]);

    try {
      // Create EventSource for Server-Sent Events
      const eventSource = new EventSource(
        buildApiUrl(
          `jobs/${clusterName}/${jobId}/logs/stream?tail=1000&follow=true`
        ),
        { withCredentials: true }
      );

      eventSource.onopen = () => {
        setLogsLoading(false);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.log_line) {
            setSelectedJobLogs((prev) => [...prev, data.log_line]);
          } else if (data.status === "completed") {
            setIsStreaming(false);
            eventSource.close();
          } else if (data.error) {
            setSelectedJobLogs((prev) => [...prev, `ERROR: ${data.error}`]);
            setIsStreaming(false);
            eventSource.close();
          }
        } catch (parseError) {
          console.error("Failed to parse SSE data:", parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        setSelectedJobLogs((prev) => [
          ...prev,
          "ERROR: Failed to connect to log stream",
        ]);
        setLogsLoading(false);
        setIsStreaming(false);
        eventSource.close();
      };
    } catch (err) {
      setSelectedJobLogs([
        `ERROR: ${
          err instanceof Error ? err.message : "Failed to start log streaming"
        }`,
      ]);
      setLogsLoading(false);
      setIsStreaming(false);
    }
  };

  // Cancel a job
  const cancelJob = async (clusterName: string, jobId: number) => {
    const cancelKey = `${clusterName}_${jobId}`;
    try {
      setCancelLoading((prev) => ({ ...prev, [cancelKey]: true }));
      setError(null);

      const response = await apiFetch(
        buildApiUrl(`jobs/${clusterName}/${jobId}/cancel`),
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Job cancelled successfully:", data);

      // Refresh the jobs for this cluster
      const updatedClusters = clustersWithJobs.map((cluster) => {
        if (cluster.cluster_name === clusterName) {
          return {
            ...cluster,
            jobs: cluster.jobs.map((job) =>
              job.job_id === jobId
                ? { ...job, status: "JobStatus.CANCELLED" }
                : job
            ),
          };
        }
        return cluster;
      });
      setClustersWithJobs(updatedClusters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancelLoading((prev) => ({ ...prev, [cancelKey]: false }));
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case "JobStatus.INIT":
        return "primary";
      case "JobStatus.PENDING":
        return "neutral";
      case "JobStatus.RUNNING":
        return "success";
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

  const formatJobStatus = (status: string) => {
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

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatSavedAt = (savedAt: string) => {
    try {
      return new Date(savedAt).toLocaleString();
    } catch {
      return savedAt;
    }
  };

  if (skypilotLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Render the main content
  const renderMainContent = () => {
    if (myClusters.length === 0) {
      return (
        <Box sx={{ textAlign: "center", mt: 4, mb: 6 }}>
          <Typography level="h4" color="neutral">
            No active instances found
          </Typography>
          <Typography level="body-md" color="neutral" sx={{ mt: 1 }}>
            Launch an instance from the Node Pools page to see jobs here.
          </Typography>
        </Box>
      );
    }

    return (
      <>
        <Typography level="h3" sx={{ mb: 3 }}>
          Dedicated Instances
        </Typography>

        {error && (
          <Box sx={{ mb: 2, p: 2, bgcolor: "danger.50", borderRadius: 1 }}>
            <Typography color="danger">{error}</Typography>
          </Box>
        )}

        {clustersWithJobs.map((cluster) => (
          <Box key={cluster.cluster_name} sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              {cluster.cluster_name}
            </Typography>

            {cluster.jobsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress />
              </Box>
            ) : cluster.jobsError ? (
              <Typography color="danger" sx={{ mb: 2 }}>
                {cluster.jobsError}
              </Typography>
            ) : cluster.jobs.length === 0 ? (
              <Typography color="neutral" sx={{ mb: 2 }}>
                No jobs found for this cluster
              </Typography>
            ) : (
              <Table sx={{ minWidth: 650, mb: 2 }}>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Job Name</th>
                    <th>Status</th>
                    <th>Resources</th>
                    <th>Submitted At</th>
                    <th>Started At</th>
                    <th>Ended At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cluster.jobs.map((job) => (
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
                          {formatTimestamp(job.start_at)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {formatTimestamp(job.end_at)}
                        </Typography>
                      </td>
                      <td>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() =>
                              fetchJobLogs(cluster.cluster_name, job.job_id)
                            }
                          >
                            View Logs
                          </Button>
                          {/* Show cancel button only for running jobs */}
                          {(job.status === "JobStatus.RUNNING" ||
                            job.status === "JobStatus.PENDING" ||
                            job.status === "JobStatus.SETTING_UP") && (
                            <Button
                              size="sm"
                              variant="outlined"
                              color="danger"
                              startDecorator={<X size={14} />}
                              onClick={() =>
                                cancelJob(cluster.cluster_name, job.job_id)
                              }
                              loading={
                                cancelLoading[
                                  `${cluster.cluster_name}_${job.job_id}`
                                ]
                              }
                              disabled={
                                cancelLoading[
                                  `${cluster.cluster_name}_${job.job_id}`
                                ]
                              }
                            >
                              Cancel
                            </Button>
                          )}
                          {/* Show buttons for Jupyter and VSCode jobs */}
                          {job.status === "JobStatus.RUNNING" &&
                            job.job_name &&
                            (() => {
                              // Check for Jupyter jobs
                              if (
                                job.job_name.includes("-jupyter-") ||
                                job.job_name
                                  .toLowerCase()
                                  .includes("jupyter") ||
                                job.job_name.startsWith("jupyter")
                              ) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                      const portMatch =
                                        job.job_name.match(/port(\d+)/);
                                      const port = portMatch
                                        ? parseInt(portMatch[1])
                                        : 8888;
                                      const localhostUrl = `http://localhost:${port}`;
                                      window.open(localhostUrl, "_blank");
                                    }}
                                  >
                                    Access Jupyter
                                  </Button>
                                );
                              }

                              // Check for VSCode jobs
                              if (
                                job.job_name.includes("-vscode-") ||
                                job.job_name.toLowerCase().includes("vscode") ||
                                job.job_name.startsWith("vscode")
                              ) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                      setVscodeModal({
                                        open: true,
                                        clusterName: cluster.cluster_name,
                                        jobId: job.job_id,
                                      });
                                    }}
                                  >
                                    View VSCode Info
                                  </Button>
                                );
                              }

                              return null;
                            })()}
                        </Box>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            {/* Job Logs Modal */}
            {selectedJobId && selectedClusterName === cluster.cluster_name && (
              <Box sx={{ mt: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Job {selectedJobId} Logs
                </Typography>
                {logsLoading ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", py: 2 }}
                  >
                    <CircularProgress />
                  </Box>
                ) : (
                  <Box sx={{ height: 400 }}>
                    <StreamingLogViewer
                      logs={selectedJobLogs}
                      isLoading={logsLoading}
                    />
                  </Box>
                )}
              </Box>
            )}
          </Box>
        ))}
      </>
    );
  };

  return (
    <Box>
      {/* Render main content (Dedicated Instances or No clusters message) */}
      {renderMainContent()}

      {/* Past Jobs Section - Always visible */}
      <Box sx={{ mt: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Typography level="h3">Past Jobs</Typography>
          <Button
            size="sm"
            variant="outlined"
            onClick={() => {
              if (!showPastJobs) {
                fetchPastJobs();
              }
              setShowPastJobs(!showPastJobs);
            }}
          >
            {showPastJobs ? "Hide" : "Show"} Past Jobs
          </Button>
        </Box>

        {showPastJobs && (
          <>
            {pastJobsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress />
              </Box>
            ) : pastJobClusters.length === 0 ? (
              <Typography color="neutral" sx={{ mb: 2 }}>
                No past jobs found. Jobs from terminated clusters will appear
                here.
              </Typography>
            ) : (
              pastJobClusters.map((pastCluster) => (
                <Box
                  key={`${pastCluster.cluster_name}_${pastCluster.saved_at}`}
                  sx={{ mb: 4 }}
                >
                  <Typography level="h4" sx={{ mb: 1 }}>
                    {pastCluster.cluster_name}
                  </Typography>
                  <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                    Saved on: {formatSavedAt(pastCluster.saved_at)}
                  </Typography>

                  <Table sx={{ minWidth: 650, mb: 2 }}>
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Job Name</th>
                        <th>Status</th>
                        <th>Resources</th>
                        <th>Submitted At</th>
                        <th>Started At</th>
                        <th>Ended At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastCluster.jobs.map((job) => (
                        <tr key={job.job_id}>
                          <td>
                            <Typography level="body-sm" fontWeight="bold">
                              {job.job_id}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm">
                              {job.job_name}
                            </Typography>
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
                            <Typography level="body-sm">
                              {job.resources}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm">
                              {formatTimestamp(job.submitted_at)}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm">
                              {formatTimestamp(job.start_at)}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm">
                              {formatTimestamp(job.end_at)}
                            </Typography>
                          </td>
                          <td>
                            <Box
                              sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
                            >
                              <Button
                                size="sm"
                                variant="outlined"
                                onClick={() =>
                                  fetchPastJobLogs(
                                    pastCluster.cluster_name,
                                    job.job_id
                                  )
                                }
                              >
                                View Logs
                              </Button>
                            </Box>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  {/* Past Job Logs Modal */}
                  {selectedJobId &&
                    selectedClusterName === pastCluster.cluster_name && (
                      <Box sx={{ mt: 2 }}>
                        <Typography level="title-sm" sx={{ mb: 1 }}>
                          Past Job {selectedJobId} Logs
                        </Typography>
                        {logsLoading ? (
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              py: 2,
                            }}
                          >
                            <CircularProgress />
                          </Box>
                        ) : (
                          <Box sx={{ height: 400 }}>
                            <StreamingLogViewer
                              logs={selectedJobLogs}
                              isLoading={logsLoading}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                </Box>
              ))
            )}
          </>
        )}
      </Box>

      {/* Show fake jobs at the bottom - always visible when enabled */}
      {showFakeData && (
        <Box sx={{ mb: 4 }}>
          <Typography level="h4" sx={{ mb: 1 }}>
            sample-cluster
          </Typography>
          <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
            Sample data for demonstration purposes.
          </Typography>

          <Table sx={{ minWidth: 650, mb: 2 }}>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Job Name</th>
                <th>Status</th>
                <th>Resources</th>
                <th>Submitted At</th>
                <th>Started At</th>
                <th>Ended At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {generateFakeJobs().map((job) => (
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
                      {formatTimestamp(job.start_at)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatTimestamp(job.end_at)}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button size="sm" variant="outlined" disabled>
                        View Logs
                      </Button>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      )}

      {/* VSCode Info Modal */}
      <VSCodeInfoModal
        open={vscodeModal.open}
        onClose={() =>
          setVscodeModal({ open: false, clusterName: null, jobId: null })
        }
        clusterName={vscodeModal.clusterName || ""}
        jobId={vscodeModal.jobId || 0}
      />
    </Box>
  );
};

export default Jobs;
