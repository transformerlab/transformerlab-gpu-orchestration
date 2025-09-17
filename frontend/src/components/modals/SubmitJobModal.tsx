import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Card,
  CardContent,
  Button,
  Box,
  FormControl,
  FormLabel,
  Textarea,
  Input,
  CircularProgress,
  Alert,
  Checkbox,
} from "@mui/joy";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useNotification } from "../NotificationSystem";
import { parseResourcesString } from "../../utils/resourceParser";

interface SubmitJobModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string;
  onJobSubmitted?: () => void;
  isClusterLaunching?: boolean;
  isSshCluster?: boolean;
  availableResources?: string;
}

const SubmitJobModal: React.FC<SubmitJobModalProps> = ({
  open,
  onClose,
  clusterName,
  onJobSubmitted,
  isClusterLaunching = false,
  isSshCluster = false,
  availableResources = "",
}) => {
  const [command, setCommand] = useState("");
  const [setup, setSetup] = useState("");
  const [dirFiles, setDirFiles] = useState<FileList | null>(null);
  const [uploadedDirPath, setUploadedDirPath] = useState<string | null>(null);
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [jobName, setJobName] = useState("");
  const [numNodes, setNumNodes] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();
  const [autoAppendSemicolons, setAutoAppendSemicolons] = useState(false);

  const available = parseResourcesString(availableResources);

  const resetForm = () => {
    setCommand("");
    setSetup("");
    setDirFiles(null);
    setUploadedDirPath(null);
    setCpus("");
    setMemory("");
    setAccelerators("");
    setJobName("");
    setNumNodes("1");
  };

  const validateResources = () => {
    if (cpus && available.cpus) {
      const requestedCpus = parseInt(cpus);
      if (requestedCpus > available.cpus) {
        addNotification({
          type: "danger",
          message: `Requested CPUs (${requestedCpus}) exceed available CPUs (${available.cpus})`,
        });
        return false;
      }
    }

    if (memory && available.memory) {
      const requestedMemory = parseInt(memory);
      if (requestedMemory > available.memory) {
        addNotification({
          type: "danger",
          message: `Requested Memory (${requestedMemory}GB) exceed available Memory (${available.memory}GB)`,
        });
        return false;
      }
    }

    // Validate that accelerators are only requested if available
    if (accelerators && !available.gpu) {
      addNotification({
        type: "danger",
        message: "No accelerators are available for this cluster",
      });
      return false;
    }

    return true;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateResources()) {
      return;
    }

    setLoading(true);
    try {
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
          return;
        }
      }

      // Utility: optionally append semicolons per line (best-effort, preserves here-docs)
      const appendSemicolons = (text: string): string => {
        if (!text) return text;
        const lines = text.split(/\r?\n/);
        let inHereDoc = false;
        let terminator: string | null = null;
        const processed = lines.map((line) => {
          if (!inHereDoc) {
            const hereDocMatch = line.match(/<<-?\s*([A-Za-z0-9_]+)/);
            if (hereDocMatch) {
              inHereDoc = true;
              terminator = hereDocMatch[1];
              return line;
            }
            const trimmed = line.trim();
            if (trimmed === "" || trimmed.startsWith("#")) return line;
            if (/(&&|;|\\)$/.test(trimmed)) return line;
            return line + " ;";
          } else {
            if (terminator && line.trim() === terminator) {
              inHereDoc = false;
              terminator = null;
            }
            return line;
          }
        });
        return processed.join("\n");
      };

      // Step 2: Submit job with uploaded directory path
      const formData = new FormData();

      const finalCommand = autoAppendSemicolons
        ? appendSemicolons(command)
        : command;
      const finalSetup = autoAppendSemicolons ? appendSemicolons(setup) : setup;

      formData.append("command", finalCommand);
      if (finalSetup) formData.append("setup", finalSetup);
      if (cpus) formData.append("cpus", cpus);
      if (memory) formData.append("memory", memory);
      if (accelerators) formData.append("accelerators", accelerators);
      if (jobName) formData.append("job_name", jobName);
      // Only include num_nodes if > 1
      const parsedNumNodes = parseInt(numNodes || "1", 10);
      if (!isNaN(parsedNumNodes) && parsedNumNodes > 1) {
        formData.append("num_nodes", String(parsedNumNodes));
      }
      if (uploadedDirPath) {
        formData.append("uploaded_dir_path", uploadedDirPath);
      }

      const response = await apiFetch(
        buildApiUrl(`jobs/${clusterName}/submit`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );
      if (response.ok) {
        const data = await response.json();
        addNotification({
          type: "success",
          message: data.message || "Job submitted successfully",
        });
        resetForm();
        if (onJobSubmitted) onJobSubmitted();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to submit job",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error submitting job",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 1000,
          width: "90vw",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2, flexShrink: 0 }}>
          Submit Job to {clusterName}
        </Typography>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <CardContent sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
              {isClusterLaunching && (
                <Alert color="warning" sx={{ mb: 2 }}>
                  Cluster is launching. Please wait until it is ready to submit
                  jobs.
                </Alert>
              )}

              {/* Job Name at the top */}
              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Job Name (optional)</FormLabel>
                <Input
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g., My Training Job"
                  disabled={isClusterLaunching}
                />
              </FormControl>

              <FormControl required sx={{ mb: 2 }}>
                <FormLabel>Run Command</FormLabel>
                <Textarea
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="python my_script.py"
                  minRows={2}
                  required
                  disabled={isClusterLaunching}
                />
                <Typography level="body-xs" sx={{ mt: 0.5 }}>
                  Multiple commands supported. End each line with <code>;</code>{" "}
                  or enable the option below.
                </Typography>
              </FormControl>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Setup Command (optional)</FormLabel>
                <Textarea
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                  placeholder="pip install -r requirements.txt"
                  minRows={2}
                  disabled={isClusterLaunching}
                />
                <Typography level="body-xs" sx={{ mt: 0.5 }}>
                  Use <code>;</code> at the end of each line for separate
                  commands, or enable auto-append.
                </Typography>
              </FormControl>

              <FormControl sx={{ mb: 2 }}>
                <Checkbox
                  label="Auto-append ; to each non-empty line"
                  checked={autoAppendSemicolons}
                  onChange={(e) => setAutoAppendSemicolons(e.target.checked)}
                  disabled={isClusterLaunching}
                />
              </FormControl>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Attach project directory (optional)</FormLabel>
                <input
                  type="file"
                  // @ts-ignore - webkitdirectory is widely supported in Chromium/WebKit
                  webkitdirectory=""
                  // @ts-ignore - allow directory selection
                  directory=""
                  multiple
                  onChange={(e) => {
                    setDirFiles(e.target.files);
                  }}
                  style={{ marginTop: 8 }}
                  disabled={isClusterLaunching}
                />
                {dirFiles && dirFiles.length > 0 && (
                  <Typography level="body-xs" color="primary">
                    Selected files: {dirFiles.length}
                  </Typography>
                )}
              </FormControl>

              {/* Resource Configuration */}
              <Card variant="soft" sx={{ mb: 2, mt: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Resource Configuration
                </Typography>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>CPUs</FormLabel>
                  <Input
                    value={cpus}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow digits
                      if (value === "" || /^\d+$/.test(value)) {
                        setCpus(value);
                      }
                    }}
                    placeholder="e.g., 4"
                    disabled={isClusterLaunching}
                    slotProps={{
                      input: {
                        type: "number",
                        min: 1,
                      },
                    }}
                  />
                  {availableResources && (
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ mt: 0.5 }}
                    >
                      Available: {available.cpus || "N/A"} CPUs
                    </Typography>
                  )}
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Memory (GB)</FormLabel>
                  <Input
                    value={memory}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow digits
                      if (value === "" || /^\d+$/.test(value)) {
                        setMemory(value);
                      }
                    }}
                    placeholder="e.g., 16"
                    disabled={isClusterLaunching}
                    slotProps={{
                      input: {
                        type: "number",
                        min: 1,
                      },
                    }}
                  />
                  {availableResources && (
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ mt: 0.5 }}
                    >
                      Available: {available.memory || "N/A"} GB
                    </Typography>
                  )}
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Accelerators</FormLabel>
                  <Input
                    value={accelerators}
                    onChange={(e) => setAccelerators(e.target.value)}
                    placeholder={
                      available.gpu
                        ? "e.g., V100, V100:2, A100:4"
                        : "No accelerators available"
                    }
                    disabled={isClusterLaunching || !available.gpu}
                  />
                  {availableResources && (
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{ mt: 0.5 }}
                    >
                      Available: {available.gpu || "None"}
                    </Typography>
                  )}
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Number of Nodes</FormLabel>
                  <Input
                    value={numNodes}
                    onChange={(e) => setNumNodes(e.target.value)}
                    placeholder="1"
                    disabled={isClusterLaunching}
                    slotProps={{
                      input: {
                        type: "number",
                        min: 1,
                      },
                    }}
                  />
                </FormControl>
              </Card>
            </CardContent>
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
              <Button
                variant="plain"
                onClick={onClose}
                disabled={loading || isClusterLaunching}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={!command || loading || isClusterLaunching}
                color="success"
              >
                Submit Job
              </Button>
            </Box>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default SubmitJobModal;
