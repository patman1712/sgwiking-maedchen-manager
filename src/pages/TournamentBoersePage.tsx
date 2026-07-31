import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileText,
  MapPin,
  Plus,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { cn } from "@/lib/utils";
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

function toLocalDateTimeInput(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default function TournamentBoersePage() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const tournamentOffers = useAppStore((state) => state.tournamentOffers);
  const addTournamentOffer = useAppStore((state) => state.addTournamentOffer);
  const respondToTournamentOffer = useAppStore((state) => state.respondToTournamentOffer);
  const deleteTournamentOffer = useAppStore((state) => state.deleteTournamentOffer);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canCreateTournament = currentUser?.role === "admin" || currentUser?.role === "board";
  const canRespondToTournament = currentUser?.role === "trainer";
  const canUseTournamentBoerse = canCreateTournament || canRespondToTournament;
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    teamId:
      currentUser?.role === "trainer" ? currentUser.teamIds[0] ?? "" : teams[0]?.id ?? "",
    title: "",
    description: "",
    location: "",
    startsAt: "",
  });
  const [tournamentPlanFile, setTournamentPlanFile] = useState<File | null>(null);

  const visibleTeams = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return teams;
    }

    return teams.filter((team) => currentUser.teamIds.includes(team.id));
  }, [currentUser, teams]);

  const sortedOffers = useMemo(() => {
    const now = Date.now();
    return [...tournamentOffers].sort((left, right) => {
      const leftTime = new Date(left.startsAt).getTime();
      const rightTime = new Date(right.startsAt).getTime();
      const leftUpcoming = leftTime >= now ? 0 : 1;
      const rightUpcoming = rightTime >= now ? 0 : 1;

      if (leftUpcoming !== rightUpcoming) {
        return leftUpcoming - rightUpcoming;
      }

      return leftTime - rightTime;
    });
  }, [tournamentOffers]);

  const teamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name ?? "Mannschaft";
  const userName = (userId: string | null | undefined) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";

  const statusMeta = (status: "pending" | "accepted" | "declined") => {
    switch (status) {
      case "accepted":
        return {
          label: "Team moechte teilnehmen",
          className: "bg-emerald-100 text-emerald-800",
        };
      case "declined":
        return {
          label: "Team nimmt nicht teil",
          className: "bg-rose-100 text-rose-800",
        };
      default:
        return {
          label: "Rueckmeldung offen",
          className: "bg-amber-100 text-amber-800",
        };
    }
  };

  if (!canUseTournamentBoerse) {
    return (
      <SectionCard
        title="Turnierboerse"
        description="Admin, Vorstand und Trainer koordinieren hier Turnieranfragen fuer die Mannschaften."
      >
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          Dieser Bereich ist nur fuer Trainer, Vorstand und Admin sichtbar.
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Turnierboerse"
        description="Vorstand und Admin legen Turniere an. Trainer geben direkt Zu- oder Absage, damit schnell sichtbar ist, ob eine Mannschaft angemeldet werden soll."
        actions={
          canCreateTournament ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setCreateOpen(true);
                setTournamentPlanFile(null);
                setForm({
                  teamId: visibleTeams[0]?.id ?? "",
                  title: "",
                  description: "",
                  location: "",
                  startsAt: "",
                });
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              <Plus size={18} />
              Turnier anlegen
            </button>
          ) : null
        }
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

          <div className="rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-slate-700">
            Sobald ein Trainer zusagt, taucht das Turnier automatisch im eigenen Dashboard und im
            Terminbereich des Teams auf.
          </div>

          {sortedOffers.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {sortedOffers.map((offer) => {
                const status = statusMeta(offer.responseStatus);
                const trainerCanRespond =
                  canRespondToTournament &&
                  Boolean(currentUser?.teamIds.includes(offer.teamId));

                return (
                  <div
                    key={offer.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                            {teamName(offer.teamId)}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              status.className,
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">{offer.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          Angelegt von {userName(offer.createdBy)} am {formatDate(offer.createdAt)}
                        </p>
                        {offer.respondedBy ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Letzte Rueckmeldung von {userName(offer.respondedBy)} am{" "}
                            {formatDate(offer.respondedAt ?? "")}
                          </p>
                        ) : null}
                      </div>

                      {canCreateTournament ? (
                        <button
                          type="button"
                          disabled={savingId === offer.id}
                          onClick={async () => {
                            const confirmed = window.confirm("Turnier wirklich loeschen?");
                            if (!confirmed) {
                              return;
                            }

                            setError("");
                            setSuccess("");
                            setSavingId(offer.id);
                            const result = await deleteTournamentOffer(offer.id);

                            if (!result.success) {
                              setError(result.error ?? "Turnier konnte nicht geloescht werden.");
                            } else {
                              setSuccess("Turnier wurde geloescht.");
                            }

                            setSavingId(null);
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="inline-flex items-center gap-2 font-medium text-slate-900">
                          <CalendarDays size={15} className="text-blue-700" />
                          {formatDate(offer.startsAt)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="inline-flex items-center gap-2 font-medium text-slate-900">
                          <MapPin size={15} className="text-blue-700" />
                          {offer.location || "Ort wird noch abgestimmt"}
                        </div>
                      </div>
                    </div>

                    {offer.description ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {offer.description}
                      </div>
                    ) : null}

                    {offer.tournamentPlanUrl ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href={offer.tournamentPlanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <FileText size={16} />
                          Turnierplan oeffnen
                        </a>
                        <a
                          href={offer.tournamentPlanUrl}
                          download
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                        >
                          <Download size={16} />
                          Download
                        </a>
                      </div>
                    ) : null}

                    {trainerCanRespond ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={savingId === offer.id}
                          onClick={async () => {
                            setError("");
                            setSuccess("");
                            setSavingId(offer.id);
                            const result = await respondToTournamentOffer(offer.id, "accepted");

                            if (!result.success) {
                              setError(result.error ?? "Zusage konnte nicht gespeichert werden.");
                            } else {
                              setSuccess(
                                "Zusage gespeichert. Das Turnier bleibt jetzt im Dashboard und im Terminbereich sichtbar.",
                              );
                            }

                            setSavingId(null);
                          }}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Zusagen
                        </button>
                        <button
                          type="button"
                          disabled={savingId === offer.id}
                          onClick={async () => {
                            setError("");
                            setSuccess("");
                            setSavingId(offer.id);
                            const result = await respondToTournamentOffer(offer.id, "declined");

                            if (!result.success) {
                              setError(result.error ?? "Absage konnte nicht gespeichert werden.");
                            } else {
                              setSuccess("Absage gespeichert.");
                            }

                            setSavingId(null);
                          }}
                          className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Absagen
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
                <Trophy size={24} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">
                Noch keine Turnieranfragen vorhanden
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Vorstand und Admin koennen hier neue Turniere fuer die Mannschaften anlegen.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => {
            if (!submitting) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Turnier anlegen</p>
                <p className="mt-1 text-sm text-slate-600">
                  Team auswaehlen, Termin setzen und optional direkt einen Turnierplan hochladen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setSuccess("");
                setSubmitting(true);

                try {
                  const result = await addTournamentOffer({
                    teamId: form.teamId,
                    title: form.title,
                    description: form.description,
                    location: form.location,
                    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
                    tournamentPlanFile,
                  });

                  if (!result.success) {
                    setError(result.error ?? "Turnier konnte nicht gespeichert werden.");
                    return;
                  }

                  setCreateOpen(false);
                  setSuccess("Turnier wurde angelegt und wartet jetzt auf die Trainer-Rueckmeldung.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Mannschaft</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.teamId}
                  onChange={(event) => setForm({ ...form, teamId: event.target.value })}
                  required
                >
                  <option value="">Bitte auswaehlen</option>
                  {visibleTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Titel</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="z. B. Sommerturnier Offenbach"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Datum</span>
                  <input
                    type="datetime-local"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.startsAt}
                    onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Ort</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder="z. B. Sportanlage Musterstadt"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Beschreibung</span>
                <textarea
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Infos zum Turnier, Startgebuehr, Altersklasse oder Hinweise zur Anmeldung"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Turnierplan / Einladung
                </span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => setTournamentPlanFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-blue-900 hover:file:bg-blue-100"
                />
                {tournamentPlanFile ? (
                  <p className="mt-2 text-sm text-slate-600">{tournamentPlanFile.name}</p>
                ) : null}
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Speichert..." : "Turnier anlegen"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={submitting}
                  className={cn(
                    "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
                    submitting && "cursor-not-allowed opacity-60",
                  )}
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
