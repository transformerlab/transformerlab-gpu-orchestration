import React, { useState } from "react";
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
} from "@mui/joy";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { Cluster } from "../ClusterCard";
import { useNotification } from "../NotificationSystem";

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
  const [customClusterName, setCustomClusterName] = useState("");
  const [command, setCommand] = useState('echo "Welcome to Lattice"');
  const [setup, setSetup] = useState("");
  const [cpus, setCpus] = useState("");
  const [memory, setMemory] = useState("");
  const [accelerators, setAccelerators] = useState("");
  const [region, setRegion] = useState("");
  const [zone, setZone] = useState("");
  const [loading, setLoading] = useState(false);

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

    try {
      const formData = new FormData();
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
      if (region) formData.append("region", region);
      if (zone) formData.append("zone", zone);
      formData.append("use_spot", "false");
      formData.append("launch_mode", "custom");

      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
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
      <ModalDialog sx={{ maxWidth: 600 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          Reserve an Instance - {clusterName}
        </Typography>
        <form onSubmit={handleSubmit}>
          <Card variant="outlined">
            <CardContent>
              <Alert color="primary" sx={{ mb: 2 }}>
                <Typography level="body-sm">
                  <strong>Direct Connect Mode:</strong> This will reserve an
                  instance from the {clusterName} node pool using direct SSH
                  connection.
                </Typography>
              </Alert>

              <FormControl sx={{ mb: 2 }}>
                <FormLabel>Cluster Name (optional)</FormLabel>
                <Input
                  value={customClusterName}
                  onChange={(e) => setCustomClusterName(e.target.value)}
                  placeholder={`Leave empty to use node pool name: ${clusterName}`}
                />
                <Typography level="body-xs" sx={{ mt: 0.5, color: "text.secondary" }}>
                  Custom name for this cluster instance. If empty, will use the node pool name.
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

              {/* Resource Configuration */}
              <Card variant="soft" sx={{ mb: 2, mt: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
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
                <FormControl sx={{ mb: 1 }}>
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
                <FormControl sx={{ mb: 1 }}>
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
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Accelerators</FormLabel>
                  <Input
                    value={accelerators}
                    onChange={(e) => setAccelerators(e.target.value)}
                    placeholder="e.g., V100, V100:2, A100:4"
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Region</FormLabel>
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Not applicable for SSH"
                    disabled
                  />
                </FormControl>
                <FormControl sx={{ mb: 1 }}>
                  <FormLabel>Zone</FormLabel>
                  <Input
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="Not applicable for SSH"
                    disabled
                  />
                </FormControl>
              </Card>

              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button variant="plain" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!command || loading}
                  color="success"
                >
                  Reserve Node
                </Button>
              </Box>
            </CardContent>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default ReserveNodeModal;
