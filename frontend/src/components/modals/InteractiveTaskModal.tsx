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
import { buildApiUrl, apiFetch } from "../../utils/api";
import { Code, BookOpen } from "lucide-react";
import { useNotification } from "../NotificationSystem";

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
  const { addNotification } = useNotification();

  const resetForm = () => {
    setVscodePort("8888");
    setJupyterPort("8888");
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
        command: `sudo apt update && sudo apt install software-properties-common apt-transport-https wget -y && wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg && sudo install -o root -g root -m 644 packages.microsoft.gpg /usr/share/keyrings/ && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list && sudo apt update && sudo apt install code -y && code tunnel --disable-telemetry`,
        title: "Launch VSCode Tunnel",
        icon: <Code size={16} />,
        description: "Start a VSCode tunnel for secure remote access",
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (taskType === "vscode") {
        // VSCode now uses the job submission endpoint like Jupyter
        const formData = new FormData();
        formData.append(
          "command",
          `sudo apt update && sudo apt install software-properties-common apt-transport-https wget -y && wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg && sudo install -o root -g root -m 644 packages.microsoft.gpg /usr/share/keyrings/ && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list && sudo apt update && sudo apt install code -y && code tunnel --disable-telemetry`
        );
        formData.append("job_name", `vscode-${clusterName}`);
        formData.append("job_type", "vscode");
        formData.append("vscode_port", vscodePort);

        const response = await apiFetch(
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
            data.message || "VSCode tunnel job submitted successfully";

          if (data.request_id) {
            successMessage += `\n\n📋 Job ID: ${data.request_id}`;
            successMessage += `\n🔗 VSCode tunnel will be set up automatically`;
            successMessage += `\n📝 Check the Jobs tab to monitor the VSCode tunnel status`;
            successMessage += `\n✅ Connection info will be available when the tunnel is ready`;
          }

          addNotification({
            type: "success",
            message: successMessage,
            duration: 8000,
          });
          resetForm();
          if (onTaskSubmitted) onTaskSubmitted();
          setTimeout(() => {
            onClose();
          }, 4000);
        } else {
          const errorData = await response.json();
          addNotification({
            type: "danger",
            message: errorData.detail || "Failed to submit VSCode job",
          });
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
        formData.append("job_name", `jupyter-${clusterName}`);
        formData.append("job_type", "jupyter");
        formData.append("jupyter_port", jupyterPort);

        const response = await apiFetch(
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

          addNotification({
            type: "success",
            message: successMessage,
            duration: 8000,
          });
          resetForm();
          if (onTaskSubmitted) onTaskSubmitted();
          setTimeout(() => {
            onClose();
          }, 4000);
        } else {
          const errorData = await response.json();
          addNotification({
            type: "danger",
            message: errorData.detail || "Failed to submit Jupyter job",
          });
        }
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error launching task",
      });
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
            <strong>Job Submission:</strong>
            <br />
            ✅ VSCode will be submitted as a job to the cluster
            <br />
            🔗 Once the job starts running, port forwarding will be set up
            automatically
            <br />
            📝 Check the Jobs tab to monitor the VSCode job status
            <br />
            ✅ You'll see a "Setup Port Forward" button when the job is running
            <br />
            🔗 Manual access:{" "}
            <code>
              ssh -L {vscodePort}:localhost:{vscodePort} {clusterName}
            </code>
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
