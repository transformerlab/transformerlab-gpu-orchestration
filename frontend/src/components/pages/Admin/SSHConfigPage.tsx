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
  Table,
  Chip,
  IconButton,
  Select,
  Option,
  Alert,
  CircularProgress,
} from "@mui/joy";
import { Plus, Trash2, Monitor, ArrowLeft, Save, Server } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";
import { useNotification } from "../../../components/NotificationSystem";
import { useNavigate, useSearchParams } from "react-router-dom";

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

const SSHConfigPage: React.FC = () => {
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if this is for configuring an existing pool or adding a new one
  const isConfigureMode = searchParams.get("mode") === "configure";
  const initialPoolName = searchParams.get("poolName") || "Node Pool";

  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newClusterName, setNewClusterName] = useState(initialPoolName);
  const [newClusterUser, setNewClusterUser] = useState("");
  const [newClusterIdentityFile, setNewClusterIdentityFile] =
    useState<string>("");
  const [newClusterPassword, setNewClusterPassword] = useState("");

  const [newNodeIp, setNewNodeIp] = useState("");
  const [newNodeUser, setNewNodeUser] = useState("");
  const [newNodeIdentityFile, setNewNodeIdentityFile] = useState<string>("");
  const [newNodePassword, setNewNodePassword] = useState("");

  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);

  useEffect(() => {
    const loadData = async () => {
      await fetchIdentityFiles();

      if (isConfigureMode) {
        // In configure mode, load the specific cluster details
        await fetchClusterDetails(newClusterName);
      } else {
        // In add mode, load all clusters
        await fetchClusters();
      }
    };

    loadData();
  }, [isConfigureMode, newClusterName]);

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

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("clusters"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setClusters(data.clusters);
      } else {
        setError("Failed to fetch clusters");
      }
    } catch (err) {
      setError("Error fetching clusters");
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterDetails = async (clusterName: string) => {
    try {
      const response = await apiFetch(buildApiUrl(`clusters/${clusterName}`), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCluster(data);
      } else {
        addNotification({
          type: "danger",
          message: "Failed to fetch cluster details",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error fetching cluster details",
      });
    }
  };

  const createCluster = async () => {
    try {
      setLoading(true);
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
          message: "Node Pool created successfully",
        });

        // After successful creation, fetch the cluster details to show the "Add Node" functionality
        await fetchClusterDetails(newClusterName);

        // Clear the form
        setNewClusterName("");
        setNewClusterUser("");
        setNewClusterIdentityFile("");
        setNewClusterPassword("");
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to create Node Pool",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error creating Node Pool",
      });
    } finally {
      setLoading(false);
    }
  };

  const addNode = async () => {
    if (!selectedCluster) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("ip", newNodeIp);
      formData.append("user", newNodeUser);
      if (newNodePassword) formData.append("password", newNodePassword);
      if (newNodeIdentityFile)
        formData.append("identity_file_path", newNodeIdentityFile);

      const response = await apiFetch(
        buildApiUrl(`clusters/${selectedCluster.cluster_name}/nodes`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        addNotification({
          type: "success",
          message: "Node added successfully",
        });
        setShowAddNodeModal(false);
        setNewNodeIp("");
        setNewNodeUser("");
        setNewNodeIdentityFile("");
        setNewNodePassword("");
        fetchClusterDetails(selectedCluster.cluster_name);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to add node",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error adding node",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCluster = async (clusterName: string) => {
    try {
      const response = await apiFetch(buildApiUrl(`clusters/${clusterName}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        addNotification({
          type: "success",
          message: "Node Pool deleted successfully",
        });
        fetchClusters();
        if (selectedCluster?.cluster_name === clusterName) {
          setSelectedCluster(null);
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to delete node pool",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error deleting node pool",
      });
    }
  };

  const removeNode = async (nodeIp: string) => {
    if (!selectedCluster) return;

    try {
      const response = await apiFetch(
        buildApiUrl(`clusters/${selectedCluster.cluster_name}/nodes/${nodeIp}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        addNotification({
          type: "success",
          message: "Node removed successfully",
        });
        fetchClusterDetails(selectedCluster.cluster_name);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to remove node",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error removing node",
      });
    }
  };

  if (loading) {
    return (
      <PageWithTitle
        title={`${isConfigureMode ? "Configure" : "Add"} Node Pool`}
        backButton
        onBack={() => navigate("/dashboard/admin/pools")}
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title={`${isConfigureMode ? "Configure" : "Add"} Direct Node Pool`}
      backButton
      onBack={() => navigate("/dashboard/admin/pools")}
    >
      <Stack spacing={3}>
        {!isConfigureMode ? (
          // For new cluster creation, show only the form
          <Card variant="outlined">
            <Typography level="h4" sx={{ mb: 2 }}>
              <Server
                size={20}
                style={{ marginRight: 8, verticalAlign: "middle" }}
              />
              Create New Node Pool
            </Typography>
            <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
              Create a new node pool by providing cluster details and adding
              nodes.
            </Typography>

            <Stack spacing={2}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl sx={{ flex: 1 }} required>
                  <FormLabel>Node Pool Name</FormLabel>
                  <Input
                    value={newClusterName}
                    onChange={(e) => setNewClusterName(e.target.value)}
                    placeholder="my-node-pool"
                  />
                </FormControl>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Default User (optional)</FormLabel>
                  <Input
                    value={newClusterUser}
                    onChange={(e) => setNewClusterUser(e.target.value)}
                    placeholder="ubuntu"
                  />
                </FormControl>
              </Box>

              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Identity File (Optional)</FormLabel>
                  <Select
                    value={newClusterIdentityFile}
                    onChange={(_, value) =>
                      setNewClusterIdentityFile(value || "")
                    }
                    placeholder="Select identity file"
                  >
                    <Option value="">No identity file</Option>
                    {identityFiles.map((file) => (
                      <Option key={file.path} value={file.path}>
                        {file.display_name}
                      </Option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Password (Optional)</FormLabel>
                  <Input
                    type="password"
                    value={newClusterPassword}
                    onChange={(e) => setNewClusterPassword(e.target.value)}
                    placeholder="Enter password if no identity file"
                  />
                </FormControl>
              </Box>

              <Button
                startDecorator={<Save size={16} />}
                onClick={createCluster}
                disabled={!newClusterName || loading}
              >
                Create Node Pool
              </Button>
            </Stack>
          </Card>
        ) : (
          // For configure mode, show the nodes management
          <Card variant="outlined">
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
            >
              <Typography level="h4">
                <Monitor
                  size={20}
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                Nodes
              </Typography>
              {selectedCluster && (
                <Button
                  startDecorator={<Plus size={16} />}
                  size="sm"
                  onClick={() => setShowAddNodeModal(true)}
                  disabled={loading}
                >
                  Add Node
                </Button>
              )}
            </Box>

            {error && (
              <Alert color="danger" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {selectedCluster ? (
              selectedCluster.nodes.length === 0 ? (
                <Typography level="body-md" sx={{ color: "text.secondary" }}>
                  No nodes in this cluster. Add nodes to get started.
                </Typography>
              ) : (
                <Table size="sm">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>User</th>
                      <th>Auth Method</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCluster.nodes.map((node) => (
                      <tr key={node.ip}>
                        <td>{node.ip}</td>
                        <td>{node.user}</td>
                        <td>
                          <Chip size="sm" variant="soft">
                            {node.identity_file ? "Key" : "Password"}
                          </Chip>
                        </td>
                        <td>
                          <IconButton
                            size="sm"
                            color="danger"
                            onClick={() => removeNode(node.ip)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )
            ) : (
              <Alert color="warning">Loading cluster details...</Alert>
            )}
          </Card>
        )}

        {/* Add Node Modal */}
        <Modal
          open={showAddNodeModal}
          onClose={() => setShowAddNodeModal(false)}
        >
          <ModalDialog>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Add Node to {selectedCluster?.cluster_name}
            </Typography>
            <Stack spacing={2}>
              <FormControl required>
                <FormLabel>IP Address</FormLabel>
                <Input
                  value={newNodeIp}
                  onChange={(e) => setNewNodeIp(e.target.value)}
                  placeholder="192.168.1.100"
                />
              </FormControl>
              <FormControl required>
                <FormLabel>User</FormLabel>
                <Input
                  value={newNodeUser}
                  onChange={(e) => setNewNodeUser(e.target.value)}
                  placeholder="ubuntu"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Identity File (optional)</FormLabel>
                <Select
                  value={newNodeIdentityFile}
                  onChange={(_, value) => setNewNodeIdentityFile(value || "")}
                  placeholder="Select an identity file"
                >
                  <Option value="">No identity file</Option>
                  {identityFiles.map((file) => (
                    <Option key={file.path} value={file.path}>
                      {file.display_name}
                    </Option>
                  ))}
                </Select>
                {newNodeIdentityFile && (
                  <Typography
                    level="body-sm"
                    sx={{ mt: 0.5, color: "text.secondary" }}
                  >
                    Selected:{" "}
                    {
                      identityFiles.find((f) => f.path === newNodeIdentityFile)
                        ?.display_name
                    }
                  </Typography>
                )}
              </FormControl>
              <FormControl>
                <FormLabel>Password (optional)</FormLabel>
                <Input
                  type="password"
                  value={newNodePassword}
                  onChange={(e) => setNewNodePassword(e.target.value)}
                  placeholder="password"
                />
              </FormControl>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button
                  variant="plain"
                  onClick={() => setShowAddNodeModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={addNode}
                  disabled={!newNodeIp || !newNodeUser || loading}
                >
                  Add Node
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>
      </Stack>
    </PageWithTitle>
  );
};

export default SSHConfigPage;
