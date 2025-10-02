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
  sticky?: boolean; // keep the title row pinned to the top
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
  sticky = false,
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
          gap: 2,
          flexWrap: { xs: "wrap", sm: "wrap", md: "nowrap" }, // Wrap on small screens, no wrap on larger screens
          ...(sticky && {
            position: "sticky",
            top: 0,
            zIndex: 900,
            bgcolor: "background.body",
            // optional: add a subtle divider when stuck
            // borderBottom: "1px solid",
            // borderColor: "divider",
            py: 1,
          }),
        }}
      >
        <Box sx={{ mb: 1 }}>
          {" "}
          {/* Adjust margin for responsiveness */}
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
        </Box>
        <Box
          sx={{
            mb: { xs: 2, sm: 2, md: 4 }, // Adjust margin for responsiveness
            textAlign: { xs: "left", sm: "right" }, // Align left on small screens, right on larger screens
          }}
        >
          {button}
        </Box>
      </Box>
      {children}
    </Box>
  );
};

export default PageWithTitle;
