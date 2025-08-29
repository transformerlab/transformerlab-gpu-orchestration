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

interface GcpConfig {
  project_id: string;
  service_account_key: string;
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

  // State for GCP configuration
  const [gcpConfig, setGcpConfig] = useState<GcpConfig>({
    project_id: "",
    service_account_key: "",
    allowed_instance_types: [],
    allowed_regions: [],
    is_configured: false,
    max_instances: 0,
  });

  // --- Node Pools/Clouds Section ---
  const fetcher = async (url: string) => {
    try {
      const res = await apiFetch(url, { credentials: "include" });
      const text = await res.text();
      try {
        const json = text ? JSON.parse(text) : null;
        return json;
      } catch (e) {
        throw e;
      }
    } catch (e) {
      console.error("[NodePools] fetch error:", e);
      throw e;
    }
  };

  // Fetch comprehensive node pools data from the new endpoint
  const {
    data: nodePoolsData,
    isLoading,
    error: nodePoolsError,
  } = useSWR(buildApiUrl("node-pools/"), fetcher, {
    refreshInterval: 2000,
    fallbackData: {
      node_pools: [],
      instances: {
        current_count: 0,
        max_instances: 0,
        can_launch: true,
      },
      sky_pilot_status: [],
    },
  });

  // Extract data from the comprehensive response
  const instances = nodePoolsData?.instances || {
    current_count: 0,
    max_instances: 0,
    can_launch: true,
  };
  const skyPilotStatus = nodePoolsData?.sky_pilot_status || [];
  const nodePools = nodePoolsData?.node_pools || [];

  // Build per-node GPU info map from node_pools (since ssh_node_info was removed)
  const nodeGpuInfo = React.useMemo(() => {
    const ipToGpuInfo: Record<string, any> = {};
    try {
      (nodePools || [])
        .filter((pool: any) => pool.provider === "direct")
        .forEach((pool: any) => {
          const hosts = pool?.config?.hosts || [];
          const gpuResources = pool?.gpu_resources || {};
          const nodeGpus = gpuResources?.node_gpus || [];

          // Create a map of node IPs to their GPU resources
          const nodeGpuMap: Record<string, any[]> = {};
          nodeGpus.forEach((nodeGpu: any) => {
            const nodeIp = nodeGpu.node;
            if (nodeIp) {
              if (!nodeGpuMap[nodeIp]) {
                nodeGpuMap[nodeIp] = [];
              }
              nodeGpuMap[nodeIp].push({
                gpu: nodeGpu.gpu,
                utilization: nodeGpu.utilization,
                free: nodeGpu.free,
                total: nodeGpu.total,
                requestable_qty_per_node: nodeGpu.requestable_qty_per_node,
              });
            }
          });

          hosts.forEach((host: any) => {
            const ip = host.ip || host.hostname;
            if (!ip) return;

            // Only assign GPU resources if this node actually has GPUs
            const nodeGpus = nodeGpuMap[ip] || [];
            if (nodeGpus.length > 0) {
              ipToGpuInfo[ip] = { gpu_resources: { gpus: nodeGpus } };
            } else {
              // Node has no GPUs, so don't assign any GPU resources
              ipToGpuInfo[ip] = { gpu_resources: { gpus: [] } };
            }
          });
        });
    } catch (e) {
      // noop — default empty map
    }
    return ipToGpuInfo;
  }, [nodePools]);

  // Extract configurations from node_pools response
  useEffect(() => {
    // Extract RunPod configuration from node_pools
    const runpodPool = nodePools.find(
      (pool: any) => pool.provider === "runpod"
    );
    if (runpodPool && runpodPool.config) {
      setRunpodConfig({
        api_key: "", // Not exposed in node_pools for security
        allowed_gpu_types: runpodPool.config.allowed_gpu_types || [],
        is_configured: runpodPool.config.is_configured || false,
        max_instances: runpodPool.max_instances || 0,
      });
    } else {
      setRunpodConfig({
        api_key: "",
        allowed_gpu_types: [],
        is_configured: false,
        max_instances: 0,
      });
    }

    // Extract Azure configuration from node_pools
    const azurePool = nodePools.find((pool: any) => pool.provider === "azure");
    if (azurePool && azurePool.config) {
      setAzureConfig({
        subscription_id: "", // Not exposed in node_pools for security
        tenant_id: "",
        client_id: "",
        client_secret: "",
        allowed_instance_types: azurePool.config.allowed_instance_types || [],
        allowed_regions: azurePool.config.allowed_regions || [],
        is_configured: azurePool.config.is_configured || false,
        max_instances: azurePool.max_instances || 0,
      });
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

    // Extract GCP configuration from node_pools
    const gcpPool = nodePools.find((pool: any) => pool.provider === "gcp");
    if (gcpPool && gcpPool.config) {
      setGcpConfig({
        project_id: "", // Not exposed in node_pools for security
        service_account_key: "",
        allowed_instance_types: gcpPool.config.allowed_instance_types || [],
        allowed_regions: gcpPool.config.allowed_regions || [],
        is_configured: gcpPool.config.is_configured || false,
        max_instances: gcpPool.max_instances || 0,
      });
    } else {
      setGcpConfig({
        project_id: "",
        service_account_key: "",
        allowed_instance_types: [],
        allowed_regions: [],
        is_configured: false,
        max_instances: 0,
      });
    }
  }, [nodePools]);

  // Extract cluster details from node_pools for direct providers
  const clusterDetails: { [name: string]: Cluster | null } = {};
  nodePools
    .filter((pool: any) => pool.provider === "direct")
    .forEach((pool: any) => {
      const clusterName = pool.name;
      const config = pool.config;
      if (config && config.hosts) {
        // Check if there are any active clusters for this node pool
        const activeClusters = pool.active_clusters || [];
        const hasActiveCluster = activeClusters.some(
          (cluster: any) =>
            cluster.status === "ClusterStatus.UP" ||
            cluster.status === "ClusterStatus.INIT"
        );

        // Convert the pool data to Cluster format
        clusterDetails[clusterName] = {
          id: clusterName,
          name: clusterName,
          nodes: config.hosts.map((host: any, index: number) => ({
            id: host.ip || host.hostname || `node-${index}`,
            type: "dedicated" as const,
            ip: host.ip || host.hostname || "unknown",
            user: host.user || "unknown",
            // Mark nodes as active if there are active clusters using this node pool
            status: hasActiveCluster ? "active" : "inactive",
            gpu_info: nodeGpuInfo[host.ip] || null,
            // Preserve the resources information for ReserveNodeModal
            resources: host.resources || {},
            // Add other fields that might be needed
            identity_file: host.identity_file,
            password: host.password,
          })),
          // Pass active cluster information to the ClusterCard
          activeClusters: activeClusters,
          userInstances: pool.user_instances || 0,
        };
      } else {
        clusterDetails[clusterName] = null;
      }
    });

  const loadingClusters = false; // No longer needed since we're using node_pools directly
  const { user } = useAuth();
  const { showFakeData } = useFakeData();

  const handleClusterLaunched = () => {
    // useSWR will automatically refresh the data, no need to reload the page
    console.log("Cluster launched - data will refresh automatically");
  };

  const [showRunPodLauncher, setShowRunPodLauncher] = useState(false);
  const [showAzureLauncher, setShowAzureLauncher] = useState(false);
  const [showGcpLauncher, setShowGcpLauncher] = useState(false);
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
          onClick={() => setShowInstanceLauncher(true)}
          color="success"
          variant="solid"
          sx={{ minWidth: 180 }}
          size="lg"
        >
          Request Instance
        </Button>
      }
    >
      {/* Existing Node Pools/Clusters UI */}
      {showFakeData ? (
        <>
          {mockClustersWithCurrentUser.map((cluster) => (
            <div key={cluster.id}>
              <ClusterCard
                cluster={cluster}
                clusterType={cluster.clusterType || "fake"}
                provider={cluster.provider}
                currentUser={currentUserEmail}
                onLaunchCluster={
                  cluster.provider === "gcp"
                    ? () => setShowGcpLauncher(true)
                    : undefined
                }
                launchButtonText={cluster.launchButtonText}
                allowedGpuTypes={cluster.allowedGpuTypes}
              />
            </div>
          ))}
        </>
      ) : (
        <></>
      )}
      {/* --- Clouds Section --- */}
      <Box>
        {isLoading ? (
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
                provider="direct"
                nodeGpuInfo={nodeGpuInfo}
                currentUser={currentUserEmail}
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
                  name: runpodPool?.name || "RunPod Node Pool",
                  nodes: generateDedicatedNodes(
                    runpodPool.max_instances,
                    runpodPool.current_instances,
                    currentUserEmail
                  ),
                }}
                provider={runpodPool?.provider}
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
                  name: azurePool?.name || "Azure Node Pool",
                  nodes: generateDedicatedNodes(
                    azurePool.max_instances,
                    azurePool.current_instances,
                    currentUserEmail
                  ),
                }}
                provider={azurePool?.provider}
                clusterType="regular"
                onLaunchCluster={() => setShowAzureLauncher(true)}
                launchDisabled={!azurePool.can_launch}
                launchButtonText="Request Instance"
                allowedGpuTypes={azureConfig.allowed_instance_types}
                currentUser={currentUserEmail}
              />
            );
          })()}

        {/* GCP Cluster */}
        {gcpConfig.is_configured &&
          (() => {
            // Find GCP pool from node pools
            const gcpPool = nodePools.find(
              (pool: any) => pool.provider === "gcp"
            );

            if (!gcpPool) return null;

            return (
              <ClusterCard
                cluster={{
                  id: "gcp-cluster",
                  name: gcpPool?.name || "GCP Node Pool",
                  nodes: generateDedicatedNodes(
                    gcpPool.max_instances,
                    gcpPool.current_instances,
                    currentUserEmail
                  ),
                }}
                provider={gcpPool?.provider}
                clusterType="regular"
                onLaunchCluster={() => setShowGcpLauncher(true)}
                launchDisabled={!gcpPool.can_launch}
                launchButtonText="Request Instance"
                allowedGpuTypes={gcpConfig.allowed_instance_types}
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

      {/* GCP Cluster Launcher Modal */}
      <AzureClusterLauncher
        open={showGcpLauncher}
        onClose={() => setShowGcpLauncher(false)}
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
