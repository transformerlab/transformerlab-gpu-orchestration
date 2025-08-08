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

interface InstanceLauncherProps {
  open: boolean;
  onClose: () => void;
}

const InstanceLauncher: React.FC<InstanceLauncherProps> = ({
  open,
  onClose,
}) => {
  const [setupCommand, setSetupCommand] = useState("");
  const [vcpus, setVcpus] = useState("");
  const [memory, setMemory] = useState("");
  const [gpus, setGpus] = useState("");
  const [zone, setZone] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call delay
    setTimeout(() => {
      setSuccess(true);
      setLoading(false);

      // Close modal after showing success message
      setTimeout(() => {
        setSuccess(false);
        onClose();
        // Reset form
        setSetupCommand("");
        setVcpus("");
        setMemory("");
        setGpus("");
        setZone("");
        setRegion("");
      }, 2000);
    }, 1500);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: 600 }}>
        <ModalClose />
        <Typography level="h4" sx={{ mb: 2 }}>
          Launch an Instance
        </Typography>

        <form onSubmit={handleLaunch}>
          <Card variant="outlined">
            <CardContent>
              {success && (
                <Alert color="success" sx={{ mb: 2 }}>
                  ✅ Instance launched successfully!
                </Alert>
              )}

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

              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
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
            </CardContent>
          </Card>
        </form>
      </ModalDialog>
    </Modal>
  );
};

export default InstanceLauncher;
