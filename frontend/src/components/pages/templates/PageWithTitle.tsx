import React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";

interface PageWithTitleProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  button?: React.ReactNode;
  children?: React.ReactNode;
}

const PageWithTitle: React.FC<PageWithTitleProps> = ({
  title,
  subtitle,
  button,
  children,
}) => (
  <Box
    sx={{
      maxWidth: 1000,
      mx: "auto",
      p: 2,
    }}
  >
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

export default PageWithTitle;
