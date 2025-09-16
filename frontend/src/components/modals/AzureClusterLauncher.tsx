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
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../NotificationSystem";
import CostCreditsDisplay from "../widgets/CostCreditsDisplay";
import YamlConfigurationSection from "./YamlConfigurationSection";

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

interface ContainerRegistry {
  id: string;
  name: string;
  docker_username: string;
  docker_server: string;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface DockerImage {
  id: string;
  name: string;
  image_tag: string;
  description?: string;
  container_registry_id: string;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
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
  const { user } = useAuth();
  const [clusterName, setClusterName] = useState("");
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [selectedInstanceType, setSelectedInstanceType] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [diskSpace, setDiskSpace] = useState("");
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
  const [numNodes, setNumNodes] = useState<string>("1");

  const [selectedDockerImageId, setSelectedDockerImageId] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const selectedTemplate = React.useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );
  const tpl = selectedTemplate?.resources_json || {};

  // YAML configuration state
  const [useYaml, setUseYaml] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [yamlFile, setYamlFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  // Storage bucket state
  const [storageBuckets, setStorageBuckets] = useState<StorageBucket[]>([]);
  const [selectedStorageBuckets, setSelectedStorageBuckets] = useState<
    string[]
  >([]);
  const [loadingStorageBuckets, setLoadingStorageBuckets] = useState(false);

  // Docker image state
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [loadingDockerImages, setLoadingDockerImages] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAzureConfig();
      fetchAvailableInstanceTypes();
      fetchAvailableRegions();
      fetchStorageBuckets();
      fetchDockerImages();
      // Load templates for azure
      (async () => {
        try {
          const resp = await apiFetch(
            buildApiUrl("instances/templates?cloud_type=azure"),
            { credentials: "include" }
          );
          if (resp.ok) {
            const data = await resp.json();
            setTemplates(data.templates || []);
          } else {
            setTemplates([]);
          }
        } catch (e) {
          setTemplates([]);
        }
      })();
      if (user?.organization_id) {
        apiFetch(buildApiUrl(`quota/organization/${user.organization_id}`), {
          credentials: "include",
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            setAvailableCredits(Number(data.credits_remaining || 0));
          })
          .catch(() => {});
      }
    }
  }, [open, user?.organization_id]);

  // Recompute estimated cost when instance type/region/nodes change
  useEffect(() => {
    const compute = async () => {
      if (!selectedInstanceType || !selectedRegion) {
        setEstimatedCost(0);
        return;
      }
      try {
        const url = buildApiUrl(
          `clouds/azure/price?instance_type=${encodeURIComponent(
            selectedInstanceType
          )}&region=${encodeURIComponent(selectedRegion)}`
        );
        const res = await apiFetch(url, { credentials: "include" });
        if (!res.ok) {
          setEstimatedCost(0);
          return;
        }
        const data = await res.json();
        const p = Number(data.price_per_hour || 0);
        const numNodesValue = parseInt(numNodes || "1", 10);
        const nodeCount =
          isNaN(numNodesValue) || numNodesValue <= 0 ? 1 : numNodesValue;
        setEstimatedCost(!isNaN(p) ? p * 1.0 * nodeCount : 0); // 1h minimum * number of nodes
      } catch (e) {
        setEstimatedCost(0);
      }
    };
    compute();
  }, [selectedInstanceType, selectedRegion, numNodes]);

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

  const fetchDockerImages = async () => {
    try {
      setLoadingDockerImages(true);
      const response = await apiFetch(
        buildApiUrl("container-registries/images/available"),
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch docker images");
      }
      const data = await response.json();
      setDockerImages(data);
    } catch (err) {
      console.error("Error fetching docker images:", err);
    } finally {
      setLoadingDockerImages(false);
    }
  };

  const fetchAzureConfig = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clouds/azure/config"), {
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
      const response = await apiFetch(buildApiUrl("clouds/azure/info"), {
        credentials: "include",
      });
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
      const response = await apiFetch(buildApiUrl("clouds/azure/info"), {
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
    setDiskSpace("");
    setUseSpot(false);
    setIdleMinutesToAutostop("");
    setNumNodes("1");
    setSelectedTemplateId("");
    setShowAdvanced(false);
    setSelectedDockerImageId("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const launchCluster = async () => {
    // Validate YAML mode
    if (useYaml && !yamlContent.trim()) {
      addNotification({
        type: "danger",
        message: "YAML content is required when using YAML configuration",
      });
      return;
    }

    // Validate form mode
    if (!useYaml) {
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
    }

    try {
      setLoading(true);

      const formData = new FormData();

      if (useYaml) {
        // YAML mode: create a blob from the YAML content
        const yamlBlob = new Blob([yamlContent], {
          type: "application/x-yaml",
        });
        formData.append("yaml_file", yamlBlob, "config.yaml");
        formData.append("cloud", "azure");
      } else {
        // Form mode: use regular form data
        formData.append("cluster_name", clusterName);
        formData.append("command", command);
        if (setup) formData.append("setup", setup);
        formData.append("cloud", "azure");
        formData.append("instance_type", selectedInstanceType);
        formData.append("region", selectedRegion);
        if (diskSpace) formData.append("disk_space", diskSpace);
        formData.append("use_spot", useSpot.toString());
        if (idleMinutesToAutostop) {
          formData.append("idle_minutes_to_autostop", idleMinutesToAutostop);
        }

        // Only include num_nodes if > 1
        const parsedNumNodes = parseInt(numNodes || "1", 10);
        if (!isNaN(parsedNumNodes) && parsedNumNodes > 1) {
          formData.append("num_nodes", String(parsedNumNodes));
        }

        if (selectedDockerImageId)
          formData.append("docker_image_id", selectedDockerImageId);

        // Add storage bucket IDs if selected
        if (selectedStorageBuckets.length > 0) {
          formData.append(
            "storage_bucket_ids",
            selectedStorageBuckets.join(",")
          );
        }

        // If a template is selected, apply its resources on top
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (tpl && tpl.resources_json) {
          const r = tpl.resources_json || {};
          if (r.instance_type && !formData.get("instance_type"))
            formData.append("instance_type", String(r.instance_type));
          if (r.region && !formData.get("region"))
            formData.append("region", String(r.region));
          if (r.disk_space && !formData.get("disk_space"))
            formData.append("disk_space", String(r.disk_space));
          if (typeof r.use_spot !== "undefined" && !formData.get("use_spot"))
            formData.append("use_spot", String(!!r.use_spot));
          if (
            r.idle_minutes_to_autostop &&
            !formData.get("idle_minutes_to_autostop")
          )
            formData.append(
              "idle_minutes_to_autostop",
              String(r.idle_minutes_to_autostop)
            );
          if (
            r.storage_bucket_ids &&
            Array.isArray(r.storage_bucket_ids) &&
            !formData.get("storage_bucket_ids")
          )
            formData.append(
              "storage_bucket_ids",
              (r.storage_bucket_ids as any[]).join(",")
            );
        }
      }

      const response = await apiFetch(buildApiUrl("instances/launch"), {
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
          const finalClusterName = useYaml
            ? yamlContent.includes(`cluster_name:`)
              ? yamlContent
                  .split(`cluster_name:`)[1]
                  .split("\n")[0]
                  .trim()
                  .replace(/['"]/g, "")
              : clusterName
            : clusterName;
          if (onClusterLaunched) onClusterLaunched(finalClusterName);
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
      <ModalDialog
        sx={{
          maxWidth: 600,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2, flexShrink: 0 }}>
          <Rocket
            size={24}
            style={{ marginRight: 8, verticalAlign: "middle" }}
          />
          Launch Azure Cluster
        </Typography>

        <YamlConfigurationSection
          useYaml={useYaml}
          setUseYaml={setUseYaml}
          yamlContent={yamlContent}
          setYamlContent={setYamlContent}
          yamlFile={yamlFile}
          setYamlFile={setYamlFile}
          placeholder={`# Example YAML configuration:
cluster_name: my-azure-cluster
command: echo "Hello World"
setup: pip install torch
cloud: azure
instance_type: Standard_NC6s_v3
region: eastus
disk_space: 100`}
        />

        <Box sx={{ overflow: "auto", flex: 1, pr: 1 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              launchCluster();
            }}
          >
            <Stack spacing={3}>
              {!useYaml && (
                <>
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
                        <FormLabel>Number of Nodes</FormLabel>
                        <Input
                          value={numNodes}
                          onChange={(e) => setNumNodes(e.target.value)}
                          placeholder="1"
                          slotProps={{
                            input: {
                              type: "number",
                              min: 1,
                            },
                          }}
                        />
                      </FormControl>

                      {/* Setup Command (moved out of Advanced) */}
                      <FormControl>
                        <FormLabel>Setup Command (optional)</FormLabel>
                        <Textarea
                          value={setup}
                          onChange={(e) => setSetup(e.target.value)}
                          placeholder="pip install -r requirements.txt"
                          minRows={2}
                        />
                      </FormControl>

                      {/* Docker Image (moved out of Advanced) */}
                      <FormControl>
                        <FormLabel>Docker Image (optional)</FormLabel>
                        {loadingDockerImages ? (
                          <Typography level="body-sm" color="neutral">
                            Loading docker images...
                          </Typography>
                        ) : dockerImages.length === 0 ? (
                          <Typography level="body-sm" color="warning">
                            No docker images configured. You can add them in
                            Admin &gt; Private Container Registry.
                          </Typography>
                        ) : (
                          <Select
                            value={selectedDockerImageId}
                            onChange={(_, value) =>
                              setSelectedDockerImageId(value || "")
                            }
                            placeholder="Select a docker image (optional)"
                          >
                            {dockerImages.map((image) => (
                              <Option key={image.id} value={image.id}>
                                {image.name} ({image.image_tag})
                              </Option>
                            ))}
                          </Select>
                        )}
                        <Typography
                          level="body-xs"
                          sx={{ mt: 0.5, color: "text.secondary" }}
                        >
                          Use a Docker image as runtime environment. Leave empty
                          to use default VM image. Configure images in Admin
                          &gt; Private Container Registry.
                        </Typography>
                      </FormControl>

                      {/* Template selector - moved down */}
                      <FormControl>
                        <FormLabel>Template (optional)</FormLabel>
                        <Select
                          value={selectedTemplateId}
                          onChange={(_, v) => setSelectedTemplateId(v || "")}
                          placeholder="Select a template"
                        >
                          {(templates || []).map((t: any) => (
                            <Option key={t.id} value={t.id}>
                              {t.name || t.id}
                            </Option>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Advanced button - always show but disable when template is selected */}
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          mt: 2,
                        }}
                      >
                        <Button
                          variant="outlined"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          color={showAdvanced ? "primary" : "neutral"}
                          disabled={!!selectedTemplateId}
                        >
                          {selectedTemplateId
                            ? "Advanced Options (Template Selected)"
                            : showAdvanced
                            ? "Hide Advanced Options"
                            : "Show Advanced Options"}
                        </Button>
                      </Box>
                    </Stack>
                  </Card>

                  {/* Storage Buckets (moved out of Advanced) */}
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
                            No storage buckets available. Create storage buckets
                            in the "Object Storage" tab first.
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
                                {bucket.name} ({bucket.remote_path}) -{" "}
                                {bucket.mode}
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
                          Selected storage buckets will be mounted to your
                          cluster for data access
                        </Typography>
                      </FormControl>
                    </Stack>
                  </Card>

                  {/* Cost Optimization (moved out of Advanced) */}
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
                          <Typography level="title-sm">
                            Use Spot Instances
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "text.secondary" }}
                          >
                            Use spot instances for cost savings (may be
                            interrupted)
                          </Typography>
                        </Box>
                        <Switch
                          checked={useSpot}
                          onChange={(e) => setUseSpot(e.target.checked)}
                          disabled={typeof tpl.use_spot !== "undefined"}
                        />
                      </Box>

                      <FormControl>
                        <FormLabel>
                          <Clock
                            size={16}
                            style={{
                              marginRight: 8,
                              verticalAlign: "middle",
                            }}
                          />
                          Auto-stop after idle (minutes)
                        </FormLabel>
                        <Input
                          value={idleMinutesToAutostop}
                          onChange={(e) =>
                            setIdleMinutesToAutostop(e.target.value)
                          }
                          placeholder="e.g., 30 (leave empty for no auto-stop)"
                          disabled={
                            typeof tpl.idle_minutes_to_autostop !== "undefined"
                          }
                          type="number"
                        />
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary", mt: 0.5 }}
                        >
                          Cluster will automatically stop after being idle for
                          this many minutes
                        </Typography>
                      </FormControl>
                    </Stack>
                  </Card>

                  {/* Advanced fields - only show when advanced button is clicked and no template is selected */}
                  {showAdvanced && !selectedTemplateId && (
                    <>
                      <Card variant="outlined">
                        <Typography level="title-sm" sx={{ mb: 2 }}>
                          Advanced Configuration
                        </Typography>
                        <Stack spacing={2}>
                          {/* Setup and Docker Image moved above */}

                          <FormControl required>
                            <FormLabel>Instance Type</FormLabel>
                            <Select
                              value={selectedInstanceType}
                              onChange={(_, value) =>
                                setSelectedInstanceType(value || "")
                              }
                              placeholder="Select instance type"
                              required
                              disabled={
                                typeof tpl.instance_type !== "undefined"
                              }
                            >
                              {availableInstanceTypes
                                .filter((type) =>
                                  azureConfig.allowed_instance_types.includes(
                                    type.name
                                  )
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
                              onChange={(_, value) =>
                                setSelectedRegion(value || "")
                              }
                              placeholder="Select region"
                              required
                              disabled={typeof tpl.region !== "undefined"}
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

                          <FormControl>
                            <FormLabel>Disk Space (GB) - Optional</FormLabel>
                            <Input
                              value={diskSpace}
                              onChange={(e) => setDiskSpace(e.target.value)}
                              placeholder="e.g., 100, 200, 500 (leave empty for default)"
                              slotProps={{
                                input: {
                                  type: "number",
                                  min: 1,
                                },
                              }}
                              disabled={typeof tpl.disk_space !== "undefined"}
                            />
                            <Typography
                              level="body-xs"
                              sx={{ mt: 0.5, color: "text.secondary" }}
                            >
                              Custom disk size for the instance. Leave empty to
                              use default.
                            </Typography>
                          </FormControl>
                        </Stack>
                      </Card>

                      {/* Cost Optimization and Storage Buckets moved above */}
                    </>
                  )}
                </>
              )}

              {/* Cost & Credits Display */}
              {availableCredits !== null && (
                <Box sx={{ mt: 2 }}>
                  <CostCreditsDisplay
                    estimatedCost={estimatedCost}
                    availableCredits={availableCredits}
                    variant="card"
                    showWarning={true}
                  />
                  <Typography
                    level="body-xs"
                    sx={{ mt: 1, color: "text.secondary", fontStyle: "italic" }}
                  >
                    Note: Cost estimates are approximate and may vary based on
                    actual usage and resource allocation.
                  </Typography>
                </Box>
              )}
            </Stack>
          </form>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            justifyContent: "flex-end",
            mt: 2,
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            pt: 2,
          }}
        >
          <Button variant="plain" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={launchCluster}
            loading={loading}
            disabled={
              (useYaml ? !yamlContent.trim() : !clusterName) ||
              (!useYaml && !selectedInstanceType) ||
              (!useYaml && !selectedRegion) ||
              loading ||
              (availableCredits !== null && estimatedCost > availableCredits)
            }
            color="success"
          >
            Launch Azure Cluster
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default AzureClusterLauncher;
