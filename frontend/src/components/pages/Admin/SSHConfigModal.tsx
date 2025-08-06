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
  Chip,
  Alert,
  Divider,
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

interface Cluster {
  cluster_name: string;
  nodes: SSHNode[];
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
  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
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

  // Form states for new node
  const [newNodeIp, setNewNodeIp] = useState("");
  const [newNodeUser, setNewNodeUser] = useState("");
  const [newNodeIdentityFile, setNewNodeIdentityFile] = useState<string>("");
  const [newNodePassword, setNewNodePassword] = useState("");

  useEffect(() => {
    if (open) {
      if (selectedPool) {
        // If we have a specific pool, set it as the selected cluster
        setSelectedCluster({
          cluster_name: selectedPool.name,
          nodes: [], // We'll fetch the actual nodes
        });
      }
      fetchClusters();
      fetchIdentityFiles();
    }
  }, [open, selectedPool]);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("clusters"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setClusters(data.clusters);
      }
    } catch (err) {
      console.error("Error fetching clusters:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIdentityFiles = async () => {
    try {
      const response = await apiFetch(buildApiUrl("clusters/identity-files"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setIdentityFiles(data.identity_files);
      }
    } catch (err) {
      console.error("Error fetching identity files:", err);
    }
  };

  const createCluster = async () => {
    try {
      setSaving(true);
      const response = await apiFetch(buildApiUrl("clusters"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cluster_name: newClusterName,
          user: newClusterUser,
          identity_file: newClusterIdentityFile || undefined,
          password: newClusterPassword || undefined,
        }),
      });

      if (response.ok) {
        addNotification({
          type: "success",
          message: "SSH cluster created successfully",
        });
        setNewClusterName("");
        setNewClusterUser("");
        setNewClusterIdentityFile("");
        setNewClusterPassword("");
        await fetchClusters();
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

  const addNode = async () => {
    if (!selectedCluster) return;

    try {
      setSaving(true);
      const response = await apiFetch(
        buildApiUrl(`clusters/${selectedCluster.cluster_name}/nodes`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ip: newNodeIp,
            user: newNodeUser,
            identity_file: newNodeIdentityFile || undefined,
            password: newNodePassword || undefined,
          }),
        }
      );

      if (response.ok) {
        addNotification({
          type: "success",
          message: "Node added successfully",
        });
        setNewNodeIp("");
        setNewNodeUser("");
        setNewNodeIdentityFile("");
        setNewNodePassword("");
        await fetchClusters();
      } else {
        addNotification({
          type: "danger",
          message: "Failed to add node",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error adding node",
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
          Configure {selectedPool?.name || poolName}
        </Typography>
        <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
          SSH/Direct Connect Configuration
          {selectedPool?.name && ` - ${selectedPool.name}`}
        </Typography>

        <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={3}>
              {selectedPool ? (
                // Show specific cluster configuration
                <>
                  <Typography level="h6">
                    Configure Cluster: {selectedPool.name}
                  </Typography>
                  <Alert color="info">
                    This cluster has {selectedPool.numberOfNodes} nodes
                    configured.
                  </Alert>

                  <Divider />

                  <Typography level="h6">Add New Node</Typography>
                </>
              ) : (
                // Show all clusters
                <>
                  <Typography level="h6">Existing Clusters</Typography>
                  {clusters.length > 0 ? (
                    <Stack spacing={1}>
                      {clusters.map((cluster) => (
                        <Chip key={cluster} variant="soft">
                          {cluster}
                        </Chip>
                      ))}
                    </Stack>
                  ) : (
                    <Alert color="warning">
                      No SSH clusters configured. Add a new cluster to get
                      started.
                    </Alert>
                  )}

                  <Divider />

                  <Typography level="h6">Add New Cluster</Typography>
                </>
              )}
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Cluster Name</FormLabel>
                    <Input
                      value={newClusterName}
                      onChange={(e) => setNewClusterName(e.target.value)}
                      placeholder="Enter cluster name"
                    />
                  </FormControl>
                </Grid>
                <Grid xs={6}>
                  <FormControl>
                    <FormLabel>Default User</FormLabel>
                    <Input
                      value={newClusterUser}
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
                      value={newClusterIdentityFile}
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
                      value={newClusterPassword}
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
                {saving ? "Creating..." : "Add Cluster"}
              </Button>

              <Divider />

              <Typography level="h6">Add Node to Cluster</Typography>
              <FormControl>
                <FormLabel>Select Cluster</FormLabel>
                <Select
                  value={selectedCluster?.cluster_name || ""}
                  onChange={(_, value) => {
                    const cluster = clusters.find((c) => c === value);
                    setSelectedCluster(
                      cluster ? { cluster_name: cluster, nodes: [] } : null
                    );
                  }}
                  placeholder="Select a cluster"
                >
                  {clusters.map((cluster) => (
                    <Option key={cluster} value={cluster}>
                      {cluster}
                    </Option>
                  ))}
                </Select>
              </FormControl>
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
                disabled={
                  saving || !selectedCluster || !newNodeIp || !newNodeUser
                }
              >
                {saving ? "Adding..." : "Add Node"}
              </Button>
            </Stack>
          )}
        </Card>
      </ModalDialog>
    </Modal>
  );
};

export default SSHConfigModal;
