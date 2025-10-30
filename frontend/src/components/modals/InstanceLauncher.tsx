import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Stack,
  Textarea,
  Modal,
  ModalDialog,
  ModalClose,
  CardContent,
  FormControl,
  FormLabel,
  Input,
  Alert,
  Checkbox,
  Select,
  Option,
  FormHelperText,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "@mui/joy";
import { Rocket } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useNotification } from "../NotificationSystem";
import YamlConfigurationSection from "./YamlConfigurationSection";
import { appendSemicolons } from "../../utils/commandUtils";

interface InstanceLauncherProps {
  open: boolean;
  onClose: () => void;
}

const InstanceLauncher: React.FC<InstanceLauncherProps> = ({
  open,
  onClose,
}) => {
  const [instanceName, setInstanceName] = useState("");
  const [setupCommand, setSetupCommand] = useState("");
  const [vcpus, setVcpus] = useState("");
  const [memory, setMemory] = useState("");
  const [gpus, setGpus] = useState("");
  const [diskSpace, setDiskSpace] = useState("");
  const [numNodes, setNumNodes] = useState<string>("1");
  const [zone, setZone] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addNotification } = useNotification();
  const [autoAppendSemicolons, setAutoAppendSemicolons] = useState(false);

  // Template-related state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // YAML configuration state
  const [useYaml, setUseYaml] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [yamlFile, setYamlFile] = useState<File | null>(null);

  // Directory upload state (optional)
  const [dirFiles, setDirFiles] = useState<FileList | null>(null);
  const [uploadedDirPath, setUploadedDirPath] = useState<string | null>(null);

  const selectedTemplate = React.useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );
  const tpl = selectedTemplate?.resources_json || {};

  // Fetch templates when modal opens
  React.useEffect(() => {
    if (open) {
      resetForm();
      setError("");
      setLoading(false);
      setDirFiles(null);
      setUploadedDirPath(null);
      setUseYaml(false);
      setYamlContent("");
      setYamlFile(null);
      // Load templates for general instance launching
      (async () => {
        try {
          const resp = await apiFetch(
            buildApiUrl("instances/templates?cloud_type=aws"),
            { credentials: "include" },
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
  }, [open]);

  const resetForm = () => {
    setInstanceName("");
    setSetupCommand("");
    setVcpus("");
    setMemory("");
    setGpus("");
    setDiskSpace("");
    setNumNodes("1");
    setZone("");
    setRegion("");
    setSelectedTemplateId("");
    setShowAdvanced(false);
    setUseYaml(false);
    setYamlContent("");
    setYamlFile(null);
    setDirFiles(null);
    setUploadedDirPath(null);
  };

  const deriveDirName = (files: FileList | null): string | null => {
    if (!files || files.length === 0) return null;
    const first: any = files[0];
    const path: string | undefined = first.webkitRelativePath;
    if (path && path.includes("/")) {
      const base = path.split("/")[0];
      return base || null;
    }
    return null;
  };

  const handleDirectoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setDirFiles(files);
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate YAML mode
    if (useYaml && !yamlContent.trim()) {
      addNotification({
        type: "danger",
        message: "YAML content is required when using YAML configuration",
      });
      setLoading(false);
      return;
    }

    try {
      // Use the instance name from the form
      const clusterName = instanceName || `instance-${Date.now()}`;

      let latestUploadedDirPath: string | null = null;

      // Step 1: Upload directory files if provided (supported in both modes)
      if (dirFiles && dirFiles.length > 0) {
        const uploadFormData = new FormData();
        const dirName = deriveDirName(dirFiles);
        if (dirName) {
          uploadFormData.append("dir_name", dirName);
        }
        for (const file of Array.from(dirFiles)) {
          const relativePath = (file as any).webkitRelativePath || file.name;
          uploadFormData.append("dir_files", file, relativePath);
        }
        const uploadUrl = buildApiUrl("instances/upload");
        const uploadResponse = await apiFetch(uploadUrl, {
          method: "POST",
          credentials: "include",
          body: uploadFormData,
        });
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          latestUploadedDirPath =
            uploadData.uploaded_files.dir_files.uploaded_dir;
          setUploadedDirPath(latestUploadedDirPath);
        } else {
          const errorData = await uploadResponse.json();
          addNotification({
            type: "danger",
            message: errorData.detail || "Failed to upload files",
          });
          setLoading(false);
          return;
        }
      }

      // Step 2: Create form data for the API call
      const formData = new FormData();
      if (useYaml) {
        const yamlBlob = new Blob([yamlContent], {
          type: "application/x-yaml",
        });
        formData.append("yaml_file", yamlBlob, "config.yaml");
        if (latestUploadedDirPath) {
          formData.append("uploaded_dir_path", latestUploadedDirPath);
        }
      } else {
        formData.append("cluster_name", clusterName);
        formData.append("command", "echo 'Instance launched successfully'");

        const finalSetup = autoAppendSemicolons
          ? appendSemicolons(setupCommand)
          : setupCommand;
        if (finalSetup) {
          formData.append("setup", finalSetup);
        }

        if (latestUploadedDirPath) {
          formData.append("uploaded_dir_path", latestUploadedDirPath);
        }

        // Apply template values if selected, otherwise use form values
        const finalVcpus = vcpus || tpl.cpus;
        const finalMemory = memory || tpl.memory;
        const finalGpus = gpus || tpl.accelerators;
        const finalDiskSpace = diskSpace || tpl.disk_space;
        const finalRegion = region || tpl.region;
        const finalZone = zone || tpl.zone;

        if (finalVcpus) {
          formData.append("cpus", finalVcpus);
        }
        if (finalMemory) {
          formData.append("memory", finalMemory);
        }
        if (finalGpus) {
          formData.append("accelerators", finalGpus);
        }
        if (finalDiskSpace) {
          formData.append("disk_space", finalDiskSpace);
        }

        // Only include num_nodes if > 1
        const parsedNumNodes = parseInt(numNodes || "1", 10);
        if (!isNaN(parsedNumNodes) && parsedNumNodes > 1) {
          formData.append("num_nodes", String(parsedNumNodes));
        }
        if (finalRegion) {
          formData.append("region", finalRegion);
        }
        if (finalZone) {
          formData.append("zone", finalZone);
        }
      }

      const response = await apiFetch(buildApiUrl("instances/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setLoading(false);

        // Close modal immediately
        onClose();

        // Reset form
        resetForm();

        // Show success notification
        addNotification({
          type: "success",
          message: `Instance "${clusterName}" has been launched successfully!`,
        });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to launch instance");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error launching instance:", err);
      setError("Failed to launch instance. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 800,
          maxHeight: "90vh",
          minWidth: "50vw",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden", // Prevent overflow on the dialog
          paddingRight: 0,
          paddingBottom: 0,
          transform: "translateX(-50%)",
          top: "5vh",
        }}
      >
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2, flexShrink: 0 }}>
          Launch an Instance
        </Typography>
        <form
          onSubmit={handleLaunch}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              ❌ {error}
            </Alert>
          )}

          {/* Tabs for Form and YAML */}
          <Tabs
            aria-label="Instance Launcher Tabs"
            defaultValue={0}
            sx={{
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
            onChange={(_, v) => setUseYaml(v === 1)}
          >
            <TabList>
              <Tab>Form</Tab>
              <Tab>YAML</Tab>
            </TabList>
            <TabPanel
              value={0}
              sx={{
                overflow: "hidden",
                display: "flex",
                flex: 1,
                paddingRight: 0,
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: 2,
                }}
              >
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Instance Name</FormLabel>
                  <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="my-instance"
                    required
                  />
                </FormControl>

                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Setup Command (optional)</FormLabel>
                  <Textarea
                    value={setupCommand}
                    onChange={(e) => setSetupCommand(e.target.value)}
                    placeholder="pip install -r requirements.txt"
                    minRows={2}
                  />
                  <Typography level="body-xs" sx={{ mt: 0.5 }}>
                    Use <code>;</code> at the end of each line for separate
                    commands
                  </Typography>
                </FormControl>

                {/* Number of Nodes - always visible since templates don't include this */}
                <FormControl sx={{ mb: 2 }}>
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

                {/* Machine Size Template (positioned near Advanced Options like Job Launcher) */}
                <FormControl sx={{ mb: 2 }}>
                  <FormLabel>Machine Size Template (optional)</FormLabel>
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
                  <FormHelperText
                    sx={{ color: "var(--joy-palette-danger-500)" }}
                  >
                    {selectedTemplate && (
                      <>
                        <span
                          onClick={() => setSelectedTemplateId("")}
                          style={{
                            color: "var(--joy-palette-danger-500)",
                            cursor: "pointer",
                          }}
                        >
                          Clear Selection
                        </span>
                      </>
                    )}
                  </FormHelperText>
                </FormControl>

                {/* Advanced button - always show but disable when template is selected */}
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
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

                {/* Advanced fields - only show when advanced is enabled and no template is selected */}
                {showAdvanced && !selectedTemplateId && (
                  <>
                    {/* Resource Configuration */}
                    <Card variant="soft" sx={{ mb: 2, mt: 2 }}>
                      <Typography level="title-sm" sx={{ mb: 1 }}>
                        Resource Configuration
                      </Typography>
                      <FormControl sx={{ mb: 1 }}>
                        <FormLabel>vCPUs</FormLabel>
                        <Input
                          value={vcpus}
                          onChange={(e) => setVcpus(e.target.value)}
                          placeholder="e.g., 4, 8, 16"
                          type="number"
                        />
                      </FormControl>
                      <FormControl sx={{ mb: 1 }}>
                        <FormLabel>Memory (GB)</FormLabel>
                        <Input
                          value={memory}
                          onChange={(e) => setMemory(e.target.value)}
                          placeholder="e.g., 16, 32, 64"
                          type="number"
                        />
                      </FormControl>
                      <FormControl sx={{ mb: 1 }}>
                        <FormLabel>GPUs</FormLabel>
                        <Input
                          value={gpus}
                          onChange={(e) => setGpus(e.target.value)}
                          placeholder="RTX3090:1, H100:4"
                        />
                      </FormControl>
                      <FormControl sx={{ mb: 1 }}>
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
                    </Card>

                    {/* Zone and Region Preferences */}
                    <Card variant="soft" sx={{ mb: 2 }}>
                      <Typography level="title-sm" sx={{ mb: 1 }}>
                        Zone and Region Preferences
                      </Typography>
                      <FormControl sx={{ mb: 1 }}>
                        <FormLabel>Region</FormLabel>
                        <Input
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          placeholder="e.g., us-west-2, us-central1"
                        />
                      </FormControl>
                      <FormControl sx={{ mb: 1 }}>
                        <FormLabel>Zone</FormLabel>
                        <Input
                          value={zone}
                          onChange={(e) => setZone(e.target.value)}
                          placeholder="e.g., us-west-2a, us-central1-a"
                        />
                      </FormControl>
                    </Card>
                  </>
                )}

                {/* Directory Upload - show in both modes */}
                <Card variant="soft" sx={{ mb: 2 }}>
                  <Typography level="title-sm" sx={{ mb: 1 }}>
                    Directory Upload (optional)
                  </Typography>
                  <FormControl sx={{ mb: 1 }}>
                    <FormLabel>Upload Project Directory</FormLabel>
                    <Input
                      type="file"
                      onChange={handleDirectoryUpload}
                      slotProps={{
                        input: {
                          webkitdirectory: true,
                          directory: true,
                          multiple: true,
                        },
                      }}
                      sx={{ py: 1 }}
                      placeholder="Select a directory to upload"
                    />
                    {dirFiles && dirFiles.length > 0 && (
                      <Typography
                        level="body-sm"
                        sx={{ mt: 1, color: "success.500" }}
                      >
                        ✓ {dirFiles.length} files selected from directory
                      </Typography>
                    )}
                  </FormControl>
                </Card>
              </Box>
            </TabPanel>
            <TabPanel
              value={1}
              sx={{
                overflow: "hidden",
                display: "flex",
                flex: 1,
                paddingRight: 0,
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                  paddingRight: 2,
                }}
              >
                <YamlConfigurationSection
                  useYaml={true}
                  setUseYaml={setUseYaml}
                  yamlContent={yamlContent}
                  setYamlContent={setYamlContent}
                  yamlFile={yamlFile}
                  setYamlFile={setYamlFile}
                  placeholder={`# Example YAML configuration for Instance Launcher:\ncluster_name: my-instance\nsetup: pip install -r requirements.txt\ncpus: 4\nmemory: 16\naccelerators: RTX3090:1\ndisk_space: 100\nregion: us-west-2\nzone: us-west-2a`}
                  clusterName={instanceName}
                />
              </Box>
            </TabPanel>
          </Tabs>

          <Box
            sx={{
              display: "flex",
              gap: 1,
              justifyContent: "flex-end",
              p: 2,
              flexShrink: 0,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button variant="plain" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              color="success"
              startDecorator={<Rocket size={16} />}
            >
              Launch Instance
            </Button>
          </Box>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default InstanceLauncher;
