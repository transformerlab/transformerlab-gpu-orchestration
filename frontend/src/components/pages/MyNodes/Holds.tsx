import React from "react";
import {
  Typography,
  Box,
  Table,
  CircularProgress,
  Chip,
  Menu,
  MenuButton,
  MenuItem,
  Dropdown,
  Divider,
  ListItemDecorator,
  Button,
} from "@mui/joy";
import {
  ChevronDownIcon,
  ComputerIcon,
  RotateCcwIcon,
  StopCircleIcon,
  TerminalIcon,
  TextIcon,
  Trash2Icon,
  PlayIcon,
  BookOpenIcon,
  CodeIcon,
} from "lucide-react";
import { buildApiUrl } from "../../../utils/api";
import InteractiveTaskModal from "../../InteractiveTaskModal";

interface Cluster {
  cluster_name: string;
  status: string;
  resources_str?: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
}

interface HeldProps {
  skypilotLoading: boolean;
  myClusters: Cluster[];
}

const Held: React.FC<HeldProps> = ({ skypilotLoading, myClusters }) => {
  const [operationLoading, setOperationLoading] = React.useState<{
    [key: string]: boolean;
  }>({});
  const [interactiveTaskModal, setInteractiveTaskModal] = React.useState<{
    open: boolean;
    clusterName: string;
    taskType: "vscode";
  }>({
    open: false,
    clusterName: "",
    taskType: "vscode",
  });

  const handleStopCluster = async (clusterName: string) => {
    try {
      setOperationLoading((prev) => ({
        ...prev,
        [`stop_${clusterName}`]: true,
      }));
      const response = await fetch(buildApiUrl("skypilot/stop"), {
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
      const response = await fetch(buildApiUrl("skypilot/down"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ cluster_name: clusterName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to down cluster:", errorData.detail);
      }
    } catch (err) {
      console.error("Error downing cluster:", err);
    } finally {
      setOperationLoading((prev) => ({
        ...prev,
        [`down_${clusterName}`]: false,
      }));
    }
  };

  const openInteractiveTaskModal = (
    clusterName: string,
    taskType: "vscode"
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

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("up") || statusLower.includes("running")) {
      return "success";
    } else if (
      statusLower.includes("init") ||
      statusLower.includes("starting")
    ) {
      return "primary";
    } else if (
      statusLower.includes("down") ||
      statusLower.includes("stopped")
    ) {
      return "neutral";
    } else {
      return "warning";
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAutostop = (autostop?: number, toDown?: boolean) => {
    if (!autostop) return "-";
    const action = toDown ? "down" : "stop";
    return `${autostop}min (${action})`;
  };

  if (skypilotLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (myClusters.length === 0) {
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
        Cloud Node Pools
      </Typography>

      <Table variant="outlined" sx={{ minWidth: 650 }}>
        <thead>
          <tr>
            <th style={{ width: "100px" }}>&nbsp;</th>
            <th>Status</th>
            <th>Cluster Name</th>
            <th>Resources</th>
            <th>Launched At</th>
            <th>Last Use</th>
            <th>Auto-stop</th>
          </tr>
        </thead>
        <tbody>
          {myClusters.map((cluster) => (
            <tr key={cluster.cluster_name}>
              <td>
                <ComputerIcon />
                <Dropdown>
                  <MenuButton variant="plain" size="sm">
                    <ChevronDownIcon />
                  </MenuButton>
                  <Menu size="sm" variant="soft">
                    <MenuItem>
                      <ListItemDecorator>
                        <PlayIcon />
                      </ListItemDecorator>
                      Start
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleStopCluster(cluster.cluster_name)}
                      disabled={
                        operationLoading[`stop_${cluster.cluster_name}`]
                      }
                    >
                      <ListItemDecorator>
                        <StopCircleIcon />
                      </ListItemDecorator>
                      Stop
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleDownCluster(cluster.cluster_name)}
                      disabled={
                        operationLoading[`down_${cluster.cluster_name}`]
                      }
                    >
                      <ListItemDecorator>
                        <Trash2Icon />
                      </ListItemDecorator>
                      Down
                    </MenuItem>
                    <Divider />
                    <MenuItem
                      onClick={() =>
                        openInteractiveTaskModal(cluster.cluster_name, "vscode")
                      }
                    >
                      <ListItemDecorator>
                        <CodeIcon />
                      </ListItemDecorator>
                      VSCode
                    </MenuItem>
                    <Divider />
                    <MenuItem>
                      <ListItemDecorator>
                        <TextIcon />
                      </ListItemDecorator>
                      Logs
                    </MenuItem>
                  </Menu>
                </Dropdown>
              </td>
              <td>
                <Chip
                  size="sm"
                  color={getStatusColor(cluster.status)}
                  variant="soft"
                  startDecorator={
                    (cluster.status.toLowerCase().includes("init") ||
                      cluster.status.toLowerCase().includes("starting")) && (
                      <CircularProgress
                        size="sm"
                        sx={{
                          "--CircularProgress-size": "10px",
                          "--CircularProgress-trackThickness": "2px",
                          "--CircularProgress-progressThickness": "2px",
                        }}
                      />
                    )
                  }
                >
                  {cluster.status}
                </Chip>
              </td>
              <td>
                <Typography level="body-sm" fontWeight="bold">
                  {cluster.cluster_name}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm">
                  {cluster.resources_str || "-"}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm">
                  {formatTimestamp(cluster.launched_at)}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm">
                  {cluster.last_use || "-"}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm">
                  {formatAutostop(cluster.autostop, cluster.to_down)}
                </Typography>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Interactive Task Modal */}
      <InteractiveTaskModal
        open={interactiveTaskModal.open}
        onClose={closeInteractiveTaskModal}
        clusterName={interactiveTaskModal.clusterName}
        taskType={interactiveTaskModal.taskType}
        onTaskSubmitted={() => {
          // Optionally refresh the page or update the UI
          console.log("Task submitted successfully");
        }}
        isClusterLaunching={false}
      />
    </Box>
  );
};

export default Held;
