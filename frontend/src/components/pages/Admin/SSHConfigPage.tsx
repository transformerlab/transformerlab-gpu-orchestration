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
  name?: string; // Optional name for frontend display
  identity_file?: string;
  password?: string;
  resources?: {
    vcpus?: string;
    memory_gb?: string;
  };
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

interface TeamOption {
  id: string;
  name: string;
}

const SSHConfigPage: React.FC = () => {
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if this is for configuring an existing pool or adding a new one
  const isConfigureMode = searchParams.get("mode") === "configure";
  const initialPoolName = isConfigureMode
    ? searchParams.get("poolName") || "Node Pool"
    : "";

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

  // Validation states
  const [nameValidationError, setNameValidationError] = useState<string | null>(
    null,
  );
  const [isValidatingName, setIsValidatingName] = useState(false);

  const [newNodeIp, setNewNodeIp] = useState("");
  const [newNodeUser, setNewNodeUser] = useState("");
  const [newNodeName, setNewNodeName] = useState(""); // Node name for frontend display
  const [newNodeIdentityFile, setNewNodeIdentityFile] = useState<string>("");
  const [newNodePassword, setNewNodePassword] = useState("");
  const [newNodeVcpus, setNewNodeVcpus] = useState("");
  const [newNodeMemoryGb, setNewNodeMemoryGb] = useState("");

  const [identityFiles, setIdentityFiles] = useState<IdentityFile[]>([]);
  const [availableTeams, setAvailableTeams] = useState<TeamOption[]>([]);
  const [allowedTeamIds, setAllowedTeamIds] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await fetchIdentityFiles();
      await fetchAvailableTeams();

      if (isConfigureMode) {
        // In configure mode, load the specific cluster details
        await fetchClusterDetails(newClusterName);
        await fetchPoolAccess(newClusterName);
      } else {
        // In add mode, load all clusters
        await fetchClusters();
      }
    };

    loadData();
  }, [isConfigureMode, initialPoolName]);

  const fetchIdentityFiles = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl("node-pools/ssh-node-pools/identity-files"),
        {
          credentials: "include",
        },
      );
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
      const response = await apiFetch(
        buildApiUrl("node-pools/ssh-node-pools"),
        {
          credentials: "include",
        },
      );
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

  const fetchAvailableTeams = async () => {
    try {
      const response = await apiFetch(buildApiUrl("admin/teams"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const teams: TeamOption[] = (data.teams || []).map((t: any) => ({
          id: t.id,
          name: t.name,
        }));
        setAvailableTeams(teams);
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  const fetchPoolAccess = async (clusterName: string) => {
    try {
      const response = await apiFetch(
        buildApiUrl(`node-pools/ssh-node-pools/${clusterName}/access`),
        { credentials: "include" },
      );
      if (response.ok) {
        const data = await response.json();
        setAllowedTeamIds(data.allowed_team_ids || []);
      }
    } catch (err) {
      console.error("Error fetching pool access:", err);
    }
  };

  const fetchClusterDetails = async (clusterName: string) => {
    try {
      const response = await apiFetch(
        buildApiUrl(`node-pools/ssh-node-pools/${clusterName}`),
        {
          credentials: "include",
        },
      );
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

  // Validate pool name format
  const validatePoolNameFormat = (name: string): string | null => {
    if (!name || !name.trim()) {
      return "Pool name cannot be empty";
    }
    if (name.includes(" ")) {
      return "Pool name cannot contain spaces";
    }
    if (name[0] && name[0].match(/\d/)) {
      return "Pool name cannot start with a number";
    }
    return null;
  };

  // Check if pool name exists in database
  const validatePoolNameExists = async (
    name: string,
  ): Promise<string | null> => {
    if (!name || !name.trim()) {
      return null; // Let format validation handle empty names
    }

    try {
      setIsValidatingName(true);
      const response = await apiFetch(
        buildApiUrl(
          `node-pools/ssh-node-pools/check-name/${encodeURIComponent(name)}`,
        ),
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (response.ok) {
        return null; // Name is available
      } else {
        const errorData = await response.json();
        return errorData.detail || "Pool name is not available";
      }
    } catch (err) {
      console.error("Error validating pool name:", err);
      return "Error validating pool name";
    } finally {
      setIsValidatingName(false);
    }
  };

  // Handle pool name change with validation
  const handlePoolNameChange = async (name: string) => {
    setNewClusterName(name);
    setNameValidationError(null);

    // First check format validation
    const formatError = validatePoolNameFormat(name);
    if (formatError) {
      setNameValidationError(formatError);
      return;
    }

    // If format is valid, check if name exists (with debounce)
    if (name.trim()) {
      const existsError = await validatePoolNameExists(name);
      if (existsError) {
        setNameValidationError(existsError);
      }
    }
  };

  const createCluster = async () => {
    // Validate name before submission
    const formatError = validatePoolNameFormat(newClusterName);
    if (formatError) {
      setNameValidationError(formatError);
      addNotification({
        type: "danger",
        message: formatError,
      });
      return;
    }

    // Check if name exists
    const existsError = await validatePoolNameExists(newClusterName);
    if (existsError) {
      setNameValidationError(existsError);
      addNotification({
        type: "danger",
        message: existsError,
      });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("cluster_name", newClusterName);
      if (newClusterUser) formData.append("user", newClusterUser);
      if (newClusterPassword) formData.append("password", newClusterPassword);
      if (newClusterIdentityFile)
        formData.append("identity_file_path", newClusterIdentityFile);

      const response = await apiFetch(
        buildApiUrl("node-pools/ssh-node-pools"),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

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
        setNameValidationError(null);
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
      if (newNodeName) formData.append("name", newNodeName);
      if (newNodePassword) formData.append("password", newNodePassword);
      if (newNodeIdentityFile)
        formData.append("identity_file_path", newNodeIdentityFile);
      if (newNodeVcpus) formData.append("vcpus", newNodeVcpus);
      if (newNodeMemoryGb) formData.append("memory_gb", newNodeMemoryGb);

      const response = await apiFetch(
        buildApiUrl(
          `node-pools/ssh-node-pools/${selectedCluster.cluster_name}/nodes`,
        ),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      if (response.ok) {
        addNotification({
          type: "success",
          message: "Node added successfully",
        });
        setShowAddNodeModal(false);
        setNewNodeIp("");
        setNewNodeUser("");
        setNewNodeName("");
        setNewNodeIdentityFile("");
        setNewNodePassword("");
        setNewNodeVcpus("");
        setNewNodeMemoryGb("");
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
      const response = await apiFetch(
        buildApiUrl(`node-pools/ssh-node-pools/${clusterName}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );

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
        buildApiUrl(
          `node-pools/ssh-node-pools/${selectedCluster.cluster_name}/nodes/${nodeIp}`,
        ),
        {
          method: "DELETE",
          credentials: "include",
        },
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

  const savePoolAccess = async () => {
    if (!selectedCluster) return;
    try {
      setSavingAccess(true);
      const response = await apiFetch(
        buildApiUrl(
          `node-pools/ssh-node-pools/${selectedCluster.cluster_name}/access`,
        ),
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowed_team_ids: allowedTeamIds }),
        },
      );
      if (response.ok) {
        addNotification({ type: "success", message: "Access updated" });
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message: errorData.detail || "Failed to update access",
        });
      }
    } catch (err) {
      addNotification({ type: "danger", message: "Error updating access" });
    } finally {
      setSavingAccess(false);
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
                    onChange={(e) => handlePoolNameChange(e.target.value)}
                    placeholder="my-node-pool"
                    error={!!nameValidationError}
                    endDecorator={
                      isValidatingName ? <CircularProgress size="sm" /> : null
                    }
                  />
                  {nameValidationError && (
                    <Typography
                      level="body-xs"
                      sx={{ color: "danger.500", mt: 0.5 }}
                    >
                      {nameValidationError}
                    </Typography>
                  )}
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
                disabled={
                  !newClusterName ||
                  loading ||
                  !!nameValidationError ||
                  isValidatingName
                }
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
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    startDecorator={<Plus size={16} />}
                    size="sm"
                    onClick={() => setShowAddNodeModal(true)}
                    disabled={loading}
                  >
                    Add Node
                  </Button>
                </Box>
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
                      <th>Name</th>
                      <th>IP Address</th>
                      <th>User</th>
                      <th>Auth Method</th>
                      <th>Resources</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCluster.nodes.map((node) => (
                      <tr key={node.ip}>
                        <td>{node.name || "-"}</td>
                        <td>{node.ip}</td>
                        <td>{node.user}</td>
                        <td>
                          <Chip size="sm" variant="soft">
                            {node.identity_file ? "Key" : "Password"}
                          </Chip>
                        </td>
                        <td>
                          {node.resources ? (
                            <Box>
                              {node.resources.vcpus && (
                                <Typography level="body-xs">
                                  vCPUs: {node.resources.vcpus}
                                </Typography>
                              )}
                              {node.resources.memory_gb && (
                                <Typography level="body-xs">
                                  Memory: {node.resources.memory_gb} GB
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography
                              level="body-xs"
                              sx={{ color: "text.secondary" }}
                            >
                              Not specified
                            </Typography>
                          )}
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
                <FormLabel>Node Name</FormLabel>
                <Input
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="e.g., GPU Server 1, Compute Node A"
                />
              </FormControl>
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
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>vCPUs Available on the Node (optional)</FormLabel>
                  <Input
                    type="number"
                    value={newNodeVcpus}
                    onChange={(e) => setNewNodeVcpus(e.target.value)}
                    placeholder="e.g., 4, 8, 16"
                  />
                </FormControl>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel>
                    Memory in GB Available on the Node (optional)
                  </FormLabel>
                  <Input
                    type="number"
                    value={newNodeMemoryGb}
                    onChange={(e) => setNewNodeMemoryGb(e.target.value)}
                    placeholder="e.g., 8, 16, 32"
                  />
                </FormControl>
              </Box>
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

        {isConfigureMode && selectedCluster && (
          <Card variant="outlined">
            <Typography level="h4" sx={{ mb: 2 }}>
              Team Access
            </Typography>
            <Typography level="body-sm" sx={{ mb: 2, color: "neutral.500" }}>
              Choose which teams can use this node pool.
            </Typography>
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>Allowed Teams</FormLabel>
                <Select
                  multiple
                  placeholder="Select teams..."
                  value={allowedTeamIds}
                  onChange={(_, value) => setAllowedTeamIds(value as string[])}
                >
                  {availableTeams.map((team) => (
                    <Option key={team.id} value={team.id}>
                      {team.name}
                    </Option>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  onClick={() =>
                    setAllowedTeamIds(availableTeams.map((t) => t.id))
                  }
                >
                  Allow All
                </Button>
                <Button variant="plain" onClick={() => setAllowedTeamIds([])}>
                  Clear
                </Button>
                <Button onClick={savePoolAccess} loading={savingAccess}>
                  Save Access
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
