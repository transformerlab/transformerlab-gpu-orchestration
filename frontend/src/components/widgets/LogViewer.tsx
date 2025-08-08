import * as React from "react";
import Textarea from "@mui/joy/Textarea";

export interface LogViewerProps {
  log?: string;
}

export default function LogViewer({ log = "" }: LogViewerProps) {
  return (
    <Textarea
      value={log}
      readOnly
      minRows={20}
      maxRows={40}
      sx={{
        fontFamily: "monospace",
        fontSize: "0.875rem",
        backgroundColor: "background.level1",
      }}
    />
  );
}
