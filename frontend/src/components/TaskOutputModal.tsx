import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  List,
  ListItem,
  ListDivider,
  Chip,
  Textarea,
  CircularProgress,
  Alert,
} from "@mui/joy";
import { buildApiUrl } from "../utils/api";
import { Check } from "lucide-react";

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

interface TaskOutputModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string;
  isClusterLaunching?: boolean;
}

const TaskOutputModal: React.FC<TaskOutputModalProps> = ({
  open,
  onClose,
  clusterName,
  isClusterLaunching = false,
}) => {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJobLogs, setSelectedJobLogs] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
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
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, [clusterName]);

  const fetchJobLogs = async (jobId: number) => {
    setLogsLoading(true);
    setSelectedJobId(jobId);
    try {
      const response = await fetch(
        buildApiUrl(
          `skypilot/jobs/${clusterName}/${jobId}/logs?tail_lines=100`
        ),
        {
          credentials: "include",
        }
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

  useEffect(() => {
    if (open && clusterName) {
      fetchJobs();
    }
  }, [open, clusterName, fetchJobs]);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "jobstatus.succeeded":
        return "success";
      case "jobstatus.running":
        return "primary";
      case "jobstatus.failed":
      case "jobstatus.failed_driver":
      case "jobstatus.failed_setup":
        return "danger";
      case "jobstatus.cancelled":
        return "neutral";
      case "jobstatus.pending":
      case "jobstatus.setting_up":
        return "warning";
      default:
        return "neutral";
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        size="lg"
        sx={{ maxWidth: "90vw", maxHeight: "90vh", overflow: "hidden" }}
      >
        <ModalClose />
        <Typography level="h4" component="h2">
          Task Outputs - {clusterName}
        </Typography>

        <Box sx={{ display: "flex", gap: 2, height: "70vh" }}>
          {/* Jobs List */}
          <Card sx={{ flex: 1, overflow: "hidden" }}>
            <CardContent>
              {isClusterLaunching && (
                <Alert color="warning" sx={{ mb: 2 }}>
                  Cluster is launching. Please wait until it is ready to view
                  jobs.
                </Alert>
              )}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography level="title-md">Jobs</Typography>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={fetchJobs}
                  loading={loading}
                  disabled={isClusterLaunching}
                >
                  Refresh
                </Button>
              </Box>

              {error && (
                <Alert color="danger" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <List sx={{ maxHeight: "60vh", overflow: "auto" }}>
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
                    jobs.map((job, index) => (
                      <React.Fragment key={job.job_id}>
                        {index > 0 && <ListDivider />}
                        <ListItem>
                          {isClusterLaunching ? (
                            <Box
                              sx={{
                                width: "100%",
                                opacity: 0.5,
                                pointerEvents: "none",
                              }}
                            >
                              {/* All content below is visually disabled */}
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
                                {(() => {
                                  const status = job.status.toUpperCase();
                                  if (status === "JOBSTATUS.PENDING") {
                                    return (
                                      <Chip
                                        size="sm"
                                        color="warning"
                                        variant="soft"
                                      >
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                          }}
                                        >
                                          <CircularProgress size="sm" />
                                          Pending
                                        </Box>
                                      </Chip>
                                    );
                                  } else if (status === "JOBSTATUS.RUNNING") {
                                    return (
                                      <Chip
                                        size="sm"
                                        color="primary"
                                        variant="soft"
                                      >
                                        Running
                                      </Chip>
                                    );
                                  } else if (status === "JOBSTATUS.SUCCEEDED") {
                                    return (
                                      <Chip
                                        size="sm"
                                        color="success"
                                        variant="soft"
                                      >
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                          }}
                                        >
                                          <Check
                                            size={16}
                                            style={{ color: "#22c55e" }}
                                          />
                                          Succeeded
                                        </Box>
                                      </Chip>
                                    );
                                  } else {
                                    return (
                                      <Chip
                                        size="sm"
                                        color={getStatusColor(job.status)}
                                        variant="soft"
                                      >
                                        {job.status.charAt(0).toUpperCase() +
                                          job.status
                                            .slice(1)
                                            .replace(/_/g, " ")}
                                      </Chip>
                                    );
                                  }
                                })()}
                              </Box>
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary", mb: 1 }}
                              >
                                Job ID: {job.job_id} | User: {job.username}
                              </Typography>
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary", mb: 1 }}
                              >
                                Submitted: {formatTimestamp(job.submitted_at)}
                              </Typography>
                              {job.start_at && (
                                <Typography
                                  level="body-xs"
                                  sx={{ color: "text.secondary", mb: 1 }}
                                >
                                  Started: {formatTimestamp(job.start_at)}
                                </Typography>
                              )}
                              {job.end_at && (
                                <Typography
                                  level="body-xs"
                                  sx={{ color: "text.secondary", mb: 1 }}
                                >
                                  Ended: {formatTimestamp(job.end_at)}
                                </Typography>
                              )}
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary", mb: 1 }}
                              >
                                Resources: {job.resources}
                              </Typography>
                              <Button
                                size="sm"
                                variant="outlined"
                                sx={{ mt: 1 }}
                                disabled
                              >
                                View Logs
                              </Button>
                            </Box>
                          ) : (
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
                                {(() => {
                                  const status = job.status.toUpperCase();
                                  if (status === "JOBSTATUS.PENDING") {
                                    return (
                                      <Chip
                                        size="sm"
                                        color="warning"
                                        variant="soft"
                                      >
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                          }}
                                        >
                                          <CircularProgress size="sm" />
                                          Pending
                                        </Box>
                                      </Chip>
                                    );
                                  } else if (status === "JOBSTATUS.RUNNING") {
                                    return (
                                      <Chip
                                        size="sm"
                                        color="primary"
                                        variant="soft"
                                      >
                                        Running
                                      </Chip>
                                    );
                                  } else if (status === "JOBSTATUS.SUCCEEDED") {
                                    return (
                                      <Chip
                                        size="sm"
                                        color="success"
                                        variant="soft"
                                      >
                                        <Box
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                          }}
                                        >
                                          <Check
                                            size={16}
                                            style={{ color: "#22c55e" }}
                                          />
                                          Succeeded
                                        </Box>
                                      </Chip>
                                    );
                                  } else {
                                    return (
                                      <Chip
                                        size="sm"
                                        color={getStatusColor(job.status)}
                                        variant="soft"
                                      >
                                        {job.status.charAt(0).toUpperCase() +
                                          job.status
                                            .slice(1)
                                            .replace(/_/g, " ")}
                                      </Chip>
                                    );
                                  }
                                })()}
                              </Box>
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary", mb: 1 }}
                              >
                                Job ID: {job.job_id} | User: {job.username}
                              </Typography>
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary", mb: 1 }}
                              >
                                Submitted: {formatTimestamp(job.submitted_at)}
                              </Typography>
                              {job.start_at && (
                                <Typography
                                  level="body-xs"
                                  sx={{ color: "text.secondary", mb: 1 }}
                                >
                                  Started: {formatTimestamp(job.start_at)}
                                </Typography>
                              )}
                              {job.end_at && (
                                <Typography
                                  level="body-xs"
                                  sx={{ color: "text.secondary", mb: 1 }}
                                >
                                  Ended: {formatTimestamp(job.end_at)}
                                </Typography>
                              )}
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary", mb: 1 }}
                              >
                                Resources: {job.resources}
                              </Typography>
                              <Button
                                size="sm"
                                variant="outlined"
                                onClick={() => fetchJobLogs(job.job_id)}
                                sx={{ mt: 1 }}
                              >
                                View Logs
                              </Button>
                            </Box>
                          )}
                        </ListItem>
                      </React.Fragment>
                    ))
                  )}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Logs Display */}
          <Card sx={{ flex: 1, overflow: "hidden" }}>
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2 }}>
                Logs {selectedJobId !== null && `(Job ${selectedJobId})`}
              </Typography>

              {logsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Textarea
                  value={selectedJobLogs || "Select a job to view its logs"}
                  readOnly
                  minRows={20}
                  maxRows={20}
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
            </CardContent>
          </Card>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default TaskOutputModal;
