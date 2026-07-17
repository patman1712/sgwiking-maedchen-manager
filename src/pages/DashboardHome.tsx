import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  CalendarDays,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import { useAppStore } from "@/store";
import StatCard from "@/components/StatCard";
import SectionCard from "@/components/SectionCard";

type DashboardManualEvent = {
  id: string;
  teamId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  category: string;
  sourceType: "manual";
  createdBy: string;
  createdAt: string;
};

type DashboardEventSummary = {
  eventId: string;
  acceptedCount: number;
  declinedCount: number;
  currentUserStatus: "accepted" | "declined" | null;
};

type DashboardEventResponseDetail = {
  eventId: string;
  acceptedUsers: Array<{ userId: string; fullName: string }>;
  declinedUsers: Array<{ userId: string; fullName: string }>;
};

type DashboardTeamEventsPayload = {
  manualEvents: DashboardManualEvent[];
  responseSummaries: DashboardEventSummary[];
  responseDetails: DashboardEventResponseDetail[];
  settings: {
    responseCloseHoursBefore: number;
  };
};

type DashboardUnifiedEvent = {
  id: string;
  teamId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  category: string;
  sourceType: "manual" | "match";
};

export default function DashboardHome() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const messages = useAppStore((state) => state.messages);
  const conversations = useAppStore((state) => state.conversations);
  const matches = useAppStore((state) => state.matches);
  const currentUserId = useAppStore((state) => state.currentUserId);

  const currentUser = users.find((user) => user.id === currentUserId) ?? null;
  const [teamEventsByTeamId, setTeamEventsByTeamId] = useState<
    Record<string, DashboardTeamEventsPayload>
  >({});
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventResponseSavingId, setEventResponseSavingId] = useState<string | null>(null);
  const [responseDetailsModal, setResponseDetailsModal] = useState<{
    eventTitle: string;
    type: "accepted" | "declined";
    names: string[];
  } | null>(null);

  const canOpenAllTeams =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const isTrainerOrPlayer =
    currentUser?.role === "trainer" || currentUser?.role === "player";
  const canOpenTeam = (teamId: string) =>
    Boolean(canOpenAllTeams || currentUser?.teamIds.includes(teamId));
  const visibleTeams = teams;
  const visibleMatches = [...matches].sort(
    (left, right) =>
      new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
  );
  const now = Date.now();

  const trainers = users.filter((user) => user.role === "trainer");
  const players = users.filter((user) => user.role === "player");
  const boardMembers = users.filter((user) => user.role === "board");
  const recentMessages = [...messages]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);
  const nextMatches = visibleMatches
    .filter((match) => new Date(match.kickoffAt).getTime() >= now)
    .slice(0, 5);
  const previousMatches = [...visibleMatches]
    .filter((match) => new Date(match.kickoffAt).getTime() < now)
    .sort(
      (left, right) =>
        new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime(),
    )
    .slice(0, 5);
  const showBoardOverview = currentUser?.role === "board";
  const ownTeamIds = useMemo(
    () => (isTrainerOrPlayer ? currentUser?.teamIds ?? [] : []),
    [currentUser?.teamIds, isTrainerOrPlayer],
  );

  const getTeamById = (teamId: string) => teams.find((team) => team.id === teamId);
  const formatMatchDate = (kickoffAt: string) =>
    new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(kickoffAt));

  useEffect(() => {
    if (!currentUserId || !ownTeamIds.length) {
      setTeamEventsByTeamId({});
      setEventsError("");
      return;
    }

    let cancelled = false;
    setEventsLoading(true);
    setEventsError("");

    void Promise.all(
      ownTeamIds.map(async (teamId) => {
        const response = await fetch(
          `/api/events?teamId=${encodeURIComponent(teamId)}&actorId=${encodeURIComponent(currentUserId)}`,
        );
        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(data.error || "Termine konnten nicht geladen werden.");
        }

        return [
          teamId,
          {
            manualEvents: data.manualEvents ?? [],
            responseSummaries: data.responseSummaries ?? [],
            responseDetails: data.responseDetails ?? [],
            settings: data.settings ?? { responseCloseHoursBefore: 24 },
          } satisfies DashboardTeamEventsPayload,
        ] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setTeamEventsByTeamId(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setEventsError(
          error instanceof Error ? error.message : "Termine konnten nicht geladen werden.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setEventsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, ownTeamIds]);

  const nextTwoEvents = useMemo(() => {
    if (!ownTeamIds.length) {
      return [];
    }

    const unifiedEvents = ownTeamIds.flatMap((teamId) => {
      const payload = teamEventsByTeamId[teamId];
      const manualEvents =
        payload?.manualEvents.map((event) => ({
          id: event.id,
          teamId,
          title: event.title,
          description: event.description,
          location: event.location,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          category: event.category,
          sourceType: "manual" as const,
        })) ?? [];

      const matchEvents = matches
        .filter((match) => match.teamId === teamId)
        .map((match) => ({
          id: match.id,
          teamId,
          title: `${getTeamById(teamId)?.name ?? "Mannschaft"} gegen ${match.opponent}`,
          description: match.competition || "",
          location: match.location,
          startsAt: match.kickoffAt,
          endsAt: null,
          category: "Spiel",
          sourceType: "match" as const,
        }));

      return [...manualEvents, ...matchEvents];
    });

    return unifiedEvents
      .filter((event) => new Date(event.startsAt).getTime() >= Date.now())
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      )
      .slice(0, 2);
  }, [getTeamById, matches, ownTeamIds, teamEventsByTeamId]);

  const getEventSummary = (event: DashboardUnifiedEvent) =>
    teamEventsByTeamId[event.teamId]?.responseSummaries.find(
      (summary) => summary.eventId === event.id,
    );

  const getEventResponseDetail = (event: DashboardUnifiedEvent) =>
    teamEventsByTeamId[event.teamId]?.responseDetails.find(
      (detail) => detail.eventId === event.id,
    );

  const getEventDeadline = (event: DashboardUnifiedEvent) => {
    const closeHours =
      teamEventsByTeamId[event.teamId]?.settings.responseCloseHoursBefore ?? 24;
    return new Date(new Date(event.startsAt).getTime() - closeHours * 60 * 60 * 1000);
  };

  const handleEventResponse = async (
    event: DashboardUnifiedEvent,
    status: "accepted" | "declined",
  ) => {
    if (!currentUserId) {
      return;
    }

    setEventResponseSavingId(event.id);
    setEventsError("");

    try {
      const response = await fetch("/api/events/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId,
          teamId: event.teamId,
          eventId: event.id,
          status,
        }),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Rueckmeldung konnte nicht gespeichert werden.");
      }

      setTeamEventsByTeamId((current) => ({
        ...current,
        [event.teamId]: {
          manualEvents: data.manualEvents ?? [],
          responseSummaries: data.responseSummaries ?? [],
          responseDetails: data.responseDetails ?? [],
          settings: data.settings ?? { responseCloseHoursBefore: 24 },
        },
      }));
    } catch (error) {
      setEventsError(
        error instanceof Error ? error.message : "Rueckmeldung konnte nicht gespeichert werden.",
      );
    } finally {
      setEventResponseSavingId(null);
    }
  };

  const renderTeamLogo = (logoUrl: string | null | undefined, teamName: string) =>
    logoUrl ? (
      <img
        src={logoUrl}
        alt={teamName}
        className="h-10 w-10 rounded-full border border-white/80 bg-white object-contain shadow-sm"
      />
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 shadow-sm">
        <Volleyball size={16} />
      </div>
    );

  const renderMatchCard = (match: (typeof visibleMatches)[number]) => {
    const team = getTeamById(match.teamId);
    const matchIsClickable = canOpenTeam(match.teamId);
    const homeTeamName =
      match.homeTeamName || (match.isHome ? team?.name ?? match.opponent : match.opponent);
    const awayTeamName =
      match.awayTeamName || (match.isHome ? match.opponent : team?.name ?? match.opponent);

    const cardContent = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-gradient-to-r from-blue-700 to-blue-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                {team?.name ?? "Mannschaft"}
              </span>
              {team?.ageGroup ? (
                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  {team.ageGroup}
                </span>
              ) : null}
            </div>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-900 shadow-sm">
            {formatMatchDate(match.kickoffAt)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            {renderTeamLogo(match.homeLogoUrl, homeTeamName)}
            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900">
              {homeTeamName}
            </p>
          </div>
          <span className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
            vs
          </span>
          <div className="flex min-w-0 items-center justify-start gap-3 sm:justify-end">
            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900 sm:text-right">
              {awayTeamName}
            </p>
            {renderTeamLogo(match.awayLogoUrl, awayTeamName)}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <MapPin size={14} className="text-blue-700" />
            {match.location}
          </span>
          {match.result ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              Ergebnis {match.result}
            </span>
          ) : null}
        </div>
      </>
    );

    if (!matchIsClickable) {
      return (
        <div
          key={match.id}
          className="rounded-3xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm opacity-95"
        >
          {cardContent}
        </div>
      );
    }

    return (
      <Link
        key={match.id}
        to={`/dashboard/teams/${match.teamId}/spielplan`}
        className="rounded-3xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white"
      >
        {cardContent}
      </Link>
    );
  };

  const renderDashboardEventCard = (event: DashboardUnifiedEvent) => {
    const team = getTeamById(event.teamId);
    const summary = getEventSummary(event);
    const responseDetail = getEventResponseDetail(event);
    const deadline = getEventDeadline(event);
    const responseClosed = deadline.getTime() <= Date.now();
    const canViewResponseNames = currentUser?.role === "trainer";

    return (
      <div
        key={event.id}
        className="rounded-3xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 shadow-sm">
                {event.sourceType === "match" ? "Spiel" : event.category}
              </span>
              <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-[11px] font-semibold text-blue-900">
                {team?.name ?? "Mannschaft"}
              </span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-900">{event.title}</p>
            {event.description ? (
              <p className="mt-1 text-sm text-slate-600">{event.description}</p>
            ) : null}
          </div>
          <Link
            to={`/dashboard/teams/${event.teamId}/termine`}
            className="rounded-2xl border border-white bg-white px-3 py-2 text-xs font-semibold text-blue-900 shadow-sm transition hover:bg-blue-50"
          >
            Zum Terminbereich
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={15} className="text-blue-700" />
            {new Date(event.startsAt).toLocaleString("de-DE")}
          </span>
          {event.location ? (
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} className="text-blue-700" />
              {event.location}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {canViewResponseNames ? (
            <button
              type="button"
              onClick={() =>
                setResponseDetailsModal({
                  eventTitle: event.title,
                  type: "accepted",
                  names: responseDetail?.acceptedUsers.map((user) => user.fullName) ?? [],
                })
              }
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              Zusagen {summary?.acceptedCount ?? 0}
            </button>
          ) : (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
              Zusagen {summary?.acceptedCount ?? 0}
            </span>
          )}
          {canViewResponseNames ? (
            <button
              type="button"
              onClick={() =>
                setResponseDetailsModal({
                  eventTitle: event.title,
                  type: "declined",
                  names: responseDetail?.declinedUsers.map((user) => user.fullName) ?? [],
                })
              }
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
            >
              Absagen {summary?.declinedCount ?? 0}
            </button>
          ) : (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm">
              Absagen {summary?.declinedCount ?? 0}
            </span>
          )}
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            {responseClosed
              ? `Abgelaufen seit ${deadline.toLocaleString("de-DE")}`
              : `Antwort moeglich bis ${deadline.toLocaleString("de-DE")}`}
          </span>
          {summary?.currentUserStatus ? (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
              Deine Rueckmeldung: {summary.currentUserStatus === "accepted" ? "Zusage" : "Absage"}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={responseClosed || eventResponseSavingId === event.id}
            onClick={() => void handleEventResponse(event, "accepted")}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Zusagen
          </button>
          <button
            type="button"
            disabled={responseClosed || eventResponseSavingId === event.id}
            onClick={() => void handleEventResponse(event, "declined")}
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Absagen
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {responseDetailsModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  {responseDetailsModal.type === "accepted" ? "Zusagen" : "Absagen"}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  {responseDetailsModal.eventTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResponseDetailsModal(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {responseDetailsModal.names.length ? (
                responseDetailsModal.names.map((name) => (
                  <div
                    key={name}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    {name}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Noch keine Rueckmeldungen vorhanden.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[2rem] bg-gradient-to-r from-blue-950 via-blue-900 to-blue-700 p-8 text-white shadow-[0_30px_80px_rgba(30,41,59,0.2)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
          Vereinsuebersicht
        </p>
        <h2 className="mt-3 text-3xl font-semibold">
          Alles Wichtige fuer eure Maedchenfussball-Organisation auf einen Blick
        </h2>
        <p className="mt-4 max-w-3xl text-sm text-blue-100 sm:text-base">
          Schnelle Uebersicht ueber Mannschaften, Mitglieder und Nachrichten mit
          direkten Wegen in alle wichtigen Vereinsbereiche.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/dashboard/teams"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-blue-900 shadow-lg transition hover:-translate-y-0.5"
          >
            Mannschaften verwalten
          </Link>
          <Link
            to="/dashboard/messages"
            className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Nachrichten oeffnen
          </Link>
        </div>
      </section>

      {showBoardOverview ? (
        <div className="grid gap-4 xl:grid-cols-5">
          <StatCard
            title="Mannschaften"
            value={String(teams.length)}
            description="Mehrere Jugendteams koennen parallel verwaltet werden."
            icon={Volleyball}
          />
          <StatCard
            title="Trainerinnen"
            value={String(trainers.length)}
            description="Trainerzugriffe fuer Teamsteuerung und Kommunikation."
            icon={ShieldCheck}
          />
          <StatCard
            title="Spielerinnen"
            value={String(players.length)}
            description="Kader, Logins und Teamzuordnungen zentral gepflegt."
            icon={Users}
          />
          <StatCard
            title="Vorstand"
            value={String(boardMembers.length)}
            description="Eigener Bereich fuer die Vereinsleitung und Organisation."
            icon={Briefcase}
          />
          <StatCard
            title="Konversationen"
            value={String(conversations.length)}
            description="Direktnachrichten und Teamchats an einem Ort."
            icon={MessageSquare}
          />
        </div>
      ) : null}

      <SectionCard
        title="Mannschaften"
        description="Alle sichtbaren Teams direkt oben auf dem Dashboard als schnelle Kacheln."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTeams.map((team) => {
            const teamUsers = users.filter((user) => user.teamIds.includes(team.id));
            const teamCardContent = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                      {team.ageGroup}
                    </p>
                    <h3 className="mt-2 break-words text-lg font-semibold leading-snug text-slate-900">
                      {team.name}
                    </h3>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
                    {teamUsers.length} Personen
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">{team.trainingDay}</p>
                <p className="mt-2 text-sm text-slate-500">{team.location}</p>
              </>
            );

            if (!canOpenTeam(team.id)) {
              return (
                <div
                  key={team.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 opacity-95"
                >
                  {teamCardContent}
                </div>
              );
            }

            return (
              <Link
                key={team.id}
                to={`/dashboard/teams/${team.id}/dashboard`}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
              >
                {teamCardContent}
              </Link>
            );
          })}
        </div>
      </SectionCard>

      {isTrainerOrPlayer ? (
        <SectionCard
          title="Naechste 2 Termine"
          description="Die naechsten Teamtermine direkt ueber den Spielen, damit Zu- und Absagen ohne Umwege moeglich sind."
        >
          <div className="space-y-4">
            {eventsError ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-700">
                {eventsError}
              </div>
            ) : null}

            {eventsLoading ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                Termine werden geladen...
              </div>
            ) : nextTwoEvents.length ? (
              nextTwoEvents.map(renderDashboardEventCard)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                Aktuell sind keine kommenden Termine fuer deine Teams vorhanden.
              </div>
            )}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Naechste 5 Spiele"
          description="Die naechsten Begegnungen aller sichtbaren Mannschaften gesammelt auf dem Dashboard."
        >
          <div className="space-y-4">
            {nextMatches.length ? (
              nextMatches.map(renderMatchCard)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                Aktuell sind keine kommenden Spiele vorhanden.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Letzte 5 Spiele"
          description="Die juengsten Ergebnisse und zuletzt gespielten Begegnungen aller sichtbaren Mannschaften."
        >
          <div className="space-y-3">
            {previousMatches.length ? (
              previousMatches.map(renderMatchCard)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                Es wurden noch keine vergangenen Spiele gefunden.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Letzte Nachrichten"
        description="Neueste Meldungen aus Team- und Direktchats auf einen Blick."
      >
        <div className="space-y-3">
          {recentMessages.map((message) => {
            const sender = users.find((user) => user.id === message.senderId);
            const conversation = conversations.find(
              (entry) => entry.id === message.conversationId,
            );

            return (
              <div
                key={message.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {sender?.fullName}
                  </p>
                  <span className="text-xs text-slate-500">
                    {new Date(message.createdAt).toLocaleString("de-DE")}
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-blue-700">
                  {conversation?.title}
                </p>
                <p className="mt-3 text-sm text-slate-600">{message.content}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
