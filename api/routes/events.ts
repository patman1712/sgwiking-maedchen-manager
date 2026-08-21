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

type EventResponseDetail = {
  userId: string
  fullName: string
  status: 'accepted' | 'declined'
}

type TournamentEvent = {
  id: string
  teamId: string
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: null
  category: string
  sourceType: 'tournament'
  createdBy: string
  createdAt: string
  tournamentPlanUrl: string | null
}

const buildPayload = (teamId: string, actorId: string) => {
  const manualEvents = (
    db.prepare(
      `
        SELECT id, team_id, title, description, location, starts_at, ends_at, category, created_by, created_at,
               recurrence_id, recurrence_pattern, recurrence_ordinal, recurrence_total, recurrence_edited_individually
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
    recurrenceId: (row as { recurrence_id?: string }).recurrence_id || '',
    recurrencePattern: (row as { recurrence_pattern?: string }).recurrence_pattern || '',
    recurrenceOrdinal: Number((row as { recurrence_ordinal?: number }).recurrence_ordinal ?? 0),
    recurrenceTotal: Number((row as { recurrence_total?: number }).recurrence_total ?? 0),
    recurrenceEditedIndividually:
      Number((row as { recurrence_edited_individually?: number }).recurrence_edited_individually ?? 0) === 1,
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
  const responseDetails = new Map<string, EventResponseDetail[]>()

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

    const user = getUserRowById(row.user_id)
    const existingDetails = responseDetails.get(row.event_id) ?? []
    if (user) {
      existingDetails.push({
        userId: row.user_id,
        fullName: user.full_name,
        status: row.status,
      })
      existingDetails.sort((left, right) => left.fullName.localeCompare(right.fullName, 'de'))
      responseDetails.set(row.event_id, existingDetails)
    }
  })

  const settingsRow = db.prepare(
    `
      SELECT response_close_hours_before
      FROM team_event_settings
      WHERE team_id = ?
    `,
  ).get(teamId) as { response_close_hours_before: number } | undefined

  const tournamentEvents = (
    db.prepare(
      `
        SELECT id, team_id, title, description, location, starts_at, tournament_plan_url, created_by, created_at
        FROM tournament_offers
        WHERE team_id = ? AND response_status = 'accepted'
        ORDER BY starts_at ASC, created_at ASC
      `,
    ).all(teamId) as Array<{
      id: string
      team_id: string
      title: string
      description: string
      location: string
      starts_at: string
      tournament_plan_url: string | null
      created_by: string
      created_at: string
    }>
  ).map(
    (row): TournamentEvent => ({
      id: row.id,
      teamId: row.team_id,
      title: row.title,
      description: row.description || '',
      location: row.location || '',
      startsAt: row.starts_at,
      endsAt: null,
      category: 'turnier',
      sourceType: 'tournament',
      createdBy: row.created_by,
      createdAt: row.created_at,
      tournamentPlanUrl: row.tournament_plan_url || null,
    }),
  )

  return {
    manualEvents,
    tournamentEvents,
    responseSummaries: Array.from(summaries.values()),
    responseDetails: Array.from(responseDetails.entries()).map(([eventId, responses]) => ({
      eventId,
      acceptedUsers: responses
        .filter((entry) => entry.status === 'accepted')
        .map(({ userId, fullName }) => ({ userId, fullName })),
      declinedUsers: responses
        .filter((entry) => entry.status === 'declined')
        .map(({ userId, fullName }) => ({ userId, fullName })),
    })),
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
      id, team_id, title, description, location, starts_at, ends_at, category, created_by, created_at,
      recurrence_id, recurrence_pattern, recurrence_ordinal, recurrence_total, recurrence_edited_individually
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `)
  const timestamp = now()
  const recurrenceId = repeatWeekly && occurrences.length > 1 ? createId('recurrence') : ''
  const pattern = repeatWeekly && occurrences.length > 1 ? 'weekly' : ''
  const total = occurrences.length

  occurrences.forEach((occurrence, index) => {
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
      recurrenceId,
      pattern,
      index + 1,
      total,
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

type RecurrenceScope = 'single' | 'this_and_future' | 'all'

const validateRecurrenceScope = (value: unknown): RecurrenceScope => {
  if (value === 'single' || value === 'this_and_future' || value === 'all') {
    return value
  }
  return 'single'
}

const getRecurrenceRelatedEvents = (
  teamId: string,
  baseEvent: {
    id: string
    recurrence_id: string
    starts_at: string
    recurrence_edited_individually: number
  },
  scope: RecurrenceScope,
) => {
  const baseStartsAt = new Date(baseEvent.starts_at).getTime()
  const baseOrdinalRow = db
    .prepare(
      'SELECT recurrence_ordinal FROM team_events WHERE id = ? AND team_id = ? LIMIT 1',
    )
    .get(baseEvent.id, teamId) as { recurrence_ordinal: number } | undefined
  const baseOrdinal = Number(baseOrdinalRow?.recurrence_ordinal ?? 0)

  if (!baseEvent.recurrence_id || baseEvent.recurrence_edited_individually === 1 || scope === 'single') {
    return {
      toModify: [baseEvent.id],
      toRemoveFromRecurrence: [] as string[],
      newRecurrenceId: '',
    }
  }

  if (scope === 'all') {
    const rowIds = (
      db
        .prepare(
          'SELECT id FROM team_events WHERE team_id = ? AND recurrence_id = ? ORDER BY starts_at ASC',
        )
        .all(teamId, baseEvent.recurrence_id) as Array<{ id: string }>
    ).map((row) => row.id)
    return { toModify: rowIds, toRemoveFromRecurrence: [] as string[], newRecurrenceId: '' }
  }

  const futureRows = (
    db
      .prepare(
        'SELECT id, starts_at, recurrence_ordinal FROM team_events WHERE team_id = ? AND recurrence_id = ? ORDER BY starts_at ASC',
      )
      .all(teamId, baseEvent.recurrence_id) as Array<{
      id: string
      starts_at: string
      recurrence_ordinal: number
    }>
  ).filter((row) => {
    const startsAt = new Date(row.starts_at).getTime()
    return (
      startsAt >= baseStartsAt ||
      (Number.isFinite(baseOrdinal) && baseOrdinal > 0 && Number(row.recurrence_ordinal) >= baseOrdinal)
    )
  })

  const futureIds = futureRows.map((row) => row.id)
  return {
    toModify: futureIds,
    toRemoveFromRecurrence: futureIds,
    newRecurrenceId: createId('recurrence'),
  }
}

router.put('/:eventId', (req: Request, res: Response) => {
  const { eventId } = req.params
  const {
    actorId,
    title,
    description,
    location,
    startsAt,
    endsAt,
    category,
    scope,
  } = req.body as {
    actorId?: string
    title?: string
    description?: string
    location?: string
    startsAt?: string
    endsAt?: string
    category?: string
    scope?: unknown
  }

  if (!eventId || !actorId) {
    res.status(400).json({ success: false, error: 'Ungueltige Anfrage.' })
    return
  }

  const actor = getUserRowById(actorId)
  const eventRow = db
    .prepare(
      `SELECT id, team_id, recurrence_id, starts_at, recurrence_edited_individually
       FROM team_events WHERE id = ? LIMIT 1`,
    )
    .get(eventId) as
    | {
      id: string
      team_id: string
      recurrence_id: string
      starts_at: string
      recurrence_edited_individually: number
    }
    | undefined

  if (!eventRow) {
    res.status(404).json({ success: false, error: 'Termin nicht gefunden.' })
    return
  }

  if (!actor || !canManageTeamEvents(actorId, eventRow.team_id)) {
    res.status(403).json({ success: false, error: 'Termine koennen nur von Trainer, Admin oder Vorstand bearbeitet werden.' })
    return
  }

  const normalizedScope = validateRecurrenceScope(scope)
  const related = getRecurrenceRelatedEvents(eventRow.team_id, eventRow, normalizedScope)

  const current = db
    .prepare(
      `SELECT * FROM team_events WHERE id = ? AND team_id = ? LIMIT 1`,
    )
    .get(eventId, eventRow.team_id) as {
    title: string
    description: string
    location: string
    starts_at: string
    ends_at: string
    category: string
  }

  const nextTitle = title?.trim() ?? current.title
  const nextDescription = description?.trim() ?? current.description
  const nextLocation = location?.trim() ?? current.location
  const nextCategory = category?.trim() || current.category || 'training'
  const rawNextStartsAt = startsAt ?? current.starts_at
  const rawNextEndsAt = endsAt ?? current.ends_at
  const nextStartsAtDate = new Date(rawNextStartsAt)
  const nextEndsAtDate = rawNextEndsAt ? new Date(rawNextEndsAt) : null
  if (Number.isNaN(nextStartsAtDate.getTime()) || (nextEndsAtDate && Number.isNaN(nextEndsAtDate.getTime()))) {
    res.status(400).json({ success: false, error: 'Ungueltiges Datum/Uhrzeit.' })
    return
  }

  const durationMs =
    nextEndsAtDate
      ? nextEndsAtDate.getTime() - nextStartsAtDate.getTime()
      : (current.ends_at ? new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime() : 0)

  const updateOne = db.prepare(`
    UPDATE team_events
    SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, category = ?,
        recurrence_edited_individually = CASE WHEN ? = 1 THEN 1 ELSE recurrence_edited_individually END,
        recurrence_id = COALESCE(NULLIF(?, ''), recurrence_id)
    WHERE id = ? AND team_id = ?
  `)

  let modified = 0
  related.toModify.forEach((id, index) => {
    const row = db.prepare('SELECT starts_at FROM team_events WHERE id = ? AND team_id = ?').get(
      id,
      eventRow.team_id,
    ) as { starts_at: string } | undefined
    if (!row) {
      return
    }

    let effectiveStart: Date
    let effectiveEnd: string | null

    if (normalizedScope === 'single') {
      effectiveStart = nextStartsAtDate
      effectiveEnd = nextEndsAtDate ? nextEndsAtDate.toISOString() : null
    } else if (normalizedScope === 'all') {
      if (index === 0) {
        effectiveStart = nextStartsAtDate
        effectiveEnd = nextEndsAtDate ? nextEndsAtDate.toISOString() : null
      } else {
        const prevRow = db
          .prepare('SELECT starts_at FROM team_events WHERE id = ? AND team_id = ?')
          .get(related.toModify[index - 1], eventRow.team_id) as { starts_at: string } | undefined
        const prevStart = prevRow ? new Date(prevRow.starts_at) : nextStartsAtDate
        effectiveStart = new Date(prevStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        effectiveEnd = durationMs ? new Date(effectiveStart.getTime() + durationMs).toISOString() : null
      }
    } else {
      if (id === eventId) {
        effectiveStart = nextStartsAtDate
        effectiveEnd = nextEndsAtDate ? nextEndsAtDate.toISOString() : null
      } else {
        const prevId = related.toModify[index - 1]
        const prevRow = prevId
          ? (db
              .prepare('SELECT starts_at FROM team_events WHERE id = ? AND team_id = ?')
              .get(prevId, eventRow.team_id) as { starts_at: string } | undefined)
          : undefined
        const prevStart = prevRow ? new Date(prevRow.starts_at) : nextStartsAtDate
        effectiveStart = new Date(prevStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        effectiveEnd = durationMs ? new Date(effectiveStart.getTime() + durationMs).toISOString() : null
      }
    }

    const newRecurrenceIdForRow =
      normalizedScope === 'this_and_future' && related.toRemoveFromRecurrence.includes(id)
        ? related.newRecurrenceId
        : ''

    updateOne.run(
      nextTitle,
      nextDescription,
      nextLocation,
      effectiveStart.toISOString(),
      effectiveEnd ?? '',
      nextCategory,
      normalizedScope === 'single' ? 1 : 0,
      newRecurrenceIdForRow,
      id,
      eventRow.team_id,
    )
    modified += 1
  })

  if (normalizedScope === 'this_and_future' && related.newRecurrenceId) {
    const remaining = (
      db
        .prepare(
          'SELECT id, recurrence_ordinal FROM team_events WHERE team_id = ? AND recurrence_id = ? ORDER BY starts_at ASC',
        )
        .all(eventRow.team_id, eventRow.recurrence_id) as Array<{ id: string; recurrence_ordinal: number }>
    )
    const newTotal = remaining.length
    const oldTotalForNew = related.toRemoveFromRecurrence.length
    remaining.forEach((row, idx) => {
      db.prepare('UPDATE team_events SET recurrence_total = ?, recurrence_ordinal = ? WHERE id = ?').run(
        newTotal,
        idx + 1,
        row.id,
      )
    })
    ;(
      db
        .prepare(
          'SELECT id, recurrence_ordinal FROM team_events WHERE team_id = ? AND recurrence_id = ? ORDER BY starts_at ASC',
        )
        .all(eventRow.team_id, related.newRecurrenceId) as Array<{ id: string; recurrence_ordinal: number }>
    ).forEach((row, idx) => {
      db.prepare('UPDATE team_events SET recurrence_total = ?, recurrence_ordinal = ? WHERE id = ?').run(
        oldTotalForNew,
        idx + 1,
        row.id,
      )
    })
  }

  if (normalizedScope === 'all' && eventRow.recurrence_id) {
    const allRowIds = (
      db
        .prepare(
          'SELECT id FROM team_events WHERE team_id = ? AND recurrence_id = ? ORDER BY starts_at ASC',
        )
        .all(eventRow.team_id, eventRow.recurrence_id) as Array<{ id: string }>
    ).map((row) => row.id)
    allRowIds.forEach((_id, idx) => {
      db.prepare('UPDATE team_events SET recurrence_ordinal = ?, recurrence_total = ? WHERE id = ?').run(
        idx + 1,
        allRowIds.length,
        related.toModify[idx],
      )
    })
  }

  res.json({
    success: true,
    modifiedCount: modified,
    scope: normalizedScope,
    ...buildPayload(eventRow.team_id, actorId),
  })
})

router.delete('/:eventId', (req: Request, res: Response) => {
  const { eventId } = req.params
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : ''
  const actorId =
    (typeof req.query.actorId === 'string' ? req.query.actorId : '') ||
    (req.body?.actorId as string | undefined) ||
    ''
  const scope = validateRecurrenceScope(
    (req.body as { scope?: unknown } | null)?.scope ?? req.query.scope,
  )

  if (!eventId || !teamId || !actorId) {
    res.status(400).json({ success: false, error: 'Ungueltige Anfrage.' })
    return
  }

  const actor = getUserRowById(actorId)
  const event = db
    .prepare(
      `SELECT id, team_id, recurrence_id, starts_at, recurrence_edited_individually
       FROM team_events WHERE id = ? AND team_id = ? LIMIT 1`,
    )
    .get(eventId, teamId) as
    | {
      id: string
      team_id: string
      recurrence_id: string
      starts_at: string
      recurrence_edited_individually: number
    }
    | undefined

  if (!actor || !event || !canManageTeamEvents(actorId, teamId)) {
    res.status(403).json({ success: false, error: 'Nur Trainer, Admin oder Vorstand duerfen Termine loeschen.' })
    return
  }

  const related = getRecurrenceRelatedEvents(teamId, event, scope)
  let removed = 0
  related.toModify.forEach((id) => {
    const found = db.prepare('SELECT id FROM team_events WHERE id = ? AND team_id = ?').get(id, teamId)
    if (!found) {
      return
    }
    db.prepare('DELETE FROM team_events WHERE id = ? AND team_id = ?').run(id, teamId)
    db.prepare('DELETE FROM team_event_responses WHERE event_id = ?').run(id)
    removed += 1
  })

  if (scope === 'this_and_future' && event.recurrence_id) {
    const remaining = (
      db
        .prepare(
          'SELECT id FROM team_events WHERE team_id = ? AND recurrence_id = ? ORDER BY starts_at ASC',
        )
        .all(teamId, event.recurrence_id) as Array<{ id: string }>
    )
    remaining.forEach((row, idx) => {
      db.prepare('UPDATE team_events SET recurrence_ordinal = ?, recurrence_total = ? WHERE id = ?').run(
        idx + 1,
        remaining.length,
        row.id,
      )
    })
  }

  res.json({
    success: true,
    deletedCount: removed,
    scope,
    ...buildPayload(teamId, actorId),
  })
})

export default router
