import React, { useState } from "react";
import { Box, Typography, Tabs, TabList, Tab, TabPanel } from "@mui/joy";
import SSHClusterAdmin from "../SSHClusterAdmin";
import IdentityFileManager from "../IdentityFileManager";

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

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

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value as number)}
      >
        <TabList>
          <Tab>SSH Clusters</Tab>
          <Tab>Identity Files</Tab>
        </TabList>

        <TabPanel value={0}>
          <SSHClusterAdmin />
        </TabPanel>

        <TabPanel value={1}>
          <IdentityFileManager />
        </TabPanel>
      </Tabs>
    </Box>
  );
};

export default Admin;
