import React from "react";
import { Typography, Box, Table, CircularProgress, Button } from "@mui/joy";
import {
  ChevronDownIcon,
  StopCircleIcon,
  TerminalIcon,
  TextIcon,
  Trash2Icon,
  RotateCcwIcon,
  BookOpenIcon,
  CodeIcon,
  Zap,
  Info,
  MoreHorizontal,
  Clock,
  SquareTerminalIcon,
} from "lucide-react";
import { buildApiUrl, apiFetch } from "../../../utils/api";
import InteractiveTaskModal from "../../modals/InteractiveTaskModal";
import SubmitJobModal from "../../modals/SubmitJobModal";
import SSHModal from "../../modals/SSHModal";
import { useNavigate } from "react-router-dom";
import NodeSquare from "../../widgets/NodeSquare";
import { useFakeData } from "../../../context/FakeDataContext";
import InstanceStatusChip from "../../widgets/InstanceStatusChip";
import ResourceDisplay from "../../widgets/ResourceDisplay";
import {
  Menu,
  MenuButton,
  MenuItem,
  Dropdown,
  Divider,
  ListItemDecorator,
} from "@mui/joy";

// Generate fake clusters for demonstration
const generateFakeClusters = () => {
  return [
    {
      cluster_name: "llm-train1",
      status: "up",
      resources_str: "2x(gpus=NVIDIA A100:1, cpus=32, mem=256, disk=512)",
      launched_at: Math.floor(Date.now() / 1000) - 7200,
      last_use: "1 hour ago",
      autostop: 60,
      to_down: false,
    },
    {
      cluster_name: "llm-train2",
      status: "init",
      resources_str: "4x(gpus=NVIDIA V100:1, cpus=64, mem=512, disk=1024)",
      launched_at: Math.floor(Date.now() / 1000) - 300,
      last_use: "5 minutes ago",
      autostop: 120,
      to_down: false,
    },
    {
      cluster_name: "research-cluster",
      status: "up",
      resources_str: "8x(gpus=NVIDIA T4:1, cpus=128, mem=1024, disk=2048)",
      launched_at: Math.floor(Date.now() / 1000) - 3600,
      last_use: "30 minutes ago",
      autostop: 180,
      to_down: false,
    },
  ];
};

// Simple deterministic status generator
const statuses: ("up" | "stopped" | "init")[] = ["up", "stopped", "init"];
function getRandomStatus(id: string): "up" | "stopped" | "init" {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % statuses.length;
  return statuses[idx];
}

interface Cluster {
  cluster_name: string;
  status: string;
  resources_str?: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
}

interface MyInstancesTableProps {
  skypilotLoading: boolean;
  myClusters: Cluster[];
  groupedByExperiment?: { [key: string]: any[] };
  onTabChange?: (tabIndex: number) => void;
}

const MyInstancesTable: React.FC<MyInstancesTableProps> = ({
  skypilotLoading,
  myClusters,
  groupedByExperiment = {},
  onTabChange,
}) => {
  const navigate = useNavigate();
  const { showFakeData } = useFakeData();
  const [operationLoading, setOperationLoading] = React.useState<{
    [key: string]: boolean;
  }>({});
  const [interactiveTaskModal, setInteractiveTaskModal] = React.useState<{
    open: boolean;
    clusterName: string;
    taskType: "vscode" | "jupyter";
  }>({
    open: false,
    clusterName: "",
    taskType: "vscode",
  });

  const [submitJobModal, setSubmitJobModal] = React.useState<{
    open: boolean;
    clusterName: string;
    clusterData?: Cluster;
  }>({
    open: false,
    clusterName: "",
  });

  const [sshClusterName, setSshClusterName] = React.useState<string | null>(
    null
  );

  // Combine real and fake data - only show fake data if no real data exists
  const allClusters = React.useMemo(() => {
    const realClusters = myClusters || [];
    const fakeClusters =
      showFakeData && realClusters.length === 0 ? generateFakeClusters() : [];
    return [...realClusters, ...fakeClusters];
  }, [myClusters, showFakeData]);

  const handleStopCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: true,
      }));
      const response = await apiFetch(buildApiUrl("instances/stop"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to stop cluster:", errorData.detail);
      }
    } catch (err) {
      console.error("Error stopping cluster:", err);
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: false,
      }));
    }
  };

  const handleDownCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: true,
      }));
      const response = await apiFetch(buildApiUrl("instances/down"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to terminate cluster:", errorData.detail);
      }
    } catch (err) {
      console.error("Error terminating cluster:", err);
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: false,
      }));
    }
  };

  const handleDownClusterWithConfirmation = (clusterName: string) => {
    const confirmed = confirm(
      `Are you sure you want to terminate the cluster "${clusterName}"? This action cannot be undone and will permanently delete all data on the cluster.`
    );
    if (confirmed) {
      handleDownCluster(clusterName);
    }
  };

  const openInteractiveTaskModal = (
    clusterName: string,
    taskType: "vscode" | "jupyter"
  ) => {
    setInteractiveTaskModal({
      open: true,
      clusterName,
      taskType,
    });
  };

  const closeInteractiveTaskModal = () => {
    setInteractiveTaskModal({
      open: false,
      clusterName: "",
      taskType: "vscode",
    });
  };

  const openSubmitJobModal = (clusterName: string) => {
    const clusterData = allClusters.find((c) => c.cluster_name === clusterName);
    setSubmitJobModal({
      open: true,
      clusterName,
      clusterData,
    });
  };

  const closeSubmitJobModal = () => {
    setSubmitJobModal({
      open: false,
      clusterName: "",
      clusterData: undefined,
    });
  };

  const handleRowClick = (node: any, event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('[role="button"]')) {
      return;
    }
    navigate(`/dashboard/nodes/node/${node.id}`);
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (skypilotLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // If we have real grouped experiments, show them (no fake data when real data exists)
  if (Object.keys(groupedByExperiment).length > 0) {
    return (
      <>
        {Object.entries(groupedByExperiment).map(([expName, nodes]) => (
          <Box key={expName} sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ mb: 1 }}>
              Experiment: {expName}
            </Typography>
            <Table>
              <thead>
                <tr>
                  <th style={{ width: "150px" }}>&nbsp;</th>
                  <th style={{ width: "120px" }}>Status</th>
                  <th>Cluster</th>
                  <th>Name/IP</th>
                  <th>Running for</th>
                  <th>Resources (GPU/CPU)</th>
                  <th>Job/Experiment</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => {
                  const statusValue = getRandomStatus(node.id);
                  return (
                    <tr
                      key={node.id}
                      onClick={(event) => handleRowClick(node, event)}
                      style={{
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "rgba(0, 0, 0, 0.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "";
                      }}
                    >
                      <td>
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <NodeSquare
                            node={{
                              id: node.id,
                              ip: node.ip || "unknown",
                              status:
                                statusValue === "up"
                                  ? "active"
                                  : statusValue === "stopped"
                                  ? "inactive"
                                  : "unhealthy",
                              type: "dedicated",
                              user: "ali",
                              gpuType: node.gpuType,
                            }}
                            variant="mock"
                          />
                          {node?.id}
                          {(statusValue === "up" || statusValue === "init") && (
                            <Dropdown>
                              <MenuButton
                                variant="plain"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ChevronDownIcon size="16px" />
                              </MenuButton>
                              <Menu size="sm" variant="soft">
                                <MenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/dashboard/node-pools/${
                                        node.cluster || "default"
                                      }`
                                    );
                                  }}
                                >
                                  <ListItemDecorator>
                                    <Info />
                                  </ListItemDecorator>
                                  Info
                                </MenuItem>
                                <Divider />
                                <MenuItem onClick={(e) => e.stopPropagation()}>
                                  <ListItemDecorator>
                                    <StopCircleIcon />
                                  </ListItemDecorator>
                                  Stop
                                </MenuItem>
                                <MenuItem onClick={(e) => e.stopPropagation()}>
                                  <ListItemDecorator>
                                    <Trash2Icon />
                                  </ListItemDecorator>
                                  Deallocate
                                </MenuItem>
                                <MenuItem onClick={(e) => e.stopPropagation()}>
                                  <ListItemDecorator>
                                    <RotateCcwIcon />
                                  </ListItemDecorator>
                                  Restart
                                </MenuItem>

                                <MenuItem onClick={(e) => e.stopPropagation()}>
                                  Metrics
                                </MenuItem>
                                <MenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSubmitJobModal(
                                      node.cluster || "default"
                                    );
                                  }}
                                >
                                  <ListItemDecorator>
                                    <Zap />
                                  </ListItemDecorator>
                                  Submit a Job
                                </MenuItem>
                                <Divider />
                                <MenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSshClusterName(node.cluster);
                                  }}
                                >
                                  <ListItemDecorator>
                                    <SquareTerminalIcon />
                                  </ListItemDecorator>
                                  Connect via SSH
                                </MenuItem>
                                <MenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openInteractiveTaskModal(
                                      node.cluster || "default",
                                      "vscode"
                                    );
                                  }}
                                >
                                  <ListItemDecorator>
                                    <CodeIcon />
                                  </ListItemDecorator>
                                  VSCode
                                </MenuItem>
                                <MenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openInteractiveTaskModal(
                                      node.cluster || "default",
                                      "jupyter"
                                    );
                                  }}
                                >
                                  <ListItemDecorator>
                                    <BookOpenIcon />
                                  </ListItemDecorator>
                                  Jupyter
                                </MenuItem>
                              </Menu>
                            </Dropdown>
                          )}
                        </Box>
                      </td>
                      <td>
                        <InstanceStatusChip status={statusValue} />
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {node.cluster || "-"}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {node.name || node.ip || "-"}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {node.runningFor || "-"}
                        </Typography>
                      </td>
                      <td>
                        <ResourceDisplay
                          resourcesStr={node.resources || ""}
                          variant="compact"
                          size="sm"
                        />
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {node.jobName || node.experimentName || "-"}
                        </Typography>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Box>
        ))}
      </>
    );
  }

  // If no real data but we have fake data enabled, show fake data in single table
  if (allClusters.length === 0) {
    if (showFakeData) {
      const fakeClusters = generateFakeClusters();
      return (
        <Box>
          <Typography level="h3" sx={{ mb: 3 }}>
            Dedicated Instances
          </Typography>

          <Table sx={{ minWidth: 650 }}>
            <thead>
              <tr>
                <th>Cluster Name</th>
                <th style={{ width: "120px" }}>Status</th>
                <th>Resources</th>
                <th>Launched At</th>
                <th style={{ width: "250px", minWidth: "250px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fakeClusters.map((cluster) => {
                return (
                  <tr
                    key={cluster.cluster_name}
                    style={{
                      transition: "background-color 0.2s ease",
                    }}
                  >
                    <td>
                      <Typography level="body-sm" fontWeight="bold">
                        <NodeSquare
                          currentUser="Ali"
                          node={{
                            id: cluster.cluster_name,
                            ip: "128.0.0.1",
                            status: "active",
                            type: "dedicated",
                            user: "Ali",
                            gpuType: "RTX3090",
                          }}
                          variant="mock"
                        />
                        &nbsp;
                        {cluster.cluster_name}
                      </Typography>
                    </td>
                    <td>
                      <InstanceStatusChip
                        status={
                          cluster.status as
                            | "up"
                            | "stopped"
                            | "init"
                            | "ClusterStatus.UP"
                            | "ClusterStatus.INIT"
                            | "ClusterStatus.STOPPED"
                        }
                      />
                    </td>
                    <td>
                      <ResourceDisplay
                        resourcesStr={cluster.resources_str || ""}
                        variant="detailed"
                        size="sm"
                      />
                    </td>
                    <td>
                      <Typography level="body-sm">
                        {formatTimestamp(cluster.launched_at)}
                      </Typography>
                    </td>
                    <td>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Button
                          size="sm"
                          variant="soft"
                          color="neutral"
                          startDecorator={<Info size="16px" />}
                          disabled
                        >
                          Info
                        </Button>
                        {cluster.status.toLowerCase().includes("up") && (
                          <Button
                            size="sm"
                            variant="soft"
                            color="danger"
                            startDecorator={<Trash2Icon size="16px" />}
                            disabled
                          >
                            Terminate
                          </Button>
                        )}
                        <Dropdown>
                          <MenuButton
                            variant="plain"
                            size="sm"
                            sx={{ minWidth: "auto" }}
                          >
                            <MoreHorizontal size="16px" />
                          </MenuButton>
                          <Menu
                            size="sm"
                            variant="soft"
                            placement="left-start"
                            sx={{
                              maxHeight: "300px",
                              overflow: "auto",
                              zIndex: 9999,
                            }}
                          >
                            {cluster.status.toLowerCase().includes("up") && (
                              <>
                                <MenuItem disabled>
                                  <ListItemDecorator>
                                    <StopCircleIcon />
                                  </ListItemDecorator>
                                  Stop
                                </MenuItem>
                                <MenuItem disabled>
                                  <ListItemDecorator>
                                    <Zap />
                                  </ListItemDecorator>
                                  Submit a Job
                                </MenuItem>
                              </>
                            )}
                            <Divider />
                            <MenuItem disabled>
                              <ListItemDecorator>
                                <SquareTerminalIcon />
                              </ListItemDecorator>
                              Connect via SSH
                            </MenuItem>
                            <MenuItem disabled>
                              <ListItemDecorator>
                                <CodeIcon />
                              </ListItemDecorator>
                              VSCode
                            </MenuItem>
                            <MenuItem disabled>
                              <ListItemDecorator>
                                <BookOpenIcon />
                              </ListItemDecorator>
                              Jupyter
                            </MenuItem>
                            <Divider />
                          </Menu>
                        </Dropdown>
                      </Box>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Box>
      );
    }

    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography level="h4" color="neutral">
          No active clusters found
        </Typography>
        <Typography level="body-md" color="neutral" sx={{ mt: 1 }}>
          Launch a cluster from the Interactive Development Environment to see
          it here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography level="h3" sx={{ mb: 3 }}>
        Dedicated Instances
      </Typography>

      <Table sx={{ minWidth: 650 }}>
        <thead>
          <tr>
            <th>Cluster Name</th>
            <th style={{ width: "120px" }}>Status</th>
            <th>Resources</th>
            <th>Launched At</th>
            <th style={{ width: "250px", minWidth: "250px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {allClusters.map((cluster) => {
            const isFakeData =
              showFakeData &&
              !myClusters.some((c) => c.cluster_name === cluster.cluster_name);

            return (
              <tr
                key={cluster.cluster_name}
                style={{
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isFakeData) {
                    e.currentTarget.style.backgroundColor =
                      "rgba(0, 0, 0, 0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFakeData) {
                    e.currentTarget.style.backgroundColor = "";
                  }
                }}
              >
                <td>
                  <Typography level="body-sm" fontWeight="bold">
                    <NodeSquare
                      currentUser="Ali"
                      node={{
                        id: cluster.cluster_name,
                        ip: "128.0.0.1",
                        status: "active",
                        type: "dedicated",
                        user: "Ali",
                        gpuType: "RTX3090",
                      }}
                      variant="mock"
                    />
                    &nbsp;
                    {cluster.cluster_name}
                  </Typography>
                </td>
                <td>
                  <InstanceStatusChip
                    status={
                      cluster.status as
                        | "up"
                        | "stopped"
                        | "init"
                        | "ClusterStatus.UP"
                        | "ClusterStatus.INIT"
                        | "ClusterStatus.STOPPED"
                    }
                  />
                </td>
                <td>
                  <ResourceDisplay
                    resourcesStr={cluster.resources_str || ""}
                    variant="detailed"
                    size="sm"
                  />
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatTimestamp(cluster.launched_at)}
                  </Typography>
                </td>
                <td>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button
                      size="sm"
                      variant="soft"
                      color="neutral"
                      onClick={() =>
                        navigate(
                          `/dashboard/my-instance-info/${cluster.cluster_name}`
                        )
                      }
                      startDecorator={<Info size="16px" />}
                      disabled={isFakeData}
                    >
                      Info
                    </Button>
                    {cluster.status.toLowerCase().includes("up") && (
                      <Button
                        size="sm"
                        variant="soft"
                        color="danger"
                        onClick={() =>
                          handleDownClusterWithConfirmation(
                            cluster.cluster_name
                          )
                        }
                        disabled={
                          operationLoading[`down_${cluster.cluster_name}`] ||
                          isFakeData
                        }
                        startDecorator={<Trash2Icon size="16px" />}
                      >
                        Terminate
                      </Button>
                    )}
                    <Dropdown>
                      <MenuButton
                        variant="plain"
                        size="sm"
                        sx={{ minWidth: "auto" }}
                      >
                        <MoreHorizontal size="16px" />
                      </MenuButton>
                      <Menu
                        size="sm"
                        variant="soft"
                        placement="left-start"
                        sx={{
                          maxHeight: "300px",
                          overflow: "auto",
                          zIndex: 9999,
                        }}
                      >
                        {cluster.status.toLowerCase().includes("up") ? (
                          <>
                            <MenuItem
                              onClick={() =>
                                handleStopCluster(cluster.cluster_name)
                              }
                              disabled={
                                operationLoading[
                                  `stop_${cluster.cluster_name}`
                                ] || isFakeData
                              }
                            >
                              <ListItemDecorator>
                                <StopCircleIcon />
                              </ListItemDecorator>
                              Stop
                            </MenuItem>
                            <MenuItem
                              onClick={() =>
                                openSubmitJobModal(cluster.cluster_name)
                              }
                              disabled={isFakeData}
                            >
                              <ListItemDecorator>
                                <Zap />
                              </ListItemDecorator>
                              Submit a Job
                            </MenuItem>
                            <Divider />
                            <MenuItem
                              onClick={() => {
                                setSshClusterName(cluster.cluster_name);
                              }}
                              disabled={isFakeData}
                            >
                              <ListItemDecorator>
                                <SquareTerminalIcon />
                              </ListItemDecorator>
                              Connect via SSH
                            </MenuItem>
                            <MenuItem
                              onClick={() =>
                                openInteractiveTaskModal(
                                  cluster.cluster_name,
                                  "vscode"
                                )
                              }
                              disabled={isFakeData}
                            >
                              <ListItemDecorator>
                                <CodeIcon />
                              </ListItemDecorator>
                              VSCode
                            </MenuItem>
                            <MenuItem
                              onClick={() =>
                                openInteractiveTaskModal(
                                  cluster.cluster_name,
                                  "jupyter"
                                )
                              }
                              disabled={isFakeData}
                            >
                              <ListItemDecorator>
                                <BookOpenIcon />
                              </ListItemDecorator>
                              Jupyter
                            </MenuItem>
                          </>
                        ) : (
                          <MenuItem disabled>
                            <ListItemDecorator>
                              <Clock />
                            </ListItemDecorator>
                            Waiting for the instance to be ready...
                          </MenuItem>
                        )}
                      </Menu>
                    </Dropdown>
                  </Box>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {/* Interactive Task Modal */}
      <InteractiveTaskModal
        open={interactiveTaskModal.open}
        onClose={closeInteractiveTaskModal}
        clusterName={interactiveTaskModal.clusterName}
        taskType={interactiveTaskModal.taskType}
        onTaskSubmitted={() => {
          console.log("Task submitted successfully");
        }}
        isClusterLaunching={false}
      />

      {/* Submit Job Modal */}
      <SubmitJobModal
        open={submitJobModal.open}
        onClose={closeSubmitJobModal}
        clusterName={submitJobModal.clusterName}
        onJobSubmitted={() => {
          console.log("Job submitted successfully");
        }}
        isClusterLaunching={false}
        isSshCluster={false}
        availableResources={submitJobModal.clusterData?.resources_str || ""}
      />

      {/* SSH Modal */}
      <SSHModal
        open={!!sshClusterName}
        onClose={() => setSshClusterName(null)}
        clusterName={sshClusterName}
      />
    </Box>
  );
};

export default MyInstancesTable;
