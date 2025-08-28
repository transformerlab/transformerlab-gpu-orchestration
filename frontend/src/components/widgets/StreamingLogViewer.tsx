import * as React from "react";
import { Box, Sheet } from "@mui/joy";
import { useEffect, useRef, useState } from "react";

import "@xterm/xterm/css/xterm.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

interface StreamingLogViewerProps {
  logs: string[];
  isLoading?: boolean;
  onNewLog?: (log: string) => void;
}

export default function StreamingLogViewer({
  logs,
  isLoading = false,
  onNewLog,
}: StreamingLogViewerProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon>(new FitAddon());
  const lastLogCountRef = useRef(0);

  function handleResize() {
    if (fitAddonRef.current) {
      try {
        fitAddonRef.current.fit();
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    }
  }

  // Initialize terminal
  useEffect(() => {
    // Clean up any stray xterm DOM nodes before creating a new one
    const xtermElements = document.getElementsByClassName("xterm");
    if (xtermElements.length > 0) {
      Array.from(xtermElements).forEach((el) => el.remove());
    }

    // Create a new terminal instance
    const term = new Terminal({
      convertEol: true,
      scrollback: 10000, // More scrollback for streaming logs
      fontSize: 14,
      fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selection: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
    });

    term.loadAddon(fitAddonRef.current);

    if (terminalRef.current) {
      term.open(terminalRef.current);

      // Wait a bit for terminal to initialize before fitting
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.error("Failed to fit terminal during init:", e);
        }
      }, 100);
    }

    setTerminal(term);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      setTerminal(null);
    };
  }, []);

  // Handle streaming logs - append new logs without clearing
  useEffect(() => {
    if (terminal && logs.length > lastLogCountRef.current) {
      try {
        // Only write new logs (from the last count to the end)
        for (let i = lastLogCountRef.current; i < logs.length; i++) {
          const log = logs[i];
          if (log) {
            terminal.writeln(log);
          }
        }
        lastLogCountRef.current = logs.length;
      } catch (e) {
        console.error("Error writing to terminal:", e);
      }
    }
  }, [logs, terminal]);

  // Reset log count when logs array is cleared
  useEffect(() => {
    if (logs.length === 0) {
      lastLogCountRef.current = 0;
      if (terminal) {
        terminal.clear();
      }
    }
  }, [logs.length, terminal]);

  // Show loading indicator
  useEffect(() => {
    if (terminal && isLoading && logs.length === 0) {
      terminal.writeln("Loading logs...");
    }
  }, [isLoading, logs.length, terminal]);

  return (
    <Box
      sx={{
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
        padding: 2,
      }}
    >
      <Sheet
        sx={{
          height: "100%",
          overflow: "auto",
          backgroundColor: "#1e1e1e",
          // Custom scrollbar styles
          "&::-webkit-scrollbar": {
            width: "6px",
            background: "#000",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#444",
            borderRadius: "3px",
          },
          "&": {
            scrollbarWidth: "thin",
            scrollbarColor: "#444 #000",
          },
        }}
        ref={terminalRef}
      />
    </Box>
  );
}
