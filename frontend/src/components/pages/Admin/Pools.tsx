import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  Button,
  Chip,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Alert,
} from "@mui/joy";
import { Plus, Server, Gpu, Cloud } from "lucide-react";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import AzureConfigModal from "./AzureConfigModal";
import RunPodConfigModal from "./RunPodConfigModal";
import SSHConfigModal from "./SSHConfigModal";
import SSHClusterModal from "./SSHClusterModal";

import RunPodIcon from "./icons/runpod.svg";
import AzureIcon from "./icons/azure.svg";

// This function returns an icon based on the platform provided:
function CloudServiceIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "azure":
      return (
        <img src={AzureIcon} alt="Azure" style={{ width: 16, height: 16 }} />
      );
    case "runpod":
      return (
        <img src={RunPodIcon} alt="RunPod" style={{ width: 16, height: 16 }} />
      );
    case "direct":
      return <Server size={16} />;
    default:
      return <Server size={16} />;
  }
}

const Pools: React.FC = () => {
  const [openAdd, setOpenAdd] = useState(false);
  const [openAzureModal, setOpenAzureModal] = useState(false);
  const [openRunPodModal, setOpenRunPodModal] = useState(false);
  const [openSSHModal, setOpenSSHModal] = useState(false);
  const [openSSHClusterModal, setOpenSSHClusterModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const [nodePools, setNodePools] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { showFakeData } = useFakeData();

  const fetchNodePools = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(buildApiUrl("skypilot/node-pools"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setNodePools(data.node_pools || []);
      } else {
        console.error("Error fetching node pools:", response.status);
        // Keep existing data if fetch fails
      }
    } catch (err) {
      console.error("Error fetching node pools:", err);
      // Keep existing data if fetch fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showFakeData) {
      fetchNodePools();
    }
  }, [showFakeData]);

  const handleConfigurePool = (pool: any) => {
    setSelectedPool(pool);
    // Open the appropriate modal based on platform
    switch (pool.platform) {
      case "azure":
        setOpenAzureModal(true);
        break;
      case "runpod":
        setOpenRunPodModal(true);
        break;
      case "direct":
        setOpenSSHModal(true);
        break;
      default:
        setOpenAzureModal(true);
    }
  };

  return (
    <PageWithTitle
      title="Node Pools"
      subtitle="Configure and manage node pools for different platforms (Azure, RunPod, SSH clusters)."
      button={
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Plus size={16} />}
          onClick={() => setOpenAdd(true)}
        >
          Add Node Pool
        </Button>
      }
    >
      {showFakeData ? (
        <>
          {loading && nodePools.length === 0 ? (
            <Alert color="info" sx={{ mb: 2 }}>
              Loading node pools...
            </Alert>
          ) : nodePools.length > 0 ? (
            <Table className="node-pools-table">
              <thead>
                <tr>
                  <th>Pool Name</th>
                  <th>Platform</th>
                  <th>Nodes</th>
                  <th>Status</th>
                  <th>Configuration</th>
                  <th>Access</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nodePools.map((pool) => (
                  <tr
                    key={pool.platform === "direct" ? pool.name : pool.platform}
                  >
                    <td>
                      <Typography level="title-sm">
                        {pool.name || "Unnamed Pool"}
                      </Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        variant="soft"
                        startDecorator={
                          <CloudServiceIcon
                            platform={pool.platform || "unknown"}
                          />
                        }
                      >
                        {pool.platform || "unknown"}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm" fontWeight="lg">
                        {pool.numberOfNodes || 0}
                      </Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          (pool.status || "disabled") === "enabled"
                            ? "success"
                            : "warning"
                        }
                      >
                        {pool.status || "disabled"}
                      </Chip>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          pool.config?.is_configured || false
                            ? "success"
                            : "warning"
                        }
                        variant="soft"
                      >
                        {pool.config?.is_configured || false
                          ? "Configured"
                          : "Not Configured"}
                      </Chip>
                    </td>
                    <td>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {(pool.access || []).map((team) => (
                          <Chip
                            key={team}
                            size="sm"
                            variant="soft"
                            color={
                              (team || "") === "Admin"
                                ? "success"
                                : (team || "") === "Research Team"
                                ? "primary"
                                : (team || "") === "Search ML Team"
                                ? "warning"
                                : "success"
                            }
                          >
                            {team || "Unknown"}
                          </Chip>
                        ))}
                      </Box>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => handleConfigurePool(pool)}
                      >
                        Configure
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert color="warning" sx={{ mb: 2 }}>
              No node pools configured. Use "Add Node Pool" to create your first
              pool.
            </Alert>
          )}
        </>
      ) : (
        <Alert color="primary" sx={{ mb: 2 }}>
          Node pool management functionality is not yet implemented. Enable fake
          data in Settings to see sample data.
        </Alert>
      )}

      {/* Add Node Pool Modal */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <ModalDialog>
          <Typography level="h4">Add Node Pool</Typography>
          <Stack spacing={2} direction="column" sx={{ mt: 1 }}>
            <Typography level="body-md">Choose a platform:</Typography>
            <Stack direction="column" spacing={1}>
              <Button
                variant="outlined"
                startDecorator={<CloudServiceIcon platform="azure" />}
                onClick={() => {
                  setOpenAdd(false);
                  setSelectedPool({
                    platform: "azure",
                    name: "New Azure Pool",
                  });
                  setOpenAzureModal(true);
                }}
                disabled={nodePools.some((pool) => pool.platform === "azure")}
              >
                Azure{" "}
                {nodePools.some((pool) => pool.platform === "azure") &&
                  "(Already configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<CloudServiceIcon platform="runpod" />}
                onClick={() => {
                  setOpenAdd(false);
                  setSelectedPool({
                    platform: "runpod",
                    name: "New RunPod Pool",
                  });
                  setOpenRunPodModal(true);
                }}
                disabled={nodePools.some((pool) => pool.platform === "runpod")}
              >
                RunPod{" "}
                {nodePools.some((pool) => pool.platform === "runpod") &&
                  "(Already configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<Server size={16} />}
                onClick={() => {
                  setOpenAdd(false);
                  setOpenSSHClusterModal(true);
                }}
              >
                Create SSH Cluster
              </Button>
            </Stack>
            <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Configuration Modals */}
      <AzureConfigModal
        open={openAzureModal}
        onClose={() => setOpenAzureModal(false)}
        poolName={selectedPool?.name}
        onConfigSaved={fetchNodePools}
      />
      <RunPodConfigModal
        open={openRunPodModal}
        onClose={() => setOpenRunPodModal(false)}
        poolName={selectedPool?.name}
        onConfigSaved={fetchNodePools}
      />
      <SSHConfigModal
        open={openSSHModal}
        onClose={() => setOpenSSHModal(false)}
        poolName={selectedPool?.name}
        selectedPool={selectedPool}
      />
      <SSHClusterModal
        open={openSSHClusterModal}
        onClose={() => setOpenSSHClusterModal(false)}
        onClusterCreated={fetchNodePools}
      />
    </PageWithTitle>
  );
};

export default Pools;
