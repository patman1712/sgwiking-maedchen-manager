import { useMemo, useState } from "react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BoardMailboxPage() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const pendingPlayerApplications = useAppStore((state) => state.pendingPlayerApplications);
  const approvePlayerApplication = useAppStore((state) => state.approvePlayerApplication);
  const rejectPlayerApplication = useAppStore((state) => state.rejectPlayerApplication);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, { email: string; password: string }>>(
    {},
  );

  const canManageMailbox =
    currentUser?.role === "admin" || currentUser?.role === "board";

  const requestedByName = (userId: string) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";

  if (!canManageMailbox) {
    return null;
  }

  return (
    <SectionCard
      title="Postfach"
      description="Hier landen Spielerinnen-Anmeldungen, die zuerst von Vorstand oder Admin bestaetigt werden muessen."
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {pendingPlayerApplications.length ? (
          pendingPlayerApplications.map((application) => {
            const team = teams.find((entry) => entry.id === application.teamId);
            const draft = approvalDrafts[application.id] ?? {
              email: application.email ?? "",
              password: "",
            };

            return (
              <div
                key={application.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {application.fullName}
                      </h3>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                        {team?.name ?? "Mannschaft"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Angelegt von {requestedByName(application.requestedBy)} am{" "}
                      {formatDate(application.requestedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Kontakt</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <p>{application.email || "Keine E-Mail hinterlegt"}</p>
                      <p>{application.phone || "Keine Telefonnummer hinterlegt"}</p>
                      <p>{application.birthday || "Kein Geburtstag hinterlegt"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Eltern</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      <p>{application.parentName || "Kein Name hinterlegt"}</p>
                      <p>{application.parentPhone || "Keine Nummer hinterlegt"}</p>
                      <p>{application.parentEmail || "Keine E-Mail hinterlegt"}</p>
                    </div>
                  </div>
                </div>

                {application.address ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {application.address}
                  </div>
                ) : null}

                {application.notes ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {application.notes}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Login-E-Mail fuer Freischaltung
                    </span>
                    <input
                      type="email"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={draft.email}
                      onChange={(event) =>
                        setApprovalDrafts((current) => ({
                          ...current,
                          [application.id]: { ...draft, email: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Startpasswort
                    </span>
                    <input
                      type="password"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={draft.password}
                      onChange={(event) =>
                        setApprovalDrafts((current) => ({
                          ...current,
                          [application.id]: { ...draft, password: event.target.value },
                        }))
                      }
                      placeholder="Mindestens 8 Zeichen"
                    />
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={savingId === application.id}
                    onClick={async () => {
                      setError("");
                      setSuccess("");
                      setSavingId(application.id);
                      const result = await approvePlayerApplication(application.id, {
                        email: draft.email,
                        password: draft.password,
                      });

                      if (!result.success) {
                        setError(result.error ?? "Freischaltung fehlgeschlagen.");
                      } else {
                        setSuccess("Spielerin wurde freigeschaltet und kann jetzt angelegt einloggen.");
                      }

                      setSavingId(null);
                    }}
                    className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingId === application.id ? "Speichert..." : "Bestaetigen & freischalten"}
                  </button>
                  <button
                    type="button"
                    disabled={savingId === application.id}
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `${application.fullName} wirklich ablehnen?`,
                      );
                      if (!confirmed) {
                        return;
                      }

                      setError("");
                      setSuccess("");
                      setSavingId(application.id);
                      const result = await rejectPlayerApplication(application.id);

                      if (!result.success) {
                        setError(result.error ?? "Ablehnung fehlgeschlagen.");
                      } else {
                        setSuccess("Anmeldung wurde abgelehnt.");
                      }

                      setSavingId(null);
                    }}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">Keine offenen Anmeldungen</p>
            <p className="mt-2 text-sm text-slate-600">
              Neue Spielerinnen-Anmeldungen von Trainern landen hier automatisch im Postfach.
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
