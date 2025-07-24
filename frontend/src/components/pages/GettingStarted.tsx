import React, { useState, useEffect } from "react";
import { Box, Button, Card, Typography, Stack, Chip } from "@mui/joy";
import { Monitor, Plus, Settings } from "lucide-react";
import ClusterManagement from "../ClusterManagement";
import { buildApiUrl } from "../../utils/api";

const GettingStarted: React.FC = () => {
  const [clusters, setClusters] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<
    "welcome" | "create-cluster" | "manage-cluster"
  >("welcome");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClusters();
  }, []);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl("clusters"), {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setClusters(data.clusters);
        // If user has clusters, skip to management view
        if (data.clusters.length > 0) {
          setCurrentStep("manage-cluster");
        }
      }
    } catch (err) {
      console.error("Error fetching clusters:", err);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: "Create Your First Cluster",
      description: "Set up a new SkyPilot cluster to manage your SSH machines",
      icon: <Plus size={24} />,
      action: () => setCurrentStep("create-cluster"),
      completed: clusters.length > 0,
    },
    {
      title: "Add SSH Machines",
      description: "Connect your existing machines to the cluster",
      icon: <Monitor size={24} />,
      action: () => setCurrentStep("manage-cluster"),
      completed: false, // You can add logic to check if nodes exist
    },
    {
      title: "Configure SkyPilot",
      description: "Set up workloads and manage resources",
      icon: <Settings size={24} />,
      action: () => {}, // Placeholder for future features
      completed: false,
    },
  ];

  if (currentStep === "manage-cluster") {
    return <ClusterManagement />;
  }

  if (currentStep === "create-cluster") {
    return (
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Button
            variant="plain"
            onClick={() => setCurrentStep("welcome")}
            disabled={loading}
          >
            ← Back
          </Button>
          <Typography level="h3">Create New Cluster</Typography>
        </Box>
        <ClusterManagement />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
        p: 2,
      }}
    >
      {" "}
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" sx={{ mb: 1 }}>
          Welcome to SkyPilot Cluster Management
        </Typography>
        <Typography level="body-lg" sx={{ color: "text.secondary" }}>
          Get started by setting up your first cluster and adding SSH machines
        </Typography>
      </Box>
      {clusters.length > 0 && (
        <Card variant="soft" color="success" sx={{ mb: 3 }}>
          <Typography level="title-md" sx={{ mb: 1 }}>
            🎉 You have {clusters.length} cluster
            {clusters.length > 1 ? "s" : ""} configured!
          </Typography>
          <Button
            variant="solid"
            color="success"
            onClick={() => setCurrentStep("manage-cluster")}
          >
            Go to Cluster Management
          </Button>
        </Card>
      )}
      <Stack spacing={1}>
        {steps.map((step, index) => (
          <Card
            key={index}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: "md",
              border: "1px solid",
              borderColor: step.completed ? "success.300" : "neutral.300",
              bgcolor: step.completed ? "success.50" : "transparent",
              cursor: step.action !== undefined ? "pointer" : "default",
              transition: "all 0.2s",
              "&:hover":
                step.action !== undefined
                  ? {
                      borderColor: "primary.300",
                      bgcolor: "primary.50",
                    }
                  : {},
            }}
            onClick={step.action}
          >
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: "lg",
                  bgcolor: step.completed ? "success.100" : "primary.100",
                  color: step.completed ? "success.600" : "primary.600",
                }}
              >
                {step.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}
                >
                  <Typography level="title-lg">{step.title}</Typography>
                  {step.completed && (
                    <Chip variant="soft" color="success" size="sm">
                      ✓ Completed
                    </Chip>
                  )}
                </Box>
                <Typography level="body-md" sx={{ color: "text.secondary" }}>
                  {step.description}
                </Typography>
              </Box>
            </Box>
          </Card>
        ))}
      </Stack>
      {clusters.length === 0 && (
        <Card variant="soft" sx={{ mt: 2, textAlign: "center" }}>
          <Typography level="title-md" sx={{}}>
            Ready to get started?
          </Typography>
          <Button
            variant="solid"
            size="lg"
            startDecorator={<Plus size={20} />}
            onClick={() => setCurrentStep("create-cluster")}
          >
            Create Your First Cluster
          </Button>
        </Card>
      )}
    </Box>
  );
};

export default GettingStarted;
