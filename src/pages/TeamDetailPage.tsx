import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MessageSquare } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const conversations = useAppStore((state) => state.conversations);
  const updateTeam = useAppStore((state) => state.updateTeam);
  const setTeamMembership = useAppStore((state) => state.setTeamMembership);
  const ensureTeamConversation = useAppStore((state) => state.ensureTeamConversation);
  const navigate = useNavigate();

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
            Teamdetails, Zuweisungen und Kommunikationskanal
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            const conversationId =
              existingConversationId ?? (await ensureTeamConversation(team.id));
            navigate(`/dashboard/messages?conversation=${conversationId}`);
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5"
        >
          <MessageSquare size={18} />
          Teamchat oeffnen
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Teamstammdaten"
          description="Bearbeitung direkt auf der Detailseite, analog zur Verwaltungslogik deiner Referenz."
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

            <button
              type="submit"
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Team speichern
            </button>
          </form>
        </SectionCard>

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
              className="rounded-2xl bg-gradient-to-r from-blue-700 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-0.5"
            >
              Zuweisungen speichern
            </button>
            <p className="self-center text-sm text-slate-500">
              Gespeicherte Mitglieder erscheinen direkt im Teamchat.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
