import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, getUserRowById, isAdminOrBoard, now } from '../db.js'

const router = Router()

const canRequestForTeam = (actorId: string, teamId: string) => {
  if (isAdminOrBoard(actorId)) {
    return true
  }

  const actor = getUserRowById(actorId)
  if (!actor || actor.role !== 'trainer') {
    return false
  }

  const membership = db
    .prepare(
      "SELECT id FROM team_members WHERE user_id = ? AND team_id = ? AND membership_role = 'trainer' LIMIT 1",
    )
    .get(actorId, teamId) as { id: string } | undefined

  return Boolean(membership)
}

router.post('/', (req: Request, res: Response) => {
  const {
    actorId,
    teamId,
    matchId,
    matchLabel,
    proposedKickoffAt,
    reason,
    coordinationNotes,
  } = req.body as {
    actorId?: string
    teamId?: string
    matchId?: string | null
    matchLabel?: string
    proposedKickoffAt?: string
    reason?: string
    coordinationNotes?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!teamId || !matchLabel?.trim() || !proposedKickoffAt || !reason?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Bitte Spiel, neues Datum und Begruendung vollstaendig ausfuellen.',
    })
    return
  }

  if (!canRequestForTeam(actorId, teamId)) {
    res.status(403).json({
      success: false,
      error: 'Spielverlegungen koennen nur fuer eigene Teams durch Trainer, Vorstand oder Admin angemeldet werden.',
    })
    return
  }

  db.prepare(`
    INSERT INTO match_reschedule_requests (
      id,
      team_id,
      match_id,
      match_label,
      proposed_kickoff_at,
      reason,
      coordination_notes,
      requested_by,
      requested_at,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    createId('reschedule'),
    teamId,
    matchId ?? null,
    matchLabel.trim(),
    proposedKickoffAt,
    reason.trim(),
    coordinationNotes ?? '',
    actorId,
    now(),
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/in-progress', (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const { id } = req.params

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Vorstand oder Admin duerfen Antraege in Bearbeitung setzen.' })
    return
  }

  const exists = db
    .prepare("SELECT id FROM match_reschedule_requests WHERE id = ? AND status IN ('pending', 'in_progress')")
    .get(id) as { id: string } | undefined

  if (!exists) {
    res.status(404).json({ success: false, error: 'Antrag nicht gefunden.' })
    return
  }

  db.prepare(`
    UPDATE match_reschedule_requests
    SET
      status = 'in_progress',
      handled_by = ?,
      handled_at = ?
    WHERE id = ?
  `).run(actorId, now(), id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/complete', (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const { id } = req.params

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Vorstand oder Admin duerfen Antraege erledigen.' })
    return
  }

  const exists = db
    .prepare("SELECT id FROM match_reschedule_requests WHERE id = ? AND status IN ('pending', 'in_progress')")
    .get(id) as { id: string } | undefined

  if (!exists) {
    res.status(404).json({ success: false, error: 'Antrag nicht gefunden.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    UPDATE match_reschedule_requests
    SET
      status = 'done',
      handled_by = COALESCE(handled_by, ?),
      handled_at = COALESCE(handled_at, ?),
      completed_by = ?,
      completed_at = ?
    WHERE id = ?
  `).run(actorId, timestamp, actorId, timestamp, id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/trash', (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Vorstand oder Admin duerfen den Papierkorb leeren.' })
    return
  }

  db.prepare("DELETE FROM match_reschedule_requests WHERE status = 'done'").run()

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
