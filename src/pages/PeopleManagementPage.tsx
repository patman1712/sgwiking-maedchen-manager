import { useMemo, useState } from "react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";
import type { UserRole } from "@/types";

interface PeopleManagementPageProps {
  role: Extract<UserRole, "trainer" | "player" | "board">;
}

const roleConfig = {
  trainer: {
    pageTitle: "Trainerinnen und Trainer",
    listTitle: "Trainerbereich",
    listDescription:
      "Hier verwaltest du alle Trainerinnen und Trainer getrennt von den Spielerinnen.",
    formTitle: "Trainerin oder Trainer anlegen / bearbeiten",
    formDescription:
      "Teamzuordnungen und Zugangsdaten werden zentral im Verwaltungsbereich gepflegt.",
    roleLabel: "Trainer",
    selectLabel: "Trainerin / Trainer",
    emptyText: "Noch keinem Team zugeordnet",
    showTeams: true,
  },
  player: {
    pageTitle: "Spielerinnen",
    listTitle: "Spielerinnenbereich",
    listDescription:
      "Alle Spielerinnen mit Teamzuordnung und Login liegen in einem eigenen Verwaltungsbereich.",
    formTitle: "Spielerin anlegen / bearbeiten",
    formDescription:
      "Spielerinnen werden hier Teams zugewiesen. Dieser Bereich ist nur fuer Admin und Vorstand bearbeitbar.",
    roleLabel: "Spielerin",
    selectLabel: "Spielerin",
    emptyText: "Noch keinem Team zugeordnet",
    showTeams: true,
  },
  board: {
    pageTitle: "Vorstand",
    listTitle: "Vorstandsbereich",
    listDescription:
      "Vorstandsmitglieder sind vom sportlichen Bereich getrennt und werden hier eigenständig gepflegt.",
    formTitle: "Vorstandsmitglied anlegen / bearbeiten",
    formDescription:
      "Vorstandszugaenge koennen unabhaengig von Mannschaften erstellt oder angepasst werden.",
    roleLabel: "Vorstand",
    selectLabel: "Vorstand",
    emptyText: "Keine Teamzuordnung erforderlich",
    showTeams: false,
  },
} as const;

const createEmptyForm = (role: Extract<UserRole, "trainer" | "player" | "board">) => ({
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role,
  teamIds: [] as string[],
  notes: "",
});

export default function PeopleManagementPage({
  role,
}: PeopleManagementPageProps) {
  const config = roleConfig[role];
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const addUser = useAppStore((state) => state.addUser);
  const updateUser = useAppStore((state) => state.updateUser);
  const [form, setForm] = useState(createEmptyForm(role));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canManageFromMenu =
    currentUser?.role === "admin" || currentUser?.role === "board";

  const filteredUsers = useMemo(
    () =>
      users
        .filter((user) => user.role === role)
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "de")),
    [role, users],
  );

  const startEdit = (userId: string) => {
    const user = filteredUsers.find((entry) => entry.id === userId);

    if (!user) {
      return;
    }

    setSelectedUserId(user.id);
    setError("");
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      phone: user.phone,
      role,
      teamIds: user.teamIds,
      notes: user.notes,
    });
  };

  const resetForm = () => {
    setSelectedUserId(null);
    setError("");
    setForm(createEmptyForm(role));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard title={config.listTitle} description={config.listDescription}>
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_auto] gap-4 bg-slate-100 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Person</span>
            <span>Rolle</span>
            <span>{config.showTeams ? "Teams" : "Bereich"}</span>
            <span>Zugang</span>
            <span>Aktion</span>
          </div>
          <div className="divide-y divide-slate-200 bg-white">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-slate-700 md:grid-cols-[1.2fr_0.8fr_1fr_1fr_auto]"
              >
                <div>
                  <p className="font-semibold text-slate-900">{user.fullName}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                </div>
                <div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
                    {config.roleLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.showTeams ? (
                    user.teamIds.length ? (
                      user.teamIds.map((teamId) => {
                        const team = teams.find((entry) => entry.id === teamId);
                        return (
                          <span
                            key={teamId}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                          >
                            {team?.ageGroup ?? "Team"}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-400">{config.emptyText}</span>
                    )
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                      Vereinsleitung
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Anmeldung</p>
                  <p className="mt-1 font-medium text-slate-900">{user.email}</p>
                </div>
                <div className="flex items-start justify-start">
                  {canManageFromMenu ? (
                    <button
                      type="button"
                      onClick={() => startEdit(user.id)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                    >
                      Bearbeiten
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Nur Ansicht</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={config.formTitle} description={config.formDescription}>
        {!canManageFromMenu ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Dieser Bereich kann nur von Admin oder Vorstand bearbeitet werden.
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();

                const payload = {
                  ...form,
                  role,
                  teamIds: config.showTeams ? form.teamIds : [],
                };

                const result = selectedUserId
                  ? await updateUser({
                      userId: selectedUserId,
                      fullName: payload.fullName,
                      email: payload.email,
                      password: payload.password.trim() || undefined,
                      phone: payload.phone,
                      role,
                      teamIds: payload.teamIds,
                      notes: payload.notes,
                    })
                  : await addUser({
                      fullName: payload.fullName,
                      email: payload.email,
                      password: payload.password,
                      phone: payload.phone,
                      role,
                      teamIds: payload.teamIds,
                      notes: payload.notes,
                    });

                if (!result.success) {
                  setError(result.error ?? "Speichern nicht moeglich.");
                  return;
                }

                resetForm();
              }}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">E-Mail</span>
                  <input
                    type="email"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Telefon</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    {selectedUserId ? "Neues Passwort" : "Passwort"}
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required={!selectedUserId}
                    placeholder={
                      selectedUserId
                        ? "Leer lassen, wenn es unveraendert bleiben soll"
                        : ""
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Bereich</span>
                  <input
                    value={config.selectLabel}
                    disabled
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
                  />
                </label>
              </div>

              {config.showTeams ? (
                <div>
                  <span className="mb-2 block text-sm font-medium text-slate-700">Teams</span>
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={form.teamIds.includes(team.id)}
                          onChange={() =>
                            setForm({
                              ...form,
                              teamIds: form.teamIds.includes(team.id)
                                ? form.teamIds.filter((value) => value !== team.id)
                                : [...form.teamIds, team.id],
                            })
                          }
                        />
                        <span className="text-sm text-slate-700">
                          {team.name} ({team.ageGroup})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

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
                  className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                >
                  {selectedUserId ? `${config.roleLabel} speichern` : `${config.roleLabel} anlegen`}
                </button>
                {selectedUserId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Abbrechen
                  </button>
                ) : null}
              </div>
            </form>
          </>
        )}
      </SectionCard>
    </div>
  );
}
