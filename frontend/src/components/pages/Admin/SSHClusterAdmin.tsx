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
} from "@mui/joy";
import { Plus, Trash2, Monitor } from "lucide-react";
import { buildApiUrl } from "../../../utils/api";
import PageWithTitle from "../templates/PageWithTitle";

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

const SSHClusterAdmin: React.FC = () => {
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

  useEffect(() => {
    fetchClusters();
    fetchIdentityFiles();
  }, []);

  const fetchIdentityFiles = async () => {
    try {
      const response = await fetch(buildApiUrl("clusters/identity-files"), {
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
      const response = await fetch(buildApiUrl("clusters"), {
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
      setLoading(true);
      const response = await fetch(buildApiUrl(`clusters/${clusterName}`), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCluster(data);
      } else {
        setError("Failed to fetch cluster details");
      }
    } catch (err) {
      setError("Error fetching cluster details");
    } finally {
      setLoading(false);
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
      const response = await fetch(buildApiUrl("clusters"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (response.ok) {
        setShowCreateModal(false);
        setNewClusterName("");
        setNewClusterUser("");
        setNewClusterIdentityFile("");
        setNewClusterPassword("");
        fetchClusters();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to create cluster");
      }
    } catch (err) {
      setError("Error creating cluster");
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
      const response = await fetch(
        buildApiUrl(`clusters/${selectedCluster.cluster_name}/nodes`),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );
      if (response.ok) {
        setShowAddNodeModal(false);
        setNewNodeIp("");
        setNewNodeUser("");
        setNewNodeIdentityFile("");
        setNewNodePassword("");
        fetchClusterDetails(selectedCluster.cluster_name);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Failed to add node");
      }
    } catch (err) {
      setError("Error adding node");
    } finally {
      setLoading(false);
    }
  };

  const deleteCluster = async (clusterName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete cluster "${clusterName}"?`
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`clusters/${clusterName}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        fetchClusters();
        if (selectedCluster?.cluster_name === clusterName) {
          setSelectedCluster(null);
        }
      } else {
        setError("Failed to delete cluster");
      }
    } catch (err) {
      setError("Error deleting cluster");
    } finally {
      setLoading(false);
    }
  };

  const removeNode = async (nodeIp: string) => {
    if (!selectedCluster) return;
    if (!window.confirm(`Are you sure you want to remove node ${nodeIp}?`)) {
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`clusters/${selectedCluster.cluster_name}/nodes/${nodeIp}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (response.ok) {
        fetchClusterDetails(selectedCluster.cluster_name);
      } else {
        setError("Failed to remove node");
      }
    } catch (err) {
      setError("Error removing node");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWithTitle
      title="SSH Cluster Management"
      subtitle="Add, remove, and manage SSH clusters and their nodes."
    >
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

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography level="h3">Node Pool Configuration</Typography>
        <Button
          startDecorator={<Plus size={16} />}
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
        >
          Create Node Pool
        </Button>
      </Box>
      <Card sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Node Pools
        </Typography>
        {clusters.length === 0 ? (
          <Typography level="body-md" sx={{ color: "text.secondary" }}>
            No Node Pools found. Create your first node pool to get started.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {clusters.map((clusterName) => (
              <Box
                key={clusterName}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  p: 2,
                  border: "1px solid",
                  borderColor:
                    selectedCluster?.cluster_name === clusterName
                      ? "primary.main"
                      : "neutral.300",
                  borderRadius: "md",
                  cursor: "pointer",
                  bgcolor:
                    selectedCluster?.cluster_name === clusterName
                      ? "primary.50"
                      : "transparent",
                }}
                onClick={() => fetchClusterDetails(clusterName)}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Monitor size={16} />
                  <Typography level="title-md">{clusterName}</Typography>
                  {selectedCluster?.cluster_name === clusterName && (
                    <Chip variant="soft" color="primary" size="sm">
                      Selected
                    </Chip>
                  )}
                </Box>
                <IconButton
                  color="danger"
                  variant="plain"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCluster(clusterName);
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </Card>
      {selectedCluster && (
        <Card>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Typography level="h4">
              Node Pool: {selectedCluster.cluster_name}
            </Typography>
            <Button
              startDecorator={<Plus size={16} />}
              size="sm"
              onClick={() => setShowAddNodeModal(true)}
              disabled={loading}
            >
              Add Node
            </Button>
          </Box>
          {selectedCluster.nodes.length === 0 ? (
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              No nodes in this cluster. Add nodes to get started.
            </Typography>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>User</th>
                  <th>Identity File</th>
                  <th>Password</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedCluster.nodes.map((node, index) => (
                  <tr key={index}>
                    <td>{node.ip}</td>
                    <td>{node.user}</td>
                    <td>
                      {node.identity_file ? (
                        <Chip size="sm" variant="soft">
                          {node.identity_file.split("/").pop() ||
                            node.identity_file}
                        </Chip>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{node.password ? "****" : "-"}</td>
                    <td>
                      <IconButton
                        color="danger"
                        variant="plain"
                        size="sm"
                        onClick={() => removeNode(node.ip)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
      {/* Create Cluster Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Create New Cluster
          </Typography>
          <Stack spacing={2}>
            <FormControl required>
              <FormLabel>Cluster Name</FormLabel>
              <Input
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                placeholder="my-cluster"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Default User (optional)</FormLabel>
              <Input
                value={newClusterUser}
                onChange={(e) => setNewClusterUser(e.target.value)}
                placeholder="ubuntu"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Default Identity File (optional)</FormLabel>
              <Select
                value={newClusterIdentityFile}
                onChange={(_, value) => setNewClusterIdentityFile(value || "")}
                placeholder="Select an identity file"
              >
                {identityFiles.map((file) => (
                  <Option key={file.path} value={file.path}>
                    {file.display_name}
                  </Option>
                ))}
              </Select>
              {newClusterIdentityFile && (
                <Typography
                  level="body-sm"
                  sx={{ mt: 0.5, color: "text.secondary" }}
                >
                  Selected:{" "}
                  {
                    identityFiles.find((f) => f.path === newClusterIdentityFile)
                      ?.display_name
                  }
                </Typography>
              )}
            </FormControl>
            <FormControl>
              <FormLabel>Default Password (optional)</FormLabel>
              <Input
                type="password"
                value={newClusterPassword}
                onChange={(e) => setNewClusterPassword(e.target.value)}
                placeholder="password"
              />
            </FormControl>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button variant="plain" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={createCluster}
                disabled={!newClusterName || loading}
              >
                Create Cluster
              </Button>
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>
      {/* Add Node Modal */}
      <Modal open={showAddNodeModal} onClose={() => setShowAddNodeModal(false)}>
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
    </PageWithTitle>
  );
};

export default SSHClusterAdmin;
