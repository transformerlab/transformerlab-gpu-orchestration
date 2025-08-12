import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Box,
  CircularProgress,
} from "@mui/joy";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { buildApiUrl, apiFetch } from "../../utils/api";

interface SSHModalProps {
  open: boolean;
  onClose: () => void;
  clusterName: string | null;
}

interface TerminalSession {
  session_id: string;
  hostname: string;
  port: number;
  username: string;
}

const SSHModal: React.FC<SSHModalProps> = ({ open, onClose, clusterName }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<TerminalSession | null>(null);
  const fitAddonRef = useRef<FitAddon>(new FitAddon());

  useEffect(() => {
    if (open && clusterName && !session) {
      // Add a small delay to ensure the modal is fully rendered
      setTimeout(() => {
        initializeTerminal();
      }, 100);
    }
  }, [open, clusterName, session]);

  const handleResize = () => {
    if (fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (socket) {
        socket.close();
      }
      if (terminal) {
        terminal.dispose();
      }
    };
  }, []);

  const initializeTerminal = async () => {
    if (!clusterName || !terminalRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = buildApiUrl(
        `terminal/session?cluster_name=${encodeURIComponent(clusterName)}`
      );

      // Get terminal session
      const response = await apiFetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get terminal session: ${response.statusText}`
        );
      }

      const sessionData: TerminalSession = await response.json();
      setSession(sessionData);

      // Initialize terminal
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "monospace",
        theme: {
          background: "#1e1e1e",
          foreground: "#ffffff",
        },
        convertEol: true,
        scrollback: 5000,
      });

      term.loadAddon(fitAddonRef.current);
      term.open(terminalRef.current);
      setTerminal(term);

      // Fit terminal to container
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.error("Failed to fit terminal:", e);
        }
      }, 100);

      // Connect to WebSocket
      const wsUrl = `ws://localhost:8000/api/v1/terminal/ws/${sessionData.session_id}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        term.writeln(`Connected to ${clusterName}`);
        setLoading(false);
      };

      ws.onmessage = (event) => {
        try {
          const decodedData = atob(event.data); // Decode Base64 data
          term.write(decodedData);
        } catch (e) {
          console.error("Error decoding WebSocket data:", e);
        }
      };

      ws.onclose = () => {
        term.writeln("Connection closed");
        setLoading(false);
      };

      ws.onerror = (error) => {
        term.writeln("WebSocket error: " + JSON.stringify(error));
        setError("Failed to connect to terminal");
        setLoading(false);
      };

      // Handle terminal input
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(btoa(data)); // Encode input as Base64
        }
      });

      setSocket(ws);
    } catch (err) {
      console.error("Error initializing terminal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initialize terminal"
      );
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
    if (terminal) {
      terminal.dispose();
      setTerminal(null);
    }
    // Clean up any stray xterm DOM nodes
    const xtermElements = document.getElementsByClassName("xterm");
    if (xtermElements.length > 0) {
      Array.from(xtermElements).forEach((el) => el.remove());
    }
    setSession(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        size="lg"
        sx={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: "100%",
          height: "100%",
        }}
      >
        <ModalClose onClick={handleClose} />
        <Typography level="h4" sx={{ mb: 2 }}>
          SSH Terminal
        </Typography>

        {error && <Box sx={{ color: "danger.500", mb: 2 }}>Error: {error}</Box>}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        <Box
          ref={terminalRef}
          sx={{
            height: "70vh",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
          }}
        />
      </ModalDialog>
    </Modal>
  );
};

export default SSHModal;
