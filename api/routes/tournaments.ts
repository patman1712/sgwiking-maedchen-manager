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
  const { actorId, teamId, title, description, location, startsAt } = req.body as {
    actorId?: string
    teamId?: string
    title?: string
    description?: string
    location?: string
    startsAt?: string
  }
  const file = req.file

  if (!actorId || !isAdminOrBoard(actorId)) {
    cleanupFile(file)
    res.status(403).json({ success: false, error: 'Nur Admin oder Vorstand duerfen Turniere anlegen.' })
    return
  }

  if (!teamId || !title?.trim() || !startsAt) {
    cleanupFile(file)
    res.status(400).json({ success: false, error: 'Bitte Mannschaft, Titel und Datum angeben.' })
    return
  }

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId) as { id: string } | undefined
  if (!team) {
    cleanupFile(file)
    res.status(404).json({ success: false, error: 'Mannschaft nicht gefunden.' })
    return
  }

  db.prepare(`
    INSERT INTO tournament_offers (
      id,
      team_id,
      title,
      description,
      location,
      starts_at,
      tournament_plan_url,
      created_by,
      created_at,
      updated_at,
      response_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    createId('tournament'),
    teamId,
    title.trim(),
    (description || '').trim(),
    (location || '').trim(),
    startsAt,
    file ? `/uploads/tournaments/${file.filename}` : null,
    actorId,
    now(),
    now(),
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/response', (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const status = req.body.status as 'accepted' | 'declined' | undefined
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
      updated_at = ?
    WHERE id = ?
  `).run(status, actorId, timestamp, timestamp, id)

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

  const offer = db
    .prepare('SELECT id, tournament_plan_url FROM tournament_offers WHERE id = ?')
    .get(id) as { id: string; tournament_plan_url: string | null } | undefined

  if (!offer) {
    res.status(404).json({ success: false, error: 'Turnier nicht gefunden.' })
    return
  }

  db.prepare('DELETE FROM tournament_offers WHERE id = ?').run(id)
  deletePlanFileByUrl(offer.tournament_plan_url)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
