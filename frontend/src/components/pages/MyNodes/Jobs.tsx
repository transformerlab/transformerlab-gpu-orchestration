import React from "react";
import { Typography, Box, Table, CircularProgress, Chip } from "@mui/joy";

interface Job {
  id: string;
  name: string;
  status: string;
  experiment: string;
  nodes: number; // Add nodes property
}

interface Cluster {
  cluster_name: string;
  status: string;
  resources_str?: string;
  launched_at?: number;
  jobs?: Job[]; // Add jobs property
}

interface HeldProps {
  skypilotLoading: boolean;
  myClusters: Cluster[];
}

const fakeClusters: Cluster[] = [
  {
    cluster_name: "Azure Cloud",
    status: "active",
    resources_str: "8 CPUs, 32GB RAM",
    launched_at: Math.floor(Date.now() / 1000) - 3600,
    jobs: [
      {
        id: "job1",
        name: "Data Preprocessing",
        status: "running",
        experiment: "Alpha",
        nodes: 4,
      },
      {
        id: "job2",
        name: "Model Training",
        status: "setting up",
        experiment: "Beta",
        nodes: 10,
      },
    ],
  },
  {
    cluster_name: "On Premesis",
    status: "inactive",
    resources_str: "16 CPUs, 64GB RAM",
    launched_at: Math.floor(Date.now() / 1000) - 7200,
    jobs: [
      {
        id: "job3",
        name: "ETL Pipeline",
        status: "not started",
        experiment: "Exp A",
        nodes: 7,
      },
    ],
  },
];

// Helper: group jobs by experiment
function groupJobsByExperiment(clusters: Cluster[]) {
  const experimentMap: { [exp: string]: { cluster: Cluster; job: Job }[] } = {};
  clusters.forEach((cluster) => {
    cluster.jobs?.forEach((job) => {
      if (!experimentMap[job.experiment]) experimentMap[job.experiment] = [];
      experimentMap[job.experiment].push({ cluster, job });
    });
  });
  return experimentMap;
}

const nodeColors = [
  "#10b981", // emerald-500 (green)
  "#3b82f6", // blue-500 (blue)
  "#10b981", // emerald-500 (green, repeated)
  "#3b82f6", // blue-500 (blue, repeated)
  "#10b981", // emerald-500 (green, repeated)
  "#3b82f6", // blue-500 (blue, repeated)
  "#6b7280", // gray-500
  "#ef4444", // red-500
];

const getRandomNodeColor = () => {
  const idx = Math.floor(Math.random() * nodeColors.length);
  return nodeColors[idx];
};

const Held: React.FC<HeldProps> = ({ skypilotLoading }) => {
  const clustersToShow = fakeClusters;
  const jobsByExperiment = groupJobsByExperiment(clustersToShow);

  return (
    <>
      {skypilotLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        Object.entries(jobsByExperiment).map(([experiment, jobs]) => (
          <Box key={experiment} sx={{ mb: 4 }}>
            <Typography level="h3" sx={{ mb: 1 }}>
              {experiment}
            </Typography>
            <Table
              variant="outlined"
              sx={{ minWidth: 650, mb: 2 }}
              aria-label={`jobs table for ${experiment}`}
            >
              <thead>
                <tr>
                  <th>Cluster Name</th>
                  <th>Status</th>
                  <th>Resources</th>
                  <th>Launched At</th>
                  <th>Job Name</th>
                  <th>Nodes</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(({ cluster, job }) => (
                  <tr key={job.id}>
                    <td>{cluster.cluster_name}</td>
                    <td>
                      <Chip
                        color={job.status === "running" ? "success" : "neutral"}
                      >
                        {job.status}
                      </Chip>
                    </td>
                    <td>{cluster.resources_str || "-"}</td>
                    <td>
                      {cluster.launched_at
                        ? new Date(cluster.launched_at * 1000).toLocaleString()
                        : "-"}
                    </td>
                    <td>{job.name}</td>
                    <td>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          maxWidth: 120,
                        }}
                      >
                        {Array.from({ length: job.nodes }).map((_, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              width: 16,
                              height: 16,
                              bgcolor: getRandomNodeColor(),
                              border: "1px solid",
                              borderColor: "neutral.outlinedBorder",
                              borderRadius: "4px",
                              display: "inline-block",
                            }}
                          />
                        ))}
                      </Box>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Box>
        ))
      )}
    </>
  );
};

export default Held;
