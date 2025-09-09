import React from "react";
import {
  Alert,
  Box,
  Card,
  FormControl,
  FormLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/joy";
import { Routes, Route, Navigate } from "react-router-dom";
import GettingStarted from "../pages/Admin/GettingStarted";
import Nodes from "../pages/NodePools";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Jobs from "../pages/Jobs";
import Reports from "../pages/Reports";
import MyClusters from "../pages/MyClusters";
import Users from "../pages/Admin/Users";
import APIKeys from "../pages/Admin/APIKeys";
import NodeDetails from "../pages/MyNodes/NodeDetails";
import Teams from "../pages/Admin/Teams";

import IdentityFileManager from "../pages/Admin/IdentityFileManager";
import LaunchHooksManager from "../pages/Admin/LaunchHooksManager";
import ObjectStorage from "../pages/Admin/ObjectStorage";
import PrivateContainerRegistry from "../pages/Admin/PrivateContainerRegistry";
import PageWithTitle from "../pages/templates/PageWithTitle";
import { useFakeData } from "../../context/FakeDataContext";
import MyClusterDetails from "../pages/MyClusterDetails";
import ClusterDetails from "../pages/ClusterDetails";
import Logs from "../pages/Logs";

import Pools from "../pages/Admin/Pools";
import AzureConfigPage from "../pages/Admin/AzureConfigPage";
import RunPodConfigPage from "../pages/Admin/RunPodConfigPage";
import SSHConfigPage from "../pages/Admin/SSHConfigPage";
import { Volume } from "lucide-react";
import Volumes from "../pages/Admin/Volumes";
import UserQuota from "../pages/Admin/MyQuota";
import OrgQuota from "../pages/Admin/OrgQuota";
import Costs from "../pages/Costs";
import MyQuota from "../pages/Admin/MyQuota";

const Dashboard: React.FC = () => {
  const { showFakeData, setShowFakeData } = useFakeData();

  return (
    <Box
      component="main"
      className="MainContent"
      sx={() => ({
        display: "grid",
        height: "100dvh",
        width: "100dvw",
        overflow: "hidden",
        gridTemplateColumns: "210px 1fr",
        gridTemplateRows: "60px 5fr",
        gridTemplateAreas: `
          "header header"
          "sidebar main"
          "sidebar footer"
        `,
      })}
    >
      <Header />
      <Box
        sx={{
          gridArea: "sidebar",
          overflowY: "auto",
        }}
      >
        <Sidebar />
      </Box>
      <Box sx={{ gridArea: "main", pb: 2, px: 3, overflowY: "auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="node-pools" replace />} />
          <Route path="/node-pools" element={<Nodes />} />
          <Route path="/my-instances" element={<MyClusters />} />
          <Route path="/nodes/node/:nodeId" element={<NodeDetails />} />
          <Route path="/node-pools/:clusterName" element={<ClusterDetails />} />
          <Route
            path="/my-instance-info/:clusterName"
            element={<MyClusterDetails />}
          />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/costs" element={<Costs />} />
          <Route path="/quota" element={<MyQuota />} />
          <Route path="/logs" element={<Logs />} />

          <Route path="/reports" element={<Reports />} />
          {/* Admin routes */}
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/api-keys" element={<APIKeys />} />
          <Route path="admin/teams" element={<Teams />} />
          <Route path="admin/pools" element={<Pools />} />
          <Route path="admin/azure-config" element={<AzureConfigPage />} />
          <Route path="admin/runpod-config" element={<RunPodConfigPage />} />
          <Route path="admin/ssh-config" element={<SSHConfigPage />} />
          <Route path="admin/identity" element={<IdentityFileManager />} />
          <Route path="admin/launch-hooks" element={<LaunchHooksManager />} />
          <Route path="admin/object-storage" element={<ObjectStorage />} />
          <Route
            path="admin/container-registry"
            element={<PrivateContainerRegistry />}
          />
          <Route path="admin/volumes" element={<Volumes />} />
          <Route path="admin/quota" element={<OrgQuota />} />

          <Route
            path="admin/settings"
            element={
              <PageWithTitle
                title="Settings"
                subtitle="Configure application settings."
              >
                <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
                  <Typography level="h4" sx={{ mb: 2 }}>
                    Display Settings
                  </Typography>
                  <Stack spacing={2}>
                    <FormControl>
                      <FormLabel>Show Fake Data</FormLabel>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Switch
                          checked={showFakeData}
                          onChange={(e) => setShowFakeData(e.target.checked)}
                        />
                        <Typography level="body-sm" color="neutral">
                          {showFakeData
                            ? "Fake data is currently displayed throughout the application"
                            : "Fake data is hidden - only real data will be shown"}
                        </Typography>
                      </Stack>
                    </FormControl>
                  </Stack>
                </Card>
              </PageWithTitle>
            }
          />
        </Routes>
      </Box>
    </Box>
  );
};

export default Dashboard;
