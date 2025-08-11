import React, { useState, useEffect } from "react";
import { Box, Button, Typography } from "@mui/joy";
import { Rocket } from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";
import useSWR from "swr";
import RunPodClusterLauncher from "../RunPodClusterLauncher";
import AzureClusterLauncher from "../AzureClusterLauncher";
import InstanceLauncher from "../InstanceLauncher";
import PageWithTitle from "./templates/PageWithTitle";
import { useAuth } from "../../context/AuthContext";
import { useFakeData } from "../../context/FakeDataContext";
import ClusterCard, { Cluster, Node } from "../ClusterCard";
import { generateDedicatedNodes } from "../utils/clusterUtils";

import mockClusterData from "./mockData/mockClusters.json";

interface RunPodConfig {
  api_key: string;
  allowed_gpu_types: string[];
  is_configured: boolean;
  max_instances: number;
}

interface AzureConfig {
  subscription_id: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  allowed_instance_types: string[];
  allowed_regions: string[];
  is_configured: boolean;
  max_instances: number;
}

const Nodes: React.FC = () => {
  const [runpodConfig, setRunpodConfig] = useState<RunPodConfig>({
    api_key: "",
    allowed_gpu_types: [],
    is_configured: false,
    max_instances: 0,
  });

  // State for Azure configuration
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    subscription_id: "",
    tenant_id: "",
    client_id: "",
    client_secret: "",
    allowed_instance_types: [],
    allowed_regions: [],
    is_configured: false,
    max_instances: 0,
  });

  // --- Node Pools/Clouds Section ---
  const fetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());

  // Fetch comprehensive node pools data from the new endpoint
  const { data: nodePoolsData, isLoading } = useSWR(
    buildApiUrl("node-pools"),
    fetcher,
    {
      refreshInterval: 2000,
      fallbackData: {
        node_pools: [],
        instances: {
          current_count: 0,
          max_instances: 0,
          can_launch: true,
        },
        ssh_node_info: {},
        sky_pilot_status: [],
      },
    }
  );

  // Extract data from the comprehensive response
  const instances = nodePoolsData?.instances || {
    current_count: 0,
    max_instances: 0,
    can_launch: true,
  };
  const skyPilotStatus = nodePoolsData?.sky_pilot_status || [];
  const nodeGpuInfo = nodePoolsData?.ssh_node_info || {};
  const nodePools = nodePoolsData?.node_pools || [];

  // Extract cluster names from direct provider pools
  const clusterNames = nodePools
    .filter((pool: any) => pool.provider === "direct")
    .map((pool: any) => pool.name);

  // State for all cluster details
  const [clusterDetails, setClusterDetails] = useState<{
    [name: string]: Cluster | null;
  }>({});
  const [loadingClusters, setLoadingClusters] = useState(false);

  useEffect(() => {
    if (!Array.isArray(clusterNames) || clusterNames.length === 0) return;
    setLoadingClusters(true);

    // Extract cluster details from node_pools for direct providers
    const details: { [name: string]: Cluster | null } = {};
    nodePools
      .filter((pool: any) => pool.provider === "direct")
      .forEach((pool: any) => {
        const clusterName = pool.name;
        const config = pool.config;
        if (config && config.hosts) {
          // Convert the pool data to Cluster format
          details[clusterName] = {
            id: clusterName,
            name: clusterName,
            nodes: config.hosts.map((host: any) => ({
              id: host.ip || host.hostname || "unknown",
              ip: host.ip || host.hostname || "unknown",
              user: host.user || "unknown",
              status: "available",
              gpu_info: nodeGpuInfo[host.ip] || null,
            })),
          };
        } else {
          details[clusterName] = null;
        }
      });

    setClusterDetails(details);
    setLoadingClusters(false);
  }, [JSON.stringify(clusterNames), JSON.stringify(nodePools)]);

  // nodeGpuInfo is now fetched from the comprehensive node-pools endpoint

  useEffect(() => {
    // Fetch RunPod configuration
    apiFetch(buildApiUrl("skypilot/runpod/config"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          // Handle the new multi-config structure
          if (
            data.default_config &&
            data.configs &&
            data.configs[data.default_config]
          ) {
            const defaultConfig = data.configs[data.default_config];
            setRunpodConfig({
              api_key: defaultConfig.api_key || "",
              allowed_gpu_types: defaultConfig.allowed_gpu_types || [],
              is_configured: data.is_configured || false,
              max_instances: defaultConfig.max_instances || 0,
            });
          } else {
            // Fallback to legacy structure
            setRunpodConfig(data);
          }
        } else {
          setRunpodConfig({
            api_key: "",
            allowed_gpu_types: [],
            is_configured: false,
            max_instances: 0,
          });
        }
      })
      .catch(() =>
        setRunpodConfig({
          api_key: "",
          allowed_gpu_types: [],
          is_configured: false,
          max_instances: 0,
        })
      );

    // Fetch Azure configuration
    apiFetch(buildApiUrl("skypilot/azure/config"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          // Handle the new multi-config structure
          if (
            data.default_config &&
            data.configs &&
            data.configs[data.default_config]
          ) {
            const defaultConfig = data.configs[data.default_config];
            setAzureConfig({
              subscription_id: defaultConfig.subscription_id || "",
              tenant_id: defaultConfig.tenant_id || "",
              client_id: defaultConfig.client_id || "",
              client_secret: defaultConfig.client_secret || "",
              allowed_instance_types:
                defaultConfig.allowed_instance_types || [],
              allowed_regions: defaultConfig.allowed_regions || [],
              is_configured: data.is_configured || false,
              max_instances: defaultConfig.max_instances || 0,
            });
          } else {
            // Fallback to legacy structure
            setAzureConfig({
              subscription_id: data.subscription_id || "",
              tenant_id: data.tenant_id || "",
              client_id: data.client_id || "",
              client_secret: data.client_secret || "",
              allowed_instance_types: data.allowed_instance_types || [],
              allowed_regions: data.allowed_regions || [],
              is_configured: data.is_configured || false,
              max_instances: data.max_instances || 0,
            });
          }
        } else {
          setAzureConfig({
            subscription_id: "",
            tenant_id: "",
            client_id: "",
            client_secret: "",
            allowed_instance_types: [],
            allowed_regions: [],
            is_configured: false,
            max_instances: 0,
          });
        }
      })
      .catch(() =>
        setAzureConfig({
          subscription_id: "",
          tenant_id: "",
          client_id: "",
          client_secret: "",
          allowed_instance_types: [],
          allowed_regions: [],
          is_configured: false,
          max_instances: 0,
        })
      );
  }, []);
  const { user } = useAuth();
  const { showFakeData } = useFakeData();

  const handleClusterLaunched = () => {
    // useSWR will automatically refresh the data, no need to reload the page
    console.log("Cluster launched - data will refresh automatically");
  };

  const [showRunPodLauncher, setShowRunPodLauncher] = useState(false);
  const [showAzureLauncher, setShowAzureLauncher] = useState(false);
  const [showInstanceLauncher, setShowInstanceLauncher] = useState(false);

  const currentUserName =
    user?.first_name || user?.email?.split("@")[0] || "ali";
  const currentUserEmail = user?.email || "ali@example.com";

  // Generate mock clusters with current user
  // Memoize mockClustersWithCurrentUser so it only runs once per currentUserName
  const mockClustersWithCurrentUser: Cluster[] = mockClusterData as Cluster[];

  return (
    <PageWithTitle
      title={`${user?.organization_name}'s Node Pools`}
      subtitle="View all the nodes, across all clouds, available in your organization. From here you can see each node's status and what is available to you."
      button={
        <Button
          startDecorator={<Rocket size={16} />}
          onClick={() => setShowInstanceLauncher(true)}
          color="primary"
        >
          Request Instance
        </Button>
      }
    >
      {/* Existing Node Pools/Clusters UI */}
      {showFakeData ? (
        mockClustersWithCurrentUser.map((cluster) => (
          <div key={cluster.id}>
            <ClusterCard
              cluster={cluster}
              clusterType="fake"
              currentUser={currentUserEmail}
            />
          </div>
        ))
      ) : (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography level="body-md" sx={{ color: "text.secondary" }}>
            No fake data to display. Enable fake data in Settings to see sample
            clusters.
          </Typography>
        </Box>
      )}
      {/* --- Clouds Section --- */}
      <Box sx={{ mt: 6 }}>
        {isLoading || loadingClusters ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              Loading node pools...
            </Typography>
          </Box>
        ) : (
          Object.entries(clusterDetails).map(([name, cluster]) => {
            if (!cluster) return null;
            return (
              <ClusterCard
                key={name}
                cluster={cluster}
                clusterName={name}
                clusterType="cloud"
                nodeGpuInfo={nodeGpuInfo}
                currentUser={
                  user?.first_name || user?.email?.split("@")[0] || "ali"
                }
                onClusterLaunched={handleClusterLaunched}
              />
            );
          })
        )}

        {/* RunPod Cluster */}
        {runpodConfig.is_configured &&
          (() => {
            // Find RunPod pool from node pools
            const runpodPool = nodePools.find(
              (pool: any) => pool.provider === "runpod"
            );

            if (!runpodPool) return null;

            return (
              <ClusterCard
                cluster={{
                  id: "runpod-cluster",
                  name: "RunPod Cluster",
                  nodes: generateDedicatedNodes(
                    runpodPool.max_instances,
                    runpodPool.current_instances,
                    currentUserEmail
                  ),
                }}
                clusterType="regular"
                onLaunchCluster={() => {
                  if (runpodConfig.is_configured) {
                    setShowRunPodLauncher(true);
                  }
                }}
                launchDisabled={!runpodPool.can_launch}
                launchButtonText="Request Instance"
                allowedGpuTypes={runpodConfig.allowed_gpu_types}
                currentUser={currentUserEmail}
              />
            );
          })()}

        {/* Azure Cluster */}
        {azureConfig.is_configured &&
          (() => {
            // Find Azure pool from node pools
            const azurePool = nodePools.find(
              (pool: any) => pool.provider === "azure"
            );

            if (!azurePool) return null;

            return (
              <ClusterCard
                cluster={{
                  id: "azure-cluster",
                  name: "Azure Cluster",
                  nodes: generateDedicatedNodes(
                    azurePool.max_instances,
                    azurePool.current_instances,
                    currentUserEmail
                  ),
                }}
                clusterType="regular"
                onLaunchCluster={() => setShowAzureLauncher(true)}
                launchDisabled={!azurePool.can_launch}
                launchButtonText="Request Instance"
                allowedGpuTypes={azureConfig.allowed_instance_types}
                currentUser={currentUserEmail}
              />
            );
          })()}
      </Box>

      {/* RunPod Cluster Launcher Modal */}
      <RunPodClusterLauncher
        open={showRunPodLauncher}
        onClose={() => setShowRunPodLauncher(false)}
        onClusterLaunched={handleClusterLaunched}
        runpodConfig={runpodConfig}
      />

      {/* Azure Cluster Launcher Modal */}
      <AzureClusterLauncher
        open={showAzureLauncher}
        onClose={() => setShowAzureLauncher(false)}
        onClusterLaunched={handleClusterLaunched}
      />

      {/* Instance Launcher Modal */}
      <InstanceLauncher
        open={showInstanceLauncher}
        onClose={() => setShowInstanceLauncher(false)}
      />
    </PageWithTitle>
  );
};

export default Nodes;
