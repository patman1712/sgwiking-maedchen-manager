import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@/types";

const SHARED_CREST_PREFIX = "/uploads/social-media-crests/";

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

function buildDraftAssets(draft: SocialMediaDraft, crests: SocialMediaCrest[]): EditorAsset[] {
  const assets = new Map<string, EditorAsset>();

  draft.imageUrls.forEach((url, index) => {
    assets.set(url, {
      id: `existing-${index}-${url}`,
      ref: url,
      kind: "existing",
      url,
    });
  });

  draft.layers.forEach((layer, index) => {
    if (!isSharedCrestRef(layer.imageRef) || !layer.imageRef) {
      return;
    }

    const crest = crests.find((entry) => entry.imageUrl === layer.imageRef);
    assets.set(layer.imageRef, {
      id: `shared-${crest?.id ?? index}-${layer.imageRef}`,
      ref: layer.imageRef,
      kind: "existing",
      url: layer.imageRef,
    });
  });

  return [...assets.values()];
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
      centerX: 50,
      centerY: 50,
      widthPercent: 100,
      heightPercent: 100,
      lockPosition: false,
      lockSize: false,
      fontFamily: undefined,
      fontSize: undefined,
      textColor: undefined,
      textAlign: undefined,
      textEffect: undefined,
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
    },
    caption: {
      kind: "caption",
      label: "Textkarte",
      position: "bottomCenter",
      style: "glass",
      text: "Hier kommt euer Textbaustein hinein.",
      enabled: true,
      lockPosition: false,
      lockSize: false,
      fontFamily: "Inter",
      fontSize: 16,
      textColor: "#f8fafc",
      textAlign: "left",
      textEffect: "none",
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

  return {
    ...getPlacementByPosition(layer.position),
    ...sizeByKind[layer.kind],
  };
}

function getImageLayerGeometry(layer: Pick<
  SocialMediaLayer,
  "position" | "style" | "centerX" | "centerY" | "widthPercent" | "heightPercent"
>) {
  const defaults = getDefaultImageGeometry(layer);
  const widthPercent = sanitizePercent(layer.widthPercent, defaults.widthPercent, 12, 100);
  const heightPercent = sanitizePercent(layer.heightPercent, defaults.heightPercent, 12, 100);

  return {
    widthPercent,
    heightPercent,
    centerX: sanitizePercent(layer.centerX, defaults.centerX, widthPercent / 2, 100 - widthPercent / 2),
    centerY: sanitizePercent(
      layer.centerY,
      defaults.centerY,
      heightPercent / 2,
      100 - heightPercent / 2,
    ),
  };
}

function getTextLayerGeometry(layer: Pick<
  SocialMediaLayer,
  "kind" | "position" | "centerX" | "centerY" | "widthPercent"
>) {
  const defaults = getDefaultTextGeometry(layer);
  const widthPercent = sanitizePercent(layer.widthPercent, defaults.widthPercent, 18, 100);

  return {
    widthPercent,
    heightPercent: defaults.heightPercent,
    centerX: sanitizePercent(layer.centerX, defaults.centerX, widthPercent / 2, 100 - widthPercent / 2),
    centerY: sanitizePercent(
      layer.centerY,
      defaults.centerY,
      defaults.heightPercent / 2,
      100 - defaults.heightPercent / 2,
    ),
  };
}

function getImageStyleClasses(style: SocialMediaLayerStyle, full = false) {
  if (full) {
    return "rounded-none border-0 object-cover";
  }

  switch (style) {
    case "soft":
      return "rounded-[1.75rem] border border-slate-200 object-cover opacity-95 shadow-[0_24px_60px_rgba(15,23,42,0.14)]";
    case "cutout":
      return "rounded-[1.5rem] border-4 border-white bg-white object-contain p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)]";
    case "glass":
      return "rounded-[1.75rem] border border-slate-200 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.18)]";
    case "pill":
      return "rounded-full border-4 border-white object-cover shadow-[0_16px_50px_rgba(15,23,42,0.18)]";
    case "solid":
      return "rounded-[1.25rem] border border-blue-950/20 object-cover shadow-[0_20px_40px_rgba(15,23,42,0.2)]";
    default:
      return "rounded-[1.75rem] border border-slate-200 object-cover shadow-[0_24px_60px_rgba(15,23,42,0.18)]";
  }
}

function normalizeLayer(layer: SocialMediaLayer): SocialMediaLayer {
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
    };
  }

  return {
    ...layer,
    ...getImageLayerGeometry(layer),
    lockPosition: layer.lockPosition ?? false,
    lockSize: layer.lockSize ?? false,
  };
}

function getTextInlineStyle(layer: SocialMediaLayer) {
  const defaults = getDefaultTextAppearance(layer);
  const textEffect = layer.textEffect ?? defaults.textEffect;
  const fontFamily = layer.fontFamily ?? defaults.fontFamily;

  return {
    color: layer.textColor ?? defaults.textColor,
    fontFamily: `"${fontFamily}", "Inter", system-ui, sans-serif`,
    fontSize: `${Math.round(layer.fontSize ?? defaults.fontSize)}px`,
    textAlign: (layer.textAlign ?? defaults.textAlign) as SocialMediaTextAlign,
    textShadow:
      textEffect === "shadow" ? "0 10px 30px rgba(15,23,42,0.55)" : "none",
    WebkitTextStroke:
      textEffect === "outline" ? "1.4px rgba(15,23,42,0.82)" : undefined,
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
        textColor: "#0f172a",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
      };
    case "subtitle":
      return {
        fontFamily: "Inter",
        fontSize: layer.style === "solid" ? 16 : 18,
        textColor: "#334155",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
      };
    case "caption":
      return {
        fontFamily: "Inter",
        fontSize: 16,
        textColor: "#334155",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
      };
    case "badge":
      return {
        fontFamily: "Montserrat",
        fontSize: 12,
        textColor: layer.style === "pill" ? "#ffffff" : "#0f172a",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
      };
    case "cta":
      return {
        fontFamily: "Montserrat",
        fontSize: 12,
        textColor: layer.style === "solid" ? "#ffffff" : "#0f172a",
        textAlign: "center" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
      };
    default:
      return {
        fontFamily: "Inter",
        fontSize: 16,
        textColor: "#0f172a",
        textAlign: "left" as SocialMediaTextAlign,
        textEffect: "none" as SocialMediaTextEffect,
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
        "whitespace-pre-wrap rounded-[1.75rem] px-4 py-4 text-sm leading-6 md:px-5",
        layer.style === "solid"
          ? "bg-slate-900 text-white shadow-[0_18px_50px_rgba(15,23,42,0.2)]"
          : "border border-slate-200 bg-slate-50 text-slate-800 shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
      );
    default:
      return "text-sm text-slate-900";
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
  onUpdateLayer,
  respectLayerLocks = false,
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
  } | null>(null);
  const resolveAssetUrl = (ref?: string) => assets.find((asset) => asset.ref === ref)?.url;
  const visibleLayers = layers.filter((layer) => layer.enabled);

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
        const centerX = clamp(
          interaction.startCenterX + deltaXPercent,
          interaction.startWidthPercent / 2,
          100 - interaction.startWidthPercent / 2,
        );
        const centerY = clamp(
          interaction.startCenterY + deltaYPercent,
          interaction.startHeightPercent / 2,
          100 - interaction.startHeightPercent / 2,
        );

        onUpdateLayer(interaction.layerId, { centerX, centerY });
        return;
      }

      const layer = layers.find((entry) => entry.id === interaction.layerId);
      if (!layer) {
        return;
      }

      if (interaction.layerKind !== "image") {
        const defaults = getDefaultTextAppearance(layer);
        const widthPercent = clamp(interaction.startWidthPercent + deltaXPercent * 2, 18, 100);
        const scale = widthPercent / Math.max(interaction.startWidthPercent, 1);
        const fontSize = clamp(
          Math.round((interaction.startFontSize ?? defaults.fontSize) * scale),
          10,
          480,
        );
        const heightPercent = interaction.startHeightPercent * scale;
        const centerX = clamp(
          interaction.startCenterX,
          widthPercent / 2,
          100 - widthPercent / 2,
        );
        const centerY = clamp(
          interaction.startCenterY,
          heightPercent / 2,
          100 - heightPercent / 2,
        );

        onUpdateLayer(interaction.layerId, {
          centerX,
          centerY,
          widthPercent,
          fontSize,
        });
        return;
      }

      const widthPercent = clamp(interaction.startWidthPercent + deltaXPercent * 2, 12, 100);
      const heightPercent = clamp(interaction.startHeightPercent + deltaYPercent * 2, 12, 100);
      const centerX = clamp(
        interaction.startCenterX,
        widthPercent / 2,
        100 - widthPercent / 2,
      );
      const centerY = clamp(
        interaction.startCenterY,
        heightPercent / 2,
        100 - heightPercent / 2,
      );

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
      className={cn(
        "relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white text-slate-900 shadow-[0_28px_90px_rgba(15,23,42,0.14)]",
        draftType === "story" ? "aspect-[9/16]" : "aspect-[4/5]",
      )}
    >
      {visibleLayers.map((layer, index) => {
        const zStyle = { zIndex: index + 5 };

        if (layer.kind === "image") {
          const assetUrl = resolveAssetUrl(layer.imageRef);
          const geometry = getImageLayerGeometry(layer);
          const isSelected = activeLayerId === layer.id;
          const movable = canMoveLayer(layer, respectLayerLocks);
          const resizable = canResizeLayer(layer, respectLayerLocks);
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
                "absolute overflow-hidden touch-none",
                movable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                isSelected &&
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
                  className={cn(
                    "h-full w-full",
                    getImageStyleClasses(layer.style, layer.position === "full"),
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center text-slate-500",
                    layer.position === "full"
                      ? "bg-slate-100"
                      : "rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50",
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
  const addSocialMediaTextSnippet = useAppStore((state) => state.addSocialMediaTextSnippet);
  const updateSocialMediaTextSnippet = useAppStore((state) => state.updateSocialMediaTextSnippet);
  const deleteSocialMediaTextSnippet = useAppStore((state) => state.deleteSocialMediaTextSnippet);
  const updateUser = useAppStore((state) => state.updateUser);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const canManageSocial = currentUser?.role === "admin";
  const canUseSocial =
    canManageSocial || (currentUser?.role === "trainer" && Boolean(currentUser.socialMediaEnabled));
  const isTrainerSocialUser = currentUser?.role === "trainer";

  if (!canUseSocial) {
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
    () => drafts.filter((draft) => !draft.isTemplate),
    [drafts],
  );
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
    const assets = buildDraftAssets(draft, socialMediaCrests);
    setEditorAssets(assets);
    const layers = (draft.layers.length ? draft.layers : buildFallbackLayers(draft)).map(normalizeLayer);
    setEditorLayers(layers);
    setActiveLayerId(layers[0]?.id ?? null);
    setEditorOpen(true);
  };

  const openEditDraft = (draft: SocialMediaDraft) => {
    openEditorWithDraft(draft, "edit", draft.isTemplate);
  };

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
    setEditorAssets(buildDraftAssets(draft, socialMediaCrests));
    const layers = (draft.layers.length ? draft.layers : buildFallbackLayers(draft)).map(normalizeLayer);
    setEditorLayers(layers);
    setActiveLayerId(layers[0]?.id ?? null);
  };

  const updatePrimaryTitle = (value: string) => {
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
    const nextLayer = normalizeLayer(
      createLayer(kind, kind === "image" ? { imageRef: firstAssetRef } : {}),
    );
    setEditorLayers((current) => [...current, nextLayer]);
    setActiveLayerId(nextLayer.id);
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
    setEditorAssets((current) => {
      if (current.some((asset) => asset.ref === imageUrl)) {
        return current;
      }

      return [
        ...current,
        {
          id: `shared-${label ?? "asset"}-${imageUrl}`,
          ref: imageUrl,
          kind: "existing",
          url: imageUrl,
        },
      ];
    });
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
        description="Feed- und Story-Entwuerfe mit Ebenen, sauberem Vereinsstil und deutlich flexiblerer Vorschau."
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
                              assets={buildDraftAssets(selectedTemplate, socialMediaCrests)}
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
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests);
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
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests);
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
                        const previewAssets = buildDraftAssets(draft, socialMediaCrests);
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
                                    {getLayoutLabel(draft.layout)}
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
                <p className="mt-1 text-sm text-slate-600">
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
                        value={primaryTitleLayer?.text ?? ""}
                        onChange={(event) => updatePrimaryTitle(event.target.value)}
                        placeholder={
                          editorIsTemplate ? "Name der Vorlage" : "Titel fuer Feed oder Story"
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {editorIsTemplate
                          ? "Hier kannst du die Vorlage direkt umbenennen."
                          : "Der Titel wird aus der ersten Titel-Ebene gespeichert."}
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
                            Bilder werden hochgeladen und koennen danach in mehreren Ebenen verwendet werden.
                          </p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                          <Plus size={16} />
                          Bilder hinzufuegen
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
                              disabled={isLayerProtected(layer)}
                              className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                            {positionOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

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
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          Diese Vorlage enthaelt feste Elemente.
                          {activeLayerPositionLocked ? " Position ist gesperrt." : ""}
                          {activeLayerSizeLocked ? " Groesse ist gesperrt." : ""}
                        </div>
                      ) : null}

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
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Bildgeometrie</p>
                                <p className="text-xs text-slate-500">
                                  In der Vorschau frei ziehen oder hier exakt einstellen.
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={activeLayerPositionLocked || activeLayerSizeLocked}
                                onClick={() =>
                                  updateLayer(activeLayer.id, {
                                    ...getDefaultImageGeometry({
                                      position: activeLayer.position,
                                      style: activeLayer.style,
                                    }),
                                  })
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Zuruecksetzen
                              </button>
                            </div>

                            {(() => {
                              const geometry = getImageLayerGeometry(activeLayer);
                              const controls = [
                                {
                                  key: "centerX",
                                  label: "Horizontal",
                                  value: geometry.centerX,
                                  min: geometry.widthPercent / 2,
                                  max: 100 - geometry.widthPercent / 2,
                                },
                                {
                                  key: "centerY",
                                  label: "Vertikal",
                                  value: geometry.centerY,
                                  min: geometry.heightPercent / 2,
                                  max: 100 - geometry.heightPercent / 2,
                                },
                                {
                                  key: "widthPercent",
                                  label: "Breite",
                                  value: geometry.widthPercent,
                                  min: 12,
                                  max: 100,
                                },
                                {
                                  key: "heightPercent",
                                  label: "Hoehe",
                                  value: geometry.heightPercent,
                                  min: 12,
                                  max: 100,
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
                                          (control.key === "centerX" || control.key === "centerY")
                                            ? activeLayerPositionLocked
                                            : activeLayerSizeLocked
                                        }
                                        onChange={(event) =>
                                          updateLayer(activeLayer.id, {
                                            [control.key]: Number(event.target.value),
                                          } as Partial<SocialMediaLayer>)
                                        }
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
                                  In der Vorschau frei ziehen oder hier exakt ausrichten.
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
                                    fontSize: getDefaultTextAppearance(activeLayer).fontSize,
                                  })
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Zuruecksetzen
                              </button>
                            </div>

                            {(() => {
                              const geometry = getTextLayerGeometry(activeLayer);
                              const controls = [
                                {
                                  key: "centerX",
                                  label: "Horizontal",
                                  value: geometry.centerX,
                                  min: geometry.widthPercent / 2,
                                  max: 100 - geometry.widthPercent / 2,
                                },
                                {
                                  key: "centerY",
                                  label: "Vertikal",
                                  value: geometry.centerY,
                                  min: geometry.heightPercent / 2,
                                  max: 100 - geometry.heightPercent / 2,
                                },
                                {
                                  key: "widthPercent",
                                  label: "Breite",
                                  value: geometry.widthPercent,
                                  min: 18,
                                  max: 100,
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
                                          (control.key === "centerX" || control.key === "centerY")
                                            ? activeLayerPositionLocked
                                            : activeLayerSizeLocked
                                        }
                                        onChange={(event) =>
                                          updateLayer(activeLayer.id, {
                                            [control.key]: Number(event.target.value),
                                          } as Partial<SocialMediaLayer>)
                                        }
                                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                    </label>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

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

                              <label className="block">
                                <span className="mb-2 block text-sm font-medium text-slate-700">
                                  Schriftfarbe
                                </span>
                                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                                  <input
                                    type="color"
                                    value={
                                      activeLayer.textColor ?? getDefaultTextAppearance(activeLayer).textColor
                                    }
                                    onChange={(event) =>
                                      updateLayer(activeLayer.id, {
                                        textColor: event.target.value,
                                      })
                                    }
                                    className="h-11 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0"
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
                                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                  />
                                </div>
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
                          </div>
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
                    onUpdateLayer={updateLayer}
                    respectLayerLocks={respectEditorLayerLocks}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {editorIsTemplate
                      ? "Im Vorlagenmodus legst du fest, welche Elemente spaeter fuer Nutzer fest bleiben."
                      : "Freie Bild-Layer lassen sich direkt in der Vorschau ziehen. Fixierte Elemente bleiben an ihrer Position und Groesse gesperrt."}
                  </p>
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
                      const layersPayload = editorLayers.map((layer) => {
                        const normalizedLayer = normalizeLayer(layer);
                        return {
                          ...normalizedLayer,
                          imageRef: normalizedLayer.imageRef
                            ? (placeholderByRef.get(normalizedLayer.imageRef) ?? normalizedLayer.imageRef)
                            : undefined,
                        };
                      });
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
                              isTemplate: editorIsTemplate,
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
                            });

                      if (!result.success) {
                        setError(
                          result.error ??
                            (isTrainerSocialUser
                              ? "Posting konnte nicht eingereicht werden."
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
                            ? isTrainerSocialUser
                              ? "Posting wurde eingereicht."
                              : "Entwurf wurde gespeichert."
                            : isTrainerSocialUser
                              ? "Posting wurde aktualisiert."
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
                      : editorIsTemplate
                        ? editorMode === "create"
                          ? "Vorlage speichern"
                          : "Vorlage aktualisieren"
                        : isTrainerSocialUser
                          ? trainerPostingLabel
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
