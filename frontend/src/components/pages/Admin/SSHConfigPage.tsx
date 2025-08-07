import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Input,
  FormControl,
  FormLabel,
  Stack,
  Table,
  Chip,
  IconButton,
  Select,
  Option,
  Alert,
  CircularProgress,
} from "@mui/joy";
import { Plus, Trash2, Monitor, ArrowLeft, Save } from "lucide-react";
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
  const initialPoolName = searchParams.get("poolName") || "SSH Cluster";

  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterUser, setNewClusterUser] = useState("");
  const [newClusterIdentityFile, setNewClusterIdentityFile] =
    useState<string>("");
  const [newClusterPassword, setNewClusterPassword] = useState("");

  const [newNodeIp, setNewNodeIp] = useState("");
  const [newNodeUser, setNewNodeUser] = useState("");
  const [newNodeIdentityFile, setNewNodeIdentityFile] = useState<string>("");
  const [newNodePassword, setNewNodePassword] = useState("");

  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [poolName, setPoolName] = useState(initialPoolName);

  useEffect(() => {
    fetchClusters();
    fetchIdentityFiles();
  }, []);

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
        setShowCreateModal(false);
        setNewClusterName("");
        setNewClusterUser("");
        setNewClusterIdentityFile("");
        setNewClusterPassword("");
        fetchClusters();

        // Navigate back to pools page after successful creation
        setTimeout(() => {
          navigate("/dashboard/admin/pools");
        }, 1500);
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to create SSH cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error creating SSH cluster",
      });
    }
  };

  const addNode = async () => {
    if (!selectedCluster) return;

    try {
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
          message: "Cluster deleted successfully",
        });
        fetchClusters();
        if (selectedCluster?.cluster_name === clusterName) {
          setSelectedCluster(null);
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to delete cluster",
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: "Error deleting cluster",
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
        title={`${isConfigureMode ? "Configure" : "Add"} SSH Cluster`}
        subtitle={`${
          isConfigureMode ? "Configure" : "Add"
        } SSH cluster settings for ${poolName}`}
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      </PageWithTitle>
    );
  }

  return (
    <PageWithTitle
      title={`${isConfigureMode ? "Configure" : "Add"} SSH Cluster`}
      subtitle={`${
        isConfigureMode ? "Configure" : "Add"
      } SSH cluster settings for ${poolName}`}
      button={
        <Button
          variant="outlined"
          startDecorator={<ArrowLeft size={16} />}
          onClick={() => navigate("/dashboard/admin/pools")}
        >
          Back to Pools
        </Button>
      }
    >
      <Stack spacing={3}>
        {/* Pool Name Configuration */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            Pool Configuration
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Configure the name for this SSH cluster pool.
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Pool Name</FormLabel>
              <Input
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder="Enter pool name"
              />
            </FormControl>
          </Stack>
        </Card>

        {/* Create New Cluster */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Plus
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Create New SSH Cluster
          </Typography>
          <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
            Create a new SSH cluster by providing the initial node details.
          </Typography>

          <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Cluster Name</FormLabel>
                <Input
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="Enter cluster name"
                />
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormLabel>Default User</FormLabel>
                <Input
                  value={newClusterUser}
                  onChange={(e) => setNewClusterUser(e.target.value)}
                  placeholder="Enter default user (e.g., ubuntu)"
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
              disabled={!newClusterName || !newClusterUser}
            >
              Create Cluster
            </Button>
          </Stack>
        </Card>

        {/* Existing Clusters */}
        <Card variant="outlined">
          <Typography level="h4" sx={{ mb: 2 }}>
            <Monitor
              size={20}
              style={{ marginRight: 8, verticalAlign: "middle" }}
            />
            Existing SSH Clusters
          </Typography>

          {error && (
            <Alert color="danger" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {clusters.length === 0 ? (
            <Alert color="warning">
              No SSH clusters configured. Create your first cluster above.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {clusters.map((clusterName) => (
                <Card key={clusterName} variant="soft" sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography level="title-lg">{clusterName}</Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => fetchClusterDetails(clusterName)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        color="danger"
                        onClick={() => deleteCluster(clusterName)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </Box>

                  {selectedCluster?.cluster_name === clusterName && (
                    <Box sx={{ mt: 2 }}>
                      <Typography level="title-sm" sx={{ mb: 1 }}>
                        Nodes in {clusterName}:
                      </Typography>
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

                      <Button
                        size="sm"
                        variant="outlined"
                        startDecorator={<Plus size={14} />}
                        onClick={() => setShowAddNodeModal(true)}
                        sx={{ mt: 2 }}
                      >
                        Add Node
                      </Button>
                    </Box>
                  )}
                </Card>
              ))}
            </Stack>
          )}
        </Card>

        {/* Add Node Modal */}
        {showAddNodeModal && (
          <Card variant="outlined">
            <Typography level="h4" sx={{ mb: 2 }}>
              Add Node to {selectedCluster?.cluster_name}
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>IP Address</FormLabel>
                  <Input
                    value={newNodeIp}
                    onChange={(e) => setNewNodeIp(e.target.value)}
                    placeholder="Enter IP address"
                  />
                </FormControl>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>User</FormLabel>
                  <Input
                    value={newNodeUser}
                    onChange={(e) => setNewNodeUser(e.target.value)}
                    placeholder="Enter user"
                  />
                </FormControl>
              </Box>

              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>Identity File (Optional)</FormLabel>
                  <Select
                    value={newNodeIdentityFile}
                    onChange={(_, value) => setNewNodeIdentityFile(value || "")}
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
                    value={newNodePassword}
                    onChange={(e) => setNewNodePassword(e.target.value)}
                    placeholder="Enter password if no identity file"
                  />
                </FormControl>
              </Box>

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button onClick={addNode} disabled={!newNodeIp || !newNodeUser}>
                  Add Node
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowAddNodeModal(false)}
                >
                  Cancel
                </Button>
              </Box>
            </Stack>
          </Card>
        )}
      </Stack>
    </PageWithTitle>
  );
};

export default SSHConfigPage;
