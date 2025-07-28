import React, { useState } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  FormControl,
  FormLabel,
  Input,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/joy";
import { buildApiUrl } from "../utils/api";
import { Code } from "lucide-react";

type TaskType = "vscode";

interface InteractiveTaskModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string;
  taskType: TaskType;
  onTaskSubmitted?: () => void;
  isClusterLaunching?: boolean;
}

const InteractiveTaskModal: React.FC<InteractiveTaskModalProps> = ({
  open,
  onClose,
  clusterName,
  taskType,
  onTaskSubmitted,
  isClusterLaunching = false,
}) => {
  const [vscodePort, setVscodePort] = useState("8888");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setVscodePort("8888");
    setError(null);
    setSuccess(null);
  };

  const getTaskConfig = () => {
    return {
      command: `# Install code-server if not already installed
curl -fsSL https://code-server.dev/install.sh | bash
# Start code-server
code-server . --port ${vscodePort} --host 0.0.0.0 --auth none`,
      setup: "",
      title: "Launch VSCode Server",
      icon: <Code size={16} />,
      description: "Start a VSCode server with automatic port forwarding",
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("task_type", taskType);
      if (vscodePort) {
        formData.append("vscode_port", vscodePort);
      }

      const response = await fetch(
        buildApiUrl(`skypilot/interactive/${clusterName}/launch`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        let successMessage =
          data.message || "Interactive task launched successfully";

        // Add port forwarding information if available
        if (data.port_forward_info) {
          const pf = data.port_forward_info;
          successMessage += `\n\n🔗 Access URL: ${pf.access_url}`;
          successMessage += `\n📡 Local Port: ${pf.local_port} → Remote Port: ${pf.remote_port}`;
        }

        setSuccess(successMessage);
        resetForm();
        if (onTaskSubmitted) onTaskSubmitted();
        setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 4000); // Longer timeout to read port forwarding info
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to launch interactive task");
      }
    } catch (err) {
      setError("Error launching interactive task");
    } finally {
      setLoading(false);
    }
  };

  const config = getTaskConfig();

  const getConnectionInstructions = () => {
    return (
      <Alert color="primary" sx={{ mt: 2 }}>
        <Typography level="body-sm">
          <strong>Automatic Port Forwarding:</strong>
          <br />
          ✅ Port forwarding will be set up automatically by the backend
          <br />
          🔗 Once the task is running, you'll be able to access VSCode at the
          forwarded URL
          <br />
          📝 You can also use VSCode Remote-SSH extension:{" "}
          <code>ssh {clusterName}</code>
        </Typography>
      </Alert>
    );
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 600 }}>
        <ModalClose />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          {config.icon}
          <Typography level="h4">{config.title}</Typography>
        </Box>

        <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
          {config.description}
        </Typography>

        <form onSubmit={handleSubmit}>
          <Card variant="outlined">
            <CardContent>
              {isClusterLaunching && (
                <Alert color="warning" sx={{ mb: 2 }}>
                  Cluster is launching. Please wait until it is ready to submit
                  tasks.
                </Alert>
              )}

              {error && (
                <Alert color="danger" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert color="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>VSCode Server Port</FormLabel>
                  <Input
                    value={vscodePort}
                    onChange={(e) => setVscodePort(e.target.value)}
                    placeholder="8888"
                    disabled={isClusterLaunching}
                  />
                </FormControl>

                {/* Generated Command Preview */}
                <Card variant="soft" sx={{ p: 2 }}>
                  <Typography level="title-sm" sx={{ mb: 1 }}>
                    Generated Command
                  </Typography>
                  <Typography level="body-sm" sx={{ fontFamily: "monospace" }}>
                    {config.command}
                  </Typography>
                </Card>

                {/* Connection Instructions */}
                {getConnectionInstructions()}

                <Box
                  sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}
                >
                  <Button
                    variant="plain"
                    onClick={onClose}
                    disabled={loading || isClusterLaunching}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={loading || isClusterLaunching}
                    color="success"
                    startDecorator={config.icon}
                  >
                    Launch VSCode
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default InteractiveTaskModal;
