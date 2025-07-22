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
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "@mui/joy";
import { Plus, Trash2, Monitor } from "lucide-react";
import SkyPilotClusterLauncher from "./SkyPilotClusterLauncher";
import SkyPilotClusterStatus from "./SkyPilotClusterStatus";

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

interface ClusterManagementProps {
  onClusterSelected?: (clusterName: string) => void;
}

const ClusterManagement: React.FC<ClusterManagementProps> = ({
  onClusterSelected,
}) => {
  const [clusters, setClusters] = useState<string[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Form states
  const [newClusterName, setNewClusterName] = useState("");
  const [newClusterUser, setNewClusterUser] = useState("");
  const [newClusterIdentityFile, setNewClusterIdentityFile] = useState("");
  const [newClusterPassword, setNewClusterPassword] = useState("");

  const [newNodeIp, setNewNodeIp] = useState("");
  const [newNodeUser, setNewNodeUser] = useState("");
  const [newNodeIdentityFile, setNewNodeIdentityFile] = useState("");
  const [newNodePassword, setNewNodePassword] = useState("");

  useEffect(() => {
    if (activeTab === 0) {
      fetchClusters();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchClusters();
  }, []);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/clusters", {
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
      const response = await fetch(`/api/clusters/${clusterName}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCluster(data);
        if (onClusterSelected) {
          onClusterSelected(clusterName);
        }
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
      const response = await fetch("/api/clusters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cluster_name: newClusterName,
          user: newClusterUser || undefined,
          identity_file: newClusterIdentityFile || undefined,
          password: newClusterPassword || undefined,
        }),
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
      const response = await fetch(
        `/api/clusters/${selectedCluster.cluster_name}/nodes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            cluster_name: selectedCluster.cluster_name,
            node: {
              ip: newNodeIp,
              user: newNodeUser,
              identity_file: newNodeIdentityFile || undefined,
              password: newNodePassword || undefined,
            },
          }),
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
      const response = await fetch(`/api/clusters/${clusterName}`, {
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
        `/api/clusters/${selectedCluster.cluster_name}/nodes/${nodeIp}`,
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
    <Box sx={{ p: 3 }}>
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
        <Typography level="h2">Cluster Management</Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value as number)}
      >
        <TabList>
          <Tab>SSH Clusters</Tab>
          <Tab>SkyPilot Clusters</Tab>
        </TabList>

        <TabPanel value={0}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
            <Typography level="h3">SSH Cluster Configuration</Typography>
            <Button
              startDecorator={<Plus size={16} />}
              onClick={() => setShowCreateModal(true)}
              disabled={loading}
            >
              Create SSH Cluster
            </Button>
          </Box>

          {/* SSH Clusters List */}
          <Card sx={{ mb: 3 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              SSH Clusters
            </Typography>
            {clusters.length === 0 ? (
              <Typography level="body-md" sx={{ color: "text.secondary" }}>
                No SSH clusters found. Create your first cluster to get started.
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

          {/* Selected Cluster Details */}
          {selectedCluster && (
            <Card>
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
              >
                <Typography level="h4">
                  Cluster: {selectedCluster.cluster_name}
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
                        <td>{node.identity_file || "-"}</td>
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
        </TabPanel>

        <TabPanel value={1}>
          <Stack spacing={3}>
            <SkyPilotClusterLauncher />
            <SkyPilotClusterStatus />
          </Stack>
        </TabPanel>
      </Tabs>

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
              <Input
                value={newClusterIdentityFile}
                onChange={(e) => setNewClusterIdentityFile(e.target.value)}
                placeholder="~/.ssh/id_rsa"
              />
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
              <Input
                value={newNodeIdentityFile}
                onChange={(e) => setNewNodeIdentityFile(e.target.value)}
                placeholder="/path/to/private/key.pem"
              />
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
    </Box>
  );
};

export default ClusterManagement;
