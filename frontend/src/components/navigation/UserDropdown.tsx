import React from "react";
import {
  Avatar,
  Dropdown,
  MenuButton,
  Menu,
  MenuItem,
  ListDivider,
  Typography,
  Box,
} from "@mui/joy";
import { useAuth } from "../../context/AuthContext";

const UserDropdown: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <Dropdown>
      <MenuButton
        variant="plain"
        sx={{
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pr: 2,
          mr: 1,
        }}
      >
        <Avatar
          src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&dpr=2"
          size="md"
        >
          {/* fallback initials logic can be removed if always using src */}
        </Avatar>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <Typography level="title-sm">
            {user.first_name || user.last_name
              ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
              : user.email}
          </Typography>
          <Typography level="body-xs" sx={{ color: "text.secondary" }}>
            Square Bank
          </Typography>
        </Box>
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
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
  );
};

export default UserDropdown;
