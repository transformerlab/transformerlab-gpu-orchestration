import React from "react";
import useSWR from "swr";
import { buildApiUrl, apiFetch } from "../../utils/api";
import Held from "./MyNodes/Holds";
import PageWithTitle from "./templates/PageWithTitle";

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
    <PageWithTitle
      title="My Instances"
      subtitle="View the instances or clusters currently reserved for you."
    >
      <Held
        skypilotLoading={skypilotLoading}
        myClusters={myClusters}
        onTabChange={handleTabChange}
      />
    </PageWithTitle>
  );
};

export default MyClusters;
