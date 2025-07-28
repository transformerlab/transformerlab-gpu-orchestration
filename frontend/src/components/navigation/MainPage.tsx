import React from "react";
import { Box, Card, Typography } from "@mui/joy";
import { Routes, Route, Navigate } from "react-router-dom";
import GettingStarted from "../pages/Admin/GettingStarted";
import Nodes from "../pages/Nodes";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Admin from "../pages/Admin/Admin";
import Jobs from "../pages/Jobs";
import Reports from "../pages/Reports";
import MyNodes from "../pages/MyNodes";
import Users from "../pages/Admin/Users";
import NodeDetails from "../pages/MyNodes/NodeDetails";

const Dashboard: React.FC = () => {
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
          <Route
            path="/"
            element={<Navigate to="/dashboard/nodes" replace />}
          />
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/nodes" element={<Nodes />} />
          <Route path="/my-nodes" element={<MyNodes />} />
          <Route path="/nodes/node/:nodeId" element={<NodeDetails />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users/" element={<Users />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Dashboard;
