import React from "react";
import { Box, Card, Typography } from "@mui/joy";
import GettingStarted from "./GettingStarted";
import Header from "./Header";

const Dashboard: React.FC = () => {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.surface", p: 3 }}>
      <Header />
      <Card variant="outlined">
        <Typography level="h4" sx={{ mb: 2 }}>
          SkyPilot Cluster Management
        </Typography>
        <GettingStarted />
      </Card>
    </Box>
  );
};

export default Dashboard;
