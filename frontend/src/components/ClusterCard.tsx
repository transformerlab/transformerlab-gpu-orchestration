import React, { useState } from "react";
import { Box, Button, Card, Typography, Stack, Chip } from "@mui/joy";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon, Cloud } from "lucide-react";
import { buildApiUrl, apiFetch } from "../utils/api";
import useSWR from "swr";
import NodeSquare from "./widgets/NodeSquare";
import { getStatusOrder } from "./utils/clusterUtils";
import ReserveNodeModal from "./modals/ReserveNodeModal";
import CloudServiceIcon from "./widgets/CloudServiceIcon";

export interface Node {
  id: string;
  type: "dedicated" | "on-demand";
  status: "active" | "inactive" | "unhealthy";
  user?: string;
  gpuType?: string;
  cpuType?: string;
  vcpus?: number;
  vgpus?: number;
  ip: string;
  jobName?: string;
  experimentName?: string;
  identity_file?: string;
  password?: string;
}

export interface Cluster {
  id: string;
  name: string;
  nodes: Node[];
  activeClusters?: Array<{
    cluster_name: string;
    status: string;
    user_info: any;
  }>;
  userInstances?: number;
}

export interface ClusterCardProps {
  cluster: Cluster;
  clusterName?: string; // For cloud clusters that might have different name
  clusterType?: "fake" | "cloud" | "regular";
  onLaunchCluster?: () => void;
  launchDisabled?: boolean;
  launchButtonText?: string;
  allowedGpuTypes?: string[];
  currentUser?: string;
  nodeGpuInfo?: Record<string, any>;
  onClusterLaunched?: (clusterName: string) => void;
  onJobSubmitted?: () => void;
  provider?: string;
}

const ClusterCard: React.FC<ClusterCardProps> = ({
  cluster,
  clusterName,
  clusterType = "regular",
  onLaunchCluster,
  launchDisabled = false,
  launchButtonText = "Request Instance",
  allowedGpuTypes,
  currentUser,
  nodeGpuInfo,
  onClusterLaunched,
  onJobSubmitted,
  provider = "direct",
}) => {
  const navigate = useNavigate();
  const [showReserveModal, setShowReserveModal] = useState(false);

  // Use clusterName if provided, otherwise use cluster.name
  const displayName = clusterName || cluster.name;
  const clusterId = cluster.id;

  // For cloud clusters, fetch SkyPilot status to determine if cluster is active
  const { data: skyPilotStatus } = useSWR(
    clusterType === "cloud" ? buildApiUrl("instances/status") : null,
    (url: string) =>
      apiFetch(url, { credentials: "include" }).then((res) => res.json()),
    { refreshInterval: 2000 }
  );

  // Process nodes based on cluster type
  let processedNodes = cluster.nodes;
  let activeCount = cluster.nodes.filter((n) => n.status === "active").length;
  let assignedToYouCount = cluster.nodes.filter(
    (n) => n.user === currentUser
  ).length;

  if (clusterType === "cloud") {
    // For SSH clusters, use the active cluster information from the cluster object
    if (provider === "direct") {
      const hasActiveCluster =
        cluster.activeClusters?.some(
          (ac: any) =>
            ac.status === "ClusterStatus.UP" ||
            ac.status === "ClusterStatus.INIT" ||
            ac.status === "UP" ||
            ac.status === "INIT"
        ) || false;

      // Update the node status based on active clusters
      processedNodes = cluster.nodes.map((node: any) => {
        if (hasActiveCluster && cluster.activeClusters) {
          // Find the first active cluster to get user info
          const activeCluster = cluster.activeClusters.find(
            (ac: any) =>
              ac.status === "ClusterStatus.UP" ||
              ac.status === "ClusterStatus.INIT" ||
              ac.status === "UP" ||
              ac.status === "INIT"
          );

          return {
            ...node,
            status: "active",
            user:
              activeCluster?.user_info?.email ||
              activeCluster?.user_info?.name ||
              node.user,
            jobName: activeCluster?.cluster_name || undefined,
          };
        }

        return {
          ...node,
          status: "inactive",
          user: undefined, // No user assigned when inactive
          jobName: undefined,
        };
      });

      activeCount = hasActiveCluster ? cluster.nodes.length : 0;
      assignedToYouCount = cluster.userInstances || 0;
    } else {
      // For other cloud providers (RunPod, Azure), use the old SkyPilot status matching
      const skyPilotClusters = skyPilotStatus?.clusters || [];
      const skyPilotCluster = skyPilotClusters.find(
        (c: any) => c.cluster_name === displayName
      );
      const isActiveCluster =
        skyPilotCluster?.status === "ClusterStatus.UP" ||
        skyPilotCluster?.status === "ClusterStatus.INIT";

      // Process nodes for cloud clusters
      processedNodes = cluster.nodes.map((node: any, idx: number) => ({
        id: `node-${idx}`,
        type: "dedicated" as const,
        status: isActiveCluster ? ("active" as const) : ("inactive" as const),
        user: undefined, // No user assignment - all nodes are available
        gpuType: node.gpuType || undefined,
        cpuType: node.cpuType || undefined,
        vcpus: node.vcpus || undefined,
        vgpus: node.vgpus || undefined,
        ip: node.ip || "",
        jobName: node.jobName || undefined,
        experimentName: node.experimentName || undefined,
        identity_file: node.identity_file || undefined,
        password: node.password || undefined,
      }));

      activeCount = processedNodes.filter(
        (n: Node) => n.status === "active"
      ).length;
      assignedToYouCount = 0; // All nodes are available, none assigned
    }
  }

  const sortedNodes = [...processedNodes].sort(
    (a, b) =>
      getStatusOrder(a.status, a.type, a.user, currentUser) -
      getStatusOrder(b.status, b.type, b.user, currentUser)
  );

  const handleReserveNode = () => {
    setShowReserveModal(true);
  };

  const handleClusterLaunched = () => {
    console.log("Cluster launched - data will refresh automatically");
    if (onClusterLaunched) onClusterLaunched(displayName);
  };

  // Determine which nodes to show based on cluster type
  const getNodesToShow = () => {
    if (clusterType === "fake") {
      // For fake data, show only dedicated nodes
      return sortedNodes.filter((node) => node.type === "dedicated");
    } else if (clusterType === "cloud") {
      // For cloud clusters, show all nodes
      return sortedNodes;
    } else {
      // For regular clusters, show all nodes
      return sortedNodes;
    }
  };

  const nodesToShow = getNodesToShow();

  // Handle empty cluster case
  if (!cluster || !Array.isArray(cluster.nodes) || cluster.nodes.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography level="h4" sx={{ mb: 1 }}>
          {displayName}
        </Typography>
        <Typography level="body-md" sx={{ color: "text.secondary" }}>
          No nodes in this cluster.
        </Typography>
      </Card>
    );
  }

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          p: 3,
          mb: 3,
          transition: "all 0.2s ease",
          "&:hover": {
            boxShadow: "md",
          },
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Button
            onClick={() => navigate(`/dashboard/node-pools/${clusterId}`)}
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 0,
              margin: 0,
              mb: 1,
              "&:hover": {
                backgroundColor: "unset",
              },
            }}
            variant="plain"
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <Typography level="h4" mb={0.5}>
                <CloudServiceIcon platform={provider} /> {displayName}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 0 }}>
                <Chip size="sm" color="primary" variant="soft">
                  {assignedToYouCount} Nodes Assigned To You
                </Chip>
                <Chip size="sm" color="success" variant="soft">
                  {Math.round((activeCount / processedNodes.length) * 100)}%
                  Total Capacity In Use
                </Chip>
              </Stack>
            </Box>
            <div>
              <ChevronRightIcon />
            </div>
          </Button>
        </Box>

        {/* Show nodes */}
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: "flex",
              gap: 3,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            {clusterType === "fake" ? (
              // For fake data, show in single column
              <Box
                sx={{
                  flex: "1 1 0",
                  minWidth: 0,
                  maxWidth: "100%",
                  mb: 3,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1px",
                    p: 2,
                    backgroundColor: "background.level1",
                    borderRadius: "md",
                    maxHeight: 1000,
                    overflow: "auto",
                  }}
                >
                  {nodesToShow.map((node) => (
                    <NodeSquare
                      key={node.id}
                      node={node}
                      variant="mock"
                      clusterName={clusterId}
                      currentUser={currentUser}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              // For cloud and regular clusters, show in two columns
              ["dedicated", "on-demand"].map((nodeType) => {
                const nodesOfType = nodesToShow.filter(
                  (node) => node.type === nodeType
                );
                if (nodesOfType.length === 0) return null;

                return (
                  <Box
                    key={nodeType}
                    sx={{
                      flex: "1 1 0",
                      minWidth: 0,
                      mb: 3,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "1px",
                        p: 2,
                        backgroundColor: "background.level1",
                        borderRadius: "md",
                        maxHeight: 1000,
                        overflow: "auto",
                      }}
                    >
                      {nodesOfType.map((node) => (
                        <NodeSquare
                          key={node.id}
                          node={node}
                          variant="mock"
                          clusterName={clusterId}
                          currentUser={currentUser}
                        />
                      ))}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={
              clusterType === "cloud" ? handleReserveNode : onLaunchCluster
            }
            disabled={launchDisabled}
          >
            {launchButtonText}
          </Button>
        </Stack>
      </Card>

      {/* Reserve Node Modal for cloud clusters */}
      {clusterType === "cloud" && (
        <ReserveNodeModal
          open={showReserveModal}
          onClose={() => setShowReserveModal(false)}
          clusterName={displayName}
          cluster={cluster}
          onClusterLaunched={handleClusterLaunched}
        />
      )}
    </>
  );
};

export default ClusterCard;
