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
import { useNotification } from "./NotificationSystem";

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
}

interface RunPodClusterLauncherProps {
  open: boolean;
  onClose: () => void;
  onClusterLaunched?: (clusterName: string) => void;
  runpodConfig: RunPodConfig;
}

interface LaunchClusterResponse {
  request_id: string;
  cluster_name: string;
  message: string;
}

interface GpuType {
  name: string;
  count: string;
  display_name: string;
  full_string: string;
  price: string;
  type: string;
}

const RunPodClusterLauncher: React.FC<RunPodClusterLauncherProps> = ({
  open,
  onClose,
  onClusterLaunched,
  runpodConfig,
}) => {
  const [clusterName, setClusterName] = useState("");
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [selectedGpuType, setSelectedGpuType] = useState("");
  const [selectedGpuFullString, setSelectedGpuFullString] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [availableGpuTypes, setAvailableGpuTypes] = useState<GpuType[]>([]);
  const [isLoadingGpuTypes, setIsLoadingGpuTypes] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (open) {
      fetchAvailableGpuTypes();
      // Set the first allowed GPU type as default when config is available
      if (
        runpodConfig.allowed_gpu_types &&
        runpodConfig.allowed_gpu_types.length > 0
      ) {
        setSelectedGpuType(runpodConfig.allowed_gpu_types[0]);
      }
    } else {
      // Reset loading state when modal closes
      setIsLoadingGpuTypes(false);
    }
  }, [open, runpodConfig.allowed_gpu_types]);

  const fetchAvailableGpuTypes = async () => {
    setIsLoadingGpuTypes(true);
    try {
      const response = await apiFetch(
        buildApiUrl("skypilot/runpod/display-options-with-pricing"),
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        console.log("RunPod display options in launcher:", data);
        const gpuTypes = data.display_options_with_pricing.map(
          (option: any) => ({
            name: option.name,
            count: option.accelerator_count || "1",
            display_name: option.display_name,
            price: option.price,
            full_string: option.name, // Use the name as the full string
            type: option.type,
          })
        );
        setAvailableGpuTypes(gpuTypes);
      }
    } catch (err) {
      console.error("Error fetching display options:", err);
    } finally {
      setIsLoadingGpuTypes(false);
    }
  };

  const resetForm = () => {
    setClusterName("");
    setCommand('echo "Welcome to Lattice"');
    setSetup("");
    setSelectedGpuType("");
    setSelectedGpuFullString("");
    setSelectedTemplate("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const launchCluster = async () => {
    // Close modal immediately and reset form
    handleClose();

    // Show immediate notification that request is being processed
    addNotification({
      type: "warning",
      message: `Launching RunPod cluster "${clusterName}"...`,
    });

    try {
      const formData = new FormData();
      formData.append("cluster_name", clusterName);
      formData.append("command", command);
      if (setup) formData.append("setup", setup);
      formData.append("cloud", "runpod");
      if (selectedGpuFullString)
        formData.append("accelerators", selectedGpuFullString);
      formData.append("use_spot", "false");
      formData.append("launch_mode", "custom");

      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data: LaunchClusterResponse = await response.json();
        addNotification({
          type: "success",
          message: `${data.message} (Request ID: ${data.request_id})`,
        });

        // Trigger cluster list refresh
        if (onClusterLaunched) {
          onClusterLaunched(clusterName);
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to launch RunPod cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error launching RunPod cluster",
      });
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          <Zap size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
          Reserve an Instance on RunPod
        </Typography>

        <Stack spacing={3}>
          <FormControl required>
            <FormLabel>Cluster Name</FormLabel>
            <Input
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="my-runpod-cluster"
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

          <FormControl>
            <FormLabel>Select a Template</FormLabel>
            <Select
              value={selectedTemplate}
              onChange={(_, value) => setSelectedTemplate(value || "")}
              placeholder="Choose a template"
            >
              <Option value="transformer-lab">Transformer Lab</Option>
              <Option value="jupyter">Jupyter</Option>
              <Option value="vscode">VSCode</Option>
            </Select>
            <Typography
              level="body-xs"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Choose a template for your node (functionality coming soon)
            </Typography>
          </FormControl>

          <FormControl required>
            <FormLabel>GPU Type</FormLabel>
            <Select
              value={selectedGpuFullString}
              onChange={(_, value) => {
                setSelectedGpuFullString(value || "");
                // Extract the GPU name from the full string for the backend
                if (value) {
                  const [name] = value.split(":");
                  setSelectedGpuType(name);
                } else {
                  setSelectedGpuType("");
                }
              }}
              placeholder={
                isLoadingGpuTypes
                  ? "Loading available GPU types..."
                  : availableGpuTypes.length === 0
                  ? "No GPU types available"
                  : "Select GPU type"
              }
              disabled={isLoadingGpuTypes}
            >
              {(() => {
                if (isLoadingGpuTypes) {
                  return (
                    <Option value="" disabled>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <CircularProgress size="sm" />
                        Loading GPU types...
                      </Box>
                    </Option>
                  );
                }

                // Only filter if we have both config and GPU types loaded
                if (
                  !runpodConfig.allowed_gpu_types ||
                  availableGpuTypes.length === 0
                ) {
                  return [];
                }

                const filteredGpus = availableGpuTypes.filter((gpu) => {
                  // Check if the GPU is in the allowed list
                  // Both config and API now use "GPU_NAME:COUNT" format with integer counts
                  const isAllowed = runpodConfig.allowed_gpu_types?.includes(
                    gpu.full_string
                  );
                  return isAllowed;
                });

                // Only show allowed GPUs, don't fallback to all available GPUs
                return filteredGpus.map((gpu) => (
                  <Option key={gpu.full_string} value={gpu.full_string}>
                    {gpu.display_name}
                  </Option>
                ));
              })()}
            </Select>
            <Typography
              level="body-xs"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {!isLoadingGpuTypes &&
                availableGpuTypes.length > 0 &&
                availableGpuTypes.filter((gpu) =>
                  runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
                ).length === 0 && (
                  <span style={{ color: "orange" }}>
                    {" "}
                    No GPU types are allowed in the current configuration.
                    Please configure allowed GPU types in the Admin section.
                  </span>
                )}
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
              <Chip
                size="sm"
                variant="soft"
                color={
                  isLoadingGpuTypes
                    ? "neutral"
                    : availableGpuTypes.filter((gpu) =>
                        runpodConfig.allowed_gpu_types?.includes(
                          gpu.full_string
                        )
                      ).length > 0
                    ? "primary"
                    : "warning"
                }
              >
                {isLoadingGpuTypes ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <CircularProgress size="sm" />
                    Loading...
                  </Box>
                ) : (
                  `${
                    availableGpuTypes.filter((gpu) =>
                      runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
                    ).length || 0
                  } GPU types allowed`
                )}
              </Chip>
            </Stack>
            {!isLoadingGpuTypes &&
              availableGpuTypes.filter((gpu) =>
                runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
              ).length === 0 && (
                <Typography
                  level="body-xs"
                  sx={{ mt: 1, color: "warning.500" }}
                >
                  No GPU types are configured as allowed. Please configure
                  allowed GPU types in the Admin section.
                </Typography>
              )}
          </Card>
        </Stack>

        <Box
          sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 3 }}
        >
          <Button variant="plain" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            startDecorator={<Rocket size={16} />}
            onClick={launchCluster}
            disabled={
              !clusterName ||
              !selectedGpuType ||
              isLoadingGpuTypes ||
              availableGpuTypes.filter((gpu) =>
                runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
              ).length === 0
            }
            color="success"
          >
            Reserve a RunPod Node
          </Button>
        </Box>
        {!isLoadingGpuTypes &&
          availableGpuTypes.filter((gpu) =>
            runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
          ).length === 0 && (
            <Alert color="warning" sx={{ mt: 2 }}>
              No GPU types are allowed in the current configuration. Please
              configure allowed GPU types in the Admin section before launching
              clusters.
            </Alert>
          )}
      </ModalDialog>
    </Modal>
  );
};

export default RunPodClusterLauncher;
