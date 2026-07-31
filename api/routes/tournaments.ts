import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import db, {
  createId,
  DATA_DIR,
  getBootstrapData,
  getTeamIdsByUserId,
  getUserRowById,
  isAdminOrBoard,
  now,
} from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads', 'tournaments')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.pdf'
    callback(null, `tournament-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`)
  },
})

const upload = multer({ storage })
type TournamentResponseStatus = 'accepted' | 'declined'
type TournamentRegistrationStatus = 'open' | 'registered' | 'cancelled'
type TournamentReplyStatus = 'pending' | 'accepted' | 'declined'

const canViewTournamentTeam = (actorId: string, teamId: string) => {
  if (isAdminOrBoard(actorId)) {
    return true
  }

  const actor = getUserRowById(actorId)
  if (!actor || actor.role !== 'trainer') {
    return false
  }

  return getTeamIdsByUserId(actorId).includes(teamId)
}

const cleanupFile = (file: Express.Multer.File | undefined) => {
  if (!file) {
    return
  }

  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path)
  }
}

const parseTeamIds = (value: string | undefined) => {
  if (!value) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return [
        ...new Set(
          parsed.filter(
            (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()),
          ),
        ),
      ]
    }
  } catch {
    return []
  }

  return []
}

const getOfferGroupRows = (id: string) => {
  const offer = db
    .prepare('SELECT id, group_id FROM tournament_offers WHERE id = ?')
    .get(id) as { id: string; group_id: string | null } | undefined

  if (!offer) {
    return []
  }

  const groupId = offer.group_id || offer.id
  return db
    .prepare(
      `SELECT id, team_id, tournament_plan_url
       FROM tournament_offers
       WHERE group_id = ? OR (group_id IS NULL AND id = ?)
       ORDER BY starts_at ASC`,
    )
    .all(groupId, offer.id) as Array<{ id: string; team_id: string; tournament_plan_url: string | null }>
}

const deletePlanFileByUrl = (fileUrl: string | null | undefined) => {
  if (!fileUrl) {
    return
  }

  const filePath = path.join(uploadDir, path.basename(fileUrl))
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

router.post('/', upload.single('tournamentPlan'), (req: Request, res: Response) => {
  const { actorId, title, description, location, startsAt } = req.body as {
    actorId?: string
    title?: string
    description?: string
    location?: string
    startsAt?: string
  }
  const file = req.file
  const teamIds = parseTeamIds(req.body.teamIds as string | undefined)

  if (!actorId || !isAdminOrBoard(actorId)) {
    cleanupFile(file)
    res.status(403).json({ success: false, error: 'Nur Admin oder Vorstand duerfen Turniere anlegen.' })
    return
  }

  if (!teamIds.length || !title?.trim() || !startsAt) {
    cleanupFile(file)
    res.status(400).json({ success: false, error: 'Bitte mindestens eine Mannschaft, Titel und Datum angeben.' })
    return
  }

  const existingTeams = db
    .prepare(`SELECT id FROM teams WHERE id IN (${teamIds.map(() => '?').join(', ')})`)
    .all(...teamIds) as Array<{ id: string }>
  if (existingTeams.length !== teamIds.length) {
    cleanupFile(file)
    res.status(404).json({ success: false, error: 'Mindestens eine ausgewaehlte Mannschaft wurde nicht gefunden.' })
    return
  }

  const timestamp = now()
  const groupId = createId('tournamentgroup')
  const planUrl = file ? `/uploads/tournaments/${file.filename}` : null
  const insertOffer = db.prepare(`
    INSERT INTO tournament_offers (
      id,
      group_id,
      team_id,
      title,
      description,
      location,
      starts_at,
      tournament_plan_url,
      created_by,
      created_at,
      updated_at,
      response_status,
      registration_status,
      tournament_reply_status,
      trainer_notification_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'open', 'pending', ?)
  `)

  db.transaction(() => {
    teamIds.forEach((teamId) => {
      insertOffer.run(
        createId('tournament'),
        groupId,
        teamId,
        title.trim(),
        (description || '').trim(),
        (location || '').trim(),
        startsAt,
        planUrl,
        actorId,
        timestamp,
        timestamp,
        timestamp,
      )
    })
  })()

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.put('/:id', upload.single('tournamentPlan'), (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, title, description, location, startsAt, keepExistingPlan } = req.body as {
    actorId?: string
    title?: string
    description?: string
    location?: string
    startsAt?: string
    keepExistingPlan?: string
  }
  const file = req.file

  if (!actorId || !isAdminOrBoard(actorId)) {
    cleanupFile(file)
    res.status(403).json({ success: false, error: 'Nur Admin oder Vorstand duerfen Turniere bearbeiten.' })
    return
  }

  if (!title?.trim() || !startsAt) {
    cleanupFile(file)
    res.status(400).json({ success: false, error: 'Bitte Titel und Datum angeben.' })
    return
  }

  const groupRows = getOfferGroupRows(id)
  if (!groupRows.length) {
    cleanupFile(file)
    res.status(404).json({ success: false, error: 'Turnier nicht gefunden.' })
    return
  }

  const timestamp = now()
  const currentPlanUrl = groupRows.find((row) => row.tournament_plan_url)?.tournament_plan_url ?? null
  const nextPlanUrl = file
    ? `/uploads/tournaments/${file.filename}`
    : keepExistingPlan === 'true'
      ? currentPlanUrl
      : null

  db.transaction(() => {
    groupRows.forEach((row) => {
      db.prepare(`
        UPDATE tournament_offers
        SET
          title = ?,
          description = ?,
          location = ?,
          starts_at = ?,
          tournament_plan_url = ?,
          updated_at = ?,
          trainer_notification_at = ?
        WHERE id = ?
      `).run(
        title.trim(),
        (description || '').trim(),
        (location || '').trim(),
        startsAt,
        nextPlanUrl,
        timestamp,
        timestamp,
        row.id,
      )
    })
  })()

  if (file && currentPlanUrl && currentPlanUrl !== nextPlanUrl) {
    deletePlanFileByUrl(currentPlanUrl)
  }

  if (!file && keepExistingPlan !== 'true' && currentPlanUrl) {
    deletePlanFileByUrl(currentPlanUrl)
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/response', (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const status = req.body.status as TournamentResponseStatus | undefined
  const { id } = req.params

  if (!actorId || (status !== 'accepted' && status !== 'declined')) {
    res.status(400).json({ success: false, error: 'Fehlende Rueckmeldung.' })
    return
  }

  const actor = getUserRowById(actorId)
  if (!actor || actor.role !== 'trainer') {
    res.status(403).json({ success: false, error: 'Nur Trainer duerfen auf Turnieranfragen antworten.' })
    return
  }

  const offer = db
    .prepare('SELECT id, team_id FROM tournament_offers WHERE id = ?')
    .get(id) as { id: string; team_id: string } | undefined

  if (!offer) {
    res.status(404).json({ success: false, error: 'Turnier nicht gefunden.' })
    return
  }

  if (!canViewTournamentTeam(actorId, offer.team_id)) {
    res.status(403).json({ success: false, error: 'Du darfst nur fuer dein Team antworten.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    UPDATE tournament_offers
    SET
      response_status = ?,
      responded_by = ?,
      responded_at = ?,
      updated_at = ?,
      admin_notification_at = ?
    WHERE id = ?
  `).run(status, actorId, timestamp, timestamp, timestamp, id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/admin-status', (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const registrationStatus = req.body.registrationStatus as TournamentRegistrationStatus | undefined
  const tournamentReplyStatus = req.body.tournamentReplyStatus as TournamentReplyStatus | undefined
  const { id } = req.params

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Admin oder Vorstand duerfen Turnierstatus aendern.' })
    return
  }

  if (
    registrationStatus === undefined &&
    tournamentReplyStatus === undefined
  ) {
    res.status(400).json({ success: false, error: 'Bitte mindestens einen Status angeben.' })
    return
  }

  if (
    registrationStatus !== undefined &&
    registrationStatus !== 'open' &&
    registrationStatus !== 'registered' &&
    registrationStatus !== 'cancelled'
  ) {
    res.status(400).json({ success: false, error: 'Ungueltiger Anmeldestatus.' })
    return
  }

  if (
    tournamentReplyStatus !== undefined &&
    tournamentReplyStatus !== 'pending' &&
    tournamentReplyStatus !== 'accepted' &&
    tournamentReplyStatus !== 'declined'
  ) {
    res.status(400).json({ success: false, error: 'Ungueltige Turnierrueckmeldung.' })
    return
  }

  const offer = db.prepare('SELECT id FROM tournament_offers WHERE id = ?').get(id) as { id: string } | undefined
  if (!offer) {
    res.status(404).json({ success: false, error: 'Turnier nicht gefunden.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    UPDATE tournament_offers
    SET
      registration_status = COALESCE(?, registration_status),
      registration_updated_by = CASE WHEN ? IS NULL THEN registration_updated_by ELSE ? END,
      registration_updated_at = CASE WHEN ? IS NULL THEN registration_updated_at ELSE ? END,
      tournament_reply_status = COALESCE(?, tournament_reply_status),
      tournament_reply_updated_by = CASE WHEN ? IS NULL THEN tournament_reply_updated_by ELSE ? END,
      tournament_reply_updated_at = CASE WHEN ? IS NULL THEN tournament_reply_updated_at ELSE ? END,
      updated_at = ?,
      trainer_notification_at = ?
    WHERE id = ?
  `).run(
    registrationStatus ?? null,
    registrationStatus ?? null,
    actorId,
    registrationStatus ?? null,
    timestamp,
    tournamentReplyStatus ?? null,
    tournamentReplyStatus ?? null,
    actorId,
    tournamentReplyStatus ?? null,
    timestamp,
    timestamp,
    timestamp,
    id,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/:id', (req: Request, res: Response) => {
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)
  const { id } = req.params

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Admin oder Vorstand duerfen Turniere loeschen.' })
    return
  }

  const groupRows = getOfferGroupRows(id)
  if (!groupRows.length) {
    res.status(404).json({ success: false, error: 'Turnier nicht gefunden.' })
    return
  }

  db.transaction(() => {
    groupRows.forEach((row) => {
      db.prepare('DELETE FROM tournament_offers WHERE id = ?').run(row.id)
    })
  })()
  ;[...new Set(groupRows.map((row) => row.tournament_plan_url).filter(Boolean))].forEach((fileUrl) =>
    deletePlanFileByUrl(fileUrl),
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
