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
  Checkbox,
} from "@mui/joy";
import { Rocket, Zap } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../NotificationSystem";
import CostCreditsDisplay from "../widgets/CostCreditsDisplay";
import YamlConfigurationSection from "./YamlConfigurationSection";
import { appendSemicolons } from "../../utils/commandUtils";

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
}

interface RunPodClusterLauncherProps {
  open: boolean;
  onClose: () => void;
  onClusterLaunched?: (clusterName: string) => void;
  runpodConfig: RunPodConfig;
}

interface LaunchClusterResponse {
  request_id: string;
  cluster_name: string;
  message: string;
}

interface GpuType {
  name: string;
  count: string;
  display_name: string;
  full_string: string;
  price: string;
  type: string;
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

const RunPodClusterLauncher: React.FC<RunPodClusterLauncherProps> = ({
  open,
  onClose,
  onClusterLaunched,
  runpodConfig,
}) => {
  const { user } = useAuth();
  const [clusterName, setClusterName] = useState("");
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [selectedGpuType, setSelectedGpuType] = useState("");
  const [selectedGpuFullString, setSelectedGpuFullString] = useState("");
  const [diskSpace, setDiskSpace] = useState("");

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

  const [availableGpuTypes, setAvailableGpuTypes] = useState<GpuType[]>([]);
  const [isLoadingGpuTypes, setIsLoadingGpuTypes] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [autoAppendSemicolons, setAutoAppendSemicolons] = useState(false);

  // Docker image state
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [loadingDockerImages, setLoadingDockerImages] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (open) {
      fetchAvailableGpuTypes();
      fetchDockerImages();
      // Load templates for runpod
      (async () => {
        try {
          const resp = await apiFetch(
            buildApiUrl("instances/templates?cloud_type=runpod"),
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
      // Set the first allowed GPU type as default when config is available
      if (
        runpodConfig.allowed_gpu_types &&
        runpodConfig.allowed_gpu_types.length > 0
      ) {
        setSelectedGpuType(runpodConfig.allowed_gpu_types[0]);
      }
      // Fetch current user's remaining credits
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
    } else {
      // Reset loading state when modal closes
      setIsLoadingGpuTypes(false);
    }
  }, [open, runpodConfig.allowed_gpu_types, user?.organization_id]);

  const fetchAvailableGpuTypes = async () => {
    setIsLoadingGpuTypes(true);
    try {
      const response = await apiFetch(buildApiUrl("clouds/runpod/info"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        console.log("RunPod display options in launcher:", data);
        const gpuTypes = data.display_options_with_pricing.map(
          (option: any) => ({
            name: option.name,
            count: option.accelerator_count || "1",
            display_name: option.display_name,
            price: option.price,
            full_string: option.name, // Use the name as the full string
            type: option.type,
          })
        );
        setAvailableGpuTypes(gpuTypes);
      }
    } catch (err) {
      console.error("Error fetching display options:", err);
    } finally {
      setIsLoadingGpuTypes(false);
    }
  };

  useEffect(() => {
    // Recompute estimated cost when selection changes
    const opt = availableGpuTypes.find(
      (o) => o.full_string === selectedGpuFullString
    );
    if (opt && opt.price) {
      const priceNum = parseFloat(String(opt.price).replace(/[^0-9.]/g, ""));
      if (!isNaN(priceNum)) {
        // Assume 1 hour minimum
        setEstimatedCost(priceNum * 1.0);
        return;
      }
    }
    setEstimatedCost(0);
  }, [selectedGpuFullString, availableGpuTypes]);

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

  const resetForm = () => {
    setClusterName("");
    setCommand('echo "Welcome to Lattice"');
    setSetup("");
    setSelectedGpuType("");
    setSelectedGpuFullString("");
    setDiskSpace("");
    setSelectedTemplateId("");
    setShowAdvanced(false);
    setSelectedDockerImageId("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const launchCluster = async () => {
    // Close modal immediately and reset form
    handleClose();

    // Validate YAML mode
    if (useYaml && !yamlContent.trim()) {
      addNotification({
        type: "danger",
        message: "YAML content is required when using YAML configuration",
      });
      return;
    }

    // Show immediate notification that request is being processed
    const finalClusterName = useYaml
      ? yamlContent.includes(`cluster_name:`)
        ? yamlContent
            .split(`cluster_name:`)[1]
            .split("\n")[0]
            .trim()
            .replace(/['"]/g, "")
        : clusterName
      : clusterName;

    addNotification({
      type: "success",
      message: `Launching RunPod cluster "${finalClusterName}"...`,
    });

    try {
      const formData = new FormData();

      if (useYaml) {
        // YAML mode: create a blob from the YAML content
        const yamlBlob = new Blob([yamlContent], {
          type: "application/x-yaml",
        });
        formData.append("yaml_file", yamlBlob, "config.yaml");
        formData.append("cloud", "runpod");
      } else {
        // Form mode: use regular form data
        formData.append("cluster_name", clusterName);
        const finalCommand = autoAppendSemicolons
          ? appendSemicolons(command)
          : command;
        const finalSetup = autoAppendSemicolons
          ? appendSemicolons(setup)
          : setup;
        formData.append("command", finalCommand);
        if (finalSetup) formData.append("setup", finalSetup);
        formData.append("cloud", "runpod");
        if (selectedGpuFullString)
          formData.append("accelerators", selectedGpuFullString);
        if (diskSpace) formData.append("disk_space", diskSpace);
        formData.append("use_spot", "false");
        formData.append("launch_mode", "custom");

        if (selectedDockerImageId)
          formData.append("docker_image_id", selectedDockerImageId);

        // If a template is selected, apply its resources on top (template wins for missing fields)
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (tpl && tpl.resources_json) {
          const r = tpl.resources_json || {};
          if (r.accelerators && !formData.get("accelerators"))
            formData.append("accelerators", String(r.accelerators));
          if (r.disk_space && !formData.get("disk_space"))
            formData.append("disk_space", String(r.disk_space));
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
          message: data.message,
        });

        // Trigger cluster list refresh
        if (onClusterLaunched) {
          onClusterLaunched(finalClusterName);
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to launch RunPod cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error launching RunPod cluster",
      });
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          <Zap size={20} style={{ marginRight: 8, verticalAlign: "middle" }} />
          Reserve an Instance on RunPod
        </Typography>

        <YamlConfigurationSection
          useYaml={useYaml}
          setUseYaml={setUseYaml}
          yamlContent={yamlContent}
          setYamlContent={setYamlContent}
          yamlFile={yamlFile}
          setYamlFile={setYamlFile}
          placeholder={`# Example YAML configuration:
cluster_name: my-runpod-cluster
command: echo "Hello World"
setup: pip install torch
cloud: runpod
accelerators: RTX4090
disk_space: 100`}
        />

        {!useYaml && (
          <Stack spacing={3}>
            <FormControl required>
              <FormLabel>Cluster Name</FormLabel>
              <Input
                value={clusterName}
                onChange={(e) => setClusterName(e.target.value)}
                placeholder="my-runpod-cluster"
              />
            </FormControl>

            {/* Setup Command (moved out of Advanced) */}
            <FormControl>
              <FormLabel>Setup Command (optional)</FormLabel>
              <Textarea
                value={setup}
                onChange={(e) => setSetup(e.target.value)}
                placeholder="pip install torch transformers"
                minRows={2}
              />
              <Typography level="body-xs" sx={{ mt: 0.5 }}>
                Use <code>;</code> at the end of each line for separate
                commands, or enable auto-append.
              </Typography>
            </FormControl>
            <FormControl>
              <Checkbox
                label="Auto-append ; to each non-empty line"
                checked={autoAppendSemicolons}
                onChange={(e) => setAutoAppendSemicolons(e.target.checked)}
              />
            </FormControl>

            {/* Docker Image (moved out of Advanced) */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Docker Configuration (Optional)
              </Typography>
              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Docker Image</FormLabel>
                  {loadingDockerImages ? (
                    <Typography level="body-sm" color="neutral">
                      Loading docker images...
                    </Typography>
                  ) : dockerImages.length === 0 ? (
                    <Typography level="body-sm" color="warning">
                      No docker images configured. You can add them in Admin
                      &gt; Private Container Registry.
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
                    Use a Docker image as runtime environment. Leave empty to
                    use default RunPod image. Configure images in Admin &gt;
                    Private Container Registry.
                  </Typography>
                </FormControl>
              </Stack>
            </Card>

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
            <Box sx={{ display: "flex", justifyContent: "center" }}>
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

            {/* Advanced fields - only show when advanced button is clicked and no template is selected */}
            {showAdvanced && !selectedTemplateId && (
              <>
                {/* Setup Command and Docker Image moved above */}

                <FormControl required>
                  <FormLabel>GPU Type</FormLabel>
                  <Select
                    value={selectedGpuFullString}
                    onChange={(_, value) => {
                      setSelectedGpuFullString(value || "");
                      // Extract the GPU name from the full string for the backend
                      if (value) {
                        const [name] = value.split(":");
                        setSelectedGpuType(name);
                      } else {
                        setSelectedGpuType("");
                      }
                    }}
                    placeholder={
                      isLoadingGpuTypes
                        ? "Loading available GPU types..."
                        : availableGpuTypes.length === 0
                        ? "No GPU types available"
                        : "Select GPU type"
                    }
                    disabled={
                      isLoadingGpuTypes ||
                      typeof tpl.accelerators !== "undefined"
                    }
                  >
                    {(() => {
                      if (isLoadingGpuTypes) {
                        return (
                          <Option value="" disabled>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <CircularProgress size="sm" />
                              Loading GPU types...
                            </Box>
                          </Option>
                        );
                      }

                      // Only filter if we have both config and GPU types loaded
                      if (
                        !runpodConfig.allowed_gpu_types ||
                        availableGpuTypes.length === 0
                      ) {
                        return [];
                      }

                      const filteredGpus = availableGpuTypes.filter((gpu) => {
                        // Check if the GPU is in the allowed list
                        // Both config and API now use "GPU_NAME:COUNT" format with integer counts
                        const isAllowed =
                          runpodConfig.allowed_gpu_types?.includes(
                            gpu.full_string
                          );
                        return isAllowed;
                      });

                      // Only show allowed GPUs, don't fallback to all available GPUs
                      return filteredGpus.map((gpu) => (
                        <Option key={gpu.full_string} value={gpu.full_string}>
                          {gpu.display_name}
                        </Option>
                      ));
                    })()}
                  </Select>
                  <Typography
                    level="body-xs"
                    sx={{ mt: 0.5, color: "text.secondary" }}
                  >
                    {!isLoadingGpuTypes &&
                      availableGpuTypes.length > 0 &&
                      availableGpuTypes.filter((gpu) =>
                        runpodConfig.allowed_gpu_types?.includes(
                          gpu.full_string
                        )
                      ).length === 0 && (
                        <span style={{ color: "orange" }}>
                          {" "}
                          No GPU types are allowed in the current configuration.
                          Please configure allowed GPU/CPU types in the Admin
                          section.
                        </span>
                      )}
                  </Typography>
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
                    Only used for CPU instances. GPU instances use default disk
                    sizing.
                  </Typography>
                </FormControl>
              </>
            )}

            <Card variant="soft" sx={{ p: 2 }}>
              <Typography level="title-sm" sx={{ mb: 1 }}>
                RunPod Configuration Status
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip size="sm" variant="soft" color="success">
                  Configured
                </Chip>
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    isLoadingGpuTypes
                      ? "neutral"
                      : availableGpuTypes.filter((gpu) =>
                          runpodConfig.allowed_gpu_types?.includes(
                            gpu.full_string
                          )
                        ).length > 0
                      ? "primary"
                      : "warning"
                  }
                >
                  {isLoadingGpuTypes ? (
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <CircularProgress size="sm" />
                      Loading...
                    </Box>
                  ) : (
                    `${
                      availableGpuTypes.filter((gpu) =>
                        runpodConfig.allowed_gpu_types?.includes(
                          gpu.full_string
                        )
                      ).length || 0
                    } GPU types allowed`
                  )}
                </Chip>
              </Stack>
              {!isLoadingGpuTypes &&
                availableGpuTypes.filter((gpu) =>
                  runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
                ).length === 0 && (
                  <Typography
                    level="body-xs"
                    sx={{ mt: 1, color: "warning.500" }}
                  >
                    No GPU types are configured as allowed. Please configure
                    allowed GPU types in the Admin section.
                  </Typography>
                )}
            </Card>
          </Stack>
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
              Note: Cost estimates are approximate and may vary based on actual
              usage and resource allocation.
            </Typography>
          </Box>
        )}

        <Box
          sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 3 }}
        >
          <Button variant="plain" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            startDecorator={<Rocket size={16} />}
            onClick={launchCluster}
            disabled={
              (useYaml ? !yamlContent.trim() : !clusterName) ||
              (!useYaml && !selectedGpuType) ||
              (!useYaml && isLoadingGpuTypes) ||
              (!useYaml &&
                availableGpuTypes.filter((gpu) =>
                  runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
                ).length === 0) ||
              (availableCredits !== null && estimatedCost > availableCredits)
            }
            color="success"
          >
            Reserve a RunPod Node
          </Button>
        </Box>

        {!isLoadingGpuTypes &&
          availableGpuTypes.filter((gpu) =>
            runpodConfig.allowed_gpu_types?.includes(gpu.full_string)
          ).length === 0 && (
            <Alert color="warning" sx={{ mt: 2 }}>
              No GPU types are allowed in the current configuration. Please
              configure allowed GPU types in the Admin section before launching
              clusters.
            </Alert>
          )}
      </ModalDialog>
    </Modal>
  );
};

export default RunPodClusterLauncher;
