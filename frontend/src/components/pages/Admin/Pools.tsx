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
} from "@mui/joy";
import { Plus, Server, Gpu, Cloud } from "lucide-react";
import useSWR from "swr";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";
import { buildApiUrl, apiFetch } from "../../../utils/api";

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
  const [selectedPool, setSelectedPool] = useState<any>(null);

  // Define pool type
  interface Pool {
    platform: string;
    name?: string;
    numberOfNodes?: number;
    status?: string;
    config?: {
      is_configured: boolean;
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
  const { data, error, mutate } = useSWR(
    buildApiUrl("skypilot/node-pools"),
    fetcher
  );

  const nodePools = data?.node_pools || [];
  const loading = !data && !error;

  const handleConfigurePool = (pool: Pool) => {
    setSelectedPool(pool);
    // Open the appropriate configuration page in a new tab based on platform
    const baseUrl = window.location.origin;
    const poolName = encodeURIComponent(pool.name || pool.platform);

    switch (pool.platform) {
      case "azure":
        window.open(
          `${baseUrl}/dashboard/admin/azure-config?mode=configure&poolName=${poolName}`,
          "_blank"
        );
        break;
      case "runpod":
        window.open(
          `${baseUrl}/dashboard/admin/runpod-config?mode=configure&poolName=${poolName}`,
          "_blank"
        );
        break;
      case "direct":
        window.open(
          `${baseUrl}/dashboard/admin/ssh-config?mode=configure&poolName=${poolName}`,
          "_blank"
        );
        break;
      default:
        window.open(
          `${baseUrl}/dashboard/admin/azure-config?mode=configure&poolName=${poolName}`,
          "_blank"
        );
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
              {nodePools.map((pool: Pool) => (
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
                  const baseUrl = window.location.origin;
                  window.open(
                    `${baseUrl}/dashboard/admin/azure-config?mode=add&poolName=New Azure Pool`,
                    "_blank"
                  );
                }}
                disabled={nodePools.some(
                  (pool: Pool) => pool.platform === "azure"
                )}
              >
                Azure{" "}
                {nodePools.some((pool: Pool) => pool.platform === "azure") &&
                  "(Already configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<CloudServiceIcon platform="runpod" />}
                onClick={() => {
                  setOpenAdd(false);
                  const baseUrl = window.location.origin;
                  window.open(
                    `${baseUrl}/dashboard/admin/runpod-config?mode=add&poolName=New RunPod Pool`,
                    "_blank"
                  );
                }}
                disabled={nodePools.some(
                  (pool: Pool) => pool.platform === "runpod"
                )}
              >
                RunPod{" "}
                {nodePools.some((pool: Pool) => pool.platform === "runpod") &&
                  "(Already configured)"}
              </Button>
              <Button
                variant="outlined"
                startDecorator={<Server size={16} />}
                onClick={() => {
                  setOpenAdd(false);
                  const baseUrl = window.location.origin;
                  window.open(
                    `${baseUrl}/dashboard/admin/ssh-config?mode=add&poolName=New Node Pool`,
                    "_blank"
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
