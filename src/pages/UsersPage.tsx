import { useMemo, useState } from "react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";
import type { UserRole } from "@/types";

const blankForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "trainer" as UserRole,
  teamIds: [] as string[],
  notes: "",
};

export default function UsersPage() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const addUser = useAppStore((state) => state.addUser);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.fullName.localeCompare(right.fullName, "de")),
    [users],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard
        title="Trainerinnen, Trainer und Spielerinnen"
        description="Neue Personen werden mit Login-Daten angelegt und koennen direkt mehreren Teams zugeordnet werden."
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_1fr] gap-4 bg-slate-100 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Person</span>
            <span>Rolle</span>
            <span>Teams</span>
            <span>Zugang</span>
          </div>
          <div className="divide-y divide-slate-200 bg-white">
            {sortedUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-slate-700 md:grid-cols-[1.2fr_0.8fr_0.9fr_1fr]"
              >
                <div>
                  <p className="font-semibold text-slate-900">{user.fullName}</p>
                  <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                </div>
                <div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-900">
                    {user.role === "admin"
                      ? "Admin"
                      : user.role === "trainer"
                        ? "Trainer"
                        : "Spielerin"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.teamIds.length ? (
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
                    <span className="text-xs text-slate-400">Noch keinem Team zugeordnet</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Anmeldung</p>
                  <p className="mt-1 font-medium text-slate-900">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Passwort ist im Backend sicher gespeichert.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Neue Person anlegen"
        description="Die angelegte Person kann sich sofort mit E-Mail und Passwort anmelden."
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await addUser(form);

            if (!result.success) {
              setError(result.error ?? "Speichern nicht moeglich.");
              return;
            }

            setError("");
            setForm(blankForm);
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
              <span className="mb-2 block text-sm font-medium text-slate-700">Passwort</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Rolle</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.role}
                onChange={(event) =>
                  setForm({ ...form, role: event.target.value as UserRole })
                }
              >
                <option value="trainer">Trainerin / Trainer</option>
                <option value="player">Spielerin</option>
                <option value="admin">Vereinsadmin</option>
              </select>
            </label>
          </div>

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
            className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
          >
            Person speichern
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
