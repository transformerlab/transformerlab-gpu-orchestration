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
import SSHClusterAdmin from "./SSHClusterAdmin";
import Users from "./Users";
import IdentityFileManager from "./IdentityFileManager";
import Teams from "./Teams";
import ObjectStorage from "./ObjectStorage";

const Admin: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<
    "team" | "teams" | "clouds" | "identity" | "objectStorage" | "volumes"
  >("team");

  const renderContent = () => {
    switch (selectedSection) {
      case "team":
        return <Users />;
      case "teams":
        return <Teams />;
      case "clouds":
        return <SSHClusterAdmin />;
      case "identity":
        return <IdentityFileManager />;
      case "objectStorage":
        return <ObjectStorage />;
      case "volumes":
        return <Typography>Volumes</Typography>;
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        display: "flex",
        gap: 1,
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
        }}
      >
        <List>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "team"}
              onClick={() => setSelectedSection("team")}
            >
              <ListItemContent>Users</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "teams"}
              onClick={() => setSelectedSection("teams")}
            >
              <ListItemContent>Teams</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "clouds"}
              onClick={() => setSelectedSection("clouds")}
            >
              <ListItemContent>Clouds</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "identity"}
              onClick={() => setSelectedSection("identity")}
            >
              <ListItemContent>SSH Identity Files</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "objectStorage"}
              onClick={() => setSelectedSection("objectStorage")}
            >
              <ListItemContent>Object Storage</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "volumes"}
              onClick={() => setSelectedSection("volumes")}
            >
              <ListItemContent>Volumes</ListItemContent>
            </ListItemButton>
          </ListItem>
        </List>
      </Sheet>

      {/* Right Content Area */}
      <Box
        sx={{
          flex: 1,
          p: 2,
        }}
      >
        {renderContent()}
      </Box>
    </Box>
  );
};

export default Admin;
