import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-foreground">Helpdesk</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-foreground border px-3 py-1 rounded hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
