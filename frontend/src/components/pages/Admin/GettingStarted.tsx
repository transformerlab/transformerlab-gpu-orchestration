import React, { useState, useEffect } from "react";
import { Box, Button, Card, Typography, Stack, Chip } from "@mui/joy";
import { Monitor, Plus, Settings } from "lucide-react";
import ClusterManagement from "../../ClusterManagement";
import { buildApiUrl } from "../../../utils/api";

const GettingStarted: React.FC = () => {
  // Remove all state and logic related to cluster creation steps
  // Only show node pools (ClusterManagement)
  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        p: 2,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" sx={{ mb: 1 }}>
          Welcome to SkyPilot Cluster Management
        </Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          Here are the node pools (clusters) you have access to.
        </Typography>
      </Box>
      <ClusterManagement />
    </Box>
  );
};

export default GettingStarted;
