import { Router, type Request, type Response } from 'express'
import db, {
  createId,
  getTeamIdsByUserId,
  getUserRowById,
  isAdminOrBoard,
  now,
  userHasTeamRole,
} from '../db.js'

const router = Router()

const canAccessTeam = (actorId: string, teamId: string) =>
  isAdminOrBoard(actorId) || getTeamIdsByUserId(actorId).includes(teamId)

const canManageTeamEvents = (actorId: string, teamId: string) =>
  isAdminOrBoard(actorId) || userHasTeamRole(actorId, teamId, 'trainer')

const ensureTeamExists = (teamId: string) =>
  db.prepare('SELECT id, name FROM teams WHERE id = ?').get(teamId) as
    | { id: string; name: string }
    | undefined

const buildPayload = (teamId: string, actorId: string) => {
  const manualEvents = (
    db.prepare(
      `
        SELECT id, team_id, title, description, location, starts_at, ends_at, category, created_by, created_at
        FROM team_events
        WHERE team_id = ?
        ORDER BY starts_at ASC, created_at ASC
      `,
    ).all(teamId) as Array<{
      id: string
      team_id: string
      title: string
      description: string
      location: string
      starts_at: string
      ends_at: string
      category: string
      created_by: string
      created_at: string
    }>
  ).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    title: row.title,
    description: row.description || '',
    location: row.location || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at || null,
    category: row.category || 'training',
    sourceType: 'manual' as const,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }))

  const responseRows = db.prepare(
    `
      SELECT event_id, user_id, status
      FROM team_event_responses
      WHERE team_id = ?
    `,
  ).all(teamId) as Array<{
    event_id: string
    user_id: string
    status: 'accepted' | 'declined'
  }>

  const summaries = new Map<
    string,
    { eventId: string; acceptedCount: number; declinedCount: number; currentUserStatus: 'accepted' | 'declined' | null }
  >()

  responseRows.forEach((row) => {
    const current = summaries.get(row.event_id) ?? {
      eventId: row.event_id,
      acceptedCount: 0,
      declinedCount: 0,
      currentUserStatus: null,
    }

    if (row.status === 'accepted') {
      current.acceptedCount += 1
    }

    if (row.status === 'declined') {
      current.declinedCount += 1
    }

    if (row.user_id === actorId) {
      current.currentUserStatus = row.status
    }

    summaries.set(row.event_id, current)
  })

  const settingsRow = db.prepare(
    `
      SELECT response_close_hours_before
      FROM team_event_settings
      WHERE team_id = ?
    `,
  ).get(teamId) as { response_close_hours_before: number } | undefined

  return {
    manualEvents,
    responseSummaries: Array.from(summaries.values()),
    settings: {
      responseCloseHoursBefore: Number(settingsRow?.response_close_hours_before ?? 24),
    },
  }
}

router.get('/', (req: Request, res: Response) => {
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : ''
  const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : ''

  if (!teamId || !actorId) {
    res.status(400).json({ success: false, error: 'teamId und actorId sind erforderlich.' })
    return
  }

  const actor = getUserRowById(actorId)
  const team = ensureTeamExists(teamId)

  if (!actor || !team || !canAccessTeam(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Kein Zugriff auf diese Termine.' })
    return
  }

  res.json({
    success: true,
    teamId,
    ...buildPayload(teamId, actorId),
  })
})

router.post('/', (req: Request, res: Response) => {
  const {
    actorId,
    teamId,
    title,
    description,
    location,
    startsAt,
    endsAt,
    category,
    repeatWeekly,
    repeatUntil,
  } = req.body as {
    actorId?: string
    teamId?: string
    title?: string
    description?: string
    location?: string
    startsAt?: string
    endsAt?: string
    category?: string
    repeatWeekly?: boolean
    repeatUntil?: string
  }

  if (!actorId || !teamId || !title?.trim() || !startsAt) {
    res.status(400).json({ success: false, error: 'Bitte alle Pflichtfelder ausfuellen.' })
    return
  }

  const actor = getUserRowById(actorId)
  const team = ensureTeamExists(teamId)

  if (!actor || !team || !canManageTeamEvents(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Termine koennen nur von Trainer, Admin oder Vorstand gepflegt werden.' })
    return
  }

  const startDate = new Date(startsAt)
  const endDate = endsAt ? new Date(endsAt) : null
  const repeatUntilDate = repeatWeekly && repeatUntil ? new Date(repeatUntil) : null

  if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
    res.status(400).json({ success: false, error: 'Ungueltiges Datum.' })
    return
  }

  const occurrences: Array<{ startsAt: string; endsAt: string | null }> = []
  const maxOccurrences = 104
  const duration = endDate ? endDate.getTime() - startDate.getTime() : null

  if (!repeatWeekly || !repeatUntilDate || Number.isNaN(repeatUntilDate.getTime())) {
    occurrences.push({
      startsAt: startDate.toISOString(),
      endsAt: endDate ? endDate.toISOString() : null,
    })
  } else {
    let currentStart = new Date(startDate)
    let occurrenceCount = 0

    while (currentStart.getTime() <= repeatUntilDate.getTime() && occurrenceCount < maxOccurrences) {
      const currentEnd =
        duration !== null ? new Date(currentStart.getTime() + duration).toISOString() : null

      occurrences.push({
        startsAt: currentStart.toISOString(),
        endsAt: currentEnd,
      })

      currentStart = new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      occurrenceCount += 1
    }
  }

  const insertEvent = db.prepare(`
    INSERT INTO team_events (
      id, team_id, title, description, location, starts_at, ends_at, category, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const timestamp = now()

  occurrences.forEach((occurrence) => {
    insertEvent.run(
      createId('event'),
      teamId,
      title.trim(),
      description?.trim() ?? '',
      location?.trim() ?? '',
      occurrence.startsAt,
      occurrence.endsAt ?? '',
      category?.trim() || 'training',
      actorId,
      timestamp,
    )
  })

  res.json({
    success: true,
    createdCount: occurrences.length,
    ...buildPayload(teamId, actorId),
  })
})

router.put('/settings', (req: Request, res: Response) => {
  const { actorId, teamId, responseCloseHoursBefore } = req.body as {
    actorId?: string
    teamId?: string
    responseCloseHoursBefore?: number
  }

  if (!actorId || !teamId || typeof responseCloseHoursBefore !== 'number') {
    res.status(400).json({ success: false, error: 'Unvollstaendige Einstellungen.' })
    return
  }

  const actor = getUserRowById(actorId)
  const team = ensureTeamExists(teamId)

  if (!actor || !team || !canManageTeamEvents(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Termineinstellungen koennen nur von Trainer, Admin oder Vorstand geaendert werden.' })
    return
  }

  db.prepare(
    `
      INSERT INTO team_event_settings (team_id, response_close_hours_before, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(team_id) DO UPDATE SET
        response_close_hours_before = excluded.response_close_hours_before,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `,
  ).run(teamId, Math.max(0, Math.round(responseCloseHoursBefore)), actorId, now())

  res.json({
    success: true,
    ...buildPayload(teamId, actorId),
  })
})

router.post('/response', (req: Request, res: Response) => {
  const { actorId, teamId, eventId, status } = req.body as {
    actorId?: string
    teamId?: string
    eventId?: string
    status?: 'accepted' | 'declined' | null
  }

  if (!actorId || !teamId || !eventId) {
    res.status(400).json({ success: false, error: 'Ungueltige Rueckmeldung.' })
    return
  }

  const actor = getUserRowById(actorId)
  const team = ensureTeamExists(teamId)

  if (!actor || !team || !canAccessTeam(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Kein Zugriff auf diese Rueckmeldung.' })
    return
  }

  const manualEvent = db
    .prepare('SELECT id FROM team_events WHERE id = ? AND team_id = ?')
    .get(eventId, teamId) as { id: string } | undefined
  const matchEvent = db
    .prepare('SELECT id FROM matches WHERE id = ? AND team_id = ?')
    .get(eventId, teamId) as { id: string } | undefined

  if (!manualEvent && !matchEvent) {
    res.status(404).json({ success: false, error: 'Termin nicht gefunden.' })
    return
  }

  if (!status) {
    db.prepare('DELETE FROM team_event_responses WHERE event_id = ? AND user_id = ?').run(eventId, actorId)
  } else {
    db.prepare(
      `
        INSERT INTO team_event_responses (id, team_id, event_id, user_id, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id, user_id) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
    ).run(createId('event_response'), teamId, eventId, actorId, status, now())
  }

  res.json({
    success: true,
    ...buildPayload(teamId, actorId),
  })
})

router.delete('/:eventId', (req: Request, res: Response) => {
  const { eventId } = req.params
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : ''
  const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : ''

  if (!eventId || !teamId || !actorId) {
    res.status(400).json({ success: false, error: 'Ungueltige Anfrage.' })
    return
  }

  const actor = getUserRowById(actorId)
  const event = db
    .prepare('SELECT id FROM team_events WHERE id = ? AND team_id = ?')
    .get(eventId, teamId) as { id: string } | undefined

  if (!actor || !event || !canManageTeamEvents(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Nur Trainer, Admin oder Vorstand duerfen Termine loeschen.' })
    return
  }

  db.prepare('DELETE FROM team_events WHERE id = ?').run(eventId)
  db.prepare('DELETE FROM team_event_responses WHERE event_id = ?').run(eventId)

  res.json({
    success: true,
    ...buildPayload(teamId, actorId),
  })
})

export default router
