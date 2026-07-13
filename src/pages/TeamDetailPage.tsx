import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MessageSquare } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";

const teamSections = [
  { key: "kader", label: "Kader" },
  { key: "spielplan", label: "Spielplan" },
  { key: "inventar", label: "Inventar" },
  { key: "verwaltung", label: "Verwaltung" },
] as const;

type TeamSection = (typeof teamSections)[number]["key"];

const emptyPlayerForm = {
  fullName: "",
  email: "",
  phone: "",
  notes: "",
  password: "",
};

export default function TeamDetailPage() {
  const { teamId, section } = useParams();
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const conversations = useAppStore((state) => state.conversations);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateTeam = useAppStore((state) => state.updateTeam);
  const updateUser = useAppStore((state) => state.updateUser);
  const ensureTeamConversation = useAppStore((state) => state.ensureTeamConversation);
  const navigate = useNavigate();

  const activeSection = teamSections.some((entry) => entry.key === section)
    ? (section as TeamSection)
    : "kader";
  const team = teams.find((entry) => entry.id === teamId);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [form, setForm] = useState({
    name: "",
    ageGroup: "",
    season: "",
    trainingDay: "",
    location: "",
    notes: "",
  });
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerForm, setPlayerForm] = useState(emptyPlayerForm);
  const [playerError, setPlayerError] = useState("");

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

  if (!teamSections.some((entry) => entry.key === activeSection)) {
    return <Navigate to={`/dashboard/teams/${team.id}/kader`} replace />;
  }

  const teamTrainerCount = assignedTrainers.length;
  const teamPlayerCount = assignedPlayers.length;

  const startPlayerEdit = (playerId: string) => {
    const player = assignedPlayers.find((entry) => entry.id === playerId);

    if (!player) {
      return;
    }

    setEditingPlayerId(player.id);
    setPlayerError("");
    setPlayerForm({
      fullName: player.fullName,
      email: player.email,
      phone: player.phone,
      notes: player.notes,
      password: "",
    });
  };

  const stopPlayerEdit = () => {
    setEditingPlayerId(null);
    setPlayerError("");
    setPlayerForm(emptyPlayerForm);
  };

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

      {activeSection === "kader" ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SectionCard
            title="Kader und Betreuung"
            description="Hier werden nur die bereits zugewiesenen Trainerinnen, Trainer und Spielerinnen dieser Mannschaft angezeigt."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Zugewiesene Trainerinnen / Trainer
                </h3>
                <div className="mt-4 space-y-3">
                  {assignedTrainers.length ? (
                    assignedTrainers.map((trainer) => (
                      <div
                        key={trainer.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <span className="block text-sm font-medium text-slate-900">
                          {trainer.fullName}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {trainer.email}
                        </span>
                        {trainer.phone ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {trainer.phone}
                          </span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Dieser Mannschaft ist aktuell noch kein Trainer zugewiesen.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Zugewiesene Spielerinnen
                </h3>
                <div className="mt-4 space-y-3">
                  {assignedPlayers.length ? (
                    assignedPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="block text-sm font-medium text-slate-900">
                              {player.fullName}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {player.email}
                            </span>
                            {player.phone ? (
                              <span className="mt-1 block text-xs text-slate-500">
                                {player.phone}
                              </span>
                            ) : null}
                          </div>
                          {canManagePlayersHere ? (
                            <button
                              type="button"
                              onClick={() => startPlayerEdit(player.id)}
                              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                            >
                              Bearbeiten
                            </button>
                          ) : null}
                        </div>
                        {player.notes ? (
                          <p className="mt-3 text-xs text-slate-600">{player.notes}</p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      Dieser Mannschaft sind aktuell noch keine Spielerinnen zugewiesen.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-blue-50 px-5 py-4 text-sm text-blue-900">
              Teamzuweisungen werden im Bereich{" "}
              <span className="font-semibold">Spielerinnen</span> gepflegt. Dort duerfen nur
              Admin und Vorstand die Zuordnung aendern.
            </div>
          </SectionCard>

          <SectionCard
            title="Spielerinnen bearbeiten"
            description="Zustaendige Trainer sowie Admin und Vorstand koennen hier die bereits zugewiesenen Spielerinnen dieser Mannschaft pflegen."
          >
            {!canManagePlayersHere ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Nur zugeordnete Trainer, Admin oder Vorstand koennen Spielerinnen dieser
                Mannschaft bearbeiten.
              </div>
            ) : !editingPlayerId ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Waehle rechts bei einer zugewiesenen Spielerin den Button{" "}
                <span className="font-semibold">Bearbeiten</span>.
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();

                  const player = assignedPlayers.find((entry) => entry.id === editingPlayerId);
                  if (!player) {
                    setPlayerError("Die Spielerin konnte nicht gefunden werden.");
                    return;
                  }

                  const result = await updateUser({
                    userId: player.id,
                    fullName: playerForm.fullName,
                    email: playerForm.email,
                    phone: playerForm.phone,
                    notes: playerForm.notes,
                    password: playerForm.password.trim() || undefined,
                    role: "player",
                  });

                  if (!result.success) {
                    setPlayerError(result.error ?? "Spielerin konnte nicht gespeichert werden.");
                    return;
                  }

                  stopPlayerEdit();
                }}
              >
                {playerError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {playerError}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={playerForm.fullName}
                    onChange={(event) =>
                      setPlayerForm({ ...playerForm, fullName: event.target.value })
                    }
                    required
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Login / E-Mail
                    </span>
                    <input
                      type="email"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={playerForm.email}
                      onChange={(event) =>
                        setPlayerForm({ ...playerForm, email: event.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Telefon
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={playerForm.phone}
                      onChange={(event) =>
                        setPlayerForm({ ...playerForm, phone: event.target.value })
                      }
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Neues Passwort
                  </span>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={playerForm.password}
                    onChange={(event) =>
                      setPlayerForm({ ...playerForm, password: event.target.value })
                    }
                    placeholder="Leer lassen, wenn es unveraendert bleiben soll"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={playerForm.notes}
                    onChange={(event) =>
                      setPlayerForm({ ...playerForm, notes: event.target.value })
                    }
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                  >
                    Spielerin speichern
                  </button>
                  <button
                    type="button"
                    onClick={stopPlayerEdit}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeSection === "spielplan" ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard
            title="Spielplan"
            description="Hier kannst du kuenftig Spiele, Treffpunkte und Uhrzeiten der Mannschaft organisieren."
          >
            <div className="rounded-3xl border border-dashed border-blue-200 bg-blue-50/60 p-6">
              <p className="text-sm font-semibold text-blue-900">Bereich vorbereitet</p>
              <p className="mt-2 text-sm text-slate-600">
                Fuer {team.name} ist jetzt ein eigener Spielplan-Bereich angelegt. Der Bereich
                kann als Naechstes um Heimspiele, Auswaertsspiele, Treffzeiten und Gegner
                erweitert werden.
              </p>
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
    </div>
  );
}
