import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TicketsPage from "./pages/TicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { api } from "./lib/api";

export default function App() {
  const [health, setHealth] = useState("checking...");

  useEffect(() => {
    api.get<{ status: string }>("/health")
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("unreachable"));
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          <div style={{ padding: 24 }}>
            <h1 style={{ fontWeight: 700, fontSize: 32, margin: 0 }}>Helpdesk</h1>
            <p style={{ margin: "8px 0 0", fontSize: 16 }}>Server status: {health}</p>
          </div>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
