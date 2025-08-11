import React from "react";
import { Chip } from "@mui/joy";
import TinyCircle from "./TinyCircle";

type InstanceStatus =
  | "up"
  | "init"
  | "stopped"
  | "ClusterStatus.UP"
  | "ClusterStatus.INIT"
  | "ClusterStatus.STOPPED";

interface InstanceStatusChipProps {
  status: InstanceStatus;
}

function getCircleColor(status: InstanceStatus): string {
  console.log(status);
  switch (status) {
    case "up":
    case "ClusterStatus.UP":
      return "var(--joy-palette-success-400)";
    case "init":
    case "ClusterStatus.INIT":
      return "var(--joy-palette-primary-400)";
    case "stopped":
    case "ClusterStatus.STOPPED":
      return "var(--joy-palette-danger-600)";
    default:
      return "var(--joy-palette-neutral-400)";
  }
}

/**
 * A component that displays the status of an instance using a MUI Chip
 * with appropriate colors based on the status.
 */
const InstanceStatusChip: React.FC<InstanceStatusChipProps> = ({ status }) => {
  // Define color and label based on status
  const getStatusConfig = (status: InstanceStatus) => {
    switch (status) {
      case "up":
      case "ClusterStatus.UP":
        return {
          color: "success" as const,
          label: "Running",
        };
      case "init":
      case "ClusterStatus.INIT":
        return {
          color: "primary" as const,
          label: "Initializing",
        };
      case "stopped":
      case "ClusterStatus.STOPPED":
        return {
          color: "" as const,
          label: "Stopped",
        };
      default:
        return {
          color: "neutral" as const,
          label: "Unknown",
        };
    }
  };

  const { color, label } = getStatusConfig(status);

  return (
    <Chip
      variant="soft"
      color={color}
      size="sm"
      sx={{ borderRadius: "3px", padding: "4px 8px" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <TinyCircle size={5} color={getCircleColor(status)} />
        {label}
      </span>
    </Chip>
  );
};

export default InstanceStatusChip;
