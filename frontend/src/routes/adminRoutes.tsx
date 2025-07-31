import { Routes, Route } from "react-router-dom";
import Users from "../components/admin/Users";
import Teams from "../components/admin/Teams";
import SSHClusterAdmin from "../components/admin/SSHClusterAdmin";
import RunPodAdmin from "../components/admin/RunPodAdmin";
import IdentityFileManager from "../components/admin/IdentityFileManager";
import ObjectStorage from "../components/admin/ObjectStorage";
import PageWithTitle from "../components/common/PageWithTitle";

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/users" element={<Users />} />
      <Route path="/teams" element={<Teams />} />
      <Route path="/clouds" element={<SSHClusterAdmin />} />
      <Route path="/runpod" element={<RunPodAdmin />} />
      <Route path="/identity" element={<IdentityFileManager />} />
      <Route path="/object-storage" element={<ObjectStorage />} />
      <Route 
        path="/volumes" 
        element={
          <PageWithTitle
            title="Volumes"
            subtitle="Manage volume mounts and storage."
          />
        } 
      />
      <Route 
        path="/settings" 
        element={
          <PageWithTitle
            title="Settings"
            subtitle="Configure admin settings."
          />
        } 
      />
    </Routes>
  );
}
