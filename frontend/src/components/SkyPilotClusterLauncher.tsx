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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sshClusters, setSshClusters] = useState<SSHCluster[]>([]);

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
  const [vscodePort, setVscodePort] = useState("8888");

  // RunPod specific state
  const [runpodGpuTypes, setRunpodGpuTypes] = useState<string[]>([]);
  const [runpodSetupStatus, setRunpodSetupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Azure specific state
  const [azureInstanceTypes, setAzureInstanceTypes] = useState<string[]>([]);
  const [azureSetupStatus, setAzureSetupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

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
    setVscodePort("8888");
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
          `code-server . --port ${vscodePort} --host 0.0.0.0 --auth none`
        );
        setSetup(`curl -fsSL https://code-server.dev/install.sh | bash`);
        break;
      case "custom":
        setCommand("echo 'Hello SkyPilot'");
        setSetup("");
        break;
    }
  }, [launchMode, jupyterPort, vscodePort, clusterName]);

  const setupRunPod = async () => {
    try {
      setRunpodSetupStatus("loading");

      // Check if RunPod is configured
      const configResponse = await apiFetch(
        buildApiUrl("skypilot/runpod/config"),
        {
          credentials: "include",
        }
      );

      if (configResponse.ok) {
        const config = await configResponse.json();
        if (config.is_configured) {
          setRunpodSetupStatus("success");
          // Use configured GPU types
          setRunpodGpuTypes(config.allowed_gpu_types);
        } else {
          setRunpodSetupStatus("error");
          setError(
            "RunPod is not configured. Please configure it in the Admin section first."
          );
        }
      } else {
        setRunpodSetupStatus("error");
        setError("Failed to check RunPod configuration");
      }
    } catch (err) {
      console.error("Error setting up RunPod:", err);
      setRunpodSetupStatus("error");
      setError("Error checking RunPod configuration");
    }
  };

  const setupAzure = async () => {
    try {
      setAzureSetupStatus("loading");

      // Check if Azure is configured
      const configResponse = await apiFetch(
        buildApiUrl("skypilot/azure/config"),
        {
          credentials: "include",
        }
      );

      if (configResponse.ok) {
        const config = await configResponse.json();
        if (config.is_configured) {
          setAzureSetupStatus("success");
          // Use configured instance types
          setAzureInstanceTypes(config.allowed_instance_types);
        } else {
          setAzureSetupStatus("error");
          setError(
            "Azure is not configured. Please configure it in the Admin section first."
          );
        }
      } else {
        setAzureSetupStatus("error");
        setError("Failed to check Azure configuration");
      }
    } catch (err) {
      console.error("Error setting up Azure:", err);
      setAzureSetupStatus("error");
      setError("Error checking Azure configuration");
    }
  };

  const launchCluster = async () => {
    try {
      setLoading(true);
      setError(null);

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
      if (launchMode === "vscode" && vscodePort) {
        formData.append("vscode_port", vscodePort);
      }
      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data: LaunchClusterResponse = await response.json();
        setSuccess(`${data.message} (Request ID: ${data.request_id})`);
        setShowLaunchModal(false);
        resetForm();
        if (onClusterLaunched) {
          onClusterLaunched(clusterName);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to launch cluster");
      }
    } catch (err) {
      setError("Error launching cluster");
    } finally {
      setLoading(false);
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
      {error && (
        <Card color="danger" variant="soft" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography color="danger">{error}</Typography>
            <Button
              variant="plain"
              size="sm"
              color="danger"
              onClick={() => setError(null)}
            >
              ×
            </Button>
          </Box>
        </Card>
      )}

      {success && (
        <Card color="success" variant="soft" sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography color="success">{success}</Typography>
            <Button
              variant="plain"
              size="sm"
              color="success"
              onClick={() => setSuccess(null)}
            >
              ×
            </Button>
          </Box>
        </Card>
      )}

      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Button
          startDecorator={<Rocket size={16} />}
          onClick={() => setShowLaunchModal(true)}
          disabled={loading}
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
                            ✅ RunPod ready ({runpodGpuTypes.length} GPU types
                            available)
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
                  {cloud === "runpod" && runpodGpuTypes.length > 0 ? (
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
                      placeholder="e.g., V100, V100:2, A100:4"
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

                {launchMode === "vscode" && (
                  <FormControl>
                    <FormLabel>VSCode Server Port</FormLabel>
                    <Input
                      value={vscodePort}
                      onChange={(e) => setVscodePort(e.target.value)}
                      placeholder="8888"
                    />
                  </FormControl>
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
