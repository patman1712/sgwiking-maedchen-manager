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

export default function TeamDetailPage() {
  const { teamId, section } = useParams();
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const conversations = useAppStore((state) => state.conversations);
  const updateTeam = useAppStore((state) => state.updateTeam);
  const setTeamMembership = useAppStore((state) => state.setTeamMembership);
  const ensureTeamConversation = useAppStore((state) => state.ensureTeamConversation);
  const navigate = useNavigate();

  const activeSection = teamSections.some((entry) => entry.key === section)
    ? (section as TeamSection)
    : "kader";
  const team = teams.find((entry) => entry.id === teamId);
  const [form, setForm] = useState({
    name: "",
    ageGroup: "",
    season: "",
    trainingDay: "",
    location: "",
    notes: "",
  });

  const trainers = useMemo(
    () => users.filter((user) => user.role === "trainer"),
    [users],
  );
  const players = useMemo(
    () => users.filter((user) => user.role === "player"),
    [users],
  );

  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
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
    setSelectedTrainerIds(
      trainers.filter((user) => user.teamIds.includes(team.id)).map((user) => user.id),
    );
    setSelectedPlayerIds(
      players.filter((user) => user.teamIds.includes(team.id)).map((user) => user.id),
    );
  }, [players, team, trainers]);

  if (!teamId || !team) {
    return <Navigate to="/dashboard/teams" replace />;
  }

  if (!teamSections.some((entry) => entry.key === activeSection)) {
    return <Navigate to={`/dashboard/teams/${team.id}/kader`} replace />;
  }

  const toggleId = (
    current: string[],
    nextId: string,
    setValue: (value: string[]) => void,
  ) => {
    setValue(
      current.includes(nextId)
        ? current.filter((value) => value !== nextId)
        : [...current, nextId],
    );
  };

  const teamTrainerCount = trainers.filter((user) => user.teamIds.includes(team.id)).length;
  const teamPlayerCount = players.filter((user) => user.teamIds.includes(team.id)).length;

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
        <SectionCard
          title="Kader und Betreuung"
          description="Trainerinnen und Spielerinnen koennen mehreren Mannschaften zugewiesen werden."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Trainerinnen / Trainer
              </h3>
              <div className="mt-4 space-y-3">
                {trainers.map((trainer) => (
                  <label
                    key={trainer.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTrainerIds.includes(trainer.id)}
                      onChange={() =>
                        toggleId(selectedTrainerIds, trainer.id, setSelectedTrainerIds)
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {trainer.fullName}
                      </span>
                      <span className="block text-xs text-slate-500">{trainer.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Spielerinnen
              </h3>
              <div className="mt-4 space-y-3">
                {players.map((player) => (
                  <label
                    key={player.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() =>
                        toggleId(selectedPlayerIds, player.id, setSelectedPlayerIds)
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {player.fullName}
                      </span>
                      <span className="block text-xs text-slate-500">{player.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                await setTeamMembership(team.id, selectedTrainerIds, selectedPlayerIds);
              }}
              className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              Kader speichern
            </button>
            <p className="self-center text-sm text-slate-500">
              Gespeicherte Mitglieder erscheinen direkt im Teamchat.
            </p>
          </div>
        </SectionCard>
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
