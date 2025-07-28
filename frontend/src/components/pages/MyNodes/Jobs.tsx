import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Table,
  CircularProgress,
  Chip,
  Textarea,
} from "@mui/joy";
import { buildApiUrl } from "../../../utils/api";

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

interface JobsProps {
  skypilotLoading: boolean;
  myClusters: Cluster[];
}

const Jobs: React.FC<JobsProps> = ({ skypilotLoading, myClusters }) => {
  const [clustersWithJobs, setClustersWithJobs] = useState<ClusterWithJobs[]>(
    []
  );
  const [selectedJobLogs, setSelectedJobLogs] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

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
          const response = await fetch(
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

  const fetchJobLogs = async (clusterName: string, jobId: number) => {
    setLogsLoading(true);
    setSelectedJobId(jobId);
    try {
      const response = await fetch(
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

  if (skypilotLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (myClusters.length === 0) {
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
        Cloud Node Pools
      </Typography>

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
                      <Typography
                        level="body-sm"
                        sx={{
                          cursor: "pointer",
                          color: "primary.500",
                          textDecoration: "underline",
                        }}
                        onClick={() =>
                          fetchJobLogs(cluster.cluster_name, job.job_id)
                        }
                      >
                        View Logs
                      </Typography>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {/* Job Logs Modal */}
          {selectedJobId && (
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
    </Box>
  );
};

export default Jobs;
