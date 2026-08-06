import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, getUserRowById, isAdminOrBoard, now } from '../db.js'

const router = Router()

const KEY_TYPE_OPTIONS = [
  { value: 'haupttor', label: 'Haupttor' },
  { value: 'trainingsraum', label: 'Trainingsraum' },
  { value: 'geraeteraum', label: 'Geräteraum' },
  { value: 'clubhaus', label: 'Clubhaus' },
]

const getDefaultKeyLabel = (keyType: string) => {
  const option = KEY_TYPE_OPTIONS.find((entry) => entry.value === keyType)
  return option?.label ?? keyType
}

const canManageKeyAssignments = (actorId: string) => {
  if (isAdminOrBoard(actorId)) {
    return true
  }

  const actor = getUserRowById(actorId)
  if (!actor) {
    return false
  }

  if (actor.role !== 'trainer') {
    return false
  }

  return false
}

router.get('/key-types', (_req: Request, res: Response) => {
  res.json({
    success: true,
    keyTypes: KEY_TYPE_OPTIONS,
  })
})

router.post('/', (req: Request, res: Response) => {
  const {
    actorId,
    trainerId,
    keyType,
    keyLabel,
    notes,
  } = req.body as {
    actorId?: string
    trainerId?: string
    keyType?: string
    keyLabel?: string
    notes?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageKeyAssignments(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Nur Vorstand oder Admin darf Schlüsselzuweisungen anlegen.',
    })
    return
  }

  if (!trainerId || !keyType?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Bitte Trainer und Schlüssel-Typ auswählen.',
    })
    return
  }

  const trainer = getUserRowById(trainerId)
  if (!trainer || trainer.role !== 'trainer') {
    res.status(400).json({
      success: false,
      error: 'Die ausgewählte Person ist keine Trainerin / kein Trainer.',
    })
    return
  }

  const timestamp = now()
  const resolvedKeyLabel = (keyLabel ?? '').trim() || getDefaultKeyLabel(keyType.trim())

  db.prepare(`
    INSERT INTO key_assignments (
      id,
      key_type,
      key_label,
      trainer_id,
      status,
      handed_over_by,
      handed_over_at,
      returned_by,
      returned_at,
      notes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, 'not_handed_over', NULL, NULL, NULL, NULL, ?, ?, ?)
  `).run(
    createId('key'),
    keyType.trim(),
    resolvedKeyLabel,
    trainerId,
    (notes ?? '').trim(),
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/hand-over', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, notes } = req.body as {
    actorId?: string
    notes?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageKeyAssignments(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Nur Vorstand oder Admin darf die Aushändigung buchen.',
    })
    return
  }

  const assignment = db.prepare('SELECT * FROM key_assignments WHERE id = ?').get(id) as
    | { id: string; notes: string }
    | undefined

  if (!assignment) {
    res.status(404).json({ success: false, error: 'Schlüsselzuweisung nicht gefunden.' })
    return
  }

  const timestamp = now()
  const mergedNotes = (notes ?? '').trim()
    ? `${assignment.notes ? `${assignment.notes}\n` : ''}[${new Date(timestamp).toLocaleString('de-DE')}] Aushändigung: ${(notes ?? '').trim()}`
    : assignment.notes

  db.prepare(`
    UPDATE key_assignments
    SET
      status = 'handed_over',
      handed_over_by = ?,
      handed_over_at = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?
  `).run(actorId, timestamp, mergedNotes, timestamp, id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/return', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, notes } = req.body as {
    actorId?: string
    notes?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageKeyAssignments(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Nur Vorstand oder Admin darf die Rückgabe buchen.',
    })
    return
  }

  const assignment = db.prepare('SELECT * FROM key_assignments WHERE id = ?').get(id) as
    | { id: string; notes: string }
    | undefined

  if (!assignment) {
    res.status(404).json({ success: false, error: 'Schlüsselzuweisung nicht gefunden.' })
    return
  }

  const timestamp = now()
  const mergedNotes = (notes ?? '').trim()
    ? `${assignment.notes ? `${assignment.notes}\n` : ''}[${new Date(timestamp).toLocaleString('de-DE')}] Rückgabe: ${(notes ?? '').trim()}`
    : assignment.notes

  db.prepare(`
    UPDATE key_assignments
    SET
      status = 'returned',
      returned_by = ?,
      returned_at = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?
  `).run(actorId, timestamp, mergedNotes, timestamp, id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const {
    actorId,
    trainerId,
    keyType,
    keyLabel,
    notes,
  } = req.body as {
    actorId?: string
    trainerId?: string
    keyType?: string
    keyLabel?: string
    notes?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageKeyAssignments(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Nur Vorstand oder Admin darf Schlüsselzuweisungen bearbeiten.',
    })
    return
  }

  const existing = db.prepare('SELECT * FROM key_assignments WHERE id = ?').get(id) as
    | { id: string; trainer_id: string; key_type: string; key_label: string; notes: string }
    | undefined

  if (!existing) {
    res.status(404).json({ success: false, error: 'Schlüsselzuweisung nicht gefunden.' })
    return
  }

  if (trainerId) {
    const trainer = getUserRowById(trainerId)
    if (!trainer || trainer.role !== 'trainer') {
      res.status(400).json({
        success: false,
        error: 'Die ausgewählte Person ist keine Trainerin / kein Trainer.',
      })
      return
    }
  }

  const resolvedKeyType = (keyType ?? existing.key_type).trim()
  const resolvedKeyLabel =
    keyLabel !== undefined
      ? ((keyLabel ?? '').trim() || getDefaultKeyLabel(resolvedKeyType))
      : existing.key_label
  const resolvedTrainerId = trainerId ?? existing.trainer_id
  const resolvedNotes = notes !== undefined ? (notes ?? '').trim() : existing.notes

  db.prepare(`
    UPDATE key_assignments
    SET
      trainer_id = ?,
      key_type = ?,
      key_label = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    resolvedTrainerId,
    resolvedKeyType,
    resolvedKeyLabel,
    resolvedNotes,
    now(),
    id,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId } = req.body as { actorId?: string }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageKeyAssignments(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Nur Vorstand oder Admin darf Schlüsselzuweisungen entfernen.',
    })
    return
  }

  db.prepare('DELETE FROM key_assignments WHERE id = ?').run(id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
