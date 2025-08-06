import { extendTheme } from "@mui/joy/styles";

export default extendTheme({
  fontFamily: {
    display: '-apple-system, "system-ui", var(--joy-fontFamily-fallback)',
    body: '-apple-system, "system-ui", var(--joy-fontFamily-fallback)',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          "50": "#f8fafc",
          "100": "#e6f2e6",
          "200": "#d1e6d1",
          "300": "#bcccb3", // lighter green
          "400": "#a3bfa3",
          "500": "#83937a", // mid dark green
          "600": "#6b7c65",
          "700": "#4e5c4a",
          "800": "#334033",
          "900": "#1a211a",
        },
        success: {
          "50": "#f0f4f8",
          "100": "#d9e2ec",
          "200": "#bcccdc",
          "300": "#9fb3c8",
          "400": "#829ab1",
          "500": "#3b4b59",
          "600": "#334155",
          "700": "#2d3748",
          "800": "#1a202c",
          "900": "#171923",
        },
        danger: {
          "50": "#fff7ed",
          "100": "#ffedd5",
          "200": "#fed7aa",
          "300": "#fdba74",
          "400": "#fb923c",
          "500": "#f97316",
          "600": "#ea580c",
          "700": "#c2410c",
          "800": "#9a3412",
          "900": "#7c2d12",
        },
        background: {
          body: "rgba(251, 251, 251, 1)",
        },
        text: {
          primary: "rgb(60, 60, 67)",
        },
      },
    },
    dark: {
      palette: {
        primary: {
          "50": "#f8fafc",
          "100": "#e6f2e6",
          "200": "#d1e6d1",
          "300": "#bcccb3", // lighter green
          "400": "#94a3b8",
          "500": "#64748b",
          "600": "#475569",
          "700": "#334155",
          "800": "#1e293b",
          "900": "#0f172a",
        },
      },
    },
  },
});
