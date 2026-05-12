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
      <nav className="bg-blue-600 px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-white">Helpdesk</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{user.name}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-white border border-white px-3 py-1 rounded hover:bg-white hover:text-gray-900 transition-colors"
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
