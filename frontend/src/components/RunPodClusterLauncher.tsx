import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Stack,
  Chip,
  Modal,
  ModalDialog,
  ModalClose,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Alert,
  CircularProgress,
} from "@mui/joy";
import { Rocket, Zap } from "lucide-react";
import { buildApiUrl, apiFetch } from "../utils/api";

interface RunPodClusterLauncherProps {
  open: boolean;
  onClose: () => void;
  onClusterLaunched?: (clusterName: string) => void;
}

interface LaunchClusterResponse {
  request_id: string;
  cluster_name: string;
  message: string;
}

const RunPodClusterLauncher: React.FC<RunPodClusterLauncherProps> = ({
  open,
  onClose,
  onClusterLaunched,
}) => {
  const [clusterName, setClusterName] = useState("");
  const [command, setCommand] = useState("echo 'Hello RunPod'");
  const [setup, setSetup] = useState("");
  const [selectedGpuType, setSelectedGpuType] = useState("");
  const [availableGpuTypes, setAvailableGpuTypes] = useState<string[]>([]);
  const [runpodConfig, setRunpodConfig] = useState({
    api_key: "",
    allowed_gpu_types: [] as string[],
    is_configured: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchRunPodConfig();
      fetchAvailableGpuTypes();
    }
  }, [open]);

  const fetchRunPodConfig = async () => {
    try {
      const response = await apiFetch(buildApiUrl("skypilot/runpod/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRunpodConfig(data);
        // Set the first allowed GPU type as default
        if (data.allowed_gpu_types && data.allowed_gpu_types.length > 0) {
          setSelectedGpuType(data.allowed_gpu_types[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching RunPod config:", err);
    }
  };

  const fetchAvailableGpuTypes = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("skypilot/runpod/gpu-types"),
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableGpuTypes(data.gpu_types);
      }
    } catch (err) {
      console.error("Error fetching GPU types:", err);
    }
  };

  const resetForm = () => {
    setClusterName("");
    setCommand("echo 'Hello RunPod'");
    setSetup("");
    setSelectedGpuType("");
    setError(null);
    setSuccess(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const launchCluster = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append("cluster_name", clusterName);
      formData.append("command", command);
      if (setup) formData.append("setup", setup);
      formData.append("cloud", "runpod");
      if (selectedGpuType) formData.append("accelerators", selectedGpuType);
      formData.append("use_spot", "false");
      formData.append("launch_mode", "custom");

      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data: LaunchClusterResponse = await response.json();
        setSuccess(`${data.message} (Request ID: ${data.request_id})`);
        setTimeout(() => {
          if (onClusterLaunched) {
            onClusterLaunched(clusterName);
          }
          handleClose();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to launch RunPod cluster");
      }
    } catch (err) {
      setError("Error launching RunPod cluster");
    } finally {
      setLoading(false);
    }
  };

  if (!runpodConfig.is_configured) {
    return (
      <Modal open={open} onClose={handleClose}>
        <ModalDialog sx={{ maxWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            <Zap
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            RunPod Cluster Launcher
          </Typography>
          <Alert color="warning">
            RunPod is not configured. Please configure it in the Admin section
            first.
          </Alert>
          <Box
            sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}
          >
            <Button variant="plain" onClick={handleClose}>
              Close
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          <Zap size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
          Launch RunPod Cluster
        </Typography>

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

        <Stack spacing={3}>
          <FormControl required>
            <FormLabel>Cluster Name</FormLabel>
            <Input
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="my-runpod-cluster"
            />
          </FormControl>

          <FormControl required>
            <FormLabel>Run Command</FormLabel>
            <Textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="echo 'Hello RunPod'"
              minRows={2}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Setup Command (optional)</FormLabel>
            <Textarea
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              placeholder="pip install torch transformers"
              minRows={2}
            />
          </FormControl>

          <FormControl required>
            <FormLabel>GPU Type</FormLabel>
            <Select
              value={selectedGpuType}
              onChange={(_, value) => setSelectedGpuType(value || "")}
              placeholder="Select GPU type"
            >
              {runpodConfig.allowed_gpu_types.map((gpuType) => (
                <Option key={gpuType} value={gpuType}>
                  {gpuType}
                </Option>
              ))}
            </Select>
            <Typography
              level="body-xs"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {runpodConfig.allowed_gpu_types.length} GPU types available
            </Typography>
          </FormControl>

          <Card variant="soft" sx={{ p: 2 }}>
            <Typography level="title-sm" sx={{ mb: 1 }}>
              RunPod Configuration Status
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip size="sm" variant="soft" color="success">
                Configured
              </Chip>
              <Chip size="sm" variant="soft" color="primary">
                {runpodConfig.allowed_gpu_types.length} GPU types allowed
              </Chip>
            </Stack>
          </Card>
        </Stack>

        <Box
          sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 3 }}
        >
          <Button variant="plain" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            startDecorator={<Rocket size={16} />}
            onClick={launchCluster}
            disabled={!clusterName || !selectedGpuType || loading}
            loading={loading}
            color="success"
          >
            Launch RunPod Cluster
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default RunPodClusterLauncher;
