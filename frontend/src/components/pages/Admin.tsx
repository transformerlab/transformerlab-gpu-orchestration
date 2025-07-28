import React from "react";
import { Box, Typography, Divider } from "@mui/joy";
import SSHClusterAdmin from "../SSHClusterAdmin";
import IdentityFileManager from "../IdentityFileManager";

const Admin: React.FC = () => {
  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        p: 2,
      }}
    >
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" sx={{ mb: 1 }}>
          Admin
        </Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          Manage SSH clusters and identity files
        </Typography>
      </Box>

      {/* Identity Files Section */}
      <Box sx={{ mb: 6 }}>
        <IdentityFileManager />
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* SSH Clusters Section */}
      <Box>
        <SSHClusterAdmin />
      </Box>
    </Box>
  );
};

export default Admin;
