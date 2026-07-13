import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, isAdminOrBoard, now } from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

router.post('/', (req: Request, res: Response) => {
  const { name, ageGroup, season, trainingDay, location, notes } = req.body as Record<string, string>

  if (!name || !ageGroup || !season || !trainingDay || !location) {
    res.status(400).json({ success: false, error: 'Bitte alle Pflichtfelder ausfuellen.' })
    return
  }

  const teamId = createId('team')
  const timestamp = now()

  db.prepare(`
    INSERT INTO teams (id, name, age_group, season, training_day, location, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(teamId, name, ageGroup, season, trainingDay, location, notes ?? '', timestamp)

  db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, 'team', ?, ?, ?)
  `).run(createId('conversation'), `${name} Teamchat`, teamId, timestamp, timestamp)

  res.json({
    success: true,
    teamId,
    ...getBootstrapData(null),
  })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { name, ageGroup, season, trainingDay, location, notes } = req.body as Record<string, string>

  db.prepare(`
    UPDATE teams
    SET name = ?, age_group = ?, season = ?, training_day = ?, location = ?, notes = ?
    WHERE id = ?
  `).run(name, ageGroup, season, trainingDay, location, notes ?? '', id)

  db.prepare(`
    UPDATE conversations
    SET title = ?
    WHERE team_id = ? AND type = 'team'
  `).run(`${name} Teamchat`, id)

  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

router.put('/:id/members', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, trainerIds, playerIds } = req.body as {
    actorId?: string
    trainerIds?: string[]
    playerIds?: string[]
  }

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Teamzuweisungen koennen nur von Admin oder Vorstand geaendert werden.',
    })
    return
  }

  const timestamp = now()
  const nextTrainerIds = trainerIds ?? []
  const nextPlayerIds = playerIds ?? []
  const keepIds = new Set([...nextTrainerIds, ...nextPlayerIds])

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM team_members WHERE team_id = ? AND membership_role IN (?, ?)').run(
      id,
      'trainer',
      'player',
    )

    const insertMember = db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, membership_role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    nextTrainerIds.forEach((userId) => {
      insertMember.run(createId('member'), id, userId, 'trainer', timestamp)
    })

    nextPlayerIds.forEach((userId) => {
      insertMember.run(createId('member'), id, userId, 'player', timestamp)
    })

    const adminIds = (
      db.prepare("SELECT id FROM users WHERE role IN ('admin', 'board')").all() as { id: string }[]
    ).map((row) => row.id)

    const teamConversation = db
      .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team'")
      .get(id) as { id: string } | undefined

    if (teamConversation) {
      db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ?').run(
        teamConversation.id,
      )

      const participantIds = Array.from(new Set([...adminIds, ...keepIds]))
      const insertParticipant = db.prepare(`
        INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
        VALUES (?, ?, ?, ?)
      `)

      participantIds.forEach((userId) => {
        insertParticipant.run(createId('participant'), teamConversation.id, userId, timestamp)
      })
    }
  })

  transaction()

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
