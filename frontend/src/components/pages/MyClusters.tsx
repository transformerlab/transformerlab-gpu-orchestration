import React from "react";
import useSWR from "swr";
import { buildApiUrl, apiFetch } from "../../utils/api";
import Held from "./MyNodes/Holds";
import InstanceHistory from "./MyNodes/InstanceHistory";
import PageWithTitle from "./templates/PageWithTitle";
import { Box, Button, Typography } from "@mui/joy";

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
  const [showPastInstances, setShowPastInstances] = React.useState(false);

  // --- SkyPilot Clusters Section ---
  const skypilotFetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());
  const { data: skypilotData, isLoading: skypilotLoading } = useSWR(
    buildApiUrl("instances/status"),
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

  return (
    <PageWithTitle
      title="My Instances"
      subtitle="View your current instances and instance history."
    >
      {/* Current Instances Section */}
      <Held skypilotLoading={skypilotLoading} myClusters={myClusters} />

      {/* Past Instances Section */}
      <Box sx={{ mt: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Typography level="h3">Past Instances</Typography>
          <Button
            size="sm"
            variant="outlined"
            onClick={() => setShowPastInstances(!showPastInstances)}
          >
            {showPastInstances ? "Hide" : "Show"} Past Instances
          </Button>
        </Box>

        {showPastInstances && <InstanceHistory />}
      </Box>
    </PageWithTitle>
  );
};

export default MyClusters;
