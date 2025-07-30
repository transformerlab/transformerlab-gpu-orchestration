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
import { buildApiUrl, apiFetch } from "../../utils/api";
import Held from "./MyNodes/Holds";
import Jobs from "./MyNodes/Jobs";

interface Cluster {
  cluster_name: string;
  status: string;
  resources_str?: string;
  launched_at?: number;
  last_use?: string;
  autostop?: number;
  to_down?: boolean;
}

const MyClusters: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState(0);

  // --- SkyPilot Clusters Section ---
  const skypilotFetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());
  const { data: skypilotData, isLoading: skypilotLoading } = useSWR(
    buildApiUrl("skypilot/status"),
    skypilotFetcher,
    { refreshInterval: 2000 }
  );

  // Filter for active clusters (status contains "init" or "up")
  const myClusters = (skypilotData?.clusters || []).filter(
    (c: Cluster) =>
      c.status &&
      (c.status.toLowerCase().includes("init") ||
        c.status.toLowerCase().includes("up"))
  );

  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: 2 }}>
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value as number)}
        sx={{ background: "transparent" }}
        variant="plain"
      >
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
          <Held
            skypilotLoading={skypilotLoading}
            myClusters={myClusters}
            onTabChange={handleTabChange}
          />
        </TabPanel>
        <TabPanel value={1}>
          <Jobs skypilotLoading={skypilotLoading} myClusters={myClusters} />
        </TabPanel>
      </Tabs>
    </Box>
  );
};

export default MyClusters;
