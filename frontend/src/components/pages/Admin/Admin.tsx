import React, { useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  Sheet,
  Switch,
  FormControl,
  FormLabel,
  Card,
  Stack,
} from "@mui/joy";
import SSHClusterAdmin from "./SSHClusterAdmin";
import RunPodAdmin from "./RunPodAdmin";
import Users from "./Users";
import IdentityFileManager from "./IdentityFileManager";
import Teams from "./Teams";
import ObjectStorage from "./ObjectStorage";
import PageWithTitle from "../templates/PageWithTitle";
import { useFakeData } from "../../../context/FakeDataContext";

const Admin: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<
    | "users"
    | "teams"
    | "clouds"
    | "runpod"
    | "identity"
    | "objectStorage"
    | "volumes"
    | "settings"
  >("users");
  const { showFakeData, setShowFakeData } = useFakeData();

  const renderContent = () => {
    switch (selectedSection) {
      case "users":
        return <Users />;
      case "teams":
        return <Teams />;
      case "clouds":
        return <SSHClusterAdmin />;
      case "runpod":
        return <RunPodAdmin />;
      case "identity":
        return <IdentityFileManager />;
      case "objectStorage":
        return <ObjectStorage />;
      case "volumes":
        return (
          <PageWithTitle
            title="Volumes"
            subtitle="Manage volume mounts and storage."
          />
        );
      case "settings":
        return (
          <PageWithTitle
            title="Settings"
            subtitle="Configure application settings."
          >
            <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
              <Typography level="h4" sx={{ mb: 2 }}>
                Display Settings
              </Typography>
              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Show Fake Data</FormLabel>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Switch
                      checked={showFakeData}
                      onChange={(e) => setShowFakeData(e.target.checked)}
                    />
                    <Typography level="body-sm" color="neutral">
                      {showFakeData
                        ? "Fake data is currently displayed throughout the application"
                        : "Fake data is hidden - only real data will be shown"}
                    </Typography>
                  </Stack>
                </FormControl>
              </Stack>
            </Card>
          </PageWithTitle>
        );
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
              selected={selectedSection === "users"}
              onClick={() => setSelectedSection("users")}
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
              <ListItemContent>Cloud Node Pools</ListItemContent>
            </ListItemButton>
          </ListItem>
          <ListItem>
            <ListItemButton
              selected={selectedSection === "runpod"}
              onClick={() => setSelectedSection("runpod")}
            >
              <ListItemContent>RunPod Configuration</ListItemContent>
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
          <ListItem>
            <ListItemButton
              selected={selectedSection === "settings"}
              onClick={() => setSelectedSection("settings")}
            >
              <ListItemContent>Settings</ListItemContent>
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
