import { useMemo, useState } from "react";
import SectionCard from "@/components/SectionCard";
import { useAppStore } from "@/store";
import type { KeyAssignment, KeyHandoverStatus } from "@/types";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
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

const KEY_TYPE_OPTIONS = [
  { value: "seiteneingang", label: "Seiteneingang" },
  { value: "buero", label: "Büro" },
  { value: "container", label: "Container" },
  { value: "materialwagen", label: "Materialwagen" },
];

const STATUS_STYLES: Record<KeyHandoverStatus, string> = {
  not_handed_over: "bg-slate-100 text-slate-700",
  handed_over: "bg-amber-100 text-amber-900",
  returned: "bg-emerald-100 text-emerald-900",
};

const STATUS_LABEL: Record<KeyHandoverStatus, string> = {
  not_handed_over: "Nicht ausgehändigt",
  handed_over: "Ausgehändigt",
  returned: "Zurückgegeben",
};

interface AssignmentFormState {
  trainerId: string;
  keyType: string;
  keyLabel: string;
  notes: string;
}

const emptyForm: AssignmentFormState = {
  trainerId: "",
  keyType: "haupttor",
  keyLabel: "",
  notes: "",
};

export default function VorstandSchluesselPage() {
  const users = useAppStore((state) => state.users);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const keyAssignments = useAppStore((state) => state.keyAssignments);
  const addKeyAssignment = useAppStore((state) => state.addKeyAssignment);
  const updateKeyAssignment = useAppStore((state) => state.updateKeyAssignment);
  const handOverKey = useAppStore((state) => state.handOverKey);
  const returnKey = useAppStore((state) => state.returnKey);
  const deleteKeyAssignment = useAppStore((state) => state.deleteKeyAssignment);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const canManageKeys =
    currentUser?.role === "admin" || currentUser?.role === "board";

  const trainers = useMemo(
    () => users.filter((user) => user.role === "trainer"),
    [users],
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "handed_over" | "returned">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AssignmentFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AssignmentFormState>(emptyForm);
  const [notePrompt, setNotePrompt] = useState<{
    id: string;
    action: "handover" | "return";
    notes: string;
  } | null>(null);

  const visibleAssignments = useMemo(() => {
    let list = keyAssignments;

    if (activeTab === "handed_over") {
      list = list.filter((entry) => entry.status === "handed_over");
    } else if (activeTab === "returned") {
      list = list.filter((entry) => entry.status === "returned");
    }

    return list;
  }, [activeTab, keyAssignments]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const userName = (userId: string | null | undefined) =>
    users.find((user) => user.id === userId)?.fullName ?? "—";

  const trainerOptionLabel = (trainerId: string) => {
    const trainer = users.find((user) => user.id === trainerId);
    if (!trainer) return "";
    return `${trainer.fullName}${trainer.teamIds.length ? ` (${trainer.teamIds.length} Mannschaften)` : ""}`;
  };

  const handleAddSubmit = async () => {
    clearMessages();

    if (!form.trainerId) {
      setError("Bitte wähle zuerst eine Trainerin / einen Trainer aus.");
      return;
    }

    if (!form.keyType.trim()) {
      setError("Bitte wähle einen Schlüssel-Typ aus.");
      return;
    }

    setSavingId("__new__");
    try {
      const result = await addKeyAssignment({
        trainerId: form.trainerId,
        keyType: form.keyType.trim(),
        keyLabel: form.keyLabel.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "Fehler beim Anlegen.");
        return;
      }

      setSuccess("Schlüsselzuweisung angelegt.");
      setForm(emptyForm);
      setShowAddForm(false);
    } finally {
      setSavingId(null);
    }
  };

  const handleEditOpen = (entry: KeyAssignment) => {
    setEditingId(entry.id);
    setEditForm({
      trainerId: entry.trainerId,
      keyType: entry.keyType,
      keyLabel: entry.keyLabel,
      notes: entry.notes,
    });
    clearMessages();
  };

  const handleEditSave = async () => {
    clearMessages();
    if (!editingId) return;

    setSavingId(editingId);
    try {
      const result = await updateKeyAssignment(editingId, {
        trainerId: editForm.trainerId || undefined,
        keyType: editForm.keyType.trim() || undefined,
        keyLabel: editForm.keyLabel.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "Fehler beim Speichern.");
        return;
      }

      setSuccess("Änderungen gespeichert.");
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    clearMessages();

    if (!window.confirm("Soll diese Schlüsselzuweisung wirklich entfernt werden?")) {
      return;
    }

    setSavingId(assignmentId);
    try {
      const result = await deleteKeyAssignment(assignmentId);
      if (!result.success) {
        setError(result.error ?? "Fehler beim Entfernen.");
        return;
      }
      setSuccess("Schlüsselzuweisung entfernt.");
    } finally {
      setSavingId(null);
    }
  };

  const openHandoverPrompt = (id: string) => {
    setNotePrompt({ id, action: "handover", notes: "" });
    clearMessages();
  };

  const openReturnPrompt = (id: string) => {
    setNotePrompt({ id, action: "return", notes: "" });
    clearMessages();
  };

  const submitPrompt = async () => {
    if (!notePrompt) return;

    setSavingId(notePrompt.id);
    try {
      const result =
        notePrompt.action === "handover"
          ? await handOverKey(notePrompt.id, notePrompt.notes.trim() || undefined)
          : await returnKey(notePrompt.id, notePrompt.notes.trim() || undefined);

      if (!result.success) {
        setError(result.error ?? "Fehler beim Buchen.");
        return;
      }

      setSuccess(
        notePrompt.action === "handover"
          ? "Aushändigung gebucht."
          : "Rückgabe gebucht.",
      );
      setNotePrompt(null);
    } finally {
      setSavingId(null);
    }
  };

  if (!canManageKeys) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <SectionCard
          title="Schlüsselverwaltung"
          description="Zugriff nur für Vorstand und Admin."
        >
          <p className="text-sm text-slate-600">
            Du hast keine Berechtigung, die Schlüsselverwaltung einzusehen.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      <SectionCard
        title="Schlüsselverwaltung"
        description="Übersicht über ausgehändigte und zurückgegebene Schlüssel für Trainer."
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-2xl border border-slate-200 bg-white p-1">
              {([
                ["all", "Alle"],
                ["handed_over", "Ausgehändigt"],
                ["returned", "Zurückgegeben"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveTab(value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === value
                      ? "bg-blue-900 text-white shadow shadow-blue-900/20"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddForm((open) => !open);
                clearMessages();
              }}
              className="rounded-2xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5"
            >
              {showAddForm ? "Abbrechen" : "Neue Zuweisung"}
            </button>
          </div>
        }
      >
        {showAddForm ? (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Trainer
                </label>
                <select
                  value={form.trainerId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, trainerId: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Bitte wählen…</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Schlüssel-Typ
                </label>
                <select
                  value={form.keyType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      keyType: event.target.value,
                      keyLabel:
                        prev.keyLabel &&
                        KEY_TYPE_OPTIONS.some((opt) => opt.value === prev.keyType)
                          ? KEY_TYPE_OPTIONS.find(
                              (opt) => opt.value === event.target.value,
                            )?.label ?? prev.keyLabel
                          : prev.keyLabel,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {KEY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Bezeichnung (optional)
                </label>
                <input
                  type="text"
                  value={form.keyLabel}
                  placeholder="z.B. Schlüssel Nr. 3"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, keyLabel: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Notizen
                </label>
                <textarea
                  value={form.notes}
                  rows={2}
                  placeholder="Anmerkungen zur Zuweisung…"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setForm(emptyForm);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={savingId === "__new__"}
                onClick={handleAddSubmit}
                className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow shadow-blue-900/20 transition hover:bg-blue-800 disabled:opacity-60"
              >
                {savingId === "__new__" ? "Speichere…" : "Anlegen"}
              </button>
            </div>
          </div>
        ) : null}

        {visibleAssignments.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            Noch keine Schlüsselzuweisungen vorhanden.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Trainer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Schlüssel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Aushändigung
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Rückgabe
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleAssignments.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const isSaving = savingId === entry.id;

                  if (isEditing) {
                    return (
                      <tr key={entry.id} className="bg-blue-50/40 align-top">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Trainer
                              </label>
                              <select
                                value={editForm.trainerId}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    trainerId: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              >
                                {trainers.map((trainer) => (
                                  <option key={trainer.id} value={trainer.id}>
                                    {trainer.fullName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Schlüssel-Typ
                              </label>
                              <select
                                value={editForm.keyType}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    keyType: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              >
                                {KEY_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Bezeichnung
                              </label>
                              <input
                                type="text"
                                value={editForm.keyLabel}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    keyLabel: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Notizen
                              </label>
                              <textarea
                                rows={2}
                                value={editForm.notes}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    notes: event.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={handleEditSave}
                              className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow shadow-blue-900/20 transition hover:bg-blue-800 disabled:opacity-60"
                            >
                              {isSaving ? "Speichere…" : "Speichern"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={entry.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {userName(entry.trainerId)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {trainerOptionLabel(entry.trainerId) || "Trainer"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {entry.keyLabel ||
                            KEY_TYPE_OPTIONS.find((opt) => opt.value === entry.keyType)
                              ?.label ||
                            entry.keyType}
                        </div>
                        {entry.keyLabel &&
                        KEY_TYPE_OPTIONS.some((opt) => opt.value === entry.keyType) &&
                        KEY_TYPE_OPTIONS.find((opt) => opt.value === entry.keyType)
                          ?.label !== entry.keyLabel ? (
                          <div className="text-xs text-slate-500">
                            Typ:{" "}
                            {
                              KEY_TYPE_OPTIONS.find(
                                (opt) => opt.value === entry.keyType,
                              )?.label
                            }
                          </div>
                        ) : null}
                        {entry.notes ? (
                          <div className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                            {entry.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[entry.status]}`}
                        >
                          {STATUS_LABEL[entry.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{formatDate(entry.handedOverAt)}</div>
                        {entry.handedOverAt ? (
                          <div className="text-xs text-slate-500">
                            von {userName(entry.handedOverBy)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{formatDate(entry.returnedAt)}</div>
                        {entry.returnedAt ? (
                          <div className="text-xs text-slate-500">
                            von {userName(entry.returnedBy)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {entry.status !== "handed_over" ? (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => openHandoverPrompt(entry.id)}
                              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                            >
                              Aushändigen
                            </button>
                          ) : null}
                          {entry.status === "handed_over" ? (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => openReturnPrompt(entry.id)}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
                            >
                              Zurückgenommen
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleEditOpen(entry)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleDelete(entry.id)}
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            Entfernen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {notePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {notePrompt.action === "handover"
                ? "Schlüssel aushändigen"
                : "Rücknahme des Schlüssels buchen"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {notePrompt.action === "handover"
                ? "Bestätige, dass der Schlüssel an die Trainerin / den Trainer ausgehändigt wurde."
                : "Bestätige, dass der Schlüssel zurückgenommen wurde."}
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Anmerkung (optional)
              </label>
              <textarea
                rows={3}
                value={notePrompt.notes}
                placeholder="z.B. Übergabe nach dem Training…"
                onChange={(event) =>
                  setNotePrompt((prev) =>
                    prev ? { ...prev, notes: event.target.value } : prev,
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNotePrompt(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={savingId === notePrompt.id}
                onClick={submitPrompt}
                className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow shadow-blue-900/20 transition hover:bg-blue-800 disabled:opacity-60"
              >
                {savingId === notePrompt.id
                  ? "Speichere…"
                  : notePrompt.action === "handover"
                    ? "Aushändigung buchen"
                    : "Rücknahme buchen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
