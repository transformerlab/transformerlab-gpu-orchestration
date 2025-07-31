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
import { Save, Key, Server, Settings } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

interface AzureConfig {
  subscription_id: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  allowed_instance_types: string[];
  is_configured: boolean;
  auth_method: "cli" | "service_principal";
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
    is_configured: false,
    auth_method: "cli",
    max_instances: 0,
  });
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState<
    InstanceType[]
  >([]);
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
  }, []);

  const fetchAzureConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("skypilot/azure/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
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
        const instanceTypes = data.instance_types.map((type: string) => {
          // Parse instance type to extract category and display name
          let category = "General Purpose";
          let display_name = type;

          if (
            type.includes("NC") ||
            type.includes("ND") ||
            type.includes("NV")
          ) {
            category = "GPU";
          } else if (type.includes("E")) {
            category = "Memory Optimized";
          } else if (type.includes("D")) {
            category = "General Purpose";
          }

          return {
            name: type,
            display_name: type,
            category,
          };
        });
        setAvailableInstanceTypes(instanceTypes);
      }
    } catch (err) {
      console.error("Error fetching instance types:", err);
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
          max_instances: config.max_instances,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data);
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
        body: JSON.stringify(testCredentials),
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
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography level="title-sm">
                Current Authentication Method:{" "}
                {config.auth_method === "cli"
                  ? "Azure CLI"
                  : "Service Principal"}
              </Typography>
              <Button
                size="sm"
                variant="outlined"
                onClick={() => {
                  setConfig((prev) => ({
                    ...prev,
                    auth_method:
                      prev.auth_method === "cli" ? "service_principal" : "cli",
                    // Clear service principal credentials when switching to CLI
                    ...(prev.auth_method === "service_principal" && {
                      tenant_id: "",
                      client_id: "",
                      client_secret: "",
                    }),
                  }));
                }}
              >
                Switch to{" "}
                {config.auth_method === "cli" ? "Service Principal" : "CLI"}
              </Button>
            </Box>
            {config.auth_method === "cli" ? (
              <Typography level="body-sm" color="text.secondary">
                Using Azure CLI authentication. Make sure you're logged in with:{" "}
                <code>az login</code>
              </Typography>
            ) : (
              <Typography level="body-sm" color="text.secondary">
                Using service principal authentication. Configure credentials
                below.
              </Typography>
            )}
          </Box>

          <Typography level="body-sm" sx={{ mb: 2, color: "text.secondary" }}>
            You can use either Azure CLI authentication (simpler) or service
            principal authentication (more secure for production).
            <br />
            <strong>For CLI authentication:</strong> Just run{" "}
            <code>az login</code> in your terminal
            <br />
            <strong>For service principal:</strong> Create one using:
            <br />
            <code>
              az ad sp create-for-rbac --name "lattice-sky" --role contributor
            </code>
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

            {/* Service Principal Fields - Only show when using service principal auth */}
            {config.auth_method === "service_principal" && (
              <>
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
              </>
            )}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                startDecorator={<Save size={16} />}
                onClick={saveConfig}
                disabled={
                  saving ||
                  !config.subscription_id ||
                  (config.auth_method === "service_principal" &&
                    (!config.tenant_id ||
                      !config.client_id ||
                      !config.client_secret))
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
                  (config.auth_method === "service_principal" &&
                    (!config.tenant_id ||
                      !config.client_id ||
                      !config.client_secret))
                }
                loading={loading}
              >
                Test Connection
              </Button>
              {config.auth_method === "service_principal" && (
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
              )}
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
          <Typography level="body-sm" sx={{ mb: 2, color: "text.secondary" }}>
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

              <Grid container spacing={2}>
                {availableInstanceTypes.map((instanceType) => {
                  const isSelected = config.allowed_instance_types.includes(
                    instanceType.name
                  );
                  return (
                    <Grid xs={12} sm={6} md={4} key={instanceType.name}>
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
                            allowed_instance_types: isSelected
                              ? prev.allowed_instance_types.filter(
                                  (t) => t !== instanceType.name
                                )
                              : [
                                  ...prev.allowed_instance_types,
                                  instanceType.name,
                                ],
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
                            {instanceType.name}
                          </Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "text.secondary" }}
                          >
                            {instanceType.category}
                          </Typography>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={isSelected ? "primary" : "neutral"}
                            sx={{ alignSelf: "flex-start" }}
                          >
                            {instanceType.category}
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
                sx={{ color: "text.secondary", mt: 0.5 }}
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
                {config.is_configured
                  ? config.auth_method === "cli"
                    ? "CLI"
                    : "Service Principal"
                  : "Not Configured"}
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
