import { Link } from "react-router-dom";
import {
  Briefcase,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Users,
  Volleyball,
} from "lucide-react";
import { useAppStore } from "@/store";
import StatCard from "@/components/StatCard";
import SectionCard from "@/components/SectionCard";

export default function DashboardHome() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const messages = useAppStore((state) => state.messages);
  const conversations = useAppStore((state) => state.conversations);
  const matches = useAppStore((state) => state.matches);
  const currentUserId = useAppStore((state) => state.currentUserId);

  const currentUser = users.find((user) => user.id === currentUserId) ?? null;
  const canOpenAllTeams =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const canOpenTeam = (teamId: string) =>
    Boolean(canOpenAllTeams || currentUser?.teamIds.includes(teamId));
  const visibleTeams = teams;
  const visibleMatches = matches
    .sort(
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

  const getTeamById = (teamId: string) => teams.find((team) => team.id === teamId);
  const formatMatchDate = (kickoffAt: string) =>
    new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(kickoffAt));

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
    const homeTeamName = match.homeTeamName || (match.isHome ? team?.name ?? match.opponent : match.opponent);
    const awayTeamName = match.awayTeamName || (match.isHome ? match.opponent : team?.name ?? match.opponent);

    const cardContent = (
      <>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {team?.name ?? "Mannschaft"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {team?.ageGroup ?? ""}
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-900 shadow-sm">
            {formatMatchDate(match.kickoffAt)}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {renderTeamLogo(match.homeLogoUrl, homeTeamName)}
            <p className="line-clamp-2 text-sm font-semibold text-slate-900">
              {homeTeamName}
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
            vs
          </span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <p className="line-clamp-2 text-right text-sm font-semibold text-slate-900">
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

  return (
    <div className="space-y-6">
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
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                      {team.ageGroup}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
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
