import { useMemo, useState } from "react";
import { ImagePlus, Shield } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";

export default function SettingsPage() {
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const settings = useAppStore((state) => state.settings);
  const fetchData = useAppStore((state) => state.fetchData);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  if (currentUser?.role !== "admin") {
    return (
      <SectionCard
        title="Einstellungen"
        description="Dieser Bereich ist nur fuer Vereinsadmins sichtbar."
      >
        <p className="text-sm text-slate-600">
          Bitte mit einem Admin-Zugang anmelden, um das Teamwappen zu aendern.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <SectionCard
        title="Aktuelles Teamwappen"
        description="Dieses Bild erscheint direkt auf der Login-Seite."
      >
        <div className="flex min-h-72 items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="Teamwappen"
              className="max-h-56 max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center text-slate-400">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-100 text-blue-800">
                <Shield size={42} />
              </div>
              <p className="mt-4 text-sm">Noch kein Wappen hochgeladen</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Login-Wappen hochladen"
        description="Bitte eine PNG-, JPG-, WEBP- oder SVG-Datei waehlen. Nach dem Speichern erscheint das Wappen sofort auf dem Login."
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
            const form = event.currentTarget;
            const fileInput = form.elements.namedItem("logo") as HTMLInputElement | null;
            const file = fileInput?.files?.[0];

            if (!file) {
              setError("Bitte zuerst eine Bilddatei auswaehlen.");
              return;
            }

            const payload = new FormData();
            payload.append("logo", file);
            setUploading(true);

            try {
              const response = await fetch("/api/settings/logo", {
                method: "POST",
                body: payload,
              });
              const data = await response.json();

              if (!response.ok || data.success === false) {
                setError(data.error || "Upload fehlgeschlagen.");
                return;
              }

              await fetchData();
              form.reset();
              setSuccess("Das Teamwappen wurde gespeichert.");
            } catch {
              setError("Der Upload konnte nicht gespeichert werden.");
            } finally {
              setUploading(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Bilddatei
            </span>
            <input
              name="logo"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-800"
            />
          </label>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-800/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ImagePlus size={18} />
            {uploading ? "Wird hochgeladen..." : "Wappen speichern"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
