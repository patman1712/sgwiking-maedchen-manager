import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import db, {
  createId,
  DATA_DIR,
  getBootstrapData,
  isAdminOrBoard,
  now,
  userHasTeamRole,
} from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads', 'cashbook')
fs.mkdirSync(uploadDir, { recursive: true })

const canAccessCashbook = (actorId: string, teamId: string) =>
  isAdminOrBoard(actorId) || userHasTeamRole(actorId, teamId, 'trainer')

const deleteReceiptFile = (receiptUrl: string | null | undefined) => {
  if (!receiptUrl) {
    return
  }

  const filename = path.basename(receiptUrl)
  const filePath = path.join(uploadDir, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

const parseAmountCents = (value: string | undefined) => {
  const normalized = (value ?? '').trim().replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.round(parsed * 100)
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg'
    callback(null, `cashbook-${req.body.teamId ?? 'entry'}-${Date.now()}${extension}`)
  },
})

const upload = multer({ storage })

router.post('/', upload.single('receipt'), (req: Request, res: Response) => {
  const { actorId, teamId, entryType, amount, title, notes, bookedAt } = req.body as {
    actorId?: string
    teamId?: string
    entryType?: string
    amount?: string
    title?: string
    notes?: string
    bookedAt?: string
  }

  if (!actorId) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!teamId) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Bitte eine Mannschaft angeben.' })
    return
  }

  if (!canAccessCashbook(actorId, teamId)) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(403).json({
      success: false,
      error: 'Schiri-Kasse kann nur von zustaendigen Trainern, Admin oder Vorstand gepflegt werden.',
    })
    return
  }

  const trimmedTitle = (title ?? '').trim()
  if (!trimmedTitle) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Bitte einen Titel angeben.' })
    return
  }

  const normalizedType = entryType === 'out' ? 'out' : entryType === 'in' ? 'in' : null
  if (!normalizedType) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Bitte Ein- oder Auszahlung auswaehlen.' })
    return
  }

  const amountCents = parseAmountCents(amount)
  if (amountCents === null || amountCents <= 0) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Bitte einen gueltigen Betrag angeben.' })
    return
  }

  const entryId = createId('cashbook')
  const timestamp = now()
  const bookedAtValue = (bookedAt ?? '').trim() || timestamp

  db.prepare(
    `
      INSERT INTO team_cashbook_entries (
        id,
        team_id,
        entry_type,
        amount_cents,
        title,
        notes,
        booked_at,
        receipt_url,
        original_received,
        original_received_by,
        original_received_at,
        created_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    entryId,
    teamId,
    normalizedType,
    amountCents,
    trimmedTitle,
    (notes ?? '').trim(),
    bookedAtValue,
    req.file ? `/uploads/cashbook/${req.file.filename}` : null,
    0,
    null,
    null,
    actorId,
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/:id/receipt', upload.single('receipt'), (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = req.body.actorId as string | undefined

  if (!actorId) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  const entry = db
    .prepare('SELECT id, team_id, receipt_url FROM team_cashbook_entries WHERE id = ?')
    .get(id) as { id: string; team_id: string; receipt_url: string | null } | undefined

  if (!entry) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(404).json({ success: false, error: 'Eintrag nicht gefunden.' })
    return
  }

  if (!canAccessCashbook(actorId, entry.team_id)) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(403).json({
      success: false,
      error: 'Kein Zugriff auf diese Schiri-Kasse.',
    })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, error: 'Bitte einen Beleg auswaehlen.' })
    return
  }

  deleteReceiptFile(entry.receipt_url)

  db.prepare(
    `
      UPDATE team_cashbook_entries
      SET receipt_url = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(`/uploads/cashbook/${req.file.filename}`, now(), id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.patch('/:id/original-received', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, value } = req.body as { actorId?: string; value?: boolean }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!isAdminOrBoard(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Der Beleg-Status kann nur durch Vorstand oder Admin geaendert werden.',
    })
    return
  }

  const entry = db
    .prepare('SELECT id FROM team_cashbook_entries WHERE id = ?')
    .get(id) as { id: string } | undefined

  if (!entry) {
    res.status(404).json({ success: false, error: 'Eintrag nicht gefunden.' })
    return
  }

  const checked = Boolean(value)
  const timestamp = now()

  db.prepare(
    `
      UPDATE team_cashbook_entries
      SET original_received = ?,
          original_received_by = ?,
          original_received_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
  ).run(checked ? 1 : 0, checked ? actorId : null, checked ? timestamp : null, timestamp, id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router

