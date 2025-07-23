import React from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  Avatar,
  Chip,
  Dropdown,
  MenuButton,
  Menu,
  MenuItem,
  ListDivider,
} from "@mui/joy";
import { useAuth } from "../context/AuthContext";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return null; // Should be handled by routing
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.surface", p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
          p: 2,
          bgcolor: "background.body",
          borderRadius: "md",
          boxShadow: "sm",
        }}
      >
        <Typography level="h1" sx={{ color: "primary.500" }}>
          Lattice
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Dropdown>
            <MenuButton
              variant="plain"
              sx={{ p: 0, minWidth: 0, borderRadius: "50%" }}
            >
              <Avatar>
                {user.first_name || user.last_name
                  ? `${user.first_name?.[0] || ""}${
                      user.last_name?.[0] || ""
                    }`.toUpperCase()
                  : user.email[0].toUpperCase()}
              </Avatar>
            </MenuButton>
            <Menu placement="bottom-end" sx={{ minWidth: 220 }}>
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography level="title-md" sx={{ fontWeight: "bold" }}>
                  {user.first_name || user.last_name
                    ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                    : user.email}
                </Typography>
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  {user.email}
                </Typography>
              </Box>
              <ListDivider />
              <MenuItem disabled sx={{ cursor: "default" }}>
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                >
                  <Typography level="body-xs" sx={{ fontWeight: "bold" }}>
                    User ID
                  </Typography>
                  <Typography level="body-xs" sx={{ fontFamily: "monospace" }}>
                    {user.id}
                  </Typography>
                </Box>
              </MenuItem>
              <ListDivider />
              <MenuItem onClick={logout} color="danger">
                Logout
              </MenuItem>
            </Menu>
          </Dropdown>
        </Box>
      </Box>

      {/* Features Placeholder */}
      <Card variant="outlined">
        <Typography level="h4" sx={{ mb: 2 }}>
          Features
        </Typography>
        <Typography level="body-md" sx={{ color: "text.secondary" }}>
          Your application features will be available here. The authentication
          system is now set up and ready for you to build upon.
        </Typography>
      </Card>
    </Box>
  );
};

export default Dashboard;
