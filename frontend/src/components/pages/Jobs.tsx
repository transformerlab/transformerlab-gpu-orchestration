import React, { useState } from "react";
import { Box, Card, Typography, Stack, Chip, Button } from "@mui/joy";
import { Rocket } from "lucide-react";
import PageWithTitle from "./templates/PageWithTitle";
import { apiFetch, buildApiUrl } from "../../utils/api";
import useSWR from "swr";
import Jobs from "./MyNodes/Jobs";
import JobLauncher from "../modals/JobLauncher";

interface Node {
  id: string;
  status: "healthy" | "warning" | "error";
}

interface Cluster {
  id: string;
  name: string;
  nodes: Node[];
}

const generateRandomNodes = (count: number): Node[] => {
  const statuses: ("healthy" | "warning" | "error")[] = [
    "healthy",
    "warning",
    "error",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
  }));
};

const mockClusters: Cluster[] = [
  {
    id: "cluster-1",
    name: "Production Cluster",
    nodes: generateRandomNodes(165),
  },
  {
    id: "cluster-2",
    name: "Development Cluster",
    nodes: generateRandomNodes(48),
  },
  {
    id: "cluster-3",
    name: "Testing Cluster",
    nodes: generateRandomNodes(278),
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "healthy":
      return "#10b981"; // emerald-500
    case "warning":
      return "#f59e0b"; // amber-500
    case "error":
      return "#ef4444"; // red-500
    default:
      return "#6b7280"; // gray-500
  }
};

const NodeSquare: React.FC<{ node: Node }> = ({ node }) => (
  <Box
    sx={{
      width: 12,
      height: 12,
      backgroundColor: getStatusColor(node.status),
      borderRadius: "2px",
      margin: "1px",
      transition: "all 0.2s ease",
      cursor: "pointer",
      "&:hover": {
        transform: "scale(1.2)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      },
    }}
  />
);

const ClusterCard: React.FC<{ cluster: Cluster }> = ({ cluster }) => {
  const healthyCount = cluster.nodes.filter(
    (n) => n.status === "healthy",
  ).length;
  const warningCount = cluster.nodes.filter(
    (n) => n.status === "warning",
  ).length;
  const errorCount = cluster.nodes.filter((n) => n.status === "error").length;

  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        mb: 3,
        transition: "all 0.2s ease",
        "&:hover": {
          boxShadow: "md",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography level="h4" sx={{ mb: 1 }}>
          {cluster.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip size="sm" color="success" variant="soft">
            {healthyCount} Healthy
          </Chip>
          <Chip size="sm" color="warning" variant="soft">
            {warningCount} Warning
          </Chip>
          <Chip size="sm" color="danger" variant="soft">
            {errorCount} Error
          </Chip>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1px",
          p: 2,
          backgroundColor: "background.level1",
          borderRadius: "md",
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        {cluster.nodes.map((node) => (
          <NodeSquare key={node.id} node={node} />
        ))}
      </Box>
    </Card>
  );
};

const JobsPage: React.FC = () => {
  const [showJobLauncher, setShowJobLauncher] = useState(false);

  const skypilotFetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());
  const { data: skypilotData, isLoading: skypilotLoading } = useSWR(
    buildApiUrl("instances/status"),
    skypilotFetcher,
    { refreshInterval: 2000 },
  );
  const myClusters = (skypilotData?.clusters || []).filter(
    (c: Cluster) =>
      c.status &&
      (c.status.toLowerCase().includes("init") ||
        c.status.toLowerCase().includes("up")),
  );

  const handleJobLaunched = () => {
    console.log("Job launched - data will refresh automatically");
  };

  return (
    <PageWithTitle
      title="My Jobs"
      subtitle="A job is a workload that runs on a cluster, such as a training job."
      button={
        <Button
          onClick={() => setShowJobLauncher(true)}
          color="success"
          variant="solid"
          sx={{ minWidth: 180 }}
          size="lg"
        >
          Launch Job
        </Button>
      }
    >
      <Jobs skypilotLoading={skypilotLoading} myClusters={myClusters} />

      {/* Job Launcher Modal */}
      <JobLauncher
        open={showJobLauncher}
        onClose={() => setShowJobLauncher(false)}
        onJobLaunched={handleJobLaunched}
      />
    </PageWithTitle>
  );
};

export default JobsPage;
