import * as React from "react";
import { Box, Sheet } from "@mui/joy";
import { useEffect, useRef, useState } from "react";

import "@xterm/xterm/css/xterm.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export default function LogViewer({ log }: { log?: string }) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon>(new FitAddon());

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
      scrollback: 5000,
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

  // Update terminal content when log changes
  useEffect(() => {
    if (terminal && log) {
      try {
        terminal.clear();

        // Split by any type of line break
        const lines = log.split(/\r\n|\r|\n/);
        for (const line of lines) {
          terminal.writeln(line);
        }
      } catch (e) {
        console.error("Error writing to terminal:", e);
      }
    }
  }, [log, terminal]);

  return (
    <Box
      sx={{
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#222",
        padding: 2,
      }}
    >
      <Sheet
        sx={{
          height: "100%",
          overflow: "auto",
          backgroundColor: "#222",
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
