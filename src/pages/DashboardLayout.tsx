import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  UserCircle2,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

const menuItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/teams", label: "Mannschaften", icon: Volleyball },
  { to: "/dashboard/users", label: "Trainer & Spielerinnen", icon: Users },
  { to: "/dashboard/messages", label: "Nachrichten", icon: MessageSquare },
  { to: "/dashboard/profile", label: "Mein Profil", icon: UserCircle2 },
];

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = useAppStore((state) => state.logout);
  const fetchData = useAppStore((state) => state.fetchData);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const conversations = useAppStore((state) => state.conversations);
  const navigate = useNavigate();

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const unreadHint = conversations.length;

  useEffect(() => {
    void fetchData();
  }, [fetchData, currentUserId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#eef4ff] text-slate-900">
      {sidebarOpen ? (
        <button
          aria-label="Menue schliessen"
          className="fixed inset-0 z-30 bg-slate-950/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-blue-950/10 bg-gradient-to-b from-blue-950 via-blue-900 to-fuchsia-800 text-white shadow-2xl transition-transform duration-300 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200">
                Vereinsmanager
              </p>
              <p className="text-base font-semibold">SG Wiking Maedchenfussball</p>
            </div>
          </Link>
          <button
            className="rounded-xl p-2 text-blue-100 hover:bg-white/10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-sm text-blue-100">Angemeldet als</p>
          <p className="mt-1 text-lg font-semibold">{currentUser?.fullName}</p>
          <p className="mt-1 text-sm text-blue-200">
            {currentUser?.role === "admin"
              ? "Vereinsadmin"
              : currentUser?.role === "trainer"
                ? "Trainerin / Trainer"
                : "Spielerin"}
          </p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "bg-white text-blue-950 shadow-lg"
                      : "text-blue-100 hover:bg-white/10 hover:text-white",
                  )
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-blue-100 transition-all hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} />
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 shadow-sm md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Verwaltung
                </p>
                <h1 className="text-lg font-semibold text-slate-900">
                  Vereinsorganisation wie im Maintextildruck-Manager
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/dashboard/messages"
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Bell size={18} />
                <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-fuchsia-600 px-1 text-[11px] font-semibold text-white">
                  {unreadHint}
                </span>
              </Link>
              <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:block">
                <p className="text-sm font-medium text-slate-900">
                  {currentUser?.fullName}
                </p>
                <p className="text-xs text-slate-500">{currentUser?.email}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
