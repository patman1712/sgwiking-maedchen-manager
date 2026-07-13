import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ImagePlus, Shield } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { useAppStore } from "@/store";

export default function PlayerEditPage() {
  const { playerId } = useParams();
  const users = useAppStore((state) => state.users);
  const teams = useAppStore((state) => state.teams);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const updateUser = useAppStore((state) => state.updateUser);
  const uploadUserAvatar = useAppStore((state) => state.uploadUserAvatar);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const player = useMemo(
    () => users.find((user) => user.id === playerId && user.role === "player") ?? null,
    [playerId, users],
  );
  const canEdit =
    !!currentUser &&
    !!player &&
    (currentUser.role === "admin" ||
      currentUser.role === "board" ||
      (currentUser.role === "trainer" &&
        currentUser.teamIds.some((teamId) => player.teamIds.includes(teamId))));

  const [form, setForm] = useState(() => ({
    fullName: player?.fullName ?? "",
    email: player?.email ?? "",
    phone: player?.phone ?? "",
    notes: player?.notes ?? "",
    password: "",
  }));

  useEffect(() => {
    if (!player) {
      return;
    }

    setForm({
      fullName: player.fullName,
      email: player.email,
      phone: player.phone,
      notes: player.notes,
      password: "",
    });
  }, [player]);

  if (!playerId || !player) {
    return <Navigate to="/dashboard/players" replace />;
  }

  return (
    <div className="space-y-6">
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
          Profil, Login und Bild dieser Spielerin bearbeiten
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <SectionCard
          title="Spielerinnenbild"
          description="Das Bild wird fuer schnelle Ladezeiten verkleinert gespeichert und kann in gross angesehen werden."
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

            {canEdit ? (
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
                Dieses Profil darf nur von Admin, Vorstand oder den zustaendigen Trainern
                bearbeitet werden.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Spielerinnenprofil"
          description="Hier kannst du Stammdaten, Login und Passwort der Spielerin pflegen."
        >
          {!canEdit ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Du hast keine Berechtigung, diese Spielerin zu bearbeiten.
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setSuccess("");

                const result = await updateUser({
                  userId: player.id,
                  fullName: form.fullName,
                  email: form.email,
                  phone: form.phone,
                  notes: form.notes,
                  password: form.password.trim() || undefined,
                  role: "player",
                });

                if (!result.success) {
                  setError(result.error ?? "Spielerin konnte nicht gespeichert werden.");
                  return;
                }

                setForm((current) => ({ ...current, password: "" }));
                setSuccess("Die Spielerin wurde gespeichert.");
                navigate(`/dashboard/players/${player.id}`, { replace: true });
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {player.teamIds.length ? (
                    player.teamIds.map((teamId) => {
                      const team = teams.find((entry) => entry.id === teamId);
                      return (
                        <span
                          key={teamId}
                          className="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
                        >
                          {team?.name ?? teamId}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-slate-500">Keinem Team zugeordnet</span>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Die Teamzuordnung wird zentral im Bereich Spielerinnen von Admin oder Vorstand
                  gepflegt.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notizen</span>
                <textarea
                  className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>

              <button
                type="submit"
                className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
              >
                Spielerin speichern
              </button>
            </form>
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
