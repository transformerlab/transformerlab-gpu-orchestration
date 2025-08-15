import React from "react";
import AzureIcon from "./icons/azure.svg"; // Adjust the path as needed
import RunPodIcon from "./icons/runpod.svg"; // Adjust the path as needed
import { ServerIcon } from "lucide-react";

interface CloudServiceIconProps {
  platform: string;
  bw?: boolean; // Optional prop for black and white filter
}

const CloudServiceIcon: React.FC<CloudServiceIconProps> = ({
  platform,
  bw = false,
}) => {
  const filterStyle = bw ? { filter: "grayscale(100%)" } : {};

  switch (platform) {
    case "azure":
      return (
        <img
          src={AzureIcon}
          alt="Azure"
          style={{ width: 16, height: 16, ...filterStyle }}
        />
      );
    case "runpod":
      return (
        <img
          src={RunPodIcon}
          alt="RunPod"
          style={{ width: 16, height: 16, ...filterStyle }}
        />
      );
    case "direct":
      return <ServerIcon size={16} style={filterStyle} />;
    default:
      return <ServerIcon size={16} style={filterStyle} />;
  }
};

export default CloudServiceIcon;
