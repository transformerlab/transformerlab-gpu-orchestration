import React from "react";
import MyInstancesTable from "./MyInstancesTable";

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
  groupedByExperiment?: { [key: string]: any[] };
  onTabChange?: (tabIndex: number) => void;
}

const Held: React.FC<HeldProps> = (props) => {
  return <MyInstancesTable {...props} />;
};

export default Held;
