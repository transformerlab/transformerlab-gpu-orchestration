import React from "react";

// New GPU payload types to match the provided host shape
type GPUEntry = {
  gpu?: string;
  requestable_qty_per_node?: string;
  utilization?: string; // e.g., "1 of 2 free"
  free?: string; // e.g., "1"
  total?: string; // e.g., "2"
};

type HostPayload = {
  gpu_resources?: {
    gpus?: GPUEntry[];
  };
  // ...other possible fields...
};

type HostInfo = Record<string, HostPayload>;

interface MachineWithGPUSpriteProps {
  host: HostInfo;
  // If provided, these override inferred values
  totalGpus?: number;
  usedGpus?: number;
}

const MachineWithGPUSprite: React.FC<MachineWithGPUSpriteProps> = ({
  host,
  totalGpus,
  usedGpus,
}) => {
  const primary = "var(--joy-palette-primary-plainColor)";
  const onFill = "#83937a"; // Circley active fill
  const onStroke = "#bcccb3"; // Circley active stroke
  const offFill = "#edeade"; // Circley inactive fill
  const offStroke = "#cdcbc5ff"; // Circley inactive stroke
  const shadowCol = "#b3b3b127"; // subtle shadow
  const bg =
    "color-mix(in srgb, var(--joy-palette-background-level1), white 2%)"; // lighter background
  const text = "var(--joy-palette-primary-plainColor)"; // light gray text

  // Extract the IP from the new keyed host object
  const ip = host ? Object.keys(host)[0] : undefined;
  const label = ip ?? "unknown";

  // Helper to parse strings like "1 of 2 free"
  const parseUtilization = (s?: string): { free?: number; total?: number } => {
    if (!s) return {};
    const m = s.match(/(\d+)\s*of\s*(\d+)/i);
    if (!m) return {};
    return {
      free: Number.parseInt(m[1], 10),
      total: Number.parseInt(m[2], 10),
    };
    // Note: "1 of 2 free" is interpreted as 1 free, 2 total.
  };

  // Infer GPU totals from host if props are not provided
  const entries: GPUEntry[] = ip ? host[ip]?.gpu_resources?.gpus ?? [] : [];
  const inferred = entries.map((e) => {
    const util = parseUtilization(e.utilization);
    const totalParsed = Number.parseInt(e.total ?? "", 10);
    const freeParsed = Number.parseInt(e.free ?? "", 10);
    return {
      total: Number.isFinite(totalParsed) ? totalParsed : util.total ?? 0,
      free: Number.isFinite(freeParsed) ? freeParsed : util.free ?? 0,
    };
  });
  const inferredTotal =
    inferred.reduce((acc, cur) => acc + (cur.total || 0), 0) || 0;
  const inferredFree =
    inferred.reduce((acc, cur) => acc + (cur.free || 0), 0) || 0;

  const total =
    typeof totalGpus === "number" ? Math.max(0, totalGpus) : inferredTotal;
  const usedComputed = Math.max(0, total - inferredFree);
  const used =
    typeof usedGpus === "number"
      ? Math.min(Math.max(0, usedGpus), total)
      : usedComputed;

  // Build an array representing each GPU slot
  const gpuSlots = Array.from({ length: total || 0 }, (_, i) => i < used);

  return (
    <div
      style={{
        position: "relative",
        width: 160,
        padding: 12,
        borderRadius: 8,
        background: bg,
        filter: "sepia(8%)",
        border: `3px solid ${onStroke}`,
        color: text,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      }}
      title={`${label}`.trim()}
    >
      {/* <pre>{JSON.stringify(host, null, 2)}</pre> */}
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%", // Changed to make it a circle
            background: onFill,
            border: `2px solid ${onStroke}`,
          }}
        />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {label}
          </div>
        </div>
      </div>

      {/* GPU grid */}
      <div
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginTop: 6,
          paddingBottom: 2,
          opacity: 0.8,
        }}
      >
        {gpuSlots.length === 0 ? (
          <div style={{ fontSize: 11, opacity: 0.6 }}>No GPU</div>
        ) : (
          gpuSlots.map((isUsed, idx) => (
            <div
              key={idx}
              style={{
                width: 10,
                height: 22,
                borderRadius: 3,
                border: `2px solid ${isUsed ? onStroke : offStroke}`,
                background: isUsed ? onFill : offFill,
              }}
              title={isUsed ? "Occupied" : "Free"}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MachineWithGPUSprite;
