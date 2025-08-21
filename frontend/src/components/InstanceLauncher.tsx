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
import { buildApiUrl, apiFetch } from "../utils/api";
import { useNotification } from "./NotificationSystem";

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
  const [zone, setZone] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addNotification } = useNotification();

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Use the instance name from the form
      const clusterName = instanceName || `instance-${Date.now()}`;

      // Create form data for the API call
      const formData = new FormData();
      formData.append("cluster_name", clusterName);
      formData.append("command", "echo 'Instance launched successfully'");

      if (setupCommand) {
        formData.append("setup", setupCommand);
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

      if (region) {
        formData.append("region", region);
      }

      if (zone) {
        formData.append("zone", zone);
      }

      const response = await apiFetch(buildApiUrl("skypilot/launch"), {
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
        setInstanceName("");
        setSetupCommand("");
        setVcpus("");
        setMemory("");
        setGpus("");
        setZone("");
        setRegion("");

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
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
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

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Instance Name</FormLabel>
            <Input
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="e.g., my-instance, training-cluster"
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
