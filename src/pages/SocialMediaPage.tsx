import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CopyPlus,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import type { SocialMediaDraft, SocialMediaDraftType } from "@/types";

type EditorField = "title" | "subtitle" | "caption" | "callToAction";

type EditorImage =
  | {
      id: string;
      kind: "existing";
      url: string;
    }
  | {
      id: string;
      kind: "new";
      url: string;
      file: File;
    };

const layoutOptions = [
  { value: "matchday", label: "Spieltag" },
  { value: "result", label: "Ergebnis" },
  { value: "training", label: "Training" },
  { value: "announcement", label: "Ankuendigung" },
];

function previewDate(value: string) {
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

function SocialPreview({
  draftType,
  layout,
  title,
  subtitle,
  caption,
  callToAction,
  logoUrl,
  imageUrl,
}: {
  draftType: SocialMediaDraftType;
  layout: string;
  title: string;
  subtitle: string;
  caption: string;
  callToAction: string;
  logoUrl: string | null;
  imageUrl?: string;
}) {
  const layoutLabel =
    layoutOptions.find((option) => option.value === layout)?.label ?? "Vorlage";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-950 via-blue-900 to-sky-500 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]",
        draftType === "story" ? "aspect-[9/16]" : "aspect-[4/5]",
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title || "Vorschau"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/45 via-blue-900/70 to-slate-950/90" />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/95 backdrop-blur">
            <span>{draftType === "story" ? "Story" : "Feed"}</span>
            <span className="text-white/60">|</span>
            <span>{layoutLabel}</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
            {logoUrl ? (
              <img src={logoUrl} alt="Vereinslogo" className="h-full w-full object-contain p-1.5" />
            ) : (
              <ImageIcon size={18} />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-2xl font-black uppercase tracking-[0.08em] text-white drop-shadow md:text-3xl">
              {title || "Titel des Beitrags"}
            </p>
            <p className="max-w-[90%] text-sm font-medium text-white/85 md:text-base">
              {subtitle || "Kurzer Untertitel oder Zusatzinfo"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-white/90">
              {caption ||
                "Hier entsteht euer Entwurf mit Vereinsfarben, Textbausteinen und einer einheitlichen Vereinsoptik."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-900">
              {callToAction || "Jetzt ansehen"}
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
              SG Wiking Offenbach
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialMediaPage() {
  const socialMediaDrafts = useAppStore((state) => state.socialMediaDrafts);
  const socialMediaTextSnippets = useAppStore((state) => state.socialMediaTextSnippets);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const settings = useAppStore((state) => state.settings);
  const addSocialMediaDraft = useAppStore((state) => state.addSocialMediaDraft);
  const updateSocialMediaDraft = useAppStore((state) => state.updateSocialMediaDraft);
  const deleteSocialMediaDraft = useAppStore((state) => state.deleteSocialMediaDraft);
  const addSocialMediaTextSnippet = useAppStore((state) => state.addSocialMediaTextSnippet);
  const updateSocialMediaTextSnippet = useAppStore((state) => state.updateSocialMediaTextSnippet);
  const deleteSocialMediaTextSnippet = useAppStore((state) => state.deleteSocialMediaTextSnippet);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canManageSocial =
    currentUser?.role === "admin";

  if (!canManageSocial) {
    return <Navigate to="/dashboard" replace />;
  }

  const drafts = useMemo(
    () =>
      [...socialMediaDrafts].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [socialMediaDrafts],
  );
  const snippets = useMemo(
    () =>
      [...socialMediaTextSnippets].sort((left, right) => {
        const categoryCompare = (left.category || "").localeCompare(right.category || "", "de");
        if (categoryCompare !== 0) {
          return categoryCompare;
        }
        return left.label.localeCompare(right.label, "de");
      }),
    [socialMediaTextSnippets],
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeField, setActiveField] = useState<EditorField>("caption");
  const [draftForm, setDraftForm] = useState({
    draftType: "feed" as SocialMediaDraftType,
    layout: "matchday",
    title: "",
    subtitle: "",
    caption: "",
    callToAction: "",
  });
  const [editorImages, setEditorImages] = useState<EditorImage[]>([]);

  const [snippetForm, setSnippetForm] = useState({
    label: "",
    content: "",
    category: "",
  });
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [snippetSubmitting, setSnippetSubmitting] = useState(false);

  const sellerName = (userId: string) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";

  const resetDraftEditor = () => {
    setEditorMode("create");
    setEditingDraftId(null);
    setDraftForm({
      draftType: "feed",
      layout: "matchday",
      title: "",
      subtitle: "",
      caption: "",
      callToAction: "",
    });
    setEditorImages([]);
    setActiveField("caption");
  };

  const openCreateDraft = () => {
    setError("");
    setSuccess("");
    resetDraftEditor();
    setEditorOpen(true);
  };

  const openEditDraft = (draft: SocialMediaDraft) => {
    setError("");
    setSuccess("");
    setEditorMode("edit");
    setEditingDraftId(draft.id);
    setDraftForm({
      draftType: draft.draftType,
      layout: draft.layout,
      title: draft.title,
      subtitle: draft.subtitle,
      caption: draft.caption,
      callToAction: draft.callToAction,
    });
    setEditorImages(
      draft.imageUrls.map((url, index) => ({
        id: `existing-${index}-${url}`,
        kind: "existing" as const,
        url,
      })),
    );
    setActiveField("caption");
    setEditorOpen(true);
  };

  const updateField = (field: EditorField, value: string) => {
    setDraftForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const insertSnippet = (snippetText: string) => {
    updateField(
      activeField,
      draftForm[activeField]
        ? `${draftForm[activeField].trimEnd()}\n${snippetText}`
        : snippetText,
    );
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setEditorImages((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const removeImage = (imageId: string) => {
    setEditorImages((current) => current.filter((item) => item.id !== imageId));
  };

  const draftPreviewImage = editorImages[0]?.url;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Social Media"
        description="Interner Bereich fuer Feed- und Story-Entwuerfe im einheitlichen Vereinsdesign. Noch ohne direktes Posten auf Instagram."
        actions={
          canManageSocial ? (
            <button
              type="button"
              onClick={openCreateDraft}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              <Plus size={18} />
              Neuen Entwurf anlegen
            </button>
          ) : null
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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

            {drafts.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <SocialPreview
                      draftType={draft.draftType}
                      layout={draft.layout}
                      title={draft.title}
                      subtitle={draft.subtitle}
                      caption={draft.caption}
                      callToAction={draft.callToAction}
                      logoUrl={settings.logoUrl}
                      imageUrl={draft.imageUrls[0]}
                    />

                    <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900">{draft.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {draft.draftType === "story" ? "Story" : "Feed"} |{" "}
                          {layoutOptions.find((option) => option.value === draft.layout)?.label ??
                            "Vorlage"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Zuletzt aktualisiert: {previewDate(draft.updatedAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Von {sellerName(draft.createdBy)}
                        </p>
                      </div>
                      {canManageSocial ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDraft(draft)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil size={15} />
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            disabled={savingId === draft.id}
                            onClick={async () => {
                              const confirmed = window.confirm("Entwurf wirklich loeschen?");
                              if (!confirmed) {
                                return;
                              }

                              setError("");
                              setSuccess("");
                              setSavingId(draft.id);
                              const result = await deleteSocialMediaDraft(draft.id);
                              if (!result.success) {
                                setError(result.error ?? "Entwurf konnte nicht geloescht werden.");
                              } else {
                                setSuccess("Entwurf wurde geloescht.");
                              }
                              setSavingId(null);
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={15} />
                            Loeschen
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Noch keine Entwuerfe</p>
                <p className="mt-2 text-sm text-slate-600">
                  Legt hier Feed- oder Story-Entwuerfe im gleichen Vereinsstil an.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <SectionCard
              title="Textbausteine"
              description="Wiederverwendbare Texte fuer Spieltag, Ergebnisse, Training oder Hinweise."
              actions={
                canManageSocial ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSnippetId(null);
                      setSnippetForm({ label: "", content: "", category: "" });
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Type size={15} />
                    Neuer Baustein
                  </button>
                ) : null
              }
            >
              <div className="space-y-4">
                {canManageSocial ? (
                  <form
                    className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setError("");
                      setSuccess("");
                      setSnippetSubmitting(true);

                      const result = editingSnippetId
                        ? await updateSocialMediaTextSnippet(editingSnippetId, snippetForm)
                        : await addSocialMediaTextSnippet(snippetForm);

                      if (!result.success) {
                        setError(result.error ?? "Textbaustein konnte nicht gespeichert werden.");
                      } else {
                        setSuccess(
                          editingSnippetId
                            ? "Textbaustein wurde aktualisiert."
                            : "Textbaustein wurde gespeichert.",
                        );
                        setEditingSnippetId(null);
                        setSnippetForm({ label: "", content: "", category: "" });
                      }

                      setSnippetSubmitting(false);
                    }}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Titel
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          value={snippetForm.label}
                          onChange={(event) =>
                            setSnippetForm((current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Kategorie
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          value={snippetForm.category}
                          onChange={(event) =>
                            setSnippetForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                          placeholder="z. B. Spieltag"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Inhalt</span>
                      <textarea
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        value={snippetForm.content}
                        onChange={(event) =>
                          setSnippetForm((current) => ({
                            ...current,
                            content: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={snippetSubmitting}
                        className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {snippetSubmitting
                          ? "Speichert..."
                          : editingSnippetId
                            ? "Baustein aktualisieren"
                            : "Baustein speichern"}
                      </button>
                      {editingSnippetId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSnippetId(null);
                            setSnippetForm({ label: "", content: "", category: "" });
                          }}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Abbrechen
                        </button>
                      ) : null}
                    </div>
                  </form>
                ) : null}

                {snippets.length ? (
                  snippets.map((snippet) => (
                    <div
                      key={snippet.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{snippet.label}</p>
                            {snippet.category ? (
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-900">
                                {snippet.category}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                            {snippet.content}
                          </p>
                        </div>
                        {canManageSocial ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSnippetId(snippet.id);
                                setSnippetForm({
                                  label: snippet.label,
                                  content: snippet.content,
                                  category: snippet.category,
                                });
                              }}
                              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              disabled={savingId === snippet.id}
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  "Textbaustein wirklich loeschen?",
                                );
                                if (!confirmed) {
                                  return;
                                }

                                setError("");
                                setSuccess("");
                                setSavingId(snippet.id);
                                const result = await deleteSocialMediaTextSnippet(snippet.id);
                                if (!result.success) {
                                  setError(
                                    result.error ?? "Textbaustein konnte nicht geloescht werden.",
                                  );
                                } else {
                                  setSuccess("Textbaustein wurde geloescht.");
                                }
                                setSavingId(null);
                              }}
                              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Loeschen
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => insertSnippet(snippet.content)}
                          disabled={!editorOpen}
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                        >
                          <CopyPlus size={14} />
                          In aktives Feld einfuegen
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-900">
                      Noch keine Textbausteine
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </SectionCard>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => {
            if (!draftSubmitting) {
              setEditorOpen(false);
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {editorMode === "create" ? "Neuer Social-Media-Entwurf" : "Entwurf bearbeiten"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Einheitliche Vereinsoptik fuer Feed und Story. Textbausteine koennen in das jeweils aktive Feld eingefuegt werden.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                disabled={draftSubmitting}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <form
                className="space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError("");
                  setSuccess("");
                  setDraftSubmitting(true);

                  const newImages = editorImages.filter(
                    (image): image is Extract<EditorImage, { kind: "new" }> =>
                      image.kind === "new",
                  );
                  const optimizedNewFiles = await Promise.all(
                    newImages.map((image) => optimizeImageForUpload(image.file)),
                  );
                  const imageOrder = editorImages.map((image) =>
                    image.kind === "existing"
                      ? image.url
                      : `__new_${newImages.findIndex((entry) => entry.id === image.id)}__`,
                  );

                  const result =
                    editorMode === "create"
                      ? await addSocialMediaDraft({
                          draftType: draftForm.draftType,
                          layout: draftForm.layout,
                          title: draftForm.title,
                          subtitle: draftForm.subtitle,
                          caption: draftForm.caption,
                          callToAction: draftForm.callToAction,
                          imageFiles: optimizedNewFiles,
                          imageOrder,
                        })
                      : await updateSocialMediaDraft(editingDraftId ?? "", {
                          draftType: draftForm.draftType,
                          layout: draftForm.layout,
                          title: draftForm.title,
                          subtitle: draftForm.subtitle,
                          caption: draftForm.caption,
                          callToAction: draftForm.callToAction,
                          existingImageUrls: editorImages
                            .filter(
                              (image): image is Extract<EditorImage, { kind: "existing" }> =>
                                image.kind === "existing",
                            )
                            .map((image) => image.url),
                          newImageFiles: optimizedNewFiles,
                          imageOrder,
                        });

                  if (!result.success) {
                    setError(result.error ?? "Entwurf konnte nicht gespeichert werden.");
                    setDraftSubmitting(false);
                    return;
                  }

                  setSuccess(
                    editorMode === "create"
                      ? "Entwurf wurde gespeichert."
                      : "Entwurf wurde aktualisiert.",
                  );
                  setEditorOpen(false);
                  resetDraftEditor();
                  setDraftSubmitting(false);
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Format</span>
                    <select
                      value={draftForm.draftType}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          draftType: event.target.value as SocialMediaDraftType,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="feed">Feed</option>
                      <option value="story">Story</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Vorlage</span>
                    <select
                      value={draftForm.layout}
                      onChange={(event) =>
                        setDraftForm((current) => ({
                          ...current,
                          layout: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      {layoutOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Titel</span>
                  <input
                    value={draftForm.title}
                    onFocus={() => setActiveField("title")}
                    onChange={(event) => updateField("title", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Untertitel</span>
                  <input
                    value={draftForm.subtitle}
                    onFocus={() => setActiveField("subtitle")}
                    onChange={(event) => updateField("subtitle", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Caption / Haupttext
                  </span>
                  <textarea
                    rows={6}
                    value={draftForm.caption}
                    onFocus={() => setActiveField("caption")}
                    onChange={(event) => updateField("caption", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Button / Call to Action
                  </span>
                  <input
                    value={draftForm.callToAction}
                    onFocus={() => setActiveField("callToAction")}
                    onChange={(event) => updateField("callToAction", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="z. B. Mehr Infos"
                  />
                </label>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Bilder</p>
                      <p className="text-sm text-slate-600">
                        Neue Bilder hochladen, in der Reihenfolge verschieben oder entfernen.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      <Plus size={16} />
                      Bilder hinzufuegen
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          const mapped = files.map((file, index) => ({
                            id: `new-${Date.now()}-${index}-${file.name}`,
                            kind: "new" as const,
                            url: URL.createObjectURL(file),
                            file,
                          }));
                          setEditorImages((current) => [...current, ...mapped]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {editorImages.length ? (
                    <div className="mt-4 space-y-3">
                      {editorImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                        >
                          <button
                            type="button"
                            className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                            onClick={() => setImageModal({ src: image.url, alt: draftForm.title || "Bild" })}
                          >
                            <img src={image.url} alt="Vorschau" className="h-full w-full object-cover" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              Bild {index + 1} {image.kind === "new" ? "(neu)" : "(gespeichert)"}
                            </p>
                            <p className="truncate text-sm text-slate-500">{image.url}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => moveImage(index, -1)}
                              disabled={index === 0}
                              className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowLeft size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(index, 1)}
                              disabled={index === editorImages.length - 1}
                              className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowRight size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(image.id)}
                              className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      Noch keine Bilder ausgewaehlt
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={draftSubmitting}
                    className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {draftSubmitting
                      ? "Speichert..."
                      : editorMode === "create"
                        ? "Entwurf speichern"
                        : "Aenderungen speichern"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    disabled={draftSubmitting}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                <SectionCard
                  title="Live-Vorschau"
                  description={`Aktives Feld fuer Textbausteine: ${activeField}`}
                >
                  <SocialPreview
                    draftType={draftForm.draftType}
                    layout={draftForm.layout}
                    title={draftForm.title}
                    subtitle={draftForm.subtitle}
                    caption={draftForm.caption}
                    callToAction={draftForm.callToAction}
                    logoUrl={settings.logoUrl}
                    imageUrl={draftPreviewImage}
                  />
                </SectionCard>

                <SectionCard
                  title="Schnelle Textbausteine"
                  description="Klick auf einen Baustein fuegt ihn in das aktuell aktive Feld ein."
                >
                  <div className="flex flex-wrap gap-2">
                    {snippets.length ? (
                      snippets.map((snippet) => (
                        <button
                          key={snippet.id}
                          type="button"
                          onClick={() => insertSnippet(snippet.content)}
                          className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                        >
                          {snippet.label}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        Noch keine Textbausteine vorhanden.
                      </p>
                    )}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {imageModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-6"
          onClick={() => setImageModal(null)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-[2rem] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={imageModal.src}
              alt={imageModal.alt}
              className="max-h-[82vh] max-w-[82vw] rounded-[1.5rem] object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
