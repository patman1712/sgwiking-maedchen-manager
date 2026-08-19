import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function ProfilePage() {
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser);
  const deleteUser = useAppStore((state) => state.deleteUser);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteInProgress, setDeleteInProgress] = useState(false);
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

  const expectedConfirmText = `LÖSCHEN ${currentUser.fullName}`;
  const confirmTextCorrect = confirmText.trim() === expectedConfirmText;

  const handleStartDelete = () => {
    setError("");
    setSuccess("");
    setConfirmText("");
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !confirmTextCorrect || deleteInProgress) {
      return;
    }

    setDeleteInProgress(true);
    try {
      const result = await deleteUser(currentUser.id);
      if (!result.success) {
        setError(result.error ?? "Account konnte nicht gelöscht werden.");
        return;
      }

      logout();
      setTimeout(() => navigate("/login", { replace: true }), 100);
    } finally {
      setDeleteInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Mein Profil bearbeiten"
          description="Hier kannst du deine Profildaten, dein Login und auf Wunsch auch dein Passwort anpassen."
        >
          {error && !confirmOpen ? (
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
                        : currentUser.role === "social"
                          ? "Social Media Manager"
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

      <SectionCard
        title="Gefahrenzone"
        description="Account endgueltig und unwiderruflich loeschen."
        className="border-rose-200 bg-rose-50/60"
      >
        <div className="rounded-3xl border border-rose-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-base font-semibold text-slate-900">
                Meinen Account endgültig löschen
              </h3>
              <p className="text-sm text-slate-600">
                Wenn du deinen Account löschst, werden <strong>alle deine persönlichen Daten</strong>{" "}
                <strong>unwiderruflich vom Server entfernt</strong>. Dies umfasst:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Dein Benutzerprofil (Name, E-Mail, Passwort, Telefon, Notizen)</li>
                <li>Deine Team-Mitgliedschaften und Chat-Teilnahmen</li>
                <li>Alle von dir gesendeten Chat-Nachrichten</li>
                <li>Deine Zu- und Absagen bei Terminen & Events</li>
                <li>Alle Social Media Postings / Entwürfe und hochgeladenen Bilder</li>
                <li>Dein Profilbild und (bei Spielerinnen) alle Dokumente</li>
              </ul>
              <p className="mt-3 text-sm font-semibold text-rose-700">
                ⚠️ Dieser Vorgang kann NICHT rückgängig gemacht werden!
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Stattdessen abmelden
            </button>
            <button
              type="button"
              onClick={handleStartDelete}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:-translate-y-0.5"
            >
              <Trash2 className="h-4 w-4" />
              Meinen Account löschen
            </button>
          </div>
        </div>
      </SectionCard>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">
                  Account wirklich endgültig löschen?
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Hallo <strong>{currentUser.fullName}</strong>, bitte lies das aufmerksam durch.
                  Du bist im Begriff, deinen Benutzeraccount und{" "}
                  <strong>alle damit verbundenen Daten</strong>{" "}
                  <strong className="text-rose-700">für immer zu löschen</strong>.
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Es gibt <strong>keinen Weg zurück</strong> – auch Vorstand oder Admin können deinen
                  Account danach nicht mehr wiederherstellen.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-rose-900">
                  Bestätige indem du folgendes eintippst:
                </span>
                <div className="mb-2 rounded-xl border border-rose-200 bg-white px-4 py-2 font-mono text-sm font-bold tracking-wider text-rose-800">
                  {expectedConfirmText}
                </div>
                <input
                  type="text"
                  autoFocus
                  disabled={deleteInProgress}
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={expectedConfirmText}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-500 focus:bg-white focus:ring-4 focus:ring-rose-100 disabled:bg-slate-100"
                />
              </label>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleteInProgress}
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={!confirmTextCorrect || deleteInProgress}
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <Trash2 className="h-4 w-4" />
                {deleteInProgress ? "Wird gelöscht…" : "Ja, Account UNWIIDERRUFLICH löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
