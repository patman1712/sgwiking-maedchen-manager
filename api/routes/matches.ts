import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, isAdminOrBoard, now, userHasTeamRole } from '../db.js'

const router = Router()

const canManageMatches = (actorId: string, teamId: string) =>
  isAdminOrBoard(actorId) || userHasTeamRole(actorId, teamId, 'trainer')

router.post('/', (req: Request, res: Response) => {
  const { actorId, teamId, opponent, kickoffAt, location, isHome, result } = req.body as {
    actorId?: string
    teamId?: string
    opponent?: string
    kickoffAt?: string
    location?: string
    isHome?: boolean
    result?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!teamId || !opponent || !kickoffAt || !location) {
    res.status(400).json({ success: false, error: 'Bitte alle Pflichtfelder ausfuellen.' })
    return
  }

  if (!canManageMatches(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Spiele koennen nur von zustaendigen Trainern, Admin oder Vorstand gepflegt werden.' })
    return
  }

  const matchId = createId('match')
  const timestamp = now()

  db.prepare(`
    INSERT INTO matches (id, team_id, opponent, kickoff_at, location, is_home, result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(matchId, teamId, opponent, kickoffAt, location, isHome === false ? 0 : 1, result ?? '', timestamp)

  res.json({
    success: true,
    matchId,
    ...getBootstrapData(actorId),
  })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, opponent, kickoffAt, location, isHome, result } = req.body as {
    actorId?: string
    opponent?: string
    kickoffAt?: string
    location?: string
    isHome?: boolean
    result?: string
  }

  const match = db
    .prepare('SELECT id, team_id FROM matches WHERE id = ?')
    .get(id) as { id: string; team_id: string } | undefined

  if (!match) {
    res.status(404).json({ success: false, error: 'Spiel nicht gefunden.' })
    return
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageMatches(actorId, match.team_id)) {
    res.status(403).json({ success: false, error: 'Spiele koennen nur von zustaendigen Trainern, Admin oder Vorstand gepflegt werden.' })
    return
  }

  const current = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as {
    opponent: string
    kickoff_at: string
    location: string
    is_home: number
    result: string
  }

  db.prepare(`
    UPDATE matches
    SET opponent = ?, kickoff_at = ?, location = ?, is_home = ?, result = ?
    WHERE id = ?
  `).run(
    opponent ?? current.opponent,
    kickoffAt ?? current.kickoff_at,
    location ?? current.location,
    typeof isHome === 'boolean' ? (isHome ? 1 : 0) : current.is_home,
    result ?? current.result,
    id,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  const match = db
    .prepare('SELECT id, team_id FROM matches WHERE id = ?')
    .get(id) as { id: string; team_id: string } | undefined

  if (!match) {
    res.status(404).json({ success: false, error: 'Spiel nicht gefunden.' })
    return
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageMatches(actorId, match.team_id)) {
    res.status(403).json({ success: false, error: 'Spiele koennen nur von zustaendigen Trainern, Admin oder Vorstand geloescht werden.' })
    return
  }

  db.prepare('DELETE FROM matches WHERE id = ?').run(id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
