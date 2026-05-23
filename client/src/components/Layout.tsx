import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, Ticket, Users, Moon, Sun, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
    ].join(" ");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="bg-card border-b h-[52px] flex items-center px-5 shrink-0 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-[13px] leading-none">H</span>
          </div>
          <span className="font-semibold text-[15px] text-foreground tracking-tight">Helpdesk</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutGrid className="h-[14px] w-[14px]" />
            Dashboard
          </NavLink>
          <NavLink to="/tickets" className={navLinkClass}>
            <Ticket className="h-[14px] w-[14px]" />
            Tickets
          </NavLink>
          {user.role === "ADMIN" && (
            <NavLink to="/users" className={navLinkClass}>
              <Users className="h-[14px] w-[14px]" />
              Users
            </NavLink>
          )}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <button
            onClick={handleSignOut}
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
