import { Router, type Request, type Response } from 'express'
import db, { createId, getBootstrapData, now } from '../db.js'

const router = Router()

router.post('/', (req: Request, res: Response) => {
  const { conversationId, senderId, content } = req.body as {
    conversationId?: string
    senderId?: string
    content?: string
  }

  const trimmed = content?.trim()
  if (!conversationId || !senderId || !trimmed) {
    res.status(400).json({ success: false, error: 'Unvollstaendige Nachricht.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(createId('message'), conversationId, senderId, trimmed, timestamp)

  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(timestamp, conversationId)

  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

export default router
