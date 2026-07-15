import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ImagePlus, MapPin, MessageSquare, Package, Shield, Trash2, Trophy } from "lucide-react";
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
  const inventoryItems = useAppStore((state) => state.inventoryItems);
  const conversations = useAppStore((state) => state.conversations);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateTeam = useAppStore((state) => state.updateTeam);
  const uploadTeamPhoto = useAppStore((state) => state.uploadTeamPhoto);
  const importTeamMatchesFromFussballDe = useAppStore(
    (state) => state.importTeamMatchesFromFussballDe,
  );
  const deleteTeamMatchesBySeason = useAppStore(
    (state) => state.deleteTeamMatchesBySeason,
  );
  const addInventoryItem = useAppStore((state) => state.addInventoryItem);
  const deleteInventoryItem = useAppStore((state) => state.deleteInventoryItem);
  const addMatch = useAppStore((state) => state.addMatch);
  const updateMatch = useAppStore((state) => state.updateMatch);
  const deleteMatch = useAppStore((state) => state.deleteMatch);
  const ensureTeamConversation = useAppStore((state) => state.ensureTeamConversation);
  const navigate = useNavigate();

  const team = teams.find((entry) => entry.id === teamId);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canViewTeamManagement =
    currentUser?.role === "admin" ||
    currentUser?.role === "board" ||
    (currentUser?.role === "trainer" && currentUser.teamIds.includes(teamId ?? ""));
  const visibleTeamSections = useMemo(
    () =>
      teamSections.filter((entry) =>
        entry.key === "verwaltung" ? canViewTeamManagement : true,
      ),
    [canViewTeamManagement],
  );
  const activeSection = visibleTeamSections.some((entry) => entry.key === section)
    ? (section as TeamSection)
    : "dashboard";
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
    fussballDeTeamId: "",
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
  const [matchImporting, setMatchImporting] = useState(false);
  const [seasonDeleting, setSeasonDeleting] = useState<string | null>(null);
  const [matchImportMessage, setMatchImportMessage] = useState("");
  const [matchImportError, setMatchImportError] = useState("");
  const [expandedArchivedSeasons, setExpandedArchivedSeasons] = useState<string[]>([]);
  const [leagueTable, setLeagueTable] = useState<{
    season: string;
    competition: string | null;
    standings: Array<{
      rank: string;
      teamName: string;
      logoUrl: string | null;
      matchesPlayed: string;
      wins: string;
      draws: string;
      losses: string;
      goals: string;
      goalDifference: string;
      points: string;
      isOwnTeam: boolean;
    }>;
  } | null>(null);
  const [leagueTableLoading, setLeagueTableLoading] = useState(false);
  const [leagueTableError, setLeagueTableError] = useState("");
  const [inventoryForm, setInventoryForm] = useState({
    category: "Trikots",
    name: "",
    quantity: "1",
    productInfo: "",
    notes: "",
    condition: "gut",
  });
  const [inventoryImageFile, setInventoryImageFile] = useState<File | null>(null);
  const [inventorySubmitting, setInventorySubmitting] = useState(false);
  const [inventoryDeletingId, setInventoryDeletingId] = useState<string | null>(null);
  const [inventoryMessage, setInventoryMessage] = useState("");
  const [inventoryError, setInventoryError] = useState("");
  const [showInventoryForm, setShowInventoryForm] = useState(false);

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
  const canManageInventoryHere = canManagePlayersHere;
  const canEditTeam =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const canDeleteSeasonMatches = currentUser?.role === "admin";
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
      fussballDeTeamId: team.fussballDeTeamId ?? "",
    });
  }, [team]);

  if (!teamId || !team) {
    return <Navigate to="/dashboard/teams" replace />;
  }

  if (
    currentUser &&
    currentUser.role !== "admin" &&
    currentUser.role !== "board" &&
    !currentUser.teamIds.includes(team.id)
  ) {
    const fallbackTeamId = currentUser.teamIds[0];
    return fallbackTeamId ? (
      <Navigate to={`/dashboard/teams/${fallbackTeamId}/dashboard`} replace />
    ) : (
      <Navigate to="/dashboard/teams" replace />
    );
  }

  if (section && !visibleTeamSections.some((entry) => entry.key === section)) {
    return <Navigate to={`/dashboard/teams/${team.id}/dashboard`} replace />;
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

  const teamInventoryItems = useMemo(
    () =>
      inventoryItems
        .filter((item) => item.teamId === team.id)
        .slice()
        .sort((left, right) => {
          const categoryCompare = left.category.localeCompare(right.category, "de");
          if (categoryCompare !== 0) {
            return categoryCompare;
          }
          return left.name.localeCompare(right.name, "de");
        }),
    [inventoryItems, team.id],
  );

  const inventoryItemsByCategory = useMemo(
    () =>
      teamInventoryItems.reduce<Record<string, typeof teamInventoryItems>>((accumulator, item) => {
        const key = item.category || "Sonstiges";
        const existing = accumulator[key] ?? [];
        accumulator[key] = [...existing, item];
        return accumulator;
      }, {}),
    [teamInventoryItems],
  );

  const inventoryCategoryEntries = useMemo(
    () => Object.entries(inventoryItemsByCategory),
    [inventoryItemsByCategory],
  );

  const getHomeTeamName = (match: (typeof teamMatches)[number]) =>
    match.homeTeamName || (match.isHome ? team.name : match.opponent);

  const getAwayTeamName = (match: (typeof teamMatches)[number]) =>
    match.awayTeamName || (match.isHome ? match.opponent : team.name);

  const getConditionBadgeClassName = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "neu":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "gut":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "gebraucht":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "reparaturbedarf":
        return "border-rose-200 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-100 text-slate-700";
    }
  };

  const seasonLabelForKickoff = (kickoffAt: string) => {
    const date = new Date(kickoffAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (month >= 7) {
      return `${year}/${year + 1}`;
    }

    return `${year - 1}/${year}`;
  };

  const teamMatchesBySeason = teamMatches.reduce<Record<string, typeof teamMatches>>(
    (accumulator, match) => {
      const label = seasonLabelForKickoff(match.kickoffAt);
      const existing = accumulator[label] ?? [];
      accumulator[label] = [...existing, match];
      return accumulator;
    },
    {},
  );

  const teamSeasonEntries = Object.entries(teamMatchesBySeason).sort(([left], [right]) => {
    const leftStart = Number(left.split("/")[0] ?? 0);
    const rightStart = Number(right.split("/")[0] ?? 0);
    return rightStart - leftStart;
  });
  const primarySeasonLabel = teamMatchesBySeason[team.season]
    ? team.season
    : (teamSeasonEntries[0]?.[0] ?? team.season);
  const primarySeasonMatches = teamMatchesBySeason[primarySeasonLabel] ?? [];
  const archivedSeasonEntries = teamSeasonEntries.filter(
    ([seasonLabel]) => seasonLabel !== primarySeasonLabel,
  );

  const handleDeleteSeasonMatches = useCallback(
    async (seasonLabel: string) => {
      const confirmed = window.confirm(
        `Wirklich alle Spiele der Saison ${seasonLabel} fuer ${team.name} loeschen?`,
      );

      if (!confirmed) {
        return;
      }

      setMatchImportError("");
      setMatchImportMessage("");
      setSeasonDeleting(seasonLabel);

      const result = await deleteTeamMatchesBySeason(team.id, seasonLabel);

      if (result.success) {
        setMatchImportMessage(
          `${result.deletedCount ?? 0} Spiel(e) aus ${seasonLabel} wurden geloescht.`,
        );
      } else {
        setMatchImportError(
          result.error ?? "Saisondaten konnten nicht geloescht werden.",
        );
      }

      setSeasonDeleting(null);
    },
    [deleteTeamMatchesBySeason, team.id, team.name],
  );

  useEffect(() => {
    setExpandedArchivedSeasons([]);
  }, [team.id, primarySeasonLabel]);

  const loadLeagueTable = useCallback(async () => {
    if (!team.fussballDeTeamId) {
      setLeagueTable(null);
      setLeagueTableError("");
      return;
    }

    setLeagueTableLoading(true);
    setLeagueTableError("");

    try {
      const response = await fetch(
        `/api/teams/${team.id}/fussballde-table?season=${encodeURIComponent(team.season)}`,
      );
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Tabelle konnte nicht geladen werden.");
      }

      setLeagueTable({
        season: data.season,
        competition: data.competition,
        standings: data.standings ?? [],
      });
    } catch (error) {
      setLeagueTable(null);
      setLeagueTableError(
        error instanceof Error ? error.message : "Tabelle konnte nicht geladen werden.",
      );
    } finally {
      setLeagueTableLoading(false);
    }
  }, [team.fussballDeTeamId, team.id, team.season]);

  useEffect(() => {
    if (activeSection !== "spielplan") {
      return;
    }

    void loadLeagueTable();
  }, [activeSection, loadLeagueTable]);

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
          {visibleTeamSections.map((item) => (
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
              <div className="space-y-4">
                {canManageMatchesHere ? (
                  <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-950">
                          Spielplan von fussball.de testen
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Hinterlege in der Verwaltung die Team-ID und ziehe die Spiele per Klick
                          direkt in euren Spielplan. Danach gleicht der Server die Daten
                          automatisch 4x pro Tag ab.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={matchImporting || !team.fussballDeTeamId || !canManageMatchesHere}
                        onClick={async () => {
                          setMatchImportError("");
                          setMatchImportMessage("");
                          setMatchImporting(true);

                          const result = await importTeamMatchesFromFussballDe(team.id);

                          if (result.success) {
                            void loadLeagueTable();
                            setMatchImportMessage(
                              `${result.importedCount ?? 0} Spiel(e) von fussball.de importiert.`,
                            );
                          } else {
                            setMatchImportError(
                              result.error ?? "Spielplan konnte nicht importiert werden.",
                            );
                          }

                          setMatchImporting(false);
                        }}
                        className="rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {matchImporting ? "Import laeuft..." : "Spielplan importieren"}
                      </button>
                    </div>

                    {!team.fussballDeTeamId ? (
                      <p className="mt-3 text-sm text-amber-700">
                        Fuer den Import fehlt noch die fussball.de Team-ID in der Teamverwaltung.
                      </p>
                    ) : null}
                    {matchImportError ? (
                      <p className="mt-3 text-sm text-rose-700">{matchImportError}</p>
                    ) : null}
                    {matchImportMessage ? (
                      <p className="mt-3 text-sm text-emerald-700">{matchImportMessage}</p>
                    ) : null}
                  </div>
                ) : null}

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
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div className="flex items-center gap-3">
                          {nextMatch.homeLogoUrl ? (
                            <img
                              src={nextMatch.homeLogoUrl}
                              alt={getHomeTeamName(nextMatch)}
                              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                              <Shield size={16} />
                            </div>
                          )}
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                            {getHomeTeamName(nextMatch)}
                          </p>
                        </div>
                        <p className="text-center text-sm font-semibold text-slate-500">vs.</p>
                        <div className="flex items-center justify-start gap-3 sm:justify-end">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900 sm:text-right">
                            {getAwayTeamName(nextMatch)}
                          </p>
                          {nextMatch.awayLogoUrl ? (
                            <img
                              src={nextMatch.awayLogoUrl}
                              alt={getAwayTeamName(nextMatch)}
                              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                              <Shield size={16} />
                            </div>
                          )}
                        </div>
                      </div>
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
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div className="flex items-center gap-3">
                          {lastMatch.homeLogoUrl ? (
                            <img
                              src={lastMatch.homeLogoUrl}
                              alt={getHomeTeamName(lastMatch)}
                              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                              <Shield size={16} />
                            </div>
                          )}
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                            {getHomeTeamName(lastMatch)}
                          </p>
                        </div>
                        <p className="text-center text-sm font-semibold text-slate-500">
                          {lastMatch.result || "vs."}
                        </p>
                        <div className="flex items-center justify-start gap-3 sm:justify-end">
                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900 sm:text-right">
                            {getAwayTeamName(lastMatch)}
                          </p>
                          {lastMatch.awayLogoUrl ? (
                            <img
                              src={lastMatch.awayLogoUrl}
                              alt={getAwayTeamName(lastMatch)}
                              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                              <Shield size={16} />
                            </div>
                          )}
                        </div>
                      </div>
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
            description="Aktuelle Saison direkt im Blick, aeltere Saisons nur bei Bedarf aufklappen."
          >
            <div className="space-y-4">
              {teamMatches.length ? (
                <div className="space-y-3">
                  <div className="rounded-3xl border border-blue-100 bg-blue-50/60 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-800">
                          Aktuelle Saison
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {primarySeasonLabel}
                        </p>
                      </div>
                      {canDeleteSeasonMatches ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteSeasonMatches(primarySeasonLabel)}
                          disabled={seasonDeleting === primarySeasonLabel}
                          className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {seasonDeleting === primarySeasonLabel
                            ? "Wird geloescht..."
                            : `Saison ${primarySeasonLabel} loeschen`}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {primarySeasonMatches.map((match) => {
                    const isFriendlyMatch = (match.competition ?? "")
                      .toLowerCase()
                      .includes("freundschaft");
                    const homeTeamName = getHomeTeamName(match);
                    const awayTeamName = getAwayTeamName(match);

                    return (
                      <div
                        key={match.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {match.competition || "Spiel"}
                              </p>
                              {isFriendlyMatch ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                  Freundschaftsspiel
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                              <div className="flex items-center gap-3">
                                {match.homeLogoUrl ? (
                                  <img
                                    src={match.homeLogoUrl}
                                    alt={homeTeamName}
                                    className="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                                    <Shield size={18} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {homeTeamName}
                                  </p>
                                </div>
                              </div>

                              <div className="text-center">
                                <p className="text-base font-semibold text-slate-900">
                                  {match.result || "- : -"}
                                </p>
                              </div>

                              <div className="flex items-center justify-start gap-3 sm:justify-end">
                                <div className="min-w-0 text-left sm:text-right">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {awayTeamName}
                                  </p>
                                </div>
                                {match.awayLogoUrl ? (
                                  <img
                                    src={match.awayLogoUrl}
                                    alt={awayTeamName}
                                    className="h-12 w-12 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                                    <Shield size={18} />
                                  </div>
                                )}
                              </div>
                            </div>

                            <p className="mt-4 text-sm text-slate-600">
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
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {archivedSeasonEntries.length ? (
                    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Aeltere Saisons</p>
                      <div className="flex flex-wrap gap-2">
                        {archivedSeasonEntries.map(([seasonLabel]) => {
                          const isOpen = expandedArchivedSeasons.includes(seasonLabel);

                          return (
                            <button
                              key={seasonLabel}
                              type="button"
                              onClick={() =>
                                setExpandedArchivedSeasons((current) =>
                                  current.includes(seasonLabel)
                                    ? current.filter((entry) => entry !== seasonLabel)
                                    : [...current, seasonLabel],
                                )
                              }
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900"
                            >
                              {isOpen ? `${seasonLabel} schliessen` : `${seasonLabel} oeffnen`}
                            </button>
                          );
                        })}
                      </div>

                      {archivedSeasonEntries.map(([seasonLabel, seasonMatches]) =>
                        expandedArchivedSeasons.includes(seasonLabel) ? (
                          <div key={seasonLabel} className="space-y-3 pt-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <p className="text-sm font-semibold text-slate-900">
                                Saison {seasonLabel}
                              </p>
                              {canDeleteSeasonMatches ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteSeasonMatches(seasonLabel)}
                                  disabled={seasonDeleting === seasonLabel}
                                  className="rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {seasonDeleting === seasonLabel
                                    ? "Wird geloescht..."
                                    : `Saison ${seasonLabel} loeschen`}
                                </button>
                              ) : null}
                            </div>
                            {seasonMatches.map((match) => {
                              const homeTeamName = getHomeTeamName(match);
                              const awayTeamName = getAwayTeamName(match);

                              return (
                                <div
                                  key={match.id}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {(match.competition || "Spiel").trim()}
                                      </p>
                                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                        <div className="flex items-center gap-3">
                                          {match.homeLogoUrl ? (
                                            <img
                                              src={match.homeLogoUrl}
                                              alt={homeTeamName}
                                              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                                              loading="lazy"
                                            />
                                          ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                                              <Shield size={16} />
                                            </div>
                                          )}
                                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                                            {homeTeamName}
                                          </p>
                                        </div>

                                        <p className="text-center text-sm font-semibold text-slate-700">
                                          {match.result || "- : -"}
                                        </p>

                                        <div className="flex items-center justify-start gap-3 sm:justify-end">
                                          <p className="min-w-0 truncate text-sm font-semibold text-slate-900 sm:text-right">
                                            {awayTeamName}
                                          </p>
                                          {match.awayLogoUrl ? (
                                            <img
                                              src={match.awayLogoUrl}
                                              alt={awayTeamName}
                                              className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                                              loading="lazy"
                                            />
                                          ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-900">
                                              <Shield size={16} />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <p className="mt-3 text-sm text-slate-500">
                                        {new Date(match.kickoffAt).toLocaleString("de-DE")}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null,
                      )}
                    </div>
                  ) : null}
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
            title="Tabelle"
            description="Direkt von fussball.de geladen, sobald fuer die Mannschaft eine Staffel verfuegbar ist."
          >
            <div className="space-y-3">
              {leagueTableLoading ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  Tabelle wird geladen...
                </div>
              ) : null}

              {!leagueTableLoading && leagueTableError ? (
                <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
                  {leagueTableError}
                </div>
              ) : null}

              {!leagueTableLoading && !leagueTableError && leagueTable?.standings.length ? (
                <>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {leagueTable.season}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {leagueTable.competition || "Tabelle"}
                    </p>
                  </div>

                  {leagueTable.standings.map((entry) => (
                    <div
                      key={`${entry.rank}-${entry.teamName}`}
                      className={cn(
                        "grid gap-3 rounded-2xl border px-4 py-3 md:grid-cols-[auto_1fr_auto] md:items-center",
                        entry.isOwnTeam
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-slate-50",
                      )}
                    >
                      <p className="text-base font-semibold text-slate-900">{entry.rank}</p>
                      <div className="flex items-center gap-3">
                        {entry.logoUrl ? (
                          <img
                            src={entry.logoUrl}
                            alt={entry.teamName}
                            className="h-10 w-10 rounded-2xl border border-slate-200 bg-white object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-900">
                            <Shield size={16} />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900">{entry.teamName}</p>
                          <p className="text-xs text-slate-500">
                            {entry.matchesPlayed} Sp. | {entry.wins} S | {entry.draws} U | {entry.losses} N
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{entry.points} Pkt.</p>
                        <p className="text-xs text-slate-500">{entry.goals}</p>
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {!leagueTableLoading && !leagueTableError && !leagueTable?.standings.length ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  Fuer diese Saison ist bei fussball.de aktuell noch keine Tabelle verfuegbar.
                </div>
              ) : null}
            </div>
          </SectionCard>

        </div>
      ) : null}

      {activeSection === "inventar" ? (
        <div className="space-y-6">
          <SectionCard
            title="Inventarliste"
            description="Sauber nach Kategorien sortiert, mit Menge, Zustand, Infos, Notizen und Bildern."
          >
            <div className="space-y-4">
              {inventoryError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {inventoryError}
                </div>
              ) : null}

              {inventoryMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {inventoryMessage}
                </div>
              ) : null}

              {canManageInventoryHere ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-blue-950">Inventar verwalten</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Trainer, Vorstand und Admin koennen neue Produkte zur Liste hinzufuegen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInventoryError("");
                      setInventoryMessage("");
                      setShowInventoryForm((current) => !current);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                  >
                    <ImagePlus size={18} />
                    {showInventoryForm ? "Formular schliessen" : "Inventar hinzufuegen"}
                  </button>
                </div>
              ) : null}

              {inventoryCategoryEntries.length ? (
                inventoryCategoryEntries.map(([category, items]) => (
                  <div key={category} className="space-y-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{category}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {items.length} Eintrag{items.length === 1 ? "" : "e"}
                      </p>
                    </div>

                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {item.imageUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setImageModal({
                                    src: item.imageUrl!,
                                    alt: item.name,
                                  })
                                }
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-24 w-24 object-cover"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                                <Package size={28} />
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {item.quantity} Stk.
                                </span>
                                <span
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-semibold",
                                    getConditionBadgeClassName(item.condition),
                                  )}
                                >
                                  {item.condition || "ohne Zustand"}
                                </span>
                              </div>

                              {item.productInfo ? (
                                <p className="text-sm text-slate-700">{item.productInfo}</p>
                              ) : null}

                              {item.notes ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                  {item.notes}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {canManageInventoryHere ? (
                            <button
                              type="button"
                              disabled={inventoryDeletingId === item.id}
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  `${item.name} wirklich aus dem Inventar loeschen?`,
                                );

                                if (!confirmed) {
                                  return;
                                }

                                setInventoryError("");
                                setInventoryMessage("");
                                setInventoryDeletingId(item.id);
                                const result = await deleteInventoryItem(item.id);

                                if (!result.success) {
                                  setInventoryError(
                                    result.error ?? "Inventareintrag konnte nicht geloescht werden.",
                                  );
                                } else {
                                  setInventoryMessage("Inventareintrag wurde geloescht.");
                                }

                                setInventoryDeletingId(null);
                              }}
                              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={16} />
                              {inventoryDeletingId === item.id ? "Loesche..." : "Loeschen"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Noch kein Inventar fuer {team.name} erfasst
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Hier koennen Trikots, Baelle, Trainingsmaterial und weiteres Team-Equipment sauber gepflegt werden.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          {canManageInventoryHere && showInventoryForm ? (
            <SectionCard
              title="Inventar hinzufuegen"
              description="Neues Material mit Menge, Zustand, Infos und optionalem Bild erfassen."
            >
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setInventoryError("");
                  setInventoryMessage("");
                  setInventorySubmitting(true);

                  try {
                    const optimizedImage = inventoryImageFile
                      ? await optimizeImageForUpload(inventoryImageFile)
                      : null;
                    const result = await addInventoryItem({
                      teamId: team.id,
                      category: inventoryForm.category,
                      name: inventoryForm.name,
                      quantity: Number.parseInt(inventoryForm.quantity, 10) || 1,
                      productInfo: inventoryForm.productInfo,
                      notes: inventoryForm.notes,
                      condition: inventoryForm.condition,
                      imageFile: optimizedImage,
                    });

                    if (!result.success) {
                      setInventoryError(
                        result.error ?? "Inventareintrag konnte nicht gespeichert werden.",
                      );
                      return;
                    }

                    setInventoryForm({
                      category: "Trikots",
                      name: "",
                      quantity: "1",
                      productInfo: "",
                      notes: "",
                      condition: "gut",
                    });
                    setInventoryImageFile(null);
                    const formElement = event.currentTarget;
                    formElement.reset();
                    setInventoryMessage("Inventareintrag wurde gespeichert.");
                    setShowInventoryForm(false);
                  } catch {
                    setInventoryError("Bild konnte nicht verarbeitet werden.");
                  } finally {
                    setInventorySubmitting(false);
                  }
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Kategorie</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={inventoryForm.category}
                      onChange={(event) =>
                        setInventoryForm({ ...inventoryForm, category: event.target.value })
                      }
                    >
                      {["Trikots", "Baelle", "Leibchen", "Trainingsmaterial", "Torwart", "Sonstiges"].map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Zustand</span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={inventoryForm.condition}
                      onChange={(event) =>
                        setInventoryForm({ ...inventoryForm, condition: event.target.value })
                      }
                    >
                      {["neu", "gut", "gebraucht", "reparaturbedarf"].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Produkt</span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={inventoryForm.name}
                      onChange={(event) =>
                        setInventoryForm({ ...inventoryForm, name: event.target.value })
                      }
                      placeholder="z. B. Heimtrikot rot, Ballnetz, Trainingsball"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Anzahl</span>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={inventoryForm.quantity}
                      onChange={(event) =>
                        setInventoryForm({ ...inventoryForm, quantity: event.target.value })
                      }
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Produktinfo</span>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inventoryForm.productInfo}
                    onChange={(event) =>
                      setInventoryForm({ ...inventoryForm, productInfo: event.target.value })
                    }
                    placeholder="z. B. Groessen, Hersteller, Farbe, Satznummern oder weitere Details"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={inventoryForm.notes}
                    onChange={(event) =>
                      setInventoryForm({ ...inventoryForm, notes: event.target.value })
                    }
                    placeholder="z. B. bei wem das Material liegt oder was nachgekauft werden muss"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Bild optional</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800"
                    onChange={(event) => setInventoryImageFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={inventorySubmitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ImagePlus size={18} />
                    {inventorySubmitting ? "Wird gespeichert..." : "Inventar speichern"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInventoryForm(false)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </SectionCard>
          ) : null}
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
              if (!canEditTeam) {
                return;
              }
              await updateTeam(team.id, form);
            }}
          >
            {!canEditTeam ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Diese Daten koennen nur von Admin oder Vorstand bearbeitet werden.
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Teamname</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                disabled={!canEditTeam}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Altersklasse</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.ageGroup}
                  onChange={(event) => setForm({ ...form, ageGroup: event.target.value })}
                  disabled={!canEditTeam}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Saison</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.season}
                  onChange={(event) => setForm({ ...form, season: event.target.value })}
                  disabled={!canEditTeam}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Training</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.trainingDay}
                onChange={(event) => setForm({ ...form, trainingDay: event.target.value })}
                disabled={!canEditTeam}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Ort</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                disabled={!canEditTeam}
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
                placeholder="z. B. 011MID47D4000000VTVG0001VTR8C1K7"
                disabled={!canEditTeam}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                disabled={!canEditTeam}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              {canEditTeam ? (
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Team speichern
                </button>
              ) : null}

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
