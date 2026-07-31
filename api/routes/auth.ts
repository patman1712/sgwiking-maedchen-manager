import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import db, { getBootstrapData, getUserByEmail, getUserRowById, mapUser, now } from '../db.js'

const router = Router()
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string }
  const normalizedEmail = String(email ?? '').trim().toLowerCase()

  if (!normalizedEmail || !password) {
    res.status(400).json({ success: false, error: 'Bitte E-Mail und Passwort eingeben.' })
    return
  }

  const user = getUserByEmail(normalizedEmail)

  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ success: false, error: 'Ungueltige Anmeldedaten' })
    return
  }

  res.json({
    success: true,
    user: mapUser(user),
  })
})

router.post('/complete-first-login', async (req: Request, res: Response): Promise<void> => {
  const { actorId, currentPassword, newPassword, acceptPrivacy } = req.body as {
    actorId?: string
    currentPassword?: string
    newPassword?: string
    acceptPrivacy?: boolean
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  const user = getUserRowById(actorId)

  if (!user) {
    res.status(404).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return
  }

  const needsOnboarding =
    user.role === 'player' && (Boolean(user.must_change_password) || !user.privacy_accepted_at)

  if (!needsOnboarding) {
    res.json({
      success: true,
      ...getBootstrapData(actorId),
    })
    return
  }

  if (!acceptPrivacy) {
    res.status(400).json({ success: false, error: 'Bitte die DSGVO-/Datenschutz-Zustimmung bestaetigen.' })
    return
  }

  if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
    res.status(401).json({ success: false, error: 'Das aktuelle Passwort ist nicht korrekt.' })
    return
  }

  const trimmedNewPassword = String(newPassword ?? '').trim()

  if (trimmedNewPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Das neue Passwort muss mindestens 8 Zeichen lang sein.' })
    return
  }

  if (bcrypt.compareSync(trimmedNewPassword, user.password)) {
    res.status(400).json({ success: false, error: 'Bitte ein neues Passwort waehlen, das sich vom Startpasswort unterscheidet.' })
    return
  }

  db.prepare(`
    UPDATE users
    SET
      password = ?,
      must_change_password = 0,
      privacy_accepted_at = ?
    WHERE id = ?
  `).run(bcrypt.hashSync(trimmedNewPassword, 10), now(), actorId)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
