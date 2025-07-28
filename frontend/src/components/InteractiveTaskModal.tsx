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
import { Code, BookOpen } from "lucide-react";

type TaskType = "vscode" | "jupyter";

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
  const [jupyterPort, setJupyterPort] = useState("8888");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setVscodePort("8888");
    setJupyterPort("8888");
    setError(null);
    setSuccess(null);
  };

  const getTaskConfig = () => {
    if (taskType === "jupyter") {
      return {
        command: `pip install jupyter
# Create jupyter config to allow external connections
jupyter notebook --generate-config
echo "c.NotebookApp.ip = '0.0.0.0'" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.allow_root = True" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.open_browser = False" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.password = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.token = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "Jupyter notebook will be available at http://localhost:${jupyterPort}"
jupyter notebook --port ${jupyterPort} --ip=0.0.0.0 --NotebookApp.token='' --NotebookApp.password='' --allow-root --no-browser`,
        title: "Launch Jupyter Notebook",
        icon: <BookOpen size={16} />,
        description:
          "Start a Jupyter notebook server with automatic port forwarding",
      };
    } else {
      return {
        command: `# Install code-server if not already installed
curl -fsSL https://code-server.dev/install.sh | bash
# Start code-server
code-server . --port ${vscodePort} --host 0.0.0.0 --auth none`,
        title: "Launch VSCode Server",
        icon: <Code size={16} />,
        description: "Start a VSCode server with automatic port forwarding",
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (taskType === "vscode") {
        // VSCode uses the interactive task endpoint
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

          // Add port forwarding information for VSCode
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
          }, 4000);
        } else {
          const errorData = await response.json();
          setError(errorData.detail || "Failed to launch interactive task");
        }
      } else if (taskType === "jupyter") {
        // Jupyter uses the job submission endpoint
        const formData = new FormData();
        formData.append(
          "command",
          `pip install jupyter
# Create jupyter config to allow external connections
jupyter notebook --generate-config
echo "c.NotebookApp.ip = '0.0.0.0'" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.allow_root = True" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.open_browser = False" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.password = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.token = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "Jupyter notebook will be available at http://localhost:${jupyterPort}"
jupyter notebook --port ${jupyterPort} --ip=0.0.0.0 --NotebookApp.token='' --NotebookApp.password='' --allow-root --no-browser`
        );
        formData.append(
          "job_name",
          `jupyter-${clusterName}-port${jupyterPort}`
        );
        formData.append("job_type", "jupyter");
        formData.append("jupyter_port", jupyterPort);

        const response = await fetch(
          buildApiUrl(`skypilot/jobs/${clusterName}/submit`),
          {
            method: "POST",
            credentials: "include",
            body: formData,
          }
        );

        if (response.ok) {
          const data = await response.json();
          let successMessage =
            data.message || "Jupyter job submitted successfully";

          if (data.request_id) {
            successMessage += `\n\n📋 Job ID: ${data.request_id}`;
            successMessage += `\n🔗 Jupyter will be available at http://localhost:${jupyterPort}`;
            successMessage += `\n📝 Check the Jobs tab to monitor the Jupyter job status`;
            successMessage += `\n✅ Port forwarding will be set up automatically when the job starts running`;
          }

          setSuccess(successMessage);
          resetForm();
          if (onTaskSubmitted) onTaskSubmitted();
          setTimeout(() => {
            setSuccess(null);
            onClose();
          }, 4000);
        } else {
          const errorData = await response.json();
          setError(errorData.detail || "Failed to submit Jupyter job");
        }
      }
    } catch (err) {
      setError("Error launching task");
    } finally {
      setLoading(false);
    }
  };

  const config = getTaskConfig();

  const getConnectionInstructions = () => {
    if (taskType === "jupyter") {
      return (
        <Alert color="primary" sx={{ mt: 2 }}>
          <Typography level="body-sm">
            <strong>Job Submission:</strong>
            <br />
            ✅ Jupyter will be submitted as a job to the cluster
            <br />
            🔗 Once the job starts running, port forwarding will be set up
            automatically
            <br />
            📝 Check the Jobs tab to monitor the Jupyter job status
            <br />
            ✅ You'll see a "Setup Port Forward" button when the job is running
            <br />
            🔗 Manual access:{" "}
            <code>
              ssh -L {jupyterPort}:localhost:{jupyterPort} {clusterName}
            </code>
          </Typography>
        </Alert>
      );
    } else {
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
    }
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
                {taskType === "vscode" && (
                  <FormControl>
                    <FormLabel>VSCode Server Port</FormLabel>
                    <Input
                      value={vscodePort}
                      onChange={(e) => setVscodePort(e.target.value)}
                      placeholder="8888"
                      disabled={isClusterLaunching}
                    />
                  </FormControl>
                )}

                {taskType === "jupyter" && (
                  <FormControl>
                    <FormLabel>Jupyter Notebook Port</FormLabel>
                    <Input
                      value={jupyterPort}
                      onChange={(e) => setJupyterPort(e.target.value)}
                      placeholder="8888"
                      disabled={isClusterLaunching}
                    />
                  </FormControl>
                )}

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
                    Launch {taskType === "jupyter" ? "Jupyter" : "VSCode"}
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
