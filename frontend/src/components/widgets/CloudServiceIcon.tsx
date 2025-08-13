import React from "react";
import AzureIcon from "./icons/azure.svg"; // Adjust the path as needed
import RunPodIcon from "./icons/runpod.svg"; // Adjust the path as needed
import { ServerIcon } from "lucide-react";

interface CloudServiceIconProps {
  platform: string;
}

const CloudServiceIcon: React.FC<CloudServiceIconProps> = ({ platform }) => {
  switch (platform) {
    case "azure":
      return (
        <img src={AzureIcon} alt="Azure" style={{ width: 16, height: 16 }} />
      );
    case "runpod":
      return (
        <img src={RunPodIcon} alt="RunPod" style={{ width: 16, height: 16 }} />
      );
    case "direct":
      return <ServerIcon size={16} />;
    default:
      return <ServerIcon size={16} />;
  }
};

export default CloudServiceIcon;
