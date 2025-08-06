import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Card,
  FormControl,
  FormLabel,
  Input,
  Button,
  Stack,
  CircularProgress,
  Grid,
  Select,
  Option,
} from "@mui/joy";
import { Plus, Save } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useNotification } from "../../../components/NotificationSystem";

interface IdentityFile {
  path: string;
  display_name: string;
  original_filename: string;
  size: number;
  permissions: string;
  created: number;
}

interface SSHClusterModalProps {
  open: boolean;
  onClose: () => void;
  onClusterCreated?: () => void;
}

const SSHClusterModal: React.FC<SSHClusterModalProps> = ({
  open,
  onClose,
  onClusterCreated,
}) => {
  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addNotification } = useNotification();

  // Form states for new cluster
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterUser, setNewClusterUser] = useState("");
  const [newClusterIdentityFile, setNewClusterIdentityFile] =
    useState<string>("");
  const [newClusterPassword, setNewClusterPassword] = useState("");

  useEffect(() => {
    if (open) {
      fetchIdentityFiles();
    }
  }, [open]);

  const fetchIdentityFiles = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clusters/identity-files"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIdentityFiles(data.identity_files || []);
      }
    } catch (err) {
      console.error("Error fetching identity files:", err);
    }
  };

  const createCluster = async () => {
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("cluster_name", newClusterName);
      if (newClusterUser) formData.append("user", newClusterUser);
      if (newClusterPassword) formData.append("password", newClusterPassword);
      if (newClusterIdentityFile)
        formData.append("identity_file_path", newClusterIdentityFile);

      const response = await apiFetch(buildApiUrl("clusters"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        addNotification({
          type: "success",
          message: "SSH cluster created successfully",
        });
        // Reset form
        setNewClusterName("");
        setNewClusterUser("");
        setNewClusterIdentityFile("");
        setNewClusterPassword("");
        onClusterCreated?.();
        onClose();
      } else {
        addNotification({
          type: "danger",
          message: "Failed to create SSH cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error creating SSH cluster",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog size="lg">
        <ModalClose />
        <Typography level="h4">Create New SSH Cluster</Typography>
        <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
          Create a new SSH cluster for direct node management
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Cluster Name</FormLabel>
                    <Input
                      value={newClusterName || ""}
                      onChange={(e) => setNewClusterName(e.target.value)}
                      placeholder="Enter cluster name"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Default User</FormLabel>
                    <Input
                      value={newClusterUser || ""}
                      onChange={(e) => setNewClusterUser(e.target.value)}
                      placeholder="Enter default user"
                    />
                  </FormControl>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Identity File (Optional)</FormLabel>
                    <Select
                      value={newClusterIdentityFile || ""}
                      onChange={(_, value) =>
                        setNewClusterIdentityFile(value || "")
                      }
                      placeholder="Select identity file"
                    >
                      <Option value="">None</Option>
                      {identityFiles.map((file) => (
                        <Option key={file.path} value={file.path}>
                          {file.display_name}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Password (Optional)</FormLabel>
                    <Input
                      type="password"
                      value={newClusterPassword || ""}
                      onChange={(e) => setNewClusterPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </FormControl>
                </Grid>
              </Grid>
              <Button
                variant="outlined"
                startDecorator={<Plus size={16} />}
                onClick={createCluster}
                disabled={saving || !newClusterName || !newClusterUser}
              >
                {saving ? "Creating..." : "Create Cluster"}
              </Button>
            </Stack>
          )}
        </Card>
      </ModalDialog>
    </Modal>
  );
};

export default SSHClusterModal;
