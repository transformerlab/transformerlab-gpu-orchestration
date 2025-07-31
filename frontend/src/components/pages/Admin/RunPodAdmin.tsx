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
  Select,
  Option,
  Grid,
} from "@mui/joy";
import { Save, Key, Gpu, Settings } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
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
    max_instances: 0,
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
          max_instances: config.max_instances,
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
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography level="title-sm">
                  Select GPU Types to Allow
                </Typography>
                <Chip size="sm" variant="soft" color="primary">
                  {config.allowed_gpu_types.length} selected
                </Chip>
              </Box>

              <Grid container spacing={2}>
                {availableGpuTypes.map((gpu) => {
                  const isSelected = config.allowed_gpu_types.includes(
                    gpu.name
                  );
                  return (
                    <Grid xs={12} sm={6} md={4} key={gpu.name}>
                      <Card
                        variant={isSelected ? "solid" : "outlined"}
                        color={isSelected ? "primary" : "neutral"}
                        sx={{
                          cursor: "pointer",
                          transition: "all 0.2s",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            boxShadow: "md",
                          },
                          position: "relative",
                          overflow: "hidden",
                        }}
                        onClick={() => {
                          setConfig((prev) => ({
                            ...prev,
                            allowed_gpu_types: isSelected
                              ? prev.allowed_gpu_types.filter(
                                  (g) => g !== gpu.name
                                )
                              : [...prev.allowed_gpu_types, gpu.name],
                          }));
                        }}
                      >
                        {isSelected && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              bgcolor: "success.500",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Typography
                              level="body-xs"
                              sx={{ color: "white", fontWeight: "bold" }}
                            >
                              ✓
                            </Typography>
                          </Box>
                        )}

                        <Stack spacing={1}>
                          <Typography
                            level="title-sm"
                            sx={{ fontWeight: "bold" }}
                          >
                            {gpu.name}
                          </Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "text.secondary" }}
                          >
                            {gpu.count}x GPU
                          </Typography>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={isSelected ? "primary" : "neutral"}
                            sx={{ alignSelf: "flex-start" }}
                          >
                            {gpu.count} Instance{gpu.count !== "1" ? "s" : ""}
                          </Chip>
                        </Stack>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>

              <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() => {
                    setConfig((prev) => ({
                      ...prev,
                      allowed_gpu_types: availableGpuTypes.map(
                        (gpu) => gpu.name
                      ),
                    }));
                  }}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() => {
                    setConfig((prev) => ({
                      ...prev,
                      allowed_gpu_types: [],
                    }));
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Stack>
          )}
        </Card>

        {/* Instance Limits Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Settings
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Instance Limits
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "text.secondary" }}>
            Set the maximum number of RunPod instances that can be launched simultaneously.
            Set to 0 for unlimited instances.
          </Typography>

          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Maximum Instances</FormLabel>
              <Input
                value={config.max_instances}
                onChange={(e) =>
                  setConfig((prev) => ({ 
                    ...prev, 
                    max_instances: parseInt(e.target.value) || 0 
                  }))
                }
                placeholder="0 for unlimited"
                slotProps={{
                  input: {
                    type: "number",
                    min: 0,
                  }
                }}
                sx={{ maxWidth: 200 }}
              />
              <Typography level="body-xs" sx={{ color: "text.secondary", mt: 0.5 }}>
                {config.max_instances === 0 
                  ? "Unlimited instances allowed" 
                  : `Maximum ${config.max_instances} instance${config.max_instances !== 1 ? 's' : ''} allowed`
                }
              </Typography>
            </FormControl>
          </Stack>
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
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography>Maximum Instances</Typography>
              <Chip variant="soft" color="primary" size="sm">
                {config.max_instances === 0 ? "Unlimited" : config.max_instances}
              </Chip>
            </Box>
          </Stack>
        </Card>
      </Stack>
    </PageWithTitle>
  );
};

export default RunPodAdmin;
