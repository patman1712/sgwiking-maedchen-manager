import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";
import type { CustomExternalLink, UserRole } from "@/types";

type SettingsTab = "logo" | "links";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Vereinsadmin",
  trainer: "Trainer:innen",
  player: "Spieler:innen",
  board: "Vorstand",
  social: "Social Media",
};

const ALL_ROLES: UserRole[] = ["admin", "trainer", "player", "board", "social"];

type LinkDraft = {
  menuName: string;
  url: string;
  roleVisibility: UserRole[];
  sortOrder: number;
};

const emptyDraft = (nextSortOrder = 0): LinkDraft => ({
  menuName: "",
  url: "",
  roleVisibility: [...ALL_ROLES],
  sortOrder: nextSortOrder,
});

const RolesCheckboxes = ({
  value,
  onChange,
}: {
  value: UserRole[];
  onChange: (next: UserRole[]) => void;
}) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {ALL_ROLES.map((role) => {
      const checked = value.includes(role);
      return (
        <label
          key={role}
          className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-100 has-[:checked]:text-blue-900"
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => {
              if (event.target.checked) {
                onChange([...value, role]);
              } else {
                onChange(value.filter((entry) => entry !== role));
              }
            }}
            className="h-4 w-4 accent-blue-700"
          />
          <span>{ROLE_LABELS[role]}</span>
        </label>
      );
    })}
  </div>
);

export default function SettingsPage() {
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const settings = useAppStore((state) => state.settings);
  const customExternalLinks = useAppStore((state) => state.customExternalLinks);
  const fetchData = useAppStore((state) => state.fetchData);
  const addCustomExternalLink = useAppStore((state) => state.addCustomExternalLink);
  const updateCustomExternalLink = useAppStore((state) => state.updateCustomExternalLink);
  const deleteCustomExternalLink = useAppStore((state) => state.deleteCustomExternalLink);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabFromUrl =
    searchParams.get("tab") === "logo"
      ? "logo"
      : searchParams.get("tab") === "links"
        ? "links"
        : null;

  const [tab, setTab] = useState<SettingsTab>(initialTabFromUrl || "links");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const [createDraft, setCreateDraft] = useState<LinkDraft>(() => emptyDraft());
  const [editDrafts, setEditDrafts] = useState<Record<string, LinkDraft>>({});

  if (currentUser?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const flushMessages = () => {
    setError("");
    setSuccess("");
  };

  const ensureEditDraft = (link: CustomExternalLink): LinkDraft => {
    const existing = editDrafts[link.id];
    if (existing) return existing;
    const created: LinkDraft = {
      menuName: link.menuName,
      url: link.url,
      roleVisibility: link.roleVisibility.length ? [...link.roleVisibility] : [...ALL_ROLES],
      sortOrder: link.sortOrder,
    };
    setEditDrafts((current) => ({ ...current, [link.id]: created }));
    return created;
  };

  const nextSortOrder = useMemo(() => {
    if (!customExternalLinks.length) return 0;
    return Math.max(...customExternalLinks.map((link) => link.sortOrder)) + 1;
  }, [customExternalLinks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-900">Vereins-Einstellungen</h2>
          <p className="text-sm text-slate-500">
            Hier verwaltest du das Teamwappen (Login-Seite) und die externen Links in der linken
            Seitenleiste.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3">
          {([
            { key: "logo", label: "Vereinswappen", sub: "Logo (Login)", badge: null as string | null },
            {
              key: "links",
              label: "Externe Links",
              sub: "Sidebar Fanshop etc.",
              badge: "⭐ NEU",
            },
          ] as const).map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                flushMessages();
                setTab(entry.key);
                if (entry.key === "links") {
                  searchParams.set("tab", "links");
                } else {
                  searchParams.delete("tab");
                }
                setSearchParams(searchParams, { replace: true });
              }}
              className={
                "flex min-h-[56px] flex-1 flex-col items-start justify-center gap-0.5 rounded-2xl px-5 py-3 text-left text-sm font-semibold transition min-w-[200px] " +
                (tab === entry.key
                  ? "bg-gradient-to-r from-blue-950 to-blue-700 text-white shadow-lg shadow-blue-900/20 ring-2 ring-blue-500"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200")
              }
            >
              <span className="flex items-center gap-2">
                {entry.key === "logo" ? <Shield size={18} /> : <ExternalLink size={18} />}
                <span>{entry.label}</span>
                {entry.badge ? (
                  <span className="inline-flex items-center rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950 shadow-sm">
                    {entry.badge}
                  </span>
                ) : null}
              </span>
              <span className={
                "text-[12px] font-medium " +
                (tab === entry.key ? "text-blue-100" : "text-slate-500")
              }>
                {entry.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tab === "logo" ? (
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
                flushMessages();
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
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ImagePlus size={18} />
                {uploading ? "Wird hochgeladen..." : "Wappen speichern"}
              </button>
            </form>
          </SectionCard>
        </div>
      ) : null}

      {tab === "links" ? (
        <div className="space-y-6">
          <SectionCard
            title="Neuen externen Link anlegen"
            description="Diese Links erscheinen in der linken Seitenleiste. Jede:r Benutzer:in sieht nur die Links, deren Rollen sie/ihn betreffen."
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

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_minmax(0,2fr)_120px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Menüname
                  </span>
                  <input
                    type="text"
                    value={createDraft.menuName}
                    onChange={(evt) =>
                      setCreateDraft({ ...createDraft, menuName: evt.target.value })
                    }
                    placeholder="z.B. Fanshop"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Link (URL)</span>
                  <input
                    type="text"
                    value={createDraft.url}
                    onChange={(evt) =>
                      setCreateDraft({ ...createDraft, url: evt.target.value })
                    }
                    placeholder="z.B. https://fanshop.sg-wiking.de"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Sortierung
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={createDraft.sortOrder}
                    onChange={(evt) =>
                      setCreateDraft({
                        ...createDraft,
                        sortOrder: Number(evt.target.value || 0),
                      })
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>

              <div>
                <p className="mb-3 block text-sm font-medium text-slate-700">
                  Sichtbar fuer diese Bereiche / Rollen:
                </p>
                <RolesCheckboxes
                  value={createDraft.roleVisibility}
                  onChange={(next) => setCreateDraft({ ...createDraft, roleVisibility: next })}
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  disabled={!createDraft.menuName.trim() || !createDraft.url.trim()}
                  onClick={async () => {
                    flushMessages();
                    const payload: LinkDraft = {
                      ...createDraft,
                      menuName: createDraft.menuName.trim(),
                      url: createDraft.url.trim(),
                      roleVisibility: createDraft.roleVisibility.length
                        ? createDraft.roleVisibility
                        : [...ALL_ROLES],
                    };
                    const result = await addCustomExternalLink(payload);
                    if (!result.success) {
                      setError(result.error || "Link konnte nicht angelegt werden.");
                      return;
                    }
                    setCreateDraft(emptyDraft(nextSortOrder));
                    setSuccess("Der externe Link wurde angelegt.");
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Plus size={18} />
                  Link anlegen
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Bestehende externe Links"
            description="Bearbeite Menuname, Link, Rollen-Sichtbarkeit und Reihenfolge. Die Aenderungen werden sofort fuer alle betroffenen Benutzer:innen sichtbar."
          >
            {customExternalLinks.length ? (
              <div className="space-y-4">
                {customExternalLinks.map((link) => {
                  const draft = ensureEditDraft(link);
                  const isSaving = savingLinkId === link.id;
                  const isDeleting = deletingLinkId === link.id;

                  return (
                    <div
                      key={link.id}
                      className="rounded-[2rem] border border-slate-200 bg-slate-50/60 p-5"
                    >
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-base font-semibold text-slate-900">
                              {draft.menuName || link.menuName || "Unbenannter Link"}
                            </p>
                            <span className="inline-flex h-6 items-center rounded-full bg-blue-100 px-2 text-[11px] font-semibold text-blue-800">
                              Sortierung {draft.sortOrder}
                            </span>
                          </div>
                          <a
                            href={draft.url || link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 truncate text-sm text-blue-700 hover:underline"
                          >
                            <ExternalLink size={14} />
                            <span className="truncate">
                              {draft.url || link.url || "(kein Link hinterlegt)"}
                            </span>
                          </a>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            disabled={isSaving || isDeleting}
                            onClick={async () => {
                              flushMessages();
                              setSavingLinkId(link.id);
                              const result = await updateCustomExternalLink(link.id, {
                                menuName: draft.menuName.trim(),
                                url: draft.url.trim(),
                                roleVisibility: draft.roleVisibility.length
                                  ? draft.roleVisibility
                                  : [...ALL_ROLES],
                                sortOrder: draft.sortOrder,
                              });
                              setSavingLinkId(null);
                              if (!result.success) {
                                setError(result.error || "Aenderungen konnten nicht gespeichert werden.");
                                return;
                              }
                              setSuccess("Die Aenderungen wurden gespeichert.");
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-950 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <Pencil size={16} />
                            {isSaving ? "Speichere..." : "Speichern"}
                          </button>
                          <button
                            type="button"
                            disabled={isSaving || isDeleting}
                            onClick={async () => {
                              flushMessages();
                              const safe = window.confirm(
                                `Den Link "${link.menuName}" wirklich loeschen?`,
                              );
                              if (!safe) return;
                              setDeletingLinkId(link.id);
                              const result = await deleteCustomExternalLink(link.id);
                              setDeletingLinkId(null);
                              if (!result.success) {
                                setError(result.error || "Link konnte nicht geloescht werden.");
                                return;
                              }
                              setEditDrafts((current) => {
                                const copy = { ...current };
                                delete copy[link.id];
                                return copy;
                              });
                              setSuccess("Der Link wurde geloescht.");
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <Trash2 size={16} />
                            {isDeleting ? "Loesche..." : "Loeschen"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_minmax(0,2fr)_120px]">
                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Menüname
                            </span>
                            <input
                              type="text"
                              value={draft.menuName}
                              onChange={(evt) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [link.id]: { ...ensureEditDraft(link), menuName: evt.target.value },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Link (URL)
                            </span>
                            <input
                              type="text"
                              value={draft.url}
                              onChange={(evt) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [link.id]: { ...ensureEditDraft(link), url: evt.target.value },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Sortierung
                            </span>
                            <input
                              type="number"
                              step="1"
                              value={draft.sortOrder}
                              onChange={(evt) =>
                                setEditDrafts((current) => ({
                                  ...current,
                                  [link.id]: {
                                    ...ensureEditDraft(link),
                                    sortOrder: Number(evt.target.value || 0),
                                  },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                        </div>

                        <div>
                          <p className="mb-3 block text-sm font-medium text-slate-700">
                            Sichtbar fuer:
                          </p>
                          <RolesCheckboxes
                            value={draft.roleVisibility}
                            onChange={(next) =>
                              setEditDrafts((current) => ({
                                ...current,
                                [link.id]: { ...ensureEditDraft(link), roleVisibility: next },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-800">
                  <ExternalLink size={22} />
                </div>
                <p className="font-medium text-slate-700">Noch keine externen Links angelegt.</p>
                <p className="mt-1">
                  Nutze das Formular oben, um z.B. einen Fanshop-Link, Homepage oder weitere
                  externe Tools in die linke Navigation aufzunehmen.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
