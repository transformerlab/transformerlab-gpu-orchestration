import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Chip from "@mui/joy/Chip";
import List from "@mui/joy/List";
import ListSubheader from "@mui/joy/ListSubheader";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import ListItemContent from "@mui/joy/ListItemContent";
import {
  ChartAreaIcon,
  CogIcon,
  ComputerIcon,
  GpuIcon,
  LightbulbIcon,
  PersonStandingIcon,
} from "lucide-react";

interface ItemProps {
  icon: React.ReactNode;
  content: string;
  selected?: boolean;
  chipCount?: number;
  path?: string;
  onClick?: () => void;
}

function Item({
  icon,
  content,
  selected = false,
  chipCount,
  onClick,
}: ItemProps) {
  return (
    <ListItem>
      <ListItemButton selected={selected} onClick={onClick}>
        <ListItemDecorator sx={selected ? {} : { color: "neutral.500" }}>
          {icon}
        </ListItemDecorator>
        <ListItemContent>{content}</ListItemContent>
        {chipCount && (
          <Chip variant="soft" color="warning" size="sm">
            {chipCount}
          </Chip>
        )}
      </ListItemButton>
    </ListItem>
  );
}

const sidebarItems = [
  {
    icon: <PersonStandingIcon />,
    content: "Clusters",
    path: "/dashboard/getting-started",
  },
  { icon: <ComputerIcon />, content: "Nodes", path: "/dashboard/nodes" },
  { icon: <GpuIcon />, content: "GPU" },
  { icon: <ChartAreaIcon />, content: "Reports" },
  { icon: <CogIcon />, content: "Admin", chipCount: 2 },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <List
      size="sm"
      sx={{ "--ListItem-radius": "var(--joy-radius-sm)", "--List-gap": "4px" }}
    >
      <ListItem nested>
        <ListSubheader sx={{ letterSpacing: "2px", mt: 2, fontWeight: "800" }}>
          Cluster
        </ListSubheader>
        <List
          aria-labelledby="nav-list-browse"
          sx={{ "& .JoyListItemButton-root": { p: "8px" } }}
        >
          {sidebarItems.map((item, index) => (
            <Item
              key={`section1-${index}`}
              icon={item.icon}
              content={item.content}
              selected={item.path ? location.pathname === item.path : false}
              chipCount={item.chipCount}
              onClick={
                item.path ? () => handleNavigation(item.path) : undefined
              }
            />
          ))}
        </List>
        <ListSubheader sx={{ letterSpacing: "2px", mt: 2, fontWeight: "800" }}>
          Cluster
        </ListSubheader>
      </ListItem>
      <List
        aria-labelledby="nav-list-browse"
        sx={{ "& .JoyListItemButton-root": { p: "8px" } }}
      >
        {sidebarItems.map((item, index) => (
          <Item
            key={`section2-${index}`}
            icon={item.icon}
            content={item.content}
            selected={item.path ? location.pathname === item.path : false}
            chipCount={item.chipCount}
            onClick={item.path ? () => handleNavigation(item.path) : undefined}
          />
        ))}
      </List>
    </List>
  );
}
