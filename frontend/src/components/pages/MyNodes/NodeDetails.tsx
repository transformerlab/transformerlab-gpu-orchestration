import React from "react";
import {
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Tabs,
  Tab,
  TabList,
  TabPanel,
} from "@mui/joy";
import {
  ArrowLeftIcon,
  ClipboardCopyIcon,
  ClipboardIcon,
  ComputerIcon,
  StopCircleIcon,
  Trash2Icon,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";

const NodeDetails: React.FC = () => {
  const { nodeId } = useParams<{ nodeId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  // For now, create a mock node based on nodeId
  // In a real app, you'd fetch this data from an API
  const node = {
    id: nodeId,
    ip: "192.168.1.100",
    clusterName: "production-cluster",
    gpuType: "NVIDIA A100",
    vgpus: "8",
    cpuType: "Intel Xeon Gold 6248",
    vcpus: "32",
    jobName: "ImageNet Training",
    experimentName: "Computer Vision Research",
    heldTime: "24 hours",
  };
  return (
    <Box sx={{ p: 3 }}>
      {/* Header with back button */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Button
          variant="soft"
          color="neutral"
          startDecorator={<ArrowLeftIcon size={16} />}
          onClick={handleBack}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <ComputerIcon size={24} />
        <Typography level="h2" sx={{ ml: 1 }}>
          Node Details: {node.id}
        </Typography>
        <Chip size="sm" color="success" variant="soft" sx={{ ml: 2 }}>
          Running
        </Chip>
      </Box>
      <Box
        sx={{
          display: "flex",
          gap: 3,
          mb: 1,
          flexDirection: "row",
          alignContent: "center",
          alignItems: "center",
        }}
      >
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Created: 3 days ago
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Machine ID: 123e4567-e89b-12d3-a456-426614174000
          </Typography>
          <Button
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() =>
              navigator.clipboard.writeText(
                "123e4567-e89b-12d3-a456-426614174000"
              )
            }
          >
            <ClipboardCopyIcon size={16} />
          </Button>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            IP Address: {node.ip}
          </Typography>
          <Button
            size="sm"
            variant="plain"
            color="neutral"
            onClick={() => navigator.clipboard.writeText(node.ip)}
          >
            <ClipboardCopyIcon size={16} />
          </Button>
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          color="warning"
          startDecorator={<StopCircleIcon size={16} />}
        >
          Stop Node
        </Button>
        <Button
          variant="soft"
          color="danger"
          startDecorator={<Trash2Icon size={16} />}
        >
          Delete Node
        </Button>
      </Box>

      <Tabs aria-label="Basic tabs" defaultValue={0}>
        <TabList>
          <Tab>Basic Info</Tab>
          <Tab>Metrics</Tab>
          <Tab>Third tab</Tab>
        </TabList>
        <TabPanel value={0}>
          <b>First</b> tab panel
        </TabPanel>
        <TabPanel value={1}>
          <b>Second</b> tab panel
        </TabPanel>
        <TabPanel value={2}>
          <b>Third</b> tab panel
        </TabPanel>
      </Tabs>

      {/* Node information cards */}
      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                Basic Information
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    Node ID:
                  </Typography>
                  <Typography level="body-sm">{node.id || "-"}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    IP Address:
                  </Typography>
                  <Typography level="body-sm">{node.ip || "-"}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    Cluster:
                  </Typography>
                  <Typography level="body-sm">
                    {node.clusterName || "-"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    Status:
                  </Typography>
                  <Chip size="sm" color="success" variant="soft">
                    Running
                  </Chip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                Resources
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    GPU Type:
                  </Typography>
                  <Typography level="body-sm">{node.gpuType || "-"}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    vGPUs:
                  </Typography>
                  <Typography level="body-sm">{node.vgpus || "-"}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    CPU Type:
                  </Typography>
                  <Typography level="body-sm">{node.cpuType || "-"}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    vCPUs:
                  </Typography>
                  <Typography level="body-sm">{node.vcpus || "-"}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                Job Information
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    Job Name:
                  </Typography>
                  <Typography level="body-sm">{node.jobName || "-"}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    Experiment:
                  </Typography>
                  <Typography level="body-sm">
                    {node.experimentName || "-"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
                    Running Time:
                  </Typography>
                  <Typography level="body-sm">
                    {node.heldTime || "-"}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                Actions
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Button variant="outlined" color="primary" fullWidth>
                  SSH to Node
                </Button>
                <Button variant="outlined" color="neutral" fullWidth>
                  View Logs
                </Button>
                <Button variant="outlined" color="neutral" fullWidth>
                  View Metrics
                </Button>
                <Divider sx={{ my: 1 }} />
                <Button variant="outlined" color="warning" fullWidth>
                  Restart Node
                </Button>
                <Button variant="outlined" color="danger" fullWidth>
                  Stop Node
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Placeholder sections for additional information */}
      <Box sx={{ mt: 4 }}>
        <Typography level="h3" sx={{ mb: 2 }}>
          Performance Metrics
        </Typography>
        <Card>
          <CardContent>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Performance metrics and monitoring data will be displayed here.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography level="h3" sx={{ mb: 2 }}>
          Recent Logs
        </Typography>
        <Card>
          <CardContent>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Recent log entries and system messages will be displayed here.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default NodeDetails;
