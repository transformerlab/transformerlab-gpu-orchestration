import React from "react";
import {
  Box,
  Button,
  Card,
  Typography,
  FormControl,
  FormLabel,
  Textarea,
  Stack,
} from "@mui/joy";

interface YamlConfigurationSectionProps {
  useYaml: boolean;
  setUseYaml: (useYaml: boolean) => void;
  yamlContent: string;
  setYamlContent: (content: string) => void;
  yamlFile: File | null;
  setYamlFile: (file: File | null) => void;
  placeholder?: string;
  clusterName?: string;
}

const YamlConfigurationSection: React.FC<YamlConfigurationSectionProps> = ({
  useYaml,
  setUseYaml,
  yamlContent,
  setYamlContent,
  yamlFile,
  setYamlFile,
  placeholder,
  clusterName,
}) => {
  const defaultPlaceholder = `# Example YAML configuration:
cluster_name: my-cluster
command: echo "Hello World"
setup: pip install torch
cpus: 4
memory: 16
cloud: ssh
node_pool_name: ${clusterName || "your-node-pool"}`;

  return (
    <>
      {/* Configuration Mode Toggle */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
          p: 1,
          border: "1px solid var(--joy-palette-neutral-300)",
          borderRadius: "var(--joy-radius-md)",
          backgroundColor: "var(--joy-palette-neutral-50)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "var(--joy-palette-background-surface)",
            borderRadius: "var(--joy-radius-lg)",
            p: 0.5,
            position: "relative",
          }}
        >
          {/* Form Mode Button */}
          <Button
            variant={!useYaml ? "solid" : "plain"}
            color={!useYaml ? "primary" : "neutral"}
            size="sm"
            onClick={() => {
              setUseYaml(false);
              setYamlContent("");
              setYamlFile(null);
            }}
            sx={{
              minWidth: 100,
              borderRadius: "var(--joy-radius-lg)",
              fontWeight: !useYaml ? 600 : 400,
            }}
          >
            General
          </Button>

          {/* YAML Mode Button */}
          <Button
            variant={useYaml ? "solid" : "plain"}
            color={useYaml ? "primary" : "neutral"}
            size="sm"
            onClick={() => setUseYaml(true)}
            sx={{
              minWidth: 100,
              borderRadius: "var(--joy-radius-lg)",
              fontWeight: useYaml ? 600 : 400,
            }}
          >
            YAML
          </Button>
        </Box>
      </Box>

      {/* YAML Configuration Section */}
      {useYaml && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <Typography level="title-sm" sx={{ mb: 2 }}>
            YAML Configuration
          </Typography>
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>YAML File (optional)</FormLabel>
              <input
                type="file"
                accept=".yaml,.yml"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setYamlFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const content = e.target?.result as string;
                      setYamlContent(content);
                    };
                    reader.readAsText(file);
                  }
                }}
                style={{
                  padding: "8px",
                  border: "1px solid var(--joy-palette-neutral-300)",
                  borderRadius: "var(--joy-radius-sm)",
                  width: "100%",
                }}
              />
              <Typography
                level="body-xs"
                sx={{ mt: 0.5, color: "text.secondary" }}
              >
                Upload a YAML file or paste content below
              </Typography>
            </FormControl>

            <FormControl>
              <FormLabel>YAML Content</FormLabel>
              <Textarea
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                placeholder={placeholder || defaultPlaceholder}
                minRows={8}
                maxRows={15}
                sx={{
                  fontFamily: "monospace",
                  maxHeight: "300px",
                  overflowY: "auto",
                  resize: "vertical",
                }}
              />
              <Typography
                level="body-xs"
                sx={{ mt: 0.5, color: "text.secondary" }}
              >
                Paste or edit your YAML configuration here
              </Typography>
            </FormControl>
          </Stack>
        </Card>
      )}
    </>
  );
};

export default YamlConfigurationSection;
