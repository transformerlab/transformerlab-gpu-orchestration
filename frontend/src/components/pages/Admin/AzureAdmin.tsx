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
  Autocomplete,
} from "@mui/joy";
import { Save, Key, Server, Settings } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

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

const AzureAdmin: React.FC = () => {
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
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState<
    InstanceType[]
  >([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [actualCredentials, setActualCredentials] =
    useState<AzureConfig | null>(null);

  useEffect(() => {
    fetchAzureConfig();
    fetchAvailableInstanceTypes();
    fetchAvailableRegions();
  }, []);

  const fetchAzureConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("skypilot/azure/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        // Force auth_method to be service_principal and add null checks
        setConfig({
          subscription_id: data.subscription_id || "",
          tenant_id: data.tenant_id || "",
          client_id: data.client_id || "",
          client_secret: data.client_secret || "",
          allowed_instance_types: data.allowed_instance_types || [],
          allowed_regions: data.allowed_regions || [],
          is_configured: data.is_configured || false,
          auth_method: "service_principal",
          max_instances: data.max_instances || 0,
        });
      } else {
        setError("Failed to fetch Azure configuration");
      }
    } catch (err) {
      setError("Error fetching Azure configuration");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableInstanceTypes = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("skypilot/azure/instance-types"),
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        const instanceTypes = (data.instance_types || []).map(
          (type: string) => {
            // Parse instance type to extract category and display name
            let category = "General Purpose";
            let display_name = type;

            // GPU instances
            if (
              type.includes("NC") ||
              type.includes("ND") ||
              type.includes("NV") ||
              type.includes("NP") ||
              type.includes("H")
            ) {
              category = "GPU";
            }
            // Memory optimized instances
            else if (
              type.includes("E") ||
              type.includes("M") ||
              type.includes("R")
            ) {
              category = "Memory Optimized";
            }
            // Compute optimized instances
            else if (type.includes("F") || type.includes("H")) {
              category = "Compute Optimized";
            }
            // Storage optimized instances
            else if (type.includes("L") || type.includes("G")) {
              category = "Storage Optimized";
            }
            // General purpose instances (D series and others)
            else if (
              type.includes("D") ||
              type.includes("A") ||
              type.includes("B")
            ) {
              category = "General Purpose";
            }
            // Default
            else {
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
      }
    } catch (err) {
      console.error("Error fetching instance types:", err);
      setAvailableInstanceTypes([]);
    }
  };

  const fetchAvailableRegions = async () => {
    try {
      const response = await apiFetch(buildApiUrl("skypilot/azure/regions"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableRegions(data.regions || []);
      }
    } catch (err) {
      console.error("Error fetching available regions:", err);
      setAvailableRegions([]);
    }
  };

  const fetchActualCredentials = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("skypilot/azure/config/actual"),
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const actualConfig = await response.json();
        setActualCredentials(actualConfig);
      }
    } catch (err) {
      console.error("Error fetching actual credentials:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await apiFetch(buildApiUrl("skypilot/azure/config"), {
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
          allowed_instance_types: config.allowed_instance_types,
          allowed_regions: config.allowed_regions,
          max_instances: config.max_instances,
          auth_method: "service_principal",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig({ ...data, auth_method: "service_principal" });
        setSuccess("Azure configuration saved successfully");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to save Azure configuration");
      }
    } catch (err) {
      setError("Error saving Azure configuration");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Get the actual config (not masked) for testing
      const actualConfigResponse = await apiFetch(
        buildApiUrl("skypilot/azure/config/actual"),
        {
          credentials: "include",
        }
      );

      let testCredentials = {
        subscription_id: config.subscription_id,
        tenant_id: config.tenant_id,
        client_id: config.client_id,
        client_secret: config.client_secret,
      };

      if (actualConfigResponse.ok) {
        const actualConfig = await actualConfigResponse.json();
        // Use actual credentials from saved config
        testCredentials = {
          subscription_id: actualConfig.subscription_id,
          tenant_id: actualConfig.tenant_id,
          client_id: actualConfig.client_id,
          client_secret: actualConfig.client_secret,
        };
      }

      const response = await apiFetch(buildApiUrl("skypilot/azure/test"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...testCredentials,
          auth_mode: "service_principal",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess("Azure connection test successful");
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Azure connection test failed");
      }
    } catch (err) {
      setError("Error testing Azure connection");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWithTitle
        title="Azure Configuration"
        subtitle="Configure Azure credentials and allowed instance types for on-demand clusters."
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title="Azure Configuration"
      subtitle="Configure Azure credentials and allowed instance types for on-demand clusters."
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
        {/* Azure Credentials Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Key
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Azure Authentication
          </Typography>

          {/* Authentication Method Info */}
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

            {/* Service Principal Fields - Always show since we only support service principal auth */}
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
            <Box sx={{ display: "flex", gap: 1 }}>
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
              >
                Save Configuration
              </Button>
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

          {availableInstanceTypes.length === 0 ? (
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
                  {config.allowed_instance_types.length} selected
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

          {availableRegions.length === 0 ? (
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
                {config.allowed_instance_types.length} selected
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

export default AzureAdmin;
