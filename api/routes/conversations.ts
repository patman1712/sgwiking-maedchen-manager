import { Router, type Request, type Response } from 'express'
import db, {
  createId,
  getBootstrapData,
  getTeamIdsByUserId,
  getUserRowById,
  userHasTeamRole,
  now,
} from '../db.js'

const router = Router()

router.post('/team', (req: Request, res: Response) => {
  const { teamId, actorId, title, createNew } = req.body as {
    teamId?: string
    actorId?: string
    title?: string
    createNew?: boolean
  }

  if (!teamId || !actorId) {
    res.status(400).json({ success: false, error: 'teamId fehlt.' })
    return
  }

  const actor = getUserRowById(actorId)
  if (!actor) {
    res.status(403).json({ success: false, error: 'Zugriff verweigert.' })
    return
  }

  const canAccessTeamConversation =
    actor.role === 'admin' ||
    actor.role === 'board' ||
    getTeamIdsByUserId(actorId).includes(teamId)

  if (!canAccessTeamConversation) {
    res.status(403).json({ success: false, error: 'Kein Zugriff auf diesen Teamchat.' })
    return
  }

  if (!createNew) {
    const existing = db
      .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team' ORDER BY created_at ASC LIMIT 1")
      .get(teamId) as { id: string } | undefined

    if (existing) {
      res.json({ success: true, conversationId: existing.id, ...getBootstrapData(actorId) })
      return
    }
  } else {
    const canCreateNewTeamChannel =
      actor.role === 'admin' ||
      (actor.role === 'trainer' && userHasTeamRole(actorId, teamId, 'trainer'))

    if (!canCreateNewTeamChannel) {
      res.status(403).json({ success: false, error: 'Nur Trainer duerfen neue Teamkanaele anlegen.' })
      return
    }

    if (!title?.trim()) {
      res.status(400).json({ success: false, error: 'Bitte ein Thema/Titel fuer den Teamchannel angeben.' })
      return
    }
  }

  const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId) as { name: string } | undefined
  if (!team) {
    res.status(404).json({ success: false, error: 'Team nicht gefunden.' })
    return
  }

  const timestamp = now()
  const conversationId = createId('conversation')
  const channelTitle = createNew ? `${team.name} • ${title?.trim()}` : `${team.name} Teamchat`
  db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, 'team', ?, ?, ?)
  `).run(conversationId, channelTitle, teamId, timestamp, timestamp)

  const memberIds = (
    db.prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(teamId) as { user_id: string }[]
  ).map((row) => row.user_id)

  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `)
  memberIds.forEach((userId) => {
    insertParticipant.run(createId('participant'), conversationId, userId, timestamp)
  })

  res.json({ success: true, conversationId, ...getBootstrapData(actorId) })
})

router.post('/direct', (req: Request, res: Response) => {
  const { currentUserId, otherUserId } = req.body as {
    currentUserId?: string
    otherUserId?: string
  }

  if (!currentUserId || !otherUserId || currentUserId === otherUserId) {
    res.status(400).json({ success: false, error: 'Ungueltige Teilnehmer.' })
    return
  }

  const rows = db.prepare(`
    SELECT c.id
    FROM conversations c
    JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
    JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
    WHERE c.type = 'direct' AND cp1.user_id = ? AND cp2.user_id = ?
  `).all(currentUserId, otherUserId) as { id: string }[]

  const existing = rows.find((row) => {
    const count = db
      .prepare('SELECT COUNT(*) AS count FROM conversation_participants WHERE conversation_id = ?')
      .get(row.id) as { count: number }
    return count.count === 2
  })

  if (existing) {
    res.json({ success: true, conversationId: existing.id, ...getBootstrapData(currentUserId) })
    return
  }

  const users = db
    .prepare('SELECT id, full_name FROM users WHERE id IN (?, ?)')
    .all(currentUserId, otherUserId) as { id: string; full_name: string }[]

  if (users.length !== 2) {
    res.status(404).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return
  }

  const title = users.map((user) => user.full_name).sort((a, b) => a.localeCompare(b, 'de')).join(' & ')
  const timestamp = now()
  const conversationId = createId('conversation')

  db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, 'direct', NULL, ?, ?)
  `).run(conversationId, title, timestamp, timestamp)

  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `)
  ;[currentUserId, otherUserId].forEach((userId) => {
    insertParticipant.run(createId('participant'), conversationId, userId, timestamp)
  })

  res.json({ success: true, conversationId, ...getBootstrapData(currentUserId) })
})

router.post('/group', (req: Request, res: Response) => {
  const { actorId, participantIds, title } = req.body as {
    actorId?: string
    participantIds?: string[]
    title?: string
  }

  if (!actorId || !Array.isArray(participantIds) || participantIds.length < 2) {
    res.status(400).json({ success: false, error: 'Ungueltige Teilnehmer.' })
    return
  }

  const actor = getUserRowById(actorId)
  if (!actor) {
    res.status(403).json({ success: false, error: 'Zugriff verweigert.' })
    return
  }

  const uniqueParticipants = Array.from(new Set([actorId, ...participantIds])).filter(Boolean)

  if (uniqueParticipants.length < 2) {
    res.status(400).json({ success: false, error: 'Ungueltige Teilnehmer.' })
    return
  }

  const users = db
    .prepare(`SELECT id, full_name FROM users WHERE id IN (${uniqueParticipants.map(() => '?').join(', ')})`)
    .all(...uniqueParticipants) as { id: string; full_name: string }[]

  if (users.length !== uniqueParticipants.length) {
    res.status(404).json({ success: false, error: 'Ein oder mehrere Benutzer wurden nicht gefunden.' })
    return
  }

  const timestamp = now()
  const conversationId = createId('conversation')
  const generatedTitle = users
    .map((user) => user.full_name)
    .sort((a, b) => a.localeCompare(b, 'de'))
    .slice(0, 4)
    .join(', ')

  db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, 'direct', NULL, ?, ?)
  `).run(conversationId, title?.trim() || `Gruppe: ${generatedTitle}`, timestamp, timestamp)

  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `)
  uniqueParticipants.forEach((userId) => {
    insertParticipant.run(createId('participant'), conversationId, userId, timestamp)
  })

  res.json({ success: true, conversationId, ...getBootstrapData(actorId) })
})

router.delete('/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params as { conversationId: string }
  const { actorId } = req.body as { actorId?: string }

  if (!conversationId || !actorId) {
    res.status(400).json({ success: false, error: 'Ungueltige Anfrage.' })
    return
  }

  const actor = getUserRowById(actorId)
  if (!actor) {
    res.status(403).json({ success: false, error: 'Zugriff verweigert.' })
    return
  }

  const conversation = db
    .prepare('SELECT id, type, team_id FROM conversations WHERE id = ?')
    .get(conversationId) as
    | { id: string; type: 'team' | 'direct'; team_id: string | null }
    | undefined

  if (!conversation) {
    res.status(404).json({ success: false, error: 'Konversation nicht gefunden.' })
    return
  }

  if (actor.role !== 'admin') {
    if (conversation.type === 'direct') {
      const isParticipant = Boolean(
        db
          .prepare(
            'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
          )
          .get(conversationId, actorId),
      )

      if (!isParticipant) {
        res.status(403).json({ success: false, error: 'Kein Zugriff auf diese Konversation.' })
        return
      }
    } else {
      if (!conversation.team_id || !userHasTeamRole(actorId, conversation.team_id, 'trainer')) {
        res.status(403).json({ success: false, error: 'Nur Trainer duerfen Teamchats loeschen.' })
        return
      }
    }
  }

  db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId)

  res.json({ success: true, ...getBootstrapData(actorId) })
})

export default router
