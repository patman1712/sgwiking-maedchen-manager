import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, Phone, Plus, Trash2, X } from "lucide-react";
import SectionCard from "@/components/SectionCard";
import { optimizeImageForUpload } from "@/lib/image";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";

function formatPrice(priceCents: number) {
  const amount = (Number(priceCents) || 0) / 100;
  return amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export default function FleaMarketPage() {
  const fleaMarketListings = useAppStore((state) => state.fleaMarketListings);
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const addFleaMarketListing = useAppStore((state) => state.addFleaMarketListing);
  const deleteFleaMarketListing = useAppStore((state) => state.deleteFleaMarketListing);
  const ensureDirectConversation = useAppStore((state) => state.ensureDirectConversation);
  const navigate = useNavigate();
  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imageModal, setImageModal] = useState<{ src: string; alt: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    condition: "",
    price: "",
    contactName: currentUser?.fullName ?? "",
    contactPhone: currentUser?.phone ?? "",
    contactEmail: currentUser?.email ?? "",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const sortedListings = useMemo(
    () =>
      [...fleaMarketListings].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [fleaMarketListings],
  );

  const canDeleteListing = (createdBy: string) =>
    Boolean(
      currentUser &&
        (currentUser.role === "admin" ||
          currentUser.role === "board" ||
          createdBy === currentUser.id),
    );

  const sellerName = (userId: string) =>
    users.find((user) => user.id === userId)?.fullName ?? "Unbekannt";

  return (
    <div className="space-y-6">
      <SectionCard
        title="Flohmarkt"
        description="Gebrauchte Fussballartikel anbieten und direkt privat Kontakt aufnehmen. Keine Verkaufsplattform, nur Vermittlung."
        actions={
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setCreateOpen(true);
              setForm({
                title: "",
                description: "",
                condition: "",
                price: "",
                contactName: currentUser?.fullName ?? "",
                contactPhone: currentUser?.phone ?? "",
                contactEmail: currentUser?.email ?? "",
              });
              setImageFiles([]);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
          >
            <Plus size={18} />
            Angebot einstellen
          </button>
        }
      >
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

          {sortedListings.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedListings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative bg-slate-50">
                    {listing.imageUrls.length ? (
                      <button
                        type="button"
                        onClick={() =>
                          setImageModal({
                            src: listing.imageUrls[0],
                            alt: listing.title,
                          })
                        }
                        className="block w-full"
                      >
                        <img
                          src={listing.imageUrls[0]}
                          alt={listing.title}
                          className="h-48 w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                        Kein Bild
                      </div>
                    )}
                    {canDeleteListing(listing.createdBy) ? (
                      <button
                        type="button"
                        disabled={savingId === listing.id}
                        onClick={async () => {
                          const confirmed = window.confirm("Angebot wirklich loeschen?");
                          if (!confirmed) {
                            return;
                          }
                          setError("");
                          setSuccess("");
                          setSavingId(listing.id);
                          const result = await deleteFleaMarketListing(listing.id);
                          if (!result.success) {
                            setError(result.error ?? "Angebot konnte nicht geloescht werden.");
                          } else {
                            setSuccess("Angebot wurde geloescht.");
                          }
                          setSavingId(null);
                        }}
                        className="absolute right-3 top-3 inline-flex items-center justify-center rounded-2xl border border-white/60 bg-white/90 p-2 text-rose-700 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-base font-semibold text-slate-900">
                          {listing.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Anbieter: {sellerName(listing.createdBy)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900">
                        {formatPrice(listing.priceCents)}
                      </span>
                    </div>

                    {listing.condition ? (
                      <p className="mt-3 text-sm font-medium text-slate-700">
                        Zustand: {listing.condition}
                      </p>
                    ) : null}

                    {listing.description ? (
                      <p className="mt-3 line-clamp-4 text-sm text-slate-600">
                        {listing.description}
                      </p>
                    ) : null}

                    <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {listing.contactName ? <p>{listing.contactName}</p> : null}
                      {listing.contactPhone ? (
                        <a
                          href={`tel:${listing.contactPhone}`}
                          className="inline-flex items-center gap-2 text-blue-900 hover:underline"
                        >
                          <Phone size={14} />
                          {listing.contactPhone}
                        </a>
                      ) : null}
                      {listing.contactEmail ? (
                        <a
                          href={`mailto:${listing.contactEmail}`}
                          className="inline-flex items-center gap-2 text-blue-900 hover:underline"
                        >
                          <Mail size={14} />
                          {listing.contactEmail}
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const conversationId = await ensureDirectConversation(listing.createdBy);
                          if (!conversationId) {
                            setError("Nachricht konnte nicht gestartet werden.");
                            return;
                          }
                          navigate(
                            `/dashboard/messages?conversation=${encodeURIComponent(conversationId)}`,
                          );
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                      >
                        <MessageSquare size={16} />
                        Nachricht
                      </button>
                    </div>

                    {listing.imageUrls.length > 1 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {listing.imageUrls.slice(1, 5).map((src) => (
                          <button
                            key={src}
                            type="button"
                            className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                            onClick={() => setImageModal({ src, alt: listing.title })}
                          >
                            <img src={src} alt={listing.title} className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">Noch keine Angebote</p>
              <p className="mt-2 text-sm text-slate-600">
                Stell das erste Angebot ein, damit Spielerinnen und Trainer direkt Kontakt aufnehmen koennen.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => {
            if (!submitting) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Neues Angebot</p>
                <p className="mt-1 text-sm text-slate-600">
                  Fotos, Beschreibung, Preisvorstellung und Kontaktdaten. Danach koennen andere privat Kontakt aufnehmen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="mt-6 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setSuccess("");
                setSubmitting(true);

                try {
                  const optimizedFiles = await Promise.all(
                    imageFiles.map(async (file) => optimizeImageForUpload(file)),
                  );
                  const result = await addFleaMarketListing({
                    title: form.title,
                    description: form.description,
                    condition: form.condition,
                    price: form.price,
                    contactName: form.contactName,
                    contactPhone: form.contactPhone,
                    contactEmail: form.contactEmail,
                    imageFiles: optimizedFiles,
                  });

                  if (!result.success) {
                    setError(result.error ?? "Angebot konnte nicht gespeichert werden.");
                    setSubmitting(false);
                    return;
                  }

                  setCreateOpen(false);
                  setSuccess("Angebot wurde eingestellt.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Titel</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Beschreibung
                </span>
                <textarea
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Zustand</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.condition}
                    onChange={(event) => setForm({ ...form, condition: event.target.value })}
                    placeholder="z. B. gut, gebraucht, wie neu"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Preisvorstellung (EUR)
                  </span>
                  <input
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.price}
                    onChange={(event) => setForm({ ...form, price: event.target.value })}
                    placeholder="z. B. 15"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Bilder</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    setImageFiles(files.slice(0, 6));
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-blue-50 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-blue-900 hover:file:bg-blue-100"
                />
                {imageFiles.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imageFiles.map((file) => {
                      const src = URL.createObjectURL(file);
                      return (
                        <div
                          key={file.name}
                          className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                        >
                          <img
                            src={src}
                            alt={file.name}
                            className="h-full w-full object-cover"
                            onLoad={() => URL.revokeObjectURL(src)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </label>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Kontaktdaten (privat)
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Name
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      value={form.contactName}
                      onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Telefon
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      value={form.contactPhone}
                      onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                    />
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">E-Mail</span>
                  <input
                    type="email"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    value={form.contactEmail}
                    onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Speichert..." : "Angebot einstellen"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={submitting}
                  className={cn(
                    "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50",
                    submitting && "cursor-not-allowed opacity-60",
                  )}
                >
                  Abbrechen
                </button>
              </div>
            </form>
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
