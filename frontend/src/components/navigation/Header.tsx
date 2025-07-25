import React from "react";
import {
  Box,
  Typography,
  Avatar,
  Dropdown,
  MenuButton,
  Menu,
  MenuItem,
  ListDivider,
  IconButton,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logo from "../../logo.png";
import UserDropdown from "./UserDropdown";

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { mode, setMode } = useColorScheme();

  if (!user) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gridArea: "header",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <img src={logo} alt="Lattice Logo" style={{ width: 40, height: 40 }} />
        <Typography level="h1" sx={{ color: "primary.500" }}>
          Lattice
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <IconButton
          variant="plain"
          aria-label={
            mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          sx={{ mr: 1 }}
        >
          {mode === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </IconButton>
        <UserDropdown />
      </Box>
    </Box>
  );
};

export default Header;
