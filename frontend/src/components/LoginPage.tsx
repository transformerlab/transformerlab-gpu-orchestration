import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/joy";
import axios from "axios";
import logo from "../logo.png";

// Use relative API base URL - this will work regardless of host/port
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "/api/v1";

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the login URL from the backend using the environment variable
      const response = await axios.get(`${apiBaseUrl}/auth/login-url`, {
        withCredentials: true,
      });

      // Debug output: log the full API response
      console.debug("Login API response:", response);
      console.debug("Login API response data:", response.data);

      // Redirect to the WorkOS login URL
      window.location.href = response.data.login_url;
    } catch (err) {
      setError("Failed to initiate login. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.surface",
        p: 2,
      }}
    >
      <Card
        variant="outlined"
        sx={{
          maxWidth: 400,
          width: "100%",
          p: 4,
          textAlign: "center",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <img
            src={logo}
            alt="Lattice Logo"
            style={{ width: 128, height: 128 }}
          />
        </Box>
        <Typography level="h2" sx={{ mb: 1 }}>
          Lattice
        </Typography>
        <Typography level="body-md" sx={{ mb: 3, color: "text.secondary" }}>
          Distributed computing for AI
        </Typography>

        {error && (
          <Alert color="danger" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="solid"
          color="primary"
          size="lg"
          onClick={handleLogin}
          disabled={loading}
          sx={{ width: "100%" }}
        >
          {loading ? (
            <>
              <CircularProgress size="sm" sx={{ mr: 1 }} />
              Connecting...
            </>
          ) : (
            "Sign in with WorkOS"
          )}
        </Button>
      </Card>
    </Box>
  );
};

export default LoginPage;
