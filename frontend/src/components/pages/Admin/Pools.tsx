import React, { useState } from "react";
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
  IconButton,
  Card,
  Divider,
} from "@mui/joy";
import { Plus, Server, Gpu, Cloud, Trash2, Settings, Star } from "lucide-react";
import useSWR from "swr";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import { useNotification } from "../../../components/NotificationSystem";

import RunPodIcon from "./icons/runpod.svg";
import AzureIcon from "./icons/azure.svg";
import { useNavigate } from "react-router-dom";
import CloudServiceIcon from "../../widgets/CloudServiceIcon";

const Pools: React.FC = () => {
  const [openAdd, setOpenAdd] = useState(false);
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const { addNotification } = useNotification();

  const navigate = useNavigate();

  // Define pool type
  interface Pool {
    platform?: string;
    provider?: string;
    name?: string;
    numberOfNodes?: number;
    max_instances?: number;
    status?: string;
    config?: {
      is_configured: boolean;
      config_key?: string;
      is_default?: boolean;
    };
    access?: string[];
  }
  const { showFakeData } = useFakeData();

  // SWR fetcher function
  const fetcher = async (url: string) => {
    const response = await apiFetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Failed to fetch");
    }
    return response.json();
  };

  // Use SWR for data fetching
  const { data, error, mutate } = useSWR(buildApiUrl("node-pools/"), fetcher);

  const nodePools = data?.node_pools || [];
  const loading = !data && !error;

  // Check if Azure, RunPod, or GCP configurations already exist
  const hasAzureConfig = nodePools.some(
    (pool: Pool) => pool.provider === "azure"
  );
  const hasRunPodConfig = nodePools.some(
    (pool: Pool) => pool.provider === "runpod"
  );
  const hasGcpConfig = nodePools.some((pool: Pool) => pool.provider === "gcp");

  const handleConfigurePool = (pool: Pool) => {
    setSelectedPool(pool);
    // Open the appropriate configuration page in a new tab based on platform
    const baseUrl = window.location.origin;
    const poolName = encodeURIComponent(
      pool.name || pool.provider || "unknown"
    );
    const configKey = pool.config?.config_key;

    switch (pool.provider) {
      case "azure":
        navigate(
          `/dashboard/admin/azure-config?mode=configure&poolName=${poolName}`
        );
        break;
      case "runpod":
        navigate(
          `/dashboard/admin/runpod-config?mode=configure&poolName=${poolName}`
        );
        break;
      case "gcp":
        navigate(
          `/dashboard/admin/gcp-config?mode=configure&poolName=${poolName}`
        );
        break;
      case "direct":
        navigate(
          `/dashboard/admin/ssh-config?mode=configure&poolName=${poolName}`
        );
        break;
      default:
        navigate(
          `/dashboard/admin/azure-config?mode=configure&poolName=${poolName}`
        );
    }
  };

  const handleSetDefault = async (platform: string, configKey: string) => {
    try {
      const endpoint =
        platform === "azure"
          ? buildApiUrl(`clouds/azure/config/${configKey}/set-default`)
          : platform === "runpod"
          ? buildApiUrl(`clouds/runpod/config/${configKey}/set-default`)
          : buildApiUrl(`clouds/gcp/config/${configKey}/set-default`);

      const response = await apiFetch(endpoint, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        addNotification({
          type: "success",
          message: `${
            platform === "azure"
              ? "Azure"
              : platform === "runpod"
              ? "RunPod"
              : "GCP"
          } config set as default successfully`,
        });
        // Refresh the data
        mutate();
        // Refresh the specific config data
        if (platform === "azure") {
          // Trigger a refetch of Azure configs
          window.location.reload();
        } else if (platform === "runpod") {
          // Trigger a refetch of RunPod configs
          window.location.reload();
        } else {
          // Trigger a refetch of GCP configs
          window.location.reload();
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message:
            errorData.detail || `Failed to set ${platform} config as default`,
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: `Error setting ${platform} config as default`,
      });
    }
  };

  const handleDeleteConfig = async (platform: string, configKey: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete this ${platform} configuration?`
      )
    ) {
      return;
    }

    try {
      const endpoint =
        platform === "azure"
          ? buildApiUrl(`clouds/azure/config/${configKey}`)
          : platform === "runpod"
          ? buildApiUrl(`clouds/runpod/config/${configKey}`)
          : buildApiUrl(`clouds/gcp/config/${configKey}`);

      const response = await apiFetch(endpoint, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        addNotification({
          type: "success",
          message: `${
            platform === "azure"
              ? "Azure"
              : platform === "runpod"
              ? "RunPod"
              : "GCP"
          } configuration deleted successfully`,
        });
        // Refresh the data
        mutate();
        // Refresh the specific config data
        if (platform === "azure") {
          // Trigger a refetch of Azure configs
          window.location.reload();
        } else if (platform === "runpod") {
          // Trigger a refetch of RunPod configs
          window.location.reload();
        } else {
          // Trigger a refetch of GCP configs
          window.location.reload();
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "danger",
          message:
            errorData.detail || `Failed to delete ${platform} configuration`,
        });
      }
    } catch (err) {
      addNotification({
        type: "danger",
        message: `Error deleting ${platform} configuration`,
      });
    }
  };

  const handleDeletePool = async (pool: Pool) => {
    if (pool.provider !== "direct") {
      return; // Only allow deletion of direct platform pools
    }

    if (!window.confirm(`Are you sure you want to delete "${pool.name}"?`)) {
      return;
    }

    try {
      const response = await apiFetch(
        buildApiUrl(`node-pools/ssh-node-pools/${pool.name}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Refresh the data
        mutate();
      } else {
        console.error("Failed to delete pool");
      }
    } catch (error) {
      console.error("Error deleting pool:", error);
    }
  };

  return (
    <PageWithTitle
      title="Node Pools"
      subtitle="Configure and manage node pools for different platforms (Azure, RunPod, Direct Connect Node Pools)."
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
      <>
        {loading && nodePools.length === 0 ? (
          <Alert color="primary" sx={{ mb: 2 }}>
            Loading node pools...
          </Alert>
        ) : nodePools.length > 0 ? (
          <Table
            className="node-pools-table"
            sx={{
              "& th:nth-child(4), & td:nth-child(4)": {
                /* Status column */ width: "100px",
                minWidth: "100px",
              },
              "& th:nth-child(5), & td:nth-child(5)": {
                /* Access column */ width: "150px",
                minWidth: "150px",
              },
              "& th:nth-child(6), & td:nth-child(6)": {
                /* Actions column */ width: "200px",
                minWidth: "200px",
              },
            }}
          >
            <thead>
              <tr>
                <th>Pool Name</th>
                <th>Platform</th>
                <th>Nodes</th>
                <th>Status</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodePools.map((pool: Pool) => (
                <tr
                  key={
                    pool.provider === "direct"
                      ? pool.name
                      : `${pool.provider}-${pool.config?.config_key}`
                  }
                >
                  <td>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography level="title-sm">
                        {pool.name || "Unnamed Pool"}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      startDecorator={
                        <CloudServiceIcon
                          platform={pool.provider || "unknown"}
                        />
                      }
                    >
                      {pool.provider || "unknown"}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight="lg">
                      {pool.numberOfNodes || pool.max_instances || 0}
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
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      {(pool.access || []).map((team: string) => (
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
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        minWidth: "fit-content",
                      }}
                    >
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => handleConfigurePool(pool)}
                      >
                        Configure
                      </Button>
                      {pool.provider === "direct" && (
                        <IconButton
                          size="sm"
                          color="danger"
                          variant="plain"
                          onClick={() => handleDeletePool(pool)}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                    </Box>
                  </td>
                </tr>
              ))}
              {showFakeData && (
                <tr key="fake-gcp-pool">
                  <td>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography level="title-sm">
                        GCP Instances Pool
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Chip
                      size="sm"
                      variant="soft"
                      startDecorator={<CloudServiceIcon platform="gcp" />}
                    >
                      gcp
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm" fontWeight="lg">
                      25
                    </Typography>
                  </td>
                  <td>
                    <Chip size="sm" color="success">
                      enabled
                    </Chip>
                  </td>
                  <td>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Chip size="sm" variant="soft" color="success">
                        Admin
                      </Chip>
                      <Chip size="sm" variant="soft" color="primary">
                        Research Team
                      </Chip>
                    </Box>
                  </td>
                  <td>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        minWidth: "fit-content",
                      }}
                    >
                      <Button
                        size="sm"
                        variant="outlined"
                        disabled
                        sx={{ opacity: 0.6, cursor: "not-allowed" }}
                      >
                        Configure
                      </Button>
                    </Box>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        ) : (
          <Alert color="warning" sx={{ mb: 2 }}>
            No node pools configured. Use "Add Node Pool" to create your first
            pool.
          </Alert>
        )}
      </>

      {/* Add Node Pool Modal */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)}>
        <ModalDialog>
          <Typography level="h4">Add Node Pool</Typography>
          <Stack spacing={2} direction="column" sx={{ mt: 1 }}>
            <Typography level="body-md">Choose a platform:</Typography>
            {(hasAzureConfig || hasRunPodConfig) && (
              <Alert color="primary" size="sm">
                Note: Only one Azure and one RunPod configuration is allowed per
                system.
              </Alert>
            )}
            <Stack direction="column" spacing={1}>
              <Button
                variant="outlined"
                startDecorator={<CloudServiceIcon platform="azure" />}
                disabled={hasAzureConfig}
                sx={{
                  opacity: hasAzureConfig ? 0.6 : 1,
                  cursor: hasAzureConfig ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (hasAzureConfig) return;
                  setOpenAdd(false);
                  navigate(
                    `/dashboard/admin/azure-config?mode=add&poolName=new-azure-pool`
                  );
                }}
              >
                Azure {hasAzureConfig && "(Already Configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<CloudServiceIcon platform="runpod" />}
                disabled={hasRunPodConfig}
                sx={{
                  opacity: hasRunPodConfig ? 0.6 : 1,
                  cursor: hasRunPodConfig ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (hasRunPodConfig) return;
                  setOpenAdd(false);
                  navigate(
                    `/dashboard/admin/runpod-config?mode=add&poolName=new-runpod-pool`
                  );
                }}
              >
                RunPod {hasRunPodConfig && "(Already Configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<CloudServiceIcon platform="gcp" />}
                disabled={hasGcpConfig}
                sx={{
                  opacity: hasGcpConfig ? 0.6 : 1,
                  cursor: hasGcpConfig ? "not-allowed" : "pointer",
                }}
                onClick={() => {
                  if (hasGcpConfig) return;
                  setOpenAdd(false);
                  navigate(
                    `/dashboard/admin/gcp-config?mode=add&poolName=new-gcp-pool`
                  );
                }}
              >
                Google Cloud Platform {hasGcpConfig && "(Already Configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<Server size={16} />}
                onClick={() => {
                  setOpenAdd(false);
                  navigate(
                    `/dashboard/admin/ssh-config?mode=add&poolName=new-node-pool`
                  );
                }}
              >
                Create Direct Connect Node Pool
              </Button>
            </Stack>
            <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </PageWithTitle>
  );
};

export default Pools;
