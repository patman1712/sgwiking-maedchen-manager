import { useEffect, useMemo, useState } from "react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function ProfilePage() {
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    notes: "",
    password: "",
  });

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setForm({
      fullName: currentUser.fullName,
      email: currentUser.email,
      phone: currentUser.phone,
      notes: currentUser.notes,
      password: "",
    });
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <SectionCard
        title="Mein Profil bearbeiten"
        description="Hier kannst du deine Profildaten, dein Login und auf Wunsch auch dein Passwort anpassen."
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setSuccess("");

            const result = await updateCurrentUser({
              fullName: form.fullName,
              email: form.email,
              phone: form.phone,
              notes: form.notes,
              password: form.password.trim() || undefined,
            });

            if (!result.success) {
              setError(result.error ?? "Profil konnte nicht gespeichert werden.");
              return;
            }

            setForm((current) => ({ ...current, password: "" }));
            setSuccess("Dein Profil wurde gespeichert.");
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
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Login / E-Mail
              </span>
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

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Neues Passwort
            </span>
            <input
              type="password"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Leer lassen, wenn das Passwort gleich bleiben soll"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Rolle</span>
            <input
              value={
                currentUser.role === "admin"
                  ? "Vereinsadmin"
                  : currentUser.role === "trainer"
                    ? "Trainerin / Trainer"
                    : currentUser.role === "board"
                      ? "Vorstand"
                      : "Spielerin"
              }
              disabled
              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
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
            className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
          >
            Profil speichern
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Meine Mannschaften"
        description="Alle Teams, denen dein Benutzer aktuell zugeordnet ist."
      >
        {currentUser.teamIds.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {currentUser.teamIds.map((teamId) => {
              const team = teams.find((entry) => entry.id === teamId);

              if (!team) {
                return null;
              }

              return (
                <div key={team.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-700">
                    {team.ageGroup}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{team.name}</h3>
                  <p className="mt-3 text-sm text-slate-600">{team.trainingDay}</p>
                  <p className="mt-1 text-sm text-slate-500">{team.location}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Deinem Profil ist aktuell keine Mannschaft zugeordnet.
          </div>
        )}

        <div className="mt-6 rounded-3xl bg-gradient-to-r from-blue-50 to-white p-5">
          <p className="text-sm font-medium text-slate-900">Hinweis</p>
          <p className="mt-2 text-sm text-slate-600">
            Deine Login-E-Mail ist gleichzeitig dein Benutzername fuer die Anmeldung.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
