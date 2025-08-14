import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useSWR from "swr";
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
  ChevronDownIcon,
  ChevronRightIcon,
  StretchHorizontalIcon,
  GripHorizontalIcon,
  CircleDotIcon,
  CirclePoundSterlingIcon,
  ChartNoAxesColumnIncreasingIcon,
  CircleIcon,
  BoltIcon,
  ClockIcon,
} from "lucide-react";
import { buildApiUrl, apiFetch } from "../../utils/api";

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
    icon: <GripHorizontalIcon />,
    content: "Node Pools",
    path: "/dashboard/node-pools",
  },
  {
    icon: <CircleDotIcon size={22} style={{ paddingLeft: "2px" }} />,
    content: "My Instances",
    path: "/dashboard/my-instances",
  },
  {
    icon: <StretchHorizontalIcon />,
    content: "My Jobs",
    path: "/dashboard/jobs",
  },
  {
    icon: <CircleIcon />,
    content: "Cost Report",
    path: "/dashboard/costs",
  },
  {
    icon: <ClockIcon />,
    content: "Quota",
    path: "/dashboard/quota",
  },
  {
    icon: <ChartNoAxesColumnIncreasingIcon />,
    content: "Reports",
    path: "/dashboard/reports",
  },
];

const adminSubItems = [
  { content: "Users", section: "users", path: "/dashboard/admin/users" },
  {
    content: "API Keys",
    section: "api-keys",
    path: "/dashboard/admin/api-keys",
  },
  { content: "Teams", section: "teams", path: "/dashboard/admin/teams" },
  {
    content: "Org Quotas",
    section: "org-quota",
    path: "/dashboard/admin/org-quota",
  },
  {
    content: "Node Pools",
    path: "/dashboard/admin/pools",
  },
  {
    content: "SSH Identity Files",
    path: "/dashboard/admin/identity",
  },
  {
    content: "Object Storage",
    path: "/dashboard/admin/object-storage",
  },
  { content: "Volumes", path: "/dashboard/admin/volumes" },
  {
    content: "Settings",
    path: "/dashboard/admin/settings",
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminExpanded, setAdminExpanded] = React.useState(
    location.pathname.startsWith("/dashboard/admin")
  );

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const isAdminPath = location.pathname.startsWith("/dashboard/admin");

  React.useEffect(() => {
    if (isAdminPath) {
      setAdminExpanded(true);
    }
  }, [isAdminPath]);

  // Fetch instance count using SWR
  const instanceFetcher = (url: string) =>
    apiFetch(url, { credentials: "include" }).then((res) => res.json());

  const { data: instanceData } = useSWR(
    buildApiUrl("skypilot/status"),
    instanceFetcher,
    { refreshInterval: 5000 } // Refresh every 5 seconds
  );

  const instanceCount = instanceData?.clusters
    ? instanceData.clusters.length
    : 0;

  return (
    <List
      size="sm"
      sx={{
        "--ListItem-radius": "var(--joy-radius-sm)",
        "--List-gap": "4px",
        ml: 2,
      }}
    >
      <ListItem nested>
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
              chipCount={
                item.content === "My Instances" && instanceCount > 0
                  ? instanceCount
                  : undefined
              }
              onClick={
                item.path ? () => handleNavigation(item.path) : undefined
              }
            />
          ))}
          <ListItem nested>
            <ListItemButton onClick={() => setAdminExpanded(!adminExpanded)}>
              <ListItemDecorator
                sx={isAdminPath ? {} : { color: "neutral.500" }}
              >
                <BoltIcon />
              </ListItemDecorator>
              <ListItemContent>Admin</ListItemContent>
              <ListItemDecorator sx={{ ml: "auto" }}>
                {adminExpanded ? (
                  <ChevronDownIcon size={16} />
                ) : (
                  <ChevronRightIcon size={16} />
                )}
              </ListItemDecorator>
            </ListItemButton>
            {adminExpanded && (
              <List sx={{ "--List-gap": "2px" }}>
                {adminSubItems.map((item, index) => (
                  <ListItem key={`admin-${index}`}>
                    <ListItemButton
                      selected={location.pathname === item.path}
                      onClick={() => handleNavigation(item.path)}
                      sx={{ pl: 4 }}
                    >
                      <ListItemContent>{item.content}</ListItemContent>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </ListItem>
        </List>
      </ListItem>
    </List>
  );
}
