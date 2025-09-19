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
} from "@mui/joy";
import { Rocket } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useNotification } from "../NotificationSystem";
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

  const selectedTemplate = React.useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );
  const tpl = selectedTemplate?.resources_json || {};

  // Fetch templates when modal opens
  React.useEffect(() => {
    if (open) {
      // Load templates for general instance launching
      (async () => {
        try {
          const resp = await apiFetch(
            buildApiUrl("instances/templates?cloud_type=aws"),
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
  }, [open]);

  const resetForm = () => {
    setInstanceName("");
    setSetupCommand("");
    setVcpus("");
    setMemory("");
    setGpus("");
    setDiskSpace("");
    setZone("");
    setRegion("");
    setSelectedTemplateId("");
    setShowAdvanced(false);
  };

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

      const finalSetup = autoAppendSemicolons
        ? appendSemicolons(setupCommand)
        : setupCommand;
      if (finalSetup) {
        formData.append("setup", finalSetup);
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

      if (finalRegion) {
        formData.append("region", finalRegion);
      }

      if (finalZone) {
        formData.append("zone", finalZone);
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

          {/* Template selector */}
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
            {selectedTemplate && (
              <Typography
                level="body-xs"
                sx={{ mt: 0.5, color: "success.500" }}
              >
                ✓ Template selected:{" "}
                {selectedTemplate.name || selectedTemplate.id}
              </Typography>
            )}
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
              Use <code>;</code> at the end of each line for separate commands,
              or enable auto-append.
            </Typography>
          </FormControl>

          <FormControl sx={{ mb: 2 }}>
            <Checkbox
              label="Auto-append ; to each non-empty line"
              checked={autoAppendSemicolons}
              onChange={(e) => setAutoAppendSemicolons(e.target.checked)}
            />
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
