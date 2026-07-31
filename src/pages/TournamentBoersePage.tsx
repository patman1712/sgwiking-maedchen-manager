import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FilePenLine,
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
import type {
  TournamentOffer,
  TournamentOfferRegistrationStatus,
  TournamentOfferReplyStatus,
  TournamentOfferResponseStatus,
} from "@/types";

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

type TournamentGroup = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  tournamentPlanUrl?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  offers: TournamentOffer[];
};

function responseMeta(status: TournamentOfferResponseStatus) {
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
}

function registrationMeta(status: TournamentOfferRegistrationStatus) {
  switch (status) {
    case "registered":
      return {
        label: "Angemeldet",
        className: "bg-blue-100 text-blue-900",
      };
    case "cancelled":
      return {
        label: "Nicht angemeldet",
        className: "bg-slate-200 text-slate-700",
      };
    default:
      return {
        label: "Anmeldung offen",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

function tournamentReplyMeta(status: TournamentOfferReplyStatus) {
  switch (status) {
    case "accepted":
      return {
        label: "Turnierzusage da",
        className: "bg-emerald-100 text-emerald-800",
      };
    case "declined":
      return {
        label: "Turnierabsage da",
        className: "bg-rose-100 text-rose-800",
      };
    default:
      return {
        label: "Turnierrueckmeldung offen",
        className: "bg-amber-100 text-amber-800",
      };
  }
}

export default function TournamentBoersePage() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const tournamentOffers = useAppStore((state) => state.tournamentOffers);
  const addTournamentOffer = useAppStore((state) => state.addTournamentOffer);
  const updateTournamentOffer = useAppStore((state) => state.updateTournamentOffer);
  const respondToTournamentOffer = useAppStore((state) => state.respondToTournamentOffer);
  const updateTournamentOfferAdminStatus = useAppStore(
    (state) => state.updateTournamentOfferAdminStatus,
  );
  const deleteTournamentOffer = useAppStore((state) => state.deleteTournamentOffer);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canCreateTournament = currentUser?.role === "admin" || currentUser?.role === "board";
  const canRespondToTournament = currentUser?.role === "trainer";
  const canUseTournamentBoerse = canCreateTournament || canRespondToTournament;
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingGroup, setEditingGroup] = useState<TournamentGroup | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    teamIds: [] as string[],
    title: "",
    description: "",
    location: "",
    startsAt: "",
  });
  const [tournamentPlanFile, setTournamentPlanFile] = useState<File | null>(null);
  const [keepExistingPlan, setKeepExistingPlan] = useState(true);

  const visibleTeams = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "admin" || currentUser.role === "board") {
      return teams;
    }

    return teams.filter((team) => currentUser.teamIds.includes(team.id));
  }, [currentUser, teams]);

  const teamName = (teamId: string) => teams.find((team) => team.id === teamId)?.name ?? "Mannschaft";
  const userName = (userId: string | null | undefined) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";

  const groupedOffers = useMemo(() => {
    const now = Date.now();
    const groups = tournamentOffers.reduce<Map<string, TournamentGroup>>((accumulator, offer) => {
      const key = offer.groupId || offer.id;
      const existing = accumulator.get(key);

      if (existing) {
        existing.offers.push(offer);
        if (new Date(offer.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          existing.updatedAt = offer.updatedAt;
        }
        return accumulator;
      }

      accumulator.set(key, {
        id: key,
        title: offer.title,
        description: offer.description,
        location: offer.location,
        startsAt: offer.startsAt,
        tournamentPlanUrl: offer.tournamentPlanUrl ?? null,
        createdBy: offer.createdBy,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        offers: [offer],
      });
      return accumulator;
    }, new Map());

    return [...groups.values()]
      .map((group) => ({
        ...group,
        offers: [...group.offers].sort((left, right) =>
          teamName(left.teamId).localeCompare(teamName(right.teamId), "de"),
        ),
      }))
      .sort((left, right) => {
        const leftTime = new Date(left.startsAt).getTime();
        const rightTime = new Date(right.startsAt).getTime();
        const leftUpcoming = leftTime >= now ? 0 : 1;
        const rightUpcoming = rightTime >= now ? 0 : 1;

        if (leftUpcoming !== rightUpcoming) {
          return leftUpcoming - rightUpcoming;
        }

        return leftTime - rightTime;
      });
  }, [teamName, tournamentOffers]);

  const openCreateModal = () => {
    setError("");
    setSuccess("");
    setModalMode("create");
    setEditingGroup(null);
    setTournamentPlanFile(null);
    setKeepExistingPlan(true);
    setForm({
      teamIds: visibleTeams.length === 1 ? [visibleTeams[0].id] : [],
      title: "",
      description: "",
      location: "",
      startsAt: "",
    });
  };

  const openEditModal = (group: TournamentGroup) => {
    setError("");
    setSuccess("");
    setModalMode("edit");
    setEditingGroup(group);
    setTournamentPlanFile(null);
    setKeepExistingPlan(Boolean(group.tournamentPlanUrl));
    setForm({
      teamIds: group.offers.map((offer) => offer.teamId),
      title: group.title,
      description: group.description,
      location: group.location,
      startsAt: toLocalDateTimeInput(group.startsAt),
    });
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
              onClick={openCreateModal}
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

          {groupedOffers.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {groupedOffers.map((group) => {
                const groupLeadOffer = group.offers[0];
                const summaryAccepted = group.offers.filter(
                  (offer) => offer.responseStatus === "accepted",
                ).length;
                const summaryPending = group.offers.filter(
                  (offer) => offer.responseStatus === "pending",
                ).length;

                return (
                  <div
                    key={group.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                            {group.offers.length} Team{group.offers.length === 1 ? "" : "s"}
                          </span>
                          {summaryAccepted > 0 ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                              {summaryAccepted} Zusage{summaryAccepted === 1 ? "" : "n"}
                            </span>
                          ) : null}
                          {summaryPending > 0 ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              {summaryPending} offen
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">{group.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          Angelegt von {userName(group.createdBy)} am {formatDate(group.createdAt)}
                        </p>
                        {group.updatedAt !== group.createdAt ? (
                          <p className="mt-1 text-sm text-slate-600">
                            Zuletzt bearbeitet am {formatDate(group.updatedAt)}
                          </p>
                        ) : null}
                      </div>

                      {canCreateTournament ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(group)}
                            className="inline-flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 p-2 text-blue-900 transition hover:bg-blue-100"
                          >
                            <FilePenLine size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={savingId === groupLeadOffer.id}
                            onClick={async () => {
                              const confirmed = window.confirm(
                                "Turnier fuer alle zugeordneten Teams wirklich loeschen?",
                              );
                              if (!confirmed) {
                                return;
                              }

                              setError("");
                              setSuccess("");
                              setSavingId(groupLeadOffer.id);
                              const result = await deleteTournamentOffer(groupLeadOffer.id);

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
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="inline-flex items-center gap-2 font-medium text-slate-900">
                          <CalendarDays size={15} className="text-blue-700" />
                          {formatDate(group.startsAt)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <div className="inline-flex items-center gap-2 font-medium text-slate-900">
                          <MapPin size={15} className="text-blue-700" />
                          {group.location || "Ort wird noch abgestimmt"}
                        </div>
                      </div>
                    </div>

                    {group.description ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {group.description}
                      </div>
                    ) : null}

                    {group.tournamentPlanUrl ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href={group.tournamentPlanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <FileText size={16} />
                          Turnierplan oeffnen
                        </a>
                        <a
                          href={group.tournamentPlanUrl}
                          download
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                        >
                          <Download size={16} />
                          Download
                        </a>
                      </div>
                    ) : null}

                    <div className="mt-5 space-y-3">
                      {group.offers.map((offer) => {
                        const trainerCanRespond =
                          canRespondToTournament &&
                          Boolean(currentUser?.teamIds.includes(offer.teamId));
                        const response = responseMeta(offer.responseStatus);
                        const registration = registrationMeta(offer.registrationStatus);
                        const tournamentReply = tournamentReplyMeta(offer.tournamentReplyStatus);

                        return (
                          <div
                            key={offer.id}
                            className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">
                                {teamName(offer.teamId)}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-semibold",
                                  response.className,
                                )}
                              >
                                {response.label}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-semibold",
                                  registration.className,
                                )}
                              >
                                {registration.label}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-3 py-1 text-xs font-semibold",
                                  tournamentReply.className,
                                )}
                              >
                                {tournamentReply.label}
                              </span>
                            </div>

                            {offer.respondedBy ? (
                              <p className="mt-3 text-sm text-slate-600">
                                Rueckmeldung von {userName(offer.respondedBy)} am{" "}
                                {formatDate(offer.respondedAt ?? "")}
                              </p>
                            ) : null}

                            {trainerCanRespond ? (
                              <div className="mt-4 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  disabled={savingId === offer.id}
                                  onClick={async () => {
                                    setError("");
                                    setSuccess("");
                                    setSavingId(offer.id);
                                    const result = await respondToTournamentOffer(
                                      offer.id,
                                      "accepted",
                                    );

                                    if (!result.success) {
                                      setError(
                                        result.error ?? "Zusage konnte nicht gespeichert werden.",
                                      );
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
                                    const result = await respondToTournamentOffer(
                                      offer.id,
                                      "declined",
                                    );

                                    if (!result.success) {
                                      setError(
                                        result.error ?? "Absage konnte nicht gespeichert werden.",
                                      );
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

                            {canCreateTournament ? (
                              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Anmeldung
                                  </span>
                                  {(["open", "registered", "cancelled"] as const).map((status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      disabled={savingId === offer.id}
                                      onClick={async () => {
                                        setError("");
                                        setSuccess("");
                                        setSavingId(offer.id);
                                        const result = await updateTournamentOfferAdminStatus(
                                          offer.id,
                                          { registrationStatus: status },
                                        );

                                        if (!result.success) {
                                          setError(
                                            result.error ??
                                              "Anmeldestatus konnte nicht gespeichert werden.",
                                          );
                                        } else {
                                          setSuccess("Anmeldestatus gespeichert.");
                                        }

                                        setSavingId(null);
                                      }}
                                      className={cn(
                                        "rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                                        offer.registrationStatus === status
                                          ? "border-blue-300 bg-blue-100 text-blue-900"
                                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                                      )}
                                    >
                                      {registrationMeta(status).label}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Turnierrueckmeldung
                                  </span>
                                  {(["pending", "accepted", "declined"] as const).map((status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      disabled={savingId === offer.id}
                                      onClick={async () => {
                                        setError("");
                                        setSuccess("");
                                        setSavingId(offer.id);
                                        const result = await updateTournamentOfferAdminStatus(
                                          offer.id,
                                          { tournamentReplyStatus: status },
                                        );

                                        if (!result.success) {
                                          setError(
                                            result.error ??
                                              "Turnierrueckmeldung konnte nicht gespeichert werden.",
                                          );
                                        } else {
                                          setSuccess("Turnierrueckmeldung gespeichert.");
                                        }

                                        setSavingId(null);
                                      }}
                                      className={cn(
                                        "rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                                        offer.tournamentReplyStatus === status
                                          ? "border-blue-300 bg-blue-100 text-blue-900"
                                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                                      )}
                                    >
                                      {tournamentReplyMeta(status).label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
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

      {modalMode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => {
            if (!submitting) {
              setModalMode(null);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {modalMode === "create" ? "Turnier anlegen" : "Turnier bearbeiten"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {modalMode === "create"
                    ? "Mehrere Mannschaften auswaehlen, Termin setzen und optional direkt einen Turnierplan hochladen."
                    : "Turnierdaten aktualisieren, spaeteren Turnierplan hochladen oder Angaben korrigieren."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
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
                  const result =
                    modalMode === "create"
                      ? await addTournamentOffer({
                          teamIds: form.teamIds,
                          title: form.title,
                          description: form.description,
                          location: form.location,
                          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
                          tournamentPlanFile,
                        })
                      : await updateTournamentOffer(editingGroup?.offers[0]?.id ?? "", {
                          title: form.title,
                          description: form.description,
                          location: form.location,
                          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
                          tournamentPlanFile,
                          keepExistingPlan,
                        });

                  if (!result.success) {
                    setError(result.error ?? "Turnier konnte nicht gespeichert werden.");
                    return;
                  }

                  setModalMode(null);
                  setSuccess(
                    modalMode === "create"
                      ? "Turnier wurde angelegt und wartet jetzt auf die Trainer-Rueckmeldungen."
                      : "Turnier wurde bearbeitet. Die betroffenen Trainer sehen die Aenderung als Hinweis.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {modalMode === "create" ? (
                <div className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Mannschaften
                  </span>
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleTeams.map((team) => {
                      const selected = form.teamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              teamIds: selected
                                ? current.teamIds.filter((teamId) => teamId !== team.id)
                                : [...current.teamIds, team.id],
                            }))
                          }
                          className={cn(
                            "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
                            selected
                              ? "border-blue-300 bg-blue-50 text-blue-950"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
                          )}
                        >
                          <span className="font-medium">{team.name}</span>
                          {selected ? <CheckCircle2 size={16} /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Angefragte Mannschaften
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {form.teamIds.map((teamId) => (
                      <span
                        key={teamId}
                        className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900"
                      >
                        {teamName(teamId)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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

              {modalMode === "edit" && editingGroup?.tournamentPlanUrl ? (
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={keepExistingPlan}
                    onChange={(event) => setKeepExistingPlan(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                  />
                  Vorhandenen Turnierplan behalten
                </label>
              ) : null}

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
                ) : editingGroup?.tournamentPlanUrl && keepExistingPlan ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Bestehender Turnierplan bleibt erhalten, bis du eine neue Datei waehlst.
                  </p>
                ) : null}
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Speichert..."
                    : modalMode === "create"
                      ? "Turnier anlegen"
                      : "Turnier speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
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
