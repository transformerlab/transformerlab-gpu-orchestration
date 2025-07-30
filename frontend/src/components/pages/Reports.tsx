import React, { useState, useEffect } from "react";
import { Box, Card, Typography, Stack, Chip, Divider } from "@mui/joy";
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
import { buildApiUrl } from "../../utils/api";

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

interface RealReportData {
  date: string;
  value: number;
}

interface RealReportsResponse {
  usage: RealReportData[];
  availability: RealReportData[];
  job_success: RealReportData[];
  total_jobs: number;
  successful_jobs: number;
  total_usage_hours: number;
  average_availability_percent: number;
}

const Reports: React.FC = () => {
  const [realData, setRealData] = useState<RealReportsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRealData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("reports"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRealData(data);
    } catch (err) {
      console.error("Failed to fetch real data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch real data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealData();
  }, []);

  const realReports: Report[] = realData ? [
    {
      id: "real-1",
      name: "Usage (past 30 days) - Real Data",
      data: realData.usage,
      color: "blue",
      yAxisLabel: "Usage %",
    },
    {
      id: "real-2",
      name: "Availability (past 30 days) - Real Data",
      data: realData.availability,
      color: "emerald",
      yAxisLabel: "Availability %",
    },
    {
      id: "real-3",
      name: "Job Success (past 30 days) - Real Data",
      data: realData.job_success,
      color: "violet",
      yAxisLabel: "Success Rate %",
    },
  ] : [];

  return (
    <PageWithTitle title="Reports" subtitle="View who did what">
      {/* Fake Data Section */}
      <Typography level="h3" sx={{ mb: 3, mt: 2 }}>
        Sample Data
      </Typography>
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
      
      {/* Real Data Section */}
      <Divider sx={{ my: 4 }} />
      <Typography level="h3" sx={{ mb: 3 }}>
        Real Data
      </Typography>
      
      {loading && (
        <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography>Loading real data...</Typography>
        </Card>
      )}
      
      {error && (
        <Card variant="outlined" sx={{ p: 3, mb: 3, borderColor: "danger.500" }}>
          <Typography color="danger">Error loading real data: {error}</Typography>
        </Card>
      )}
      
      {realData && realReports.length > 0 && (
        <>
          {realReports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
          
          {/* Summary Statistics */}
          <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography level="h4" sx={{ mb: 2 }}>
              Summary Statistics
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" gap={2}>
              <Chip variant="soft" color="primary">
                Total Jobs: {realData.total_jobs}
              </Chip>
              <Chip variant="soft" color="success">
                Successful Jobs: {realData.successful_jobs}
              </Chip>
              <Chip variant="soft" color="warning">
                Total Usage: {realData.total_usage_hours} hours
              </Chip>
              <Chip variant="soft" color="info">
                Avg Availability: {realData.average_availability_percent}%
              </Chip>
            </Stack>
          </Card>
        </>
      )}
      
      {realData && realReports.length === 0 && (
        <Card variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography>No real data available yet. Start using clusters and submitting jobs to see real statistics!</Typography>
        </Card>
      )}
    </PageWithTitle>
  );
};

export default Reports;
