import React from "react";
import {
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
import NodeDetails from "../pages/MyNodes/NodeDetails";
import Teams from "../pages/Admin/Teams";
import SSHClusterAdmin from "../pages/Admin/SSHClusterAdmin";
import RunPodAdmin from "../pages/Admin/RunPodAdmin";
import AzureAdmin from "../pages/Admin/AzureAdmin";
import IdentityFileManager from "../pages/Admin/IdentityFileManager";
import ObjectStorage from "../pages/Admin/ObjectStorage";
import PageWithTitle from "../pages/templates/PageWithTitle";
import { useFakeData } from "../../context/FakeDataContext";
import MyClusterDetails from "../pages/MyClusterDetails";
import ClusterDetails from "../pages/ClusterDetails";

import SkyPilotClusterLauncher from "../SkyPilotClusterLauncher";

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
        gridTemplateColumns: "180px 1fr",
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
      <Box sx={{ gridArea: "main", px: 3, py: 2, overflowY: "auto" }}>
        <Routes>
          <Route path="/" element={<Navigate to="node-pools" replace />} />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/node-pools" element={<Nodes />} />
          <Route path="/my-clusters" element={<MyClusters />} />
          <Route path="/nodes/node/:nodeId" element={<NodeDetails />} />
          <Route
            path="/my-cluster-info/:clusterName"
            element={<MyClusterDetails />}
          />
          <Route path="/clusters/:clusterName" element={<ClusterDetails />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/reports" element={<Reports />} />
          <Route
            path="/skypilot-tester"
            element={<SkyPilotClusterLauncher />}
          />
          <Route path="admin/users" element={<Users />} />
          <Route path="admin/teams" element={<Teams />} />
          <Route path="admin/clouds" element={<SSHClusterAdmin />} />
          <Route path="admin/runpod" element={<RunPodAdmin />} />
          <Route path="admin/azure" element={<AzureAdmin />} />
          <Route path="admin/identity" element={<IdentityFileManager />} />
          <Route path="admin/object-storage" element={<ObjectStorage />} />
          <Route
            path="admin/volumes"
            element={
              <PageWithTitle
                title="Volumes"
                subtitle="Manage volume mounts and storage."
              />
            }
          />
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
