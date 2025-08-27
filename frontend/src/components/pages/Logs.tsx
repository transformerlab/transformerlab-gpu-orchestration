import React, { useState } from "react";
import {
  Box,
  Card,
  Typography,
  Table,
  Chip,
  IconButton,
  Button,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  Stack,
  Alert,
  CircularProgress,
} from "@mui/joy";
import {
  Play,
  X,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import useSWR from "swr";

interface SkyPilotRequest {
  id: string;
  user_id: string;
  organization_id: string;
  task_type: string;
  request_id: string;
  cluster_name: string | null;
  status: string;
  result: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const Logs: React.FC = () => {
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] =
    useState<SkyPilotRequest | null>(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Use SWR for fetching requests with auto-refresh
  const {
    data: requestsData,
    error,
    mutate,
  } = useSWR(
    "instances/requests",
    async () => {
      const response = await apiFetch(buildApiUrl("instances/requests"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }
      const data = await response.json();
      return data.requests || [];
    },
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
    }
  );

  const requests = requestsData || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} color="green" />;
      case "failed":
        return <XCircle size={16} color="red" />;
      case "cancelled":
        return <X size={16} color="orange" />;
      case "pending":
        return <Clock size={16} color="blue" />;
      default:
        return <AlertCircle size={16} color="gray" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "failed":
        return "danger";
      case "cancelled":
        return "warning";
      case "pending":
        return "primary";
      default:
        return "neutral";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const openLogs = async (request: SkyPilotRequest) => {
    setSelectedRequest(request);
    setLogs([]);
    setLogsModalOpen(true);
    setLogsLoading(true);

    try {
      // Close any existing EventSource
      if (eventSource) {
        eventSource.close();
      }

      // Create new EventSource for real-time logs
      const url = buildApiUrl(`instances/requests/${request.request_id}/logs`);
      const newEventSource = new EventSource(url, { withCredentials: true });
      setEventSource(newEventSource);

      newEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.log_line) {
            setLogs((prev) => [...prev, data.log_line]);
          } else if (data.status === "completed") {
            setLogsLoading(false);
            newEventSource.close();
            // Refresh requests list to update status
            mutate();
          } else if (data.status === "failed") {
            setLogs((prev) => [...prev, `Error: ${data.error}`]);
            setLogsLoading(false);
            newEventSource.close();
            // Refresh requests list to update status
            mutate();
          }
        } catch (err) {
          console.error("Error parsing SSE data:", err);
        }
      };

      newEventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        setLogs((prev) => [...prev, "Error: Failed to connect to log stream"]);
        setLogsLoading(false);
        newEventSource.close();
      };
    } catch (err) {
      setLogs(["Error: Failed to open log stream"]);
      setLogsLoading(false);
    }
  };

  const closeLogs = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setLogsModalOpen(false);
    setSelectedRequest(null);
    setLogs([]);
    setLogsLoading(false);
  };

  const cancelRequest = async (requestId: string) => {
    try {
      const response = await apiFetch(
        buildApiUrl(`instances/requests/${requestId}/cancel`),
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to cancel request");
      }

      // Refresh the requests list using SWR
      mutate();
    } catch (err) {
      console.error("Error cancelling request:", err);
    }
  };

  if (!requestsData && !error) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography level="h2">SkyPilot Request Logs</Typography>
        <Button
          startDecorator={<RefreshCw size={16} />}
          onClick={() => mutate()}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Task Type</th>
              <th>Cluster</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  <Typography level="body-sm" color="neutral">
                    No requests found
                  </Typography>
                </td>
              </tr>
            ) : (
              requests.map((request: SkyPilotRequest) => (
                <tr key={request.id}>
                  <td>
                    <Typography
                      level="body-sm"
                      sx={{ textTransform: "capitalize" }}
                    >
                      {request.task_type}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {request.cluster_name || "N/A"}
                    </Typography>
                  </td>
                  <td>
                    <Chip
                      startDecorator={getStatusIcon(request.status)}
                      color={getStatusColor(request.status)}
                      size="sm"
                      variant="soft"
                    >
                      {request.status}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDate(request.created_at)}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {request.completed_at
                        ? formatDate(request.completed_at)
                        : "—"}
                    </Typography>
                  </td>
                  <td>
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        size="sm"
                        onClick={() => openLogs(request as SkyPilotRequest)}
                      >
                        <Play size={16} />
                      </IconButton>
                      {request.status === "pending" && (
                        <IconButton
                          size="sm"
                          color="danger"
                          onClick={() => cancelRequest(request.request_id)}
                        >
                          <X size={16} />
                        </IconButton>
                      )}
                    </Stack>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Logs Modal */}
      <Modal open={logsModalOpen} onClose={closeLogs}>
        <ModalDialog size="lg" sx={{ maxWidth: "90vw", maxHeight: "90vh" }}>
          <ModalClose />
          <DialogTitle>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography level="h4">
                Logs for {selectedRequest?.task_type} -{" "}
                {selectedRequest?.cluster_name || "N/A"}
              </Typography>
              {logsLoading && <CircularProgress size="sm" />}
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                backgroundColor: "background.level1",
                borderRadius: "sm",
                p: 2,
                height: "60vh",
                overflow: "auto",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {logs.length === 0 && !logsLoading ? (
                <Typography level="body-sm" color="neutral">
                  No logs available
                </Typography>
              ) : (
                logs.map((log, index) => (
                  <Box key={index} sx={{ mb: 0.5 }}>
                    {log}
                  </Box>
                ))
              )}
              {logsLoading && logs.length === 0 && (
                <Typography level="body-sm" color="neutral">
                  Loading logs...
                </Typography>
              )}
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default Logs;
