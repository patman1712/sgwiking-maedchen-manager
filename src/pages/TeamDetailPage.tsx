import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ImagePlus, MapPin, MessageSquare, Shield, Trophy } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";

const teamSections = [
  { key: "dashboard", label: "Dashboard" },
  { key: "kader", label: "Kader" },
  { key: "spielplan", label: "Spielplan" },
  { key: "inventar", label: "Inventar" },
  { key: "verwaltung", label: "Verwaltung" },
] as const;

type TeamSection = (typeof teamSections)[number]["key"];

export default function TeamDetailPage() {
  const { teamId, section } = useParams();
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const matches = useAppStore((state) => state.matches);
  const conversations = useAppStore((state) => state.conversations);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateTeam = useAppStore((state) => state.updateTeam);
  const uploadTeamPhoto = useAppStore((state) => state.uploadTeamPhoto);
  const addMatch = useAppStore((state) => state.addMatch);
  const updateMatch = useAppStore((state) => state.updateMatch);
  const deleteMatch = useAppStore((state) => state.deleteMatch);
  const ensureTeamConversation = useAppStore((state) => state.ensureTeamConversation);
  const navigate = useNavigate();

  const activeSection = teamSections.some((entry) => entry.key === section)
    ? (section as TeamSection)
    : "dashboard";
  const team = teams.find((entry) => entry.id === teamId);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [imageModal, setImageModal] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    ageGroup: "",
    season: "",
    trainingDay: "",
    location: "",
    notes: "",
  });
  const [teamPhotoUploading, setTeamPhotoUploading] = useState(false);
  const [teamPhotoError, setTeamPhotoError] = useState("");
  const [teamPhotoSuccess, setTeamPhotoSuccess] = useState("");
  const [matchForm, setMatchForm] = useState({
    opponent: "",
    kickoffAt: "",
    location: "",
    isHome: true,
  });
  const [matchResultDrafts, setMatchResultDrafts] = useState<Record<string, string>>({});

  const assignedTrainers = useMemo(
    () =>
      users
        .filter((user) => user.role === "trainer" && user.teamIds.includes(teamId ?? ""))
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "de")),
    [teamId, users],
  );
  const assignedPlayers = useMemo(
    () =>
      users
        .filter((user) => user.role === "player" && user.teamIds.includes(teamId ?? ""))
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "de")),
    [teamId, users],
  );
  const canManagePlayersHere =
    currentUser?.role === "admin" ||
    currentUser?.role === "board" ||
    assignedTrainers.some((trainer) => trainer.id === currentUserId);
  const canManageMatchesHere = canManagePlayersHere;
  const canEditTeam =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const existingConversationId = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.type === "team" && conversation.teamId === teamId,
      )?.id ?? null,
    [conversations, teamId],
  );

  useEffect(() => {
    if (!team) {
      return;
    }

    setForm({
      name: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      trainingDay: team.trainingDay,
      location: team.location,
      notes: team.notes,
    });
  }, [team]);

  if (!teamId || !team) {
    return <Navigate to="/dashboard/teams" replace />;
  }

  if (section && !teamSections.some((entry) => entry.key === section)) {
    return <Navigate to={`/dashboard/teams/${team.id}`} replace />;
  }

  const teamTrainerCount = assignedTrainers.length;
  const teamPlayerCount = assignedPlayers.length;
  const teamMatches = useMemo(
    () =>
      matches
        .filter((match) => match.teamId === team.id)
        .slice()
        .sort(
          (left, right) =>
            new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
        ),
    [matches, team.id],
  );
  const nextMatch = useMemo(() => {
    const nowDate = Date.now();
    return (
      teamMatches.find((match) => new Date(match.kickoffAt).getTime() > nowDate) ?? null
    );
  }, [teamMatches]);
  const lastMatch = useMemo(() => {
    const nowDate = Date.now();
    const pastMatches = teamMatches.filter(
      (match) => new Date(match.kickoffAt).getTime() <= nowDate,
    );
    return pastMatches.length ? pastMatches[pastMatches.length - 1] : null;
  }, [teamMatches]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/dashboard/teams"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <ChevronLeft size={16} />
            Zurueck zur Mannschaftsuebersicht
          </Link>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">{team.name}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Eigene Bereiche fuer Kader, Spielplan, Inventar und Verwaltung
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const conversationId =
              existingConversationId ?? (await ensureTeamConversation(team.id));
            navigate(`/dashboard/messages?conversation=${conversationId}`);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
        >
          <MessageSquare size={18} />
          Teamchat oeffnen
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          {teamSections.map((item) => (
            <Link
              key={item.key}
              to={`/dashboard/teams/${team.id}/${item.key}`}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                activeSection === item.key
                  ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                  : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-900",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trainer</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{teamTrainerCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Spielerinnen</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{teamPlayerCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Saison</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{team.season}</p>
          </div>
        </div>
      </div>

      {activeSection === "dashboard" ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionCard
            title="Mannschaftsfoto"
            description="Das Foto erscheint als Titelbild im Team-Dashboard."
          >
            <div className="space-y-4">
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50">
                {team.photoUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      setImageModal({
                        src: team.photoUrl!,
                        alt: team.name,
                      })
                    }
                    className="h-full w-full"
                  >
                    <img
                      src={team.photoUrl}
                      alt={team.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <div className="flex flex-col items-center px-8 py-10 text-slate-400">
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-100 text-blue-800">
                      <Shield size={42} />
                    </div>
                    <p className="mt-4 text-sm">Noch kein Mannschaftsfoto hinterlegt</p>
                  </div>
                )}
              </div>

              {canEditTeam ? (
                <form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setTeamPhotoError("");
                    setTeamPhotoSuccess("");
                    const formElement = event.currentTarget;
                    const fileInput = formElement.elements.namedItem(
                      "teamPhoto",
                    ) as HTMLInputElement | null;
                    const file = fileInput?.files?.[0];

                    if (!file) {
                      setTeamPhotoError("Bitte zuerst ein Bild auswaehlen.");
                      return;
                    }

                    setTeamPhotoUploading(true);

                    try {
                      const optimized = await optimizeImageForUpload(file);
                      const result = await uploadTeamPhoto(team.id, optimized);

                      if (!result.success) {
                        setTeamPhotoError(result.error ?? "Foto konnte nicht gespeichert werden.");
                        return;
                      }

                      formElement.reset();
                      setTeamPhotoSuccess("Mannschaftsfoto gespeichert.");
                    } catch {
                      setTeamPhotoError("Foto konnte nicht verarbeitet werden.");
                    } finally {
                      setTeamPhotoUploading(false);
                    }
                  }}
                >
                  {teamPhotoError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {teamPhotoError}
                    </div>
                  ) : null}
                  {teamPhotoSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {teamPhotoSuccess}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Foto</span>
                    <input
                      name="teamPhoto"
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={teamPhotoUploading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ImagePlus size={18} />
                    {teamPhotoUploading ? "Wird gespeichert..." : "Foto hochladen"}
                  </button>
                </form>
              ) : null}
            </div>
          </SectionCard>

          <div className="grid gap-6">
            <SectionCard
              title="Spiele"
              description="Naechstes Spiel und letztes Spiel als schnelle Uebersicht."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3 text-slate-500">
                    <CalendarDays size={18} />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                      Naechstes Spiel
                    </p>
                  </div>
                  {nextMatch ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-lg font-semibold text-slate-900">
                        {nextMatch.isHome ? "Heim" : "Auswaerts"} vs. {nextMatch.opponent}
                      </p>
                      <p className="text-sm text-slate-600">
                        {new Date(nextMatch.kickoffAt).toLocaleString("de-DE")}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={16} />
                        <span>{nextMatch.location}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Noch kein Spiel geplant.</p>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3 text-slate-500">
                    <Trophy size={18} />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                      Letztes Spiel
                    </p>
                  </div>
                  {lastMatch ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-lg font-semibold text-slate-900">
                        {lastMatch.isHome ? "Heim" : "Auswaerts"} vs. {lastMatch.opponent}
                      </p>
                      <p className="text-sm text-slate-600">
                        {new Date(lastMatch.kickoffAt).toLocaleString("de-DE")}
                      </p>
                      <p className="text-sm text-slate-700">
                        Ergebnis: {lastMatch.result || "Noch offen"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Noch kein Spiel eingetragen.</p>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Kaderuebersicht"
              description="Schneller Blick auf die aktuelle Kaderstaerke."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Trainer-Betreuer
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {teamTrainerCount}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Spielerinnen
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {teamPlayerCount}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeSection === "kader" ? (
        <div className="space-y-6">
          <SectionCard
            title="Trainer-Betreuer"
            description="Hier werden nur die bereits zugewiesenen Trainerinnen und Trainer dieser Mannschaft angezeigt."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assignedTrainers.length ? (
                assignedTrainers.map((trainer) => (
                  <div
                    key={trainer.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                        <Shield size={28} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {trainer.fullName}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">Trainer-Betreuer</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-slate-600">
                      <p className="truncate">{trainer.email}</p>
                      {trainer.phone ? <p>{trainer.phone}</p> : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  Dieser Mannschaft ist aktuell noch kein Trainer zugewiesen.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Spielerinnen"
            description="Hier werden nur die bereits zugewiesenen Spielerinnen dieser Mannschaft angezeigt."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assignedPlayers.length ? (
                assignedPlayers.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => navigate(`/dashboard/players/${player.id}`)}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {player.avatarUrl ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setImageModal({
                                src: player.avatarUrl!,
                                alt: player.fullName,
                              });
                            }}
                            className="overflow-hidden rounded-2xl"
                          >
                            <img
                              src={player.avatarUrl}
                              alt={player.fullName}
                              className="h-20 w-20 rounded-2xl object-cover"
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                            <Shield size={28} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-slate-900">
                            {player.fullName}
                          </h3>
                          <p className="mt-1 truncate text-sm text-slate-500">{player.email}</p>
                          {player.phone ? (
                            <p className="mt-1 text-sm text-slate-500">{player.phone}</p>
                          ) : null}
                        </div>
                      </div>

                      {canManagePlayersHere ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/dashboard/players/${player.id}`);
                          }}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                        >
                          Bearbeiten
                        </button>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  Dieser Mannschaft sind aktuell noch keine Spielerinnen zugewiesen.
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl bg-blue-50 px-5 py-4 text-sm text-blue-900">
              Teamzuweisungen werden im Bereich{" "}
              <span className="font-semibold">Spielerinnen</span> gepflegt. Dort duerfen nur
              Admin und Vorstand die Zuordnung aendern.
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeSection === "spielplan" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            title="Spielplan"
            description="Hier kannst du kuenftig Spiele, Treffpunkte und Uhrzeiten der Mannschaft organisieren."
          >
            <div className="space-y-4">
              {teamMatches.length ? (
                <div className="space-y-3">
                  {teamMatches.map((match) => (
                    <div
                      key={match.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {match.isHome ? "Heim" : "Auswaerts"} vs. {match.opponent}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {new Date(match.kickoffAt).toLocaleString("de-DE")}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{match.location}</p>
                        </div>

                        {canManageMatchesHere ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <input
                              className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              value={matchResultDrafts[match.id] ?? (match.result ?? "")}
                              placeholder="Ergebnis"
                              onChange={(event) =>
                                setMatchResultDrafts((current) => ({
                                  ...current,
                                  [match.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const nextValue =
                                  matchResultDrafts[match.id] ?? (match.result ?? "");
                                await updateMatch(match.id, { result: nextValue });
                              }}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                            >
                              Speichern
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const confirmed = window.confirm("Spiel wirklich loeschen?");
                                if (!confirmed) {
                                  return;
                                }
                                await deleteMatch(match.id);
                              }}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Loeschen
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700">
                            Ergebnis: {match.result || "Noch offen"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-6">
                  <p className="text-sm font-semibold text-blue-900">Noch kein Spiel eingetragen</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Trage hier die Spiele ein, damit das Team-Dashboard das naechste und letzte
                    Spiel anzeigen kann.
                  </p>
                </div>
              )}

              {canManageMatchesHere ? (
                <form
                  className="rounded-3xl border border-slate-200 bg-white p-5"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const kickoffIso = matchForm.kickoffAt
                      ? new Date(matchForm.kickoffAt).toISOString()
                      : "";

                    await addMatch({
                      teamId: team.id,
                      opponent: matchForm.opponent,
                      kickoffAt: kickoffIso,
                      location: matchForm.location,
                      isHome: matchForm.isHome,
                    });

                    setMatchForm({ opponent: "", kickoffAt: "", location: "", isHome: true });
                  }}
                >
                  <p className="text-sm font-semibold text-slate-900">Spiel hinzufuegen</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Gegner</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={matchForm.opponent}
                        onChange={(event) =>
                          setMatchForm({ ...matchForm, opponent: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Datum & Uhrzeit
                      </span>
                      <input
                        type="datetime-local"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={matchForm.kickoffAt}
                        onChange={(event) =>
                          setMatchForm({ ...matchForm, kickoffAt: event.target.value })
                        }
                        required
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Ort</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={matchForm.location}
                        onChange={(event) =>
                          setMatchForm({ ...matchForm, location: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={matchForm.isHome}
                        onChange={(event) =>
                          setMatchForm({ ...matchForm, isHome: event.target.checked })
                        }
                      />
                      <span className="text-sm text-slate-700">Heimspiel</span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="mt-4 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                  >
                    Spiel speichern
                  </button>
                </form>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Schnellinfos"
            description="Wichtige Teamdaten fuer die Spielorganisation."
          >
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Training</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{team.trainingDay}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ort</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{team.location}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notizen</p>
                <p className="mt-1 text-sm text-slate-700">
                  {team.notes || "Noch keine Notizen fuer diese Mannschaft hinterlegt."}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeSection === "inventar" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            title="Inventar"
            description="Eigener Bereich fuer Trainingsmaterial, Trikots und Ausruestung dieser Mannschaft."
          >
            <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-6">
              <p className="text-sm font-semibold text-blue-900">Inventar-Untermenue aktiv</p>
              <p className="mt-2 text-sm text-slate-600">
                Dieser Bereich ist nun fest fuer {team.name} vorhanden. Als Naechstes koennen wir
                hier Balle, Leibchen, Trikotsaetze und Materiallisten ergaenzen.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Empfohlene Struktur"
            description="So kann das Inventar spaeter aufgeteilt werden."
          >
            <div className="grid gap-3">
              {["Spielkleidung", "Trainingsmaterial", "Torwartausruestung", "Sonstiges"].map(
                (item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-900">{item}</p>
                  </div>
                ),
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeSection === "verwaltung" ? (
        <SectionCard
          title="Teamverwaltung"
          description="Bearbeitung der Mannschaftsstammdaten direkt in ihrem eigenen Verwaltungsbereich."
        >
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await updateTeam(team.id, form);
            }}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Teamname</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Altersklasse</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.ageGroup}
                  onChange={(event) => setForm({ ...form, ageGroup: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Saison</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.season}
                  onChange={(event) => setForm({ ...form, season: event.target.value })}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Training</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.trainingDay}
                onChange={(event) => setForm({ ...form, trainingDay: event.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Ort</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Team speichern
              </button>

              <button
                type="button"
                onClick={async () => {
                  const conversationId =
                    existingConversationId ?? (await ensureTeamConversation(team.id));
                  navigate(`/dashboard/messages?conversation=${conversationId}`);
                }}
                className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
              >
                Teamchat oeffnen
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {imageModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-6"
          onClick={() => setImageModal(null)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-[2rem] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={imageModal.src}
              alt={imageModal.alt}
              className="max-h-[82vh] max-w-[82vw] rounded-[1.5rem] object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
