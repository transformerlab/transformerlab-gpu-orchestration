import React from "react";
import { Box, Card, Typography } from "@mui/joy";
import GettingStarted from "./GettingStarted";
import Header from "./Header";
import Sidebar from "./Sidebar";

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
        gridTemplateRows: "80px 5fr",
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
        <GettingStarted />
      </Box>
    </Box>
  );
};

export default Dashboard;
