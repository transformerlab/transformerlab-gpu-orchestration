import React from "react";
import {
  Box,
  Card,
  Typography,
  Stack,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/joy";
import { DollarSign, AlertTriangle, CheckCircle } from "lucide-react";

interface CostCreditsDisplayProps {
  estimatedCost: number;
  availableCredits: number | null;
  isLoading?: boolean;
  showWarning?: boolean;
  variant?: "card" | "inline";
  size?: "sm" | "md";
}

const CostCreditsDisplay: React.FC<CostCreditsDisplayProps> = ({
  estimatedCost,
  availableCredits,
  isLoading = false,
  showWarning = true,
  variant = "card",
  size = "md",
}) => {
  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          color: "text.secondary",
        }}
      >
        <CircularProgress size="sm" />
        <Typography level="body-sm">Loading cost information...</Typography>
      </Box>
    );
  }

  if (availableCredits === null) {
    return null;
  }

  const hasInsufficientCredits = estimatedCost > availableCredits;
  const costFormatted = estimatedCost > 0 ? estimatedCost.toFixed(2) : "0.00";
  const creditsFormatted = availableCredits.toFixed(2);

  if (variant === "inline") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DollarSign size={size === "sm" ? 14 : 16} />
          <Typography level={size === "sm" ? "body-xs" : "body-sm"}>
            Est. cost (1h): <strong>{costFormatted}</strong>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography level={size === "sm" ? "body-xs" : "body-sm"}>
            Credits remaining: <strong>{creditsFormatted}</strong>
          </Typography>
        </Box>
        {hasInsufficientCredits && showWarning && (
          <Chip
            size={size === "sm" ? "sm" : "md"}
            variant="soft"
            color="warning"
            startDecorator={<AlertTriangle size={size === "sm" ? 12 : 14} />}
          >
            Insufficient credits
          </Chip>
        )}
        {!hasInsufficientCredits && (
          <Chip
            size={size === "sm" ? "sm" : "md"}
            variant="soft"
            color="success"
            startDecorator={<CheckCircle size={size === "sm" ? 12 : 14} />}
          >
            Sufficient credits
          </Chip>
        )}
      </Box>
    );
  }

  return (
    <Card variant="soft" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <DollarSign size={16} />
        <Typography level="title-sm">Cost & Credits</Typography>
      </Stack>

      <Stack spacing={1}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography level="body-sm">Estimated Credits Used (1h):</Typography>
          <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
            {costFormatted}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography level="body-sm">Credits Available:</Typography>
          <Typography level="body-sm" sx={{ fontWeight: "bold" }}>
            {creditsFormatted}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography level="body-sm">Status:</Typography>
          {hasInsufficientCredits ? (
            <Chip
              size="sm"
              variant="soft"
              color="warning"
              startDecorator={<AlertTriangle size={12} />}
            >
              Insufficient credits
            </Chip>
          ) : (
            <Chip
              size="sm"
              variant="soft"
              color="success"
              startDecorator={<CheckCircle size={12} />}
            >
              Sufficient credits
            </Chip>
          )}
        </Box>
      </Stack>

      {hasInsufficientCredits && showWarning && (
        <Alert color="warning" sx={{ mt: 1 }}>
          <Typography level="body-sm">
            You don't have enough credits to launch this instance. Please add
            more credits or choose a cheaper configuration.
          </Typography>
        </Alert>
      )}
    </Card>
  );
};

export default CostCreditsDisplay;
