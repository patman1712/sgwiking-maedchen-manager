import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import db, {
  canEditPlayer,
  canManagePlayerFromMenu,
  createId,
  DATA_DIR,
  getBootstrapData,
  getTeamIdsByUserId,
  getUserRowById,
  isAdminOrBoard,
  now,
} from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads', 'players')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg'
    callback(null, `player-${req.params.id}-${Date.now()}${extension}`)
  },
})

const upload = multer({ storage })

const rebuildTeamConversationParticipants = (teamId: string, timestamp: string) => {
  const teamConversation = db
    .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team'")
    .get(teamId) as { id: string } | undefined

  if (!teamConversation) {
    return
  }

  const participantIds = (
    db.prepare(`
      SELECT DISTINCT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = ?
      UNION
      SELECT id
      FROM users
      WHERE role IN ('admin', 'board')
    `).all(teamId) as { user_id?: string; id?: string }[]
  )
    .map((row) => row.user_id ?? row.id)
    .filter((value): value is string => Boolean(value))

  db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ?').run(
    teamConversation.id,
  )

  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `)

  participantIds.forEach((userId) => {
    insertParticipant.run(createId('participant'), teamConversation.id, userId, timestamp)
  })
}

const syncUserMemberships = (
  userId: string,
  role: 'admin' | 'trainer' | 'player' | 'board',
  teamIds: string[],
  timestamp: string,
) => {
  const previousTeamIds = getTeamIdsByUserId(userId)
  const membershipRole = role === 'player' ? 'player' : role === 'trainer' ? 'trainer' : 'admin'

  db.prepare('DELETE FROM team_members WHERE user_id = ?').run(userId)

  if (role !== 'board') {
    const insertMember = db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, membership_role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    teamIds.forEach((teamId) => {
      insertMember.run(createId('member'), teamId, userId, membershipRole, timestamp)
    })
  }

  Array.from(new Set([...previousTeamIds, ...teamIds])).forEach((teamId) => {
    rebuildTeamConversationParticipants(teamId, timestamp)
  })
}

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

router.post('/', (req: Request, res: Response) => {
  const { actorId, fullName, email, password, phone, role, teamIds, notes } = req.body as {
    actorId?: string
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

  if (role === 'player' && (!actorId || !canManagePlayerFromMenu(actorId))) {
    res
      .status(403)
      .json({ success: false, error: 'Spielerinnen koennen nur von Admin oder Vorstand angelegt werden.' })
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
      must_change_password,
      privacy_accepted_at,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      null,
      '',
      '',
      '',
      '',
      '',
      '',
      0,
      0,
      0,
      0,
      role === 'player' ? 1 : 0,
      null,
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

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const {
    actorId,
    fullName,
    email,
    password,
    phone,
    notes,
    role,
    teamIds,
    memberNumber,
    birthday,
    address,
    parentName,
    parentPhone,
    parentEmail,
    isMember,
    hasMembershipApplication,
    hasMedicalCertificate,
    hasPhotoConsentSocial,
  } = req.body as {
    actorId?: string
    fullName?: string
    email?: string
    password?: string
    phone?: string
    notes?: string
    role?: 'admin' | 'trainer' | 'player' | 'board'
    teamIds?: string[]
    memberNumber?: string | null
    birthday?: string | null
    address?: string | null
    parentName?: string | null
    parentPhone?: string | null
    parentEmail?: string | null
    isMember?: boolean
    hasMembershipApplication?: boolean
    hasMedicalCertificate?: boolean
    hasPhotoConsentSocial?: boolean
  }

  const user = getUserRowById(id)
  if (!user) {
    res.status(404).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  const isSelfUpdate = actorId === id
  const targetRole = role ?? user.role
  const wantsMembershipUpdate = Array.isArray(teamIds)

  if (targetRole === 'player') {
    if (wantsMembershipUpdate) {
      if (!canManagePlayerFromMenu(actorId)) {
        res.status(403).json({
          success: false,
          error: 'Teamzuweisungen fuer Spielerinnen koennen nur von Admin oder Vorstand geaendert werden.',
        })
        return
      }
    } else if (!isSelfUpdate && !canEditPlayer(actorId, id)) {
      res.status(403).json({
        success: false,
        error: 'Diese Spielerin kann nur von Admin, Vorstand oder den zustaendigen Trainern bearbeitet werden.',
      })
      return
    }
  } else if (!isSelfUpdate && !isAdminOrBoard(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Diese Aenderung ist nur fuer Admin oder Vorstand erlaubt.',
    })
    return
  }

  if (!fullName || !email) {
    res.status(400).json({ success: false, error: 'Name und E-Mail sind Pflichtfelder.' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(normalizedEmail, id) as { id: string } | undefined

  if (existing) {
    res.status(409).json({ success: false, error: 'Diese E-Mail ist bereits vergeben.' })
    return
  }

  const timestamp = now()
  const nextMemberNumber =
    memberNumber === null ? '' : typeof memberNumber === 'string' ? memberNumber : user.member_number
  const nextBirthday = birthday === null ? '' : typeof birthday === 'string' ? birthday : user.birthday
  const nextAddress = address === null ? '' : typeof address === 'string' ? address : user.address
  const nextParentName =
    parentName === null ? '' : typeof parentName === 'string' ? parentName : user.parent_name
  const nextParentPhone =
    parentPhone === null ? '' : typeof parentPhone === 'string' ? parentPhone : user.parent_phone
  const nextParentEmail =
    parentEmail === null ? '' : typeof parentEmail === 'string' ? parentEmail : user.parent_email
  const nextIsMember = typeof isMember === 'boolean' ? (isMember ? 1 : 0) : user.is_member
  const nextHasMembershipApplication =
    typeof hasMembershipApplication === 'boolean'
      ? hasMembershipApplication
        ? 1
        : 0
      : user.has_membership_application
  const nextHasMedicalCertificate =
    typeof hasMedicalCertificate === 'boolean' ? (hasMedicalCertificate ? 1 : 0) : user.has_medical_certificate
  const nextHasPhotoConsentSocial =
    typeof hasPhotoConsentSocial === 'boolean'
      ? hasPhotoConsentSocial
        ? 1
        : 0
      : user.has_photo_consent_social

  const transaction = db.transaction(() => {
    if (password?.trim()) {
      db.prepare(`
        UPDATE users
        SET
          full_name = ?,
          email = ?,
          password = ?,
          phone = ?,
          notes = ?,
          role = ?,
          member_number = ?,
          birthday = ?,
          address = ?,
          parent_name = ?,
          parent_phone = ?,
          parent_email = ?,
          is_member = ?,
          has_membership_application = ?,
          has_medical_certificate = ?,
          has_photo_consent_social = ?,
          must_change_password = ?,
          privacy_accepted_at = ?
        WHERE id = ?
      `).run(
        fullName,
        normalizedEmail,
        bcrypt.hashSync(password.trim(), 10),
        phone ?? '',
        notes ?? '',
        targetRole,
        nextMemberNumber,
        nextBirthday,
        nextAddress,
        nextParentName,
        nextParentPhone,
        nextParentEmail,
        nextIsMember,
        nextHasMembershipApplication,
        nextHasMedicalCertificate,
        nextHasPhotoConsentSocial,
        user.must_change_password,
        user.privacy_accepted_at,
        id,
      )
    } else {
      db.prepare(`
        UPDATE users
        SET
          full_name = ?,
          email = ?,
          phone = ?,
          notes = ?,
          role = ?,
          member_number = ?,
          birthday = ?,
          address = ?,
          parent_name = ?,
          parent_phone = ?,
          parent_email = ?,
          is_member = ?,
          has_membership_application = ?,
          has_medical_certificate = ?,
          has_photo_consent_social = ?,
          must_change_password = ?,
          privacy_accepted_at = ?
        WHERE id = ?
      `).run(
        fullName,
        normalizedEmail,
        phone ?? '',
        notes ?? '',
        targetRole,
        nextMemberNumber,
        nextBirthday,
        nextAddress,
        nextParentName,
        nextParentPhone,
        nextParentEmail,
        nextIsMember,
        nextHasMembershipApplication,
        nextHasMedicalCertificate,
        nextHasPhotoConsentSocial,
        user.must_change_password,
        user.privacy_accepted_at,
        id,
      )
    }

    if (wantsMembershipUpdate) {
      syncUserMemberships(id, targetRole, teamIds ?? [], timestamp)
    }
  })

  transaction()

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/:id/avatar', upload.single('avatar'), (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = req.body.actorId as string | undefined
  const user = getUserRowById(id)

  if (!user) {
    res.status(404).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  const isAllowed =
    actorId === id ||
    isAdminOrBoard(actorId) ||
    (user.role === 'player' && canEditPlayer(actorId, id))

  if (!isAllowed) {
    res.status(403).json({
      success: false,
      error: 'Dieses Profilbild kann hier nicht bearbeitet werden.',
    })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, error: 'Bitte eine Bilddatei auswaehlen.' })
    return
  }

  const avatarUrl = `/uploads/players/${req.file.filename}?v=${encodeURIComponent(now())}`
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, id)

  res.json({
    success: true,
    avatarUrl,
    ...getBootstrapData(actorId),
  })
})

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)
  const user = getUserRowById(id)

  if (!user) {
    res.status(404).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Personen koennen nur von Admin oder Vorstand geloescht werden.' })
    return
  }

  if (actorId === id) {
    res.status(400).json({ success: false, error: 'Du kannst deinen eigenen Account nicht loeschen.' })
    return
  }

  const affectedTeamIds = getTeamIdsByUserId(id)
  const timestamp = now()

  db.transaction(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
  })()

  if (user.role === 'player') {
    const prefix = `player-${id}-`
    try {
      const files = fs.readdirSync(uploadDir)
      files.forEach((filename) => {
        if (!filename.startsWith(prefix)) {
          return
        }

        try {
          fs.unlinkSync(path.join(uploadDir, filename))
        } catch {
          return
        }
      })
    } catch {
      // ignore
    }
  }

  affectedTeamIds.forEach((teamId) => rebuildTeamConversationParticipants(teamId, timestamp))

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
