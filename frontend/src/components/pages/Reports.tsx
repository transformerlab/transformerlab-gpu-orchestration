import React from "react";
import { Box, Card, Typography, Stack, Chip } from "@mui/joy";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import PageWithTitle from "./templates/PageWithTitle";

interface Report {
  id: string;
  name: string;
  data: Array<{ date: string; value: number }>;
  color: string;
  yAxisLabel: string;
}

// Sample data for the charts
const generateSampleData = (baseValue: number, variance: number) => {
  const data = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const value = Math.max(0, baseValue + (Math.random() - 0.5) * variance);
    data.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(value * 100) / 100,
    });
  }
  return data;
};

// Color mapping for chart lines
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

const reports: Report[] = [
  {
    id: "1",
    name: "Usage (past 30 days)",
    data: generateSampleData(10, 2),
    color: "blue",
    yAxisLabel: "Usage %",
  },
  {
    id: "2",
    name: "Availability (past 30 days)",
    data: generateSampleData(95, 15),
    color: "emerald",
    yAxisLabel: "Availability %",
  },
  {
    id: "3",
    name: "Job Success (past 30 days)",
    data: generateSampleData(85, 20),
    color: "violet",
    yAxisLabel: "Success Rate %",
  },
];

const ReportCard: React.FC<{ report: Report }> = ({ report }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        p: 3,
        mb: 3,
        transition: "all 0.2s ease",
        "&:hover": {
          boxShadow: "md",
        },
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ mb: 1 }}>
          {report.name}
        </Typography>
      </Box>

      <Box sx={{ height: 300, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={report.data}>
            {/* <CartesianGrid strokeDasharray="3 3" /> */}
            <Area
              type="monotone"
              dataKey="value"
              stroke={getColorHex(report.color)}
              fill={getColorHex(report.color)}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
};

const Reports: React.FC = () => {
  return (
    <PageWithTitle title="Reports" subtitle="View who did what">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </PageWithTitle>
  );
};

export default Reports;
