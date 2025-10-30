import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Box,
  Button,
  Textarea,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/joy";
import { Copy, ExternalLink, CheckCircle } from "lucide-react";
import { apiFetch, buildApiUrl } from "../../utils/api";

interface VSCodeInfoModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string;
  jobId: number;
}

interface VSCodeTunnelInfo {
  auth_code?: string;
  tunnel_url?: string;
  is_ready: boolean;
  status: "loading" | "ready" | "error";
}

const VSCodeInfoModal: React.FC<VSCodeInfoModalProps> = ({
  open,
  onClose,
  clusterName,
  jobId,
}) => {
  const [tunnelInfo, setTunnelInfo] = useState<VSCodeTunnelInfo>({
    is_ready: false,
    status: "loading",
  });
  const [copied, setCopied] = useState<"auth_code" | "tunnel_url" | null>(null);

  // Fetch VSCode tunnel info
  const fetchTunnelInfo = async () => {
    try {
      const response = await apiFetch(
        buildApiUrl(`jobs/${clusterName}/${jobId}/vscode-info`),
        {
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("VSCode tunnel info received:", data);
        setTunnelInfo({
          auth_code: data.auth_code,
          tunnel_url: data.tunnel_url,
          is_ready: data.is_ready,
          status: data.is_ready ? "ready" : "loading",
        });
      } else {
        console.error("Failed to fetch VSCode tunnel info:", response.status);
        setTunnelInfo((prev) => ({ ...prev, status: "error" }));
      }
    } catch (error) {
      console.error("Error fetching VSCode tunnel info:", error);
      setTunnelInfo((prev) => ({ ...prev, status: "error" }));
    }
  };

  // Poll for updates every 5 seconds
  useEffect(() => {
    if (!open) return;

    fetchTunnelInfo();
    const interval = setInterval(fetchTunnelInfo, 5000);

    return () => clearInterval(interval);
  }, [open, clusterName, jobId]);

  const copyToClipboard = async (
    text: string,
    type: "auth_code" | "tunnel_url",
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const openVSCode = () => {
    if (tunnelInfo.tunnel_url) {
      window.open(tunnelInfo.tunnel_url, "_blank");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog size="md" sx={{ maxWidth: 600 }}>
        <ModalClose />
        <Typography level="h4" component="h2" sx={{ mb: 2 }}>
          VSCode Tunnel Connection
        </Typography>

        {tunnelInfo.status === "loading" && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography level="body-sm" color="neutral">
              Setting up VSCode tunnel...
            </Typography>
            <Typography level="body-xs" color="neutral" sx={{ mt: 1 }}>
              This may take a few moments. The tunnel will be ready shortly.
            </Typography>
          </Box>
        )}

        {tunnelInfo.status === "error" && (
          <Alert color="danger" sx={{ mb: 2 }}>
            Failed to get VSCode tunnel information. Please check the job logs.
          </Alert>
        )}

        {(tunnelInfo.status === "ready" || tunnelInfo.auth_code) && (
          <Box>
            {/* Auth Code Section */}
            {tunnelInfo.auth_code && (
              <Box sx={{ mb: 3 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Step 1: Authenticate with GitHub
                </Typography>
                <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                  Go to{" "}
                  <a
                    href="https://github.com/login/device"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "inherit", textDecoration: "underline" }}
                  >
                    https://github.com/login/device
                  </a>{" "}
                  and enter this code:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Textarea
                    value={tunnelInfo.auth_code}
                    readOnly
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      textAlign: "center",
                      flex: 1,
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(tunnelInfo.auth_code!, "auth_code")
                    }
                  >
                    {copied === "auth_code" ? (
                      <>
                        <CheckCircle size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy
                      </>
                    )}
                  </Button>
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Tunnel URL Section */}
            {tunnelInfo.tunnel_url && (
              <Box sx={{ mb: 3 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Step 2: Connect to VSCode
                </Typography>
                <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
                  Once you've authenticated, click the button below to open
                  VSCode:
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Textarea
                    value={tunnelInfo.tunnel_url}
                    readOnly
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                      flex: 1,
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(tunnelInfo.tunnel_url!, "tunnel_url")
                    }
                  >
                    {copied === "tunnel_url" ? (
                      <>
                        <CheckCircle size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy
                      </>
                    )}
                  </Button>
                </Box>
                <Button
                  variant="solid"
                  color="primary"
                  size="lg"
                  onClick={openVSCode}
                  sx={{ mt: 2, width: "100%" }}
                >
                  <ExternalLink size={20} />
                  Open VSCode
                </Button>
              </Box>
            )}

            <Alert color="success" sx={{ mt: 2 }}>
              ✅ VSCode tunnel is ready! You can now connect to your remote
              development environment.
            </Alert>
          </Box>
        )}

        <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};

export default VSCodeInfoModal;
