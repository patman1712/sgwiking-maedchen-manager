import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Briefcase,
  ChevronDown,
  ExternalLink,
  FileUser,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Megaphone,
  Plus,
  ShoppingBag,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

const menuItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/teams", label: "Mannschaften", icon: Volleyball },
  { to: "/dashboard/messages", label: "Nachrichten", icon: MessageSquare },
  { to: "/dashboard/social-media", label: "Social Media", icon: Megaphone },
  { to: "/dashboard/flohmarkt", label: "Flohmarkt", icon: ShoppingBag },
  { to: "/dashboard/turnierboerse", label: "Turnierboerse", icon: Trophy },
  { to: "__board__", label: "Vorstand", icon: Briefcase },
] as const;

const StableSidebarLogo = memo(function StableSidebarLogo({ src }: { src: string }) {
  return <img src={src} alt="Teamwappen" className="h-full w-full object-contain" />;
});

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamsMenuOpen, setTeamsMenuOpen] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [membersMenuOpen, setMembersMenuOpen] = useState(false);
  const [membersSubMenuOpen, setMembersSubMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const logout = useAppStore((state) => state.logout);
  const fetchData = useAppStore((state) => state.fetchData);
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const settings = useAppStore((state) => state.settings);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const conversations = useAppStore((state) => state.conversations);
  const messages = useAppStore((state) => state.messages);
  const tournamentOffers = useAppStore((state) => state.tournamentOffers);
  const matchRescheduleRequests = useAppStore((state) => state.matchRescheduleRequests);
  const pendingPlayerApplications = useAppStore((state) => state.pendingPlayerApplications);
  const socialMediaDrafts = useAppStore((state) => state.socialMediaDrafts);
  const customExternalLinks = useAppStore((state) => state.customExternalLinks);
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingToast, setIncomingToast] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageNotifications, setMessageNotifications] = useState<
    Array<{
      id: string;
      title: string;
      content: string;
      href: string;
      createdAt: string;
    }>
  >([]);
  const [tournamentNotificationsSeenAt, setTournamentNotificationsSeenAt] = useState<string | null>(
    null,
  );
  const [rescheduleNotificationsSeenAt, setRescheduleNotificationsSeenAt] = useState<string | null>(
    null,
  );
  const latestMessageIdRef = useRef<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const canViewMemberLists =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const canUseSocialMedia =
    currentUser?.role === "admin" ||
    currentUser?.role === "board" ||
    currentUser?.role === "social" ||
    Boolean(currentUser?.socialMediaEnabled);
  const canUseTournamentBoerse =
    currentUser?.role === "admin" ||
    currentUser?.role === "board" ||
    currentUser?.role === "trainer";
  const isSocialOnly = currentUser?.role === "social";
  const visibleMenuItems = useMemo(
    () =>
      menuItems.filter((item) => {
        if (isSocialOnly) {
          return item.to === "/dashboard/social-media";
        }
        if (item.to === "/dashboard/social-media") {
          return canUseSocialMedia;
        }

        if (item.to === "/dashboard/turnierboerse") {
          return canUseTournamentBoerse;
        }

        return true;
      }),
    [canUseSocialMedia, canUseTournamentBoerse, isSocialOnly],
  );
  const visibleCustomExternalLinks = useMemo(() => {
    if (!currentUser) return [];
    return customExternalLinks
      .filter((link) =>
        link.roleVisibility.length
          ? link.roleVisibility.includes(currentUser.role)
          : true,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.menuName.localeCompare(b.menuName));
  }, [currentUser, customExternalLinks]);
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

  const teamNameById = useMemo(
    () =>
      teams.reduce<Record<string, string>>((accumulator, team) => {
        accumulator[team.id] = team.name;
        return accumulator;
      }, {}),
    [teams],
  );

  const relevantTournamentNotifications = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "trainer") {
      return tournamentOffers
        .filter((offer) => currentUser.teamIds.includes(offer.teamId) && offer.trainerNotificationAt)
        .map((offer) => {
          let title = "Turnieranfrage aktualisiert";
          let content = `${teamNameById[offer.teamId] ?? "Mannschaft"}: ${offer.title}`;

          if (offer.responseStatus === "pending") {
            title = "Neue Turnieranfrage";
          } else if (offer.tournamentReplyStatus === "accepted") {
            title = "Turnierzusage eingegangen";
          } else if (offer.tournamentReplyStatus === "declined") {
            title = "Turnierabsage eingegangen";
          } else if (offer.registrationStatus === "registered") {
            title = "Team wurde angemeldet";
          } else if (offer.registrationStatus === "cancelled") {
            title = "Anmeldung wurde abgesagt";
          }

          return {
            id: `tournament-${offer.id}`,
            createdAt: offer.trainerNotificationAt ?? offer.updatedAt ?? offer.createdAt,
            title,
            content,
            href: "/dashboard/turnierboerse",
          };
        });
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return tournamentOffers
        .filter((offer) => Boolean(offer.adminNotificationAt))
        .map((offer) => ({
          id: `tournament-${offer.id}`,
          createdAt: offer.adminNotificationAt ?? offer.respondedAt ?? offer.updatedAt ?? offer.createdAt,
          title: "Rueckmeldung zur Turnieranfrage",
          content: `${teamNameById[offer.teamId] ?? "Mannschaft"} hat ${
            offer.responseStatus === "accepted" ? "zugesagt" : "abgesagt"
          }: ${offer.title}`,
          href: "/dashboard/turnierboerse",
        }));
    }

    return [];
  }, [currentUser, teamNameById, tournamentOffers]);

  const relevantRescheduleNotifications = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "trainer") {
      return matchRescheduleRequests
        .filter((entry) => currentUser.teamIds.includes(entry.teamId) && entry.trainerNotificationAt)
        .map((entry) => {
          let title = "Spielverlegung aktualisiert";
          if (entry.status === "in_progress") {
            title = "Spielverlegung in Bearbeitung";
          } else if (entry.status === "done") {
            title = "Spielverlegung erledigt";
          }

          return {
            id: `reschedule-${entry.id}`,
            createdAt: entry.trainerNotificationAt ?? entry.updatedAt ?? entry.requestedAt,
            title,
            content: `${teamNameById[entry.teamId] ?? "Mannschaft"}: ${entry.matchLabel}`,
            href: "/dashboard/board/mailbox",
          };
        });
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return matchRescheduleRequests
        .filter((entry) => Boolean(entry.adminNotificationAt) && entry.status !== "done")
        .map((entry) => ({
          id: `reschedule-${entry.id}`,
          createdAt: entry.adminNotificationAt ?? entry.requestedAt,
          title: "Neue Spielverlegungsanfrage",
          content: `${teamNameById[entry.teamId] ?? "Mannschaft"}: ${entry.matchLabel}`,
          href: "/dashboard/board/mailbox",
        }));
    }

    return [];
  }, [currentUser, matchRescheduleRequests, teamNameById]);

  const unseenRescheduleNotificationCount = useMemo(() => {
    if (!rescheduleNotificationsSeenAt) {
      return relevantRescheduleNotifications.length;
    }

    const seenAt = new Date(rescheduleNotificationsSeenAt).getTime();
    return relevantRescheduleNotifications.filter(
      (notification) => new Date(notification.createdAt).getTime() > seenAt,
    ).length;
  }, [relevantRescheduleNotifications, rescheduleNotificationsSeenAt]);

  const unseenBoardMailboxCount = useMemo(() => {
    if (!currentUser) return 0;

    if (currentUser.role === "admin" || currentUser.role === "board") {
      const openPlayerApplications = pendingPlayerApplications.filter(
        (entry) => entry.status === "pending",
      ).length;
      const openReschedules = matchRescheduleRequests.filter(
        (entry) => entry.status === "pending" || entry.status === "in_progress",
      ).length;
      const openSocialPostings = socialMediaDrafts.filter(
        (draft) => !draft.isTemplate && draft.status === "submitted",
      ).length;
      return openPlayerApplications + openReschedules + openSocialPostings;
    }

    if (currentUser.role === "trainer") {
      const openReschedules = matchRescheduleRequests.filter(
        (entry) =>
          currentUser.teamIds.includes(entry.teamId) &&
          (entry.status === "pending" || entry.status === "in_progress"),
      ).length;
      return openReschedules;
    }

    return 0;
  }, [currentUser, matchRescheduleRequests, pendingPlayerApplications]);

  const boardMailboxNotifications = useMemo(() => {
    if (!currentUser) return [];
    const items: Array<{
      id: string;
      title: string;
      content: string;
      href: string;
      createdAt: string;
    }> = [];

    if (currentUser.role === "admin" || currentUser.role === "board") {
      pendingPlayerApplications
        .filter((entry) => entry.status === "pending")
        .forEach((entry) => {
          items.push({
            id: `mailbox-player-${entry.id}`,
            title: "Neue Spielerin-Anmeldung",
            content: `${entry.fullName}${entry.teamId ? ` (${teamNameById[entry.teamId] ?? ""})` : ""} wartet auf Freigabe`,
            href: "/dashboard/board/mailbox",
            createdAt: entry.requestedAt ?? entry.reviewedAt ?? new Date().toISOString(),
          });
        });
      matchRescheduleRequests
        .filter((entry) => entry.status === "pending" || entry.status === "in_progress")
        .forEach((entry) => {
          items.push({
            id: `mailbox-reschedule-${entry.id}`,
            title: entry.status === "in_progress" ? "Spielverlegung in Bearbeitung" : "Spielverlegungsanfrage offen",
            content: `${teamNameById[entry.teamId] ?? "Mannschaft"}: ${entry.matchLabel}`,
            href: "/dashboard/board/mailbox",
            createdAt: entry.requestedAt ?? entry.updatedAt ?? new Date().toISOString(),
          });
        });
    } else if (currentUser.role === "trainer") {
      matchRescheduleRequests
        .filter(
          (entry) =>
            currentUser.teamIds.includes(entry.teamId) &&
            (entry.status === "pending" || entry.status === "in_progress"),
        )
        .forEach((entry) => {
          items.push({
            id: `mailbox-reschedule-${entry.id}`,
            title: entry.status === "in_progress" ? "Spielverlegung in Bearbeitung" : "Spielverlegungsanfrage offen",
            content: `${teamNameById[entry.teamId] ?? "Mannschaft"}: ${entry.matchLabel}`,
            href: "/dashboard/board/mailbox",
            createdAt: entry.requestedAt ?? entry.updatedAt ?? new Date().toISOString(),
          });
        });
    }

    return items.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }, [currentUser, matchRescheduleRequests, pendingPlayerApplications, teamNameById]);

  const unseenTournamentNotificationCount = useMemo(() => {
    if (!tournamentNotificationsSeenAt) {
      return relevantTournamentNotifications.length;
    }

    const seenAt = new Date(tournamentNotificationsSeenAt).getTime();
    return relevantTournamentNotifications.filter(
      (notification) => new Date(notification.createdAt).getTime() > seenAt,
    ).length;
  }, [relevantTournamentNotifications, tournamentNotificationsSeenAt]);

  const unreadHint = isSocialOnly
    ? 0
    : notificationCount +
      unseenTournamentNotificationCount +
      unseenRescheduleNotificationCount +
      unseenBoardMailboxCount;

  const notificationItems = useMemo(
    () =>
      [
        ...relevantRescheduleNotifications,
        ...relevantTournamentNotifications,
        ...boardMailboxNotifications,
        ...messageNotifications.map((entry) => ({
          ...entry,
          id: `message-${entry.id}`,
        })),
      ]
        .sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        )
        .slice(0, 10),
    [
      boardMailboxNotifications,
      messageNotifications,
      relevantRescheduleNotifications,
      relevantTournamentNotifications,
    ],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData, currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchData({ silent: true });
      }
    }, 60000);

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
      setMembersSubMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    setProfileMenuOpen(false);
    setNotificationCenterOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith("/dashboard/messages")) {
      setNotificationCount(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUserId || typeof window === "undefined") {
      setTournamentNotificationsSeenAt(null);
      setRescheduleNotificationsSeenAt(null);
      return;
    }

    const storageKey = `notification-center-last-seen-${currentUserId}`;
    const seenAt = window.localStorage.getItem(storageKey);
    setTournamentNotificationsSeenAt(seenAt);
    setRescheduleNotificationsSeenAt(seenAt);
  }, [currentUserId]);

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
    setMessageNotifications((current) => {
      const nextEntry = {
        id: latestMessage.id,
        title,
        content,
        href: conversation
          ? `/dashboard/messages?conversation=${encodeURIComponent(conversation.id)}`
          : "/dashboard/messages",
        createdAt: latestMessage.createdAt,
      };

      return [nextEntry, ...current.filter((entry) => entry.id !== latestMessage.id)].slice(0, 10);
    });

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

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const badgeNavigator = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (!badgeNavigator.setAppBadge && !badgeNavigator.clearAppBadge) {
      return;
    }

    void (async () => {
      try {
        if (unreadHint > 0) {
          await badgeNavigator.setAppBadge?.(unreadHint);
        } else {
          await badgeNavigator.clearAppBadge?.();
        }
      } catch {
        // Browser support is optional; ignore badge failures.
      }
    })();
  }, [unreadHint]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const openNotificationCenter = () => {
    setNotificationCenterOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setNotificationCount(0);

        if (typeof window !== "undefined" && currentUserId) {
          const seenAt = new Date().toISOString();
          window.localStorage.setItem(`notification-center-last-seen-${currentUserId}`, seenAt);
          setTournamentNotificationsSeenAt(seenAt);
          setRescheduleNotificationsSeenAt(seenAt);
        }
      }

      return nextOpen;
    });
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
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-6">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl">
              {settings.logoUrl ? (
                <StableSidebarLogo src={settings.logoUrl} />
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

        <div className="shrink-0 border-b border-white/10 px-6 py-5">
          <p className="text-sm text-blue-100">Angemeldet als</p>
          <p className="mt-1 text-lg font-semibold">{currentUser?.fullName}</p>
          <p className="mt-1 text-sm text-blue-200">
            {currentUser?.role === "admin"
              ? "Vereinsadmin"
              : currentUser?.role === "trainer"
                ? "Trainerin / Trainer"
                : currentUser?.role === "board"
                  ? "Vorstand"
                  : currentUser?.role === "social"
                    ? "Social Media Manager"
                    : "Spielerin"}
          </p>
        </div>

        <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto overscroll-contain px-4 py-6 pr-2">
          {visibleMenuItems.map((item) => {
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

            if (item.to === "__board__") {
              if (!canViewMemberLists) {
                return null;
              }

              const boardAreaActive =
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
                        boardAreaActive || membersMenuOpen
                          ? "bg-white text-blue-950 shadow-lg"
                          : "text-blue-100 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Vorstand aufklappen"
                      onClick={() => setMembersMenuOpen((open) => !open)}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl transition-all",
                        boardAreaActive || membersMenuOpen
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
                      <NavLink
                        to="/dashboard/board/mailbox"
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
                        <MessageSquare size={16} />
                        <span className="flex min-w-0 items-center gap-2">
                          <span>Postfach</span>
                          {unseenBoardMailboxCount > 0 ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-200 px-1 text-[11px] font-semibold text-blue-950">
                              {unseenBoardMailboxCount}
                            </span>
                          ) : null}
                        </span>
                      </NavLink>

                      <div className="space-y-1 pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMembersSubMenuOpen((open) => !open)}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                              membersSubMenuOpen
                                ? "text-white"
                                : "text-blue-100/90 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            <Users size={16} />
                            <span>Mitglieder</span>
                          </button>
                          <button
                            type="button"
                            aria-label="Mitglieder aufklappen"
                            onClick={() => setMembersSubMenuOpen((open) => !open)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-100/90 transition-all hover:bg-white/10 hover:text-white"
                          >
                            <ChevronDown
                              size={16}
                              className={cn(
                                "transition-transform duration-200",
                                membersSubMenuOpen ? "rotate-180" : "",
                              )}
                            />
                          </button>
                        </div>

                        {membersSubMenuOpen ? (
                          <div className="ml-6 space-y-1 border-l border-white/10 pl-4">
                            {[
                              { to: "/dashboard/trainers", label: "Trainer", icon: Shield },
                              { to: "/dashboard/players", label: "Spielerinnen", icon: Users },
                              { to: "/dashboard/board", label: "Vorstand", icon: Briefcase },
                              ...(canViewMemberLists
                                ? [
                                    {
                                      to: "/dashboard/social-media-manager" as const,
                                      label: "Social Media",
                                      icon: FileUser,
                                    },
                                  ]
                                : []),
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

                      <NavLink
                        to="/dashboard/board/schluessel"
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
                        <KeyRound size={16} />
                        <span>Schlüssel</span>
                      </NavLink>
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
                <span className="flex min-w-0 items-center gap-2">
                  <span>{item.label}</span>
                  {item.to === "/dashboard/turnierboerse" && unseenTournamentNotificationCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-200 px-1 text-[11px] font-semibold text-blue-950">
                      {unseenTournamentNotificationCount}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            );
          })}

          {currentUser?.role === "admin" ? (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/80">
                Admin
              </p>
              <NavLink
                to="/dashboard/settings?tab=links"
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
                <Shield size={18} />
                <span className="flex min-w-0 items-center gap-2">
                  <span>Einstellungen</span>
                  <span className="inline-flex items-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-950">
                    Externe Links
                  </span>
                </span>
              </NavLink>
            </div>
          ) : null}

          {visibleCustomExternalLinks.length || currentUser?.role === "admin" ? (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/80">
                Externe Links
              </p>
              {visibleCustomExternalLinks.length ? (
                visibleCustomExternalLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-blue-100 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <ExternalLink size={18} />
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{link.menuName}</span>
                      <ArrowUpRight size={14} className="shrink-0 opacity-70" />
                    </span>
                  </a>
                ))
              ) : (
                <Link
                  to="/dashboard/settings?tab=links"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-blue-200/80 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Plus size={18} />
                  <span>Jetzt ersten Link anlegen</span>
                </Link>
              )}
            </div>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-white/10 px-4 py-4">
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
              {!isSocialOnly ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={openNotificationCenter}
                    className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-md"
                  >
                    <Bell size={18} />
                    {unreadHint > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-200 px-1 text-[11px] font-semibold text-blue-950">
                        {unreadHint}
                      </span>
                    ) : null}
                  </button>
                  {notificationCenterOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                      <div className="flex items-center justify-between gap-3 px-2 py-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Benachrichtigungen</p>
                          <p className="text-xs text-slate-500">
                            Turniere und neue Nachrichten auf einen Blick
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNotificationCenterOpen(false)}
                          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
                        {notificationItems.length ? (
                          notificationItems.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => {
                                setNotificationCenterOpen(false);
                                navigate(notification.href);
                              }}
                              className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                {notification.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">{notification.content}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {new Date(notification.createdAt).toLocaleString("de-DE")}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Aktuell gibt es keine neuen Benachrichtigungen.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                        to="/dashboard/settings?tab=links"
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
