import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, MapPin, Plus, Volleyball, X } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

const emptyForm = {
  name: "",
  ageGroup: "",
  season: "2026/2027",
  trainingDay: "",
  location: "",
  notes: "",
  fussballDeTeamId: "",
};

export default function TeamsPage() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const matches = useAppStore((state) => state.matches);
  const addTeam = useAppStore((state) => state.addTeam);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const [form, setForm] = useState(emptyForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canManageTeams =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const visibleTeams = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (canManageTeams) {
      return teams;
    }

    return teams.filter((team) => currentUser.teamIds.includes(team.id));
  }, [canManageTeams, currentUser, teams]);
  const now = Date.now();

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

  return (
    <div className="space-y-6">
      <SectionCard
        title="Mannschaften"
        description="Alle Teams kompakt im Ueberblick mit Teamfoto, naechstem Spiel und letztem Ergebnis."
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            {visibleTeams.length === 1
              ? "1 Mannschaft sichtbar"
              : `${visibleTeams.length} Mannschaften sichtbar`}
          </div>

          {canManageTeams ? (
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              {showCreateForm ? <X size={18} /> : <Plus size={18} />}
              {showCreateForm ? "Formular schliessen" : "Neue Mannschaft anlegen"}
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleTeams.map((team) => {
            const trainers = users.filter(
              (user) => user.role === "trainer" && user.teamIds.includes(team.id),
            );
            const players = users.filter(
              (user) => user.role === "player" && user.teamIds.includes(team.id),
            );
            const teamMatches = matches
              .filter((match) => match.teamId === team.id)
              .sort(
                (left, right) =>
                  new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
              );
            const nextMatch =
              teamMatches.find((match) => new Date(match.kickoffAt).getTime() >= now) ?? null;
            const lastMatch =
              [...teamMatches]
                .reverse()
                .find((match) => new Date(match.kickoffAt).getTime() < now) ?? null;
            const getHomeTeamName = (match: (typeof teamMatches)[number]) =>
              match.homeTeamName || (match.isHome ? team.name : match.opponent);
            const getAwayTeamName = (match: (typeof teamMatches)[number]) =>
              match.awayTeamName || (match.isHome ? match.opponent : team.name);

            return (
              <Link
                key={team.id}
                to={`/dashboard/teams/${team.id}/dashboard`}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-lg"
              >
                <div className="flex h-full flex-col">
                  <div className="relative h-40 overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700">
                    {team.photoUrl ? (
                      <img
                        src={team.photoUrl}
                        alt={team.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 text-white backdrop-blur">
                          <Volleyball size={28} />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
                        {team.ageGroup}
                      </p>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">{team.name}</h3>
                          <p className="mt-1 text-sm text-blue-50/90">{team.trainingDay}</p>
                        </div>
                        <ChevronRight
                          size={20}
                          className="mt-1 shrink-0 text-white/90 transition group-hover:translate-x-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <MapPin size={16} className="text-blue-700" />
                      <span>{team.location}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Trainer
                        </p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">
                          {trainers.length}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Spielerinnen
                        </p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">
                          {players.length}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                          <CalendarDays size={15} />
                          Naechstes Spiel
                        </div>
                        {nextMatch ? (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                {renderTeamLogo(
                                  nextMatch.homeLogoUrl,
                                  getHomeTeamName(nextMatch),
                                )}
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {getHomeTeamName(nextMatch)}
                                </p>
                              </div>
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                                vs
                              </span>
                              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                                <p className="truncate text-right text-sm font-semibold text-slate-900">
                                  {getAwayTeamName(nextMatch)}
                                </p>
                                {renderTeamLogo(
                                  nextMatch.awayLogoUrl,
                                  getAwayTeamName(nextMatch),
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-slate-600">
                              {formatMatchDate(nextMatch.kickoffAt)}
                            </p>
                            <p className="text-sm text-slate-500">{nextMatch.location}</p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            Noch kein kommendes Spiel vorhanden.
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                          <CalendarDays size={15} />
                          Letztes Spiel
                        </div>
                        {lastMatch ? (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                {renderTeamLogo(
                                  lastMatch.homeLogoUrl,
                                  getHomeTeamName(lastMatch),
                                )}
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {getHomeTeamName(lastMatch)}
                                </p>
                              </div>
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                                vs
                              </span>
                              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                                <p className="truncate text-right text-sm font-semibold text-slate-900">
                                  {getAwayTeamName(lastMatch)}
                                </p>
                                {renderTeamLogo(
                                  lastMatch.awayLogoUrl,
                                  getAwayTeamName(lastMatch),
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-slate-600">
                              {formatMatchDate(lastMatch.kickoffAt)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {lastMatch.result ? `Ergebnis ${lastMatch.result}` : lastMatch.location}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            Noch kein vergangenes Spiel vorhanden.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!visibleTeams.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              Fuer diesen Zugang sind aktuell keine Mannschaften sichtbar.
            </div>
          ) : null}
        </div>
      </SectionCard>

      {canManageTeams && showCreateForm ? (
        <SectionCard
          title="Neue Mannschaft anlegen"
          description="Hier kannst du weitere Teams fuer neue Jahrgaenge oder Staffeln anlegen."
        >
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await addTeam(form);
              if (result.success) {
                setForm(emptyForm);
                setShowCreateForm(false);
              }
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Teamname</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="z. B. SG Wiking U11"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Altersklasse</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.ageGroup}
                  onChange={(event) => setForm({ ...form, ageGroup: event.target.value })}
                  placeholder="U11"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Saison</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.season}
                  onChange={(event) => setForm({ ...form, season: event.target.value })}
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Trainingstage</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.trainingDay}
                onChange={(event) => setForm({ ...form, trainingDay: event.target.value })}
                placeholder="Dienstag & Freitag, 17:30 Uhr"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Ort</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Rasenplatz 2"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                fussball.de Team-ID
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.fussballDeTeamId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fussballDeTeamId: event.target.value
                      .trim()
                      .replace(/[^a-z0-9]/gi, "")
                      .toUpperCase(),
                  })
                }
                placeholder="optional fuer Spielplan-Import"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Liga, Schwerpunkte, Besonderheiten"
              />
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              <Plus size={18} />
              Mannschaft anlegen
            </button>
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}
