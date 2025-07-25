import React from "react";
import {
  Box,
  Typography,
  Table,
  Chip,
  CircularProgress,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  tabClasses,
} from "@mui/joy";
import useSWR from "swr";
import { buildApiUrl } from "../../utils/api";
import Held from "./MyNodes/Jobs";
import Jobs from "./MyNodes/Holds";

// Add a mock "held time" generator for demonstration
function randomHeldTime() {
  const hours = Math.floor(Math.random() * 72) + 1;
  return `${hours} hours`;
}

function randomIp() {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256
  )}.${Math.floor(Math.random() * 256)}`;
}

const gpuTypes = [
  "NVIDIA A100",
  "NVIDIA V100",
  "NVIDIA T4",
  "NVIDIA RTX 3090",
  "NVIDIA H100",
];
const cpuTypes = [
  "Intel Xeon Gold 6248",
  "AMD EPYC 7742",
  "Intel Core i9-12900K",
  "AMD Ryzen 9 5950X",
];
const jobNames = [
  "ImageNet Training",
  "Text Generation",
  "GAN Experiment",
  "RL Agent",
  "Protein Folding",
];
const experimentNames = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

// Define a custom interface for mock nodes to avoid DOM Node conflict
interface MyNode {
  id: string;
  status: "reserved" | "requestable" | "active" | "unhealthy";
  user?: "ali" | "bob" | "catherine";
  gpuType?: string;
  cpuType?: string;
  vcpus?: number;
  vgpus?: number;
  ip: string;
  jobName?: string;
  experimentName?: string;
}

const generateRandomNodes = (count: number): MyNode[] => {
  const users = ["ali", "bob", "catherine"];
  return Array.from({ length: count }, (_, i) => {
    const rand = Math.random();
    let status: "reserved" | "requestable" | "active" | "unhealthy";
    let user: "ali" | "bob" | "catherine" | undefined;
    let jobName: string | undefined;
    let experimentName: string | undefined;
    if (rand < 0.5) {
      status = "reserved";
    } else if (rand < 0.75) {
      status = "requestable";
    } else if (rand < 0.95) {
      status = "active";
      user = users[Math.floor(Math.random() * users.length)];
      jobName = jobNames[Math.floor(Math.random() * jobNames.length)];
      experimentName =
        experimentNames[Math.floor(Math.random() * experimentNames.length)];
    } else {
      status = "unhealthy";
    }
    const gpuType = gpuTypes[Math.floor(Math.random() * gpuTypes.length)];
    const cpuType = cpuTypes[Math.floor(Math.random() * cpuTypes.length)];
    const vcpus = [4, 8, 16, 32, 64][Math.floor(Math.random() * 5)];
    const vgpus = [1, 2, 4, 8][Math.floor(Math.random() * 4)];
    const ip = randomIp();
    return {
      id: `node-${i}`,
      status,
      ...(user ? { user } : {}),
      ...(jobName ? { jobName } : {}),
      ...(experimentName ? { experimentName } : {}),
      gpuType,
      cpuType,
      vcpus,
      vgpus,
      ip,
    };
  });
};

interface Cluster {
  id: string;
  name: string;
  nodes: MyNode[];
}

const mockClusters: Cluster[] = [
  {
    id: "cluster-1",
    name: "Azure ML Cluster",
    nodes: generateRandomNodes(165),
  },
  {
    id: "cluster-2",
    name: "RunPod Cluster",
    nodes: generateRandomNodes(48),
  },
  {
    id: "cluster-3",
    name: "On-Premesis Cluster",
    nodes: generateRandomNodes(12),
  },
  {
    id: "cluster-4",
    name: "Vector Institute Cluster",
    nodes: generateRandomNodes(278),
  },
];

const MyNodes: React.FC = () => {
  // --- SkyPilot Clusters Section ---
  const skypilotFetcher = (url: string) =>
    fetch(url, { credentials: "include" }).then((res) => res.json());
  const { data: skypilotData, isLoading: skypilotLoading } = useSWR(
    buildApiUrl("skypilot/status"),
    skypilotFetcher,
    { refreshInterval: 2000 }
  );
  const myClusters = (skypilotData?.clusters || []).filter(
    (c: any) =>
      c.status &&
      (c.status.toLowerCase().includes("init") ||
        c.status.toLowerCase().includes("up"))
  );

  // Flatten all nodes held by "ali" and annotate with cluster name and held time
  const nodesHeldByAli = mockClusters
    .flatMap((cluster) =>
      cluster.nodes
        .filter((node) => node.user === "ali" && node.status === "active")
        .map((node) => ({
          ...node,
          clusterName: cluster.name,
          heldTime: randomHeldTime(),
        }))
    )
    .slice(0, 6); // Only show 6 machines

  // Group nodes by experimentName
  const groupedByExperiment: { [exp: string]: typeof nodesHeldByAli } = {};
  nodesHeldByAli.forEach((node) => {
    const exp = node.experimentName ?? "No Experiment";
    if (!groupedByExperiment[exp]) groupedByExperiment[exp] = [];
    groupedByExperiment[exp].push(node);
  });

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: 2 }}>
      <Tabs defaultValue={0} sx={{ background: "transparent" }} variant="plain">
        <TabList
          disableUnderline
          sx={{
            [`& .${tabClasses.root}`]: {
              px: 2, // consistent horizontal padding for all tabs
              py: 1, // consistent vertical padding for all tabs
            },
            [`& .${tabClasses.root}[aria-selected="true"]`]: {
              bgcolor: "transparent",
              px: 2, // consistent horizontal padding for all tabs
              py: 1, // consistent vertical padding for all tabs
            },
          }}
        >
          <Tab value={0}>Holds</Tab>
          <Tab value={1}>Jobs</Tab>
        </TabList>
        <TabPanel value={0}>
          <Held skypilotLoading={skypilotLoading} myClusters={myClusters} />
        </TabPanel>
        <TabPanel value={1}>
          <Jobs
            skypilotLoading={skypilotLoading}
            myClusters={myClusters}
            groupedByExperiment={groupedByExperiment}
            nodes={[]}
          />
        </TabPanel>
      </Tabs>
    </Box>
  );
};

export default MyNodes;
