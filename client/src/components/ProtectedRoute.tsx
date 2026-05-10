import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute() {
  // Auth check will be wired up in Phase 2
  return <Outlet />;
}
