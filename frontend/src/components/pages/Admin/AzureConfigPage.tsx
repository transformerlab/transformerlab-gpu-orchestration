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
import { Save, Key, Server, Settings, ArrowLeft } from "lucide-react";
import LogViewer from "../../widgets/LogViewer";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";
import { useNotification } from "../../../components/NotificationSystem";
import { useNavigate, useSearchParams } from "react-router-dom";

interface AzureConfig {
  subscription_id: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  allowed_instance_types: string[];
  allowed_regions: string[];
  is_configured: boolean;
  auth_method: "service_principal";
  max_instances: number;
}

interface InstanceType {
  name: string;
  display_name: string;
  category: string;
}

const AzureConfigPage: React.FC = () => {
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if this is for configuring an existing pool or adding a new one
  const isConfigureMode = searchParams.get("mode") === "configure";
  const initialPoolName = searchParams.get("poolName") || "Azure Pool";
  const configKey = searchParams.get("configKey");

  const [config, setConfig] = useState<AzureConfig>({
    subscription_id: "",
    tenant_id: "",
    client_id: "",
    client_secret: "",
    allowed_instance_types: [],
    allowed_regions: [],
    is_configured: false,
    auth_method: "service_principal",
    max_instances: 0,
  });
  const [poolName, setPoolName] = useState(initialPoolName);
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState<
    InstanceType[]
  >([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skyChecking, setSkyChecking] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [actualCredentials, setActualCredentials] =
    useState<AzureConfig | null>(null);
  const [skyCheckResult, setSkyCheckResult] = useState<{
    valid: boolean;
    output: string;
    message: string;
  } | null>(null);
  const [existingConfigs, setExistingConfigs] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      // Always fetch available instance types and regions first
      await Promise.all([
        fetchAvailableInstanceTypes(),
        fetchAvailableRegions(),
        fetchExistingConfigs(),
      ]);

      // Then fetch existing config if in configure mode
      if (isConfigureMode) {
        await fetchAzureConfig();
      }
    };

    loadData();
  }, [isConfigureMode]);

  const fetchExistingConfigs = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/azure/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setExistingConfigs(data);
      }
    } catch (err) {
      console.error("Error fetching existing Azure configs:", err);
    }
  };

  const fetchAzureConfig = async () => {
    try {
      setLoading(true);

      // If we're configuring a specific config, get the actual credentials
      let endpoint = "clouds/azure/config";
      if (configKey) {
        endpoint = `clouds/azure/credentials?config_key=${encodeURIComponent(
          configKey
        )}`;
      }

      const response = await apiFetch(buildApiUrl(endpoint), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        // If a specific config key is provided, load that config
        if (configKey && data.configs && data.configs[configKey]) {
          const specificConfig = data.configs[configKey];
          setConfig({
            subscription_id: specificConfig.subscription_id || "",
            tenant_id: specificConfig.tenant_id || "",
            client_id: specificConfig.client_id || "",
            client_secret: specificConfig.client_secret || "",
            allowed_instance_types: specificConfig.allowed_instance_types || [],
            allowed_regions: specificConfig.allowed_regions || [],
            is_configured: data.is_configured || false,
            auth_method: "service_principal",
            max_instances: specificConfig.max_instances || 0,
          });
          setPoolName(specificConfig.name || initialPoolName);
        }
        // If we got a single config from credentials endpoint
        else if (configKey && data.subscription_id) {
          setConfig({
            subscription_id: data.subscription_id || "",
            tenant_id: data.tenant_id || "",
            client_id: data.client_id || "",
            client_secret: data.client_secret || "",
            allowed_instance_types: data.allowed_instance_types || [],
            allowed_regions: data.allowed_regions || [],
            is_configured: true,
            auth_method: "service_principal",
            max_instances: data.max_instances || 0,
          });
          setPoolName(data.name || initialPoolName);
        }
        // Otherwise use the default config
        else if (
          data.default_config &&
          data.configs &&
          data.configs[data.default_config]
        ) {
          const defaultConfig = data.configs[data.default_config];
          setConfig({
            subscription_id: defaultConfig.subscription_id || "",
            tenant_id: defaultConfig.tenant_id || "",
            client_id: defaultConfig.client_id || "",
            client_secret: defaultConfig.client_secret || "",
            allowed_instance_types: defaultConfig.allowed_instance_types || [],
            allowed_regions: defaultConfig.allowed_regions || [],
            is_configured: data.is_configured || false,
            auth_method: "service_principal",
            max_instances: defaultConfig.max_instances || 0,
          });
          setPoolName(defaultConfig.name || initialPoolName);
        }
      } else {
        addNotification({
          type: "danger",
          message: "Failed to fetch Azure configuration",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error fetching Azure configuration",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableInstanceTypes = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("clouds/azure/info"),
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        const instanceTypes = (data.instance_types || []).map(
          (type: string) => {
            let category = "General Purpose";
            let display_name = type;

            if (
              type.includes("NC") ||
              type.includes("ND") ||
              type.includes("NV") ||
              type.includes("NP") ||
              type.includes("H")
            ) {
              category = "GPU";
            } else if (
              type.includes("E") ||
              type.includes("M") ||
              type.includes("R")
            ) {
              category = "Memory Optimized";
            } else if (type.includes("F") || type.includes("H")) {
              category = "Compute Optimized";
            } else if (type.includes("L") || type.includes("G")) {
              category = "Storage Optimized";
            } else if (
              type.includes("D") ||
              type.includes("A") ||
              type.includes("B")
            ) {
              category = "General Purpose";
            } else {
              category = "Other";
            }

            return {
              name: type,
              display_name: type,
              category,
            };
          }
        );
        setAvailableInstanceTypes(instanceTypes);
      } else {
        console.error("Error fetching instance types");
      }
    } catch (err) {
      console.error("Error fetching instance types:", err);
    }
  };

  const fetchAvailableRegions = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/azure/info"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableRegions(data.regions || []);
      } else {
        console.error("Error fetching regions");
      }
    } catch (err) {
      console.error("Error fetching regions:", err);
    }
  };

  const fetchActualCredentials = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/azure/credentials"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setActualCredentials(data);
      } else {
        console.error("Error fetching actual credentials");
      }
    } catch (err) {
      console.error("Error fetching actual credentials:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setSkyCheckResult(null);

      const requestBody: any = {
        name: poolName,
        subscription_id: config.subscription_id,
        tenant_id: config.tenant_id,
        client_id: config.client_id,
        client_secret: config.client_secret,
        allowed_instance_types: config.allowed_instance_types,
        allowed_regions: config.allowed_regions,
        max_instances: config.max_instances,
      };

      // Only include config_key if it's not null
      if (configKey) {
        requestBody.config_key = configKey;
      }

      const response = await apiFetch(buildApiUrl("clouds/azure/config"), {
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
            subscription_id: defaultConfig.subscription_id || "",
            tenant_id: defaultConfig.tenant_id || "",
            client_id: defaultConfig.client_id || "",
            client_secret: defaultConfig.client_secret || "",
            allowed_instance_types: defaultConfig.allowed_instance_types || [],
            allowed_regions: defaultConfig.allowed_regions || [],
            is_configured: data.is_configured || false,
            auth_method: "service_principal",
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
                "Azure configuration saved successfully and sky check passed",
            });
          } else {
            addNotification({
              type: "danger",
              message: `Azure configuration saved but sky check failed: ${data.sky_check_result.message}`,
            });
          }
        } else {
          addNotification({
            type: "success",
            message: "Azure configuration saved successfully",
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
          message: errorData.detail || "Failed to save Azure configuration",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error saving Azure configuration",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);

      const response = await apiFetch(buildApiUrl("clouds/azure/test"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription_id: config.subscription_id,
          tenant_id: config.tenant_id,
          client_id: config.client_id,
          client_secret: config.client_secret,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addNotification({
          type: "success",
          message: "Azure connection test successful",
        });
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Azure connection test failed",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error testing Azure connection",
      });
    } finally {
      setLoading(false);
    }
  };

  const runSkyCheck = async () => {
    try {
      setSkyChecking(true);
      setSkyCheckResult(null);

      const response = await apiFetch(buildApiUrl("clouds/azure/sky-check"), {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSkyCheckResult(data);
        if (data.valid) {
          addNotification({
            type: "success",
            message: "Sky check azure completed successfully",
          });
        } else {
          addNotification({
            type: "danger",
            message: "Sky check azure failed",
          });
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Sky check azure failed",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error running sky check azure",
      });
    } finally {
      setSkyChecking(false);
    }
  };

  if (loading && isConfigureMode) {
    return (
      <PageWithTitle
        title={`${isConfigureMode ? "Configure" : "Add"} Azure Pool`}
        subtitle={`${
          isConfigureMode ? "Configure" : "Add"
        } Azure credentials and settings for ${poolName}`}
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
      title={`${isConfigureMode ? "Configure" : "Add"} Azure Pool`}
      subtitle={`${
        isConfigureMode ? "Configure" : "Add"
      } Azure credentials and settings for ${poolName}`}
      backButton
      onBack={() => navigate("/dashboard/admin/pools")}
      sticky={true}
      button={
        <Button
          startDecorator={<Save size={16} />}
          onClick={saveConfig}
          disabled={
            saving ||
            !config.subscription_id ||
            !config.tenant_id ||
            !config.client_id ||
            !config.client_secret
          }
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
            Configure the name for this Azure pool.
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

        {/* Azure Credentials Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Key
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Azure Authentication
          </Typography>

          <Box
            sx={{ mb: 2, p: 2, bgcolor: "background.level1", borderRadius: 1 }}
          >
            <Typography level="title-sm" sx={{ mb: 1 }}>
              Authentication Method: Service Principal
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
              Using service principal authentication. Configure credentials
              below.
            </Typography>
          </Box>

          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            <strong>For service principal authentication:</strong> Create a
            service principal using:
            <br />
            <code>
              az ad sp create-for-rbac --name "lattice-sky" --role contributor
            </code>
            <br />
            This will provide you with the Client ID, Client Secret, and Tenant
            ID needed below.
          </Typography>
          <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Subscription ID</FormLabel>
                <Input
                  type={showCredentials ? "text" : "password"}
                  value={
                    showCredentials && actualCredentials
                      ? actualCredentials.subscription_id
                      : config.subscription_id
                  }
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      subscription_id: e.target.value,
                    }))
                  }
                  placeholder="Enter your Azure subscription ID"
                />
              </FormControl>
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Tenant ID</FormLabel>
                <Input
                  type={showCredentials ? "text" : "password"}
                  value={
                    showCredentials && actualCredentials
                      ? actualCredentials.tenant_id
                      : config.tenant_id
                  }
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      tenant_id: e.target.value,
                    }))
                  }
                  placeholder="Enter your Azure tenant ID"
                />
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Client ID (App ID)</FormLabel>
                <Input
                  type={showCredentials ? "text" : "password"}
                  value={
                    showCredentials && actualCredentials
                      ? actualCredentials.client_id
                      : config.client_id
                  }
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      client_id: e.target.value,
                    }))
                  }
                  placeholder="Enter your Azure client ID"
                />
              </FormControl>
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Client Secret</FormLabel>
                <Input
                  type={showCredentials ? "text" : "password"}
                  value={
                    showCredentials && actualCredentials
                      ? actualCredentials.client_secret
                      : config.client_secret
                  }
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      client_secret: e.target.value,
                    }))
                  }
                  placeholder="Enter your Azure client secret"
                />
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>&nbsp;</FormLabel>
                <Box sx={{ height: "40px" }} />
              </FormControl>
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                onClick={testConnection}
                disabled={
                  loading ||
                  !config.subscription_id ||
                  !config.tenant_id ||
                  !config.client_id ||
                  !config.client_secret
                }
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
                Sky Check Azure
              </Button>
              <Button
                variant="outlined"
                onClick={async () => {
                  if (!showCredentials) {
                    await fetchActualCredentials();
                  }
                  setShowCredentials(!showCredentials);
                }}
              >
                {showCredentials ? "Hide" : "Show"} Credentials
              </Button>
            </Box>
          </Stack>
        </Card>

        {/* Sky Check Results */}
        {skyCheckResult && (
          <Card variant="outlined">
            <Typography level="h4" sx={{ mb: 2 }}>
              Sky Check Azure Results
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

        {/* Instance Types Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Server
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Allowed Instance Types
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Select which Azure instance types users can choose from when
            creating Azure clusters.
          </Typography>

          {loading && availableInstanceTypes.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress />
            </Box>
          ) : availableInstanceTypes.length === 0 ? (
            <Alert color="warning">
              No instance types available. Please ensure Azure is properly
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
                  Select Instance Types to Allow
                </Typography>
                <Chip size="sm" variant="soft" color="primary">
                  {config.allowed_instance_types?.length || 0} selected
                </Chip>
              </Box>

              <FormControl>
                <FormLabel>Instance Types</FormLabel>
                <Autocomplete
                  multiple
                  options={availableInstanceTypes}
                  getOptionLabel={(option) =>
                    `${option.name} (${option.category})`
                  }
                  value={availableInstanceTypes.filter((type) =>
                    config.allowed_instance_types.includes(type.name)
                  )}
                  onChange={(_, newValue) => {
                    setConfig((prev) => ({
                      ...prev,
                      allowed_instance_types: newValue.map((item) => item.name),
                    }));
                  }}
                  placeholder="Search and select Azure instance types..."
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
                          {option.category}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  sx={{ width: "100%" }}
                  limitTags={5}
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
                      allowed_instance_types: availableInstanceTypes.map(
                        (type) => type.name
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
                      allowed_instance_types: [],
                    }));
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Stack>
          )}
        </Card>

        {/* Regions Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Server
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Allowed Regions
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Select which Azure regions users can choose from when creating Azure
            clusters.
          </Typography>

          {loading && availableRegions.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
              <CircularProgress />
            </Box>
          ) : availableRegions.length === 0 ? (
            <Alert color="warning">
              No regions available. Please ensure Azure is properly configured
              and try refreshing.
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
                  Select Regions to Allow
                </Typography>
                <Chip size="sm" variant="soft" color="primary">
                  {config.allowed_regions.length} selected
                </Chip>
              </Box>

              <FormControl>
                <FormLabel>Regions</FormLabel>
                <Autocomplete
                  multiple
                  options={availableRegions}
                  getOptionLabel={(option) => option}
                  value={config.allowed_regions}
                  onChange={(_, newValue) => {
                    setConfig((prev) => ({
                      ...prev,
                      allowed_regions: newValue,
                    }));
                  }}
                  placeholder="Search and select Azure regions..."
                  sx={{ width: "100%" }}
                  limitTags={5}
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
                      allowed_regions: availableRegions,
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
                      allowed_regions: [],
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
            Set the maximum number of Azure instances that can be launched
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
              <Typography>Azure Authentication</Typography>
              <Chip
                variant="soft"
                color={config.is_configured ? "success" : "danger"}
                size="sm"
              >
                {config.is_configured ? "Service Principal" : "Not Configured"}
              </Chip>
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography>Allowed Instance Types</Typography>
              <Chip variant="soft" color="primary" size="sm">
                {config.allowed_instance_types?.length || 0} selected
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

export default AzureConfigPage;
