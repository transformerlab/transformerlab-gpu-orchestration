import React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import Breadcrumb from "../../../context/Breadcrumb";

interface PageWithTitleProps {
  title: string;
  subtitle?: string;
  button?: React.ReactNode;
  breadcrumbItems?: Array<{ label: string; path?: string }>;
  showBreadcrumbs?: boolean; // New prop to control breadcrumb visibility
  children: React.ReactNode;
}

const PageWithTitle: React.FC<PageWithTitleProps> = ({
  title,
  subtitle,
  button,
  breadcrumbItems,
  showBreadcrumbs = true, // Default to true
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
      {/* {showBreadcrumbs && <Breadcrumb items={breadcrumbItems} />} */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Box sx={{ mb: 4 }}>
          <Typography level="h2" sx={{ mb: 0.5 }}>
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
