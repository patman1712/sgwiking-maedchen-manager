import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Navigate, useLocation } from "react-router-dom";
import { defaultRouteForRole } from "@/lib/utils";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Download,
  Droplet,
  Eye,
  EyeOff,
  Folder,
  FolderKanban,
  FolderPlus,
  Image as ImageIcon,
  Inbox,
  Layers3,
  Pencil,
  Plus,
  Shield,
  Sparkles,
  SquareStack,
  Trash2,
  Type,
  Upload,
  X,
  Check,
} from "lucide-react";
import * as htmlToImage from "html-to-image";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import type {
  SocialMediaCrest,
  SocialMediaDraft,
  SocialMediaDraftType,
  SocialMediaFont,
  SocialMediaLayer,
  SocialMediaLayerKind,
  SocialMediaLayoutOption,
  SocialMediaLayerPosition,
  SocialMediaLayerStyle,
  SocialMediaTextAlign,
  SocialMediaTextEffect,
  UserProfile,
  SocialMediaAsset,
} from "@/types";

export const SHARED_CREST_PREFIX = "/uploads/social-media-crests/";

export type EditorAsset =
  | {
      id: string;
      ref: string;
      kind: "existing";
      url: string;
      fileName: string;
    }
  | {
      id: string;
      ref: string;
      kind: "new";
      url: string;
      file: File;
      fileName: string;
    };

type FontOption = {
  value: string;
  label: string;
  source: "system" | "uploaded";
  fileUrl?: string;
};

const defaultFontOptions: FontOption[] = [
  { value: "Inter", label: "Inter", source: "system" },
  { value: "Arial", label: "Arial", source: "system" },
  { value: "Georgia", label: "Georgia", source: "system" },
  { value: "Montserrat", label: "Montserrat", source: "system" },
  { value: "Oswald", label: "Oswald", source: "system" },
  { value: "Poppins", label: "Poppins", source: "system" },
];

function isSharedCrestRef(ref?: string) {
  return Boolean(ref?.startsWith(SHARED_CREST_PREFIX));
}

function getFileNameFromUrl(url: string, fallback = "Bild") {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const lastSegment = pathname.split("/").pop() ?? fallback;
    return decodeURIComponent(lastSegment) || fallback;
  } catch {
    return fallback;
  }
}

export function buildDraftAssets(
  draft: SocialMediaDraft,
  crests: SocialMediaCrest[],
  assetsLibrary: SocialMediaAsset[] = [],
): EditorAsset[] {
  const normKey = (s?: string | null) =>
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  const findInLibraryByKey = (key?: string | null): EditorAsset | null => {
    if (!key) return null;
    const nk = normKey(key);
    if (!nk || nk === "emdash" || nk === "dash") return null;
    const rawMatch = assetsLibrary.find(
      (a) =>
        a.id === key ||
        a.imageUrl === key ||
        a.name === key ||
        a.name?.replace(/\.[^.]+$/, "") === key,
    );
    if (rawMatch) {
      return {
        id: rawMatch.id,
        ref: rawMatch.id,
        kind: "existing",
        url: rawMatch.imageUrl,
        fileName: rawMatch.name || getFileNameFromUrl(rawMatch.imageUrl),
      };
    }
    if (nk.length < 2) return null;
    const normMatch = assetsLibrary.find((a) => {
      const cands = [
        a.id,
        a.name,
        a.name?.replace(/\.[^.]+$/, ""),
        a.imageUrl.split("/").pop()?.split("?")[0],
        a.imageUrl
          .split("/")
          .pop()
          ?.split("?")[0]
          ?.replace(/\.[^.]+$/, ""),
      ].filter(Boolean) as string[];
      return cands.some((c) => normKey(c) === nk);
    });
    if (!normMatch) return null;
    return {
      id: normMatch.id,
      ref: normMatch.id,
      kind: "existing",
      url: normMatch.imageUrl,
      fileName: normMatch.name || getFileNameFromUrl(normMatch.imageUrl),
    };
  };

  const assets = new Map<string, EditorAsset>();

  assetsLibrary.forEach((asset, index) => {
    const editorAsset: EditorAsset = {
      id: asset.id,
      ref: asset.id,
      kind: "existing",
      url: asset.imageUrl,
      fileName: asset.name || getFileNameFromUrl(asset.imageUrl),
    };
    assets.set(asset.id, editorAsset);
    assets.set(asset.imageUrl, editorAsset);
    if (asset.name) {
      assets.set(asset.name, editorAsset);
      const cleanedName = asset.name.replace(/\.[^.]+$/, "");
      if (cleanedName && cleanedName !== asset.name) {
        assets.set(cleanedName, editorAsset);
      }
    }
    const basename = asset.imageUrl.split("/").pop()?.split("?")[0] ?? "";
    if (basename) {
      assets.set(basename, editorAsset);
      const cleanBase = basename.replace(/\.[^.]+$/, "");
      if (cleanBase) assets.set(cleanBase, editorAsset);
    }
    const nk = normKey(asset.name);
    if (nk.length >= 2) assets.set(`nk:${nk}`, editorAsset);
    void index;
  });

  draft.imageUrls.forEach((url, index) => {
    if (!assets.has(url)) {
      assets.set(url, {
        id: `existing-${index}-${url}`,
        ref: url,
        kind: "existing",
        url,
        fileName: getFileNameFromUrl(url),
      });
    }
  });

  const backgroundHints = [
    "hintergrund",
    "background",
    "blauweiss",
    "weissblau",
    "frankfurt",
    "trikot",
    "streifen",
    "blau",
    "stoff",
    "vorlage",
    "layout",
  ];
  const hintRank = (asset: SocialMediaAsset): number => {
    const hay = `${asset.name} ${asset.imageUrl}`.toLowerCase();
    const explicit = backgroundHints.findIndex((h) => hay.includes(h));
    if (explicit >= 0) return 10000 - explicit * 100;
    const isLogoLike = /(logo|wappen|crest|badge|icon|svz|sv |ifc|u12)/i.test(asset.name ?? "");
    if (isLogoLike) return -10000;
    const isUploadedPhoto = asset.imageUrl.startsWith("/uploads/") && /(jpg|jpeg)/i.test(asset.imageUrl);
    return 1000 + (asset.name?.length ?? 0) + (isUploadedPhoto ? 500 : 0);
  };
  const sortedLibraryForBg = [...assetsLibrary].sort(
    (a, b) => hintRank(b) - hintRank(a),
  );
  const bestBgCandidate = sortedLibraryForBg[0] ?? null;

  draft.layers.forEach((layer, index) => {
    if (layer.kind !== "image") return;
    const refIsBroken =
      !layer.imageRef ||
      layer.imageRef.trim() === "" ||
      layer.imageRef === "—" ||
      layer.imageRef === "-";

    let matchedAsset: EditorAsset | null = null;
    if (!refIsBroken && assets.has(layer.imageRef)) {
      matchedAsset = assets.get(layer.imageRef) ?? null;
    }
    if (!matchedAsset && !refIsBroken) {
      matchedAsset = findInLibraryByKey(layer.imageRef);
      if (matchedAsset) assets.set(layer.imageRef, matchedAsset);
    }
    if (!matchedAsset && layer.label) {
      matchedAsset = findInLibraryByKey(layer.label);
      if (matchedAsset) {
        assets.set(layer.label, matchedAsset);
        const nkLabel = normKey(layer.label);
        if (nkLabel.length >= 2) assets.set(`nk:${nkLabel}`, matchedAsset);
      }
    }
    if (!matchedAsset && layer.position === "full" && bestBgCandidate) {
      matchedAsset = {
        id: bestBgCandidate.id,
        ref: bestBgCandidate.id,
        kind: "existing",
        url: bestBgCandidate.imageUrl,
        fileName: bestBgCandidate.name || getFileNameFromUrl(bestBgCandidate.imageUrl),
      };
    }

    if (refIsBroken && matchedAsset) {
      const fallbacks: string[] = [];
      if (layer.imageRef) fallbacks.push(layer.imageRef);
      fallbacks.push("—", "-", "");
      if (layer.position === "full") fallbacks.push("position:full", `layeridx-full-${index}`);
      if (layer.label) fallbacks.push(layer.label);
      fallbacks.forEach((key) => {
        if (assets.has(key)) return;
        assets.set(key, {
          id: `fallback-${index}-${key}-${matchedAsset!.id}`,
          ref: key || matchedAsset!.ref,
          kind: "existing",
          url: matchedAsset!.url,
          fileName: matchedAsset!.fileName,
        });
      });
    } else if (matchedAsset) {
      assets.set(`layerid:${layer.id}`, matchedAsset);
    }

    if (isSharedCrestRef(layer.imageRef ?? "")) {
      const crest = crests.find((entry) => entry.imageUrl === layer.imageRef);
      const created: EditorAsset = {
        id: `shared-${crest?.id ?? index}-${layer.imageRef}`,
        ref: layer.imageRef,
        kind: "existing",
        url: layer.imageRef,
        fileName: crest?.name ? `${crest.name}.png` : getFileNameFromUrl(layer.imageRef, crest?.name ?? "Wappen"),
      };
      assets.set(layer.imageRef, created);
      const crestBasename = layer.imageRef.split("/").pop()?.split("?")[0] ?? "";
      if (crestBasename) assets.set(crestBasename, created);
      return;
    }

    if (!refIsBroken && !assets.has(layer.imageRef)) {
      const created: EditorAsset = {
        id: `layer-${index}-${layer.imageRef}`,
        ref: layer.imageRef,
        kind: "existing",
        url: layer.imageRef,
        fileName: layer.imageFileName ?? getFileNameFromUrl(layer.imageRef),
      };
      assets.set(layer.imageRef, created);
    }
  });

  const unique = new Map<string, EditorAsset>();
  for (const editorAsset of assets.values()) {
    if (!unique.has(editorAsset.id)) {
      unique.set(editorAsset.id, editorAsset);
    }
  }
  return [...unique.values()];
}

const fallbackLayoutOptions: SocialMediaLayoutOption[] = [
  { value: "matchday", label: "Spieltag", enabled: true },
  { value: "result", label: "Ergebnis", enabled: true },
  { value: "training", label: "Training", enabled: true },
  { value: "announcement", label: "Ankuendigung", enabled: true },
];

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
  { value: "original", label: "Original (ohne Zuschneiden)" },
  { value: "cover", label: "Cover (füllt aus)" },
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
      lineHeight: 1.3,
      letterSpacing: 0,
    },
    title: {
      kind: "title",
      label: "Titel",
      position: "bottomLeft",
      style: "solid",
      text: "Spieltag",
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
      lineHeight: 1.1,
      letterSpacing: 0,
    },
    subtitle: {
      kind: "subtitle",
      label: "Untertitel",
      position: "bottomLeft",
      style: "glass",
      text: "Kurzer Untertitel",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Inter",
      fontSize: 18,
      textColor: "#f8fafc",
      textAlign: "left",
      textEffect: "none",
      strokeColor: "#0f172a",
      strokeWidth: 0,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    caption: {
      kind: "caption",
      label: "Text",
      position: "center",
      style: "clean",
      text: "Dein Text hier",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Inter",
      fontSize: 20,
      textColor: "#ffffff",
      textAlign: "center",
      textEffect: "shadow",
      strokeColor: "#0f172a",
      strokeWidth: 0,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    cta: {
      kind: "cta",
      label: "Button",
      position: "bottomRight",
      style: "pill",
      text: "Mehr Infos",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Montserrat",
      fontSize: 12,
      textColor: "#0f172a",
      textAlign: "center",
      textEffect: "none",
      strokeColor: "#ffffff",
      strokeWidth: 0,
      lineHeight: 1.3,
      letterSpacing: 0,
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

export function buildFallbackLayers(draft: SocialMediaDraft): SocialMediaLayer[] {
  const firstImageRef = draft.imageUrls[0];
  const fallback = [
    createLayer("image", { imageRef: firstImageRef }),
    createLayer("badge", {
      text: fallbackLayoutOptions.find((option) => option.value === draft.layout)?.label ?? "Vorlage",
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

function getPlacementByPosition(position: SocialMediaLayerPosition) {
  if (position === "full") {
    return { centerX: 50, centerY: 50 };
  }

  const placement: Record<
    Exclude<SocialMediaLayerPosition, "full">,
    { centerX: number; centerY: number }
  > = {
    topLeft: { centerX: 22, centerY: 22 },
    topRight: { centerX: 78, centerY: 22 },
    center: { centerX: 50, centerY: 50 },
    bottomLeft: { centerX: 22, centerY: 78 },
    bottomCenter: { centerX: 50, centerY: 78 },
    bottomRight: { centerX: 78, centerY: 78 },
  };

  return placement[position];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizePercent(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return clamp(value, min, max);
}

function getDefaultImageGeometry(layer: Pick<SocialMediaLayer, "position" | "style">) {
  if (layer.position === "full") {
    return {
      centerX: 50,
      centerY: 50,
      widthPercent: 100,
      heightPercent: 100,
    };
  }

  const size =
    layer.style === "cutout"
      ? { widthPercent: 28, heightPercent: 40 }
      : layer.style === "soft"
        ? { widthPercent: 34, heightPercent: 34 }
        : layer.style === "pill"
          ? { widthPercent: 28, heightPercent: 28 }
          : { widthPercent: 32, heightPercent: 44 };

  return {
    ...getPlacementByPosition(layer.position),
    ...size,
  };
}

function getDefaultTextGeometry(layer: Pick<SocialMediaLayer, "kind" | "position">) {
  const sizeByKind: Record<
    Exclude<SocialMediaLayerKind, "image">,
    { widthPercent: number; heightPercent: number }
  > = {
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
    ...sizeByKind[layer.kind],
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
    return "rounded-none border-0 bg-transparent object-cover";
  }

  switch (style) {
    case "original":
      return "rounded-none border-0 bg-transparent object-contain";
    case "soft":
      return "rounded-[1.75rem] border border-slate-200 object-cover opacity-95 shadow-[0_24px_60px_rgba(15,23,42,0.14)]";
    case "cutout":
      return "rounded-[1.5rem] border-0 bg-transparent object-contain";
    case "glass":
      return "rounded-[1.75rem] border border-slate-200 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.18)]";
    case "pill":
      return "rounded-full border-4 border-white object-cover shadow-[0_16px_50px_rgba(15,23,42,0.18)]";
    case "solid":
      return "rounded-[1.25rem] border border-blue-950/20 object-cover shadow-[0_20px_40px_rgba(15,23,42,0.2)]";
    case "clean":
      return "rounded-[1.5rem] border-0 object-cover";
    default:
      return "rounded-[1.75rem] border border-slate-200 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.18)]";
  }
}

export function normalizeLayer(layer: SocialMediaLayer): SocialMediaLayer {
  if (layer.kind !== "image") {
    const defaults = getDefaultTextAppearance(layer);
    const geometry = getTextLayerGeometry(layer);
    return {
      ...layer,
      centerX: geometry.centerX,
      centerY: geometry.centerY,
      widthPercent: geometry.widthPercent,
      lockPosition: layer.lockPosition ?? false,
      lockSize: layer.lockSize ?? false,
      fontFamily: layer.fontFamily ?? defaults.fontFamily,
      fontSize: layer.fontSize ?? defaults.fontSize,
      textColor: layer.textColor ?? defaults.textColor,
      textAlign: layer.textAlign ?? defaults.textAlign,
      textEffect: layer.textEffect ?? defaults.textEffect,
      strokeColor: layer.strokeColor ?? defaults.strokeColor,
      strokeWidth: layer.strokeWidth ?? defaults.strokeWidth,
      lineHeight: layer.lineHeight ?? defaults.lineHeight,
      letterSpacing: layer.letterSpacing ?? defaults.letterSpacing,
    };
  }

  return {
    ...layer,
    ...getImageLayerGeometry(layer),
    lockPosition: layer.lockPosition ?? false,
    lockSize: layer.lockSize ?? false,
  };
}

function getTextInlineStyle(layer: SocialMediaLayer): React.CSSProperties {
  const defaults = getDefaultTextAppearance(layer);
  const textEffect = layer.textEffect ?? defaults.textEffect;
  const fontFamily = layer.fontFamily ?? defaults.fontFamily;
  const strokeColor = layer.strokeColor ?? defaults.strokeColor;
  const strokeWidth = layer.strokeWidth ?? defaults.strokeWidth;
  const lineHeight = layer.lineHeight ?? defaults.lineHeight;
  const letterSpacing = layer.letterSpacing ?? defaults.letterSpacing;
  const fontSizeNumber = Math.round(layer.fontSize ?? defaults.fontSize);
  const isOutline = textEffect === "outline";
  const effectiveStrokeWidth = isOutline
    ? strokeWidth > 0
      ? strokeWidth
      : 1.2
    : strokeWidth;

  return {
    color: layer.textColor ?? defaults.textColor,
    fontFamily: `"${fontFamily}", "Inter", system-ui, sans-serif`,
    fontSize: `${fontSizeNumber}px`,
    lineHeight: String(lineHeight),
    letterSpacing: letterSpacing ? `${letterSpacing}px` : "normal",
    textAlign: (layer.textAlign ?? defaults.textAlign) as SocialMediaTextAlign,
    textShadow:
      textEffect === "shadow" ? "0 10px 30px rgba(15,23,42,0.55)" : "none",
    WebkitTextStroke:
      isOutline && effectiveStrokeWidth > 0
        ? `${effectiveStrokeWidth}px ${strokeColor}`
        : undefined,
    paintOrder: "stroke fill",
  };
}

function canMoveLayer(layer: SocialMediaLayer, respectLayerLocks: boolean) {
  return !respectLayerLocks || !layer.lockPosition;
}

function canResizeLayer(layer: SocialMediaLayer, respectLayerLocks: boolean) {
  return !respectLayerLocks || !layer.lockSize;
}

function getDefaultTextAppearance(layer: SocialMediaLayer) {
  switch (layer.kind) {
    case "title":
      return {
        fontFamily: "Oswald",
        fontSize: 42,
        textColor: "#ffffff",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
        strokeColor: "#0f172a",
        strokeWidth: 1.2,
        lineHeight: 1.1,
        letterSpacing: 0,
      };
    case "subtitle":
      return {
        fontFamily: "Inter",
        fontSize: layer.style === "solid" ? 16 : 18,
        textColor: "#334155",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
        strokeColor: "#0f172a",
        strokeWidth: 0,
        lineHeight: 1.4,
        letterSpacing: 0,
      };
    case "caption":
      return {
        fontFamily: "Inter",
        fontSize: 16,
        textColor: "#334155",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
        strokeColor: "#0f172a",
        strokeWidth: 0,
        lineHeight: 1.5,
        letterSpacing: 0,
      };
    case "badge":
      return {
        fontFamily: "Montserrat",
        fontSize: 12,
        textColor: layer.style === "pill" ? "#ffffff" : "#0f172a",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
        strokeColor: "#ffffff",
        strokeWidth: 0,
        lineHeight: 1.3,
        letterSpacing: 0,
      };
    case "cta":
      return {
        fontFamily: "Montserrat",
        fontSize: 12,
        textColor: layer.style === "solid" ? "#ffffff" : "#0f172a",
        textAlign: "center" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
        strokeColor: "#ffffff",
        strokeWidth: 0,
        lineHeight: 1.3,
        letterSpacing: 0,
      };
    default:
      return {
        fontFamily: "Inter",
        fontSize: 16,
        textColor: "#0f172a",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
        strokeColor: "#0f172a",
        strokeWidth: 0,
        lineHeight: 1.4,
        letterSpacing: 0,
      };
  }
}

function getTextWrapperClasses(
  _layer: SocialMediaLayer,
  _draftType: SocialMediaDraftType,
  isSelected: boolean,
) {
  return isSelected ? "ring-2 ring-sky-300 ring-offset-2 ring-offset-transparent" : "";
}

function getTextClasses(layer: SocialMediaLayer) {
  switch (layer.kind) {
    case "title":
      return cn(
        "whitespace-pre-wrap text-3xl font-black uppercase tracking-[0.08em] text-slate-900 md:text-4xl",
        layer.style === "glass" &&
          "rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3",
      );
    case "subtitle":
      return cn(
        "whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700 md:text-base",
        layer.style === "solid" &&
          "rounded-[1.25rem] bg-blue-950 px-4 py-3 text-white",
        layer.style === "glass" &&
          "rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3",
      );
    case "badge":
      return cn(
        "inline-flex items-center rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em]",
        layer.style === "pill"
          ? "border border-blue-950 bg-blue-950 text-white shadow-lg"
          : "border border-slate-300 bg-white text-slate-900 shadow-sm",
      );
    case "cta":
      return cn(
        "inline-flex items-center rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]",
        layer.style === "solid"
          ? "bg-blue-950 text-white shadow-xl"
          : "border border-slate-300 bg-white text-slate-900 shadow-sm",
      );
    case "caption":
      return cn(
        "whitespace-pre-wrap text-sm leading-6",
        layer.style === "clean"
          ? "px-0 py-0"
          : layer.style === "solid"
            ? "rounded-[1.75rem] px-4 py-4 md:px-5 bg-slate-900 text-white shadow-[0_18px_50px_rgba(15,23,42,0.2)]"
            : "rounded-[1.75rem] border border-slate-200 bg-slate-50 text-slate-800 px-4 py-4 md:px-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
      );
    default:
      return "text-sm text-slate-900";
  }
}

export function SocialPreview({
  draftType,
  layout,
  layers,
  assets,
  logoUrl,
  activeLayerId,
  onSelectLayer,
  onUpdateLayer,
  respectLayerLocks = false,
  dataJpgExportId,
}: {
  draftType: SocialMediaDraftType;
  layout: string;
  layers: SocialMediaLayer[];
  assets: EditorAsset[];
  logoUrl: string | null;
  activeLayerId?: string | null;
  onSelectLayer?: (layerId: string) => void;
  onUpdateLayer?: (layerId: string, patch: Partial<SocialMediaLayer>) => void;
  respectLayerLocks?: boolean;
  dataJpgExportId?: string;
}) {
  const layoutLabel =
    fallbackLayoutOptions.find((option) => option.value === layout)?.label ?? "Vorlage";

  const previewRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    layerId: string;
    layerKind: SocialMediaLayerKind;
    mode: "drag" | "resize";
    startX: number;
    startY: number;
    startCenterX: number;
    startCenterY: number;
    startWidthPercent: number;
    startHeightPercent: number;
    startFontSize?: number;
    startLetterSpacing?: number;
  } | null>(null);
  const resolveAssetUrl = (ref?: string, altLabel?: string, positionHint?: string) => {
    const normKey = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

    const tryMatch = (needleRaw?: string, allowBrokenKey = false) => {
      if (!needleRaw && !allowBrokenKey) return undefined;
      const trimmed = (needleRaw ?? "").trim();
      if (!allowBrokenKey && (!trimmed || trimmed === "—" || trimmed === "-")) return undefined;
      const direct = assets.find((asset) => asset.ref === trimmed)?.url
        ?? assets.find((asset) => asset.id === trimmed)?.url
        ?? assets.find((asset) => asset.url === trimmed)?.url;
      if (direct) return direct;
      const crestPrefix = SHARED_CREST_PREFIX;
      const trimmedNoPrefix = trimmed.startsWith(crestPrefix) ? trimmed.slice(crestPrefix.length) : trimmed;
      const matchByBasename = assets.find((asset) => {
        const candidates = [asset.url, asset.ref, asset.fileName].filter(Boolean) as string[];
        return candidates.some((candidate) => {
          const base = candidate.split("/").pop()?.split("?")[0] ?? "";
          const needleBase = trimmedNoPrefix.split("/").pop()?.split("?")[0] ?? "";
          if (!base || !needleBase) return false;
          return base === needleBase;
        });
      })?.url;
      if (matchByBasename) return matchByBasename;
      const normNeedle = normKey(trimmed);
      if (normNeedle.length >= 2) {
        const byNorm = assets.find((asset) => {
          return (
            normKey(asset.fileName) === normNeedle ||
            normKey(asset.ref) === normNeedle ||
            normKey(asset.id) === normNeedle
          );
        })?.url;
        if (byNorm) return byNorm;
      }
      const looksLikeDirectUrl = /^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("data:");
      return looksLikeDirectUrl ? trimmed : undefined;
    };

    return (
      tryMatch(ref)
      ?? tryMatch(altLabel)
      ?? (positionHint === "full" ? assets.find((asset) => asset.ref === "position:full")?.url : undefined)
      ?? assets.find((asset) => asset.ref === ref)?.url
      ?? assets.find((asset) => asset.ref === (altLabel ?? "__no__"))?.url
      ?? undefined
    );
  };
  const visibleLayers = layers.filter((layer) => layer.enabled ?? true);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      const previewElement = previewRef.current;
      if (!interaction || !previewElement || !onUpdateLayer) {
        return;
      }

      const rect = previewElement.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const deltaXPercent = ((event.clientX - interaction.startX) / rect.width) * 100;
      const deltaYPercent = ((event.clientY - interaction.startY) / rect.height) * 100;

      if (interaction.mode === "drag") {
        const centerX = interaction.startCenterX + deltaXPercent;
        const centerY = interaction.startCenterY + deltaYPercent;
        onUpdateLayer(interaction.layerId, { centerX, centerY });
        return;
      }

      const layer = layers.find((entry) => entry.id === interaction.layerId);
      if (!layer) {
        return;
      }

      if (interaction.layerKind !== "image") {
        const defaults = getDefaultTextAppearance(layer);
        const baseDefaults = getDefaultTextGeometry(layer);
        const scaleX = (interaction.startWidthPercent + deltaXPercent * 2) / Math.max(interaction.startWidthPercent, 1);
        const scaleY = (interaction.startHeightPercent + deltaYPercent * 2) / Math.max(interaction.startHeightPercent, 1);
        const scale = clamp(Math.max(scaleX, scaleY), 0.25, 6);

        const widthPercent = clamp(baseDefaults.widthPercent * scale, 18, 100);
        const heightPercent = clamp(baseDefaults.heightPercent * scale, 6, 80);
        const fontSize = clamp(
          Math.round((interaction.startFontSize ?? defaults.fontSize) * scale),
          10,
          480,
        );
        const letterSpacing = Math.round(((interaction.startLetterSpacing ?? defaults.letterSpacing) * scale) * 100) / 100;

        onUpdateLayer(interaction.layerId, {
          centerX: interaction.startCenterX,
          centerY: interaction.startCenterY,
          widthPercent,
          heightPercent,
          fontSize,
          letterSpacing,
        });
        return;
      }

      const rawWidthPercent = clamp(interaction.startWidthPercent + deltaXPercent * 2, 2, 100);
      const rawHeightPercent = clamp(interaction.startHeightPercent + deltaYPercent * 2, 2, 100);

      let widthPercent = rawWidthPercent;
      let heightPercent = rawHeightPercent;

      if (layer.keepAspectRatio && typeof layer.baseAspectRatio === "number" && layer.baseAspectRatio > 0) {
        const ratio = layer.baseAspectRatio;
        const fromWidthHeight = Math.max(2, Math.min(100, Math.round(rawWidthPercent / ratio)));
        const deltaFromWidth = Math.abs(rawWidthPercent - interaction.startWidthPercent);
        const deltaFromHeight = Math.abs(rawHeightPercent - interaction.startHeightPercent);
        if (deltaFromWidth >= deltaFromHeight) {
          widthPercent = rawWidthPercent;
          heightPercent = fromWidthHeight;
        } else {
          heightPercent = rawHeightPercent;
          widthPercent = Math.max(2, Math.min(100, Math.round(rawHeightPercent * ratio)));
        }
      }

      const centerX = interaction.startCenterX;
      const centerY = interaction.startCenterY;

      onUpdateLayer(interaction.layerId, {
        centerX,
        centerY,
        widthPercent,
        heightPercent,
      });
    };

    const handlePointerUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [layers, onUpdateLayer]);

  return (
    <div
      ref={previewRef}
      data-jpg-export={dataJpgExportId}
      className={cn(
        "relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white text-slate-900 shadow-[0_28px_90px_rgba(15,23,42,0.14)]",
        draftType === "story" ? "aspect-[9/16]" : "aspect-[3/4]",
      )}
    >
      {visibleLayers.map((layer, index) => {
        const zStyle = { zIndex: index + 5 };

        if (layer.kind === "image") {
          const assetUrl = resolveAssetUrl(layer.imageRef, layer.label, layer.position);
          const geometry = getImageLayerGeometry(layer);
          const isSelected = activeLayerId === layer.id;
          const movable = canMoveLayer(layer, respectLayerLocks);
          const resizable = canResizeLayer(layer, respectLayerLocks);
          const isOriginalStyle = layer.style === "original" && layer.position !== "full";
          return (
            <div
              key={layer.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectLayer?.(layer.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectLayer?.(layer.id);
                }
              }}
              onPointerDown={(event) => {
                if (!onUpdateLayer || !movable) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                onSelectLayer?.(layer.id);
                interactionRef.current = {
                  layerId: layer.id,
                  layerKind: layer.kind,
                  mode: "drag",
                  startX: event.clientX,
                  startY: event.clientY,
                  startCenterX: geometry.centerX,
                  startCenterY: geometry.centerY,
                  startWidthPercent: geometry.widthPercent,
                  startHeightPercent: geometry.heightPercent,
                };
              }}
              className={cn(
                "absolute touch-none bg-transparent",
                isOriginalStyle ? "overflow-visible rounded-none border-0" : "overflow-hidden",
                movable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                isSelected && !isOriginalStyle &&
                  "ring-2 ring-sky-300 ring-offset-2 ring-offset-transparent",
              )}
              style={{
                ...zStyle,
                left: `${geometry.centerX}%`,
                top: `${geometry.centerY}%`,
                width: `${geometry.widthPercent}%`,
                height: `${geometry.heightPercent}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {assetUrl ? (
                <img
                  src={assetUrl}
                  alt={layer.label}
                  crossOrigin="anonymous"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  decoding="async"
                  className={cn(
                    "h-full w-full",
                    getImageStyleClasses(layer.style, layer.position === "full"),
                    isSelected && isOriginalStyle &&
                      "ring-2 ring-sky-300 ring-offset-2 ring-offset-transparent rounded-[1.5rem]",
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center text-slate-500",
                    layer.position === "full"
                      ? "bg-slate-100"
                      : "rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50",
                    isSelected && isOriginalStyle &&
                      "ring-2 ring-sky-300 ring-offset-2 ring-offset-transparent",
                  )}
                >
                  <ImageIcon size={22} />
                </div>
              )}
              {isSelected && onUpdateLayer ? (
                <button
                  type="button"
                  aria-label="Bildgroesse anpassen"
                  disabled={!resizable}
                  className={cn(
                    "absolute bottom-2 right-2 h-6 w-6 rounded-full border border-slate-200 shadow-lg shadow-slate-500/20",
                    resizable
                      ? "bg-sky-400"
                      : "cursor-not-allowed bg-slate-300 opacity-75",
                  )}
                  onPointerDown={(event) => {
                    if (!resizable) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectLayer?.(layer.id);
                    interactionRef.current = {
                      layerId: layer.id,
                      layerKind: layer.kind,
                      mode: "resize",
                      startX: event.clientX,
                      startY: event.clientY,
                      startCenterX: geometry.centerX,
                      startCenterY: geometry.centerY,
                      startWidthPercent: geometry.widthPercent,
                      startHeightPercent: geometry.heightPercent,
                    };
                  }}
                />
              ) : null}
            </div>
          );
        }

        const text = resolveLayerText(layer) || (layer.kind === "badge" ? "Badge" : "Text");
        const geometry = getTextLayerGeometry(layer);
        const isSelected = activeLayerId === layer.id;
        const movable = canMoveLayer(layer, respectLayerLocks);
        const resizable = canResizeLayer(layer, respectLayerLocks);
        return (
          <div
            key={layer.id}
            role="button"
            tabIndex={0}
            style={{
              ...zStyle,
              left: `${geometry.centerX}%`,
              top: `${geometry.centerY}%`,
              width: "fit-content",
              maxWidth: `${geometry.widthPercent}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => onSelectLayer?.(layer.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectLayer?.(layer.id);
              }
            }}
            onPointerDown={(event) => {
              if (!onUpdateLayer || !movable) {
                return;
              }
              const previewRect = previewRef.current?.getBoundingClientRect();
              const targetRect = event.currentTarget.getBoundingClientRect();
              event.preventDefault();
              event.stopPropagation();
              onSelectLayer?.(layer.id);
              interactionRef.current = {
                layerId: layer.id,
                layerKind: layer.kind,
                mode: "drag",
                startX: event.clientX,
                startY: event.clientY,
                startCenterX: geometry.centerX,
                startCenterY: geometry.centerY,
                startWidthPercent:
                  previewRect && previewRect.width
                    ? (targetRect.width / previewRect.width) * 100
                    : geometry.widthPercent,
                startHeightPercent:
                  previewRect && previewRect.height
                    ? (targetRect.height / previewRect.height) * 100
                    : geometry.heightPercent,
                startFontSize: layer.fontSize ?? getDefaultTextAppearance(layer).fontSize,
                startLetterSpacing: layer.letterSpacing ?? getDefaultTextAppearance(layer).letterSpacing,
              };
            }}
            className={cn(
              "absolute touch-none",
              movable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
              getTextWrapperClasses(layer, draftType, isSelected),
            )}
          >
            <div className={getTextClasses(layer)} style={getTextInlineStyle(layer)}>
              {text}
            </div>
            {isSelected && onUpdateLayer ? (
              <button
                type="button"
                aria-label="Textgroesse anpassen"
                disabled={!resizable}
                className={cn(
                  "absolute bottom-[-0.55rem] right-[-0.55rem] h-6 w-6 rounded-full border border-slate-200 shadow-lg shadow-slate-500/20",
                  resizable
                    ? "bg-sky-400"
                    : "cursor-not-allowed bg-slate-300 opacity-75",
                )}
                onPointerDown={(event) => {
                  if (!resizable) {
                    return;
                  }
                  const previewRect = previewRef.current?.getBoundingClientRect();
                  const parentRect = event.currentTarget.parentElement?.getBoundingClientRect();
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectLayer?.(layer.id);
                  interactionRef.current = {
                    layerId: layer.id,
                    layerKind: layer.kind,
                    mode: "resize",
                    startX: event.clientX,
                    startY: event.clientY,
                    startCenterX: geometry.centerX,
                    startCenterY: geometry.centerY,
                    startWidthPercent:
                      previewRect && previewRect.width && parentRect
                        ? (parentRect.width / previewRect.width) * 100
                        : geometry.widthPercent,
                    startHeightPercent:
                      previewRect && previewRect.height && parentRect
                        ? (parentRect.height / previewRect.height) * 100
                        : geometry.heightPercent,
                    startFontSize: layer.fontSize ?? getDefaultTextAppearance(layer).fontSize,
                    startLetterSpacing: layer.letterSpacing ?? getDefaultTextAppearance(layer).letterSpacing,
                  };
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SocialMediaPage() {
  const socialMediaDrafts = useAppStore((state) => state.socialMediaDrafts);
  const socialMediaCrests = useAppStore((state) => state.socialMediaCrests);
  const socialMediaFonts = useAppStore((state) => state.socialMediaFonts);
  const socialMediaAssetFolders = useAppStore((state) => state.socialMediaAssetFolders);
  const socialMediaAssets = useAppStore((state) => state.socialMediaAssets);
  const socialMediaTextSnippets = useAppStore((state) => state.socialMediaTextSnippets);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const settings = useAppStore((state) => state.settings);
  const fetchData = useAppStore((state) => state.fetchData);
  const addSocialMediaDraft = useAppStore((state) => state.addSocialMediaDraft);
  const updateSocialMediaDraft = useAppStore((state) => state.updateSocialMediaDraft);
  const deleteSocialMediaDraft = useAppStore((state) => state.deleteSocialMediaDraft);
  const addSocialMediaCrest = useAppStore((state) => state.addSocialMediaCrest);
  const deleteSocialMediaCrest = useAppStore((state) => state.deleteSocialMediaCrest);
  const addSocialMediaFont = useAppStore((state) => state.addSocialMediaFont);
  const deleteSocialMediaFont = useAppStore((state) => state.deleteSocialMediaFont);
  const addSocialMediaAssetFolder = useAppStore((state) => state.addSocialMediaAssetFolder);
  const deleteSocialMediaAssetFolder = useAppStore((state) => state.deleteSocialMediaAssetFolder);
  const uploadSocialMediaAssets = useAppStore((state) => state.uploadSocialMediaAssets);
  const deleteSocialMediaAsset = useAppStore((state) => state.deleteSocialMediaAsset);
  const addSocialMediaTextSnippet = useAppStore((state) => state.addSocialMediaTextSnippet);
  const updateSocialMediaTextSnippet = useAppStore((state) => state.updateSocialMediaTextSnippet);
  const deleteSocialMediaTextSnippet = useAppStore((state) => state.deleteSocialMediaTextSnippet);
  const updateUser = useAppStore((state) => state.updateUser);
  const location = useLocation();

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canManageSocial =
    currentUser?.role === "admin" ||
    currentUser?.role === "board" ||
    Boolean((currentUser as UserProfile & { isSocialMediaManager?: boolean })?.isSocialMediaManager);
  const canUseSocial =
    canManageSocial ||
    currentUser?.role === "social" ||
    Boolean(currentUser?.socialMediaEnabled);
  const isLimitedSocialUser = canUseSocial && !canManageSocial;
  const isTrainerSocialUser = Boolean(isLimitedSocialUser);

  if (!canUseSocial) {
    return <Navigate to={defaultRouteForRole(currentUser?.role)} replace />;
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
  const templateDrafts = useMemo(
    () => drafts.filter((draft) => draft.isTemplate),
    [drafts],
  );
  const managedLayoutOptions = useMemo(
    () =>
      settings.socialMediaLayouts?.length
        ? settings.socialMediaLayouts
        : fallbackLayoutOptions,
    [settings.socialMediaLayouts],
  );
  const availableLayoutOptions = useMemo(
    () => managedLayoutOptions.filter((option) => option.enabled),
    [managedLayoutOptions],
  );
  const releasedTemplateDrafts = useMemo(
    () =>
      templateDrafts.filter((draft) =>
        managedLayoutOptions.find((option) => option.value === draft.layout)?.enabled,
      ),
    [managedLayoutOptions, templateDrafts],
  );
  const editableDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) =>
          !draft.isTemplate &&
          (canManageSocial || currentUserId === draft.createdBy),
      ),
    [canManageSocial, currentUserId, drafts],
  );
  const submittedInboxDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) => !draft.isTemplate && draft.status === "submitted",
      ),
    [drafts],
  );
  const submittedPostingInboxCount = submittedInboxDrafts.length;

  const downloadPostingJpg = async (draft: SocialMediaDraft) => {
    if (typeof document === "undefined") {
      return;
    }

    setExportingJpgId(draft.id);
    try {
      const previewAssets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
      const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);
      const exportWidthPx = draft.draftType === "story" ? 1080 : 1080;
      const wrap = document.createElement("div");
      wrap.style.position = "fixed";
      wrap.style.left = "-100000px";
      wrap.style.top = "0px";
      wrap.style.pointerEvents = "none";
      wrap.style.zIndex = "-9999";
      document.body.appendChild(wrap);
      const root: Root = createRoot(wrap);
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        try {
          root.render(
            <div
              style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "32px",
              }}
            >
              <div style={{ position: "relative", width: `${exportWidthPx}px` }}>
                <SocialPreview
                  draftType={draft.draftType}
                  layout={draft.layout}
                  layers={previewLayers}
                  assets={previewAssets}
                  logoUrl={settings.logoUrl}
                />
              </div>
            </div>,
          );

          window.setTimeout(() => {
            if (settled) {
              return;
            }
            settled = true;
            resolve();
          }, 250);
        } catch (error) {
          settled = true;
          reject(error);
        }
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
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || "posting";
      const link = document.createElement("a");
      link.href = dataUrl;
      const stamp = new Date().toISOString().slice(0, 10);
      link.download = `sg-wiking-${slug}-${stamp}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setExportingJpgId(null);
      const leftover = document.body.querySelector(
        'body > div[style*="left: -100000px"]',
      ) as HTMLElement | null;
      if (leftover?.parentNode === document.body) {
        try {
          (leftover as HTMLElement & { _reactRoot?: Root })._reactRoot?.unmount?.();
        } catch {
          // ignore
        }
        document.body.removeChild(leftover);
      }
    }
  };
  const trainerUsers = useMemo(
    () => users.filter((user) => user.role === "trainer"),
    [users],
  );
  const fontOptions = useMemo(() => {
    const uploaded = socialMediaFonts.map((font: SocialMediaFont) => ({
      value: font.family,
      label: font.name,
      source: "uploaded" as const,
      fileUrl: font.fileUrl,
    }));

    const merged = [...defaultFontOptions];
    uploaded.forEach((option) => {
      if (!merged.some((entry) => entry.value === option.value)) {
        merged.push(option);
      }
    });

    return merged;
  }, [socialMediaFonts]);
  const socialFontFaceCss = useMemo(
    () =>
      socialMediaFonts
        .map(
          (font) => `
@font-face {
  font-family: "${font.family}";
  src: url("${font.fileUrl}");
  font-display: swap;
}
          `.trim(),
        )
        .join("\n"),
    [socialMediaFonts],
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editorIsTemplate, setEditorIsTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editorDraftType, setEditorDraftType] = useState<SocialMediaDraftType>("feed");
  const [editorLayout, setEditorLayout] = useState("matchday");
  const [editorTemplateName, setEditorTemplateName] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorPostingText, setEditorPostingText] = useState("");
  const [editorHashtags, setEditorHashtags] = useState<string[]>(["", "", "", "", ""]);
  const [editorAssets, setEditorAssets] = useState<EditorAsset[]>([]);
  const [editorLayers, setEditorLayers] = useState<SocialMediaLayer[]>(createStarterLayers());
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [exportingJpgId, setExportingJpgId] = useState<string | null>(null);

  const [snippetForm, setSnippetForm] = useState({
    label: "",
    content: "",
    category: "",
  });
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [snippetSubmitting, setSnippetSubmitting] = useState(false);
  const [crestName, setCrestName] = useState("");
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [crestSubmitting, setCrestSubmitting] = useState(false);
  const [fontName, setFontName] = useState("");
  const [fontFamilyName, setFontFamilyName] = useState("");
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontSubmitting, setFontSubmitting] = useState(false);
  const [accessSavingId, setAccessSavingId] = useState<string | null>(null);
  const [layoutForm, setLayoutForm] = useState<SocialMediaLayoutOption[]>(managedLayoutOptions);
  const [layoutSubmitting, setLayoutSubmitting] = useState(false);

  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [
    selectedAssetFolderId,
    setSelectedAssetFolderId,
  ] = useState<string | "__crests__" | "__unassigned__">("__crests__");
  const [newAssetFolderName, setNewAssetFolderName] = useState("");
  const [newAssetFolderBusy, setNewAssetFolderBusy] = useState(false);
  const [assetLibraryBusy, setAssetLibraryBusy] = useState(false);

  const sellerName = (userId: string) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";
  const getLayoutLabel = (value: string) =>
    managedLayoutOptions.find((option) => option.value === value)?.label ?? "Vorlage";
  const editorLayoutOptions = useMemo(() => {
    if (availableLayoutOptions.some((option) => option.value === editorLayout)) {
      return availableLayoutOptions;
    }

    const currentOption = managedLayoutOptions.find((option) => option.value === editorLayout);
    return currentOption ? [...availableLayoutOptions, currentOption] : availableLayoutOptions;
  }, [availableLayoutOptions, editorLayout, managedLayoutOptions]);

  const activeLayer =
    editorLayers.find((layer) => layer.id === activeLayerId) ??
    editorLayers.find((layer) => layer.kind !== "image") ??
    editorLayers[0] ??
    null;
  const respectEditorLayerLocks = !editorIsTemplate;
  const activeLayerPositionLocked =
    Boolean(activeLayer?.lockPosition) && respectEditorLayerLocks;
  const activeLayerSizeLocked =
    Boolean(activeLayer?.lockSize) && respectEditorLayerLocks;
  const isLayerProtected = (layer: SocialMediaLayer) =>
    respectEditorLayerLocks && Boolean(layer.lockPosition || layer.lockSize);
  const primaryTitleLayer =
    editorLayers.find((layer) => layer.kind === "title") ?? null;
  const selectedTemplate =
    templateDrafts.find((draft) => draft.id === selectedTemplateId) ?? templateDrafts[0] ?? null;
  const trainerPostingLabel =
    editorMode === "create" ? "Posting einreichen" : "Posting aktualisieren";

  useEffect(() => {
    setLayoutForm(managedLayoutOptions);
  }, [managedLayoutOptions]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const existingTag = document.querySelector('style[data-social-fonts="true"]');
    if (!socialFontFaceCss) {
      if (existingTag instanceof HTMLStyleElement) {
        existingTag.remove();
      }
      return;
    }

    const styleTag = existingTag instanceof HTMLStyleElement ? existingTag : document.createElement("style");
    styleTag.setAttribute("data-social-fonts", "true");
    if (styleTag.textContent !== socialFontFaceCss) {
      styleTag.textContent = socialFontFaceCss;
    }
    if (!styleTag.parentNode) {
      document.head.appendChild(styleTag);
    }
  }, [socialFontFaceCss]);

  const resetDraftEditor = () => {
    setEditorMode("create");
    setEditingDraftId(null);
    setEditorIsTemplate(false);
    setEditorDraftType("feed");
    setEditorLayout(
      availableLayoutOptions[0]?.value ?? managedLayoutOptions[0]?.value ?? "matchday",
    );
    setEditorTemplateName("");
    setEditorTitle("");
    setEditorPostingText("");
    setEditorHashtags(["", "", "", "", ""]);
    setEditorAssets([]);
    const starter = createStarterLayers();
    setEditorLayers(starter);
    setActiveLayerId(starter.find((layer) => layer.kind !== "image")?.id ?? starter[0]?.id ?? null);
  };

  const openCreateDraft = (draftType: SocialMediaDraftType = "feed") => {
    setError("");
    setSuccess("");
    resetDraftEditor();
    setEditorDraftType(draftType);
    setEditorOpen(true);
  };

  const openCreateTemplate = () => {
    setError("");
    setSuccess("");
    resetDraftEditor();
    setEditorIsTemplate(true);
    setEditorLayers([]);
    setActiveLayerId(null);
    setEditorOpen(true);
  };

  const openEditorWithDraft = (draft: SocialMediaDraft, mode: "create" | "edit", asTemplate: boolean) => {
    setError("");
    setSuccess("");
    setEditorMode(mode);
    setEditingDraftId(mode === "edit" ? draft.id : null);
    setEditorIsTemplate(asTemplate);
    setEditorDraftType(draft.draftType);
    setEditorLayout(draft.layout);
    setEditorTemplateName(draft.title);
    setEditorTitle(mode === "edit" && !asTemplate ? draft.title : "");
    const base = Array.from({ length: 5 }, () => "");
    for (let index = 0; index < Math.min(5, draft.hashtags?.length ?? 0); index++) {
      base[index] = draft.hashtags[index];
    }
    setEditorHashtags(base);
    setEditorPostingText(draft.postingText ?? "");
    const assets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
    setEditorAssets(assets);
    const layers = (draft.layers.length ? draft.layers : buildFallbackLayers(draft)).map(normalizeLayer);
    setEditorLayers(layers);
    setActiveLayerId(layers[0]?.id ?? null);
    setEditorOpen(true);
  };

  const openEditDraft = (draft: SocialMediaDraft) => {
    openEditorWithDraft(draft, "edit", draft.isTemplate);
  };

  useEffect(() => {
    const state = location.state as null | { openDraftId?: string };
    const openDraftId = state?.openDraftId;
    if (!openDraftId) return;
    const draft = socialMediaDrafts.find((entry) => entry.id === openDraftId);
    if (!draft) return;
    openEditorWithDraft(draft, "edit", draft.isTemplate);
    if (window.history.replaceState) {
      window.history.replaceState({}, "");
    }
  }, [location.state, socialMediaDrafts]);

  const useTemplateAsDraft = (draft: SocialMediaDraft) => {
    openEditorWithDraft(
      {
        ...draft,
        isTemplate: false,
      },
      "create",
      false,
    );
  };

  const duplicateTemplateAsTemplate = (draft: SocialMediaDraft) => {
    openEditorWithDraft(
      {
        ...draft,
        isTemplate: true,
      },
      "create",
      true,
    );
  };

  const applyTemplateToEditor = (draftId: string) => {
    const draft = templateDrafts.find((entry) => entry.id === draftId);
    if (!draft || editorIsTemplate) {
      return;
    }

    setEditorDraftType(draft.draftType);
    setEditorLayout(draft.layout);
    setEditorAssets(buildDraftAssets(draft, socialMediaCrests, socialMediaAssets));
    const layers = (draft.layers.length ? draft.layers : buildFallbackLayers(draft)).map(normalizeLayer);
    setEditorLayers(layers);
    setActiveLayerId(layers[0]?.id ?? null);
  };

  const updatePrimaryTitle = (value: string) => {
    if (editorIsTemplate) {
      setEditorTemplateName(value);
      return;
    }
    if (primaryTitleLayer) {
      updateLayer(primaryTitleLayer.id, { text: value });
      return;
    }

    const nextLayer = createLayer("title", { text: value });
    setEditorLayers((current) => [normalizeLayer(nextLayer), ...current]);
    setActiveLayerId(nextLayer.id);
  };

  const updateLayer = (layerId: string, patch: Partial<SocialMediaLayer>) => {
    setEditorLayers((current) =>
      current.map((layer) => {
        if (layer.id !== layerId) {
          return layer;
        }

        return normalizeLayer({ ...layer, ...patch });
      }),
    );
  };

  const resolveEditorAssetUrl = (ref?: string) =>
    editorAssets.find((asset) => asset.ref === ref)?.url;

  const probeNaturalImageRatio = async (imageUrl: string) => {
    return new Promise<{ ratio: number; width: number; height: number }>((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => {
        if (!probe.naturalWidth || !probe.naturalHeight) {
          reject(new Error("Bild-Masse nicht lesbar."));
          return;
        }
        resolve({
          ratio: probe.naturalWidth / probe.naturalHeight,
          width: probe.naturalWidth,
          height: probe.naturalHeight,
        });
      };
      probe.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
      probe.src = imageUrl;
    });
  };

  const initializeImageLayerWithNaturalRatio = async (layerId: string, imageUrl: string) => {
    try {
      const { ratio } = await probeNaturalImageRatio(imageUrl);

      const defaultInitialWidth = ratio >= 1 ? 46 : 36;
      const fittedHeight = clamp(Math.round(defaultInitialWidth / ratio), 12, 100);
      const finalWidth = clamp(Math.round(fittedHeight * ratio), 12, 100);
      const finalHeight = clamp(Math.round(finalWidth / ratio), 12, 100);

      updateLayer(layerId, {
        keepAspectRatio: true,
        baseAspectRatio: ratio,
        widthPercent: finalWidth,
        heightPercent: finalHeight,
      });
    } catch {
      void layerId;
    }
  };

  const lockImageLayerAspectRatio = async (
    layerId: string,
    imageRef?: string,
  ) => {
    const layerSnapshot = editorLayers.find((entry) => entry.id === layerId);
    if (!layerSnapshot) return;

    const rawImageUrl = resolveEditorAssetUrl(imageRef ?? layerSnapshot.imageRef);
    if (!rawImageUrl) {
      const geometry = getImageLayerGeometry(layerSnapshot);
      const fallbackRatio =
        geometry.widthPercent / Math.max(geometry.heightPercent, 0.001);
      updateLayer(layerId, { keepAspectRatio: true, baseAspectRatio: fallbackRatio });
      return;
    }

    try {
      const { ratio: naturalRatio } = await probeNaturalImageRatio(rawImageUrl);

      const currentGeometry = getImageLayerGeometry(layerSnapshot);

      const desiredWidth = currentGeometry.widthPercent;
      const desiredHeight = Math.round(desiredWidth / naturalRatio);

      if (desiredHeight >= 12 && desiredHeight <= 100) {
        updateLayer(layerId, {
          keepAspectRatio: true,
          baseAspectRatio: naturalRatio,
          widthPercent: desiredWidth,
          heightPercent: desiredHeight,
        });
        return;
      }

      const heightAsMaster = clamp(desiredHeight, 12, 100);
      const widthFromHeight = clamp(
        Math.round(heightAsMaster * naturalRatio),
        12,
        100,
      );
      const heightFinal = clamp(
        Math.round(widthFromHeight / naturalRatio),
        12,
        100,
      );

      updateLayer(layerId, {
        keepAspectRatio: true,
        baseAspectRatio: naturalRatio,
        widthPercent: widthFromHeight,
        heightPercent: heightFinal,
      });
    } catch {
      const geometry = getImageLayerGeometry(layerSnapshot);
      const fallbackRatio =
        geometry.widthPercent / Math.max(geometry.heightPercent, 0.001);
      updateLayer(layerId, {
        keepAspectRatio: true,
        baseAspectRatio: fallbackRatio,
        widthPercent: geometry.widthPercent,
        heightPercent: geometry.heightPercent,
      });
    }
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

  const reorderLayer = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setEditorLayers((current) => {
      const fromIndex = current.findIndex((layer) => layer.id === fromId);
      const toIndex = current.findIndex((layer) => layer.id === toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const addLayer = (kind: SocialMediaLayerKind) => {
    const firstAssetRef = editorAssets[0]?.ref;
    const firstAssetUrl = editorAssets[0]?.url;
    const firstAssetFileName = editorAssets[0]?.fileName;
    const overrides: Partial<SocialMediaLayer> = {};
    if (kind === "image") {
      overrides.imageRef = firstAssetRef;
      if (firstAssetFileName) {
        overrides.imageFileName = firstAssetFileName;
        overrides.label = firstAssetFileName;
      }
    }
    const nextLayer = normalizeLayer(createLayer(kind, overrides));
    setEditorLayers((current) => [...current, nextLayer]);
    setActiveLayerId(nextLayer.id);
    if (kind === "image" && firstAssetUrl) {
      void initializeImageLayerWithNaturalRatio(nextLayer.id, firstAssetUrl);
    }
  };

  const removeLayer = (layerId: string) => {
    setEditorLayers((current) => {
      const targetLayer = current.find((layer) => layer.id === layerId);
      if (targetLayer && isLayerProtected(targetLayer)) {
        return current;
      }

      return current.filter((layer) => layer.id !== layerId);
    });
    setActiveLayerId((current) => (current === layerId ? null : current));
  };

  const removeAsset = (assetRef: string) => {
    const hasProtectedLayer = editorLayers.some(
      (layer) => layer.kind === "image" && layer.imageRef === assetRef && isLayerProtected(layer),
    );
    if (hasProtectedLayer) {
      setError("Ein fixiertes Bildelement kann nicht entfernt werden.");
      return;
    }

    setEditorAssets((current) => current.filter((asset) => asset.ref !== assetRef));
    setEditorLayers((current) =>
      current.filter((layer) => !(layer.kind === "image" && layer.imageRef === assetRef)),
    );
  };

  const addSharedAssetToEditor = (imageUrl: string, label?: string) => {
    let createdRef = imageUrl;
    let alreadyExisted = false;
    const fileName = label ?? getFileNameFromUrl(imageUrl);
    setEditorAssets((current) => {
      if (current.some((asset) => asset.ref === imageUrl)) {
        alreadyExisted = true;
        return current;
      }

      return [
        ...current,
        {
          id: `shared-${label ?? "asset"}-${imageUrl}`,
          ref: imageUrl,
          kind: "existing",
          url: imageUrl,
          fileName,
        },
      ];
    });
    if (!alreadyExisted) {
      const baseLayer = createLayer("image", {
        imageRef: createdRef,
        imageFileName: fileName,
        label: fileName,
      });
      setEditorLayers((currentLayers) => [...currentLayers, normalizeLayer(baseLayer)]);
      setActiveLayerId(baseLayer.id);
      void initializeImageLayerWithNaturalRatio(baseLayer.id, imageUrl);
    }
  };

  const sortedAssetFolders = useMemo(
    () =>
      [...socialMediaAssetFolders].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name, "de");
      }),
    [socialMediaAssetFolders],
  );
  const visibleLibraryAssets = useMemo(() => {
    if (selectedAssetFolderId === "__crests__") return [];
    if (selectedAssetFolderId === "__unassigned__") {
      return socialMediaAssets.filter((asset) => !asset.folderId);
    }
    return socialMediaAssets.filter((asset) => asset.folderId === selectedAssetFolderId);
  }, [selectedAssetFolderId, socialMediaAssets]);
  const unassignedAssetCount = socialMediaAssets.filter((asset) => !asset.folderId).length;
  const selectedAssetFolderName = useMemo(() => {
    if (selectedAssetFolderId === "__crests__") return "Wappen & Logos";
    if (selectedAssetFolderId === "__unassigned__") return "Nicht zugeordnet";
    return sortedAssetFolders.find((f) => f.id === selectedAssetFolderId)?.name ?? "Ordner";
  }, [selectedAssetFolderId, sortedAssetFolders]);

  const handleCreateAssetFolder = async () => {
    setError("");
    setSuccess("");
    const name = newAssetFolderName.trim();
    if (!name) {
      setError("Bitte einen Ordnernamen eingeben.");
      return;
    }
    setNewAssetFolderBusy(true);
    const result = await addSocialMediaAssetFolder({ name });
    setNewAssetFolderBusy(false);
    if (!result.success) {
      setError(result.error || "Ordner konnte nicht angelegt werden.");
      return;
    }
    setNewAssetFolderName("");
    const created = [...socialMediaAssetFolders, { name, id: "pending" }];
    const fallback = [...socialMediaAssetFolders][0]?.id;
    void fetchData({ silent: true });
    if (fallback) setSelectedAssetFolderId(fallback);
  };
  const handleDeleteAssetFolder = async () => {
    if (selectedAssetFolderId === "__crests__" || selectedAssetFolderId === "__unassigned__") {
      return;
    }
    if (!window.confirm(`Ordner "${selectedAssetFolderName}" wirklich loeschen? Assets gehen ins Verzeichnis "Nicht zugeordnet".`)) {
      return;
    }
    setError("");
    setSuccess("");
    setAssetLibraryBusy(true);
    const result = await deleteSocialMediaAssetFolder(selectedAssetFolderId);
    setAssetLibraryBusy(false);
    if (!result.success) {
      setError(result.error || "Ordner konnte nicht geloescht werden.");
      return;
    }
    setSelectedAssetFolderId("__unassigned__");
  };
  const handleUploadAssetsToFolder = async (files: File[]) => {
    if (!files.length) return;
    setError("");
    setSuccess("");
    setAssetLibraryBusy(true);
    const folderId =
      selectedAssetFolderId === "__crests__" || selectedAssetFolderId === "__unassigned__"
        ? null
        : selectedAssetFolderId;
    const result = await uploadSocialMediaAssets({ files, folderId });
    setAssetLibraryBusy(false);
    if (!result.success) {
      setError(result.error || "Upload fehlgeschlagen.");
      return;
    }
    setSuccess("Assets erfolgreich hochgeladen.");
  };
  const handleDeleteAsset = async (
    assetId: string,
    assetName: string,
    kind: "crest" | "asset",
  ) => {
    if (!window.confirm(`${assetName} wirklich aus der Bibliothek loeschen?`)) return;
    setError("");
    setSuccess("");
    setAssetLibraryBusy(true);
    const result =
      kind === "crest"
        ? await deleteSocialMediaCrest(assetId)
        : await deleteSocialMediaAsset(assetId);
    setAssetLibraryBusy(false);
    if (!result.success) {
      setError(result.error || "Loeschen fehlgeschlagen.");
    }
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

  const toggleTrainerAccess = async (trainerId: string, value: boolean) => {
    const trainer = users.find((user) => user.id === trainerId);
    if (!trainer) {
      return;
    }

    setError("");
    setSuccess("");
    setAccessSavingId(trainerId);
    const result = await updateUser({
      userId: trainer.id,
      fullName: trainer.fullName,
      email: trainer.email,
      phone: trainer.phone,
      notes: trainer.notes,
      role: trainer.role,
      teamIds: trainer.teamIds,
      memberNumber: trainer.memberNumber,
      birthday: trainer.birthday,
      address: trainer.address,
      parentName: trainer.parentName,
      parentPhone: trainer.parentPhone,
      parentEmail: trainer.parentEmail,
      isMember: trainer.isMember,
      hasMembershipApplication: trainer.hasMembershipApplication,
      hasMedicalCertificate: trainer.hasMedicalCertificate,
      hasPhotoConsentSocial: trainer.hasPhotoConsentSocial,
      isMemberFileUrl: trainer.isMemberFileUrl,
      membershipApplicationFileUrl: trainer.membershipApplicationFileUrl,
      medicalCertificateFileUrl: trainer.medicalCertificateFileUrl,
      photoConsentSocialFileUrl: trainer.photoConsentSocialFileUrl,
      socialMediaEnabled: value,
    });
    if (!result.success) {
      setError(result.error ?? "Freigabe konnte nicht gespeichert werden.");
    } else {
      setSuccess("Trainer-Freigabe wurde aktualisiert.");
    }
    setAccessSavingId(null);
  };

  const saveLayoutSettings = async () => {
    if (!currentUserId) {
      setError("Bitte zuerst anmelden.");
      return;
    }

    setError("");
    setSuccess("");
    setLayoutSubmitting(true);

    try {
      const response = await fetch("/api/settings/social-media-layouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUserId,
          layouts: layoutForm.map((entry) => ({
            ...entry,
            label: entry.label.trim() || getLayoutLabel(entry.value),
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok || data.success === false) {
        setError(data.error || "Vorlagen-Namen konnten nicht gespeichert werden.");
        return;
      }

      await fetchData();
      setSuccess("Vorlagen-Namen und Freigaben wurden gespeichert.");
    } catch {
      setError("Vorlagen-Namen konnten nicht gespeichert werden.");
    } finally {
      setLayoutSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Social Media"
        description={
          isTrainerSocialUser
            ? "Postings aus freigegebenen Vorlagen erstellen und direkt zur Freigabe einreichen."
            : "Feed- und Story-Entwurfe mit Ebenen, sauberem Vereinsstil und deutlich flexiblerer Vorschau."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageSocial ? (
              <>
                <button
                  type="button"
                  onClick={() => openCreateDraft("feed")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                >
                  <Plus size={18} />
                  Feed erstellen
                </button>
                <button
                  type="button"
                  onClick={() => openCreateDraft("story")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus size={18} />
                  Story erstellen
                </button>
                <button
                  type="button"
                  onClick={openCreateTemplate}
                  className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-sky-900 transition hover:bg-sky-50"
                >
                  <Layers3 size={18} />
                  Neue Vorlage
                </button>
              </>
            ) : null}
          </div>
        }
      >
        <div
          className={
            isTrainerSocialUser
              ? "rounded-[2rem] border border-emerald-100 bg-[linear-gradient(135deg,rgba(236,253,245,0.8),rgba(255,255,255,0.95))] p-5 shadow-sm"
              : "rounded-[2rem] border border-blue-100 bg-[linear-gradient(135deg,rgba(219,234,254,0.8),rgba(255,255,255,0.95))] p-5 shadow-sm"
          }
        >
          {isTrainerSocialUser ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  1 · Vorlage
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  Aus Vorlage starten
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Waehle eine freigegebene Vorlage fuer Feed oder Story aus.
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  2 · Inhalte
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  Texte & Bilder anpassen
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Beschriftung und Fotos auf das kommende Spiel anpassen.
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  3 · Freigabe
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  Posting einreichen
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Sende das fertige Posting zur Freigabe an Vorstand und Admin.
                </p>
              </div>
            </div>
          ) : (
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
          )}
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
              <div className="space-y-6">
                {canManageSocial && templateDrafts.length ? (
                  <div className="space-y-3">
                    <div className="rounded-[2rem] border border-sky-200 bg-[linear-gradient(135deg,rgba(224,242,254,0.75),rgba(255,255,255,0.98))] p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Vorlagen verwalten</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Erst Vorlage auswaehlen, dann umbenennen, als neue Vorlage speichern oder direkt bearbeiten.
                          </p>
                        </div>
                        {selectedTemplate ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditDraft(selectedTemplate)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil size={15} />
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateTemplateAsTemplate(selectedTemplate)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-50"
                            >
                              <CopyPlus size={15} />
                              Als neue Vorlage speichern
                            </button>
                            <button
                              type="button"
                              disabled={savingId === selectedTemplate.id}
                              onClick={async () => {
                                const confirmed = window.confirm("Vorlage wirklich loeschen?");
                                if (!confirmed) {
                                  return;
                                }
                                setError("");
                                setSuccess("");
                                setSavingId(selectedTemplate.id);
                                const result = await deleteSocialMediaDraft(selectedTemplate.id);
                                if (!result.success) {
                                  setError(result.error ?? "Vorlage konnte nicht geloescht werden.");
                                } else {
                                  setSuccess("Vorlage wurde geloescht.");
                                  setSelectedTemplateId(null);
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

                      {selectedTemplate ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                          <div className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm">
                            <SocialPreview
                              draftType={selectedTemplate.draftType}
                              layout={selectedTemplate.layout}
                              layers={
                                selectedTemplate.layers.length
                                  ? selectedTemplate.layers
                                  : buildFallbackLayers(selectedTemplate)
                              }
                              assets={buildDraftAssets(selectedTemplate, socialMediaCrests, socialMediaAssets)}
                              logoUrl={settings.logoUrl}
                            />
                          </div>
                          <div className="space-y-3 rounded-[1.75rem] border border-sky-100 bg-white p-4 shadow-sm">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                                Ausgewaehlte Vorlage
                              </p>
                              <p className="mt-2 text-xl font-semibold text-slate-900">
                                {selectedTemplate.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {selectedTemplate.draftType === "story" ? "Story" : "Feed"} ·{" "}
                                {getLayoutLabel(selectedTemplate.layout)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-sm font-semibold text-slate-900">So arbeitest du damit</p>
                              <p className="mt-2 text-sm text-slate-600">
                                `Bearbeiten` aendert die bestehende Vorlage. `Als neue Vorlage speichern`
                                erstellt eine Kopie, die du umbenennen und separat speichern kannst.
                              </p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Zuletzt aktualisiert
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">
                                  {previewDate(selectedTemplate.updatedAt)}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                  Ebenen
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">
                                  {(selectedTemplate.layers.length
                                    ? selectedTemplate.layers
                                    : buildFallbackLayers(selectedTemplate)
                                  ).length}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {templateDrafts.map((draft) => {
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
                        const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);

                        return (
                          <div
                            key={draft.id}
                            className={cn(
                              "overflow-hidden rounded-[2rem] border bg-white shadow-sm transition",
                              selectedTemplate?.id === draft.id
                                ? "border-sky-400 ring-2 ring-sky-200"
                                : "border-sky-200",
                            )}
                          >
                            <div className="border-b border-sky-100 bg-sky-50/70 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
                                  <Layers3 size={14} />
                                  Vorlage
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
                                <button
                                  type="button"
                                  onClick={() => setSelectedTemplateId(draft.id)}
                                  className="min-w-0 text-left"
                                >
                                  <p className="text-base font-semibold text-slate-900">{draft.title}</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {getLayoutLabel(draft.layout)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Zuletzt aktualisiert: {previewDate(draft.updatedAt)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Von {sellerName(draft.createdBy)}
                                  </p>
                                </button>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTemplateId(draft.id)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                  >
                                    <Layers3 size={15} />
                                    Auswaehlen
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {!canManageSocial && releasedTemplateDrafts.length ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Vorlagen</p>
                      <p className="text-sm text-slate-600">
                        Waehle eine freigegebene Vorlage aus und bearbeite daraus direkt dein Posting.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {releasedTemplateDrafts.map((draft) => {
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
                        const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);

                        return (
                          <div
                            key={draft.id}
                            className="overflow-hidden rounded-[2rem] border border-sky-200 bg-white shadow-sm"
                          >
                            <div className="border-b border-sky-100 bg-sky-50/70 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-900">
                                  <Layers3 size={14} />
                                  Vorlage
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
                                    {getLayoutLabel(draft.layout)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Zuletzt aktualisiert: {previewDate(draft.updatedAt)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => useTemplateAsDraft(draft)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
                                >
                                  <Plus size={15} />
                                  Posting starten
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {canManageSocial && submittedInboxDrafts.length ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Postfach eingereichte Postings
                        </p>
                        <p className="text-sm text-slate-600">
                          Neue Postings von Trainern zur Freigabe. Hier Text + Bild herunterladen.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-900 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-blue-900/20">
                        <Inbox size={14} />
                        {submittedPostingInboxCount} neu
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {submittedInboxDrafts.map((draft) => {
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
                        const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);
                        const hashtagsLine =
                          draft.hashtags && draft.hashtags.length > 0
                            ? draft.hashtags.map((tag) => `#${tag}`).join(" ")
                            : null;

                        return (
                          <div
                            key={draft.id}
                            className="overflow-hidden rounded-[2rem] border border-blue-200 bg-gradient-to-b from-white to-blue-50/50 shadow-sm ring-2 ring-blue-500/10"
                          >
                            <div className="border-b border-blue-100 bg-blue-50/70 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-900 shadow-sm">
                                  <Inbox size={14} />
                                  Eingereicht
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                                    {draft.draftType === "story" ? "Story" : "Feed"}
                                  </span>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                    {previewLayers.length} Ebenen
                                  </span>
                                </div>
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

                              <div className="mt-4 rounded-2xl border border-blue-100 bg-white/80 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-900">
                                  Text unter dem Posting
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                                  {draft.postingText ? draft.postingText : "— Kein Text hinterlegt —"}
                                </p>
                                {hashtagsLine ? (
                                  <p className="mt-3 text-sm font-semibold text-blue-700">
                                    {hashtagsLine}
                                  </p>
                                ) : null}
                              </div>

                              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-slate-900">{draft.title}</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {getLayoutLabel(draft.layout)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Eingereicht am {previewDate(draft.updatedAt)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Von {sellerName(draft.createdBy)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditDraft(draft)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Pencil size={15} />
                                  Bearbeiten
                                </button>
                                <button
                                  type="button"
                                  disabled={exportingJpgId === draft.id}
                                  onClick={() => void downloadPostingJpg(draft)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Download size={15} />
                                  {exportingJpgId === draft.id ? "Rendert JPG..." : "JPG herunterladen"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {editableDrafts.length ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {canManageSocial ? "Entwuerfe" : "Meine Postings"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {canManageSocial
                          ? "Hier liegen bearbeitbare Entwuerfe und individuelle Varianten."
                          : "Hier bearbeitest du deine eingereichten Feed- und Story-Postings."}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {editableDrafts.map((draft) => {
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
                        const previewLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);
                        const hashtagsLine =
                          draft.hashtags && draft.hashtags.length > 0
                            ? draft.hashtags.map((tag) => `#${tag}`).join(" ")
                            : null;
                        const isSubmitted = draft.status === "submitted";
                        const canDownload = canManageSocial && isSubmitted;

                        return (
                          <div
                            key={draft.id}
                            className={`overflow-hidden rounded-[2rem] border bg-white shadow-sm ${
                              isSubmitted
                                ? "border-blue-200 ring-2 ring-blue-500/10"
                                : "border-slate-200"
                            }`}
                          >
                            <div
                              className={`border-b p-3 ${
                                isSubmitted
                                  ? "border-blue-100 bg-blue-50/70"
                                  : "border-slate-100 bg-slate-50/70"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                                    isSubmitted
                                      ? "bg-white text-blue-900 shadow-sm"
                                      : "bg-slate-900 text-white"
                                  }`}
                                >
                                  {isSubmitted ? (
                                    <>
                                      <Inbox size={14} />
                                      Eingereicht
                                    </>
                                  ) : (
                                    <>
                                      <Layers3 size={14} />
                                      Entwurf
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                                    {draft.draftType === "story" ? "Story" : "Feed"}
                                  </span>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                    {previewLayers.length} Ebenen
                                  </span>
                                </div>
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

                              {(draft.postingText || hashtagsLine) ? (
                                <div
                                  className={`mt-4 rounded-2xl border p-4 ${
                                    isSubmitted
                                      ? "border-blue-100 bg-white/80"
                                      : "border-slate-100 bg-slate-50/70"
                                  }`}
                                >
                                  <p
                                    className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                                      isSubmitted ? "text-blue-900" : "text-slate-600"
                                    }`}
                                  >
                                    Text unter dem Posting
                                  </p>
                                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                                    {draft.postingText ? draft.postingText : "— Kein Text hinterlegt —"}
                                  </p>
                                  {hashtagsLine ? (
                                    <p
                                      className={`mt-3 text-sm font-semibold ${
                                        isSubmitted ? "text-blue-700" : "text-slate-700"
                                      }`}
                                    >
                                      {hashtagsLine}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-slate-900">{draft.title}</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {getLayoutLabel(draft.layout)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Zuletzt aktualisiert: {previewDate(draft.updatedAt)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Von {sellerName(draft.createdBy)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditDraft(draft)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Pencil size={15} />
                                  Bearbeiten
                                </button>
                                {canDownload ? (
                                  <button
                                    type="button"
                                    disabled={exportingJpgId === draft.id}
                                    onClick={() => void downloadPostingJpg(draft)}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Download size={15} />
                                    {exportingJpgId === draft.id
                                      ? "Rendert JPG..."
                                      : "JPG herunterladen"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  disabled={savingId === draft.id}
                                  onClick={async () => {
                                    const confirmed = window.confirm(
                                      "Posting wirklich loeschen?",
                                    );
                                    if (!confirmed) {
                                      return;
                                    }
                                    setError("");
                                    setSuccess("");
                                    setSavingId(draft.id);
                                    const result = await deleteSocialMediaDraft(draft.id);
                                    if (!result.success) {
                                      setError(
                                        result.error ??
                                          "Posting konnte nicht geloescht werden.",
                                      );
                                    } else {
                                      setSuccess("Posting wurde geloescht.");
                                    }
                                    setSavingId(null);
                                  }}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Trash2 size={15} />
                                  Loeschen
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
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
            {canManageSocial ? (
              <>
                <SectionCard
                  title="Vorlagen-Namen"
                  description="Hier benennst du die Auswahl fuer Feed oder Story um und gibst Eintraege erst sichtbar frei."
                >
                  <div className="space-y-3">
                    {layoutForm.map((layout) => (
                      <div
                        key={layout.value}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Name in der Auswahl
                            </span>
                            <input
                              value={layout.label}
                              onChange={(event) =>
                                setLayoutForm((current) =>
                                  current.map((entry) =>
                                    entry.value === layout.value
                                      ? { ...entry, label: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </label>
                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={layout.enabled}
                              onChange={(event) =>
                                setLayoutForm((current) =>
                                  current.map((entry) =>
                                    entry.value === layout.value
                                      ? { ...entry, enabled: event.target.checked }
                                      : entry,
                                  ),
                                )
                              }
                              className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                            />
                            <span className="text-sm font-semibold text-slate-700">Freigegeben</span>
                          </label>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      disabled={layoutSubmitting}
                      onClick={() => void saveLayoutSettings()}
                      className="w-full rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {layoutSubmitting ? "Speichert..." : "Namen und Freigaben speichern"}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Trainer-Freigaben"
                  description="Nur freigeschaltete Trainer sehen Social Media und koennen Vorlagen als Entwurf verwenden."
                >
                  <div className="space-y-3">
                    {trainerUsers.map((trainer) => (
                      <label
                        key={trainer.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{trainer.fullName}</p>
                          <p className="text-xs text-slate-500">{trainer.email}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(trainer.socialMediaEnabled)}
                          disabled={accessSavingId === trainer.id}
                          onChange={(event) => void toggleTrainerAccess(trainer.id, event.target.checked)}
                          className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Schriftarten"
                  description="Admin kann eigene Fonts hochladen. Danach stehen sie in allen Textebenen zur Auswahl."
                >
                  <div className="space-y-4">
                    <form
                      className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!fontName.trim() || !fontFamilyName.trim() || !fontFile) {
                          setError("Bitte Anzeigenamen, Schriftfamilie und Font-Datei angeben.");
                          return;
                        }

                        setError("");
                        setSuccess("");
                        setFontSubmitting(true);
                        const result = await addSocialMediaFont({
                          name: fontName.trim(),
                          family: fontFamilyName.trim(),
                          file: fontFile,
                        });

                        if (!result.success) {
                          setError(result.error ?? "Schriftart konnte nicht gespeichert werden.");
                        } else {
                          setSuccess("Schriftart wurde gespeichert.");
                          setFontName("");
                          setFontFamilyName("");
                          setFontFile(null);
                        }

                        setFontSubmitting(false);
                      }}
                    >
                      <input
                        value={fontName}
                        onChange={(event) => setFontName(event.target.value)}
                        placeholder="Anzeigename, z. B. Vereinsheadline"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      <input
                        value={fontFamilyName}
                        onChange={(event) => setFontFamilyName(event.target.value)}
                        placeholder="Schriftfamilie, z. B. WikingHeadline"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                        <span>
                          {fontFile ? fontFile.name : "TTF, OTF, WOFF oder WOFF2 hochladen"}
                        </span>
                        <input
                          type="file"
                          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                          className="hidden"
                          onChange={(event) => setFontFile(event.target.files?.[0] ?? null)}
                        />
                        <span className="rounded-xl bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                          Datei waehlen
                        </span>
                      </label>
                      <button
                        type="submit"
                        disabled={fontSubmitting}
                        className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {fontSubmitting ? "Speichert..." : "Schriftart speichern"}
                      </button>
                    </form>

                    {socialMediaFonts.length ? (
                      <div className="space-y-3">
                        {socialMediaFonts.map((font) => (
                          <div
                            key={font.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{font.name}</p>
                              <p className="text-xs text-slate-500">
                                Familie: {font.family}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={savingId === font.id}
                              onClick={async () => {
                                const confirmed = window.confirm("Schriftart wirklich loeschen?");
                                if (!confirmed) {
                                  return;
                                }
                                setSavingId(font.id);
                                const result = await deleteSocialMediaFont(font.id);
                                if (!result.success) {
                                  setError(result.error ?? "Schriftart konnte nicht geloescht werden.");
                                } else {
                                  setSuccess("Schriftart wurde geloescht.");
                                }
                                setSavingId(null);
                              }}
                              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Loeschen
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Noch keine eigenen Schriftarten hochgeladen.
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Wappen"
                  description="PNG mit transparentem Hintergrund eignet sich hier ideal fuer freigestellte Vereinswappen."
                >
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Asset-Bibliothek öffnen</p>
                      <p className="text-xs text-slate-600">
                        Alle Wappen, Logos und freigegebenen Bilder in Ordnern verwalten.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssetFolderId("__crests__");
                        setAssetLibraryOpen(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                    >
                      <FolderKanban size={16} />
                      Asset-Bibliothek (Ordner öffnen)
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssetFolderId("__crests__");
                        setAssetLibraryOpen(true);
                      }}
                      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 text-white shadow-sm">
                        <Shield size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">Wappen & Logos</p>
                        <p className="truncate text-xs text-slate-500">
                          {socialMediaCrests.length} Elemente · Systemordner
                        </p>
                      </div>
                    </button>
                    {sortedAssetFolders.slice(0, 2).map((folder) => {
                      const count = socialMediaAssets.filter(
                        (asset) => asset.folderId === folder.id,
                      ).length;
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => {
                            setSelectedAssetFolderId(folder.id);
                            setAssetLibraryOpen(true);
                          }}
                          className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-sky-500 text-white shadow-sm">
                            <Folder size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{folder.name}</p>
                            <p className="truncate text-xs text-slate-500">{count} Elemente</p>
                          </div>
                        </button>
                      );
                    })}
                    {(unassignedAssetCount > 0 || sortedAssetFolders.length >= 2) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssetFolderId("__unassigned__");
                          setAssetLibraryOpen(true);
                        }}
                        className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-400 text-white shadow-sm">
                          <Archive size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">Nicht zugeordnet</p>
                          <p className="truncate text-xs text-slate-500">
                            {unassignedAssetCount} Elemente
                          </p>
                        </div>
                      </button>
                    ) : null}
                  </div>
                  {canManageSocial ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-600">
                          Neuer Ordner (Admin / Vorstand)
                        </p>
                        <p className="text-xs text-slate-500">
                          Lege z.B. Spielpläne, Trikots, Sponsoren als Gruppe an.
                        </p>
                      </div>
                      <input
                        type="text"
                        value={newAssetFolderName}
                        onChange={(event) => setNewAssetFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateAssetFolder();
                          }
                        }}
                        placeholder="z. B. Spielpläne 2026"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 md:max-w-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateAssetFolder()}
                        disabled={newAssetFolderBusy || !newAssetFolderName.trim()}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                      >
                        <FolderPlus size={16} />
                        Ordner anlegen
                      </button>
                    </div>
                  ) : null}
                </div>

                {canManageSocial ? (
                  <form
                    className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!crestName.trim() || !crestFile) {
                        setError("Bitte Namen und Wappenbild angeben.");
                        return;
                      }
                      setError("");
                      setSuccess("");
                      setCrestSubmitting(true);
                      const optimized = await optimizeImageForUpload(crestFile);
                      const result = await addSocialMediaCrest({
                        name: crestName.trim(),
                        file: optimized,
                      });
                      if (!result.success) {
                        setError(result.error ?? "Wappen konnte nicht gespeichert werden.");
                      } else {
                        setSuccess("Wappen wurde gespeichert.");
                        setCrestName("");
                        setCrestFile(null);
                      }
                      setCrestSubmitting(false);
                    }}
                  >
                    <input
                      value={crestName}
                      onChange={(event) => setCrestName(event.target.value)}
                      placeholder="Name des Wappens"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                      <span>{crestFile ? crestFile.name : "PNG oder JPG hochladen"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => setCrestFile(event.target.files?.[0] ?? null)}
                      />
                      <span className="rounded-xl bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                        Datei waehlen
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={crestSubmitting}
                      className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {crestSubmitting ? "Speichert..." : "Wappen speichern"}
                    </button>
                  </form>
                ) : null}

                {socialMediaCrests.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {socialMediaCrests.map((crest) => (
                      <div
                        key={crest.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          className="flex h-28 w-full items-center justify-center bg-[radial-gradient(circle,_rgba(226,232,240,0.9),_rgba(248,250,252,1))]"
                          onClick={() => setImageModal({ src: crest.imageUrl, alt: crest.name })}
                        >
                          <img
                            src={crest.imageUrl}
                            alt={crest.name}
                            className="h-full w-full object-contain p-3"
                          />
                        </button>
                        <div className="space-y-2 p-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{crest.name}</p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => addSharedAssetToEditor(crest.imageUrl, crest.id)}
                              className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                            >
                              Als Asset nutzen
                            </button>
                            {canManageSocial ? (
                              <button
                                type="button"
                                disabled={savingId === crest.id}
                                onClick={async () => {
                                  const confirmed = window.confirm("Wappen wirklich loeschen?");
                                  if (!confirmed) {
                                    return;
                                  }
                                  setSavingId(crest.id);
                                  const result = await deleteSocialMediaCrest(crest.id);
                                  if (!result.success) {
                                    setError(result.error ?? "Wappen konnte nicht geloescht werden.");
                                  } else {
                                    setSuccess("Wappen wurde geloescht.");
                                  }
                                  setSavingId(null);
                                }}
                                className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Loeschen
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-900">Noch keine Wappen</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Geladene Wappen koennen direkt als Bild-Asset verwendet werden.
                    </p>
                  </div>
                )}
              </div>
                </SectionCard>

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
              </>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-start md:justify-center bg-slate-950/60 p-0 md:p-4"
          onClick={() => {
            if (!draftSubmitting) {
              setEditorOpen(false);
            }
          }}
        >
          <div
            className="flex h-full w-full flex-col max-w-[95rem] overflow-hidden md:max-h-[94vh] md:overflow-y-auto md:rounded-[2rem] bg-white md:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:static md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
              <div className="min-w-0">
                <p className="truncate text-base md:text-lg font-semibold text-slate-900">
                  {editorIsTemplate
                    ? editorMode === "create"
                      ? "Neue Social-Media-Vorlage"
                      : "Vorlage bearbeiten"
                    : editorMode === "create"
                      ? isTrainerSocialUser
                        ? "Neues Posting"
                        : "Neuer Social-Media-Entwurf"
                      : isTrainerSocialUser
                        ? "Posting bearbeiten"
                        : "Entwurf bearbeiten"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs md:text-sm text-slate-600">
                  {editorIsTemplate
                    ? "Diese Grundvorlage bleibt gesperrt fuer Trainer und dient als Basis fuer neue Entwuerfe."
                    : isTrainerSocialUser
                      ? "Du arbeitest direkt auf einer freigegebenen Vorlage und reichst daraus dein Posting ein."
                      : "Bilder, Textkarten und Buttons sind echte Ebenen und koennen frei aufgebaut werden."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                disabled={draftSubmitting}
                aria-label="Editor schliessen"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-0 md:py-0 md:mt-6">
              <div className="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.3fr]">
                <div className="order-3 xl:order-1 space-y-4">
                <SectionCard
                  title="Grundaufbau"
                  description={
                    isTrainerSocialUser
                      ? "Titel und Bild-Assets fuer dein Posting auf Basis der gewaehlten Vorlage."
                      : "Format, Vorlagenauswahl und Bild-Assets fuer den Entwurf."
                  }
                >
                  <div className="space-y-4">
                    {!editorIsTemplate && !isTrainerSocialUser && releasedTemplateDrafts.length ? (
                      <div className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Vorlage waehlen</p>
                            <p className="text-sm text-slate-600">
                              Feed oder Story starten und dann eine bestehende Vorlage als Basis laden.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {releasedTemplateDrafts.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => applyTemplateToEditor(template.id)}
                              className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                            >
                              <p className="text-sm font-semibold text-slate-900">{template.title}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {template.draftType === "story" ? "Story" : "Feed"} ·{" "}
                                {getLayoutLabel(template.layout)}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        {editorIsTemplate ? "Vorlagenname" : "Titel"}
                      </span>
                      <input
                        value={editorIsTemplate ? editorTemplateName : editorTitle}
                        onChange={(event) => {
                          if (editorIsTemplate) {
                            setEditorTemplateName(event.target.value);
                          } else {
                            setEditorTitle(event.target.value);
                          }
                        }}
                        placeholder={
                          editorIsTemplate ? "Name der Vorlage" : "Name fuer dieses Posting (nur zur Uebersicht)"
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {editorIsTemplate
                          ? "Hier kannst du die Vorlage direkt umbenennen."
                          : "Der Titel dient nur der Uebersicht - Text im Bild selbst kannst du als Text-Ebene unten hinzufuegen."}
                      </p>
                    </label>

                    {isTrainerSocialUser ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Format
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {editorDraftType === "story" ? "Story" : "Feed"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Vorlage
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {getLayoutLabel(editorLayout)}
                          </p>
                        </div>
                      </div>
                    ) : (
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
                            {editorLayoutOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Assets</p>
                          <p className="text-sm text-slate-600">
                            Zentrales Bibliothekssystem mit Ordnern (Wappen, Logos, Bilder). Freie Ordnerstruktur.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                            <Plus size={16} />
                            Bilder lokal hochladen
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
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
                                      fileName: file.name,
                                    };
                                  });
                                  setEditorAssets((current) => [...current, ...mapped]);

                                  if (mapped.length > 0) {
                                    setEditorLayers((currentLayers) => {
                                      const layers: SocialMediaLayer[] = [];
                                      let activeRef = "";
                                      const initJobs: Array<{ layerId: string; assetUrl: string }> = [];
                                      for (const asset of mapped) {
                                        const baseLayer = createLayer("image", {
                                          imageRef: asset.ref,
                                          imageFileName: asset.fileName,
                                          label: asset.fileName,
                                        });
                                        layers.push(normalizeLayer(baseLayer));
                                        activeRef = baseLayer.id;
                                        initJobs.push({ layerId: baseLayer.id, assetUrl: asset.url });
                                      }
                                      if (layers.length > 0 && activeRef) {
                                        setActiveLayerId(activeRef);
                                      }
                                      setTimeout(() => {
                                        for (const job of initJobs) {
                                          void initializeImageLayerWithNaturalRatio(job.layerId, job.assetUrl);
                                        }
                                      }, 0);
                                      return [...currentLayers, ...layers];
                                    });
                                  }
                                  event.target.value = "";
                                }}
                              />
                            </label>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssetFolderId("__crests__");
                              setAssetLibraryOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                          >
                            <FolderKanban size={16} />
                            Asset-Bibliothek öffnen
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssetFolderId("__crests__");
                            setAssetLibraryOpen(true);
                          }}
                          className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 text-white shadow-sm">
                            <Shield size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              Wappen & Logos
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {socialMediaCrests.length} Elemente · Systemordner
                            </p>
                          </div>
                        </button>
                        {sortedAssetFolders.slice(0, 2).map((folder) => {
                          const count = socialMediaAssets.filter(
                            (asset) => asset.folderId === folder.id,
                          ).length;
                          return (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => {
                                setSelectedAssetFolderId(folder.id);
                                setAssetLibraryOpen(true);
                              }}
                              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                            >
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-sky-500 text-white shadow-sm">
                                <Folder size={20} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {folder.name}
                                </p>
                                <p className="truncate text-xs text-slate-500">{count} Elemente</p>
                              </div>
                            </button>
                          );
                        })}
                        {unassignedAssetCount > 0 && sortedAssetFolders.length < 2 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssetFolderId("__unassigned__");
                              setAssetLibraryOpen(true);
                            }}
                            className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                          >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-400 text-white shadow-sm">
                              <Archive size={20} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                Nicht zugeordnet
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {unassignedAssetCount} Elemente
                              </p>
                            </div>
                          </button>
                        ) : null}
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
                                  className={cn(
                                    "h-full w-full",
                                    isSharedCrestRef(asset.ref) ? "object-contain p-3" : "object-cover",
                                  )}
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
                                  disabled={editorLayers.some(
                                    (layer) =>
                                      layer.kind === "image" &&
                                      layer.imageRef === asset.ref &&
                                      isLayerProtected(layer),
                                  )}
                                  className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
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
              </div>

              <div className="order-2 xl:order-2 space-y-4">
                <SectionCard
                  title="Layer-Inspector"
                  description={
                    isTrainerSocialUser
                      ? "Inhalte, Position & Groesse der aktuell ausgewaehlten Ebene. Gesperrte Ebenen der Vorlage bleiben unveraenderlich."
                      : "Eigenschaften der aktuell ausgewaehlten Ebene."
                  }
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

                      {!isTrainerSocialUser ? (
                        <div className={`grid gap-4 ${activeLayer.kind === "image" || activeLayer.kind === "badge" || editorIsTemplate ? "md:grid-cols-2" : ""}`}>
                          {(activeLayer.kind === "image" || activeLayer.kind === "badge" || editorIsTemplate) ? (
                            <label className="block">
                              <span className="mb-2 block text-sm font-medium text-slate-700">
                                Ebenentyp
                              </span>
                              <select
                                value={activeLayer.kind}
                                onChange={(event) => {
                                  const kind = event.target.value as SocialMediaLayerKind;
                                  const layerDefaults = createLayer(kind);
                                  const geometryPatch =
                                    kind === "image"
                                      ? getDefaultImageGeometry({
                                          position: layerDefaults.position,
                                          style: layerDefaults.style,
                                        })
                                      : getDefaultTextGeometry({
                                          kind,
                                          position: layerDefaults.position,
                                        });
                                  updateLayer(activeLayer.id, {
                                    kind,
                                    style: layerDefaults.style,
                                    position: layerDefaults.position,
                                    fontFamily: layerDefaults.fontFamily,
                                    fontSize: layerDefaults.fontSize,
                                    textColor: layerDefaults.textColor,
                                    textAlign: layerDefaults.textAlign,
                                    textEffect: layerDefaults.textEffect,
                                    imageRef:
                                      kind === "image"
                                        ? activeLayer.imageRef ?? editorAssets[0]?.ref
                                        : undefined,
                                    text:
                                      kind === "image"
                                        ? ""
                                        : activeLayer.kind === "image"
                                          ? layerDefaults.text
                                          : activeLayer.text,
                                    ...geometryPatch,
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
                          ) : null}

                          <label className="block">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Position
                            </span>
                            <select
                              value={activeLayer.position}
                              disabled={activeLayerPositionLocked}
                              onChange={(event) => {
                                const position = event.target.value as SocialMediaLayerPosition;
                                if (activeLayer.kind === "image") {
                                  updateLayer(activeLayer.id, {
                                    position,
                                    ...getDefaultImageGeometry({
                                      position,
                                      style: activeLayer.style,
                                    }),
                                  });
                                  return;
                                }

                                updateLayer(activeLayer.id, {
                                  position,
                                  ...getDefaultTextGeometry({
                                    kind: activeLayer.kind,
                                    position,
                                  }),
                                });
                              }}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {(activeLayer.kind === "image"
                                ? positionOptions
                                : positionOptions.filter((o) => o.value !== "full")
                              ).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : (
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Position
                          </span>
                          <select
                            value={activeLayer.position}
                            disabled={activeLayerPositionLocked}
                            onChange={(event) => {
                              const position = event.target.value as SocialMediaLayerPosition;
                              if (activeLayer.kind === "image") {
                                updateLayer(activeLayer.id, {
                                  position,
                                  ...getDefaultImageGeometry({
                                    position,
                                    style: activeLayer.style,
                                  }),
                                });
                                return;
                              }

                              updateLayer(activeLayer.id, {
                                position,
                                ...getDefaultTextGeometry({
                                  kind: activeLayer.kind,
                                  position,
                                }),
                              });
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {(activeLayer.kind === "image"
                              ? positionOptions
                              : positionOptions.filter((o) => o.value !== "full")
                            ).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {editorIsTemplate ? (
                        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4">
                          <p className="text-sm font-semibold text-slate-900">Fixierung fuer Nutzer</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Gesperrte Elemente bleiben spaeter bei Feed oder Story erstellen fest.
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                              <input
                                type="checkbox"
                                checked={Boolean(activeLayer.lockPosition)}
                                onChange={(event) =>
                                  updateLayer(activeLayer.id, {
                                    lockPosition: event.target.checked,
                                  })
                                }
                                className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                              />
                              <span className="text-sm font-semibold text-slate-700">
                                Position fixieren
                              </span>
                            </label>

                            <label className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                              <input
                                type="checkbox"
                                checked={Boolean(activeLayer.lockSize)}
                                onChange={(event) =>
                                  updateLayer(activeLayer.id, {
                                    lockSize: event.target.checked,
                                  })
                                }
                                className="h-5 w-5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                              />
                              <span className="text-sm font-semibold text-slate-700">
                                Groesse fixieren
                              </span>
                            </label>
                          </div>
                        </div>
                      ) : activeLayerPositionLocked || activeLayerSizeLocked ? (
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                          <p className="font-semibold">Durch Vorlage festgelegt</p>
                          <p className="mt-1 text-xs text-emerald-800">
                            {activeLayerPositionLocked ? " Position ist gesperrt." : ""}
                            {activeLayerSizeLocked ? " Groesse ist gesperrt." : ""}
                            {!activeLayerPositionLocked ? " Position darf angepasst werden." : ""}
                            {!activeLayerSizeLocked ? " Groesse darf angepasst werden." : ""}
                          </p>
                        </div>
                      ) : null}

                      {!isTrainerSocialUser && (activeLayer.kind === "image" || activeLayer.kind === "badge" || editorIsTemplate) ? (
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
                      ) : null}

                      {activeLayer.kind === "image" ? (
                        <div className="space-y-4">
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

                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Bildgeometrie</p>
                                <p className="text-xs text-slate-500">
                                  {isTrainerSocialUser
                                    ? "Wenn nicht durch Vorlage gesperrt, kannst du in der Vorschau frei ziehen oder hier exakt einstellen."
                                    : "In der Vorschau frei ziehen oder hier exakt einstellen."}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  disabled={activeLayerPositionLocked || activeLayerSizeLocked}
                                  onClick={() => {
                                    const ratio = activeLayer.keepAspectRatio
                                      ? activeLayer.baseAspectRatio
                                      : undefined;
                                    updateLayer(activeLayer.id, {
                                      ...getDefaultImageGeometry({
                                        position: activeLayer.position,
                                        style: activeLayer.style,
                                      }),
                                      ...(ratio ? { keepAspectRatio: true, baseAspectRatio: ratio } : {}),
                                    });
                                  }}
                                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Zuruecksetzen
                                </button>
                                <button
                                  type="button"
                                  disabled={activeLayerSizeLocked}
                                  onClick={() => {
                                    const currentlyLocked = Boolean(activeLayer.keepAspectRatio);
                                    if (currentlyLocked) {
                                      updateLayer(activeLayer.id, { keepAspectRatio: false });
                                      return;
                                    }
                                    void lockImageLayerAspectRatio(activeLayer.id, activeLayer.imageRef);
                                  }}
                                  className={
                                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 " +
                                    (activeLayer.keepAspectRatio
                                      ? "border-blue-200 bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700"
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100")
                                  }
                                  title={
                                    activeLayer.keepAspectRatio
                                      ? "Seitenverhältnis entsperren – frei transformieren"
                                      : "Seitenverhältnis sperren – Breite & Höhe im Verhältnis halten"
                                  }
                                >
                                  {activeLayer.keepAspectRatio ? (
                                    <>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="4" y="10" width="16" height="11" rx="2.5" />
                                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                      </svg>
                                      Verhältnis gesperrt
                                    </>
                                  ) : (
                                    <>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="4" y="10" width="16" height="11" rx="2.5" />
                                        <path d="M8 10V7a4 4 0 0 1 7.5-1.8" />
                                        <path d="M13 4l1.8 1.8L17 4" />
                                      </svg>
                                      Verhältnis frei
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {(() => {
                              const geometry = getImageLayerGeometry(activeLayer);
                              const baseRatio =
                                activeLayer.baseAspectRatio ??
                                geometry.widthPercent / Math.max(geometry.heightPercent, 0.001);
                              const ratioLocked = Boolean(activeLayer.keepAspectRatio);

                              const controls = [
                                {
                                  key: "centerX",
                                  label: "Horizontal",
                                  value: geometry.centerX,
                                  min: 0,
                                  max: 100,
                                  kind: "position" as const,
                                },
                                {
                                  key: "centerY",
                                  label: "Vertikal",
                                  value: geometry.centerY,
                                  min: 0,
                                  max: 100,
                                  kind: "position" as const,
                                },
                                {
                                  key: "widthPercent",
                                  label: ratioLocked ? "Breite (Höhe folgt automatisch)" : "Breite",
                                  value: geometry.widthPercent,
                                  min: 2,
                                  max: 100,
                                  kind: "size" as const,
                                },
                                {
                                  key: "heightPercent",
                                  label: ratioLocked ? "Höhe (Breite folgt automatisch)" : "Hoehe",
                                  value: geometry.heightPercent,
                                  min: 2,
                                  max: 100,
                                  kind: "size" as const,
                                },
                              ] as const;

                              return (
                                <div className="space-y-3">
                                  {controls.map((control) => (
                                    <label key={control.key} className="block">
                                      <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                        <span>{control.label}</span>
                                        <span className="font-semibold text-slate-900">
                                          {Math.round(control.value)}%
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min={control.min}
                                        max={control.max}
                                        step={1}
                                        value={control.value}
                                        disabled={
                                          control.kind === "position"
                                            ? activeLayerPositionLocked
                                            : activeLayerSizeLocked
                                        }
                                        onChange={(event) => {
                                          const rawValue = Number(event.target.value);
                                          if (control.kind === "position") {
                                            updateLayer(activeLayer.id, {
                                              [control.key]: rawValue,
                                            } as Partial<SocialMediaLayer>);
                                            return;
                                          }
                                          if (!ratioLocked) {
                                            updateLayer(activeLayer.id, {
                                              [control.key]: rawValue,
                                            } as Partial<SocialMediaLayer>);
                                            return;
                                          }
                                          if (control.key === "widthPercent") {
                                            const nextWidth = rawValue;
                                            const nextHeight = Math.max(
                                              2,
                                              Math.min(100, Math.round(nextWidth / baseRatio)),
                                            );
                                            const clampedWidth =
                                              Math.max(
                                                2,
                                                Math.min(100, Math.round(nextHeight * baseRatio)),
                                              ) ?? nextWidth;
                                            updateLayer(activeLayer.id, {
                                              widthPercent: clampedWidth,
                                              heightPercent: nextHeight,
                                            });
                                          } else {
                                            const nextHeight = rawValue;
                                            const nextWidth = Math.max(
                                              2,
                                              Math.min(100, Math.round(nextHeight * baseRatio)),
                                            );
                                            const clampedHeight =
                                              Math.max(
                                                2,
                                                Math.min(100, Math.round(nextWidth / baseRatio)),
                                              ) ?? nextHeight;
                                            updateLayer(activeLayer.id, {
                                              widthPercent: nextWidth,
                                              heightPercent: clampedHeight,
                                            });
                                          }
                                        }}
                                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </label>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
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

                          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Textfeld</p>
                                <p className="text-xs text-slate-500">
                                  {isTrainerSocialUser
                                    ? "Wenn nicht durch Vorlage gesperrt, kannst du in der Vorschau frei ziehen oder hier exakt ausrichten."
                                    : "In der Vorschau frei ziehen oder hier exakt ausrichten."}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={activeLayerPositionLocked || activeLayerSizeLocked}
                                onClick={() =>
                                  updateLayer(activeLayer.id, {
                                    ...getDefaultTextGeometry({
                                      kind: activeLayer.kind,
                                      position: activeLayer.position,
                                    }),
                                    ...getDefaultTextAppearance(activeLayer),
                                  })
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Zuruecksetzen
                              </button>
                            </div>

                            {(() => {
                              const geometry = getTextLayerGeometry(activeLayer);
                              const baseDefaults = getDefaultTextGeometry(activeLayer);
                              const appearance = getDefaultTextAppearance(activeLayer);
                              const baseScaleWidth = baseDefaults.widthPercent;
                              const baseScaleHeight = baseDefaults.heightPercent;
                              const currentScale = geometry.widthPercent / baseScaleWidth;

                              const handleResizeProportional = (newWidthPercent: number) => {
                                const scale = clamp(newWidthPercent / baseScaleWidth, 0.25, 6);
                                const ratio = scale / Math.max(currentScale, 0.0001);
                                const widthPercent = clamp(baseScaleWidth * scale, 18, 100);
                                const heightPercent = clamp(baseScaleHeight * scale, 6, 80);
                                const fontSize = clamp(
                                  Math.round(
                                    (activeLayer.fontSize ?? appearance.fontSize) * ratio,
                                  ),
                                  10,
                                  480,
                                );
                                const letterSpacing = Math.round(
                                  ((activeLayer.letterSpacing ?? appearance.letterSpacing) * ratio) *
                                    100,
                                ) / 100;
                                updateLayer(activeLayer.id, {
                                  widthPercent,
                                  heightPercent,
                                  fontSize,
                                  letterSpacing,
                                });
                              };

                              const controls = [
                                {
                                  key: "centerX",
                                  label: "Horizontal",
                                  value: geometry.centerX,
                                  min: geometry.widthPercent / 2,
                                  max: 100 - geometry.widthPercent / 2,
                                  kind: "position" as const,
                                },
                                {
                                  key: "centerY",
                                  label: "Vertikal",
                                  value: geometry.centerY,
                                  min: geometry.heightPercent / 2,
                                  max: 100 - geometry.heightPercent / 2,
                                  kind: "position" as const,
                                },
                                {
                                  key: "widthPercent",
                                  label: "Skalierung (Groesse)",
                                  value: geometry.widthPercent,
                                  min: 18,
                                  max: 100,
                                  kind: "size" as const,
                                },
                              ] as const;

                              return (
                                <div className="space-y-3">
                                  {controls.map((control) => (
                                    <label key={control.key} className="block">
                                      <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                        <span>{control.label}</span>
                                        <span className="font-semibold text-slate-900">
                                          {control.kind === "size"
                                            ? `x${(geometry.widthPercent / baseScaleWidth).toFixed(2)}`
                                            : `${Math.round(control.value)}%`}
                                        </span>
                                      </div>
                                      <input
                                        type="range"
                                        min={control.min}
                                        max={control.max}
                                        step={1}
                                        value={control.value}
                                        disabled={
                                          control.kind === "position"
                                            ? activeLayerPositionLocked
                                            : activeLayerSizeLocked
                                        }
                                        onChange={(event) => {
                                          const value = Number(event.target.value);
                                          if (control.kind === "size") {
                                            handleResizeProportional(value);
                                          } else {
                                            updateLayer(activeLayer.id, {
                                              [control.key]: value,
                                            } as Partial<SocialMediaLayer>);
                                          }
                                        }}
                                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </label>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {!isTrainerSocialUser ? (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-semibold text-slate-900">Schrift</p>
                                <p className="text-xs text-slate-500">
                                  Schriftart, Groesse und Farbe fuer diese Textebene.
                                </p>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block">
                                  <span className="mb-2 block text-sm font-medium text-slate-700">
                                    Ausrichtung
                                  </span>
                                  <select
                                    value={
                                      activeLayer.textAlign ?? getDefaultTextAppearance(activeLayer).textAlign
                                    }
                                    onChange={(event) =>
                                      updateLayer(activeLayer.id, {
                                        textAlign: event.target.value as SocialMediaTextAlign,
                                      })
                                    }
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                  >
                                    <option value="left">Links</option>
                                    <option value="center">Mittig</option>
                                    <option value="right">Rechts</option>
                                  </select>
                                </label>

                                <label className="block">
                                  <span className="mb-2 block text-sm font-medium text-slate-700">
                                    Effekt
                                  </span>
                                  <select
                                    value={
                                      activeLayer.textEffect ?? getDefaultTextAppearance(activeLayer).textEffect
                                    }
                                    onChange={(event) =>
                                      updateLayer(activeLayer.id, {
                                        textEffect: event.target.value as SocialMediaTextEffect,
                                      })
                                    }
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                  >
                                    <option value="none">Kein Effekt</option>
                                    <option value="shadow">Schatten</option>
                                    <option value="outline">Kontur</option>
                                  </select>
                                </label>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                                Schatten verbessert die Lesbarkeit auf Fotos. Kontur eignet sich gut fuer helle oder unruhige Bildbereiche.
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <label className="block">
                                  <span className="mb-2 block text-sm font-medium text-slate-700">
                                    Schriftart
                                  </span>
                                  <select
                                    value={
                                      activeLayer.fontFamily ?? getDefaultTextAppearance(activeLayer).fontFamily
                                    }
                                    onChange={(event) =>
                                      updateLayer(activeLayer.id, {
                                        fontFamily: event.target.value,
                                      })
                                    }
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                  >
                                    {fontOptions.map((option) => (
                                      <option key={`${option.source}-${option.value}`} value={option.value}>
                                        {option.label}
                                        {option.source === "uploaded" ? " (hochgeladen)" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <div className="mt-4 space-y-4">

                                <label className="block">
                                  <span className="mb-2 block text-sm font-medium text-slate-700">
                                    Schriftfarbe
                                  </span>
                                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-slate-300">
                                    <label
                                      htmlFor={`text-color-${activeLayer.id}`}
                                      className="group flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                                      title="Klicken zum Oeffnen des Farbwaehlers"
                                    >
                                      <span
                                        className="h-7 w-7 rounded-lg border border-slate-300 shadow-inner transition group-hover:scale-105"
                                        style={{
                                          backgroundColor:
                                            activeLayer.textColor ??
                                            getDefaultTextAppearance(activeLayer).textColor,
                                        }}
                                      />
                                      <Droplet size={16} className="text-blue-700" />
                                      <span>Farbe wählen</span>
                                    </label>
                                    <input
                                      id={`text-color-${activeLayer.id}`}
                                      type="color"
                                      value={
                                        activeLayer.textColor ?? getDefaultTextAppearance(activeLayer).textColor
                                      }
                                      onChange={(event) =>
                                        updateLayer(activeLayer.id, {
                                          textColor: event.target.value,
                                        })
                                      }
                                      className="sr-only h-0 w-0"
                                    />
                                    <input
                                      value={
                                        activeLayer.textColor ?? getDefaultTextAppearance(activeLayer).textColor
                                      }
                                      onChange={(event) =>
                                        updateLayer(activeLayer.id, {
                                          textColor: event.target.value,
                                        })
                                      }
                                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm uppercase outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                  </div>
                                </label>

                                <label className="block">
                                  <span className="mb-2 block text-sm font-medium text-slate-700">
                                    Konturfarbe
                                  </span>
                                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-slate-300">
                                    <label
                                      htmlFor={`stroke-color-${activeLayer.id}`}
                                      className="group flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98]"
                                      title="Klicken zum Oeffnen des Farbwaehlers"
                                    >
                                      <span
                                        className="h-7 w-7 rounded-lg border border-slate-300 shadow-inner transition group-hover:scale-105"
                                        style={{
                                          backgroundColor:
                                            activeLayer.strokeColor ??
                                            getDefaultTextAppearance(activeLayer).strokeColor,
                                        }}
                                      />
                                      <Droplet size={16} className="text-slate-700" />
                                      <span>Farbe wählen</span>
                                    </label>
                                    <input
                                      id={`stroke-color-${activeLayer.id}`}
                                      type="color"
                                      value={
                                        activeLayer.strokeColor ?? getDefaultTextAppearance(activeLayer).strokeColor
                                      }
                                      onChange={(event) =>
                                        updateLayer(activeLayer.id, {
                                          strokeColor: event.target.value,
                                        })
                                      }
                                      className="sr-only h-0 w-0"
                                    />
                                    <input
                                      value={
                                        activeLayer.strokeColor ?? getDefaultTextAppearance(activeLayer).strokeColor
                                      }
                                      onChange={(event) =>
                                        updateLayer(activeLayer.id, {
                                          strokeColor: event.target.value,
                                        })
                                      }
                                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm uppercase outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                    />
                                  </div>
                                </label>

                                <label className="block">
                                  <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                    <span>Konturstärke</span>
                                    <span className="font-semibold text-slate-900">
                                      {(activeLayer.strokeWidth ?? getDefaultTextAppearance(activeLayer).strokeWidth).toFixed(1)}
                                      px
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={10}
                                    step={0.1}
                                    value={activeLayer.strokeWidth ?? getDefaultTextAppearance(activeLayer).strokeWidth}
                                    onChange={(event) =>
                                      updateLayer(activeLayer.id, {
                                        strokeWidth: Number(event.target.value),
                                      })
                                    }
                                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700"
                                  />
                                </label>
                              </div>

                              <label className="mt-4 block">
                                <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                  <span>Schriftgroesse</span>
                                  <span className="font-semibold text-slate-900">
                                    {Math.round(
                                      activeLayer.fontSize ?? getDefaultTextAppearance(activeLayer).fontSize,
                                    )}
                                    px
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={10}
                                  max={480}
                                  step={1}
                                  value={
                                    activeLayer.fontSize ?? getDefaultTextAppearance(activeLayer).fontSize
                                  }
                                  onChange={(event) =>
                                    updateLayer(activeLayer.id, {
                                      fontSize: Number(event.target.value),
                                    })
                                  }
                                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700"
                                />
                              </label>

                              {(activeLayer.kind === "badge" || editorIsTemplate) ? (
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <label className="block">
                                    <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                      <span>Zeilenabstand</span>
                                      <span className="font-semibold text-slate-900">
                                        {(activeLayer.lineHeight ?? getDefaultTextAppearance(activeLayer).lineHeight).toFixed(2)}
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0.8}
                                      max={3}
                                      step={0.05}
                                      value={activeLayer.lineHeight ?? getDefaultTextAppearance(activeLayer).lineHeight}
                                      onChange={(event) =>
                                        updateLayer(activeLayer.id, {
                                          lineHeight: Number(event.target.value),
                                        })
                                      }
                                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700"
                                    />
                                  </label>

                                  <label className="block">
                                    <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                      <span>Laufweite</span>
                                      <span className="font-semibold text-slate-900">
                                        {(activeLayer.letterSpacing ?? getDefaultTextAppearance(activeLayer).letterSpacing).toFixed(0)}
                                        px
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={-10}
                                      max={80}
                                      step={0.5}
                                      value={activeLayer.letterSpacing ?? getDefaultTextAppearance(activeLayer).letterSpacing}
                                      onChange={(event) =>
                                        updateLayer(activeLayer.id, {
                                          letterSpacing: Number(event.target.value),
                                        })
                                      }
                                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700"
                                    />
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <label className="block">
                                <span className="mb-2 block text-sm font-medium text-slate-700">
                                  Schriftart
                                </span>
                                <select
                                  value={
                                    activeLayer.fontFamily ??
                                    getDefaultTextAppearance(activeLayer).fontFamily
                                  }
                                  onChange={(event) =>
                                    updateLayer(activeLayer.id, { fontFamily: event.target.value })
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                  {fontOptions.map((option) => (
                                    <option key={`${option.source}-${option.value}`} value={option.value}>
                                      {option.label}
                                      {option.source === "uploaded" ? " (hochgeladen)" : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="block">
                                  <span className="mb-2 block text-sm font-medium text-slate-700">
                                    Schriftfarbe
                                  </span>
                                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
                                    <label
                                      htmlFor={`text-color-poster-${activeLayer.id}`}
                                      className="relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 shadow-inner transition hover:scale-105"
                                      style={{
                                        backgroundColor:
                                          activeLayer.textColor ??
                                          getDefaultTextAppearance(activeLayer).textColor,
                                      }}
                                      title="Farbwaehler oeffnen"
                                    >
                                      <Droplet size={16} className="drop-shadow text-white mix-blend-difference" />
                                      <input
                                        id={`text-color-poster-${activeLayer.id}`}
                                        type="color"
                                        value={
                                          activeLayer.textColor ??
                                          getDefaultTextAppearance(activeLayer).textColor
                                        }
                                        onChange={(event) =>
                                          updateLayer(activeLayer.id, {
                                            textColor: event.target.value,
                                          })
                                        }
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                      />
                                    </label>
                                    <div className="relative flex-1">
                                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                        #
                                      </span>
                                      <input
                                        value={(
                                          activeLayer.textColor ??
                                          getDefaultTextAppearance(activeLayer).textColor
                                        ).replace(/^#/, "")}
                                        onChange={(event) => {
                                          const raw = event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                                          updateLayer(activeLayer.id, {
                                            textColor: raw ? `#${raw.toUpperCase()}` : "#FFFFFF",
                                          });
                                        }}
                                        maxLength={6}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-8 pr-3 font-mono text-sm uppercase tracking-widest outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        placeholder="FFFFFF"
                                      />
                                    </div>
                                  </div>
                                </label>

                                <label className="block">
                                  <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-700">
                                    <span>Schriftgroesse</span>
                                    <span className="font-semibold text-slate-900">
                                      {Math.round(
                                      activeLayer.fontSize ?? getDefaultTextAppearance(activeLayer).fontSize,
                                    )}
                                    px
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={10}
                                  max={240}
                                  step={1}
                                  value={
                                    activeLayer.fontSize ?? getDefaultTextAppearance(activeLayer).fontSize
                                  }
                                  onChange={(event) =>
                                    updateLayer(activeLayer.id, {
                                      fontSize: Number(event.target.value),
                                    })
                                  }
                                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700"
                                />
                              </label>
                              </div>
                            </div>
                          )}
                        </div>
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

              <div className="order-1 xl:order-3 space-y-4">
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
                    onUpdateLayer={updateLayer}
                    respectLayerLocks={respectEditorLayerLocks}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {editorIsTemplate
                      ? "Im Vorlagenmodus legst du fest, welche Elemente spaeter fuer Nutzer fest bleiben."
                      : isTrainerSocialUser
                        ? "Nicht-gesperrte Ebenen (ohne VORLAGE-Schild) kannst du direkt in der Vorschau ziehen, groesser/kleiner machen und in der Reihenfolge per Drag & Drop sortieren. Gesperrte Vorlagen-Elemente bleiben fest."
                        : "Freie Bild-Layer lassen sich direkt in der Vorschau ziehen. Fixierte Elemente bleiben an ihrer Position und Groesse gesperrt. Ebenen unter der Vorschau per Drag & Drop neu ordnen."}
                  </p>
                </SectionCard>

                <SectionCard
                  title="Ebenen"
                  description={
                    isTrainerSocialUser
                      ? "Reihenfolge bestimmt, was vorne oder hinten liegt. Ebene einfach per Drag & Drop auf eine andere Position ziehen. Nicht-gesperrte Ebenen kannst du frei verschieben und in der Groesse anpassen."
                      : "Reihenfolge bestimmt, was vorne oder hinten liegt. Ebene einfach per Drag & Drop auf eine andere Position ziehen. Schnellschalter direkt unter der Vorschau."
                  }
                  actions={
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => addLayer("image")}
                        disabled={editorAssets.length === 0}
                        title={
                          editorAssets.length === 0
                            ? "Zuerst unten ein Bild lokal hochladen (Assets -> Bilder lokal hochladen) oder aus Bibliothek laden."
                            : "Bild-Ebene aus bereits geladenen Assets hinzufuegen"
                        }
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ImageIcon size={15} />
                        Bild
                      </button>
                      <button
                        type="button"
                        onClick={() => addLayer("caption")}
                        title="Text-Ebene hinzufuegen"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Type size={15} />
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => addLayer("badge")}
                        title="Badge / Label-Ebene hinzufuegen"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <SquareStack size={15} />
                        Badges
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    {editorLayers.map((layer, index) => {
                      let subtitle = "";
                      let displayLabel = layer.label;
                      if (layer.kind === "image") {
                        const asset = editorAssets.find((entry) => entry.ref === layer.imageRef);
                        const resolvedFileName =
                          layer.imageFileName ??
                          asset?.fileName ??
                          (layer.imageRef ? getFileNameFromUrl(layer.imageRef, "Bild") : "Bild");
                        displayLabel =
                          !layer.label || layer.label === "Bild" ? resolvedFileName : layer.label;
                        subtitle = resolvedFileName;
                      } else {
                        subtitle = resolveLayerText(layer) || "Ohne Text";
                      }
                      const isLockedForPoster =
                        isTrainerSocialUser &&
                        (Boolean(layer.lockPosition) || Boolean(layer.lockSize));
                      const isDragging = draggedLayerId === layer.id;
                      const isDragOver = dragOverLayerId === layer.id && !isDragging;
                      return (
                        <div
                          key={layer.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggedLayerId(layer.id);
                            event.dataTransfer.effectAllowed = "move";
                            try {
                              event.dataTransfer.setData("text/plain", layer.id);
                            } catch {}
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            if (dragOverLayerId !== layer.id) {
                              setDragOverLayerId(layer.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverLayerId === layer.id) {
                              setDragOverLayerId(null);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (draggedLayerId && draggedLayerId !== layer.id) {
                              reorderLayer(draggedLayerId, layer.id);
                            }
                            setDraggedLayerId(null);
                            setDragOverLayerId(null);
                          }}
                          onDragEnd={() => {
                            setDraggedLayerId(null);
                            setDragOverLayerId(null);
                          }}
                          className={cn(
                            "rounded-2xl border p-3 transition select-none",
                            isDragging && "opacity-40 scale-95",
                            isDragOver &&
                              "border-blue-400 bg-blue-50 ring-2 ring-blue-300 ring-offset-2 ring-offset-white -translate-y-0.5",
                            !isDragging &&
                              !isDragOver &&
                              (activeLayer?.id === layer.id
                                ? "border-blue-300 bg-blue-50/70"
                                : "border-slate-200 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-300"),
                          )}
                          style={{ cursor: "grab" }}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveLayerId(layer.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              draggable={false}
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
                                  {displayLabel}
                                </p>
                                <p
                                  className="truncate text-xs text-slate-500"
                                  title={subtitle}
                                >
                                  {subtitle}
                                  {isLockedForPoster ? (
                                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                      <Shield size={10} />
                                      Vorlage
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                            </button>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateLayer(layer.id, { enabled: !layer.enabled })
                                }
                                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                                title={layer.enabled ? "Ebene ausblenden" : "Ebene einblenden"}
                              >
                                {layer.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLayer(layer.id, -1)}
                                disabled={index === 0}
                                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Eine Ebene nach vorne"
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLayer(layer.id, 1)}
                                disabled={index === editorLayers.length - 1}
                                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Eine Ebene nach hinten"
                              >
                                <ArrowDown size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLayer(layer.id)}
                                disabled={isLayerProtected(layer)}
                                title={
                                  isLayerProtected(layer)
                                    ? "Vorlagen-Ebene kann nicht geloescht werden."
                                    : "Ebene loeschen"
                                }
                                className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                {!editorIsTemplate ? (
                  <SectionCard
                    title="Posting Text & Hashtags"
                    description="Der Text steht spaeter unter dem Bild. Hashtags werden automatisch mit # gespeichert."
                  >
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Text unter dem Posting
                        </span>
                        <textarea
                          value={editorPostingText}
                          onChange={(event) => setEditorPostingText(event.target.value)}
                          rows={5}
                          placeholder="z.B. Heute geht es endlich wieder los! Wir freuen uns auf einen spannenden Spieltag gegen unseren Gegner..."
                          className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                      </label>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-700">
                            Hashtags (bis 5 Stueck)
                          </span>
                          <span className="text-xs text-slate-500">
                            {editorHashtags.filter((entry) => entry.trim().length > 0).length}/5
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {editorHashtags.map((value, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100"
                            >
                              <span className="text-sm font-semibold text-blue-700">#</span>
                              <input
                                type="text"
                                value={value}
                                maxLength={60}
                                placeholder={`Hashtag ${index + 1}`}
                                onChange={(event) => {
                                  const clean = event.target.value
                                    .replace(/^#+/g, "")
                                    .replace(/[^a-zA-Z0-9ÄÖÜäöüß_]/g, "");
                                  setEditorHashtags((current) =>
                                    current.map((entry, idx) => (idx === index ? clean : entry)),
                                  );
                                }}
                                className="flex-1 bg-transparent text-sm text-slate-900 outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                ) : null}

                <div className="sticky bottom-0 z-20 mt-6 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mt-0 md:border-t-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0 flex flex-wrap gap-3">
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
                      const layersPayload = editorLayers.map((layer) => {
                        const normalizedLayer = normalizeLayer(layer);
                        return {
                          ...normalizedLayer,
                          imageRef: normalizedLayer.imageRef
                            ? (placeholderByRef.get(normalizedLayer.imageRef) ?? normalizedLayer.imageRef)
                            : undefined,
                        };
                      });
                      const title = editorIsTemplate
                        ? editorTemplateName.trim()
                        : editorTitle.trim();
                      const subtitle = getFirstLayerText(layersPayload, "subtitle");
                      const caption = getFirstLayerText(layersPayload, "caption");
                      const callToAction = getFirstLayerText(layersPayload, "cta");
                      const normalizedHashtags = editorHashtags
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0)
                        .slice(0, 5);

                      if (editorIsTemplate) {
                        if (!editorTemplateName.trim()) {
                          setError("Bitte gib einen Vorlagennamen ein.");
                          return;
                        }
                        if (layersPayload.length === 0) {
                          setError("Bitte mindestens eine Ebene anlegen, bevor die Vorlage gespeichert wird.");
                          return;
                        }
                      } else if (!title) {
                        setError("Bitte gib einen Titel fuer das Posting ein.");
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
                              isTemplate: editorIsTemplate,
                              postingText: editorPostingText,
                              hashtags: normalizedHashtags,
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
                              isTemplate: editorIsTemplate,
                              postingText: editorPostingText,
                              hashtags: normalizedHashtags,
                            });

                      if (!result.success) {
                        setError(
                          result.error ??
                            (editorIsTemplate
                              ? "Vorlage konnte nicht gespeichert werden."
                              : "Entwurf konnte nicht gespeichert werden."),
                        );
                        setDraftSubmitting(false);
                        return;
                      }

                      setSuccess(
                        editorIsTemplate
                          ? editorMode === "create"
                            ? "Vorlage wurde gespeichert."
                            : "Vorlage wurde aktualisiert."
                          : editorMode === "create"
                            ? "Entwurf wurde gespeichert."
                            : "Entwurf wurde aktualisiert.",
                      );
                      setEditorOpen(false);
                      resetDraftEditor();
                      setDraftSubmitting(false);
                    }}
                    className="rounded-2xl border border-slate-300 bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {draftSubmitting
                      ? "Speichert..."
                      : editorIsTemplate
                        ? editorMode === "create"
                          ? "Vorlage speichern"
                          : "Vorlage aktualisieren"
                        : editorMode === "create"
                          ? "Als Entwurf speichern"
                          : "Als Entwurf aktualisieren"}
                  </button>

                  {!editorIsTemplate ? (
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
                        const layersPayload = editorLayers.map((layer) => {
                          const normalizedLayer = normalizeLayer(layer);
                          return {
                            ...normalizedLayer,
                            imageRef: normalizedLayer.imageRef
                              ? (placeholderByRef.get(normalizedLayer.imageRef) ?? normalizedLayer.imageRef)
                              : undefined,
                          };
                        });
                        const title = editorTitle.trim();
                        const subtitle = getFirstLayerText(layersPayload, "subtitle");
                        const caption = getFirstLayerText(layersPayload, "caption");
                        const callToAction = getFirstLayerText(layersPayload, "cta");
                        const normalizedHashtags = editorHashtags
                          .map((entry) => entry.trim())
                          .filter((entry) => entry.length > 0)
                          .slice(0, 5);

                        if (!title) {
                          setError("Bitte gib einen Titel fuer das Posting ein.");
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
                                isTemplate: false,
                                postingText: editorPostingText,
                                hashtags: normalizedHashtags,
                                status: "submitted",
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
                                isTemplate: false,
                                postingText: editorPostingText,
                                hashtags: normalizedHashtags,
                                status: "submitted",
                                setAdminNotified: true,
                              });

                        if (!result.success) {
                          setError(
                            result.error ?? "Posting konnte nicht eingereicht werden.",
                          );
                          setDraftSubmitting(false);
                          return;
                        }

                        setSuccess(
                          editorMode === "create"
                            ? "Posting erfolgreich eingereicht! Es liegt jetzt im Postfach von Vorstand und Admin."
                            : "Aenderungen wurden erfolgreich eingereicht. Posting liegt wieder im Postfach.",
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
                          ? "Posting einreichen"
                          : "Aenderungen einreichen"}
                    </button>
                  ) : null}
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

      {assetLibraryOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-start md:items-center bg-slate-950/75 p-0 md:p-4 backdrop-blur-sm"
          onClick={() => !assetLibraryBusy && setAssetLibraryOpen(false)}
        >
          <div
            className={cn(
              "flex h-full md:h-[90vh] w-full max-w-6xl flex-col overflow-hidden md:rounded-[2rem] bg-white shadow-2xl",
              assetLibraryBusy && "pointer-events-none opacity-80",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-6 md:static">
              <div className="min-w-0">
                <p className="truncate text-base md:text-lg font-bold text-slate-900">Asset-Bibliothek</p>
                <p className="mt-0.5 line-clamp-2 text-xs md:text-sm text-slate-600">
                  Ordner und Assets verwalten · 1 Klick ins Layout einfügen
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssetLibraryOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label="Schliessen"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_1fr] gap-0">
              <div className="flex md:min-h-0 flex-row md:flex-col border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 md:bg-slate-50">
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:flex-1 p-3 md:p-4 -mx-4 md:mx-0 px-4 md:px-0 shrink-0 md:shrink whitespace-nowrap md:whitespace-normal">
                  <ul className="flex md:block md:space-y-2 gap-2 items-center md:items-stretch">
                    <li>
                      <button
                        type="button"
                        onClick={() => setSelectedAssetFolderId("__crests__")}
                        title="Wappen & Logos · Systemordner"
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition",
                          selectedAssetFolderId === "__crests__"
                            ? "bg-gradient-to-br from-blue-900 to-blue-700 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white hover:shadow-sm",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            selectedAssetFolderId === "__crests__"
                              ? "bg-white/15 text-white"
                              : "bg-gradient-to-br from-blue-900 to-blue-700 text-white",
                          )}
                        >
                          <Shield size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-[0.95rem] font-bold leading-tight">Wappen &amp; Logos</p>
                          <p
                            className={cn(
                              "mt-0.5 text-[11px]",
                              selectedAssetFolderId === "__crests__" ? "text-white/80" : "text-slate-500",
                            )}
                          >
                            {socialMediaCrests.length} Elemente · Systemordner
                          </p>
                        </div>
                      </button>
                    </li>
                    {sortedAssetFolders.map((folder) => {
                      const count = socialMediaAssets.filter(
                        (asset) => asset.folderId === folder.id,
                      ).length;
                      const folderLabel = `${folder.name} · ${count} Elemente`;
                      return (
                        <li key={folder.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAssetFolderId(folder.id)}
                            title={folderLabel}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition",
                              selectedAssetFolderId === folder.id
                                ? "bg-gradient-to-br from-sky-700 to-sky-600 text-white shadow-sm"
                                : "text-slate-700 hover:bg-white hover:shadow-sm",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                selectedAssetFolderId === folder.id
                                  ? "bg-white/15 text-white"
                                  : "bg-gradient-to-br from-sky-600 to-sky-500 text-white",
                              )}
                            >
                              <Folder size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 break-words text-[0.95rem] font-bold leading-tight">
                                {folder.name}
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 text-[11px]",
                                  selectedAssetFolderId === folder.id ? "text-white/80" : "text-slate-500",
                                )}
                              >
                                {count} Elemente
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                    <li>
                      <button
                        type="button"
                        onClick={() => setSelectedAssetFolderId("__unassigned__")}
                        title="Nicht zugeordnet · Assets ohne Ordner"
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition",
                          selectedAssetFolderId === "__unassigned__"
                            ? "bg-slate-700 text-white shadow-sm"
                            : "text-slate-700 hover:bg-white hover:shadow-sm",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            selectedAssetFolderId === "__unassigned__"
                              ? "bg-white/15 text-white"
                              : "bg-slate-500 text-white",
                          )}
                        >
                          <Archive size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 break-words text-[0.95rem] font-bold leading-tight">Nicht zugeordnet</p>
                          <p
                            className={cn(
                              "text-[11px]",
                              selectedAssetFolderId === "__unassigned__" ? "text-white/75" : "text-slate-500",
                            )}
                          >
                            {unassignedAssetCount} Elemente
                          </p>
                        </div>
                      </button>
                    </li>
                  </ul>
                </div>

                {canManageSocial ? (
                  <div className="space-y-2 border-t border-slate-200 bg-white p-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      Neuer Ordner (Admin / Vorstand)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAssetFolderName}
                        onChange={(event) => setNewAssetFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateAssetFolder();
                          }
                        }}
                        placeholder="z. B. Spielpläne"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateAssetFolder()}
                        disabled={newAssetFolderBusy || !newAssetFolderName.trim()}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                        aria-label="Ordner anlegen"
                      >
                        <FolderPlus size={16} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 md:px-6 md:py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{selectedAssetFolderName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {selectedAssetFolderId === "__crests__"
                        ? `${socialMediaCrests.length} gespeicherte Wappen / Logos`
                        : `${visibleLibraryAssets.length} Assets im Ordner`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedAssetFolderId !== "__crests__" ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 min-h-11 rounded-xl border border-slate-200 bg-white px-3 md:px-4 py-2 text-xs md:text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        <Upload size={16} />
                        <span className="truncate">{canManageSocial ? "Hochladen" : "Bilder hochladen"}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            event.target.value = "";
                            void handleUploadAssetsToFolder(files);
                          }}
                        />
                      </label>
                    ) : null}
                    {canManageSocial &&
                    selectedAssetFolderId !== "__crests__" &&
                    selectedAssetFolderId !== "__unassigned__" ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteAssetFolder()}
                        className="inline-flex items-center gap-2 min-h-11 rounded-xl border border-rose-200 bg-white px-3 md:px-4 py-2 text-xs md:text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        <Trash2 size={16} />
                        <span className="truncate">Ordner loeschen</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-5">
                  {selectedAssetFolderId === "__crests__" ? (
                    socialMediaCrests.length ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 md:grid-cols-3 xl:grid-cols-4">
                        {socialMediaCrests.map((crest) => {
                          const isUsed = editorAssets.some(
                            (asset) => asset.ref === crest.imageUrl,
                          );
                          return (
                            <button
                              type="button"
                              key={crest.id}
                              onClick={() => {
                                addSharedAssetToEditor(crest.imageUrl, crest.id);
                                setAssetLibraryOpen(false);
                              }}
                              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-[0.99]"
                            >
                              <div className="flex min-h-36 md:h-32 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-3">
                                <img
                                  src={crest.imageUrl}
                                  alt={crest.name || "Wappen"}
                                  className="max-h-full max-w-full object-contain transition duration-200 group-hover:scale-110"
                                />
                              </div>
                              <div className="mt-auto border-t border-slate-200 p-3">
                                <div className="mb-3 min-h-[3rem]">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {crest.name || "Wappen / Logo"}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {isUsed ? "✓ Bereits im Asset-Pool" : "Systemordner (Wappen)"}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition",
                                    isUsed
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-gradient-to-br from-blue-900 to-blue-700 text-white group-hover:opacity-95",
                                  )}
                                >
                                    {isUsed ? (
                                      <>
                                        <Check size={16} />
                                        Bereits da
                                      </>
                                    ) : (
                                      <>
                                        <Plus size={18} />
                                        Hinzufuegen
                                      </>
                                    )}
                                  </div>
                                {canManageSocial ? (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleDeleteAsset(crest.id, crest.name || "Wappen", "crest");
                                      }}
                                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                                    >
                                      <Trash2 size={14} />
                                      Loeschen
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 text-white shadow-sm">
                          <Shield size={28} />
                        </div>
                        <p className="text-base font-semibold text-slate-900">
                          Noch keine Wappen / Logos gespeichert
                        </p>
                        <p className="text-sm text-slate-600">
                          Gehe in die Verwaltung (Admin / Vorstand), um Wappen & Logos hinzuzufügen.
                        </p>
                      </div>
                    )
                  ) : visibleLibraryAssets.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 md:grid-cols-3 xl:grid-cols-4">
                      {visibleLibraryAssets.map((asset) => {
                        const isUsed = editorAssets.some(
                          (existing) => existing.ref === asset.imageUrl,
                        );
                        const canDeleteAsset =
                          canManageSocial || asset.createdBy === currentUserId;
                        return (
                          <button
                            type="button"
                            key={asset.id}
                            onClick={() => {
                              addSharedAssetToEditor(asset.imageUrl, asset.name);
                              setAssetLibraryOpen(false);
                            }}
                            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-[0.99]"
                          >
                            <div className="min-h-40 md:h-32 overflow-hidden bg-slate-50">
                              <img
                                src={asset.imageUrl}
                                alt={asset.name || "Asset"}
                                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                              />
                            </div>
                            <div className="mt-auto space-y-2 border-t border-slate-200 p-3">
                              <div className="mb-3 min-h-[3rem]">
                                <p className="truncate text-sm font-bold text-slate-900">
                                  {asset.name || "Bild-Asset"}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500">
                                  {isUsed
                                    ? "✓ Bereits im Asset-Pool"
                                    : sellerName(asset.createdBy)}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition",
                                  isUsed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gradient-to-br from-blue-900 to-blue-700 text-white group-hover:opacity-95",
                                )}
                              >
                                {isUsed ? (
                                  <>
                                    <Check size={16} />
                                    Bereits da
                                  </>
                                ) : (
                                  <>
                                    <Plus size={18} />
                                    Hinzufuegen
                                  </>
                                )}
                              </div>
                              {canDeleteAsset ? (
                                <div>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeleteAsset(
                                        asset.id,
                                        asset.name || "Bild-Asset",
                                        "asset",
                                      );
                                    }}
                                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                                  >
                                    <Trash2 size={14} />
                                    Loeschen
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-400 text-white shadow-sm">
                        <Folder size={28} />
                      </div>
                      <p className="text-base font-semibold text-slate-900">
                        Ordner ist noch leer
                      </p>
                      <p className="text-sm text-slate-600">
                        {canManageSocial
                          ? "Lade hier Bilder hoch, um sie später in beliebigen Postings wiederzuverwenden."
                          : "Lade hier Bilder fuer dein aktuelles Posting hoch. Ordner werden nicht veraendert."}
                      </p>
                      {selectedAssetFolderId !== "__crests__" ? (
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
                          <Plus size={16} />
                          {canManageSocial ? "Erste Bilder hochladen" : "Eigene Bilder hochladen"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              event.target.value = "";
                              void handleUploadAssetsToFolder(files);
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
