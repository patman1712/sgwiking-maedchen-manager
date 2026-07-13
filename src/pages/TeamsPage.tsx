import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Volleyball } from "lucide-react";
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
  const addTeam = useAppStore((state) => state.addTeam);
  const [form, setForm] = useState(emptyForm);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard
        title="Mannschaften"
        description="Wie im Maintextildruck-Manager: links die aktiven Bereiche, rechts direkte Erfassung."
      >
        <div className="space-y-4">
          {teams.map((team) => {
            const trainers = users.filter(
              (user) => user.role === "trainer" && user.teamIds.includes(team.id),
            );
            const players = users.filter(
              (user) => user.role === "player" && user.teamIds.includes(team.id),
            );

            return (
              <Link
                key={team.id}
                to={`/dashboard/teams/${team.id}/dashboard`}
                className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md md:flex-row md:items-start md:justify-between"
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 text-white shadow-lg">
                    <Volleyball size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                      {team.ageGroup}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{team.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">{team.trainingDay}</p>
                    <p className="mt-1 text-sm text-slate-500">{team.location}</p>
                  </div>
                </div>

                <div className="grid min-w-[220px] grid-cols-2 gap-3">
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
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Neue Mannschaft anlegen"
        description="Hier kannst du weitere Teams fuer neue Jahrgaenge oder Staffeln erfassen."
      >
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await addTeam(form);
            if (result.success) {
              setForm(emptyForm);
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
                setForm({ ...form, fussballDeTeamId: event.target.value.trim() })
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
    </div>
  );
}
