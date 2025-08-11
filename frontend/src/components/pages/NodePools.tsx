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

  // State for RunPod instance count and limits - using useSWR for auto-refresh
  const { data: runpodInstancesData } = useSWR(
    runpodConfig.is_configured
      ? buildApiUrl("skypilot/runpod/instances")
      : null,
    fetcher,
    {
      refreshInterval: 2000,
      fallbackData: {
        current_count: 0,
        max_instances: 0,
        can_launch: true,
      },
    }
  );

  // State for Azure instance count and limits - using useSWR for auto-refresh
  const { data: azureInstancesData } = useSWR(
    azureConfig.is_configured ? buildApiUrl("skypilot/azure/instances") : null,
    fetcher,
    {
      refreshInterval: 2000,
      fallbackData: {
        current_count: 0,
        max_instances: 0,
        can_launch: true,
      },
    }
  );

  // Derive the instances data from useSWR
  const runpodInstances = runpodInstancesData || {
    current_count: 0,
    max_instances: 0,
    can_launch: true,
  };

  const azureInstances = azureInstancesData || {
    current_count: 0,
    max_instances: 0,
    can_launch: true,
  };
  const { data, isLoading } = useSWR(buildApiUrl("clusters"), fetcher, {
    refreshInterval: 2000,
  });
  const clusterNames = data?.clusters || [];

  // Fetch SkyPilot cluster status to determine which clusters are running
  const { data: skyPilotStatus } = useSWR(
    buildApiUrl("skypilot/status"),
    (url: string) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 2000 }
  );

  // State for all cluster details
  const [clusterDetails, setClusterDetails] = useState<{
    [name: string]: Cluster | null;
  }>({});
  const [loadingClusters, setLoadingClusters] = useState(false);

  useEffect(() => {
    if (!Array.isArray(clusterNames) || clusterNames.length === 0) return;
    setLoadingClusters(true);
    Promise.all(
      clusterNames.map((name: string) =>
        apiFetch(buildApiUrl(`clusters/${name}`), { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => ({ name, data }))
          .catch(() => ({ name, data: null }))
      )
    ).then((results) => {
      const details: { [name: string]: Cluster | null } = {};
      results.forEach(({ name, data }) => {
        details[name] = data;
      });
      setClusterDetails(details);
      setLoadingClusters(false);
    });
  }, [JSON.stringify(clusterNames)]);

  const [nodeGpuInfo, setNodeGpuInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    // Fetch GPU info for all nodes
    apiFetch(buildApiUrl("skypilot/ssh-node-info"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setNodeGpuInfo(data))
      .catch(() => setNodeGpuInfo({}));

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
            // Check if there are any active RunPod clusters in SkyPilot status
            const activeRunpodClusters =
              skyPilotStatus?.clusters?.filter(
                (c: any) =>
                  c.status === "ClusterStatus.UP" ||
                  c.status === "ClusterStatus.INIT"
              ) || [];

            // Use actual cluster count from SkyPilot status, fallback to runpodInstances
            const actualActiveCount = activeRunpodClusters.length;

            return (
              <ClusterCard
                cluster={{
                  id: "runpod-cluster",
                  name: "RunPod Cluster",
                  nodes: generateDedicatedNodes(
                    runpodConfig.max_instances,
                    runpodInstances.current_count,
                    currentUserEmail
                  ),
                }}
                clusterType="regular"
                onLaunchCluster={() => {
                  if (runpodConfig.is_configured) {
                    setShowRunPodLauncher(true);
                  }
                }}
                launchDisabled={!runpodInstances.can_launch}
                launchButtonText="Request Instance"
                allowedGpuTypes={runpodConfig.allowed_gpu_types}
                currentUser={currentUserEmail}
              />
            );
          })()}

        {/* Azure Cluster */}
        {azureConfig.is_configured &&
          (() => {
            // Check if there are any active Azure clusters in SkyPilot status
            const activeAzureClusters =
              skyPilotStatus?.clusters?.filter(
                (c: any) =>
                  c.status === "ClusterStatus.UP" ||
                  c.status === "ClusterStatus.INIT"
              ) || [];

            // Use actual cluster count from SkyPilot status, fallback to azureInstances
            const actualActiveCount = activeAzureClusters.length;

            return (
              <ClusterCard
                cluster={{
                  id: "azure-cluster",
                  name: "Azure Cluster",
                  nodes: generateDedicatedNodes(
                    azureConfig.max_instances,
                    azureInstances.current_count,
                    currentUserEmail
                  ),
                }}
                clusterType="regular"
                onLaunchCluster={() => setShowAzureLauncher(true)}
                launchDisabled={!azureInstances.can_launch}
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
