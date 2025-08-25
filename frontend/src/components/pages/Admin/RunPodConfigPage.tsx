import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Input,
  FormControl,
  FormLabel,
  Stack,
  Chip,
  Switch,
  Alert,
  CircularProgress,
  Autocomplete,
} from "@mui/joy";
import { Save, Key, Gpu, Settings, ArrowLeft } from "lucide-react";
import LogViewer from "../../widgets/LogViewer";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";
import { useNotification } from "../../../components/NotificationSystem";
import { useNavigate, useSearchParams } from "react-router-dom";

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
}

interface GpuType {
  name: string;
  display_name: string;
  type: string;
  vcpus: string;
  memory_gb: string;
  price: string;
  accelerator_name?: string;
  accelerator_count?: string;
}

const RunPodConfigPage: React.FC = () => {
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if this is for configuring an existing pool or adding a new one
  const isConfigureMode = searchParams.get("mode") === "configure";
  const initialPoolName = searchParams.get("poolName") || "RunPod Pool";
  const configKey = searchParams.get("configKey");

  const [config, setConfig] = useState<RunPodConfig>({
    api_key: "",
    allowed_gpu_types: [],
    is_configured: false,
    max_instances: 0,
  });
  const [poolName, setPoolName] = useState(initialPoolName);
  const [availableGpuTypes, setAvailableGpuTypes] = useState<GpuType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skyChecking, setSkyChecking] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [skyCheckResult, setSkyCheckResult] = useState<{
    valid: boolean;
    output: string;
    message: string;
  } | null>(null);
  const [existingConfigs, setExistingConfigs] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      // Always fetch available GPU types first
      await Promise.all([fetchAvailableGpuTypes(), fetchExistingConfigs()]);

      // Then fetch existing config if in configure mode
      if (isConfigureMode) {
        await fetchRunPodConfig();
      }
    };

    loadData();
  }, [isConfigureMode]);

  const fetchExistingConfigs = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/runpod/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setExistingConfigs(data);
      }
    } catch (err) {
      console.error("Error fetching existing RunPod configs:", err);
    }
  };

  const fetchRunPodConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("clouds/runpod/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();

        // If a specific config key is provided, load that config
        if (configKey && data.configs && data.configs[configKey]) {
          const specificConfig = data.configs[configKey];
          setConfig({
            api_key: specificConfig.api_key || "",
            allowed_gpu_types: specificConfig.allowed_gpu_types || [],
            is_configured: data.is_configured || false,
            max_instances: specificConfig.max_instances || 0,
          });
          setPoolName(specificConfig.name || initialPoolName);
        }
        // Otherwise use the default config
        else if (
          data.default_config &&
          data.configs &&
          data.configs[data.default_config]
        ) {
          const defaultConfig = data.configs[data.default_config];
          setConfig({
            api_key: defaultConfig.api_key || "",
            allowed_gpu_types: defaultConfig.allowed_gpu_types || [],
            is_configured: data.is_configured || false,
            max_instances: defaultConfig.max_instances || 0,
          });
          setPoolName(defaultConfig.name || initialPoolName);
        }
      } else {
        addNotification({
          type: "danger",
          message: "Failed to fetch RunPod configuration",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error fetching RunPod configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableGpuTypes = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("clouds/runpod/info"),
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        console.log("RunPod display options data:", data);

        // Use the new display options format
        let gpuTypes: GpuType[] = [];

        if (
          data.display_options_with_pricing &&
          data.display_options_with_pricing.length > 0
        ) {
          // Use the new detailed format with pricing
          gpuTypes = data.display_options_with_pricing.map((gpu: any) => ({
            name: gpu.name,
            display_name: gpu.display_name,
            type: gpu.type,
            vcpus: gpu.vcpus,
            memory_gb: gpu.memory_gb,
            price: gpu.price,
            accelerator_name: gpu.accelerator_name,
            accelerator_count: gpu.accelerator_count,
          }));
        }

        // If we're in configure mode and have existing config, ensure all selected types are included
        if (
          isConfigureMode &&
          config.allowed_gpu_types &&
          config.allowed_gpu_types.length > 0
        ) {
          const missingTypes = config.allowed_gpu_types.filter(
            (selectedType) =>
              !gpuTypes.some((gpu: GpuType) => gpu.name === selectedType)
          );

          // Add missing types to the available list
          missingTypes.forEach((missingType) => {
            gpuTypes.push({
              name: missingType,
              display_name: missingType,
              type: "Unknown",
              vcpus: "0",
              memory_gb: "0",
              price: "Unknown",
            });
          });
        }

        setAvailableGpuTypes(gpuTypes);
        return gpuTypes; // Return the GPU types for potential use
      } else {
        console.error("Error fetching display options");
        return [];
      }
    } catch (err) {
      console.error("Error fetching display options:", err);
      return [];
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setSkyCheckResult(null);

      const requestBody: any = {
        name: poolName,
        api_key: config.api_key,
        allowed_gpu_types: config.allowed_gpu_types,
        max_instances: config.max_instances,
      };

      // Only include config_key if it's not null
      if (configKey) {
        requestBody.config_key = configKey;
      }

      const response = await apiFetch(buildApiUrl("clouds/runpod/config"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();

        // Handle the new multiple config structure
        if (
          data.configs &&
          data.default_config &&
          data.configs[data.default_config]
        ) {
          const defaultConfig = data.configs[data.default_config];
          setConfig({
            api_key: defaultConfig.api_key || "",
            allowed_gpu_types: defaultConfig.allowed_gpu_types || [],
            is_configured: data.is_configured || false,
            max_instances: defaultConfig.max_instances || 0,
          });
        } else {
          // Fallback to legacy structure
          setConfig(data);
        }

        if (data.sky_check_result) {
          setSkyCheckResult(data.sky_check_result);
          if (data.sky_check_result.valid) {
            addNotification({
              type: "success",
              message:
                "RunPod configuration saved successfully and sky check passed",
            });
          } else {
            addNotification({
              type: "danger",
              message: `RunPod configuration saved but sky check failed: ${data.sky_check_result.message}`,
            });
          }
        } else {
          addNotification({
            type: "success",
            message: "RunPod configuration saved successfully",
          });
        }

        // Navigate back to pools page after successful save
        setTimeout(() => {
          navigate("/dashboard/admin/pools");
        }, 1500);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to save RunPod configuration",
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

  const testConnection = async () => {
    try {
      setLoading(true);

      const response = await apiFetch(buildApiUrl("clouds/runpod/test"), {
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
        addNotification({
          type: "success",
          message: "RunPod connection test successful",
        });
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "RunPod connection test failed",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error testing RunPod connection",
      });
    } finally {
      setLoading(false);
    }
  };

  const runSkyCheck = async () => {
    try {
      setSkyChecking(true);
      setSkyCheckResult(null);

      const response = await apiFetch(buildApiUrl("clouds/runpod/sky-check"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSkyCheckResult(data);
        if (data.valid) {
          addNotification({
            type: "success",
            message: "Sky check runpod completed successfully",
          });
        } else {
          addNotification({
            type: "danger",
            message: "Sky check runpod failed",
          });
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Sky check runpod failed",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error running sky check runpod",
      });
    } finally {
      setSkyChecking(false);
    }
  };

  if (loading && isConfigureMode) {
    return (
      <PageWithTitle
        title={`${isConfigureMode ? "Configure" : "Add"} RunPod Pool`}
        backButton
        onBack={() => navigate("/dashboard/admin/pools")}
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title={`${isConfigureMode ? "Configure" : "Add"} RunPod Pool`}
      backButton
      onBack={() => navigate("/dashboard/admin/pools")}
      sticky={true}
      button={
        <Button
          startDecorator={<Save size={16} />}
          onClick={saveConfig}
          disabled={saving || !config.api_key}
          loading={saving}
          size="sm"
        >
          Save Configuration
        </Button>
      }
    >
      <Stack spacing={3}>
        {/* Pool Name Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            Pool Configuration
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Configure the name for this RunPod pool.
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Pool Name</FormLabel>
              <Input
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Enter pool name"
              />
            </FormControl>
          </Stack>
        </Card>

        {/* RunPod API Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Key
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            RunPod API Configuration
          </Typography>

          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Configure your RunPod API key to enable GPU instance management. You
            can find your API key in your RunPod account settings.
          </Typography>

          <Stack spacing={2}>
            <FormControl>
              <FormLabel>API Key</FormLabel>
              <Input
                type={showApiKey ? "text" : "password"}
                value={config.api_key}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    api_key: e.target.value,
                  }))
                }
                placeholder="Enter your RunPod API key"
              />
            </FormControl>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                onClick={testConnection}
                disabled={loading || !config.api_key}
                loading={loading}
              >
                Test Connection
              </Button>
              <Button
                variant="outlined"
                onClick={runSkyCheck}
                disabled={skyChecking || !config.is_configured}
                loading={skyChecking}
              >
                Sky Check RunPod
              </Button>
              <Button
                variant="outlined"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "Hide" : "Show"} API Key
              </Button>
            </Box>
          </Stack>
        </Card>

        {/* Sky Check Results */}
        {skyCheckResult && (
          <Card variant="outlined">
            <Typography level="h4" sx={{ mb: 2 }}>
              Sky Check RunPod Results
            </Typography>
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography>Validation Status</Typography>
                <Chip
                  variant="soft"
                  color={skyCheckResult.valid ? "success" : "danger"}
                  size="sm"
                >
                  {skyCheckResult.valid ? "Passed" : "Failed"}
                </Chip>
              </Box>
              <Box>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Output:
                </Typography>
                <Box
                  sx={{
                    height: 400,
                    borderRadius: 1,
                  }}
                >
                  <LogViewer log={skyCheckResult.output} />
                </Box>
              </Box>
            </Stack>
          </Card>
        )}

        {/* GPU Types Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Gpu
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Allowed GPU/CPU Types
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Select which RunPod GPU/CPU types users can choose from when
            creating RunPod clusters.
          </Typography>

          {loading && availableGpuTypes.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress />
            </Box>
          ) : availableGpuTypes.length === 0 ? (
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
                  {config.allowed_gpu_types?.length || 0} selected
                </Chip>
              </Box>

              <FormControl>
                <FormLabel>GPU Types</FormLabel>
                <Autocomplete
                  multiple
                  options={availableGpuTypes}
                  getOptionLabel={(option) => `${option.name}`}
                  value={availableGpuTypes.filter((gpu: GpuType) =>
                    config.allowed_gpu_types.includes(gpu.name)
                  )}
                  onChange={(_, newValue) => {
                    setConfig((prev) => ({
                      ...prev,
                      allowed_gpu_types: newValue.map((item) => item.name),
                    }));
                  }}
                  placeholder="Search and select RunPod GPU types..."
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack spacing={0.5}>
                        <Typography
                          level="title-sm"
                          sx={{ fontWeight: "bold" }}
                        >
                          {option.name}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {option.type === "GPU"
                            ? `${option.accelerator_count || "1"}x ${
                                option.accelerator_name || "GPU"
                              }`
                            : `${option.vcpus} vCPUs`}{" "}
                          • {option.memory_gb}GB RAM • ${option.price}/hr
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  sx={{ width: "100%" }}
                  limitTags={10}
                  disableCloseOnSelect
                />
              </FormControl>

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
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Set the maximum number of RunPod instances that can be launched
            simultaneously. Set to 0 for unlimited instances.
          </Typography>

          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Maximum Instances</FormLabel>
              <Input
                value={config.max_instances}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_instances: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0 for unlimited"
                slotProps={{
                  input: {
                    type: "number",
                    min: 0,
                  },
                }}
                sx={{ maxWidth: 200 }}
              />
              <Typography
                level="body-xs"
                sx={{ color: "neutral.500", mt: 0.5 }}
              >
                {config.max_instances === 0
                  ? "Unlimited instances allowed"
                  : `Maximum ${config.max_instances} instance${
                      config.max_instances !== 1 ? "s" : ""
                    } allowed`}
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
              <Typography>RunPod API</Typography>
              <Chip
                variant="soft"
                color={config.is_configured ? "success" : "danger"}
                size="sm"
              >
                {config.is_configured ? "Configured" : "Not Configured"}
              </Chip>
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography>Allowed GPU/CPU Types</Typography>
              <Chip size="sm" variant="soft" color="primary">
                {config.allowed_gpu_types?.length || 0} selected
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
                {config.max_instances === 0
                  ? "Unlimited"
                  : config.max_instances}
              </Chip>
            </Box>
          </Stack>
        </Card>
      </Stack>
    </PageWithTitle>
  );
};

export default RunPodConfigPage;
