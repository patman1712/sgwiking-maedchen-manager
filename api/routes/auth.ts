import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import { getUserByEmail, mapUser } from '../db.js'

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

export default router
