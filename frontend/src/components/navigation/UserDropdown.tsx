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
  LinearProgress,
  Chip,
} from "@mui/joy";
import { useAuth } from "../../context/AuthContext";
import UserSettingsModal from "../user-settings/UserSettingsModal";
import { buildApiUrl, apiFetch } from "../../utils/api";
import { useNavigate } from "react-router-dom";

const UserDropdown: React.FC = () => {
  const { user, logout } = useAuth();
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [quotaLoading, setQuotaLoading] = React.useState(false);
  const [quota, setQuota] = React.useState<
    | {
        limit: number;
        used: number;
        remaining: number;
        percentage: number;
        period_start?: string;
        period_end?: string;
      }
    | null
  >(null);
  const navigate = useNavigate();

  if (!user) return null;

  React.useEffect(() => {
    const organizationId = user.organization_id;
    if (!organizationId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setQuotaLoading(true);
        // Use summary endpoint which returns effective quota (user > team > org) and current period usage
        const res = await apiFetch(
          buildApiUrl(`quota/summary/${organizationId}`),
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load quota summary");
        const summary = await res.json();

        if (!cancelled && summary) {
          const limit = Number(summary.quota_limit || 0);
          const used = Number(summary.quota_used || 0);
          const remaining = Math.max(0, Number(summary.quota_remaining || Math.max(0, limit - used)));
          const percentage = limit > 0 ? (used / limit) * 100 : 0;

          setQuota({
            limit,
            used,
            remaining,
            percentage,
            period_start: summary.period_start,
            period_end: summary.period_end,
          });
        }
      } catch (e) {
        // Silent fail in dropdown
      } finally {
        if (!cancelled) setQuotaLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id]);

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
          {quota && (
            <MenuItem
              onClick={() => navigate("/dashboard/costs")}
              sx={{
                cursor: "pointer",
                p: 0,
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  width: "100%",
                  px: 2,
                  py: 1.25,
                }}
              >
                <Typography level="title-sm">Quota Usage</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>Used</Typography>
                    <Typography level="title-sm">
                      {new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quota.used)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>Remaining</Typography>
                    <Typography level="title-sm">
                      {new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.max(0, quota.remaining))}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Typography level="body-sm" sx={{ color: "text.tertiary" }}>Limit</Typography>
                    <Typography level="title-sm">
                      {new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quota.limit)}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress
                  determinate
                  value={Math.max(0, Math.min(100, quota.percentage))}
                  sx={{ height: 6, borderRadius: 9999, mt: 0.5 }}
                  color="neutral"
                />
                {quota.period_start && quota.period_end && (
                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {new Date(quota.period_start).toLocaleDateString()} - {new Date(quota.period_end).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          )}
          {quotaLoading && (
            <MenuItem disabled>
              <Box sx={{ width: "100%", px: 2 }}>
                <LinearProgress sx={{ height: 6, borderRadius: 9999 }} />
              </Box>
            </MenuItem>
          )}
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
