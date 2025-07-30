import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Input,
  FormControl,
  FormLabel,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Chip,
  Switch,
  Alert,
  CircularProgress,
} from "@mui/joy";
import { Save, Key, Gpu } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
}

interface GpuType {
  name: string;
  count: string;
  display_name: string;
}

const RunPodAdmin: React.FC = () => {
  const [config, setConfig] = useState<RunPodConfig>({
    api_key: "",
    allowed_gpu_types: [],
    is_configured: false,
  });
  const [availableGpuTypes, setAvailableGpuTypes] = useState<GpuType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetchRunPodConfig();
    fetchAvailableGpuTypes();
  }, []);

  const fetchRunPodConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("skypilot/runpod/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        setError("Failed to fetch RunPod configuration");
      }
    } catch (err) {
      setError("Error fetching RunPod configuration");
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
          const [name, count] = gpu.split(":");
          return {
            name,
            count: count || "1",
            display_name: `${name} (${count || "1"}x)`,
          };
        });
        setAvailableGpuTypes(gpuTypes);
      }
    } catch (err) {
      console.error("Error fetching GPU types:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await apiFetch(buildApiUrl("skypilot/runpod/config"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: config.api_key,
          allowed_gpu_types: config.allowed_gpu_types,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setSuccess("RunPod configuration saved successfully");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to save RunPod configuration");
      }
    } catch (err) {
      setError("Error saving RunPod configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleGpuType = (gpuName: string) => {
    setConfig((prev) => ({
      ...prev,
      allowed_gpu_types: prev.allowed_gpu_types.includes(gpuName)
        ? prev.allowed_gpu_types.filter((g) => g !== gpuName)
        : [...prev.allowed_gpu_types, gpuName],
    }));
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await apiFetch(buildApiUrl("skypilot/runpod/test"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: config.api_key,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess("RunPod connection test successful");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "RunPod connection test failed");
      }
    } catch (err) {
      setError("Error testing RunPod connection");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWithTitle
        title="RunPod Configuration"
        subtitle="Configure RunPod API key and allowed GPU instances for on-demand clusters."
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title="RunPod Configuration"
      subtitle="Configure RunPod API key and allowed GPU instances for on-demand clusters."
    >
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
        {/* API Key Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Key
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            API Key Configuration
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>RunPod API Key</FormLabel>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={config.api_key}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, api_key: e.target.value }))
                  }
                  placeholder="Enter your RunPod API key"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? "Hide" : "Show"}
                </Button>
              </Box>
            </FormControl>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                startDecorator={<Save size={16} />}
                onClick={saveConfig}
                disabled={saving || !config.api_key}
                loading={saving}
              >
                Save Configuration
              </Button>
              <Button
                variant="outlined"
                onClick={testConnection}
                disabled={loading || !config.api_key}
                loading={loading}
              >
                Test Connection
              </Button>
            </Box>
          </Stack>
        </Card>

        {/* GPU Types Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Gpu
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Allowed GPU Instances
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "text.secondary" }}>
            Select which GPU types users can choose from when creating RunPod
            clusters.
          </Typography>

          {availableGpuTypes.length === 0 ? (
            <Alert color="warning">
              No GPU types available. Please ensure RunPod is properly
              configured and try refreshing.
            </Alert>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {availableGpuTypes.map((gpu) => (
                <Chip
                  key={gpu.name}
                  variant={
                    config.allowed_gpu_types.includes(gpu.name)
                      ? "solid"
                      : "outlined"
                  }
                  color={
                    config.allowed_gpu_types.includes(gpu.name)
                      ? "primary"
                      : "neutral"
                  }
                  onClick={() => toggleGpuType(gpu.name)}
                  sx={{ cursor: "pointer" }}
                >
                  {gpu.display_name}
                </Chip>
              ))}
            </Box>
          )}
        </Card>

        {/* Status Information */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            Configuration Status
          </Typography>
          <Stack spacing={1}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography>API Key Configured</Typography>
              <Chip
                variant="soft"
                color={config.is_configured ? "success" : "danger"}
                size="sm"
              >
                {config.is_configured ? "Yes" : "No"}
              </Chip>
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography>Allowed GPU Types</Typography>
              <Chip variant="soft" color="primary" size="sm">
                {config.allowed_gpu_types.length} selected
              </Chip>
            </Box>
          </Stack>
        </Card>
      </Stack>
    </PageWithTitle>
  );
};

export default RunPodAdmin;
