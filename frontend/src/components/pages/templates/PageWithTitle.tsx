import React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Breadcrumb from "../../../context/Breadcrumb";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@mui/joy";

interface PageWithTitleProps {
  title: string;
  subtitle?: string;
  button?: React.ReactNode;
  breadcrumbItems?: Array<{ label: string; path?: string }>;
  showBreadcrumbs?: boolean; // New prop to control breadcrumb visibility
  backButton?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}

const PageWithTitle: React.FC<PageWithTitleProps> = ({
  title,
  subtitle,
  button,
  breadcrumbItems,
  showBreadcrumbs = false, // Default to true
  backButton = false,
  onBack,
  children,
}) => {
  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        px: 2,
      }}
    >
      {showBreadcrumbs && <Breadcrumb items={breadcrumbItems} />}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography
            level="h2"
            sx={{ mb: 0.5 }}
            startDecorator={
              backButton ? (
                <Button
                  onClick={onBack}
                  variant="plain"
                  size="sm"
                  sx={{ minWidth: "auto", padding: "0 8px" }}
                >
                  <ChevronLeftIcon />
                </Button>
              ) : null
            }
          >
            {title}
          </Typography>
          {subtitle && <Typography level="body-lg">{subtitle}</Typography>}
        </Box>{" "}
        {button}
      </Box>

      {children}
    </Box>
  );
};

export default PageWithTitle;
