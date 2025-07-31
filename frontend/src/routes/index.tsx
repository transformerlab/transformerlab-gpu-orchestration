import { Routes, Route } from "react-router-dom";
import AdminRoutes from "./adminRoutes";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Other dashboard routes */}
      <Route path="/dashboard/nodes" element={<div>Node Pool</div>} />
      <Route path="/dashboard/my-clusters" element={<div>My Clusters</div>} />
      <Route path="/dashboard/jobs" element={<div>Jobs</div>} />
      <Route path="/dashboard/reports" element={<div>Reports</div>} />
      
      {/* Admin routes */}
      <Route path="/dashboard/admin/*" element={<AdminRoutes />} />
    </Routes>
  );
}
