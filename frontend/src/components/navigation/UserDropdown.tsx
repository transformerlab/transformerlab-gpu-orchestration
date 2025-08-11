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
import UserSettingsModal from "../user-settings/UserSettingsModal";

const UserDropdown: React.FC = () => {
  const { user, logout } = useAuth();
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);

  if (!user) return null;

  return (
    <>
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
          <Avatar src={user.profile_picture_url} size="md">
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
              {user.organization_name}
            </Typography>
          </Box>
        </MenuButton>
        <Menu
          placement="bottom-end"
          sx={{
            minWidth: 220,
            "--ListItem-paddingY": "0.5rem",
          }}
        >
          <Box sx={{ px: 2, py: 1 }}>
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
          {/* <MenuItem disabled sx={{ cursor: "default" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography level="title-sm">User ID</Typography>
              <Typography level="body-xs" sx={{ fontFamily: "monospace" }}>
                {user.id}
              </Typography>
            </Box>
          </MenuItem> */}
          <MenuItem onClick={() => setSettingsModalOpen(true)}>
            <Typography level="title-sm">Settings</Typography>
          </MenuItem>
          <ListDivider />
          <MenuItem onClick={logout} color="danger">
            Logout
          </MenuItem>
        </Menu>
      </Dropdown>

      <UserSettingsModal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </>
  );
};

export default UserDropdown;
