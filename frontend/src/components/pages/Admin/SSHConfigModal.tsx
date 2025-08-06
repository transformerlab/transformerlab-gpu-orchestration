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
  Alert,
  Grid,
  Select,
  Option,
} from "@mui/joy";
import { Plus, Save } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useNotification } from "../../../components/NotificationSystem";

interface SSHNode {
  ip: string;
  user: string;
  identity_file?: string;
  password?: string;
}

interface IdentityFile {
  path: string;
  display_name: string;
  original_filename: string;
  size: number;
  permissions: string;
  created: number;
}

interface SSHConfigModalProps {
  open: boolean;
  onClose: () => void;
  poolName?: string;
  selectedPool?: any; // The pool object from the main list
}

const SSHConfigModal: React.FC<SSHConfigModalProps> = ({
  open,
  onClose,
  poolName = "SSH Pool",
  selectedPool,
}) => {
  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addNotification } = useNotification();

  // Form states for new node
  const [newNodeIp, setNewNodeIp] = useState("");
  const [newNodeUser, setNewNodeUser] = useState("");
  const [newNodeIdentityFile, setNewNodeIdentityFile] = useState<string>("");
  const [newNodePassword, setNewNodePassword] = useState("");

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

  const addNode = async () => {
    if (!selectedPool) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("ip", newNodeIp);
      formData.append("user", newNodeUser);
      if (newNodePassword) formData.append("password", newNodePassword);
      if (newNodeIdentityFile)
        formData.append("identity_file_path", newNodeIdentityFile);

      const response = await apiFetch(
        buildApiUrl(`clusters/${selectedPool.name}/nodes`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        addNotification({
          type: "success",
          message: `Node added to ${selectedPool.name} successfully`,
        });
        // Reset form
        setNewNodeIp("");
        setNewNodeUser("");
        setNewNodeIdentityFile("");
        setNewNodePassword("");
        onClose();
      } else {
        addNotification({
          type: "danger",
          message: "Failed to add node to cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error adding node to cluster",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog size="lg">
        <ModalClose />
        <Typography level="h4">
          Add Node to {selectedPool?.name || poolName}
        </Typography>
        <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
          Add a new node to the {selectedPool?.name || poolName} SSH cluster
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={3}>
              {selectedPool && (
                <>
                  <Alert color="primary">
                    This cluster currently has {selectedPool.numberOfNodes}{" "}
                    nodes configured.
                  </Alert>

                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>Node IP</FormLabel>
                        <Input
                          value={newNodeIp}
                          onChange={(e) => setNewNodeIp(e.target.value)}
                          placeholder="Enter node IP address"
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>User</FormLabel>
                        <Input
                          value={newNodeUser}
                          onChange={(e) => setNewNodeUser(e.target.value)}
                          placeholder="Enter user"
                        />
                      </FormControl>
                    </Grid>
                  </Grid>
                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>Identity File (Optional)</FormLabel>
                        <Select
                          value={newNodeIdentityFile}
                          onChange={(_, value) =>
                            setNewNodeIdentityFile(value || "")
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
                          value={newNodePassword}
                          onChange={(e) => setNewNodePassword(e.target.value)}
                          placeholder="Enter password"
                        />
                      </FormControl>
                    </Grid>
                  </Grid>
                  <Button
                    variant="outlined"
                    startDecorator={<Plus size={16} />}
                    onClick={addNode}
                    disabled={saving || !newNodeIp || !newNodeUser}
                  >
                    {saving ? "Adding..." : "Add Node"}
                  </Button>
                </>
              )}
            </Stack>
          )}
        </Card>
      </ModalDialog>
    </Modal>
  );
};

export default SSHConfigModal;
