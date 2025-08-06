import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Card,
  FormControl,
  FormLabel,
  Input,
  Button,
  Stack,
  CircularProgress,
  Autocomplete,
  Box,
} from "@mui/joy";
import { Save, Key } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useNotification } from "../../../components/NotificationSystem";

interface RunPodConfig {
  name: string;
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
}

interface GpuType {
  name: string;
  count: string;
  price: string;
  display_name: string;
}

interface RunPodConfigModalProps {
  open: boolean;
  onClose: () => void;
  poolName?: string;
  onConfigSaved?: () => void;
}

const RunPodConfigModal: React.FC<RunPodConfigModalProps> = ({
  open,
  onClose,
  poolName = "RunPod Pool",
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<RunPodConfig>({
    name: "",
    api_key: "",
    allowed_gpu_types: [],
    is_configured: false,
    max_instances: 0,
  });
  const [availableGpuTypes, setAvailableGpuTypes] = useState<GpuType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (open) {
      fetchRunPodConfig();
      fetchAvailableGpuTypes();
    }
  }, [open]);

  const fetchRunPodConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("skypilot/runpod/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setConfig({
          name: data.name || "",
          api_key: data.api_key || "",
          allowed_gpu_types: data.allowed_gpu_types || [],
          is_configured: data.is_configured || false,
          max_instances: data.max_instances || 0,
        });
      }
    } catch (err) {
      console.error("Error fetching RunPod config:", err);
    } finally {
      setLoading(false);
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
        const gpuTypes = data.gpu_types.map((gpu: string) => {
          const [name, count, price] = gpu.split(":");
          return {
            name: name || gpu,
            count: count || "1",
            price: price || "0",
            display_name: `${name || gpu} (${count || "1"} GPU${
              count !== "1" ? "s" : ""
            })`,
          };
        });
        setAvailableGpuTypes(gpuTypes);
      }
    } catch (err) {
      console.error("Error fetching RunPod GPU types:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await apiFetch(buildApiUrl("skypilot/runpod/config"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        addNotification({
          type: "success",
          message: "RunPod configuration saved successfully",
        });
        await fetchRunPodConfig();
        onClose();
        // Longer delay to ensure modal is fully closed before refreshing
        setTimeout(() => {
          onConfigSaved?.();
        }, 300);
      } else {
        addNotification({
          type: "danger",
          message: "Failed to save RunPod configuration",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error saving RunPod configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog size="lg">
        <ModalClose />
        <Typography level="h4">Configure {poolName}</Typography>
        <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
          RunPod Configuration
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Pool Name</FormLabel>
                <Input
                  value={config.name || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter pool name (e.g., RunPod GPU Pool)"
                  disabled={config.is_configured}
                />
              </FormControl>
              <FormControl>
                <FormLabel>API Key</FormLabel>
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={config.api_key || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      api_key: e.target.value,
                    })
                  }
                  placeholder="Enter RunPod API key"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Max Instances</FormLabel>
                <Input
                  type="number"
                  value={config.max_instances}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_instances: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Maximum number of instances"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Allowed GPU Types</FormLabel>
                <Autocomplete
                  multiple
                  options={availableGpuTypes}
                  getOptionLabel={(option) => option.display_name}
                  value={availableGpuTypes.filter((gpu) =>
                    config.allowed_gpu_types.includes(gpu.name)
                  )}
                  onChange={(_, newValue) => {
                    setConfig({
                      ...config,
                      allowed_gpu_types: newValue.map((item) => item.name),
                    });
                  }}
                  renderInput={(params) => (
                    <Input {...params} placeholder="Select GPU types" />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Typography level="body-sm">
                        {option.display_name}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        ${option.price}/hr
                      </Typography>
                    </Box>
                  )}
                />
              </FormControl>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => setShowApiKey(!showApiKey)}
                  startDecorator={<Key size={16} />}
                >
                  {showApiKey ? "Hide" : "Show"} API Key
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={saveConfig}
                  disabled={saving}
                  startDecorator={
                    saving ? <CircularProgress size={16} /> : <Save size={16} />
                  }
                >
                  {saving ? "Saving..." : "Save RunPod Config"}
                </Button>
              </Stack>
            </Stack>
          )}
        </Card>
      </ModalDialog>
    </Modal>
  );
};

export default RunPodConfigModal;
