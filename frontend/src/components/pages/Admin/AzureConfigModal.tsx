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
  Grid,
  CircularProgress,
  Autocomplete,
  Box,
} from "@mui/joy";
import { Save, Key } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useNotification } from "../../../components/NotificationSystem";

interface AzureConfig {
  name: string;
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

interface AzureConfigModalProps {
  open: boolean;
  onClose: () => void;
  poolName?: string;
  onConfigSaved?: () => void;
}

const AzureConfigModal: React.FC<AzureConfigModalProps> = ({
  open,
  onClose,
  poolName = "Azure Pool",
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<AzureConfig>({
    name: "",
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
  const [showCredentials, setShowCredentials] = useState(false);
  const [actualCredentials, setActualCredentials] =
    useState<AzureConfig | null>(null);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (open) {
      fetchAzureConfig();
      fetchAvailableInstanceTypes();
      fetchAvailableRegions();
      fetchActualCredentials();
    }
  }, [open]);

  const fetchAzureConfig = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("skypilot/azure/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
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
      }
    } catch (err) {
      console.error("Error fetching Azure config:", err);
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
      } else {
        console.error("Error fetching instance types");
      }
    } catch (err) {
      console.error("Error fetching instance types:", err);
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
      } else {
        console.error("Error fetching regions");
      }
    } catch (err) {
      console.error("Error fetching regions:", err);
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
        const data = await response.json();
        setActualCredentials(data);
      }
    } catch (err) {
      console.error("Error fetching actual credentials:", err);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await apiFetch(buildApiUrl("skypilot/azure/config"), {
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
          message: "Azure configuration saved successfully",
        });
        await fetchAzureConfig();
        onClose();
        // Small delay to ensure modal is closed before refreshing
        setTimeout(() => {
          onConfigSaved?.();
        }, 100);
      } else {
        addNotification({
          type: "danger",
          message: "Failed to save Azure configuration",
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

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog size="lg">
        <ModalClose />
        <Typography level="h4">Configure {poolName}</Typography>
        <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
          Azure Configuration
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Pool Name</FormLabel>
                <Input
                  value={config.name}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter pool name (e.g., Azure Production)"
                  disabled={config.is_configured}
                />
              </FormControl>
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Subscription ID</FormLabel>
                    <Input
                      type={showCredentials ? "text" : "password"}
                      value={
                        showCredentials && actualCredentials
                          ? actualCredentials.subscription_id || ""
                          : config.subscription_id || ""
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          subscription_id: e.target.value,
                        })
                      }
                      placeholder="Enter Azure subscription ID"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Tenant ID</FormLabel>
                    <Input
                      type={showCredentials ? "text" : "password"}
                      value={
                        showCredentials && actualCredentials
                          ? actualCredentials.tenant_id || ""
                          : config.tenant_id || ""
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          tenant_id: e.target.value,
                        })
                      }
                      placeholder="Enter Azure tenant ID"
                    />
                  </FormControl>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Client ID</FormLabel>
                    <Input
                      type={showCredentials ? "text" : "password"}
                      value={
                        showCredentials && actualCredentials
                          ? actualCredentials.client_id || ""
                          : config.client_id || ""
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          client_id: e.target.value,
                        })
                      }
                      placeholder="Enter Azure client ID"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Client Secret</FormLabel>
                    <Input
                      type={showCredentials ? "text" : "password"}
                      value={
                        showCredentials && actualCredentials
                          ? actualCredentials.client_secret || ""
                          : config.client_secret || ""
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          client_secret: e.target.value,
                        })
                      }
                      placeholder="Enter Azure client secret"
                    />
                  </FormControl>
                </Grid>
              </Grid>
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
                <FormLabel>Allowed Instance Types</FormLabel>
                <Autocomplete
                  multiple
                  options={availableInstanceTypes}
                  getOptionLabel={(option) =>
                    option.display_name || option.name
                  }
                  value={availableInstanceTypes.filter((type) =>
                    config.allowed_instance_types.includes(type.name)
                  )}
                  onChange={(_, newValue) => {
                    setConfig({
                      ...config,
                      allowed_instance_types: newValue.map((item) => item.name),
                    });
                  }}
                  renderInput={(params) => (
                    <Input {...params} placeholder="Select instance types" />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Typography level="body-sm">
                        {option.display_name}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {option.category}
                      </Typography>
                    </Box>
                  )}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Allowed Regions</FormLabel>
                <Autocomplete
                  multiple
                  options={availableRegions}
                  value={config.allowed_regions}
                  onChange={(_, newValue) => {
                    setConfig({
                      ...config,
                      allowed_regions: newValue,
                    });
                  }}
                  renderInput={(params) => (
                    <Input {...params} placeholder="Select regions" />
                  )}
                />
              </FormControl>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => setShowCredentials(!showCredentials)}
                  startDecorator={<Key size={16} />}
                >
                  {showCredentials ? "Hide" : "Show"} Credentials
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
                  {saving ? "Saving..." : "Save Azure Config"}
                </Button>
              </Stack>
            </Stack>
          )}
        </Card>
      </ModalDialog>
    </Modal>
  );
};

export default AzureConfigModal;
