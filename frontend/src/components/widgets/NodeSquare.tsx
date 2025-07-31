import React from "react";
import { Box, Typography, Tooltip, Avatar } from "@mui/joy";

interface NodeSquareProps {
  node: {
    id?: string;
    type?: "dedicated" | "on-demand" | "spot";
    status?: "active" | "inactive" | "unhealthy";
    user?: string;
    ip: string;
    identity_file?: string;
    password?: string;
    gpuType?: string;
    [key: string]: any;
  };
  nodeGpuInfo?: Record<string, any>;
  variant?: "mock" | "ssh";
}

const getStatusBackground = (status: string, type: string) => {
  // Background based on status
  if (status === "active") return "#10b981"; // green
  if (status === "inactive") return "unset"; // grey
  if (status === "unhealthy") return "#f59e0b"; // orange
  return "#6b7280"; // default grey
};

const getStatusBorderColor = (status: string, type: string) => {
  // Border based on status
  if (status === "active") return "#10b981"; // green
  if (status === "inactive") return "#6b7280"; // grey
  if (status === "unhealthy") return "#f59e0b"; // red
  return "#6b7280"; // default grey
};

const NodeSquare: React.FC<NodeSquareProps> = ({
  node,
  nodeGpuInfo = {},
  variant = "mock",
}) => {
  // Determine GPU display
  let gpuDisplay = "-";
  const gpuInfo = nodeGpuInfo[node.ip]?.gpu_resources;
  if (gpuInfo && gpuInfo.gpus && gpuInfo.gpus.length > 0) {
    gpuDisplay = gpuInfo.gpus
      .map((g: any) => {
        const qty = g.requestable_qty_per_node;
        if (qty && /^\d+$/.test(qty.trim())) {
          return `${g.gpu} (x${qty.trim()})`;
        } else if (qty && qty.trim().length > 0) {
          return `${g.gpu} (${qty.trim()})`;
        } else {
          return g.gpu;
        }
      })
      .join(", ");
  } else if (node.gpuType) {
    gpuDisplay = node.gpuType;
  }

  // Different styling and behavior based on variant
  const isMockVariant = variant === "mock";
  const boxWidth = 32;
  const boxHeight = 32;
  const backgroundColor = isMockVariant
    ? getStatusBackground(node.status || "inactive", node.type || "")
    : "#3b82f6";
  const borderColor = isMockVariant
    ? getStatusBorderColor(node.status || "inactive", node.type || "")
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMockVariant && node.id) {
      window.location.href = `/dashboard/nodes/node/${encodeURIComponent(
        node.id
      )}`;
    }
  };

  return (
    <Tooltip
      title={
        <Box>
          {isMockVariant && node.type && (
            <Typography level="body-sm">
              <b>Type:</b> {node.type}
            </Typography>
          )}
          {isMockVariant && node.status && (
            <Typography level="body-sm">
              <b>Status:</b> {node.status}
            </Typography>
          )}
          <Typography level="body-sm">
            <b>IP:</b> {node.ip}
          </Typography>
          <Typography level="body-sm">
            <b>User:</b> {node.user || "Unassigned"}
          </Typography>
          {node.identity_file && (
            <Typography level="body-sm">
              <b>Identity File:</b> {node.identity_file}
            </Typography>
          )}
          {node.password && (
            <Typography level="body-sm">
              <b>Password:</b> ****
            </Typography>
          )}
          {!isMockVariant && (
            <Typography level="body-sm">
              <b>GPUs:</b> {gpuDisplay}
            </Typography>
          )}
        </Box>
      }
      variant="soft"
      size="sm"
      arrow
    >
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          width: boxWidth,
          height: boxHeight,
          backgroundColor,
          borderRadius: "2px",
          margin: "1px",
          transition: "all 0.2s ease",
          cursor: "pointer",
          border: borderColor ? `2px solid ${borderColor}` : undefined,
          boxSizing: "border-box",
          position: "relative",
          verticalAlign: "middle",
          "&:hover": {
            transform: "scale(1.2)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          },
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
        }}
        onClick={handleClick}
      >
        {isMockVariant && node.user === "ali" && (
          <Avatar
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&dpr=2"
            size="sm"
            sx={{
              height: "18px",
              width: "18px",
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default NodeSquare;
