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
} from "@mui/joy";
import { Rocket } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useNotification } from "../NotificationSystem";
import YamlConfigurationSection from "./YamlConfigurationSection";

interface JobLauncherProps {
  open: boolean;
  onClose: () => void;
  onJobLaunched?: () => void;
}

const JobLauncher: React.FC<JobLauncherProps> = ({
  open,
  onClose,
  onJobLaunched,
}) => {
  const [jobName, setJobName] = useState("");
  const [command, setCommand] = useState("");
  const [setupCommand, setSetupCommand] = useState("");
  const [dirFiles, setDirFiles] = useState<FileList | null>(null);
  const [uploadedDirPath, setUploadedDirPath] = useState<string | null>(null);
  const [vcpus, setVcpus] = useState("");
  const [memory, setMemory] = useState("");
  const [gpus, setGpus] = useState("");
  const [diskSpace, setDiskSpace] = useState("");
  const [zone, setZone] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addNotification } = useNotification();

  // YAML configuration state
  const [useYaml, setUseYaml] = useState(false);
  const [yamlContent, setYamlContent] = useState("");
  const [yamlFile, setYamlFile] = useState<File | null>(null);

  const resetForm = () => {
    setJobName("");
    setCommand("");
    setSetupCommand("");
    setDirFiles(null);
    setUploadedDirPath(null);
    setVcpus("");
    setMemory("");
    setGpus("");
    setDiskSpace("");
    setZone("");
    setRegion("");
    setUseYaml(false);
    setYamlContent("");
    setYamlFile(null);
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
      // Use the job name from the form
      const clusterName = jobName || `job-${Date.now()}`;

      let uploadedDirPath = null;

      // Step 1: Upload directory files if provided
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
          uploadedDirPath = uploadData.uploaded_files.dir_files.uploaded_dir;
          setUploadedDirPath(uploadedDirPath);
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

      // Step 2: Launch job with uploaded directory path
      const formData = new FormData();

      if (useYaml) {
        // YAML mode: create a blob from the YAML content
        const yamlBlob = new Blob([yamlContent], {
          type: "application/x-yaml",
        });
        formData.append("yaml_file", yamlBlob, "config.yaml");

        // Add uploaded directory path if available
        if (uploadedDirPath) {
          formData.append("uploaded_dir_path", uploadedDirPath);
        }
      } else {
        // Form mode: use regular form data
        formData.append("cluster_name", clusterName);
        formData.append("command", command);

        if (setupCommand) {
          formData.append("setup", setupCommand);
        }

        if (uploadedDirPath) {
          formData.append("uploaded_dir_path", uploadedDirPath);
        }

        if (vcpus) {
          formData.append("cpus", vcpus);
        }

        if (memory) {
          formData.append("memory", memory);
        }

        if (gpus) {
          formData.append("accelerators", gpus);
        }

        if (diskSpace) {
          formData.append("disk_space", diskSpace);
        }

        if (region) {
          formData.append("region", region);
        }

        if (zone) {
          formData.append("zone", zone);
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
          message: `Job "${clusterName}" has been launched successfully!`,
        });

        // Call the callback if provided
        if (onJobLaunched) {
          onJobLaunched();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to launch job");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error launching job:", err);
      setError("Failed to launch job. Please try again.");
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
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2, flexShrink: 0 }}>
          Launch a Job
        </Typography>

        {/* YAML Configuration Section */}
        <YamlConfigurationSection
          useYaml={useYaml}
          setUseYaml={setUseYaml}
          yamlContent={yamlContent}
          setYamlContent={setYamlContent}
          yamlFile={yamlFile}
          setYamlFile={setYamlFile}
          placeholder={`# Example YAML configuration for Job Launcher:
cluster_name: my-job
command: python train.py --epochs 100
setup: pip install -r requirements.txt
cpus: 4
memory: 16
accelerators: RTX3090:1
disk_space: 100
region: us-west-2
zone: us-west-2a`}
        />

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

          {/* Form fields - only show when not in YAML mode */}
          {!useYaml && (
            <>
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Job Name</FormLabel>
                <Input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g., my-job, training-task"
                  required
                />
              </FormControl>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Command *</FormLabel>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="python train.py --epochs 100"
                  minRows={2}
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
              </FormControl>

              {/* Resource Configuration */}
              <Card variant="soft" sx={{ mb: 2 }}>
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
              Launch Job
            </Button>
          </Box>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default JobLauncher;
