import React from "react";
import { Box, Card, Typography } from "@mui/joy";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

interface MetricPoint {
  time: string; // ISO time string
  value: number; // percentage 0-100
}

// Color mapping similar to Reports.tsx
const getColorHex = (colorName: string): string => {
  const colors: Record<string, string> = {
    blue: "#3b82f6",
    emerald: "#10b981",
    violet: "#8b5cf6",
    red: "#ef4444",
    yellow: "#f59e0b",
    indigo: "#6366f1",
  };
  return colors[colorName] || "#3b82f6";
};

// Generate sample data for the past N minutes
const generateSampleData = (
  minutes: number,
  base: number,
  variance: number
): MetricPoint[] => {
  const data: MetricPoint[] = [];
  const now = new Date();

  // Smoother mean-reverting random walk
  const step = Math.max(0.5, variance / 12); // small per-minute drift
  let value = Math.max(
    0,
    Math.min(100, base + (Math.random() - 0.5) * (variance / 6))
  );

  for (let i = minutes; i >= 0; i--) {
    const t = new Date(now);
    t.setMinutes(t.getMinutes() - i);

    const drift = (Math.random() - 0.5) * step;
    value += drift + (base - value) * 0.06; // gentle pull toward base
    value = Math.max(0, Math.min(100, value));

    data.push({ time: t.toISOString(), value: Math.round(value * 100) / 100 });
  }
  return data;
};

interface MetricCardProps {
  title: string;
  color: string; // color name mapped in getColorHex
  data: MetricPoint[];
}

const MetricCard: React.FC<MetricCardProps> = ({ title, color, data }) => {
  const colorHex = getColorHex(color);
  return (
    <Card
      variant="outlined"
      sx={{
        height: "250px",
        p: 3,
        m: 0, // removed external margins; grid gap controls spacing
        transition: "all 0.2s ease",
        "&:hover": { boxShadow: "md" },
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography level="h4">{title}</Typography>
      </Box>
      <Box sx={{ height: 260, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <XAxis
              dataKey="time"
              tickFormatter={(value) => {
                const d = new Date(value);
                const hh = String(d.getHours()).padStart(2, "0");
                const mm = String(d.getMinutes()).padStart(2, "0");
                return `${hh}:${mm}`;
              }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              labelFormatter={(value) => {
                const d = new Date(value);
                return d.toLocaleString();
              }}
              formatter={(val: number) => [`${val}%`, "Usage"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colorHex}
              fill={colorHex}
              fillOpacity={0.3}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
};

export interface FakeChartsProps {
  machineName?: string;
  minutes?: number; // how far back the data should go
}

const FakeCharts: React.FC<FakeChartsProps> = ({
  machineName = "Machine",
  minutes = 60,
}) => {
  // Create four fake series for the past `minutes` minutes
  const cpuData = React.useMemo(
    () => generateSampleData(minutes, 55, 30),
    [minutes]
  );
  const gpuData = React.useMemo(
    () => generateSampleData(minutes, 40, 40),
    [minutes]
  );
  const vramData = React.useMemo(
    () => generateSampleData(minutes, 35, 35),
    [minutes]
  );
  const memData = React.useMemo(
    () => generateSampleData(minutes, 65, 25),
    [minutes]
  );

  return (
    <Box>
      <Typography level="h3" sx={{ mb: 2 }}>
        {machineName} Monitoring
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <MetricCard title="CPU Usage (last hour)" color="blue" data={cpuData} />
        <MetricCard
          title="GPU Usage (last hour)"
          color="violet"
          data={gpuData}
        />
        <MetricCard
          title="VRAM Usage (last hour)"
          color="red"
          data={vramData}
        />
        <MetricCard
          title="Memory Usage (last hour)"
          color="emerald"
          data={memData}
        />
      </Box>
    </Box>
  );
};

export default FakeCharts;
