import { useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Check,
  Copy,
  Download,
  EyeOff,
  Image as ImageIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import * as htmlToImage from "html-to-image";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type {
  SocialMediaCrest,
  SocialMediaDraft,
  SocialMediaDraftType,
  SocialMediaLayer,
  SocialMediaLayerKind,
  SocialMediaLayerPosition,
  SocialMediaLayerStyle,
  SocialMediaLayoutOption,
} from "@/types";

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

type EditorAsset = {
  id: string;
  ref: string;
  kind: "upload" | "existing";
  url: string;
  fileName: string;
};

function getFileNameFromUrl(url: string, fallback = "Bild") {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const base = pathname.split("/").pop() ?? fallback;
    return decodeURIComponent(base) || fallback;
  } catch {
    return fallback;
  }
}

function isSharedCrestRef(ref: string) {
  return typeof ref === "string" && (ref.includes("crests/") || ref.includes("crest-"));
}

const fallbackLayoutOptions: SocialMediaLayoutOption[] = [
  { value: "matchday", label: "Spieltag", enabled: true },
  { value: "result", label: "Ergebnis", enabled: true },
  { value: "training", label: "Training", enabled: true },
  { value: "announcement", label: "Ankuendigung", enabled: true },
];

function createLayerId() {
  return `layer-${Math.random().toString(36).slice(2, 9)}`;
}

function createLayer(
  kind: SocialMediaLayerKind,
  overrides: Partial<SocialMediaLayer> = {},
): SocialMediaLayer {
  const defaults: Record<SocialMediaLayerKind, Omit<SocialMediaLayer, "id">> = {
    image: {
      kind: "image",
      label: "Bild",
      position: "center",
      style: "original",
      imageRef: undefined,
      text: "",
      enabled: true,
      centerX: 50,
      centerY: 50,
      widthPercent: 40,
      heightPercent: 40,
      lockPosition: false,
      lockSize: false,
      keepAspectRatio: true,
      fontFamily: undefined,
      fontSize: undefined,
      textColor: undefined,
      textAlign: undefined,
      textEffect: undefined,
      strokeColor: undefined,
      strokeWidth: undefined,
      lineHeight: undefined,
      letterSpacing: undefined,
    },
    badge: {
      kind: "badge",
      label: "Badge",
      position: "topLeft",
      style: "pill",
      text: "SG Wiking Offenbach",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Montserrat",
      fontSize: 12,
      textColor: "#0f172a",
      textAlign: "left",
      textEffect: "none",
      strokeColor: "#ffffff",
      strokeWidth: 0,
      lineHeight: 1.2,
      letterSpacing: 0.2,
    },
    title: {
      kind: "title",
      label: "Titel",
      position: "bottomLeft",
      style: "solid",
      text: "Titel Text",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Oswald",
      fontSize: 42,
      textColor: "#ffffff",
      textAlign: "left",
      textEffect: "shadow",
      strokeColor: "#0f172a",
      strokeWidth: 1.2,
      lineHeight: 1.05,
      letterSpacing: 0,
    },
    subtitle: {
      kind: "subtitle",
      label: "Untertitel",
      position: "bottomLeft",
      style: "glass",
      text: "Untertitel mit weiteren Infos",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Inter",
      fontSize: 18,
      textColor: "#ffffff",
      textAlign: "left",
      textEffect: "none",
      strokeColor: undefined,
      strokeWidth: 0,
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    caption: {
      kind: "caption",
      label: "Textkarte",
      position: "center",
      style: "clean",
      text: "Text in der Mitte",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Inter",
      fontSize: 20,
      textColor: "#0f172a",
      textAlign: "center",
      textEffect: "none",
      strokeColor: undefined,
      strokeWidth: 0,
      lineHeight: 1.35,
      letterSpacing: 0,
    },
    cta: {
      kind: "cta",
      label: "Button",
      position: "bottomRight",
      style: "pill",
      text: "Jetzt anmelden",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Montserrat",
      fontSize: 12,
      textColor: "#0f172a",
      textAlign: "center",
      textEffect: "none",
      strokeColor: undefined,
      strokeWidth: 0,
      lineHeight: 1.2,
      letterSpacing: 0.4,
    },
  };

  return {
    id: createLayerId(),
    ...defaults[kind],
    ...overrides,
  };
}

function buildDraftAssets(draft: SocialMediaDraft, crests: SocialMediaCrest[]): EditorAsset[] {
  const assets = new Map<string, EditorAsset>();

  draft.imageUrls.forEach((url, index) => {
    assets.set(url, {
      id: `existing-${index}-${url}`,
      ref: url,
      kind: "existing",
      url,
      fileName: getFileNameFromUrl(url),
    });
  });

  draft.layers.forEach((layer, index) => {
    if (!layer.imageRef) {
      return;
    }
    if (assets.has(layer.imageRef)) {
      return;
    }

    if (isSharedCrestRef(layer.imageRef)) {
      const crest = crests.find((entry) => entry.imageUrl === layer.imageRef);
      assets.set(layer.imageRef, {
        id: `shared-${crest?.id ?? index}-${layer.imageRef}`,
        ref: layer.imageRef,
        kind: "existing",
        url: layer.imageRef,
        fileName: crest?.name ? `${crest.name}.png` : getFileNameFromUrl(layer.imageRef, crest?.name ?? "Wappen"),
      });
      return;
    }

    assets.set(layer.imageRef, {
      id: `layer-${index}-${layer.imageRef}`,
      ref: layer.imageRef,
      kind: "existing",
      url: layer.imageRef,
      fileName: getFileNameFromUrl(layer.imageRef),
    });
  });

  return [...assets.values()];
}

function buildFallbackLayers(draft: SocialMediaDraft): SocialMediaLayer[] {
  const firstImageRef = draft.imageUrls[0];
  const fallback = [
    createLayer("image", { imageRef: firstImageRef }),
    createLayer("badge", {
      text: fallbackLayoutOptions.find((option) => option.value === draft.layout)?.label ?? "Vorlage",
    }),
    createLayer("title", { text: draft.title || "Titel" }),
  ];
  if (draft.subtitle) {
    fallback.push(createLayer("subtitle", { text: draft.subtitle }));
  }
  if (draft.caption) {
    fallback.push(createLayer("caption", { text: draft.caption }));
  }
  if (draft.callToAction) {
    fallback.push(createLayer("cta", { text: draft.callToAction }));
  }
  return fallback;
}

function sanitizePercent(value: number | undefined, fallback: number, min: number, max: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function getPlacementByPosition(position: SocialMediaLayerPosition): {
  centerX: number;
  centerY: number;
} {
  switch (position) {
    case "full":
    case "center":
      return { centerX: 50, centerY: 50 };
    case "topLeft":
      return { centerX: 16, centerY: 16 };
    case "topRight":
      return { centerX: 84, centerY: 16 };
    case "bottomLeft":
      return { centerX: 18, centerY: 82 };
    case "bottomCenter":
      return { centerX: 50, centerY: 84 };
    case "bottomRight":
      return { centerX: 82, centerY: 82 };
  }
}

function getDefaultImageGeometry(layer: Pick<SocialMediaLayer, "position" | "style">) {
  const sizeByKind: Record<
    SocialMediaLayerKind,
    { widthPercent: number; heightPercent: number }
  > = {
    image: { widthPercent: 40, heightPercent: 40 },
    title: { widthPercent: 72, heightPercent: 18 },
    subtitle: { widthPercent: 68, heightPercent: 14 },
    caption: { widthPercent: 72, heightPercent: 26 },
    badge: { widthPercent: 40, heightPercent: 10 },
    cta: { widthPercent: 44, heightPercent: 10 },
  };
  const effectivePosition =
    layer.position === "full" ? ("center" as SocialMediaLayerPosition) : layer.position;
  return {
    ...getPlacementByPosition(effectivePosition),
    ...sizeByKind.image,
  };
}

function getImageLayerGeometry(layer: Pick<
  SocialMediaLayer,
  "position" | "style" | "centerX" | "centerY" | "widthPercent" | "heightPercent"
>) {
  const defaults = getDefaultImageGeometry(layer);
  const widthPercent = sanitizePercent(layer.widthPercent, defaults.widthPercent, 2, 100);
  const heightPercent = sanitizePercent(layer.heightPercent, defaults.heightPercent, 2, 100);

  return {
    widthPercent,
    heightPercent,
    centerX: sanitizePercent(layer.centerX, defaults.centerX, 0, 100),
    centerY: sanitizePercent(layer.centerY, defaults.centerY, 0, 100),
  };
}

function getDefaultTextGeometry(layer: Pick<
  SocialMediaLayer,
  "kind" | "position"
>) {
  const sizeByKind: Record<
    SocialMediaLayerKind,
    { widthPercent: number; heightPercent: number }
  > = {
    title: { widthPercent: 72, heightPercent: 18 },
    subtitle: { widthPercent: 68, heightPercent: 14 },
    caption: { widthPercent: 72, heightPercent: 26 },
    badge: { widthPercent: 40, heightPercent: 10 },
    cta: { widthPercent: 44, heightPercent: 10 },
    image: { widthPercent: 40, heightPercent: 40 },
  };
  const effectivePosition =
    layer.position === "full" ? ("center" as SocialMediaLayerPosition) : layer.position;
  return {
    ...getPlacementByPosition(effectivePosition),
    ...sizeByKind[layer.kind],
  };
}

function getTextLayerGeometry(layer: Pick<
  SocialMediaLayer,
  "kind" | "position" | "centerX" | "centerY" | "widthPercent" | "heightPercent"
>) {
  const defaults = getDefaultTextGeometry(layer);
  const widthPercent = sanitizePercent(layer.widthPercent, defaults.widthPercent, 6, 140);
  const heightPercent = sanitizePercent(layer.heightPercent, defaults.heightPercent, 4, 120);

  return {
    widthPercent,
    heightPercent,
    centerX: sanitizePercent(layer.centerX, defaults.centerX, 0, 100),
    centerY: sanitizePercent(
      layer.centerY,
      defaults.centerY,
      0,
      100,
    ),
  };
}

function getImageStyleClasses(style: SocialMediaLayerStyle, full = false) {
  if (full) {
    return "rounded-2xl";
  }
  switch (style) {
    case "cover":
      return "rounded-[2rem] shadow-[0_20px_50px_rgba(15,23,42,0.25)]";
    case "cutout":
      return "rounded-[1.5rem] shadow-[0_20px_60px_rgba(15,23,42,0.35)]";
    case "soft":
      return "rounded-[1.5rem] shadow-[0_14px_40px_rgba(15,23,42,0.12)]";
    case "original":
    default:
      return "rounded-[1.25rem] shadow-[0_18px_45px_rgba(15,23,42,0.18)]";
  }
}

function getLayerContainerClasses(style: SocialMediaLayerStyle, kind: SocialMediaLayerKind) {
  if (kind === "image") {
    return getImageStyleClasses(style);
  }
  switch (style) {
    case "pill":
      return "rounded-full shadow-[0_10px_30px_rgba(15,23,42,0.18)]";
    case "solid":
      return "rounded-[1.25rem] shadow-[0_18px_50px_rgba(15,23,42,0.25)]";
    case "glass":
      return "rounded-[1.25rem] border border-white/30 bg-white/10 backdrop-blur-xl shadow-[0_14px_40px_rgba(15,23,42,0.18)]";
    case "clean":
      return "rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]";
    case "cutout":
      return "rounded-[1.5rem] shadow-[0_22px_60px_rgba(15,23,42,0.35)]";
    case "soft":
      return "rounded-[1.5rem] shadow-[0_14px_40px_rgba(15,23,42,0.12)]";
    default:
      return "rounded-[1.25rem]";
  }
}

function getLayerTextColorClasses(kind: SocialMediaLayerKind, style: SocialMediaLayerStyle) {
  if (kind === "title" || kind === "subtitle" || kind === "badge" || kind === "cta") {
    if (style === "clean") {
      return "text-slate-900";
    }
    return "text-white";
  }
  if (style === "glass") {
    return "text-white";
  }
  if (style === "solid") {
    return kind === "caption" ? "text-white" : "text-slate-900";
  }
  return "text-slate-900";
}

function getLayerFillClasses(style: SocialMediaLayerStyle, kind: SocialMediaLayerKind) {
  if (kind === "image") return "";
  switch (style) {
    case "pill":
      return "bg-white/90";
    case "solid":
      return "bg-slate-900/90";
    case "glass":
      return "bg-white/10";
    case "clean":
      return "bg-white";
    case "soft":
      return "bg-white/70";
    case "cutout":
      return "bg-white";
    default:
      return "bg-slate-900/90";
  }
}

function geometryToStyle(geo: {
  widthPercent: number;
  heightPercent: number;
  centerX: number;
  centerY: number;
}): React.CSSProperties {
  return {
    width: `${geo.widthPercent}%`,
    height: `${geo.heightPercent}%`,
    left: `${geo.centerX}%`,
    top: `${geo.centerY}%`,
    transform: "translate(-50%, -50%)",
  };
}

function renderPreviewLayers(
  layers: SocialMediaLayer[],
  assets: EditorAsset[],
): React.ReactNode {
  const resolveAssetUrl = (ref?: string) => assets.find((asset) => asset.ref === ref)?.url;
  return layers
    .filter((layer) => layer.enabled ?? true)
    .map((layer, index) => {
      const geo =
        layer.kind === "image"
          ? getImageLayerGeometry(layer)
          : getTextLayerGeometry(layer);
      const style = geometryToStyle(geo);
      const zIndex = index + 5;

      if (layer.kind === "image") {
        const assetUrl = resolveAssetUrl(layer.imageRef);
        if (layer.position === "full") {
          return (
            <div
              key={layer.id}
              className="absolute inset-0"
              style={{ zIndex }}
            >
              {assetUrl ? (
                <img
                  src={assetUrl}
                  alt={layer.label}
                  className="h-full w-full rounded-[1.75rem] object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[1.75rem] border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400">
                  <ImageIcon size={36} />
                </div>
              )}
            </div>
          );
        }
        return (
          <div
            key={layer.id}
            className="absolute"
            style={{ ...style, zIndex }}
          >
            {assetUrl ? (
              <img
                src={assetUrl}
                alt={layer.label}
                className={cn("h-full w-full", getImageStyleClasses(layer.style), layer.style === "cover" ? "object-cover" : "object-contain")}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400">
                <ImageIcon size={22} />
              </div>
            )}
          </div>
        );
      }

      const textAlign = layer.textAlign ?? "left";
      const textEffect = layer.textEffect ?? "none";
      const layerFill = getLayerFillClasses(layer.style, layer.kind);
      const textColor = getLayerTextColorClasses(layer.kind, layer.style);
      const containerClasses = getLayerContainerClasses(layer.style, layer.kind);

      const fontSize =
        layer.kind === "title"
          ? `${sanitizePercent(layer.fontSize, 42, 8, 180)}px`
          : layer.kind === "subtitle"
            ? `${sanitizePercent(layer.fontSize, 18, 8, 80)}px`
            : layer.kind === "caption"
              ? `${sanitizePercent(layer.fontSize, 20, 8, 80)}px`
              : layer.kind === "badge"
                ? `${sanitizePercent(layer.fontSize, 12, 6, 60)}px`
                : `${sanitizePercent(layer.fontSize, 12, 6, 60)}px`;

      const fontFamily =
        layer.fontFamily && ["Inter", "Oswald", "Montserrat"].includes(layer.fontFamily)
          ? `'${layer.fontFamily}', sans-serif`
          : "'Inter', sans-serif";

      let textShadow = "none";
      if (textEffect === "shadow") {
        textShadow = "0 3px 12px rgba(15, 23, 42, 0.55), 0 1px 2px rgba(15, 23, 42, 0.6)";
      } else if (textEffect === "outline" && layer.strokeColor) {
        textShadow = `0 0 1px ${layer.strokeColor}, 0 0 2px ${layer.strokeColor}, 0 1px 0 ${layer.strokeColor}, 0 -1px 0 ${layer.strokeColor}, 1px 0 0 ${layer.strokeColor}, -1px 0 0 ${layer.strokeColor}, 1px 1px 0 ${layer.strokeColor}, -1px -1px 0 ${layer.strokeColor}, 1px -1px 0 ${layer.strokeColor}, -1px 1px 0 ${layer.strokeColor}`;
      }

      return (
        <div
          key={layer.id}
          className={cn("absolute overflow-hidden", containerClasses, layerFill)}
          style={{ ...style, zIndex }}
        >
          <div
            className={cn(
              "flex h-full w-full items-center",
              textAlign === "left"
                ? "justify-start px-4"
                : textAlign === "right"
                  ? "justify-end px-4"
                  : "justify-center px-3",
            )}
          >
            <p
              className={cn("w-full break-words", textColor)}
              style={{
                fontFamily,
                fontSize,
                textAlign,
                lineHeight: layer.lineHeight ?? 1.2,
                letterSpacing: `${layer.letterSpacing ?? 0}px`,
                textShadow,
                whiteSpace: "pre-wrap",
              }}
            >
              {layer.text ?? ""}
            </p>
          </div>
        </div>
      );
    });
}

function buildPreviewHtmlContent(
  draft: SocialMediaDraft,
  assets: EditorAsset[],
  layers: SocialMediaLayer[],
  logoUrl: string | null,
): React.ReactNode {
  const darkLayouts = ["matchday", "result", "training"];
  const dark = darkLayouts.includes(draft.layout);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        dark
          ? "bg-[radial-gradient(circle_at_top_left,#1e3a8a_0%,#0f172a_60%,#020617_100%)] text-white shadow-[0_24px_70px_rgba(15,23,42,0.35)]"
          : "bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fafc_55%,#ffffff_100%)] text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
        draft.draftType === "story"
          ? "aspect-[9/16] w-[1080px] rounded-[2.5rem] px-8 py-10"
          : "aspect-[4/5] w-[1080px] rounded-[2.5rem] px-10 py-10",
      )}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex items-start justify-between">
          {logoUrl ? (
            <div
              className={cn(
                "flex items-center gap-3",
                dark ? "text-white" : "text-slate-900",
              )}
            >
              <img
                src={logoUrl}
                alt="Wappen"
                className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover shadow-md"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] opacity-80">
                  SG Wiking
                </p>
                <p className="text-xs font-medium opacity-90">Handball Offenbach</p>
              </div>
            </div>
          ) : null}
          {layers.some((layer) => layer.kind === "badge") ? null : (
            <span
              className={cn(
                "rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.25em]",
                dark
                  ? "bg-white/15 text-white"
                  : "bg-slate-900/90 text-white",
              )}
            >
              {fallbackLayoutOptions.find((opt) => opt.value === draft.layout)?.label ?? "Post"}
            </span>
          )}
        </div>

        <div className="relative flex-1">{renderPreviewLayers(layers, assets)}</div>

        {(draft.caption || draft.callToAction) &&
        !layers.some((l) => l.kind === "caption" || l.kind === "cta") ? (
          <div
            className={cn(
              "mt-4 grid gap-4 rounded-3xl px-5 py-6",
              dark
                ? "bg-white/10 backdrop-blur-xl text-white ring-1 ring-white/15"
                : "bg-white/90 text-slate-900 ring-1 ring-slate-200",
            )}
          >
            {draft.caption ? (
              <p
                className="whitespace-pre-wrap text-base font-semibold leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {draft.caption}
              </p>
            ) : null}
            {draft.callToAction ? (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-5 py-3 text-sm font-bold",
                    dark
                      ? "bg-white text-blue-950 shadow-lg"
                      : "bg-blue-900 text-white shadow-lg shadow-blue-900/20",
                  )}
                >
                  {draft.callToAction}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BoardMailboxPage() {
  const teams = useAppStore((state) => state.teams);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const pendingPlayerApplications = useAppStore((state) => state.pendingPlayerApplications);
  const matchRescheduleRequests = useAppStore((state) => state.matchRescheduleRequests);
  const socialMediaDrafts = useAppStore((state) => state.socialMediaDrafts);
  const socialMediaCrests = useAppStore((state) => state.socialMediaCrests);
  const settings = useAppStore((state) => state.settings);
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
  const updateSocialMediaDraft = useAppStore((state) => state.updateSocialMediaDraft);
  const deleteSocialMediaDraft = useAppStore((state) => state.deleteSocialMediaDraft);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [exportingJpgId, setExportingJpgId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "trash" | "social">("inbox");
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [approvalDrafts, setApprovalDrafts] = useState<
    Record<string, { email: string; password: string }>
  >({});

  const canManageMailbox = currentUser?.role === "admin" || currentUser?.role === "board";
  const canViewMailboxPage =
    canManageMailbox ||
    (currentUser?.role === "trainer" && matchRescheduleRequests.length > 0);

  const requestedByName = (userId: string | null | undefined) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";
  const teamName = (teamId: string) => teams.find((entry) => entry.id === teamId)?.name ?? "Mannschaft";

  const visibleRescheduleRequests = useMemo(() => {
    if (canManageMailbox) {
      return matchRescheduleRequests;
    }

    if (currentUser?.role === "trainer") {
      return matchRescheduleRequests.filter((entry) => currentUser.teamIds.includes(entry.teamId));
    }

    return [];
  }, [canManageMailbox, currentUser, matchRescheduleRequests]);

  const inboxPlayerApplications = pendingPlayerApplications.filter(
    (entry) => entry.status === "pending",
  );
  const trashPlayerApplications = pendingPlayerApplications.filter(
    (entry) => entry.status === "approved" || entry.status === "rejected",
  );
  const inboxRescheduleRequests = visibleRescheduleRequests.filter(
    (entry) => entry.status === "pending" || entry.status === "in_progress",
  );
  const trashRescheduleRequests = visibleRescheduleRequests.filter((entry) => entry.status === "done");

  const submittedInboxDrafts = useMemo(
    () =>
      socialMediaDrafts.filter(
        (draft) => !draft.isTemplate && draft.status === "submitted",
      ),
    [socialMediaDrafts],
  );

  const clubLogoUrl = settings.logoUrl;

  const copyToClipboard = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccessId(id);
      window.setTimeout(() => setCopySuccessId((current) => (current === id ? null : current)), 1500);
    } catch {
      setError("Text konnte nicht in die Zwischenablage kopiert werden.");
    }
  };

  const downloadPostingJpg = async (draft: SocialMediaDraft) => {
    if (typeof document === "undefined") {
      return;
    }

    setExportingJpgId(draft.id);
    let wrap: HTMLDivElement | null = null;
    let root: Root | null = null;
    try {
      const previewAssets = buildDraftAssets(draft, socialMediaCrests);
      const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);
      wrap = document.createElement("div");
      wrap.style.position = "fixed";
      wrap.style.left = "-100000px";
      wrap.style.top = "0";
      wrap.style.pointerEvents = "none";
      wrap.style.opacity = "0";
      wrap.style.zIndex = "-1";
      document.body.appendChild(wrap);

      root = createRoot(wrap);
      const PreviewWrapper = () =>
        buildPreviewHtmlContent(draft, previewAssets, previewLayers, clubLogoUrl ?? null);
      root.render(<PreviewWrapper />);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 600);
      });

      const target = wrap.firstElementChild as HTMLElement | null;
      if (!target) {
        throw new Error("Vorschau konnte nicht erstellt werden.");
      }

      const dataUrl = await htmlToImage.toJpeg(target, {
        pixelRatio: 1,
        quality: 0.95,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });

      const slug = draft.title
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const datePart = new Date().toISOString().slice(0, 10);
      const filename = `sg-wiking-posting-${slug || "entwurf"}-${datePart}.jpg`;

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      setError("JPG Export fehlgeschlagen. Bitte versuche es im Social-Media-Bereich.");
    } finally {
      if (root) {
        try {
          root.unmount();
        } catch {
          /* ignore */
        }
      }
      if (wrap && wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
      setExportingJpgId(null);
    }
  };

  if (!canViewMailboxPage) {
    return null;
  }

  return (
    <SectionCard
      title="Postfach"
      description="Hier landen Spielerinnen-Anmeldungen, Spielverlegungen sowie eingereichte Social-Media-Postings zur Freigabe fuer Vorstand und Admin."
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
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {inboxPlayerApplications.length + inboxRescheduleRequests.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "social"
                ? "bg-gradient-to-r from-blue-900 to-sky-600 text-white shadow-lg shadow-blue-900/20"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Social Media
            <span
              className={`ml-2 px-2 py-0.5 text-[10px] rounded-full ${
                activeTab === "social" ? "bg-white/20" : "bg-amber-100 text-amber-800"
              }`}
            >
              {submittedInboxDrafts.length}
            </span>
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

        {activeTab === "social" ? (
          canManageMailbox ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Eingereichte Social-Media-Postings
                  </p>
                  <p className="text-sm text-slate-600">
                    Poste dein Team ueber den Button rechts als JPG herunter, inklusive Text +
                    Hashtags zum Kopieren. Wenn erledigt: als bearbeitet markieren.
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {submittedInboxDrafts.length} eingereicht
                </span>
              </div>

              {submittedInboxDrafts.length ? (
                submittedInboxDrafts.map((draft) => {
                  const hashtagsText = draft.hashtags?.length
                    ? draft.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ")
                    : "";
                  const fullPostingText = [draft.postingText?.trim(), hashtagsText]
                    .filter(Boolean)
                    .join("\n\n");
                  const createdAt = previewDate(draft.createdAt);
                  const updatedAt = previewDate(draft.updatedAt);

                  return (
                    <div
                      key={draft.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {draft.title || "Posting (ohne Titel)"}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                draft.draftType === "story"
                                  ? "bg-fuchsia-100 text-fuchsia-800"
                                  : "bg-blue-50 px-3 py-1 text-blue-900"
                              }`}
                            >
                              {draft.draftType === "story" ? "Story 9:16" : "Feed 4:5"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {fallbackLayoutOptions.find((l) => l.value === draft.layout)?.label ??
                                draft.layout}
                            </span>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              Eingereicht
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Von {requestedByName(draft.createdBy)} · erstellt {createdAt}
                            {updatedAt !== createdAt ? ` · aktualisiert ${updatedAt}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-[0.65fr_1.35fr]">
                        <div className="relative flex items-start justify-center">
                          <div
                            className={cn(
                              "w-full max-w-[280px] overflow-hidden rounded-3xl border border-slate-200 shadow-xl bg-white",
                            )}
                          >
                            <div
                              className={
                                "w-full aspect-[4/5] bg-slate-100 relative flex items-center justify-center"
                              }
                              style={
                                draft.draftType === "story"
                                  ? { aspectRatio: "9 / 16" }
                                  : undefined
                              }
                            >
                              {draft.imageUrls[0] ? (
                                <img
                                  src={draft.imageUrls[0]}
                                  alt="Vorschau"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Kein Vorschaubild
                                </span>
                              )}
                              <EyeOff size={24} className="absolute bottom-3 right-3 opacity-30" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                Posting-Text
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    `text-${draft.id}`,
                                    draft.postingText || hashtagsText || "",
                                  )
                                }
                                disabled={!fullPostingText}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                              >
                                {copySuccessId === `text-${draft.id}` ? (
                                  <Check size={14} className="text-emerald-700" />
                                ) : (
                                  <Copy size={14} />
                                )}
                                {copySuccessId === `text-${draft.id}` ? "Kopiert" : "Text kopieren"}
                              </button>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                              {draft.postingText || (
                                <span className="italic text-slate-500">Kein Posting-Text hinterlegt</span>
                              )}
                            </p>
                          </div>

                          {hashtagsText ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                  Hashtags
                                </p>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`ht-${draft.id}`, hashtagsText)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                >
                                  {copySuccessId === `ht-${draft.id}` ? (
                                    <Check size={14} className="text-emerald-700" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                  {copySuccessId === `ht-${draft.id}` ? "Kopiert" : "Hashtags kopieren"}
                                </button>
                              </div>
                              <p className="mt-2 break-all text-sm font-semibold text-blue-800">
                                {hashtagsText}
                              </p>
                            </div>
                          ) : null}

                          {fullPostingText ? (
                            <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-blue-800">
                                  Kompletter Beitrag (Text + Hashtags)
                                </p>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`all-${draft.id}`, fullPostingText)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-900 transition hover:bg-blue-50"
                                >
                                  {copySuccessId === `all-${draft.id}` ? (
                                    <Check size={14} className="text-emerald-700" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                  {copySuccessId === `all-${draft.id}` ? "Kopiert" : "Alles kopieren"}
                                </button>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-blue-950">
                                {fullPostingText}
                              </p>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-3 pt-1">
                            <button
                              type="button"
                              disabled={exportingJpgId === draft.id || savingId === `sm-del-${draft.id}`}
                              onClick={() => void downloadPostingJpg(draft)}
                              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Download size={16} />
                              {exportingJpgId === draft.id
                                ? "Rendert JPG..."
                                : "Posting als JPG herunterladen"}
                            </button>
                            <button
                              type="button"
                              disabled={savingId === `sm-done-${draft.id}`}
                              onClick={async () => {
                                setError("");
                                setSuccess("");
                                setSavingId(`sm-done-${draft.id}`);
                                const result = await updateSocialMediaDraft(draft.id, {
                                  draftType: draft.draftType as "feed" | "story",
                                  title: draft.title,
                                  subtitle: draft.subtitle ?? "",
                                  caption: draft.caption ?? "",
                                  callToAction: draft.callToAction ?? "",
                                  layout: draft.layout,
                                  existingImageUrls: draft.imageUrls,
                                  newImageFiles: [],
                                  imageOrder: draft.imageUrls,
                                  layers: draft.layers,
                                  isTemplate: draft.isTemplate,
                                  postingText: draft.postingText ?? "",
                                  hashtags: draft.hashtags ?? [],
                                  status: "draft",
                                });
                                if (!result.success) {
                                  setError(result.error ?? "Fehler beim Abschliessen.");
                                } else {
                                  setSuccess("Posting wurde aus Postfach entfernt (als bearbeitet markiert).");
                                }
                                setSavingId(null);
                              }}
                              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Check size={16} />
                              {savingId === `sm-done-${draft.id}` ? "Speichert..." : "Erledigt / Gepostet"}
                            </button>
                            <button
                              type="button"
                              disabled={savingId === `sm-del-${draft.id}`}
                              onClick={async () => {
                                const confirmed = window.confirm(
                                  "Dieses Social-Media-Posting VOLLSTAENDIG loeschen? (Nicht empfehlenswert, nimm lieber 'Erledigt')",
                                );
                                if (!confirmed) return;
                                setError("");
                                setSuccess("");
                                setSavingId(`sm-del-${draft.id}`);
                                const result = await deleteSocialMediaDraft(draft.id);
                                if (!result.success) {
                                  setError(result.error ?? "Loeschen fehlgeschlagen.");
                                } else {
                                  setSuccess("Posting wurde geloescht.");
                                }
                                setSavingId(null);
                              }}
                              className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={16} />
                              Loeschen
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <Pencil size={30} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-semibold text-slate-900">
                    Noch keine Social-Media-Postings eingereicht
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Sobald Trainer:innen oder das Social-Team ein Posting zur Freigabe einreichen,
                    erscheint es hier mit JPG-Download + Text.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Keine Berechtigung fuer Social-Media-Postings
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Dieser Bereich ist nur fuer Vorstand und Admin sichtbar.
              </p>
            </div>
          )
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
        ) : null}

        {activeTab === "trash" ? (
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
        ) : null}
      </div>
    </SectionCard>
  );
}
