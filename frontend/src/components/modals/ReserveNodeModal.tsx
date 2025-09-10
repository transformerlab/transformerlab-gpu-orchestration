import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Modal,
  ModalDialog,
  ModalClose,
  CardContent,
  FormControl,
  FormLabel,
  Input,
  Alert,
  Textarea,
  Select,
  Option,
  Stack,
} from "@mui/joy";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { Cluster } from "../ClusterCard";
import { useNotification } from "../NotificationSystem";
import { useAuth } from "../../context/AuthContext";
import CostCreditsDisplay from "../widgets/CostCreditsDisplay";
import YamlConfigurationSection from "./YamlConfigurationSection";

interface DockerImage {
  id: string;
  name: string;
  image_tag: string;
  description?: string;
  container_registry_id: string | null;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface ReserveNodeModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string;
  cluster?: Cluster;
  onClusterLaunched?: (clusterName: string) => void;
}

const ReserveNodeModal: React.FC<ReserveNodeModalProps> = ({
  open,
  onClose,
  clusterName,
  cluster,
  onClusterLaunched,
}) => {
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const [customClusterName, setCustomClusterName] = useState("");
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [diskSpace, setDiskSpace] = useState("");
  const [selectedDockerImageId, setSelectedDockerImageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0.0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // YAML configuration state
  const [useYaml, setUseYaml] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [yamlFile, setYamlFile] = useState<File | null>(null);

  // Docker images state
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // Fetch docker images when modal opens
  React.useEffect(() => {
    if (open) {
      fetchDockerImages();
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
      // Load SSH templates for this node pool
      (async () => {
        try {
          const resp = await apiFetch(
            buildApiUrl(
              `instances/templates?cloud_type=ssh&cloud_identifier=${encodeURIComponent(
                clusterName
              )}`
            ),
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
    }
  }, [open, user?.organization_id]);

  const fetchDockerImages = async () => {
    try {
      setLoadingImages(true);
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
      setLoadingImages(false);
    }
  };

  // Calculate max resources from cluster nodes
  const maxResources = React.useMemo(() => {
    if (!cluster || !cluster.nodes || !Array.isArray(cluster.nodes)) {
      return { maxVcpus: "", maxMemory: "" };
    }

    let maxVcpus = 0;
    let maxMemory = 0;

    cluster.nodes.forEach((node: any) => {
      if (node.resources) {
        const vcpus = parseInt(node.resources.vcpus || "0");
        const memory = parseInt(node.resources.memory_gb || "0");
        if (vcpus > maxVcpus) maxVcpus = vcpus;
        if (memory > maxMemory) maxMemory = memory;
      }
    });

    return {
      maxVcpus: maxVcpus > 0 ? maxVcpus.toString() : "",
      maxMemory: maxMemory > 0 ? maxMemory.toString() : "",
    };
  }, [cluster]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate YAML mode
    if (useYaml && !yamlContent.trim()) {
      addNotification({
        type: "danger",
        message: "YAML content is required when using YAML configuration",
      });
      setLoading(false);
      return;
    }

    // Validate form mode
    if (!useYaml) {
      // Validate resource limits
      if (maxResources.maxVcpus && cpus) {
        const requestedCpus = parseInt(cpus);
        const maxCpus = parseInt(maxResources.maxVcpus);
        if (requestedCpus > maxCpus) {
          addNotification({
            type: "danger",
            message: `Requested vCPUs (${requestedCpus}) exceeds maximum available (${maxCpus})`,
          });
          setLoading(false);
          return;
        }
      }

      if (maxResources.maxMemory && memory) {
        const requestedMemory = parseInt(memory);
        const maxMemory = parseInt(maxResources.maxMemory);
        if (requestedMemory > maxMemory) {
          addNotification({
            type: "danger",
            message: `Requested memory (${requestedMemory}GB) exceeds maximum available (${maxMemory}GB)`,
          });
          setLoading(false);
          return;
        }
      }
    }

    try {
      const formData = new FormData();

      if (useYaml) {
        // YAML mode: create a blob from the YAML content
        const yamlBlob = new Blob([yamlContent], {
          type: "application/x-yaml",
        });
        formData.append("yaml_file", yamlBlob, "config.yaml");

        // Still append node_pool_name for SSH mode
        formData.append("node_pool_name", clusterName);
        formData.append("cloud", "ssh");
      } else {
        // Form mode: use regular form data
        // Use custom cluster name if provided, otherwise use node pool name
        const finalClusterName = customClusterName.trim() || clusterName;
        formData.append("cluster_name", finalClusterName);
        formData.append("node_pool_name", clusterName); // Pass the node pool name separately
        formData.append("command", command);
        if (setup) formData.append("setup", setup);
        formData.append("cloud", "ssh"); // Always use SSH mode
        if (cpus) formData.append("cpus", cpus);
        if (memory) formData.append("memory", memory);
        if (accelerators) formData.append("accelerators", accelerators);
        if (diskSpace) formData.append("disk_space", diskSpace);
        if (selectedDockerImageId)
          formData.append("docker_image_id", selectedDockerImageId);
        formData.append("use_spot", "false");
        formData.append("launch_mode", "custom");

        // Apply template if selected
        const tpl = templates.find((t) => t.id === selectedTemplateId);
        if (tpl && tpl.resources_json) {
          const r = tpl.resources_json || {};
          if (r.cpus && !formData.get("cpus"))
            formData.append("cpus", String(r.cpus));
          if (r.memory && !formData.get("memory"))
            formData.append("memory", String(r.memory));
          if (r.accelerators && !formData.get("accelerators"))
            formData.append("accelerators", String(r.accelerators));
          if (r.disk_space && !formData.get("disk_space"))
            formData.append("disk_space", String(r.disk_space));
          if (r.docker_image_id && !formData.get("docker_image_id"))
            formData.append("docker_image_id", String(r.docker_image_id));
        }
      }

      const response = await apiFetch(buildApiUrl("instances/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        addNotification({
          type: "success",
          message: data.message || "Node reserved successfully",
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
            : customClusterName.trim() || clusterName;
          if (onClusterLaunched) onClusterLaunched(finalClusterName);
          onClose();
        }, 1200);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to reserve node",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error reserving node",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 600,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          Reserve an Instance - {clusterName}
        </Typography>

        <YamlConfigurationSection
          useYaml={useYaml}
          setUseYaml={setUseYaml}
          yamlContent={yamlContent}
          setYamlContent={setYamlContent}
          yamlFile={yamlFile}
          setYamlFile={setYamlFile}
          clusterName={clusterName}
        />

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            pr: 1,
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "var(--joy-palette-neutral-300)",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "var(--joy-palette-neutral-400)",
            },
          }}
        >
          <form onSubmit={handleSubmit}>
            <Alert color="primary" sx={{ mb: 2 }}>
              <Typography level="body-sm">
                <strong>Direct Connect Mode:</strong> This will reserve an
                instance from the {clusterName} node pool using direct SSH
                connection.
              </Typography>
            </Alert>

            {!useYaml && (
              <>
                <FormControl sx={{ mb: 2 }}>
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
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Cluster Name (optional)</FormLabel>
                  <Input
                    value={customClusterName}
                    onChange={(e) => setCustomClusterName(e.target.value)}
                    placeholder={`Leave empty to use node pool name: ${clusterName}`}
                  />
                  <Typography
                    level="body-xs"
                    sx={{ mt: 0.5, color: "text.secondary" }}
                  >
                    Custom name for this cluster instance. If empty, will use
                    the node pool name.
                  </Typography>
                </FormControl>

                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Setup Command (optional)</FormLabel>
                  <Textarea
                    value={setup}
                    onChange={(e) => setSetup(e.target.value)}
                    placeholder="pip install -r requirements.txt"
                    minRows={2}
                  />
                </FormControl>

                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Docker Image (optional)</FormLabel>
                  {loadingImages ? (
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
                    use default VM image. Images are managed by your admin.
                  </Typography>
                </FormControl>

                {/* Resource Configuration */}
                <Box
                  sx={{
                    mb: 2,
                    mt: 2,
                    p: 2,
                    border: "1px solid var(--joy-palette-neutral-300)",
                    borderRadius: "var(--joy-radius-md)",
                    backgroundColor: "var(--joy-palette-neutral-50)",
                  }}
                >
                  <Typography level="title-sm" sx={{ mb: 2 }}>
                    Resource Configuration
                  </Typography>
                  {maxResources.maxVcpus || maxResources.maxMemory ? (
                    <Alert color="primary" sx={{ mb: 2 }}>
                      <Typography level="body-sm">
                        <strong>Available Resources:</strong> Max vCPUs:{" "}
                        {maxResources.maxVcpus || "Not specified"}, Max Memory:{" "}
                        {maxResources.maxMemory || "Not specified"} GB
                      </Typography>
                    </Alert>
                  ) : null}
                  <FormControl sx={{ mb: 2 }}>
                    <FormLabel>CPUs</FormLabel>
                    <Input
                      value={cpus}
                      onChange={(e) => setCpus(e.target.value)}
                      placeholder={
                        maxResources.maxVcpus
                          ? `Max: ${maxResources.maxVcpus}`
                          : "e.g., 4, 8+"
                      }
                    />
                  </FormControl>
                  <FormControl sx={{ mb: 2 }}>
                    <FormLabel>Memory (GB)</FormLabel>
                    <Input
                      value={memory}
                      onChange={(e) => setMemory(e.target.value)}
                      placeholder={
                        maxResources.maxMemory
                          ? `Max: ${maxResources.maxMemory} GB`
                          : "e.g., 16, 32+"
                      }
                    />
                  </FormControl>
                  <FormControl sx={{ mb: 2 }}>
                    <FormLabel>Accelerators</FormLabel>
                    <Input
                      value={accelerators}
                      onChange={(e) => setAccelerators(e.target.value)}
                      placeholder="e.g., V100, V100:2, A100:4"
                    />
                  </FormControl>
                  <FormControl sx={{ mb: 2 }}>
                    <FormLabel>Disk Space (GB)</FormLabel>
                    <Input
                      value={diskSpace}
                      onChange={(e) => setDiskSpace(e.target.value)}
                      placeholder="e.g., 100, 200, 500"
                      slotProps={{
                        input: {
                          type: "number",
                          min: 1,
                        },
                      }}
                    />
                  </FormControl>
                </Box>

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
                      sx={{
                        mt: 1,
                        color: "text.secondary",
                        fontStyle: "italic",
                      }}
                    >
                      Note: Cost estimates are approximate and may vary based on
                      actual usage and resource allocation.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </form>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            justifyContent: "flex-end",
            pt: 2,
            borderTop: "1px solid var(--joy-palette-neutral-200)",
            mt: 1,
          }}
        >
          <Button variant="plain" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={
              (useYaml ? !yamlContent.trim() : !command) ||
              loading ||
              (availableCredits !== null && estimatedCost > availableCredits)
            }
            color="success"
            onClick={handleSubmit}
          >
            Reserve Node
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default ReserveNodeModal;
