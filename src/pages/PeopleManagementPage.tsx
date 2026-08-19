import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { useAppStore } from "@/store";
import type { PlayerDocumentType, UserRole } from "@/types";

interface PeopleManagementPageProps {
  role: Extract<UserRole, "trainer" | "player" | "board" | "social">;
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
  social: {
    pageTitle: "Social Media Manager",
    listTitle: "Social Media Bereich",
    listDescription:
      "Mitglieder in dieser Rolle haben NUR Zugriff auf den Social-Media-Editor und die Bibliothek – keine Spieler- oder Trainerverwaltung.",
    formTitle: "Social Media Manager anlegen / bearbeiten",
    formDescription:
      "Diese Rolle ist rein auf die Social-Media-Funktion beschraenkt. Teams, Spieler, Vorstandsbereich etc. sind komplett ausgeblendet.",
    roleLabel: "Social Media",
    selectLabel: "Social Media Manager",
    emptyText: "Keine Teamzuordnung (Social-only)",
    showTeams: false,
  },
} as const;

const playerDocumentDefinitions: Array<{
  key: PlayerDocumentType;
  label: string;
  statusKey:
    | "isMember"
    | "hasMembershipApplication"
    | "hasMedicalCertificate"
    | "hasPhotoConsentSocial";
}> = [
  { key: "member", label: "Mitglied", statusKey: "isMember" },
  {
    key: "membershipApplication",
    label: "Mitgliedsantrag",
    statusKey: "hasMembershipApplication",
  },
  {
    key: "medicalCertificate",
    label: "Aerztliches Attest",
    statusKey: "hasMedicalCertificate",
  },
  {
    key: "photoConsentSocial",
    label: "Fotorecht Social Media",
    statusKey: "hasPhotoConsentSocial",
  },
];

const createEmptyForm = (role: Extract<UserRole, "trainer" | "player" | "board" | "social">) => ({
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role,
  teamIds: [] as string[],
  notes: "",
  memberNumber: "",
  birthday: "",
  address: "",
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  isMember: false,
  hasMembershipApplication: false,
  hasMedicalCertificate: false,
  hasPhotoConsentSocial: false,
  socialMediaEnabled: role === "trainer",
});

const createEmptyDocumentFiles = (): Record<PlayerDocumentType, File | null> => ({
  member: null,
  membershipApplication: null,
  medicalCertificate: null,
  photoConsentSocial: null,
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
  const deleteUser = useAppStore((state) => state.deleteUser);
  const uploadPlayerDocument = useAppStore((state) => state.uploadPlayerDocument);
  const navigate = useNavigate();
  const [form, setForm] = useState(createEmptyForm(role));
  const [documentFiles, setDocumentFiles] = useState(createEmptyDocumentFiles());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canManageFromMenu =
    currentUser?.role === "admin" || currentUser?.role === "board";

  if (!canManageFromMenu) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = useMemo(
    () =>
      users
        .filter((user) => user.role === role)
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "de")),
    [role, users],
  );

  const openCreateModal = () => {
    setSelectedUserId(null);
    setForm(createEmptyForm(role));
    setDocumentFiles(createEmptyDocumentFiles());
    setError("");
    setShowFormModal(true);
  };

  const startEdit = (userId: string) => {
    if (role === "player") {
      navigate(`/dashboard/players/${userId}`);
      return;
    }

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
      memberNumber: user.memberNumber ?? "",
      birthday: user.birthday ?? "",
      address: user.address ?? "",
      parentName: user.parentName ?? "",
      parentPhone: user.parentPhone ?? "",
      parentEmail: user.parentEmail ?? "",
      isMember: user.isMember ?? false,
      hasMembershipApplication: user.hasMembershipApplication ?? false,
      hasMedicalCertificate: user.hasMedicalCertificate ?? false,
      hasPhotoConsentSocial: user.hasPhotoConsentSocial ?? false,
      socialMediaEnabled: Boolean(user.socialMediaEnabled),
    });
    setDocumentFiles(createEmptyDocumentFiles());
    setShowFormModal(true);
  };

  const resetForm = () => {
    setSelectedUserId(null);
    setError("");
    setForm(createEmptyForm(role));
    setDocumentFiles(createEmptyDocumentFiles());
    setConfirmDeleteOpen(false);
    setConfirmDeleteText("");
    setDeleting(false);
    setShowFormModal(false);
  };

  const saveDocumentUploads = async (userId: string) => {
    for (const [documentType, file] of Object.entries(documentFiles) as Array<
      [PlayerDocumentType, File | null]
    >) {
      if (!file) {
        continue;
      }

      const uploadFile =
        file.type.startsWith("image/") && file.type !== "image/svg+xml"
          ? await optimizeImageForUpload(file)
          : file;
      const uploadResult = await uploadPlayerDocument(userId, documentType, uploadFile);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error ?? "Unterlage konnte nicht hochgeladen werden.");
      }
    }
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
                  ) : role === "social" ? (
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900">
                      Nur Social Media
                    </span>
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

      <SectionCard
        title={role === "player" ? "Spielerin anlegen" : "Verwaltung"}
        description={role === "player" ? undefined : config.formDescription}
      >
        <div className="space-y-4">
          {role !== "player" ? (
            <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-sm font-semibold text-blue-950">
                {`Neue ${config.roleLabel.toLowerCase()} werden direkt ueber ein Popup angelegt.`}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                So bleibt die Uebersicht kompakt und die Personenliste nutzt die volle Breite.
              </p>
            </div>
          ) : null}

          {!canManageFromMenu ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Dieser Bereich kann nur von Admin oder Vorstand bearbeitet werden.
            </div>
          ) : (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              <Plus size={18} />
              {config.roleLabel} anlegen
            </button>
          )}
        </div>
      </SectionCard>

      {showFormModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => {
            if (!saving) {
              resetForm();
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedUserId ? `${config.roleLabel} bearbeiten` : `${config.roleLabel} anlegen`}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {role === "player"
                    ? "Mit Teamzuordnung, Elternkontakten und Unterlagen in einem Schritt."
                    : "Zugangsdaten und Teamzuordnung kompakt im Popup pflegen."}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 transition hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setSaving(true);

                try {
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
                        memberNumber: payload.memberNumber,
                        birthday: payload.birthday,
                        address: payload.address,
                        parentName: payload.parentName,
                        parentPhone: payload.parentPhone,
                        parentEmail: payload.parentEmail,
                        isMember: role === "player" ? payload.isMember : undefined,
                        hasMembershipApplication:
                          role === "player" ? payload.hasMembershipApplication : undefined,
                        hasMedicalCertificate:
                          role === "player" ? payload.hasMedicalCertificate : undefined,
                        hasPhotoConsentSocial:
                          role === "player" ? payload.hasPhotoConsentSocial : undefined,
                        socialMediaEnabled:
                          role !== "board"
                            ? payload.socialMediaEnabled
                            : undefined,
                      })
                    : await addUser({
                        fullName: payload.fullName,
                        email: payload.email,
                        password: payload.password,
                        phone: payload.phone,
                        role,
                        teamIds: payload.teamIds,
                        notes: payload.notes,
                        memberNumber: payload.memberNumber,
                        birthday: payload.birthday,
                        address: payload.address,
                        parentName: payload.parentName,
                        parentPhone: payload.parentPhone,
                        parentEmail: payload.parentEmail,
                        isMember: role === "player" ? payload.isMember : undefined,
                        hasMembershipApplication:
                          role === "player" ? payload.hasMembershipApplication : undefined,
                        hasMedicalCertificate:
                          role === "player" ? payload.hasMedicalCertificate : undefined,
                        hasPhotoConsentSocial:
                          role === "player" ? payload.hasPhotoConsentSocial : undefined,
                        socialMediaEnabled:
                          role !== "board" ? payload.socialMediaEnabled : false,
                      });

                  if (!result.success) {
                    setError(result.error ?? "Speichern nicht moeglich.");
                    return;
                  }

                  const targetUserId = selectedUserId ?? result.userId ?? null;

                  if (role === "player" && targetUserId) {
                    await saveDocumentUploads(targetUserId);
                  }

                  resetForm();
                } catch (saveError) {
                  setError(
                    saveError instanceof Error
                      ? saveError.message
                      : "Speichern nicht moeglich.",
                  );
                } finally {
                  setSaving(false);
                }
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
                    type="password"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required={!selectedUserId}
                    placeholder={
                      selectedUserId
                        ? "Leer lassen, wenn es unveraendert bleiben soll"
                        : "Startpasswort vergeben"
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

              {role === "player" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Mitgliedsnummer
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={form.memberNumber}
                        onChange={(event) =>
                          setForm({ ...form, memberNumber: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Geburtstag
                      </span>
                      <input
                        type="date"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={form.birthday}
                        onChange={(event) => setForm({ ...form, birthday: event.target.value })}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Anschrift</span>
                    <textarea
                      className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={form.address}
                      onChange={(event) => setForm({ ...form, address: event.target.value })}
                    />
                  </label>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Kontakt Eltern
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          value={form.parentName}
                          onChange={(event) =>
                            setForm({ ...form, parentName: event.target.value })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Handynummer
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          value={form.parentPhone}
                          onChange={(event) =>
                            setForm({ ...form, parentPhone: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">E-Mail</span>
                      <input
                        type="email"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        value={form.parentEmail}
                        onChange={(event) =>
                          setForm({ ...form, parentEmail: event.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Unterlagen
                    </p>
                    <div className="mt-4 space-y-3">
                      {playerDocumentDefinitions.map((entry) => (
                        <div
                          key={entry.key}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={form[entry.statusKey]}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  [entry.statusKey]: event.target.checked,
                                })
                              }
                            />
                            <span className="text-sm font-medium text-slate-700">
                              {entry.label}
                            </span>
                          </label>

                          <label className="mt-3 block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Datei optional
                            </span>
                            <input
                              type="file"
                              accept=".png,.jpg,.jpeg,.webp,.pdf,.svg,.doc,.docx"
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800"
                              onChange={(event) =>
                                setDocumentFiles((current) => ({
                                  ...current,
                                  [entry.key]: event.target.files?.[0] ?? null,
                                }))
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

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

              {role !== "board" ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50/60">
                  <input
                    type="checkbox"
                    checked={form.socialMediaEnabled}
                    onChange={(event) =>
                      setForm({ ...form, socialMediaEnabled: event.target.checked })
                    }
                    className="mt-0.5 h-5 w-5 cursor-pointer accent-blue-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Darf Social-Media-Postings erstellen
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Zugriff auf den Social-Media-Editor mit Auswahl von freigegebenen
                      Vorlagen. Keine Rechte zum Anlegen von Vorlagen, Assets oder Ordnern.
                    </p>
                  </div>
                </label>
              ) : null}

              <div className="space-y-4 pt-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
                <div>
                  {selectedUserId &&
                  canManageFromMenu &&
                  currentUserId !== selectedUserId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setConfirmDeleteText("");
                        setConfirmDeleteOpen(true);
                      }}
                      disabled={saving || deleting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300 bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
                    >
                      <Trash2 size={16} />
                      {config.roleLabel} löschen
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {saving
                      ? "Wird gespeichert..."
                      : selectedUserId
                        ? `${config.roleLabel} speichern`
                        : `${config.roleLabel} anlegen`}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving || deleting}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDeleteOpen && selectedUserId ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!deleting) {
              setConfirmDeleteOpen(false);
              setConfirmDeleteText("");
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-[2rem] border border-rose-200 bg-white p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {config.roleLabel} wirklich UNWIDERRUFLICH löschen?
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Du bist im Begriff,{" "}
                  <strong className="text-slate-900">
                    {form.fullName || "diese Person"}
                  </strong>{" "}
                  als {config.roleLabel.toLowerCase()} zu löschen.
                </p>
                <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <strong>Achtung, das passiert alles unwiderruflich:</strong>
                  <br />• Der Login-Account wird sofort <strong>ungültig</strong>.
                  <br />• <strong>Alle persönlichen Daten</strong> (Name, E-Mail, Telefon,
                  Notizen, Passwort) werden aus der Datenbank gelöscht.
                  <br />• Team-Zuordnungen, Zu- / Absagen, gesendete Chat-Nachrichten und
                  erstellte Termine werden kaskadiert entfernt.
                  <br />• Alle Social Media Postings / Entwürfe{" "}
                  <strong>und hochgeladenen Bilder</strong> werden vom Server gelöscht.
                  <br />• Profilbilder und (bei Spielerinnen) alle Dokumente werden physisch
                  von der Festplatte gelöscht.
                  <br />• <strong>Kein „Papierkorb" – keine Wiederherstellung möglich!</strong>
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-dashed border-rose-300 bg-rose-50/60 p-4">
              {(() => {
                const fallback =
                  config.roleLabel + " " + selectedUserId.slice(-6).toUpperCase();
                const expected = `LÖSCHEN ${form.fullName || fallback}`;
                return (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-rose-900">
                        Zur Bestätigung tippe folgenden Text GENAU ein:
                      </span>
                      <div className="mb-3 overflow-x-auto rounded-2xl border border-rose-200 bg-white px-4 py-3 font-mono text-sm font-bold tracking-wider text-rose-900">
                        {expected}
                      </div>
                      <input
                        type="text"
                        autoFocus
                        disabled={deleting}
                        value={confirmDeleteText}
                        onChange={(event) => setConfirmDeleteText(event.target.value)}
                        placeholder={expected}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100 disabled:bg-slate-100"
                      />
                    </label>
                    {error ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
                        {error}
                      </div>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => {
                          setConfirmDeleteOpen(false);
                          setConfirmDeleteText("");
                          setError("");
                        }}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        disabled={deleting || confirmDeleteText.trim() !== expected}
                        onClick={async () => {
                          setDeleting(true);
                          setError("");
                          try {
                            const result = await deleteUser(selectedUserId);
                            if (!result.success) {
                              setError(
                                result.error ??
                                  `${config.roleLabel} konnte nicht gelöscht werden. Bitte später nochmal versuchen.`,
                              );
                              return;
                            }
                            setConfirmDeleteOpen(false);
                            setConfirmDeleteText("");
                            resetForm();
                          } finally {
                            setDeleting(false);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-700 to-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-700/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleting
                          ? "Daten werden vom Server entfernt..."
                          : `Ja, ${config.roleLabel} ENDGÜLTIG löschen`}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
