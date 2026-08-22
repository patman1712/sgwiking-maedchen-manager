import { useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Copy,
  Download,
  Pencil,
  Trash2,
} from "lucide-react";
import html2canvas from "html2canvas";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type {
  SocialMediaCrest,
  SocialMediaDraft,
  SocialMediaLayoutOption,
  SocialMediaAsset,
  SocialMediaLayer,
} from "@/types";
import {
  SocialPreview,
  buildDraftAssets,
  buildFallbackLayers,
  normalizeLayer,
  type EditorAsset,
} from "./SocialMediaPage";

const fallbackLayoutOptions: SocialMediaLayoutOption[] = [
  { value: "matchday", label: "Spieltag", enabled: true },
  { value: "result", label: "Ergebnis", enabled: true },
  { value: "training", label: "Training", enabled: true },
  { value: "announcement", label: "Ankuendigung", enabled: true },
];

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

function getDraftPreviewData(
  draft: SocialMediaDraft,
  crests: SocialMediaCrest[],
  assetsLibrary: SocialMediaAsset[] = [],
) {
  const assets = buildDraftAssets(draft, crests, assetsLibrary);
  const rawLayers = draft.layers.length ? draft.layers : buildFallbackLayers(draft);
  const layers = rawLayers.map(normalizeLayer);
  return { assets, layers };
}

function DebugAssetInfo(props: {
  draft: SocialMediaDraft;
  assets: EditorAsset[];
  layers: SocialMediaLayer[];
  crestsCount: number;
  libraryCount: number;
}) {
  const { draft, assets, crestsCount, libraryCount } = props;
  const resolvedAssetsShort = assets.map((a) => ({ fileName: a.fileName, urlLen: a.url.length, ref: a.ref.slice(0, 60) }));
  const layersShort = draft.layers.map((l) => `${l.kind}:${(l.label || "?").slice(0, 20)}|ref:${String(l.imageRef ?? "—").slice(0, 60)}`);
  const matchTests: string[] = [];
  draft.layers.forEach((layer, i) => {
    if (layer.kind !== "image") { matchTests.push(`${i}:TEXT`); return; }
    const ref = layer.imageRef ?? "";
    const t = assets.find(
      (a) => a.ref === ref || a.id === ref || a.url === ref || a.fileName === ref,
    );
    matchTests.push(`${i}:${t ? "JA(" + t.fileName + ")" : "NEIN"}`);
  });
  return (
    <div className="mt-4 rounded-2xl border border-slate-300 bg-slate-100 p-3 font-mono text-[10px] leading-tight text-slate-900 break-words break-all">
      <div className="mb-1 font-bold text-rose-700">BITTE SCHREIB MIR 1 SCREENSHOT DAVON →</div>
      <div>1. imageUrls = {JSON.stringify(draft.imageUrls)}</div>
      <div>2. socialMediaAssets (Bibliothek) Länge = {libraryCount}</div>
      <div>3. socialMediaCrests (alt) Länge = {crestsCount}</div>
      <div>4. Resolved Assets ({assets.length}): {JSON.stringify(resolvedAssetsShort).slice(0, 500)}</div>
      <div>5. Draft.layers: {JSON.stringify(layersShort).slice(0, 500)}</div>
      <div>6. Match Testergebnis (Bild-Layer): {JSON.stringify(matchTests)}</div>
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
  const socialMediaAssets = useAppStore((state) => state.socialMediaAssets);
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
  const navigate = useNavigate();

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
      const exportWidthPx = draft.draftType === "story" ? 1080 : 1080;
      const targetHeightPx = draft.draftType === "story" ? 1920 : 1440;

      let target: HTMLElement | null = document.querySelector(
        `[data-jpg-export="${CSS.escape(draft.id)}"]`,
      );

      let useScale = exportWidthPx;
      if (target) {
        const rect = target.getBoundingClientRect();
        const realW = Math.max(1, rect.width || target.clientWidth || exportWidthPx / 3);
        useScale = Math.max(2, exportWidthPx / realW);
      } else {
        useScale = exportWidthPx / 400;
        const previewLayers = (
          draft.layers.length ? draft.layers : buildFallbackLayers(draft)
        ).map(normalizeLayer);
        const previewAssets = buildDraftAssets(draft, socialMediaCrests, socialMediaAssets);
        const sourcePreviewWidthPx = 400;
        const sourcePreviewHeightPx =
          draft.draftType === "story"
            ? sourcePreviewWidthPx * (1920 / 1080)
            : sourcePreviewWidthPx * (1440 / 1080);

        wrap = document.createElement("div");
        wrap.style.position = "fixed";
        wrap.style.left = "0";
        wrap.style.top = "0";
        wrap.style.pointerEvents = "none";
        wrap.style.opacity = "0.001";
        wrap.style.zIndex = "999999";
        wrap.style.width = `${sourcePreviewWidthPx}px`;
        wrap.style.height = `${sourcePreviewHeightPx}px`;
        wrap.style.overflow = "visible";
        document.body.appendChild(wrap);

        root = createRoot(wrap);
        target = await new Promise<HTMLElement>((resolveRender, rejectRender) => {
          const renderTimeout = window.setTimeout(() => {
            try {
              const candidate = wrap?.querySelector<HTMLElement>("[class*='aspect-']") ??
                (wrap?.firstElementChild as HTMLElement | null);
              if (candidate) resolveRender(candidate);
              else rejectRender(new Error("Render timeout"));
            } catch (err) {
              rejectRender(err);
            }
          }, 20000);

          try {
            root!.render(
              <div
                ref={(el) => {
                  if (el) {
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          try {
                            const candidate = el.querySelector<HTMLElement>("[class*='aspect-']") ??
                              (el.firstElementChild as HTMLElement | null);
                            if (candidate) {
                              candidate.style.width = `${sourcePreviewWidthPx}px`;
                              candidate.style.height = `${sourcePreviewHeightPx}px`;
                              candidate.style.aspectRatio = "unset";
                              window.clearTimeout(renderTimeout);
                              resolveRender(candidate);
                            }
                          } catch {
                            /* ignore */
                          }
                        });
                      });
                    });
                  }
                }}
                style={{
                  width: `${sourcePreviewWidthPx}px`,
                  height: `${sourcePreviewHeightPx}px`,
                }}
              >
                <SocialPreview
                  noChrome={true}
                  draftType={draft.draftType as "feed" | "story"}
                  layout={draft.layout}
                  layers={previewLayers}
                  assets={previewAssets}
                  logoUrl={clubLogoUrl ?? null}
                  respectLayerLocks={false}
                />
              </div>,
            );
          } catch (error) {
            rejectRender(error);
          }
        });
      }

      if (!target) {
        throw new Error("Vorschau konnte nicht erstellt werden.");
      }

      await new Promise<void>((r) => setTimeout(r, 1800));
      const imgs = Array.from(target.querySelectorAll("img"));
      await Promise.all(
        imgs.map(async (imgEl) => {
          try {
            if (imgEl.complete && imgEl.naturalWidth > 0) return;
            await new Promise<void>((res) => {
              const to = window.setTimeout(res, 3000);
              imgEl.addEventListener("load", () => {
                window.clearTimeout(to);
                res();
              });
              imgEl.addEventListener("error", () => {
                window.clearTimeout(to);
                res();
              });
            });
          } catch {
            /* ignore */
          }
        }),
      );

      const canvasRaw = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: useScale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 0,
        removeContainer: true,
        windowWidth: Math.max(window.innerWidth, exportWidthPx * 2),
        windowHeight: Math.max(window.innerHeight, targetHeightPx * 2),
      });

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = exportWidthPx;
      finalCanvas.height = targetHeightPx;
      const ctx = finalCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas Context nicht verfügbar");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      {
        const rawW = Math.max(1, canvasRaw.width);
        const rawH = Math.max(1, canvasRaw.height);
        const scaleW = finalCanvas.width / rawW;
        const scaleH = finalCanvas.height / rawH;
        const drawScale = Math.min(scaleW, scaleH);
        const drawW = rawW * drawScale;
        const drawH = rawH * drawScale;
        const drawX = (finalCanvas.width - drawW) / 2;
        const drawY = (finalCanvas.height - drawH) / 2;
        ctx.drawImage(canvasRaw, drawX, drawY, drawW, drawH);
      }

      const finalDataUrl = finalCanvas.toDataURL("image/jpeg", 0.97);

      const slug = draft.title
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 60) || "posting";
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `sg-wiking-posting-${slug}-${stamp}.jpg`;

      const link = document.createElement("a");
      link.href = finalDataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
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
            <div className="space-y-5">
              {submittedInboxDrafts.length ? (
                submittedInboxDrafts.map((draft) => {
                  const { assets, layers } = getDraftPreviewData(draft, socialMediaCrests, socialMediaAssets);
                  const hashtagsText = (draft.hashtags ?? []).filter(Boolean).map(tag =>
                    tag.startsWith("#") ? tag : `#${tag}`,
                  ).join(" ");
                  const fullPostingText = [draft.postingText, hashtagsText]
                    .filter(Boolean)
                    .join("\n\n");
                  const createdAt = previewDate(draft.createdAt ?? new Date().toISOString());
                  const updatedAt = previewDate(draft.updatedAt ?? draft.createdAt ?? new Date().toISOString());

                  return (
                    <div
                      key={draft.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{draft.title}</h3>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                              {draft.draftType === "story" ? "Story" : "Feed"}
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
                              "w-full max-w-[360px]",
                            )}
                          >
                            <SocialPreview
                              noChrome={true}
                              dataJpgExportId={draft.id}
                              draftType={draft.draftType as "feed" | "story"}
                              layout={draft.layout}
                              layers={layers}
                              assets={assets}
                              logoUrl={clubLogoUrl ?? null}
                            />
                            <DebugAssetInfo
                              draft={draft}
                              assets={assets}
                              layers={layers}
                              crestsCount={socialMediaCrests.length}
                              libraryCount={socialMediaAssets.length}
                            />
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
                              onClick={() =>
                                navigate("/dashboard/social-media", {
                                  state: { openDraftId: draft.id },
                                })
                              }
                              className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50"
                            >
                              <Pencil size={16} />
                              Bearbeiten
                            </button>
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
