import { Router, type Request, type Response } from 'express'
import db, {
  createId,
  getBootstrapData,
  getTeamIdsByUserId,
  getUserRowById,
  now,
} from '../db.js'

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

  const sender = getUserRowById(senderId)
  const conversation = db
    .prepare('SELECT id, type, team_id FROM conversations WHERE id = ?')
    .get(conversationId) as
    | { id: string; type: 'team' | 'direct'; team_id: string | null }
    | undefined

  if (!sender || !conversation) {
    res.status(404).json({ success: false, error: 'Konversation nicht gefunden.' })
    return
  }

  const hasAccess =
    sender.role === 'admin' ||
    (conversation.type === 'team'
      ? sender.role === 'board' ||
        (conversation.team_id ? getTeamIdsByUserId(senderId).includes(conversation.team_id) : false)
      : Boolean(
          db
            .prepare(
              'SELECT id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1',
            )
            .get(conversationId, senderId),
        ))

  if (!hasAccess) {
    res.status(403).json({ success: false, error: 'Kein Zugriff auf diese Konversation.' })
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
    ...getBootstrapData(senderId),
  })
})

export default router
