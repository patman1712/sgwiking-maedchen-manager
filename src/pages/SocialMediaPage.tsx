import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers3,
  Pencil,
  Plus,
  Sparkles,
  SquareStack,
  Trash2,
  Type,
  X,
} from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import type {
  SocialMediaDraft,
  SocialMediaDraftType,
  SocialMediaLayer,
  SocialMediaLayerKind,
  SocialMediaLayerPosition,
  SocialMediaLayerStyle,
} from "@/types";

type EditorAsset =
  | {
      id: string;
      ref: string;
      kind: "existing";
      url: string;
    }
  | {
      id: string;
      ref: string;
      kind: "new";
      url: string;
      file: File;
    };

const layoutOptions = [
  { value: "matchday", label: "Spieltag" },
  { value: "result", label: "Ergebnis" },
  { value: "training", label: "Training" },
  { value: "announcement", label: "Ankuendigung" },
] as const;

const layerKindOptions: Array<{ value: SocialMediaLayerKind; label: string }> = [
  { value: "image", label: "Bild" },
  { value: "badge", label: "Badge" },
  { value: "title", label: "Titel" },
  { value: "subtitle", label: "Untertitel" },
  { value: "caption", label: "Textkarte" },
  { value: "cta", label: "Button" },
];

const positionOptions: Array<{ value: SocialMediaLayerPosition; label: string }> = [
  { value: "full", label: "Vollflaeche" },
  { value: "topLeft", label: "Oben links" },
  { value: "topRight", label: "Oben rechts" },
  { value: "center", label: "Mitte" },
  { value: "bottomLeft", label: "Unten links" },
  { value: "bottomCenter", label: "Unten mittig" },
  { value: "bottomRight", label: "Unten rechts" },
];

const styleOptions: Array<{ value: SocialMediaLayerStyle; label: string }> = [
  { value: "cover", label: "Cover" },
  { value: "soft", label: "Soft" },
  { value: "cutout", label: "Cutout" },
  { value: "glass", label: "Glass" },
  { value: "solid", label: "Solid" },
  { value: "pill", label: "Pill" },
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

function createLayer(
  kind: SocialMediaLayerKind,
  overrides: Partial<SocialMediaLayer> = {},
): SocialMediaLayer {
  const defaults: Record<SocialMediaLayerKind, Omit<SocialMediaLayer, "id">> = {
    image: {
      kind: "image",
      label: "Bild",
      position: "full",
      style: "cover",
      imageRef: undefined,
      text: "",
      enabled: true,
    },
    badge: {
      kind: "badge",
      label: "Badge",
      position: "topLeft",
      style: "pill",
      text: "SG Wiking Offenbach",
      enabled: true,
    },
    title: {
      kind: "title",
      label: "Titel",
      position: "bottomLeft",
      style: "solid",
      text: "Spieltag",
      enabled: true,
    },
    subtitle: {
      kind: "subtitle",
      label: "Untertitel",
      position: "bottomLeft",
      style: "glass",
      text: "Kurzer Untertitel",
      enabled: true,
    },
    caption: {
      kind: "caption",
      label: "Textkarte",
      position: "bottomCenter",
      style: "glass",
      text: "Hier kommt euer Textbaustein hinein.",
      enabled: true,
    },
    cta: {
      kind: "cta",
      label: "Button",
      position: "bottomRight",
      style: "pill",
      text: "Mehr Infos",
      enabled: true,
    },
  };

  return {
    id: `layer_${Math.random().toString(36).slice(2, 10)}`,
    ...defaults[kind],
    ...overrides,
  };
}

function createStarterLayers(firstImageRef?: string): SocialMediaLayer[] {
  return [
    createLayer("image", { imageRef: firstImageRef }),
    createLayer("badge", { text: "Feed Vorlage" }),
    createLayer("title", { text: "Spieltag am Wochenende" }),
    createLayer("subtitle", { text: "Heimspiel auf dem Kunstrasenplatz Nord" }),
    createLayer("caption", {
      text: "Heute ist Spieltag. Wir freuen uns ueber jede Unterstuetzung am Spielfeldrand.",
    }),
    createLayer("cta", { text: "Kommt vorbei" }),
  ];
}

function buildFallbackLayers(draft: SocialMediaDraft): SocialMediaLayer[] {
  const firstImageRef = draft.imageUrls[0];
  const fallback = [
    createLayer("image", { imageRef: firstImageRef }),
    createLayer("badge", {
      text:
        layoutOptions.find((option) => option.value === draft.layout)?.label ?? "Vorlage",
    }),
    createLayer("title", { text: draft.title || "Titel des Beitrags" }),
    createLayer("subtitle", { text: draft.subtitle || "Kurzer Untertitel" }),
    createLayer("caption", {
      text:
        draft.caption ||
        "Hier entsteht euer Entwurf mit Vereinsfarben und sauberem Vereinsstil.",
    }),
    createLayer("cta", { text: draft.callToAction || "Mehr Infos" }),
  ];

  return fallback;
}

function resolveLayerText(layer: SocialMediaLayer) {
  return (layer.text || "").trim();
}

function getFirstLayerText(layers: SocialMediaLayer[], kind: SocialMediaLayerKind) {
  return layers.find((layer) => layer.kind === kind)?.text?.trim() ?? "";
}

function getPositionClasses(position: SocialMediaLayerPosition) {
  switch (position) {
    case "full":
      return "inset-0";
    case "topLeft":
      return "left-4 top-4 md:left-5 md:top-5";
    case "topRight":
      return "right-4 top-4 md:right-5 md:top-5";
    case "center":
      return "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";
    case "bottomLeft":
      return "bottom-4 left-4 md:bottom-5 md:left-5";
    case "bottomCenter":
      return "bottom-4 left-1/2 -translate-x-1/2 md:bottom-5";
    case "bottomRight":
      return "bottom-4 right-4 md:bottom-5 md:right-5";
  }
}

function getImageBoxClasses(position: SocialMediaLayerPosition, style: SocialMediaLayerStyle) {
  if (position === "full") {
    return "inset-0 h-full w-full";
  }

  const base = getPositionClasses(position);
  const size =
    style === "cutout"
      ? "h-36 w-28 md:h-44 md:w-32"
      : style === "soft"
        ? "h-32 w-32 md:h-40 md:w-40"
        : "h-40 w-32 md:h-48 md:w-36";

  return `${base} ${size}`;
}

function getImageStyleClasses(style: SocialMediaLayerStyle, full = false) {
  if (full) {
    return "rounded-none border-0 object-cover";
  }

  switch (style) {
    case "soft":
      return "rounded-[1.75rem] border border-white/35 object-cover opacity-85 shadow-[0_24px_60px_rgba(15,23,42,0.28)]";
    case "cutout":
      return "rounded-[1.5rem] border-4 border-white/90 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.3)]";
    case "glass":
      return "rounded-[1.75rem] border border-white/25 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.3)]";
    case "pill":
      return "rounded-full border-4 border-white/80 object-cover shadow-[0_16px_50px_rgba(15,23,42,0.28)]";
    case "solid":
      return "rounded-[1.25rem] border border-blue-950/20 object-cover shadow-[0_20px_40px_rgba(15,23,42,0.25)]";
    default:
      return "rounded-[1.75rem] border border-white/10 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.28)]";
  }
}

function getTextWrapperClasses(
  layer: SocialMediaLayer,
  draftType: SocialMediaDraftType,
  isSelected: boolean,
) {
  const selected = isSelected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-transparent" : "";
  const narrow = draftType === "story" ? "max-w-[80%]" : "max-w-[72%]";

  if (layer.kind === "title") {
    return `${getPositionClasses(layer.position)} ${narrow} ${selected}`;
  }
  if (layer.kind === "subtitle") {
    return `${getPositionClasses(layer.position)} ${narrow} ${selected}`;
  }
  if (layer.kind === "badge" || layer.kind === "cta") {
    return `${getPositionClasses(layer.position)} ${selected}`;
  }
  return `${getPositionClasses(layer.position)} ${narrow} ${selected}`;
}

function getTextClasses(layer: SocialMediaLayer) {
  switch (layer.kind) {
    case "title":
      return cn(
        "whitespace-pre-wrap text-3xl font-black uppercase tracking-[0.08em] text-white drop-shadow-[0_10px_30px_rgba(15,23,42,0.55)] md:text-4xl",
        layer.style === "glass" && "rounded-[1.5rem] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur",
      );
    case "subtitle":
      return cn(
        "whitespace-pre-wrap text-sm font-semibold leading-6 text-white/90 md:text-base",
        layer.style === "solid" && "rounded-[1.25rem] bg-blue-950/75 px-4 py-3 text-white",
        layer.style === "glass" && "rounded-[1.25rem] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur",
      );
    case "badge":
      return cn(
        "inline-flex items-center rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em]",
        layer.style === "pill"
          ? "border border-white/15 bg-white text-blue-950 shadow-lg"
          : "border border-white/20 bg-white/10 text-white backdrop-blur",
      );
    case "cta":
      return cn(
        "inline-flex items-center rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]",
        layer.style === "solid"
          ? "bg-white text-blue-950 shadow-xl"
          : "border border-white/20 bg-blue-950/65 text-white backdrop-blur",
      );
    case "caption":
      return cn(
        "whitespace-pre-wrap rounded-[1.75rem] px-4 py-4 text-sm leading-6 md:px-5",
        layer.style === "solid"
          ? "bg-blue-950/90 text-white shadow-[0_18px_50px_rgba(15,23,42,0.38)]"
          : "border border-white/15 bg-white/12 text-white/92 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.28)]",
      );
    default:
      return "text-sm text-white";
  }
}

function SocialPreview({
  draftType,
  layout,
  layers,
  assets,
  logoUrl,
  activeLayerId,
  onSelectLayer,
}: {
  draftType: SocialMediaDraftType;
  layout: string;
  layers: SocialMediaLayer[];
  assets: EditorAsset[];
  logoUrl: string | null;
  activeLayerId?: string | null;
  onSelectLayer?: (layerId: string) => void;
}) {
  const layoutLabel =
    layoutOptions.find((option) => option.value === layout)?.label ?? "Vorlage";

  const resolveAssetUrl = (ref?: string) => assets.find((asset) => asset.ref === ref)?.url;
  const visibleLayers = layers.filter((layer) => layer.enabled);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2.25rem] border border-white/40 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.35),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.28),_transparent_40%),linear-gradient(145deg,#0f172a_5%,#1d4ed8_55%,#7dd3fc_100%)] text-white shadow-[0_28px_90px_rgba(15,23,42,0.32)]",
        draftType === "story" ? "aspect-[9/16]" : "aspect-[4/5]",
      )}
    >
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.78))]" />

      <div className="absolute left-5 top-5 flex items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95 backdrop-blur-md">
          <Sparkles size={12} />
          {draftType === "story" ? "Story" : "Feed"} · {layoutLabel}
        </div>
      </div>

      <div className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg">
        {logoUrl ? (
          <img src={logoUrl} alt="Vereinslogo" className="h-full w-full object-contain p-1.5" />
        ) : (
          <ImageIcon size={18} />
        )}
      </div>

      {visibleLayers.map((layer, index) => {
        const zStyle = { zIndex: index + 5 };

        if (layer.kind === "image") {
          const assetUrl = resolveAssetUrl(layer.imageRef);
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onSelectLayer?.(layer.id)}
              className={cn(
                "absolute overflow-hidden",
                getImageBoxClasses(layer.position, layer.style),
                activeLayerId === layer.id &&
                  "ring-2 ring-sky-300 ring-offset-2 ring-offset-transparent",
              )}
              style={zStyle}
            >
              {assetUrl ? (
                <img
                  src={assetUrl}
                  alt={layer.label}
                  className={cn(
                    "h-full w-full",
                    getImageStyleClasses(layer.style, layer.position === "full"),
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center text-white/70",
                    layer.position === "full"
                      ? "bg-slate-900/30"
                      : "rounded-[1.5rem] border border-dashed border-white/30 bg-white/10 backdrop-blur",
                  )}
                >
                  <ImageIcon size={22} />
                </div>
              )}
            </button>
          );
        }

        const text = resolveLayerText(layer) || (layer.kind === "badge" ? "Badge" : "Text");
        return (
          <button
            key={layer.id}
            type="button"
            style={zStyle}
            onClick={() => onSelectLayer?.(layer.id)}
            className={cn(
              "absolute text-left",
              getTextWrapperClasses(layer, draftType, activeLayerId === layer.id),
            )}
          >
            <div className={getTextClasses(layer)}>{text}</div>
          </button>
        );
      })}
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
  const canManageSocial = currentUser?.role === "admin";

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
  const [editorDraftType, setEditorDraftType] = useState<SocialMediaDraftType>("feed");
  const [editorLayout, setEditorLayout] = useState("matchday");
  const [editorAssets, setEditorAssets] = useState<EditorAsset[]>([]);
  const [editorLayers, setEditorLayers] = useState<SocialMediaLayer[]>(createStarterLayers());
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  const [snippetForm, setSnippetForm] = useState({
    label: "",
    content: "",
    category: "",
  });
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [snippetSubmitting, setSnippetSubmitting] = useState(false);

  const sellerName = (userId: string) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";

  const activeLayer =
    editorLayers.find((layer) => layer.id === activeLayerId) ??
    editorLayers.find((layer) => layer.kind !== "image") ??
    editorLayers[0] ??
    null;

  const resetDraftEditor = () => {
    setEditorMode("create");
    setEditingDraftId(null);
    setEditorDraftType("feed");
    setEditorLayout("matchday");
    setEditorAssets([]);
    const starter = createStarterLayers();
    setEditorLayers(starter);
    setActiveLayerId(starter.find((layer) => layer.kind !== "image")?.id ?? starter[0]?.id ?? null);
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
    setEditorDraftType(draft.draftType);
    setEditorLayout(draft.layout);
    const assets = draft.imageUrls.map((url, index) => ({
      id: `existing-${index}-${url}`,
      ref: url,
      kind: "existing" as const,
      url,
    }));
    setEditorAssets(assets);
    const layers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);
    setEditorLayers(layers);
    setActiveLayerId(layers[0]?.id ?? null);
    setEditorOpen(true);
  };

  const updateLayer = (layerId: string, patch: Partial<SocialMediaLayer>) => {
    setEditorLayers((current) =>
      current.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    );
  };

  const moveLayer = (layerId: string, direction: -1 | 1) => {
    setEditorLayers((current) => {
      const index = current.findIndex((layer) => layer.id === layerId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [layer] = next.splice(index, 1);
      next.splice(nextIndex, 0, layer);
      return next;
    });
  };

  const addLayer = (kind: SocialMediaLayerKind) => {
    const firstAssetRef = editorAssets[0]?.ref;
    const nextLayer = createLayer(kind, kind === "image" ? { imageRef: firstAssetRef } : {});
    setEditorLayers((current) => [...current, nextLayer]);
    setActiveLayerId(nextLayer.id);
  };

  const removeLayer = (layerId: string) => {
    setEditorLayers((current) => current.filter((layer) => layer.id !== layerId));
    setActiveLayerId((current) => (current === layerId ? null : current));
  };

  const removeAsset = (assetRef: string) => {
    setEditorAssets((current) => current.filter((asset) => asset.ref !== assetRef));
    setEditorLayers((current) =>
      current.filter((layer) => !(layer.kind === "image" && layer.imageRef === assetRef)),
    );
  };

  const insertSnippet = (snippetText: string) => {
    if (!activeLayer || activeLayer.kind === "image") {
      return;
    }

    updateLayer(activeLayer.id, {
      text: activeLayer.text?.trim()
        ? `${activeLayer.text.trimEnd()}\n${snippetText}`
        : snippetText,
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Social Media"
        description="Feed- und Story-Entwuerfe mit Ebenen, sauberem Vereinsstil und deutlich flexiblerer Vorschau."
        actions={
          <button
            type="button"
            onClick={openCreateDraft}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
          >
            <Plus size={18} />
            Neuen Entwurf anlegen
          </button>
        }
      >
        <div className="rounded-[2rem] border border-blue-100 bg-[linear-gradient(135deg,rgba(219,234,254,0.8),rgba(255,255,255,0.95))] p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Editor
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                Ebenen statt starrem Layout
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Bilder koennen jetzt vor oder hinter Textkarten liegen, und jede Ebene hat eigene Position und Stil.
              </p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Design
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                Moderneres Grunddesign
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Die Vorschau ist jetzt hochwertiger, klarer gebrandet und wirkt deutlich mehr wie ein fertiger Social-Post.
              </p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                Schnellstart
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                Textbausteine inklusive
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Bausteine koennen direkt in die aktive Textebene uebernommen werden, ohne die Gestaltung zu verlieren.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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
                {drafts.map((draft) => {
                  const previewAssets = draft.imageUrls.map((url, index) => ({
                    id: `preview-${index}`,
                    ref: url,
                    kind: "existing" as const,
                    url,
                  }));
                  const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);

                  return (
                    <div
                      key={draft.id}
                      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="border-b border-slate-100 bg-slate-50/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-900">
                            <Layers3 size={14} />
                            {previewLayers.length} Ebenen
                          </div>
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                            {draft.draftType === "story" ? "Story" : "Feed"}
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <SocialPreview
                          draftType={draft.draftType}
                          layout={draft.layout}
                          layers={previewLayers}
                          assets={previewAssets}
                          logoUrl={settings.logoUrl}
                        />

                        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-slate-900">{draft.title}</p>
                            <p className="mt-1 text-sm text-slate-600">
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
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">Noch keine Entwuerfe</p>
                <p className="mt-2 text-sm text-slate-600">
                  Leg hier Feed- oder Story-Entwuerfe mit mehreren Ebenen und hochwertiger Vorschau an.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <SectionCard
              title="Textbausteine"
              description="Bausteine koennen in die aktuell aktive Textebene uebernommen werden."
            >
              <div className="space-y-4">
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
                      <span className="mb-2 block text-sm font-medium text-slate-700">Titel</span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        value={snippetForm.label}
                        onChange={(event) =>
                          setSnippetForm((current) => ({ ...current, label: event.target.value }))
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
                            onClick={() => insertSnippet(snippet.content)}
                            disabled={!editorOpen || !activeLayer || activeLayer.kind === "image"}
                            className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <CopyPlus size={14} />
                            Einfuegen
                          </button>
                          <button
                            type="button"
                            disabled={savingId === snippet.id}
                            onClick={async () => {
                              const confirmed = window.confirm("Textbaustein wirklich loeschen?");
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
            className="max-h-[94vh] w-full max-w-[95rem] overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {editorMode === "create" ? "Neuer Social-Media-Entwurf" : "Entwurf bearbeiten"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Bilder, Textkarten und Buttons sind jetzt echte Ebenen und lassen sich gezielt vor oder hintereinander anordnen.
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

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_0.8fr_1.1fr]">
              <div className="space-y-4">
                <SectionCard
                  title="Grundaufbau"
                  description="Format, Vorlage und Bild-Assets fuer den Entwurf."
                >
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Format</span>
                        <select
                          value={editorDraftType}
                          onChange={(event) =>
                            setEditorDraftType(event.target.value as SocialMediaDraftType)
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
                          value={editorLayout}
                          onChange={(event) => setEditorLayout(event.target.value)}
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

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Assets</p>
                          <p className="text-sm text-slate-600">
                            Bilder werden hochgeladen und koennen danach in mehreren Ebenen verwendet werden.
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
                              const mapped = files.map((file, index) => {
                                const id = `new-${Date.now()}-${index}-${file.name}`;
                                return {
                                  id,
                                  ref: `local:${id}`,
                                  kind: "new" as const,
                                  url: URL.createObjectURL(file),
                                  file,
                                };
                              });
                              setEditorAssets((current) => [...current, ...mapped]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {editorAssets.length ? (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {editorAssets.map((asset) => (
                            <div
                              key={asset.id}
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                            >
                              <button
                                type="button"
                                className="block h-28 w-full bg-slate-50"
                                onClick={() =>
                                  setImageModal({ src: asset.url, alt: "Asset-Vorschau" })
                                }
                              >
                                <img
                                  src={asset.url}
                                  alt="Asset"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                              <div className="flex items-center justify-between gap-2 p-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {asset.kind === "new" ? "Neu" : "Gespeichert"}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">{asset.ref}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAsset(asset.ref)}
                                  className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                          Noch keine Bilder vorhanden
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Ebenen"
                  description="Reihenfolge bestimmt, was vorne oder hinten liegt."
                  actions={
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addLayer("image")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <ImageIcon size={15} />
                        Bild
                      </button>
                      <button
                        type="button"
                        onClick={() => addLayer("caption")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <SquareStack size={15} />
                        Textkarte
                      </button>
                      <button
                        type="button"
                        onClick={() => addLayer("badge")}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Type size={15} />
                        Badge
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    {editorLayers.map((layer, index) => (
                      <div
                        key={layer.id}
                        className={cn(
                          "rounded-2xl border p-3 transition",
                          activeLayer?.id === layer.id
                            ? "border-blue-300 bg-blue-50/70"
                            : "border-slate-200 bg-slate-50",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setActiveLayerId(layer.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-900 shadow-sm">
                              {layer.kind === "image" ? (
                                <ImageIcon size={16} />
                              ) : layer.kind === "caption" ? (
                                <SquareStack size={16} />
                              ) : (
                                <Type size={16} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {layer.label}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {layer.kind === "image"
                                  ? layer.imageRef || "Kein Bild zugewiesen"
                                  : resolveLayerText(layer) || "Ohne Text"}
                              </p>
                            </div>
                          </button>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateLayer(layer.id, { enabled: !layer.enabled })}
                              className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                            >
                              {layer.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLayer(layer.id, -1)}
                              disabled={index === 0}
                              className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLayer(layer.id, 1)}
                              disabled={index === editorLayers.length - 1}
                              className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLayer(layer.id)}
                              className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-4">
                <SectionCard
                  title="Layer-Inspector"
                  description="Eigenschaften der aktuell ausgewaehlten Ebene."
                >
                  {activeLayer ? (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                        <input
                          value={activeLayer.label}
                          onChange={(event) =>
                            updateLayer(activeLayer.id, { label: event.target.value })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Ebenentyp
                          </span>
                          <select
                            value={activeLayer.kind}
                            onChange={(event) => {
                              const kind = event.target.value as SocialMediaLayerKind;
                              updateLayer(activeLayer.id, {
                                kind,
                                style: createLayer(kind).style,
                                position: createLayer(kind).position,
                                imageRef:
                                  kind === "image"
                                    ? activeLayer.imageRef ?? editorAssets[0]?.ref
                                    : undefined,
                                text:
                                  kind === "image"
                                    ? ""
                                    : activeLayer.kind === "image"
                                      ? createLayer(kind).text
                                      : activeLayer.text,
                              });
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                          >
                            {layerKindOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Position
                          </span>
                          <select
                            value={activeLayer.position}
                            onChange={(event) =>
                              updateLayer(activeLayer.id, {
                                position: event.target.value as SocialMediaLayerPosition,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                          >
                            {positionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Stil</span>
                        <select
                          value={activeLayer.style}
                          onChange={(event) =>
                            updateLayer(activeLayer.id, {
                              style: event.target.value as SocialMediaLayerStyle,
                            })
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        >
                          {styleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {activeLayer.kind === "image" ? (
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Bildquelle</span>
                          <select
                            value={activeLayer.imageRef ?? ""}
                            onChange={(event) =>
                              updateLayer(activeLayer.id, {
                                imageRef: event.target.value || undefined,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                          >
                            <option value="">Kein Bild</option>
                            {editorAssets.map((asset, index) => (
                              <option key={asset.id} value={asset.ref}>
                                Bild {index + 1} {asset.kind === "new" ? "(neu)" : "(gespeichert)"}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Text</span>
                          <textarea
                            rows={activeLayer.kind === "caption" ? 6 : 3}
                            value={activeLayer.text ?? ""}
                            onChange={(event) =>
                              updateLayer(activeLayer.id, { text: event.target.value })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                          />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      Keine Ebene ausgewaehlt
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Schnelle Einfuegung"
                  description="Textbausteine werden in die aktive Textebene uebernommen."
                >
                  <div className="flex flex-wrap gap-2">
                    {snippets.map((snippet) => (
                      <button
                        key={snippet.id}
                        type="button"
                        onClick={() => insertSnippet(snippet.content)}
                        disabled={!activeLayer || activeLayer.kind === "image"}
                        className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {snippet.label}
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-4">
                <SectionCard
                  title="Live-Vorschau"
                  description="Die Ebenenansicht zeigt direkt, was vorne oder hinten liegt."
                  actions={
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-900">
                      <Layers3 size={14} />
                      {editorLayers.length} Ebenen
                    </div>
                  }
                >
                  <SocialPreview
                    draftType={editorDraftType}
                    layout={editorLayout}
                    layers={editorLayers}
                    assets={editorAssets}
                    logoUrl={settings.logoUrl}
                    activeLayerId={activeLayer?.id}
                    onSelectLayer={setActiveLayerId}
                  />
                </SectionCard>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={draftSubmitting}
                    onClick={async () => {
                      const newAssets = editorAssets.filter(
                        (asset): asset is Extract<EditorAsset, { kind: "new" }> =>
                          asset.kind === "new",
                      );
                      const placeholderByRef = new Map(
                        newAssets.map((asset, index) => [asset.ref, `__new_${index}__`]),
                      );
                      const optimizedNewFiles = await Promise.all(
                        newAssets.map((asset) => optimizeImageForUpload(asset.file)),
                      );
                      const imageOrder = editorAssets.map((asset) =>
                        asset.kind === "existing"
                          ? asset.url
                          : (placeholderByRef.get(asset.ref) ?? asset.ref),
                      );
                      const layersPayload = editorLayers.map((layer) => ({
                        ...layer,
                        imageRef: layer.imageRef
                          ? (placeholderByRef.get(layer.imageRef) ?? layer.imageRef)
                          : undefined,
                      }));
                      const title = getFirstLayerText(layersPayload, "title");
                      const subtitle = getFirstLayerText(layersPayload, "subtitle");
                      const caption = getFirstLayerText(layersPayload, "caption");
                      const callToAction = getFirstLayerText(layersPayload, "cta");

                      if (!title) {
                        setError("Bitte mindestens eine Titel-Ebene mit Inhalt anlegen.");
                        return;
                      }

                      setError("");
                      setSuccess("");
                      setDraftSubmitting(true);

                      const result =
                        editorMode === "create"
                          ? await addSocialMediaDraft({
                              draftType: editorDraftType,
                              layout: editorLayout,
                              title,
                              subtitle,
                              caption,
                              callToAction,
                              imageFiles: optimizedNewFiles,
                              imageOrder,
                              layers: layersPayload,
                            })
                          : await updateSocialMediaDraft(editingDraftId ?? "", {
                              draftType: editorDraftType,
                              layout: editorLayout,
                              title,
                              subtitle,
                              caption,
                              callToAction,
                              existingImageUrls: editorAssets
                                .filter(
                                  (asset): asset is Extract<EditorAsset, { kind: "existing" }> =>
                                    asset.kind === "existing",
                                )
                                .map((asset) => asset.url),
                              newImageFiles: optimizedNewFiles,
                              imageOrder,
                              layers: layersPayload,
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
                    className="rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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
