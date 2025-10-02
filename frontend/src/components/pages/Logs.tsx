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
import { Play, RefreshCw, Clock } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import useSWR from "swr";
import StreamingLogViewer from "../widgets/StreamingLogViewer";
import PageWithTitle from "./templates/PageWithTitle";

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
  // Hide TERMINATE requests from the dashboard/logs page
  const displayRequests = requests.filter(
    (r: SkyPilotRequest) => (r.task_type || "").toLowerCase() !== "terminate"
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTaskTypeColor = (taskType: string) => {
    switch (taskType.toLowerCase()) {
      case "launch":
        return "success";
      case "terminate":
        return "danger";
      default:
        return "neutral";
    }
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
    <PageWithTitle
      title="Request Logs"
      button={
        <Button
          startDecorator={<RefreshCw size={16} />}
          onClick={() => mutate()}
          variant="outlined"
        >
          Refresh
        </Button>
      }
    >
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
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: "center", padding: "2rem" }}
                >
                  <Typography level="body-sm" color="neutral">
                    No requests found
                  </Typography>
                </td>
              </tr>
            ) : (
              displayRequests.map((request: SkyPilotRequest) => (
                <tr key={request.id}>
                  <td>
                    <Chip
                      color={getTaskTypeColor(request.task_type)}
                      size="sm"
                      variant="soft"
                      sx={{ textTransform: "capitalize" }}
                    >
                      {request.task_type}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {request.cluster_name || "N/A"}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm">
                      {formatDate(request.created_at)}
                    </Typography>
                  </td>
                  <td>
                    <IconButton
                      size="sm"
                      onClick={() => openLogs(request as SkyPilotRequest)}
                    >
                      <Play size={16} />
                    </IconButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Logs Modal */}
      <Modal open={logsModalOpen} onClose={closeLogs}>
        <ModalDialog
          size="lg"
          sx={{
            maxWidth: "95vw",
            maxHeight: "95vh",
            width: "90vw",
            height: "85vh",
          }}
        >
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
            <Box sx={{ height: "70vh" }}>
              <StreamingLogViewer logs={logs} isLoading={logsLoading} />
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Logs;
