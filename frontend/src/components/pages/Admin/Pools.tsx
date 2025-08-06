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

const Pools: React.FC = () => {
  const [openAdd, setOpenAdd] = useState(false);
  const [openAzureModal, setOpenAzureModal] = useState(false);
  const [openRunPodModal, setOpenRunPodModal] = useState(false);
  const [openSSHModal, setOpenSSHModal] = useState(false);
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
      }
    } catch (err) {
      console.error("Error fetching node pools:", err);
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
          {loading ? (
            <Alert color="info" sx={{ mb: 2 }}>
              Loading node pools...
            </Alert>
          ) : (
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
                  <tr key={pool.name}>
                    <td>
                      <Typography level="title-sm">{pool.name}</Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        variant="soft"
                        startDecorator={
                          pool.platform === "azure" ? (
                            <Cloud size={14} />
                          ) : pool.platform === "runpod" ? (
                            <Gpu size={14} />
                          ) : (
                            <Server size={14} />
                          )
                        }
                      >
                        {pool.platform}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm" fontWeight="lg">
                        {pool.numberOfNodes}
                      </Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          pool.status === "enabled" ? "success" : "warning"
                        }
                      >
                        {pool.status}
                      </Chip>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          pool.config.is_configured ? "success" : "warning"
                        }
                        variant="soft"
                      >
                        {pool.config.is_configured
                          ? "Configured"
                          : "Not Configured"}
                      </Chip>
                    </td>
                    <td>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {pool.access.map((team) => (
                          <Chip
                            key={team}
                            size="sm"
                            variant="soft"
                            color={
                              team === "Admin"
                                ? "success"
                                : team === "Research Team"
                                ? "primary"
                                : team === "Search ML Team"
                                ? "warning"
                                : "success"
                            }
                          >
                            {team}
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
                startDecorator={<Cloud size={16} />}
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
                startDecorator={<Gpu size={16} />}
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
                  setSelectedPool({ platform: "direct", name: "New SSH Pool" });
                  setOpenSSHModal(true);
                }}
              >
                SSH/Direct Connect
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
      />
      <RunPodConfigModal
        open={openRunPodModal}
        onClose={() => setOpenRunPodModal(false)}
        poolName={selectedPool?.name}
      />
      <SSHConfigModal
        open={openSSHModal}
        onClose={() => setOpenSSHModal(false)}
        poolName={selectedPool?.name}
        selectedPool={selectedPool}
      />
    </PageWithTitle>
  );
};

export default Pools;
