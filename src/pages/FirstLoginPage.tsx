import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function FirstLoginPage() {
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const completeFirstLogin = useAppStore((state) => state.completeFirstLogin);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    acceptPrivacy: false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!currentUserId) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser && !currentUser.requiresOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SectionCard
        title="Erstlogin abschliessen"
        description="Bitte bestaetige einmalig die Datenschutz-Hinweise und setze direkt dein eigenes Passwort."
      >
        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 rounded-3xl border border-blue-100 bg-blue-50/70 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Wichtig vor dem ersten Zugriff</p>
          <p className="mt-2">
            Neue Spielerinnen muessen beim ersten Login die DSGVO-/Datenschutz-Regeln akzeptieren
            und ihr Startpasswort in ein eigenes Passwort aendern.
          </p>
          <p className="mt-2">
            Erst danach wird der normale Zugriff auf Dashboard, Teams und Termine freigeschaltet.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");

            if (!form.acceptPrivacy) {
              setError("Bitte die DSGVO-/Datenschutz-Zustimmung bestaetigen.");
              return;
            }

            if (form.newPassword.trim().length < 8) {
              setError("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
              return;
            }

            if (form.newPassword !== form.confirmPassword) {
              setError("Die beiden neuen Passwoerter stimmen nicht ueberein.");
              return;
            }

            setSaving(true);
            const result = await completeFirstLogin({
              currentPassword: form.currentPassword,
              newPassword: form.newPassword,
              acceptPrivacy: form.acceptPrivacy,
            });

            if (!result.success) {
              setError(result.error ?? "Erstlogin konnte nicht abgeschlossen werden.");
              setSaving(false);
              return;
            }

            navigate("/dashboard", { replace: true });
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Aktuelles Startpasswort
            </span>
            <input
              type="password"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              value={form.currentPassword}
              onChange={(event) =>
                setForm((current) => ({ ...current, currentPassword: event.target.value }))
              }
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Neues Passwort
              </span>
              <input
                type="password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.newPassword}
                onChange={(event) =>
                  setForm((current) => ({ ...current, newPassword: event.target.value }))
                }
                minLength={8}
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Neues Passwort wiederholen
              </span>
              <input
                type="password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                }
                minLength={8}
                required
              />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              checked={form.acceptPrivacy}
              onChange={(event) =>
                setForm((current) => ({ ...current, acceptPrivacy: event.target.checked }))
              }
              className="mt-1"
            />
            <span className="text-sm text-slate-700">
              Ich akzeptiere die DSGVO-/Datenschutz-Hinweise und bin damit einverstanden, dass
              meine fuer den Vereinsbetrieb erforderlichen Daten im System verarbeitet werden.
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Wird gespeichert..." : "Erstlogin abschliessen"}
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Abmelden
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
