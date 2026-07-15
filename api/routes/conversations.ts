import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, getTeamIdsByUserId, getUserRowById, now } from '../db.js'

const router = Router()

router.post('/team', (req: Request, res: Response) => {
  const { teamId, actorId } = req.body as { teamId?: string; actorId?: string }

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

  const existing = db
    .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team'")
    .get(teamId) as { id: string } | undefined

  if (existing) {
    res.json({ success: true, conversationId: existing.id, ...getBootstrapData(actorId) })
    return
  }

  const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId) as { name: string } | undefined
  if (!team) {
    res.status(404).json({ success: false, error: 'Team nicht gefunden.' })
    return
  }

  const timestamp = now()
  const conversationId = createId('conversation')
  db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, 'team', ?, ?, ?)
  `).run(conversationId, `${team.name} Teamchat`, teamId, timestamp, timestamp)

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

export default router
