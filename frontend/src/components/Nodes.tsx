import React, { useState, useEffect } from "react";
import { Box, Button, Card, Typography, Stack, Chip } from "@mui/joy";
import { Monitor, Plus, Settings } from "lucide-react";
import ClusterManagement from "./ClusterManagement";
import { buildApiUrl } from "../utils/api";

const Nodes: React.FC = () => {
  return (
    <Box
      sx={{
        maxWidth: 800,
        mx: "auto",
      }}
    >
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography level="h2" sx={{ mb: 1 }}>
          Nodes
        </Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          A list of Nodes here
        </Typography>
      </Box>
    </Box>
  );
};

export default Nodes;
