import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import db, {
  canEditPlayer,
  createId,
  getBootstrapData,
  getUserRowById,
  isAdminOrBoard,
  now,
} from '../db.js'

const router = Router()

const ensureTeamConversationParticipant = (teamId: string, userId: string, timestamp: string) => {
  const conversation = db
    .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team'")
    .get(teamId) as { id: string } | undefined

  if (!conversation) {
    return
  }

  const exists = db
    .prepare(
      'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
    )
    .get(conversation.id, userId) as { id: string } | undefined

  if (exists) {
    return
  }

  db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(createId('participant'), conversation.id, userId, timestamp)
}

router.post('/', (req: Request, res: Response) => {
  const {
    actorId,
    teamId,
    fullName,
    email,
    phone,
    birthday,
    address,
    parentName,
    parentPhone,
    parentEmail,
    notes,
  } = req.body as {
    actorId?: string
    teamId?: string
    fullName?: string
    email?: string
    phone?: string
    birthday?: string
    address?: string
    parentName?: string
    parentPhone?: string
    parentEmail?: string
    notes?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!teamId || !fullName?.trim()) {
    res.status(400).json({ success: false, error: 'Bitte mindestens Team und Name angeben.' })
    return
  }

  const actor = getUserRowById(actorId)
  if (!actor) {
    res.status(404).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return
  }

  const isAllowed =
    isAdminOrBoard(actorId) ||
    (actor.role === 'trainer' &&
      Boolean(
        db
          .prepare(
            "SELECT id FROM team_members WHERE user_id = ? AND team_id = ? AND membership_role = 'trainer' LIMIT 1",
          )
          .get(actorId, teamId),
      ))

  if (!isAllowed) {
    res.status(403).json({
      success: false,
      error: 'Spielerinnen-Anmeldungen koennen hier nur durch Trainer, Vorstand oder Admin erfasst werden.',
    })
    return
  }

  const duplicatePending = db
    .prepare(
      "SELECT id FROM pending_player_applications WHERE team_id = ? AND full_name = ? AND status = 'pending' LIMIT 1",
    )
    .get(teamId, fullName.trim()) as { id: string } | undefined

  if (duplicatePending) {
    res.status(409).json({
      success: false,
      error: 'Fuer diese Spielerin gibt es bereits eine offene Anmeldung in diesem Team.',
    })
    return
  }

  db.prepare(`
    INSERT INTO pending_player_applications (
      id,
      team_id,
      full_name,
      email,
      phone,
      birthday,
      address,
      parent_name,
      parent_phone,
      parent_email,
      notes,
      requested_by,
      requested_at,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    createId('playerrequest'),
    teamId,
    fullName.trim(),
    String(email ?? '').trim().toLowerCase(),
    phone ?? '',
    birthday ?? '',
    address ?? '',
    parentName ?? '',
    parentPhone ?? '',
    parentEmail ?? '',
    notes ?? '',
    actorId,
    now(),
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, email, password } = req.body as {
    actorId?: string
    email?: string
    password?: string
  }

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Freigaben koennen nur von Admin oder Vorstand bestaetigt werden.' })
    return
  }

  const application = db
    .prepare("SELECT * FROM pending_player_applications WHERE id = ? AND status = 'pending'")
    .get(id) as
    | {
        id: string
        team_id: string
        full_name: string
        email: string
        phone: string
        birthday: string
        address: string
        parent_name: string
        parent_phone: string
        parent_email: string
        notes: string
      }
    | undefined

  if (!application) {
    res.status(404).json({ success: false, error: 'Anmeldung nicht gefunden.' })
    return
  }

  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const trimmedPassword = String(password ?? '').trim()

  if (!normalizedEmail || !trimmedPassword) {
    res.status(400).json({ success: false, error: 'Bitte Login-E-Mail und Startpasswort angeben.' })
    return
  }

  if (trimmedPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Das Startpasswort muss mindestens 8 Zeichen lang sein.' })
    return
  }

  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
    .get(normalizedEmail) as { id: string } | undefined

  if (existingUser) {
    res.status(409).json({ success: false, error: 'Diese Login-E-Mail ist bereits vergeben.' })
    return
  }

  const userId = createId('user')
  const timestamp = now()

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (
        id,
        full_name,
        email,
        password,
        phone,
        role,
        notes,
        avatar_url,
        member_number,
        birthday,
        address,
        parent_name,
        parent_phone,
        parent_email,
        is_member,
        has_membership_application,
        has_medical_certificate,
        has_photo_consent_social,
        is_member_file_url,
        membership_application_file_url,
        medical_certificate_file_url,
        photo_consent_social_file_url,
        must_change_password,
        privacy_accepted_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, 'player', ?, NULL, '', ?, ?, ?, ?, ?, 0, 0, 0, 0, NULL, NULL, NULL, NULL, 1, NULL, ?)
    `).run(
      userId,
      application.full_name,
      normalizedEmail,
      bcrypt.hashSync(trimmedPassword, 10),
      application.phone || '',
      application.notes || '',
      application.birthday || '',
      application.address || '',
      application.parent_name || '',
      application.parent_phone || '',
      application.parent_email || '',
      timestamp,
    )

    db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, membership_role, created_at)
      VALUES (?, ?, ?, 'player', ?)
    `).run(createId('member'), application.team_id, userId, timestamp)

    ensureTeamConversationParticipant(application.team_id, userId, timestamp)

    db.prepare(`
      UPDATE pending_player_applications
      SET
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = ?,
        created_user_id = ?
      WHERE id = ?
    `).run(actorId, timestamp, userId, id)
  })()

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = req.body.actorId as string | undefined

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Ablehnungen koennen nur von Admin oder Vorstand gesetzt werden.' })
    return
  }

  const exists = db
    .prepare("SELECT id FROM pending_player_applications WHERE id = ? AND status = 'pending'")
    .get(id) as { id: string } | undefined

  if (!exists) {
    res.status(404).json({ success: false, error: 'Anmeldung nicht gefunden.' })
    return
  }

  db.prepare(`
    UPDATE pending_player_applications
    SET
      status = 'rejected',
      reviewed_by = ?,
      reviewed_at = ?
    WHERE id = ?
  `).run(actorId, now(), id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
