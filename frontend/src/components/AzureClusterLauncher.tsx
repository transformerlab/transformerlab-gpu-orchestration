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
  Switch,
} from "@mui/joy";
import { Rocket, Zap, Clock, DollarSign } from "lucide-react";
import { buildApiUrl, apiFetch } from "../utils/api";
import { useNotification } from "./NotificationSystem";

interface AzureClusterLauncherProps {
  open: boolean;
  onClose: () => void;
  onClusterLaunched?: (clusterName: string) => void;
}

interface LaunchClusterResponse {
  request_id: string;
  cluster_name: string;
  message: string;
}

interface StorageBucket {
  id: string;
  name: string;
  remote_path: string;
  source?: string;
  store?: string;
  persistent: boolean;
  mode: string;
}

interface InstanceType {
  name: string;
  display_name: string;
  category: string;
}

const AzureClusterLauncher: React.FC<AzureClusterLauncherProps> = ({
  open,
  onClose,
  onClusterLaunched,
}) => {
  const [clusterName, setClusterName] = useState("");
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [selectedInstanceType, setSelectedInstanceType] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState<
    InstanceType[]
  >([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [azureConfig, setAzureConfig] = useState({
    allowed_instance_types: [] as string[],
    allowed_regions: [] as string[],
    is_configured: false,
  });
  const [useSpot, setUseSpot] = useState(false);
  const [idleMinutesToAutostop, setIdleMinutesToAutostop] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  // Storage bucket state
  const [storageBuckets, setStorageBuckets] = useState<StorageBucket[]>([]);
  const [selectedStorageBuckets, setSelectedStorageBuckets] = useState<
    string[]
  >([]);
  const [loadingStorageBuckets, setLoadingStorageBuckets] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAzureConfig();
      fetchAvailableInstanceTypes();
      fetchAvailableRegions();
      fetchStorageBuckets();
    }
  }, [open]);

  const fetchStorageBuckets = async () => {
    try {
      setLoadingStorageBuckets(true);
      const response = await apiFetch(
        buildApiUrl("storage-buckets/available"),
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch storage buckets");
      }
      const data = await response.json();
      setStorageBuckets(data);
    } catch (err) {
      console.error("Error fetching storage buckets:", err);
    } finally {
      setLoadingStorageBuckets(false);
    }
  };

  const fetchAzureConfig = async () => {
    try {
      const response = await apiFetch(buildApiUrl("skypilot/azure/config"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();

        // Handle the new multi-config structure
        if (
          data.default_config &&
          data.configs &&
          data.configs[data.default_config]
        ) {
          const defaultConfig = data.configs[data.default_config];
          setAzureConfig({
            allowed_instance_types: defaultConfig.allowed_instance_types || [],
            allowed_regions: defaultConfig.allowed_regions || [],
            is_configured: data.is_configured || false,
          });
          // Set the first allowed instance type as default
          if (
            defaultConfig.allowed_instance_types &&
            Array.isArray(defaultConfig.allowed_instance_types) &&
            defaultConfig.allowed_instance_types.length > 0
          ) {
            setSelectedInstanceType(defaultConfig.allowed_instance_types[0]);
          }
          // Set the first allowed region as default
          if (
            defaultConfig.allowed_regions &&
            Array.isArray(defaultConfig.allowed_regions) &&
            defaultConfig.allowed_regions.length > 0
          ) {
            setSelectedRegion(defaultConfig.allowed_regions[0]);
          }
        } else {
          // Fallback to legacy structure
          setAzureConfig({
            allowed_instance_types: data.allowed_instance_types || [],
            allowed_regions: data.allowed_regions || [],
            is_configured: data.is_configured || false,
          });
          // Set the first allowed instance type as default
          if (
            data.allowed_instance_types &&
            Array.isArray(data.allowed_instance_types) &&
            data.allowed_instance_types.length > 0
          ) {
            setSelectedInstanceType(data.allowed_instance_types[0]);
          }
          // Set the first allowed region as default
          if (
            data.allowed_regions &&
            Array.isArray(data.allowed_regions) &&
            data.allowed_regions.length > 0
          ) {
            setSelectedRegion(data.allowed_regions[0]);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching Azure config:", err);
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
            else if (type.includes("F")) {
              category = "Compute Optimized";
            }
            // Storage optimized instances
            else if (type.includes("L")) {
              category = "Storage Optimized";
            }

            return {
              name: type,
              display_name: type,
              category: category,
            };
          }
        );
        setAvailableInstanceTypes(instanceTypes);
      }
    } catch (err) {
      console.error("Error fetching available instance types:", err);
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

  const resetForm = () => {
    setClusterName("");
    setCommand('echo "Welcome to Lattice"');
    setSetup("");
    setSelectedInstanceType("");
    setSelectedRegion("");
    setUseSpot(false);
    setIdleMinutesToAutostop("");
    setSelectedTemplate("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const launchCluster = async () => {
    if (!clusterName.trim()) {
      addNotification({
        type: "danger",
        message: "Cluster name is required",
      });
      return;
    }

    if (!selectedInstanceType) {
      addNotification({
        type: "danger",
        message: "Instance type is required",
      });
      return;
    }

    if (!selectedRegion) {
      addNotification({
        type: "danger",
        message: "Region is required",
      });
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("cluster_name", clusterName);
      formData.append("command", command);
      if (setup) formData.append("setup", setup);
      formData.append("cloud", "azure");
      formData.append("instance_type", selectedInstanceType);
      formData.append("region", selectedRegion);
      formData.append("use_spot", useSpot.toString());
      if (idleMinutesToAutostop) {
        formData.append("idle_minutes_to_autostop", idleMinutesToAutostop);
      }
      if (selectedTemplate) formData.append("template", selectedTemplate);

      // Add storage bucket IDs if selected
      if (selectedStorageBuckets.length > 0) {
        formData.append("storage_bucket_ids", selectedStorageBuckets.join(","));
      }

      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data: LaunchClusterResponse = await response.json();
        addNotification({
          type: "success",
          message: data.message || "Azure cluster launched successfully",
        });
        setTimeout(() => {
          if (onClusterLaunched) onClusterLaunched(data.cluster_name);
          handleClose();
        }, 1200);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to launch Azure cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error launching Azure cluster",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!azureConfig.is_configured) {
    return (
      <Modal open={open} onClose={handleClose}>
        <ModalDialog sx={{ maxWidth: 500 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Azure Cluster Launcher
          </Typography>
          <Alert color="warning">
            Azure is not configured. Please configure Azure in the Admin section
            before launching clusters.
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
      <ModalDialog sx={{ maxWidth: 600 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          <Rocket
            size={24}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Launch Azure Cluster
        </Typography>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            launchCluster();
          }}
        >
          <Stack spacing={3}>
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Basic Configuration
              </Typography>
              <Stack spacing={2}>
                <FormControl required>
                  <FormLabel>Cluster Name</FormLabel>
                  <Input
                    value={clusterName}
                    onChange={(e) => setClusterName(e.target.value)}
                    placeholder="my-azure-cluster"
                    required
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Setup Command (optional)</FormLabel>
                  <Textarea
                    value={setup}
                    onChange={(e) => setSetup(e.target.value)}
                    placeholder="pip install -r requirements.txt"
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
              </Stack>
            </Card>

            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Azure Configuration
              </Typography>
              <Stack spacing={2}>
                <FormControl required>
                  <FormLabel>Instance Type</FormLabel>
                  <Select
                    value={selectedInstanceType}
                    onChange={(_, value) =>
                      setSelectedInstanceType(value || "")
                    }
                    placeholder="Select instance type"
                    required
                  >
                    {availableInstanceTypes
                      .filter((type) =>
                        azureConfig.allowed_instance_types.includes(type.name)
                      )
                      .map((type) => (
                        <Option key={type.name} value={type.name}>
                          {type.name}
                        </Option>
                      ))}
                  </Select>
                </FormControl>

                <FormControl required>
                  <FormLabel>Region</FormLabel>
                  <Select
                    value={selectedRegion}
                    onChange={(_, value) => setSelectedRegion(value || "")}
                    placeholder="Select region"
                    required
                  >
                    {availableRegions
                      .filter((region) =>
                        azureConfig.allowed_regions.includes(region)
                      )
                      .map((region) => (
                        <Option key={region} value={region}>
                          {region}
                        </Option>
                      ))}
                  </Select>
                </FormControl>
              </Stack>
            </Card>

            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                <DollarSign
                  size={16}
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                Cost Optimization
              </Typography>
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography level="title-sm">Use Spot Instances</Typography>
                    <Typography
                      level="body-xs"
                      sx={{ color: "text.secondary" }}
                    >
                      Use spot instances for cost savings (may be interrupted)
                    </Typography>
                  </Box>
                  <Switch
                    checked={useSpot}
                    onChange={(e) => setUseSpot(e.target.checked)}
                  />
                </Box>

                <FormControl>
                  <FormLabel>
                    <Clock
                      size={16}
                      style={{ marginRight: 8, verticalAlign: "middle" }}
                    />
                    Auto-stop after idle (minutes)
                  </FormLabel>
                  <Input
                    value={idleMinutesToAutostop}
                    onChange={(e) => setIdleMinutesToAutostop(e.target.value)}
                    placeholder="e.g., 30 (leave empty for no auto-stop)"
                    type="number"
                  />
                  <Typography
                    level="body-xs"
                    sx={{ color: "text.secondary", mt: 0.5 }}
                  >
                    Cluster will automatically stop after being idle for this
                    many minutes
                  </Typography>
                </FormControl>
              </Stack>
            </Card>

            {/* Storage Bucket Selection */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Storage Buckets (Optional)
              </Typography>
              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Select Storage Buckets</FormLabel>
                  {loadingStorageBuckets ? (
                    <Typography level="body-sm" color="neutral">
                      Loading storage buckets...
                    </Typography>
                  ) : storageBuckets.length === 0 ? (
                    <Typography level="body-sm" color="warning">
                      No storage buckets available. Create storage buckets in
                      the "Object Storage" tab first.
                    </Typography>
                  ) : (
                    <Select
                      multiple
                      value={selectedStorageBuckets}
                      onChange={(_, value) =>
                        setSelectedStorageBuckets(value || [])
                      }
                      placeholder="Select storage buckets to mount"
                    >
                      {storageBuckets.map((bucket) => (
                        <Option key={bucket.id} value={bucket.id}>
                          {bucket.name} ({bucket.remote_path}) - {bucket.mode}
                        </Option>
                      ))}
                    </Select>
                  )}
                  {selectedStorageBuckets.length > 0 && (
                    <Typography level="body-xs" color="primary">
                      Selected: {selectedStorageBuckets.length} bucket(s)
                    </Typography>
                  )}
                  <Typography
                    level="body-xs"
                    sx={{ color: "text.secondary", mt: 0.5 }}
                  >
                    Selected storage buckets will be mounted to your cluster for
                    data access
                  </Typography>
                </FormControl>
              </Stack>
            </Card>

            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button variant="plain" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={
                  !clusterName ||
                  !selectedInstanceType ||
                  !selectedRegion ||
                  loading
                }
                color="success"
              >
                Launch Azure Cluster
              </Button>
            </Box>
          </Stack>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default AzureClusterLauncher;
