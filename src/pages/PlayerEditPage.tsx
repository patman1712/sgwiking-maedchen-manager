import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Download, FileText, ImagePlus, Pencil, Shield, Trash2, X } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { useAppStore } from "@/store";
import type { PlayerDocumentType, UserProfile } from "@/types";

function formatValue(value?: string | null) {
  return value && value.trim() ? value : "Nicht hinterlegt";
}

function formatBirthday(value?: string | null) {
  if (!value) {
    return "Nicht hinterlegt";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("de-DE");
}

function StatusBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {label}
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

const playerDocumentDefinitions: Array<{
  key: PlayerDocumentType;
  label: string;
  statusKey:
    | "isMember"
    | "hasMembershipApplication"
    | "hasMedicalCertificate"
    | "hasPhotoConsentSocial";
  fileKey:
    | "isMemberFileUrl"
    | "membershipApplicationFileUrl"
    | "medicalCertificateFileUrl"
    | "photoConsentSocialFileUrl";
}> = [
  {
    key: "member",
    label: "Mitglied",
    statusKey: "isMember",
    fileKey: "isMemberFileUrl",
  },
  {
    key: "membershipApplication",
    label: "Mitgliedsantrag",
    statusKey: "hasMembershipApplication",
    fileKey: "membershipApplicationFileUrl",
  },
  {
    key: "medicalCertificate",
    label: "Aerztliches Attest",
    statusKey: "hasMedicalCertificate",
    fileKey: "medicalCertificateFileUrl",
  },
  {
    key: "photoConsentSocial",
    label: "Fotorecht Social Media",
    statusKey: "hasPhotoConsentSocial",
    fileKey: "photoConsentSocialFileUrl",
  },
];

const createEmptyDocumentFiles = (): Record<PlayerDocumentType, File | null> => ({
  member: null,
  membershipApplication: null,
  medicalCertificate: null,
  photoConsentSocial: null,
});

export default function PlayerEditPage() {
  const { playerId } = useParams();
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateUser = useAppStore((state) => state.updateUser);
  const deleteUser = useAppStore((state) => state.deleteUser);
  const uploadUserAvatar = useAppStore((state) => state.uploadUserAvatar);
  const uploadPlayerDocument = useAppStore((state) => state.uploadPlayerDocument);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const player = useMemo(
    () => users.find((user) => user.id === playerId && user.role === "player") ?? null,
    [playerId, users],
  );
  const hasSharedTeam =
    !!currentUser &&
    !!player &&
    currentUser.teamIds.some((teamId) => player.teamIds.includes(teamId));
  const isPrivilegedViewer =
    !!currentUser &&
    !!player &&
    (currentUser.role === "admin" ||
      currentUser.role === "board" ||
      (currentUser.role === "trainer" && hasSharedTeam));
  const isOwnProfile = currentUserId === player?.id;
  const canViewProfile =
    !!currentUser &&
    !!player &&
    (isPrivilegedViewer ||
      isOwnProfile ||
      (currentUser.role === "player" && hasSharedTeam));
  const showLimitedPlayerView =
    !!currentUser &&
    !!player &&
    currentUser.role === "player" &&
    !isOwnProfile &&
    hasSharedTeam;
  const canEdit = isPrivilegedViewer;
  const canManageMemberships =
    currentUser?.role === "admin" || currentUser?.role === "board";
  const canManageDocuments = canManageMemberships;
  const canDelete = canManageMemberships;

  const [form, setForm] = useState(() => ({
    fullName: player?.fullName ?? "",
    email: player?.email ?? "",
    phone: player?.phone ?? "",
    notes: player?.notes ?? "",
    teamIds: player?.teamIds ?? [],
    memberNumber: player?.memberNumber ?? "",
    birthday: player?.birthday ?? "",
    address: player?.address ?? "",
    parentName: player?.parentName ?? "",
    parentPhone: player?.parentPhone ?? "",
    parentEmail: player?.parentEmail ?? "",
    isMember: player?.isMember ?? false,
    hasMembershipApplication: player?.hasMembershipApplication ?? false,
    hasMedicalCertificate: player?.hasMedicalCertificate ?? false,
    hasPhotoConsentSocial: player?.hasPhotoConsentSocial ?? false,
    password: "",
  }));
  const [documentFiles, setDocumentFiles] = useState(createEmptyDocumentFiles());

  useEffect(() => {
    if (!playerId || !player) {
      return;
    }

    setForm({
      fullName: player.fullName,
      email: player.email,
      phone: player.phone,
      notes: player.notes,
      teamIds: player.teamIds,
      memberNumber: player.memberNumber ?? "",
      birthday: player.birthday ?? "",
      address: player.address ?? "",
      parentName: player.parentName ?? "",
      parentPhone: player.parentPhone ?? "",
      parentEmail: player.parentEmail ?? "",
      isMember: player.isMember ?? false,
      hasMembershipApplication: player.hasMembershipApplication ?? false,
      hasMedicalCertificate: player.hasMedicalCertificate ?? false,
      hasPhotoConsentSocial: player.hasPhotoConsentSocial ?? false,
      password: "",
    });
    setDocumentFiles(createEmptyDocumentFiles());
    setIsEditing(false);
    setError("");
    setSuccess("");
  }, [playerId, player?.id]);

  if (!playerId || !player) {
    return <Navigate to="/dashboard/players" replace />;
  }

  if (!canViewProfile) {
    return <Navigate to="/dashboard/players" replace />;
  }

  const visibleTeamNames = player.teamIds
    .map((teamId) => teams.find((entry) => entry.id === teamId)?.name ?? teamId)
    .filter(Boolean);

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
      const result = await uploadPlayerDocument(userId, documentType, uploadFile);

      if (!result.success) {
        throw new Error(result.error ?? "Unterlage konnte nicht gespeichert werden.");
      }
    }
  };

  const getPlayerDocumentUrl = <
    Key extends
      | "isMemberFileUrl"
      | "membershipApplicationFileUrl"
      | "medicalCertificateFileUrl"
      | "photoConsentSocialFileUrl",
  >(
    source: UserProfile,
    key: Key,
  ) => source[key];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/dashboard/players"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <ChevronLeft size={16} />
            Zurueck zu Spielerinnen
          </Link>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">{player.fullName}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {showLimitedPlayerView
              ? "Profilansicht mit freigegebenen Basisinformationen."
              : "Profilansicht der Spielerin mit allen hinterlegten Informationen."}
          </p>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {canDelete ? (
              <button
                type="button"
                onClick={async () => {
                  setError("");
                  setSuccess("");

                  const confirmed = window.confirm(
                    `Spielerin "${player.fullName}" wirklich loeschen? Alle Daten und Bilder werden entfernt.`,
                  );

                  if (!confirmed) {
                    return;
                  }

                  const result = await deleteUser(player.id);

                  if (!result.success) {
                    setError(result.error ?? "Spielerin konnte nicht geloescht werden.");
                    return;
                  }

                  navigate("/dashboard/players", { replace: true });
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 size={18} />
                Loeschen
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setIsEditing((current) => !current);
                setError("");
                setSuccess("");
              }}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                isEditing
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg shadow-blue-900/20 hover:-translate-y-0.5"
              }`}
            >
              {isEditing ? <X size={18} /> : <Pencil size={18} />}
              {isEditing ? "Bearbeiten schliessen" : "Bearbeiten"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <SectionCard
          title="Spielerinnenbild"
          description={
            isEditing
              ? "Im Bearbeiten-Modus kann das Bild hochgeladen und optimiert gespeichert werden."
              : "Das Bild kann gross angesehen werden."
          }
        >
          <div className="space-y-4">
            <div className="flex min-h-72 items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
              {player.avatarUrl ? (
                <button
                  type="button"
                  onClick={() => setImageModalOpen(true)}
                  className="group overflow-hidden rounded-[2rem]"
                >
                  <img
                    src={player.avatarUrl}
                    alt={player.fullName}
                    className="max-h-64 max-w-full rounded-[2rem] object-cover shadow-lg transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-100 text-blue-800">
                    <Shield size={42} />
                  </div>
                  <p className="mt-4 text-sm">Noch kein Bild hochgeladen</p>
                </div>
              )}
            </div>

            {isEditing ? (
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError("");
                  setSuccess("");
                  const formElement = event.currentTarget;
                  const fileInput = formElement.elements.namedItem("avatar") as HTMLInputElement | null;
                  const file = fileInput?.files?.[0];

                  if (!file) {
                    setError("Bitte zuerst ein Bild auswaehlen.");
                    return;
                  }

                  setUploading(true);

                  try {
                    const optimizedFile = await optimizeImageForUpload(file);
                    const result = await uploadUserAvatar(player.id, optimizedFile);

                    if (!result.success) {
                      setError(result.error ?? "Bild konnte nicht gespeichert werden.");
                      return;
                    }

                    formElement.reset();
                    setSuccess("Das Spielerinnenbild wurde gespeichert.");
                  } catch {
                    setError("Das Bild konnte nicht verarbeitet werden.");
                  } finally {
                    setUploading(false);
                  }
                }}
              >
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

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Bilddatei</span>
                  <input
                    name="avatar"
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800"
                  />
                </label>

                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ImagePlus size={18} />
                  {uploading ? "Wird gespeichert..." : "Bild hochladen"}
                </button>
              </form>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                {canEdit
                  ? "Dieses Profil wird zuerst nur angezeigt. Ueber Bearbeiten kannst du es anpassen."
                  : "Dieses Profil ist nur zur Ansicht geoeffnet."}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Spielerinnenprofil"
          description={
            isEditing
              ? "Hier kannst du die hinterlegten Daten der Spielerin bearbeiten."
              : "Hier siehst du die hinterlegten Profildaten der Spielerin."
          }
        >
          {isEditing ? (
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setSuccess("");
                try {
                  const result = await updateUser({
                    userId: player.id,
                    fullName: form.fullName,
                    email: form.email,
                    phone: form.phone,
                    notes: form.notes,
                    teamIds: canManageMemberships ? form.teamIds : undefined,
                    memberNumber: form.memberNumber,
                    birthday: form.birthday,
                    address: form.address,
                    parentName: form.parentName,
                    parentPhone: form.parentPhone,
                    parentEmail: form.parentEmail,
                    isMember: canManageDocuments ? form.isMember : undefined,
                    hasMembershipApplication: canManageDocuments
                      ? form.hasMembershipApplication
                      : undefined,
                    hasMedicalCertificate: canManageDocuments
                      ? form.hasMedicalCertificate
                      : undefined,
                    hasPhotoConsentSocial: canManageDocuments
                      ? form.hasPhotoConsentSocial
                      : undefined,
                    password: form.password.trim() || undefined,
                    role: "player",
                  });

                  if (!result.success) {
                    setError(result.error ?? "Spielerin konnte nicht gespeichert werden.");
                    return;
                  }

                  setDocumentUploading(true);
                  await saveDocumentUploads(player.id);
                  setForm((current) => ({ ...current, password: "" }));
                  setDocumentFiles(createEmptyDocumentFiles());
                  setSuccess("Die Spielerin wurde gespeichert.");
                  setIsEditing(false);
                } catch (saveError) {
                  setError(
                    saveError instanceof Error
                      ? saveError.message
                      : "Spielerin konnte nicht gespeichert werden.",
                  );
                } finally {
                  setDocumentUploading(false);
                }
              }}
            >
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

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Mitgliedsnummer
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.memberNumber}
                    onChange={(event) => setForm({ ...form, memberNumber: event.target.value })}
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
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                      onChange={(event) => setForm({ ...form, parentName: event.target.value })}
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
                    onChange={(event) => setForm({ ...form, parentEmail: event.target.value })}
                  />
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Unterlagen
                </p>
                {!canManageDocuments ? (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    Unterlagen koennen nur von Admin oder Vorstand geaendert werden. Trainer sehen
                    den Status hier nur zur Kontrolle.
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  {playerDocumentDefinitions.map((entry) => {
                    const currentFileUrl = getPlayerDocumentUrl(player, entry.fileKey);
                    return (
                      <div
                        key={entry.key}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={form[entry.statusKey]}
                            disabled={!canManageDocuments}
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

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {currentFileUrl ? (
                            <a
                              href={currentFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            >
                              <Download size={16} />
                              Datei oeffnen
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
                              <FileText size={16} />
                              Keine Datei hinterlegt
                            </span>
                          )}
                        </div>

                        {canManageDocuments ? (
                          <label className="mt-3 block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Datei hochladen oder ersetzen
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
                        ) : null}
                      </div>
                    );
                  })}
                </div>
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
                  placeholder="Leer lassen, wenn es unveraendert bleiben soll"
                />
              </label>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Teams</p>
                {canManageMemberships ? (
                  <>
                    <div className="mt-4 space-y-2">
                      {teams.map((team) => (
                        <label
                          key={team.id}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
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
                    <p className="mt-3 text-xs text-slate-500">
                      Die Teamzuordnung darf nur von Admin oder Vorstand geaendert werden.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {visibleTeamNames.length ? (
                        visibleTeamNames.map((teamName) => (
                          <span
                            key={teamName}
                            className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
                          >
                            {teamName}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">Keinem Team zugeordnet</span>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Die Teamzuordnung wird zentral im Bereich Spielerinnen von Admin oder Vorstand
                      gepflegt.
                    </p>
                  </>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={documentUploading}
                  className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                >
                  {documentUploading ? "Wird gespeichert..." : "Spielerin speichern"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <DetailField label="Name" value={formatValue(player.fullName)} />
                <DetailField label="E-Mail" value={formatValue(player.email)} />
                <DetailField label="Telefon" value={formatValue(player.phone)} />
                <DetailField
                  label="Geburtstag"
                  value={formatBirthday(player.birthday)}
                />
                <DetailField
                  label="Mitgliedsnummer"
                  value={formatValue(player.memberNumber)}
                />
                {!showLimitedPlayerView ? (
                  <DetailField
                    label="Teams"
                    value={visibleTeamNames.length ? visibleTeamNames.join(", ") : "Keinem Team zugeordnet"}
                  />
                ) : null}
              </div>

              {showLimitedPlayerView ? null : (
                <>
                  <DetailField label="Anschrift" value={formatValue(player.address)} />

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Kontakt Eltern
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <DetailField label="Name" value={formatValue(player.parentName)} />
                      <DetailField
                        label="Handynummer"
                        value={formatValue(player.parentPhone)}
                      />
                    </div>
                    <div className="mt-4">
                      <DetailField label="E-Mail" value={formatValue(player.parentEmail)} />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Unterlagen
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {playerDocumentDefinitions.map((entry) => {
                        const currentFileUrl = getPlayerDocumentUrl(player, entry.fileKey);
                        return (
                          <div
                            key={entry.key}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <StatusBadge
                              label={entry.label}
                              active={Boolean(player[entry.statusKey])}
                            />
                            <div className="mt-3">
                              {currentFileUrl ? (
                                <a
                                  href={currentFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                  <Download size={16} />
                                  Datei oeffnen
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
                                  <FileText size={16} />
                                  Keine Datei
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <DetailField label="Notizen" value={formatValue(player.notes)} />
                </>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {imageModalOpen && player.avatarUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-6"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-[2rem] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={player.avatarUrl}
              alt={player.fullName}
              className="max-h-[82vh] max-w-[82vw] rounded-[1.5rem] object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
