import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Sheet,
  Typography,
  Box,
  Button,
  CircularProgress,
  Stack,
  Card,
} from "@mui/joy";
import { useNotification } from "./NotificationSystem";
import { apiFetch, buildApiUrl } from "../utils/api";

interface CLISession {
  client_ip: string;
  hostname: string;
  username: string;
  created_at: string;
  error?: string; // Optional error message
}

const CLIAuthorizePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [session, setSession] = useState<CLISession | null>(null);
  const { addNotification } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        // Fetch session details - Make sure backend has this route
        console.log(`Fetching session with ID: ${sessionId}`);
        const response = await apiFetch(
          buildApiUrl(`auth/cli/session/${sessionId}`),
          {
            credentials: "include",
          }
        );
        console.log(`Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error response: ${errorText}`);
          throw new Error(
            `Session not found or expired: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        console.log("Session data received:", data);
        setSession(data);
      } catch (error) {
        console.error("Error fetching session:", error);
        addNotification({
          type: "danger",
          message: `CLI authorization session is invalid or has expired. ${
            error instanceof Error ? error.message : ""
          }`,
        });
        // Don't navigate away immediately so we can see the error
        // navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, addNotification, navigate]);

  const handleAuthorize = async (approve: boolean) => {
    setAuthorizing(true);
    try {
      const response = await apiFetch(buildApiUrl("auth/cli/authorize"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          authorized: approve,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to authorize CLI");
      }

      addNotification({
        type: approve ? "success" : "warning",
        message: approve
          ? "CLI access has been authorized successfully."
          : "CLI access request has been rejected.",
      });

      // Redirect back to dashboard
      navigate("/dashboard");
    } catch (error) {
      addNotification({
        type: "danger",
        message: "Failed to process CLI authorization request.",
      });
    } finally {
      setAuthorizing(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        p: 2,
      }}
    >
      <Sheet
        sx={{
          width: "100%",
          maxWidth: 500,
          p: 4,
        }}
      >
        <Typography level="h4" component="h1" mb={2}>
          Authorize CLI Access
        </Typography>

        {session ? (
          <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
            <Typography level="body-md" mb={1}>
              A CLI application is requesting access to your account:
            </Typography>
            <Typography level="body-sm">
              <strong>User:</strong> {session.username}
            </Typography>
            <Typography level="body-sm">
              <strong>Device:</strong> {session.hostname}
            </Typography>
            <Typography level="body-sm">
              <strong>IP Address:</strong> {session.client_ip}
            </Typography>
            <Typography level="body-sm">
              <strong>Requested:</strong>{" "}
              {new Date(session.created_at).toLocaleString()}
            </Typography>
            {session.error && (
              <Typography color="danger" mt={2}>
                Error: {session.error}
              </Typography>
            )}
          </Card>
        ) : (
          <Typography color="danger" mb={3}>
            Session information not available
          </Typography>
        )}

        <Typography level="body-sm" mb={3}>
          If you recognize this request and want to allow CLI access from this
          device, click 'Authorize'. Otherwise, click 'Deny'.
        </Typography>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            variant="outlined"
            color="neutral"
            disabled={authorizing || !session}
            onClick={() => handleAuthorize(false)}
          >
            Deny
          </Button>
          <Button
            variant="solid"
            color="primary"
            disabled={authorizing || !session}
            loading={authorizing}
            onClick={() => handleAuthorize(true)}
          >
            Authorize
          </Button>
        </Stack>
      </Sheet>
    </Box>
  );
};

export default CLIAuthorizePage;
