import React, { useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  Sheet,
} from "@mui/joy";
import SSHClusterAdmin from "./Admin/SSHClusterAdmin";
import Users from "./Admin/Users";
import IdentityFileManager from "./Admin/IdentityFileManager";

const Admin: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<
    "team" | "clusters" | "identity"
  >("team");

  const renderContent = () => {
    switch (selectedSection) {
      case "team":
        return <Users />;
      case "clusters":
        return <SSHClusterAdmin />;
      case "identity":
        return <IdentityFileManager />;
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        p: 2,
        display: "flex",
        gap: 3,
      }}
    >
      {/* Left Navigation */}
      <Sheet
        variant="plain"
        sx={{
          width: 200,
          p: 2,
          borderRadius: "md",
          height: "fit-content",
          backgroundColor: "background.body",
        }}
      >
        <Typography level="h4" sx={{ mb: 2 }}>
          Admin Sections
        </Typography>
        <List>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "team"}
              onClick={() => setSelectedSection("team")}
            >
              <ListItemContent>Team</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "clusters"}
              onClick={() => setSelectedSection("clusters")}
            >
              <ListItemContent>Clusters</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "identity"}
              onClick={() => setSelectedSection("identity")}
            >
              <ListItemContent>Identity Files</ListItemContent>
            </ListItemButton>
          </ListItem>
        </List>
      </Sheet>

      {/* Right Content Area */}
      <Box
        sx={{
          flex: 1,
          p: 3,
        }}
      >
        {renderContent()}
      </Box>
    </Box>
  );
};

export default Admin;
