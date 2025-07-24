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
} from "@mui/joy";
import { Play, Rocket } from "lucide-react";
import { buildApiUrl } from "../utils/api";

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

  const resetForm = () => {
    setClusterName("");
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
  };

  const fetchSSHClusters = async () => {
    try {
      const response = await fetch(buildApiUrl("skypilot/ssh-clusters"), {
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
    }
  }, [cloud]);

  const launchCluster = async () => {
    try {
      setLoading(true);
      setError(null);

      const launchRequest: LaunchClusterRequest = {
        cluster_name: clusterName,
        command: command,
        setup: setup || undefined,
        cloud: cloud || undefined,
        instance_type: instanceType || undefined,
        cpus: cpus || undefined,
        memory: memory || undefined,
        accelerators: accelerators || undefined,
        region: region || undefined,
        zone: zone || undefined,
        use_spot: useSpot,
        idle_minutes_to_autostop: idleMinutesToAutostop
          ? parseInt(idleMinutesToAutostop)
          : undefined,
      };

      const response = await fetch(buildApiUrl("skypilot/launch"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(launchRequest),
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
          Launch SkyPilot Cluster
        </Button>
      </Box>

      {/* Launch Cluster Modal */}
      <Modal open={showLaunchModal} onClose={() => setShowLaunchModal(false)}>
        <ModalDialog size="lg" sx={{ width: "90vw", maxWidth: "800px" }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Launch SkyPilot Cluster
          </Typography>

          <Stack spacing={3}>
            {/* Basic Configuration */}
            <Card variant="outlined">
              <Typography level="title-sm" sx={{ mb: 2 }}>
                Basic Configuration
              </Typography>
              <Stack spacing={2}>
                <FormControl required>
                  <FormLabel>Cluster Name</FormLabel>
                  {cloud === "ssh" ? (
                    <Select
                      value={clusterName}
                      onChange={(_, value) => setClusterName(value || "")}
                      placeholder="Select SSH cluster"
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
                      placeholder="my-skypilot-cluster"
                    />
                  )}
                  {cloud === "ssh" && sshClusters.length === 0 && (
                    <Typography level="body-sm" color="warning">
                      No SSH clusters found. Create SSH clusters in the "SSH
                      Clusters" tab first.
                    </Typography>
                  )}
                </FormControl>

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
                      onChange={(_, value) => setCloud(value || "")}
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
                    />
                  </FormControl>

                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel>Memory (GB)</FormLabel>
                    <Input
                      value={memory}
                      onChange={(e) => setMemory(e.target.value)}
                      placeholder="e.g., 16, 32+"
                    />
                  </FormControl>
                </Box>

                <FormControl>
                  <FormLabel>Accelerators</FormLabel>
                  <Input
                    value={accelerators}
                    onChange={(e) => setAccelerators(e.target.value)}
                    placeholder="e.g., V100, V100:2, A100:4"
                  />
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
                disabled={!clusterName || !command || loading}
                loading={loading}
                startDecorator={<Play size={16} />}
              >
                Launch Cluster
              </Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default SkyPilotClusterLauncher;
