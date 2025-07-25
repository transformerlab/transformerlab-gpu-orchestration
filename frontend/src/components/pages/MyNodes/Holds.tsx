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
} from "@mui/joy";
import {
  ChevronDownIcon,
  ComputerIcon,
  RotateCcwIcon,
  StopCircleIcon,
  TerminalIcon,
  TextIcon,
  Trash2Icon,
} from "lucide-react";

// Add a mock status generator for demonstration
const statuses = ["provisioning", "running", "deallocating", "held"];
function randomStatus(id: string) {
  // Simple deterministic hash based on id
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
}

interface HeldProps {
  groupedByExperiment: Record<string, any[]>;
  nodes: any[];
  skypilotLoading: boolean;
  myClusters: Cluster[];
}

const Jobs: React.FC<HeldProps> = ({
  groupedByExperiment,
  nodes,
  skypilotLoading,
  myClusters,
}) => {
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
                <th width="100px">&nbsp;</th>
                <th>Status</th>
                <th>Cluster</th>
                <th>Name/IP</th>
                <th>Running for</th>
                <th>Resources (GPU/CPU)</th>
                <th>Job/Experiment</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const statusValue = randomStatus(node.id);
                return (
                  <tr key={node.id}>
                    <td>
                      <ComputerIcon />
                      {(statusValue === "running" ||
                        statusValue === "provisioning") && (
                        <Dropdown>
                          <MenuButton variant="plain" size="sm">
                            <ChevronDownIcon />
                          </MenuButton>
                          <Menu size="sm" variant="soft">
                            <MenuItem>
                              <ListItemDecorator>
                                <StopCircleIcon />
                              </ListItemDecorator>
                              Stop
                            </MenuItem>
                            <MenuItem>
                              <ListItemDecorator>
                                <Trash2Icon />
                              </ListItemDecorator>
                              Deallocate
                            </MenuItem>
                            <MenuItem>
                              <ListItemDecorator>
                                <RotateCcwIcon />
                              </ListItemDecorator>
                              Restart
                            </MenuItem>
                            <MenuItem>
                              <ListItemDecorator>
                                <TextIcon />
                              </ListItemDecorator>
                              Logs
                            </MenuItem>
                            <MenuItem>Metrics</MenuItem>
                            <Divider />
                            <MenuItem>
                              <ListItemDecorator>
                                <TerminalIcon />
                              </ListItemDecorator>
                              SSH
                            </MenuItem>
                            <MenuItem>VSCode</MenuItem>
                          </Menu>
                        </Dropdown>
                      )}
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          statusValue === "running"
                            ? "success"
                            : statusValue === "provisioning"
                            ? "neutral"
                            : statusValue === "deallocating"
                            ? "warning"
                            : "success"
                        }
                        variant="soft"
                        startDecorator={
                          (statusValue == "running" ||
                            statusValue == "provisioning" ||
                            statusValue == "deallocating") && (
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
                        {statusValue}
                      </Chip>
                    </td>
                    <td>{node.clusterName}</td>
                    <td>
                      {node.id ?? "-"}
                      {node.ip ? `\n${node.ip}` : ""}
                    </td>
                    <td>
                      {(() => {
                        const held = node.heldTime ?? "-";
                        // If held is a number and > 12 hours, show in danger color
                        if (typeof held === "number" && held > 43200) {
                          return <Typography color="danger">{held}</Typography>;
                        }
                        return held;
                      })()}
                    </td>
                    <td>
                      GPU: {node.gpuType ?? "-"}
                      {node.vgpus ? `\n${node.vgpus}` : ""}
                      {"\n"}
                      CPU: {node.cpuType ?? "-"}
                      {node.vcpus ? `\n${node.vcpus}` : ""}
                    </td>
                    <td>
                      {(node.jobName ?? "-") +
                        "\n" +
                        (node.experimentName ?? "-")}
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
};

export default Jobs;
