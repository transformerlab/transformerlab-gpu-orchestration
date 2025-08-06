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
  const [selectedJobLogs, setSelectedJobLogs] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedClusterName, setSelectedClusterName] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState<{
    [key: string]: boolean;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [jobsWithPortForward, setJobsWithPortForward] = useState<Set<string>>(
    new Set()
  );
  const [portForwardLoading, setPortForwardLoading] = useState<{
    [key: string]: boolean;
  }>({});

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
            buildApiUrl(`skypilot/jobs/${cluster.cluster_name}`),
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
      const response = await apiFetch(buildApiUrl("skypilot/past-jobs"), {
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
    try {
      const response = await apiFetch(
        buildApiUrl(`skypilot/past-jobs/${clusterName}/${jobId}/logs`),
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedJobLogs(data.logs || "No logs available");
        setSelectedJobId(jobId);
        setSelectedClusterName(clusterName);
      } else {
        setSelectedJobLogs("Failed to fetch logs");
        setSelectedJobId(jobId);
        setSelectedClusterName(clusterName);
      }
    } catch (err) {
      setSelectedJobLogs("Failed to fetch logs");
      setSelectedJobId(jobId);
      setSelectedClusterName(clusterName);
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
              buildApiUrl(`skypilot/jobs/${cluster.cluster_name}`),
              { credentials: "include" }
            );

            if (response.ok) {
              const data = await response.json();
              const currentJobs = data.jobs || [];

              // Check for jobs that just started running and need port forwarding
              currentJobs.forEach((job: any) => {
                const jobKey = `${cluster.cluster_name}_${job.job_id}`;

                if (
                  job.status === "JobStatus.RUNNING" &&
                  job.job_name &&
                  !jobsWithPortForward.has(jobKey)
                ) {
                  // Check if this is a Jupyter job (multiple patterns)
                  if (
                    job.job_name.includes("-jupyter-") ||
                    job.job_name.toLowerCase().includes("jupyter") ||
                    job.job_name.startsWith("jupyter")
                  ) {
                    const portMatch = job.job_name.match(/port(\d+)/);
                    const port = portMatch ? parseInt(portMatch[1]) : 8888;
                    console.log(
                      `Setting up port forwarding for Jupyter job ${job.job_id} on port ${port}`
                    );
                    setupJobPortForward(
                      cluster.cluster_name,
                      job.job_id,
                      "jupyter",
                      port
                    );
                    setJobsWithPortForward((prev) => new Set(prev).add(jobKey));
                  }
                  // Check if this is a VSCode job
                  else if (
                    job.job_name.includes("-vscode-") ||
                    job.job_name.toLowerCase().includes("vscode") ||
                    job.job_name.startsWith("vscode")
                  ) {
                    const portMatch = job.job_name.match(/port(\d+)/);
                    const port = portMatch ? parseInt(portMatch[1]) : 8888;
                    console.log(
                      `Setting up port forwarding for VSCode job ${job.job_id} on port ${port}`
                    );
                    setupJobPortForward(
                      cluster.cluster_name,
                      job.job_id,
                      "vscode",
                      undefined,
                      port
                    );
                    setJobsWithPortForward((prev) => new Set(prev).add(jobKey));
                  }
                }
              });

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
  }, [clustersWithJobs, jobsWithPortForward]);

  const fetchJobLogs = async (clusterName: string, jobId: number) => {
    setLogsLoading(true);
    setSelectedJobId(jobId);
    setSelectedClusterName(clusterName);
    try {
      const response = await apiFetch(
        buildApiUrl(
          `skypilot/jobs/${clusterName}/${jobId}/logs?tail_lines=100`
        ),
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedJobLogs(data.logs || "");
      } else {
        setSelectedJobLogs("Failed to fetch logs");
      }
    } catch (err) {
      setSelectedJobLogs("Error fetching logs");
    } finally {
      setLogsLoading(false);
    }
  };

  // Cancel a job
  const cancelJob = async (clusterName: string, jobId: number) => {
    const cancelKey = `${clusterName}_${jobId}`;
    try {
      setCancelLoading((prev) => ({ ...prev, [cancelKey]: true }));
      setError(null);

      const response = await apiFetch(
        buildApiUrl(`skypilot/jobs/${clusterName}/${jobId}/cancel`),
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

  // Setup port forwarding for a job
  const setupJobPortForward = async (
    clusterName: string,
    jobId: number,
    jobType: string,
    jupyterPort?: number,
    vscodePort?: number
  ) => {
    const jobKey = `${clusterName}_${jobId}`;
    console.log(
      `Setting up port forwarding for ${jobType} job ${jobId} on cluster ${clusterName}`
    );

    setPortForwardLoading((prev) => ({ ...prev, [jobKey]: true }));

    try {
      const formData = new FormData();
      formData.append("job_type", jobType);
      if (jupyterPort) formData.append("jupyter_port", jupyterPort.toString());
      if (vscodePort) formData.append("vscode_port", vscodePort.toString());

      const response = await apiFetch(
        buildApiUrl(`skypilot/jobs/${clusterName}/${jobId}/setup-port-forward`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Port forwarding setup successfully:", data);
        setError(null);
        // Mark this job as having port forwarding set up
        setJobsWithPortForward((prev) => new Set(prev).add(jobKey));
      } else {
        console.error("Failed to setup port forwarding for job:", jobId);
        const errorData = await response.json();
        setError(
          `Failed to setup port forwarding: ${
            errorData.detail || "Unknown error"
          }`
        );
      }
    } catch (err) {
      console.error("Error setting up port forwarding for job:", err);
      setError("Error setting up port forwarding");
    } finally {
      setPortForwardLoading((prev) => ({ ...prev, [jobKey]: false }));
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

  if (myClusters.length === 0) {
    if (showFakeData) {
      // Show fake jobs when no real clusters are available
      const fakeJobs = generateFakeJobs();
      const fakeCluster = {
        cluster_name: "sample-cluster",
        status: "UP",
        resources_str: "2x NVIDIA A100, 32 vCPUs",
        launched_at: Math.floor(Date.now() / 1000) - 3600,
        last_use: "2 hours ago",
        autostop: 60,
        to_down: false,
        jobs: fakeJobs,
        jobsLoading: false,
      };

      return (
        <Box>
          <Typography level="h3" sx={{ mb: 3 }}>
            Sample Jobs Data
          </Typography>
          <Typography level="body-sm" color="neutral" sx={{ mb: 3 }}>
            This is sample data. Launch real clusters from the Interactive
            Development Environment to see actual jobs.
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              {fakeCluster.cluster_name}
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
                {fakeCluster.jobs.map((job) => (
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
        </Box>
      );
    }

    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography level="h4" color="neutral">
          No active clusters found
        </Typography>
        <Typography level="body-md" color="neutral" sx={{ mt: 1 }}>
          Launch a cluster from the Interactive Development Environment to see
          jobs here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography level="h3" sx={{ mb: 3 }}>
        Dedicated Machines
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
            <Table variant="outlined" sx={{ minWidth: 650, mb: 2 }}>
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
                        {/* Show port forward button for Jupyter jobs */}
                        {job.status === "JobStatus.RUNNING" &&
                          job.job_name &&
                          (job.job_name.includes("-jupyter-") ||
                            job.job_name.toLowerCase().includes("jupyter") ||
                            job.job_name.startsWith("jupyter")) &&
                          (() => {
                            const jobKey = `${cluster.cluster_name}_${job.job_id}`;
                            const hasPortForward =
                              jobsWithPortForward.has(jobKey);
                            const isLoading = portForwardLoading[jobKey];

                            if (hasPortForward) {
                              const portMatch = job.job_name.match(/port(\d+)/);
                              const port = portMatch
                                ? parseInt(portMatch[1])
                                : 8888;
                              const localhostUrl = `http://localhost:${port}`;

                              return (
                                <Button
                                  size="sm"
                                  variant="soft"
                                  color="success"
                                  onClick={() => {
                                    window.open(localhostUrl, "_blank");
                                  }}
                                >
                                  ✅ Localhost Access Active
                                </Button>
                              );
                            } else {
                              return (
                                <Button
                                  size="sm"
                                  variant="outlined"
                                  color="primary"
                                  loading={isLoading}
                                  disabled={isLoading}
                                  onClick={() => {
                                    const portMatch =
                                      job.job_name.match(/port(\d+)/);
                                    const port = portMatch
                                      ? parseInt(portMatch[1])
                                      : 8888;
                                    setupJobPortForward(
                                      cluster.cluster_name,
                                      job.job_id,
                                      "jupyter",
                                      port
                                    );
                                  }}
                                >
                                  Access on Localhost
                                </Button>
                              );
                            }
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
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Textarea
                  value={selectedJobLogs}
                  readOnly
                  minRows={5}
                  maxRows={10}
                  sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}
                />
              )}
            </Box>
          )}
        </Box>
      ))}

      {/* Show fake jobs alongside real jobs if enabled */}
      {showFakeData && (
        <>
          <Box sx={{ mb: 3, mt: 4 }}>
            <Typography level="h3" sx={{ mb: 2 }}>
              Sample Jobs Data
            </Typography>
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              Additional sample jobs for demonstration purposes.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              sample-cluster
            </Typography>

            <Table variant="outlined" sx={{ minWidth: 650, mb: 2 }}>
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
        </>
      )}

      {/* Past Jobs Section */}
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
                No past jobs found. Jobs from torn down clusters will appear
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

                  <Table variant="outlined" sx={{ minWidth: 650, mb: 2 }}>
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
                          <Textarea
                            value={selectedJobLogs}
                            readOnly
                            minRows={5}
                            maxRows={10}
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                            }}
                          />
                        )}
                      </Box>
                    )}
                </Box>
              ))
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default Jobs;
