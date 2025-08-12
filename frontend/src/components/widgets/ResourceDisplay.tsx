import React from "react";
import { Box, Chip, Typography, Stack } from "@mui/joy";
import { Cpu, MemoryStick, HardDrive, Zap, Server } from "lucide-react";
import {
  ParsedResources,
  parseResourcesString,
} from "../../utils/resourceParser";

interface ResourceDisplayProps {
  resourcesStr: string;
  variant?: "compact" | "detailed" | "card";
  size?: "sm" | "md" | "lg";
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  resourcesStr,
  variant = "detailed",
  size = "md",
}) => {
  const parsed = parseResourcesString(resourcesStr);

  if (parsed.formatted === "-") {
    return (
      <Typography level="body-sm" color="neutral">
        -
      </Typography>
    );
  }

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 14;
      case "lg":
        return 20;
      default:
        return 16;
    }
  };

  const getChipSize = () => {
    switch (size) {
      case "sm":
        return "sm";
      case "lg":
        return "md";
      default:
        return "sm";
    }
  };

  const getTypographyLevel = () => {
    switch (size) {
      case "sm":
        return "body-xs";
      case "lg":
        return "body-md";
      default:
        return "body-sm";
    }
  };

  if (variant === "compact") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          flexWrap: "wrap",
        }}
      >
        {parsed.count && parsed.count > 1 && (
          <Chip
            size={getChipSize()}
            variant="soft"
            color="primary"
            sx={{ fontSize: "0.7rem", height: "20px" }}
          >
            {parsed.count}x
          </Chip>
        )}
        {parsed.cpus && (
          <Chip
            size={getChipSize()}
            variant="soft"
            color="neutral"
            startDecorator={<Cpu size={getIconSize()} />}
            sx={{ fontSize: "0.7rem", height: "20px" }}
          >
            {parsed.cpus}
          </Chip>
        )}
        {parsed.memory && (
          <Chip
            size={getChipSize()}
            variant="soft"
            color="neutral"
            startDecorator={<MemoryStick size={getIconSize()} />}
            sx={{ fontSize: "0.7rem", height: "20px" }}
          >
            {parsed.memory}G
          </Chip>
        )}
        {parsed.gpu && (
          <Chip
            size={getChipSize()}
            variant="soft"
            color="success"
            startDecorator={<Zap size={getIconSize()} />}
            sx={{ fontSize: "0.7rem", height: "20px" }}
          >
            {parsed.gpu}
          </Chip>
        )}
        {parsed.disk && (
          <Chip
            size={getChipSize()}
            variant="soft"
            color="neutral"
            startDecorator={<HardDrive size={getIconSize()} />}
            sx={{ fontSize: "0.7rem", height: "20px" }}
          >
            {parsed.disk}G
          </Chip>
        )}
      </Box>
    );
  }

  if (variant === "card") {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.level1",
        }}
      >
        <Stack spacing={1}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Server size={getIconSize()} />
            <Typography level={getTypographyLevel()} fontWeight="bold">
              Resources
            </Typography>
          </Box>
          <Stack spacing={0.5}>
            {parsed.count && parsed.count > 1 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ minWidth: "60px" }}
                >
                  Instances:
                </Typography>
                <Chip size="sm" variant="soft" color="primary">
                  {parsed.count}x
                </Chip>
              </Box>
            )}
            {parsed.cpus && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ minWidth: "60px" }}
                >
                  CPU:
                </Typography>
                <Chip
                  size="sm"
                  variant="soft"
                  color="neutral"
                  startDecorator={<Cpu size={14} />}
                >
                  {parsed.cpus} core{parsed.cpus > 1 ? "s" : ""}
                </Chip>
              </Box>
            )}
            {parsed.memory && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ minWidth: "60px" }}
                >
                  Memory:
                </Typography>
                <Chip
                  size="sm"
                  variant="soft"
                  color="neutral"
                  startDecorator={<MemoryStick size={14} />}
                >
                  {parsed.memory}GB RAM
                </Chip>
              </Box>
            )}
            {parsed.gpu && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ minWidth: "60px" }}
                >
                  GPU:
                </Typography>
                <Chip
                  size="sm"
                  variant="soft"
                  color="success"
                  startDecorator={<Zap size={14} />}
                >
                  {parsed.gpu}
                </Chip>
              </Box>
            )}
            {parsed.disk && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ minWidth: "60px" }}
                >
                  Storage:
                </Typography>
                <Chip
                  size="sm"
                  variant="soft"
                  color="neutral"
                  startDecorator={<HardDrive size={14} />}
                >
                  {parsed.disk}GB disk
                </Chip>
              </Box>
            )}
            {parsed.instanceName && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  level="body-xs"
                  color="neutral"
                  sx={{ minWidth: "60px" }}
                >
                  Instance:
                </Typography>
                <Chip size="sm" variant="outlined" color="neutral">
                  {parsed.instanceName}
                </Chip>
              </Box>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  }

  // Default detailed variant
  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
    >
      {parsed.count && parsed.count > 1 && (
        <Chip size={getChipSize()} variant="soft" color="primary">
          {parsed.count}x
        </Chip>
      )}
      {parsed.cpus && (
        <Chip
          size={getChipSize()}
          variant="soft"
          color="neutral"
          startDecorator={<Cpu size={getIconSize()} />}
        >
          {parsed.cpus} CPU{parsed.cpus > 1 ? "s" : ""}
        </Chip>
      )}
      {parsed.memory && (
        <Chip
          size={getChipSize()}
          variant="soft"
          color="neutral"
          startDecorator={<MemoryStick size={getIconSize()} />}
        >
          {parsed.memory}GB RAM
        </Chip>
      )}
      {parsed.gpu && (
        <Chip
          size={getChipSize()}
          variant="soft"
          color="success"
          startDecorator={<Zap size={getIconSize()} />}
        >
          {parsed.gpu}
        </Chip>
      )}
      {parsed.disk && (
        <Chip
          size={getChipSize()}
          variant="soft"
          color="neutral"
          startDecorator={<HardDrive size={getIconSize()} />}
        >
          {parsed.disk}GB disk
        </Chip>
      )}
    </Box>
  );
};

export default ResourceDisplay;
