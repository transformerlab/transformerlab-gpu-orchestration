import { Node } from "../ClusterCard";

export const getStatusOrder = (
  status: string,
  type: string,
  nodeUser?: string,
  currentUser?: string,
): number => {
  let sort1 = 0;
  let sort2 = 0;
  let sort3 = 0;

  // First priority: nodes owned by current user (highest priority)
  if (nodeUser === currentUser) sort1 = 1;
  else sort1 = 2;

  // Second priority: by type
  if (type === "dedicated") sort2 = 1;
  if (type === "on-demand") sort2 = 2;

  // Third priority: by status
  if (status === "active") sort3 = 1;
  if (status === "inactive") sort3 = 2;
  if (status === "unhealthy") sort3 = 3;

  return sort1 * 100 + sort2 * 10 + sort3;
};

export const gpuTypes = [
  "NVIDIA A100",
  "NVIDIA V100",
  "NVIDIA T4",
  "NVIDIA RTX 3090",
  "NVIDIA H100",
];

export const cpuTypes = [
  "Intel Xeon Gold 6248",
  "AMD EPYC 7742",
  "Intel Core i9-12900K",
  "AMD Ryzen 9 5950X",
];

export const jobNames = [
  "ImageNet Training",
  "Text Generation",
  "GAN Experiment",
  "RL Agent",
  "Protein Folding",
];

export const experimentNames = [
  "Exp-Alpha",
  "Exp-Beta",
  "Exp-Gamma",
  "Exp-Delta",
  "Exp-Epsilon",
];

export function randomIp() {
  return `10.${Math.floor(Math.random() * 256)}.${Math.floor(
    Math.random() * 256,
  )}.${Math.floor(Math.random() * 256)}`;
}

export const generateRandomNodes = (
  count: number,
  currentUser?: string,
): Node[] => {
  const users = [currentUser || "ali", "bob", "catherine"];
  const types: ("dedicated" | "on-demand")[] = ["dedicated", "on-demand"];

  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const statusRand = Math.random();
    let status: "active" | "inactive" | "unhealthy";
    let user: string | undefined;
    let jobName: string | undefined;
    let experimentName: string | undefined;

    if (statusRand < 0.6) {
      status = "active";
      // Assign user if active
      if (Math.random() < 0.7) {
        user = users[Math.floor(Math.random() * users.length)];
        jobName = jobNames[Math.floor(Math.random() * jobNames.length)];
        experimentName =
          experimentNames[Math.floor(Math.random() * experimentNames.length)];
      }
    } else if (statusRand < 0.9) {
      status = "inactive";
    } else {
      status = "unhealthy";
    }

    const gpuType = gpuTypes[Math.floor(Math.random() * gpuTypes.length)];
    const cpuType = cpuTypes[Math.floor(Math.random() * cpuTypes.length)];
    const vcpus = [4, 8, 16, 32, 64][Math.floor(Math.random() * 5)];
    const vgpus = [1, 2, 4, 8][Math.floor(Math.random() * 4)];
    const ip = randomIp();

    return {
      id: `node-${i}`,
      type,
      status,
      ...(user ? { user } : {}),
      ...(jobName ? { jobName } : {}),
      ...(experimentName ? { experimentName } : {}),
      gpuType,
      cpuType,
      vcpus,
      vgpus,
      ip,
    };
  });
};

// Generate dedicated nodes
export const generateDedicatedNodes = (
  count: number,
  activeCount: number = 0,
  currentUser?: string,
): Node[] => {
  return Array.from({ length: count }, (_, i) => {
    // Only the first 'activeCount' nodes should be active
    const status: "active" | "inactive" | "unhealthy" =
      i < activeCount ? "active" : "inactive";
    let user: string | undefined;
    let jobName: string | undefined;
    let experimentName: string | undefined;

    // If active, assign to current user (not random)
    if (status === "active") {
      user = currentUser || "ali";
      jobName = jobNames[Math.floor(Math.random() * jobNames.length)];
      experimentName =
        experimentNames[Math.floor(Math.random() * experimentNames.length)];
    }

    const gpuType = gpuTypes[Math.floor(Math.random() * gpuTypes.length)];
    const cpuType = cpuTypes[Math.floor(Math.random() * cpuTypes.length)];
    const vcpus = [4, 8, 16, 32, 64][Math.floor(Math.random() * 5)];
    const vgpus = [1, 2, 4, 8][Math.floor(Math.random() * 4)];

    return {
      id: `dedicated-node-${i}`,
      type: "dedicated",
      status,
      ...(user ? { user } : {}),
      ...(jobName ? { jobName } : {}),
      ...(experimentName ? { experimentName } : {}),
      gpuType,
      cpuType,
      vcpus,
      vgpus,
      ip: "", // Empty IP for Real clusters
    };
  });
};
