import * as React from "react";
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
}

function Item({ icon, content, selected = false, chipCount }: ItemProps) {
  return (
    <ListItem>
      <ListItemButton selected={selected}>
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
  { icon: <PersonStandingIcon />, content: "Compute", selected: true },
  { icon: <ComputerIcon />, content: "Your Machines" },
  { icon: <GpuIcon />, content: "GPU" },
  { icon: <ChartAreaIcon />, content: "Reports" },
  { icon: <CogIcon />, content: "Admin", chipCount: 2 },
];

export default function Sidebar() {
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
              selected={item.selected}
              chipCount={item.chipCount}
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
            selected={item.selected}
            chipCount={item.chipCount}
          />
        ))}
      </List>
    </List>
  );
}
