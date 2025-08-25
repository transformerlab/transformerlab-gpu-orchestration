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
  Textarea,
  Select,
  Option,
  Checkbox,
  Alert,
} from "@mui/joy";
import { Play, Rocket, Terminal, Code, BookOpen } from "lucide-react";
import { buildApiUrl, runpodApi, apiFetch } from "../utils/api";
import { useNotification } from "./NotificationSystem";

interface LaunchClusterRequest {
  cluster_name: string;
  command: string;
  setup?: string;
  cloud?: string;
  instance_type?: string;
  cpus?: string;
  memory?: string;
  accelerators?: string;
  region?: string;
  zone?: string;
  use_spot: boolean;
  idle_minutes_to_autostop?: number;
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

interface SkyPilotClusterLauncherProps {
  onClusterLaunched?: (clusterName: string) => void;
}

interface SSHCluster {
  name: string;
  hosts_count: number;
  has_defaults: boolean;
}

type LaunchMode = "custom" | "jupyter" | "vscode" | "ssh";

const SkyPilotClusterLauncher: React.FC<SkyPilotClusterLauncherProps> = ({
  onClusterLaunched,
}) => {
  const [showLaunchModal, setShowLaunchModal] = useState(false);

  const [sshClusters, setSshClusters] = useState<SSHCluster[]>([]);
  const { addNotification } = useNotification();

  // Form states
  const [clusterName, setClusterName] = useState("");
  const [launchMode, setLaunchMode] = useState<LaunchMode>("custom");
  const [command, setCommand] = useState("echo 'Hello SkyPilot'");
  const [setup, setSetup] = useState("");
  const [cloud, setCloud] = useState("");
  const [instanceType, setInstanceType] = useState("");
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [useSpot, setUseSpot] = useState(false);
  const [idleMinutesToAutostop, setIdleMinutesToAutostop] = useState("");
  const [pythonFile, setPythonFile] = useState<File | null>(null);

  // Interactive development specific states
  const [jupyterPort, setJupyterPort] = useState("8888");
  const [jupyterPassword, setJupyterPassword] = useState("");

  // RunPod specific state
  const [runpodGpuTypes, setRunpodGpuTypes] = useState<string[]>([]);
  const [runpodDisplayOptions, setRunpodDisplayOptions] = useState<string[]>(
    []
  );
  const [runpodSetupStatus, setRunpodSetupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Azure specific state
  const [azureInstanceTypes, setAzureInstanceTypes] = useState<string[]>([]);
  const [azureSetupStatus, setAzureSetupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Storage bucket state
  const [storageBuckets, setStorageBuckets] = useState<StorageBucket[]>([]);
  const [selectedStorageBuckets, setSelectedStorageBuckets] = useState<
    string[]
  >([]);
  const [loadingStorageBuckets, setLoadingStorageBuckets] = useState(false);

  const resetForm = () => {
    setClusterName("");
    setLaunchMode("custom");
    setCommand("echo 'Hello SkyPilot'");
    setSetup("");
    setCloud("");
    setInstanceType("");
    setCpus("");
    setMemory("");
    setAccelerators("");
    setRegion("");
    setZone("");
    setUseSpot(false);
    setIdleMinutesToAutostop("");
    setPythonFile(null);
    setJupyterPort("8888");
    setJupyterPassword("");
    setSelectedStorageBuckets([]);
  };

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

  const fetchSSHClusters = async () => {
    try {
      const response = await apiFetch(buildApiUrl("skypilot/ssh-clusters"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSshClusters(data.ssh_clusters);
      }
    } catch (err) {
      console.error("Error fetching SSH clusters:", err);
    }
  };

  useEffect(() => {
    if (cloud === "ssh") {
      fetchSSHClusters();
    } else if (cloud === "runpod") {
      setupRunPod();
    }
  }, [cloud]);

  // Fetch storage buckets when modal opens
  useEffect(() => {
    if (showLaunchModal) {
      fetchStorageBuckets();
    }
  }, [showLaunchModal]);

  // Update command and setup based on launch mode
  useEffect(() => {
    switch (launchMode) {
      case "jupyter":
        setCommand(
          `jupyter notebook --port ${jupyterPort} --ip=0.0.0.0 --NotebookApp.token='' --NotebookApp.password='' --allow-root --no-browser`
        );
        setSetup(`# Install jupyter
pip install jupyter
# Create jupyter config to allow external connections
jupyter notebook --generate-config
echo "c.NotebookApp.ip = '0.0.0.0'" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.allow_root = True" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.open_browser = False" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.password = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "c.NotebookApp.token = ''" >> ~/.jupyter/jupyter_notebook_config.py
echo "Jupyter notebook will be available at http://localhost:${jupyterPort}"`);
        break;
      case "ssh":
        setCommand("echo 'SSH cluster ready for connection'");
        setSetup(
          "echo 'SSH cluster is ready. Use: ssh " +
            (clusterName || "your-cluster-name") +
            "'"
        );
        break;
      case "vscode":
        setCommand(
          `sudo apt update && sudo apt install -y gnupg software-properties-common apt-transport-https wget \
&& wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg \
&& sudo install -o root -g root -m 644 packages.microsoft.gpg /usr/share/keyrings/ \
&& echo "deb [arch=amd64 signed-by=/usr/share/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" \
| sudo tee /etc/apt/sources.list.d/vscode.list \
&& sudo apt update && sudo apt install -y code \
&& code tunnel --disable-telemetry`
        );
        setSetup(`# VSCode CLI will be downloaded automatically`);
        break;
      case "custom":
        setCommand("echo 'Hello SkyPilot'");
        setSetup("");
        break;
    }
  }, [launchMode, jupyterPort, clusterName]);

  const setupRunPod = async () => {
    try {
      setRunpodSetupStatus("loading");

      // Check if RunPod is configured
      const configResponse = await apiFetch(
        buildApiUrl("clouds/runpod/config"),
        {
          credentials: "include",
        }
      );

      if (configResponse.ok) {
        const config = await configResponse.json();
        if (config.is_configured) {
          // Run the setup endpoint which will create config.toml and run sky check
          const setupResponse = await apiFetch(
            buildApiUrl("clouds/runpod/setup"),
            {
              credentials: "include",
            }
          );

          if (setupResponse.ok) {
            const setupData = await setupResponse.json();
            setRunpodSetupStatus("success");
            // Use configured GPU types for backward compatibility
            setRunpodGpuTypes(config.allowed_gpu_types);

            // Fetch display options for the UI
            try {
              const displayResponse = await apiFetch(
                buildApiUrl("clouds/runpod/info"),
                {
                  credentials: "include",
                }
              );
              if (displayResponse.ok) {
                const displayData = await displayResponse.json();
                setRunpodDisplayOptions(displayData.display_options || []);
              }
            } catch (err) {
              console.warn("Failed to fetch RunPod display options:", err);
            }

            // Show sky check results if available
            if (setupData.sky_check_valid === false) {
              addNotification({
                type: "danger",
                message: `RunPod setup completed but sky check failed: ${setupData.sky_check_output}`,
              });
            }
          } else {
            setRunpodSetupStatus("error");
            addNotification({
              type: "danger",
              message: "Failed to setup RunPod configuration",
            });
          }
        } else {
          setRunpodSetupStatus("error");
          addNotification({
            type: "danger",
            message:
              "RunPod is not configured. Please configure it in the Admin section first.",
          });
        }
      } else {
        setRunpodSetupStatus("error");
        addNotification({
          type: "danger",
          message: "Failed to check RunPod configuration",
        });
      }
    } catch (err) {
      console.error("Error setting up RunPod:", err);
      setRunpodSetupStatus("error");
      addNotification({
        type: "danger",
        message: "Error checking RunPod configuration",
      });
    }
  };

  const setupAzure = async () => {
    try {
      setAzureSetupStatus("loading");

      // Check if Azure is configured
      const configResponse = await apiFetch(
        buildApiUrl("clouds/azure/config"),
        {
          credentials: "include",
        }
      );

      if (configResponse.ok) {
        const config = await configResponse.json();
        if (config.is_configured) {
          // Run the setup endpoint which will create config.toml and run sky check
          const setupResponse = await apiFetch(
            buildApiUrl("clouds/azure/setup"),
            {
              credentials: "include",
            }
          );

          if (setupResponse.ok) {
            const setupData = await setupResponse.json();
            setAzureSetupStatus("success");
            // Use configured instance types
            setAzureInstanceTypes(config.allowed_instance_types);

            // Show sky check results if available
            if (setupData.sky_check_valid === false) {
              addNotification({
                type: "danger",
                message: `Azure setup completed but sky check failed: ${setupData.sky_check_output}`,
              });
            }
          } else {
            setAzureSetupStatus("error");
            addNotification({
              type: "danger",
              message: "Failed to setup Azure configuration",
            });
          }
        } else {
          setAzureSetupStatus("error");
          addNotification({
            type: "danger",
            message:
              "Azure is not configured. Please configure it in the Admin section first.",
          });
        }
      } else {
        setAzureSetupStatus("error");
        addNotification({
          type: "danger",
          message: "Failed to check Azure configuration",
        });
      }
    } catch (err) {
      console.error("Error setting up Azure:", err);
      setAzureSetupStatus("error");
      addNotification({
        type: "danger",
        message: "Error checking Azure configuration",
      });
    }
  };

  const launchCluster = async () => {
    // Close modal immediately and reset form
    setShowLaunchModal(false);
    resetForm();

    // Show immediate notification that request is being processed
    addNotification({
      type: "success",
      message: `Launching cluster "${clusterName}"...`,
    });

    // Add cluster to skeleton state immediately
    if (onClusterLaunched) {
      onClusterLaunched(clusterName);
    }

    try {
      // Always use multipart/form-data
      const formData = new FormData();
      formData.append("cluster_name", clusterName);
      formData.append("command", command);
      if (setup) formData.append("setup", setup);
      if (cloud) formData.append("cloud", cloud);
      if (instanceType) formData.append("instance_type", instanceType);
      if (cpus) formData.append("cpus", cpus);
      if (memory) formData.append("memory", memory);
      if (accelerators) formData.append("accelerators", accelerators);
      if (region) formData.append("region", region);
      if (zone) formData.append("zone", zone);
      formData.append("use_spot", useSpot ? "true" : "false");
      if (idleMinutesToAutostop)
        formData.append("idle_minutes_to_autostop", idleMinutesToAutostop);
      if (pythonFile) {
        formData.append("python_file", pythonFile);
      }

      // Add interactive development parameters
      formData.append("launch_mode", launchMode);
      if (launchMode === "jupyter" && jupyterPort) {
        formData.append("jupyter_port", jupyterPort);
      }

      // Add storage bucket IDs if selected
      if (selectedStorageBuckets.length > 0) {
        formData.append("storage_bucket_ids", selectedStorageBuckets.join(","));
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
          message: `${data.message} (Request ID: ${data.request_id})`,
        });
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to launch cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error launching cluster",
      });
    }
  };

  const getConnectionInstructions = () => {
    if (!clusterName) return null;

    switch (launchMode) {
      case "jupyter":
        return (
          <Alert color="primary" sx={{ mt: 2 }}>
            <Typography level="body-sm">
              <strong>Automatic Port Forwarding:</strong>
              <br />
              ✅ Port forwarding will be set up automatically by the backend
              <br />
              🔗 Once the cluster is ready, you'll be able to access Jupyter at
              the forwarded URL
              <br />
              📝 You can also SSH directly: <code>ssh {clusterName}</code>
            </Typography>
          </Alert>
        );
      case "ssh":
        return (
          <Alert color="primary" sx={{ mt: 2 }}>
            <Typography level="body-sm">
              <strong>SSH Connection:</strong>
              <br />
              Use: <code>ssh {clusterName}</code>
              <br />
              The cluster will be ready for direct SSH access.
            </Typography>
          </Alert>
        );
      case "vscode":
        return (
          <Alert color="primary" sx={{ mt: 2 }}>
            <Typography level="body-sm">
              <strong>Automatic Port Forwarding:</strong>
              <br />
              ✅ Port forwarding will be set up automatically by the backend
              <br />
              🔗 Once the cluster is ready, you'll be able to access VSCode at
              the forwarded URL
              <br />
              📝 You can also use VSCode Remote-SSH extension:{" "}
              <code>ssh {clusterName}</code>
            </Typography>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Button
          startDecorator={<Rocket size={16} />}
          onClick={() => setShowLaunchModal(true)}
          color="success"
        >
          Launch a Cluster on a Cloud Node Pool
        </Button>
      </Box>

      {/* Launch Cluster Modal */}
      <Modal open={showLaunchModal} onClose={() => setShowLaunchModal(false)}>
        <ModalDialog
          size="lg"
          sx={{
            width: "90vw",
            maxWidth: "900px",
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Launch a Cluster on a Cloud Node Pool
          </Typography>

          <Stack spacing={3}>
            {/* Launch Mode Selection */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Development Environment Type
              </Typography>
              <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
                <Button
                  variant={launchMode === "custom" ? "solid" : "outlined"}
                  onClick={() => setLaunchMode("custom")}
                  sx={{ flex: 1 }}
                  startDecorator={<Terminal size={16} />}
                >
                  Custom Command
                </Button>
                <Button
                  variant={launchMode === "jupyter" ? "solid" : "outlined"}
                  onClick={() => setLaunchMode("jupyter")}
                  sx={{ flex: 1 }}
                  startDecorator={<BookOpen size={16} />}
                >
                  Jupyter Notebook
                </Button>
                <Button
                  variant={launchMode === "vscode" ? "solid" : "outlined"}
                  onClick={() => setLaunchMode("vscode")}
                  sx={{ flex: 1 }}
                  startDecorator={<Code size={16} />}
                >
                  VSCode Server
                </Button>
                <Button
                  variant={launchMode === "ssh" ? "solid" : "outlined"}
                  onClick={() => setLaunchMode("ssh")}
                  sx={{ flex: 1 }}
                  startDecorator={<Terminal size={16} />}
                >
                  SSH Access
                </Button>
              </Stack>
            </Card>

            {/* Resource Configuration */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Resource Configuration
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Cloud Provider</FormLabel>
                    <Select
                      value={cloud}
                      onChange={(_, value) => {
                        setCloud(value || "");
                        if (value === "runpod") {
                          setupRunPod();
                        } else if (value === "azure") {
                          setupAzure();
                        }
                      }}
                      placeholder="Select cloud"
                    >
                      <Option value="ssh">Direct Connect</Option>
                      <Option value="aws">AWS</Option>
                      <Option value="gcp">Google Cloud</Option>
                      <Option value="azure">Azure</Option>
                      <Option value="lambda">Lambda Cloud</Option>
                      <Option value="runpod">RunPod</Option>
                      <Option value="kubernetes">Kubernetes</Option>
                    </Select>
                    {cloud === "runpod" && (
                      <Box sx={{ mt: 1 }}>
                        {runpodSetupStatus === "loading" && (
                          <Typography level="body-sm" color="primary">
                            ⏳ Setting up RunPod...
                          </Typography>
                        )}
                        {runpodSetupStatus === "success" && (
                          <Typography level="body-sm" color="success">
                            ✅ RunPod ready (
                            {runpodDisplayOptions.length > 0
                              ? runpodDisplayOptions.length
                              : runpodGpuTypes.length}{" "}
                            options available)
                          </Typography>
                        )}
                        {runpodSetupStatus === "error" && (
                          <Typography level="body-sm" color="danger">
                            ❌ RunPod setup failed. Check RUNPOD_API_KEY
                            environment variable.
                          </Typography>
                        )}
                      </Box>
                    )}
                    {cloud === "azure" && (
                      <Box sx={{ mt: 1 }}>
                        {azureSetupStatus === "loading" && (
                          <Typography level="body-sm" color="primary">
                            ⏳ Setting up Azure...
                          </Typography>
                        )}
                        {azureSetupStatus === "success" && (
                          <Typography level="body-sm" color="success">
                            ✅ Azure ready ({azureInstanceTypes.length} instance
                            types available)
                          </Typography>
                        )}
                        {azureSetupStatus === "error" && (
                          <Typography level="body-sm" color="danger">
                            ❌ Azure setup failed. Check Azure configuration in
                            Admin section.
                          </Typography>
                        )}
                      </Box>
                    )}
                  </FormControl>

                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Instance Type</FormLabel>
                    <Input
                      value={instanceType}
                      onChange={(e) => setInstanceType(e.target.value)}
                      placeholder={
                        cloud === "ssh"
                          ? "Not applicable for SSH"
                          : "e.g., p3.2xlarge, n1-standard-4"
                      }
                      disabled={cloud === "ssh"}
                    />
                  </FormControl>
                </Box>

                <Box sx={{ display: "flex", gap: 2 }}>
                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>CPUs</FormLabel>
                    <Input
                      value={cpus}
                      onChange={(e) => setCpus(e.target.value)}
                      placeholder="e.g., 4, 8+"
                      disabled={cloud === "runpod"}
                    />
                  </FormControl>

                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Memory (GB)</FormLabel>
                    <Input
                      value={memory}
                      onChange={(e) => setMemory(e.target.value)}
                      placeholder="e.g., 16, 32+"
                      disabled={cloud === "runpod"}
                    />
                  </FormControl>
                </Box>

                {cloud === "runpod" && (
                  <Typography level="body-sm" color="neutral">
                    ℹ️ CPU and Memory are automatically configured by RunPod
                    based on the selected GPU type.
                  </Typography>
                )}

                <FormControl>
                  <FormLabel>Accelerators</FormLabel>
                  {cloud === "runpod" && runpodDisplayOptions.length > 0 ? (
                    <Select
                      value={accelerators}
                      onChange={(_, value) => setAccelerators(value || "")}
                      placeholder="Select GPU type or CPU instance (e.g., RTX 4090:1, CPU:8-32GB)"
                    >
                      {runpodDisplayOptions.map((option) => (
                        <Option key={option} value={option}>
                          {option}
                        </Option>
                      ))}
                    </Select>
                  ) : cloud === "runpod" && runpodGpuTypes.length > 0 ? (
                    <Select
                      value={accelerators}
                      onChange={(_, value) => setAccelerators(value || "")}
                      placeholder="Select GPU type"
                    >
                      {runpodGpuTypes.map((gpuType) => (
                        <Option key={gpuType} value={gpuType}>
                          {gpuType}
                        </Option>
                      ))}
                    </Select>
                  ) : cloud === "azure" && azureInstanceTypes.length > 0 ? (
                    <Select
                      value={accelerators}
                      onChange={(_, value) => setAccelerators(value || "")}
                      placeholder="Select instance type"
                    >
                      {azureInstanceTypes.map((instanceType) => (
                        <Option key={instanceType} value={instanceType}>
                          {instanceType}
                        </Option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={accelerators}
                      onChange={(e) => setAccelerators(e.target.value)}
                      placeholder="e.g., V100, V100:2, A100:4, CPU:8-32GB"
                    />
                  )}
                </FormControl>

                <Box sx={{ display: "flex", gap: 2 }}>
                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Region</FormLabel>
                    <Input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder={
                        cloud === "ssh"
                          ? "Not applicable for SSH"
                          : "e.g., us-west-2, us-central1"
                      }
                      disabled={cloud === "ssh"}
                    />
                  </FormControl>

                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Zone</FormLabel>
                    <Input
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      placeholder={
                        cloud === "ssh"
                          ? "Not applicable for SSH"
                          : "e.g., us-west-2a, us-central1-a"
                      }
                      disabled={cloud === "ssh"}
                    />
                  </FormControl>
                </Box>
              </Stack>
            </Card>

            {/* Basic Configuration */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Launch Configuration
              </Typography>
              <Stack spacing={2}>
                <FormControl required>
                  <FormLabel>Cluster Name</FormLabel>
                  {cloud === "ssh" ? (
                    <Select
                      value={clusterName}
                      onChange={(_, value) => setClusterName(value || "")}
                      placeholder="Select a cluster from your Node Pool"
                    >
                      {sshClusters.map((cluster) => (
                        <Option key={cluster.name} value={cluster.name}>
                          {cluster.name} ({cluster.hosts_count} hosts)
                        </Option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={clusterName}
                      onChange={(e) => setClusterName(e.target.value)}
                      placeholder="my-dev-cluster"
                    />
                  )}
                  {cloud === "ssh" && sshClusters.length === 0 && (
                    <Typography level="body-sm" color="warning">
                      No SSH clusters found. Create SSH clusters in the "SSH
                      Clusters" tab first.
                    </Typography>
                  )}
                </FormControl>

                {/* Interactive Development Options */}
                {launchMode === "jupyter" && (
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <FormControl sx={{ flex: 1 }}>
                      <FormLabel>Jupyter Port</FormLabel>
                      <Input
                        value={jupyterPort}
                        onChange={(e) => setJupyterPort(e.target.value)}
                        placeholder="8888"
                      />
                    </FormControl>
                    <FormControl sx={{ flex: 1 }}>
                      <FormLabel>Password (optional)</FormLabel>
                      <Input
                        value={jupyterPassword}
                        onChange={(e) => setJupyterPassword(e.target.value)}
                        placeholder="Leave empty for token auth"
                        type="password"
                      />
                    </FormControl>
                  </Box>
                )}

                {/* Custom Command Section - only show for custom mode */}
                {launchMode === "custom" && (
                  <>
                    <FormControl required>
                      <FormLabel>Run Command</FormLabel>
                      <Textarea
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="echo 'Hello SkyPilot'"
                        minRows={2}
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
                      <FormLabel>Attach Python file (optional)</FormLabel>
                      <input
                        type="file"
                        accept=".py"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setPythonFile(e.target.files[0]);
                          } else {
                            setPythonFile(null);
                          }
                        }}
                        style={{ marginTop: 8 }}
                      />
                      {pythonFile && (
                        <Typography level="body-xs" color="primary">
                          Selected: {pythonFile.name}
                        </Typography>
                      )}
                    </FormControl>

                    {/* Storage Bucket Selection */}
                    <FormControl>
                      <FormLabel>Storage Buckets (optional)</FormLabel>
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
                    </FormControl>
                  </>
                )}

                {/* Show generated command/setup for interactive modes */}
                {launchMode !== "custom" && (
                  <>
                    <FormControl>
                      <FormLabel>Generated Command</FormLabel>
                      <Textarea
                        value={command}
                        readOnly
                        minRows={2}
                        sx={{ fontFamily: "monospace" }}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Generated Setup</FormLabel>
                      <Textarea
                        value={setup}
                        readOnly
                        minRows={2}
                        sx={{ fontFamily: "monospace" }}
                      />
                    </FormControl>

                    {/* Storage Bucket Selection for Interactive Modes */}
                    <FormControl>
                      <FormLabel>Storage Buckets (optional)</FormLabel>
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
                    </FormControl>
                  </>
                )}

                {/* Connection Instructions */}
                {getConnectionInstructions()}
              </Stack>
            </Card>

            {/* Advanced Configuration */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Advanced Configuration
              </Typography>
              <Stack spacing={2}>
                {cloud === "ssh" && (
                  <Card variant="soft" color="primary" sx={{ p: 2 }}>
                    <Typography level="body-sm">
                      <strong>SSH Mode:</strong> The cluster name must match an
                      existing SSH cluster configured in the "SSH Clusters" tab.
                      SkyPilot will use the nodes from that cluster.
                    </Typography>
                  </Card>
                )}

                <Checkbox
                  checked={useSpot}
                  onChange={(e) => setUseSpot(e.target.checked)}
                  label={
                    cloud === "ssh"
                      ? "Use spot instances (not applicable for SSH)"
                      : "Use spot instances (cheaper but can be preempted)"
                  }
                  disabled={cloud === "ssh"}
                />

                <FormControl>
                  <FormLabel>Auto-stop after idle minutes</FormLabel>
                  <Input
                    type="number"
                    value={idleMinutesToAutostop}
                    onChange={(e) => setIdleMinutesToAutostop(e.target.value)}
                    placeholder="e.g., 10, 60"
                  />
                </FormControl>
              </Stack>
            </Card>

            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button
                variant="plain"
                onClick={() => {
                  setShowLaunchModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={launchCluster}
                disabled={!clusterName || loading}
                loading={loading}
                startDecorator={<Play size={16} />}
              >
                Launch{" "}
                {launchMode === "jupyter"
                  ? "Jupyter"
                  : launchMode === "ssh"
                  ? "SSH Cluster"
                  : launchMode === "vscode"
                  ? "VSCode Server"
                  : "Cluster"}
              </Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default SkyPilotClusterLauncher;
