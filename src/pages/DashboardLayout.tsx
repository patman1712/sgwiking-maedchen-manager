import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Briefcase,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Shield,
  ShieldCheck,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

const menuItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/teams", label: "Mannschaften", icon: Volleyball },
  { to: "__members__", label: "Mitglieder", icon: Users },
  { to: "/dashboard/messages", label: "Nachrichten", icon: MessageSquare },
] as const;

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamsMenuOpen, setTeamsMenuOpen] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [membersMenuOpen, setMembersMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const logout = useAppStore((state) => state.logout);
  const fetchData = useAppStore((state) => state.fetchData);
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const settings = useAppStore((state) => state.settings);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const conversations = useAppStore((state) => state.conversations);
  const messages = useAppStore((state) => state.messages);
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingToast, setIncomingToast] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const latestMessageIdRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const canViewMemberLists =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const keepsCollapsedTeamMenus =
    currentUser?.role === "admin" || currentUser?.role === "board";

  const visibleTeams = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return teams;
    }

    return teams.filter((team) => currentUser.teamIds.includes(team.id));
  }, [currentUser, teams]);

  const unreadHint = notificationCount;

  useEffect(() => {
    void fetchData();
  }, [fetchData, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchData();
      }
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [currentUserId, fetchData]);

  useEffect(() => {
    if (location.pathname.startsWith("/dashboard/teams")) {
      setTeamsMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const activeTeam = teams.find((team) =>
      location.pathname.startsWith(`/dashboard/teams/${team.id}`),
    );

    if (activeTeam) {
      setExpandedTeamId(activeTeam.id);
    }
  }, [location.pathname, teams]);

  useEffect(() => {
    const membersAreaActive =
      location.pathname.startsWith("/dashboard/trainers") ||
      location.pathname.startsWith("/dashboard/players") ||
      location.pathname.startsWith("/dashboard/board");

    if (membersAreaActive) {
      setMembersMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith("/dashboard/messages")) {
      setNotificationCount(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    const latestMessage = [...messages].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0];

    if (!latestMessage) {
      latestMessageIdRef.current = null;
      return;
    }

    if (!latestMessageIdRef.current) {
      latestMessageIdRef.current = latestMessage.id;
      return;
    }

    if (latestMessage.id === latestMessageIdRef.current) {
      return;
    }

    latestMessageIdRef.current = latestMessage.id;

    if (latestMessage.senderId === currentUserId) {
      return;
    }

    const sender = users.find((user) => user.id === latestMessage.senderId);
    const conversation = conversations.find(
      (entry) => entry.id === latestMessage.conversationId,
    );
    const title = sender?.fullName ?? "Neue Nachricht";
    const content = conversation
      ? `${conversation.title}: ${latestMessage.content}`
      : latestMessage.content;

    setNotificationCount((count) => count + 1);
    setIncomingToast({ title, content });

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setIncomingToast(null);
    }, 5000);

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body: content });
      }
    }
  }, [conversations, currentUserId, messages, users]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-blue-950/10 bg-gradient-to-b from-blue-950 via-blue-900 to-blue-700 text-white shadow-2xl transition-transform duration-300 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Teamwappen"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white/15 text-white">
                  <ShieldCheck size={22} />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-blue-200">
                Vereinsmanager
              </p>
              <p className="text-base font-semibold">{settings.clubName}</p>
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
                : currentUser?.role === "board"
                  ? "Vorstand"
                  : "Spielerin"}
          </p>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {menuItems.map((item) => {
            const Icon = item.icon;

            if (item.to === "/dashboard/teams") {
              const teamsAreaActive = location.pathname.startsWith("/dashboard/teams");

              return (
                <div key={item.to} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <NavLink
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                          isActive || teamsAreaActive
                            ? "bg-white text-blue-950 shadow-lg"
                            : "text-blue-100 hover:bg-white/10 hover:text-white",
                        )
                      }
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </NavLink>

                    {visibleTeams.length && keepsCollapsedTeamMenus ? (
                      <button
                        type="button"
                        aria-label="Mannschaften aufklappen"
                        onClick={() => setTeamsMenuOpen((open) => !open)}
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl transition-all",
                          teamsAreaActive || teamsMenuOpen
                            ? "bg-white/15 text-white"
                            : "text-blue-100 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <ChevronDown
                          size={18}
                          className={cn(
                            "transition-transform duration-200",
                            teamsMenuOpen ? "rotate-180" : "",
                          )}
                        />
                      </button>
                    ) : null}
                  </div>

                  {visibleTeams.length &&
                  (keepsCollapsedTeamMenus ? teamsMenuOpen : true) ? (
                    <div className="ml-4 space-y-1 border-l border-white/15 pl-4">
                      {visibleTeams.map((team) => {
                        const teamActive = location.pathname.startsWith(
                          `/dashboard/teams/${team.id}`,
                        );
                        const teamOpen = keepsCollapsedTeamMenus
                          ? expandedTeamId === team.id
                          : true;
                        const showManagement =
                          currentUser?.role === "admin" ||
                          currentUser?.role === "board" ||
                          (currentUser?.role === "trainer" &&
                            currentUser.teamIds.includes(team.id));
                        const showCashbook = showManagement;
                        const subItems = [
                          { key: "dashboard", label: "Dashboard" },
                          { key: "kader", label: "Kader" },
                          { key: "spielplan", label: "Spielplan" },
                          { key: "termine", label: "Termine" },
                          { key: "inventar", label: "Inventar" },
                          ...(showCashbook
                            ? [{ key: "kasse" as const, label: "Schiri-Kasse" }]
                            : []),
                          ...(showManagement
                            ? [{ key: "verwaltung" as const, label: "Verwaltung" }]
                            : []),
                        ] as const;

                        return (
                          <div key={team.id} className="space-y-1">
                            {keepsCollapsedTeamMenus ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTeamId((current) =>
                                    current === team.id ? null : team.id,
                                  )
                                }
                                className={cn(
                                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-all",
                                  teamActive
                                    ? "bg-white text-blue-950 shadow"
                                    : "text-blue-100/95 hover:bg-white/10 hover:text-white",
                                )}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">
                                    {team.name}
                                  </span>
                                  <span className="block truncate text-xs text-current/75">
                                    {team.ageGroup}
                                  </span>
                                </span>
                                <ChevronDown
                                  size={16}
                                  className={cn(
                                    "shrink-0 transition-transform duration-200",
                                    teamOpen ? "rotate-180" : "",
                                  )}
                                />
                              </button>
                            ) : (
                              <div
                                className={cn(
                                  "rounded-xl px-3 py-2",
                                  teamActive
                                    ? "bg-white text-blue-950 shadow"
                                    : "bg-white/10 text-white",
                                )}
                              >
                                <span className="block truncate text-sm font-medium">
                                  {team.name}
                                </span>
                                <span className="block truncate text-xs text-current/75">
                                  {team.ageGroup}
                                </span>
                              </div>
                            )}

                            {teamOpen ? (
                              <div className="ml-3 space-y-1 border-l border-white/15 pl-3">
                                {subItems.map((subItem) => (
                                  <NavLink
                                    key={subItem.key}
                                    to={`/dashboard/teams/${team.id}/${subItem.key}`}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                      cn(
                                        "block rounded-lg px-3 py-2 text-sm transition-all",
                                        isActive
                                          ? "bg-white text-blue-950 shadow"
                                          : "text-blue-100/90 hover:bg-white/10 hover:text-white",
                                      )
                                    }
                                  >
                                    {subItem.label}
                                  </NavLink>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            if (item.to === "__members__") {
              if (!canViewMemberLists) {
                return null;
              }

              const membersAreaActive =
                location.pathname.startsWith("/dashboard/trainers") ||
                location.pathname.startsWith("/dashboard/players") ||
                location.pathname.startsWith("/dashboard/board");

              return (
                <div key={item.to} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMembersMenuOpen((open) => !open)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                        membersAreaActive || membersMenuOpen
                          ? "bg-white text-blue-950 shadow-lg"
                          : "text-blue-100 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Mitglieder aufklappen"
                      onClick={() => setMembersMenuOpen((open) => !open)}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl transition-all",
                        membersAreaActive || membersMenuOpen
                          ? "bg-white/15 text-white"
                          : "text-blue-100 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <ChevronDown
                        size={18}
                        className={cn(
                          "transition-transform duration-200",
                          membersMenuOpen ? "rotate-180" : "",
                        )}
                      />
                    </button>
                  </div>

                  {membersMenuOpen ? (
                    <div className="ml-4 space-y-1 border-l border-white/15 pl-4">
                      {[
                        { to: "/dashboard/trainers", label: "Trainer", icon: Shield },
                        { to: "/dashboard/players", label: "Spielerinnen", icon: Users },
                        { to: "/dashboard/board", label: "Vorstand", icon: Briefcase },
                      ].map((subItem) => (
                        <NavLink
                          key={subItem.to}
                          to={subItem.to}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                              isActive
                                ? "bg-white text-blue-950 shadow"
                                : "text-blue-100/90 hover:bg-white/10 hover:text-white",
                            )
                          }
                        >
                          <subItem.icon size={16} />
                          <span>{subItem.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

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
        <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 text-white backdrop-blur">
          <div className="flex h-20 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-2xl border border-white/15 bg-white/10 p-3 text-white shadow-sm md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/dashboard/messages"
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-md"
              >
                <Bell size={18} />
                {unreadHint > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-200 px-1 text-[11px] font-semibold text-blue-950">
                    {unreadHint}
                  </span>
                ) : null}
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="rounded-2xl border border-white/15 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-4"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {currentUser?.fullName ?? "Profil"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="hidden text-xs text-slate-500 sm:block">{currentUser?.email}</p>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "text-slate-400 transition-transform duration-200",
                        profileMenuOpen ? "rotate-180" : "",
                      )}
                    />
                  </div>
                </button>

                {profileMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      Mein Profil bearbeiten
                    </Link>
                    {currentUser?.role === "admin" ? (
                      <Link
                        to="/dashboard/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        Einstellungen
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      Abmelden
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {incomingToast ? (
          <div className="pointer-events-none fixed right-4 top-24 z-50 max-w-sm sm:right-6">
            <div className="pointer-events-auto overflow-hidden rounded-3xl border border-blue-100 bg-white/95 shadow-2xl backdrop-blur">
              <div className="h-1 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500" />
              <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-blue-700" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Neue Nachricht
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {incomingToast.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIncomingToast(null)}
                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-600">{incomingToast.content}</p>
              </div>
            </div>
          </div>
        ) : null}

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
