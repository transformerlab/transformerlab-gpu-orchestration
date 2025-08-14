import React from "react";
import { Box, Card, Typography } from "@mui/joy";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface UserUsageData {
  user_id: string;
  user_email?: string;
  user_name?: string;
  gpu_hours_used: number;
  gpu_hours_limit: number;
  gpu_hours_remaining: number;
  usage_percentage: number;
}

interface UserUsagePieChartProps {
  data: UserUsageData[];
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ef4444", // red
  "#f59e0b", // yellow
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
];

const UserUsagePieChart: React.FC<UserUsagePieChartProps> = ({ data }) => {
  // Transform data for pie chart
  const pieData = data.map((user, index) => ({
    name: user.user_name || user.user_email || user.user_id,
    value: user.gpu_hours_used,
    color: COLORS[index % COLORS.length],
    user_id: user.user_id,
    usage_percentage: user.usage_percentage,
  }));

  // Custom legend component to handle long names
  const CustomLegend = ({ payload }: any) => {
    if (!payload || payload.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography level="body-sm" fontWeight="bold" sx={{ mb: 1 }}>
          Users:
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {payload.map((entry: any, index: number) => (
            <Box
              key={`legend-${index}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                p: 0.5,
                borderRadius: 1,
                backgroundColor: "background.surface",
                border: "1px solid",
                borderColor: "divider",
                maxWidth: "200px",
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: entry.color,
                  flexShrink: 0,
                }}
              />
              <Typography
                level="body-xs"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "180px",
                }}
                title={entry.value}
              >
                {entry.value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = (
        (data.value / pieData.reduce((sum, item) => sum + item.value, 0)) *
        100
      ).toFixed(1);

      return (
        <Box
          sx={{
            backgroundColor: "background.surface",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1.5,
            boxShadow: "md",
            minWidth: "200px",
          }}
        >
          <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
            {data.name}
          </Typography>
          <Typography level="body-xs" sx={{ mb: 0.25 }}>
            Hours Used: {data.value.toFixed(1)}
          </Typography>
          <Typography level="body-xs" sx={{ mb: 0.25 }}>
            Quota Usage: {data.usage_percentage.toFixed(1)}%
          </Typography>
          <Typography level="body-xs" color="neutral">
            Share: {percentage}% of total
          </Typography>
        </Box>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card variant="outlined" sx={{ p: 3, textAlign: "center", height: 400 }}>
        <Typography level="body-md" color="neutral">
          No usage data available
        </Typography>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Typography level="h4" sx={{ mb: 2 }}>
        User Usage Distribution
      </Typography>
      <Box sx={{ height: 350, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
};

export default UserUsagePieChart;
