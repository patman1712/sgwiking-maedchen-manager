import { useMemo, useState } from "react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Noch offen";
  }

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
  const matchRescheduleRequests = useAppStore((state) => state.matchRescheduleRequests);
  const approvePlayerApplication = useAppStore((state) => state.approvePlayerApplication);
  const rejectPlayerApplication = useAppStore((state) => state.rejectPlayerApplication);
  const clearPlayerApplicationTrash = useAppStore((state) => state.clearPlayerApplicationTrash);
  const setMatchRescheduleRequestInProgress = useAppStore(
    (state) => state.setMatchRescheduleRequestInProgress,
  );
  const completeMatchRescheduleRequest = useAppStore(
    (state) => state.completeMatchRescheduleRequest,
  );
  const clearMatchRescheduleTrash = useAppStore((state) => state.clearMatchRescheduleTrash);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "trash">("inbox");
  const [approvalDrafts, setApprovalDrafts] = useState<
    Record<string, { email: string; password: string }>
  >({});

  const canManageMailbox = currentUser?.role === "admin" || currentUser?.role === "board";

  const requestedByName = (userId: string | null | undefined) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";
  const teamName = (teamId: string) => teams.find((entry) => entry.id === teamId)?.name ?? "Mannschaft";

  const inboxPlayerApplications = pendingPlayerApplications.filter(
    (entry) => entry.status === "pending",
  );
  const trashPlayerApplications = pendingPlayerApplications.filter(
    (entry) => entry.status === "approved" || entry.status === "rejected",
  );
  const inboxRescheduleRequests = matchRescheduleRequests.filter(
    (entry) => entry.status === "pending" || entry.status === "in_progress",
  );
  const trashRescheduleRequests = matchRescheduleRequests.filter((entry) => entry.status === "done");

  if (!canManageMailbox) {
    return null;
  }

  return (
    <SectionCard
      title="Postfach"
      description="Hier landen Spielerinnen-Anmeldungen und Spielverlegungen fuer Vorstand und Admin."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "inbox"
                ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Posteingang
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trash")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "trash"
                ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Papierkorb
          </button>
        </div>
      }
    >
      <div className="space-y-5">
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

        {activeTab === "inbox" ? (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Spielerinnen-Anmeldungen</p>
                  <p className="text-sm text-slate-600">
                    Neue Spielerinnen muessen erst bestaetigt werden, bevor ein Login angelegt wird.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                  {inboxPlayerApplications.length} offen
                </span>
              </div>

              {inboxPlayerApplications.length ? (
                inboxPlayerApplications.map((application) => {
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
                              {teamName(application.teamId)}
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
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Kontakt
                          </p>
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>{application.email || "Keine E-Mail hinterlegt"}</p>
                            <p>{application.phone || "Keine Telefonnummer hinterlegt"}</p>
                            <p>{application.birthday || "Kein Geburtstag hinterlegt"}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Eltern
                          </p>
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
                          disabled={savingId === `player-${application.id}`}
                          onClick={async () => {
                            setError("");
                            setSuccess("");
                            setSavingId(`player-${application.id}`);
                            const result = await approvePlayerApplication(application.id, {
                              email: draft.email,
                              password: draft.password,
                            });

                            if (!result.success) {
                              setError(result.error ?? "Freischaltung fehlgeschlagen.");
                            } else {
                              setSuccess(
                                "Spielerin wurde freigeschaltet und in den Papierkorb verschoben.",
                              );
                            }

                            setSavingId(null);
                          }}
                          className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === `player-${application.id}`
                            ? "Speichert..."
                            : "Bestaetigen & freischalten"}
                        </button>
                        <button
                          type="button"
                          disabled={savingId === `player-${application.id}`}
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `${application.fullName} wirklich ablehnen?`,
                            );
                            if (!confirmed) {
                              return;
                            }

                            setError("");
                            setSuccess("");
                            setSavingId(`player-${application.id}`);
                            const result = await rejectPlayerApplication(application.id);

                            if (!result.success) {
                              setError(result.error ?? "Ablehnung fehlgeschlagen.");
                            } else {
                              setSuccess("Anmeldung wurde abgelehnt und in den Papierkorb verschoben.");
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
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Keine offenen Spielerinnen-Anmeldungen
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Spielverlegungen</p>
                  <p className="text-sm text-slate-600">
                    Trainer koennen Verlegungsantraege an Vorstand und Admin weitergeben.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                  {inboxRescheduleRequests.length} offen
                </span>
              </div>

              {inboxRescheduleRequests.length ? (
                inboxRescheduleRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {request.matchLabel}
                          </h3>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                            {teamName(request.teamId)}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              request.status === "in_progress"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {request.status === "in_progress" ? "In Bearbeitung" : "Neu"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          Angefragt von {requestedByName(request.requestedBy)} am{" "}
                          {formatDate(request.requestedAt)}
                        </p>
                        {request.status === "in_progress" ? (
                          <p className="mt-1 text-sm font-medium text-amber-700">
                            Bearbeitet von {requestedByName(request.handledBy)} seit{" "}
                            {formatDate(request.handledAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Neuer Termin
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {formatDate(request.proposedKickoffAt)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Absprachen
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {request.coordinationNotes || "Noch keine Notiz zu Gegner/Absprachen."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Begruendung
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{request.reason}</p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {request.status !== "in_progress" ? (
                        <button
                          type="button"
                          disabled={savingId === `reschedule-${request.id}`}
                          onClick={async () => {
                            setError("");
                            setSuccess("");
                            setSavingId(`reschedule-${request.id}`);
                            const result = await setMatchRescheduleRequestInProgress(request.id);

                            if (!result.success) {
                              setError(result.error ?? "Status konnte nicht gesetzt werden.");
                            } else {
                              setSuccess("Antrag ist jetzt in Bearbeitung.");
                            }

                            setSavingId(null);
                          }}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          In Bearbeitung setzen
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={savingId === `reschedule-${request.id}`}
                        onClick={async () => {
                          setError("");
                          setSuccess("");
                          setSavingId(`reschedule-${request.id}`);
                          const result = await completeMatchRescheduleRequest(request.id);

                          if (!result.success) {
                            setError(result.error ?? "Antrag konnte nicht erledigt werden.");
                          } else {
                            setSuccess("Antrag wurde erledigt und in den Papierkorb verschoben.");
                          }

                          setSavingId(null);
                        }}
                        className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Antrag erledigt
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Keine offenen Spielverlegungen
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Papierkorb</p>
                  <p className="text-sm text-slate-600">
                    Erledigte Spielverlegungen sowie freigegebene oder abgelehnte Spielerinnen-Antraege.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingId === "clear-player-trash"}
                    onClick={async () => {
                      setError("");
                      setSuccess("");
                      setSavingId("clear-player-trash");
                      const result = await clearPlayerApplicationTrash();
                      if (!result.success) {
                        setError(result.error ?? "Papierkorb konnte nicht geleert werden.");
                      } else {
                        setSuccess("Spielerinnen-Papierkorb wurde geleert.");
                      }
                      setSavingId(null);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Spielerinnen-Papierkorb leeren
                  </button>
                  <button
                    type="button"
                    disabled={savingId === "clear-reschedule-trash"}
                    onClick={async () => {
                      setError("");
                      setSuccess("");
                      setSavingId("clear-reschedule-trash");
                      const result = await clearMatchRescheduleTrash();
                      if (!result.success) {
                        setError(result.error ?? "Papierkorb konnte nicht geleert werden.");
                      } else {
                        setSuccess("Spielverlegungs-Papierkorb wurde geleert.");
                      }
                      setSavingId(null);
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Spielverlegungen leeren
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Spielerinnen-Antraege</p>
              {trashPlayerApplications.length ? (
                trashPlayerApplications.map((application) => (
                  <div
                    key={application.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{application.fullName}</p>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                        {teamName(application.teamId)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          application.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {application.status === "approved" ? "Freigeschaltet" : "Abgelehnt"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Bearbeitet von {requestedByName(application.reviewedBy)} am{" "}
                      {formatDate(application.reviewedAt)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Kein Eintrag im Spielerinnen-Papierkorb
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Spielverlegungen</p>
              {trashRescheduleRequests.length ? (
                trashRescheduleRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{request.matchLabel}</p>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                        {teamName(request.teamId)}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Erledigt
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Bearbeitet von {requestedByName(request.handledBy)} und erledigt von{" "}
                      {requestedByName(request.completedBy)} am {formatDate(request.completedAt)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Kein Eintrag im Spielverlegungs-Papierkorb
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
