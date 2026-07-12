import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, now } from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

router.post('/', (req: Request, res: Response) => {
  const { fullName, email, password, phone, role, teamIds, notes } = req.body as {
    fullName?: string
    email?: string
    password?: string
    phone?: string
    role?: 'admin' | 'trainer' | 'player' | 'board'
    teamIds?: string[]
    notes?: string
  }

  if (!fullName || !email || !password || !role) {
    res.status(400).json({ success: false, error: 'Bitte alle Pflichtfelder ausfuellen.' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)

  if (existing) {
    res.status(409).json({ success: false, error: 'Diese E-Mail ist bereits vergeben.' })
    return
  }

  const userId = createId('user')
  const timestamp = now()
  const insertUser = db.prepare(`
    INSERT INTO users (id, full_name, email, password, phone, role, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMember = db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, membership_role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    insertUser.run(
      userId,
      fullName,
      normalizedEmail,
      bcrypt.hashSync(password, 10),
      phone ?? '',
      role,
      notes ?? '',
      timestamp,
    )

    ;(role === 'board' ? [] : teamIds ?? []).forEach((teamId) => {
      insertMember.run(
        createId('member'),
        teamId,
        userId,
        role === 'player' ? 'player' : role === 'trainer' ? 'trainer' : 'admin',
        timestamp,
      )

      const conversation = db
        .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team'")
        .get(teamId) as { id: string } | undefined

      if (conversation) {
        insertParticipant.run(createId('participant'), conversation.id, userId, timestamp)
      }
    })
  })

  transaction()

  res.json({
    success: true,
    userId,
    ...getBootstrapData(null),
  })
})

export default router
