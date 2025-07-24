import React from "react";
import { Box, Typography } from "@mui/joy";

const Admin: React.FC = () => {
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
          Admin
        </Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          Admin stuff
        </Typography>
      </Box>
    </Box>
  );
};

export default Admin;
