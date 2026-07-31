import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import db, { createId, DATA_DIR, getBootstrapData, isAdminOrBoard, now } from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads', 'fleamarket')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg'
    callback(null, `fleamarket-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`)
  },
})

const upload = multer({ storage })

const parsePriceCents = (value: string | undefined) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
  const amount = Number.parseFloat(normalized)
  if (!Number.isFinite(amount) || amount < 0) {
    return 0
  }
  return Math.round(amount * 100)
}

const cleanupFiles = (files: Express.Multer.File[] | undefined) => {
  if (!files?.length) {
    return
  }
  files.forEach((file) => {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }
  })
}

const deleteListingImages = (imageUrls: string[]) => {
  imageUrls.forEach((imageUrl) => {
    const filename = path.basename(imageUrl)
    const filePath = path.join(uploadDir, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  })
}

router.post('/', upload.array('images', 6), (req: Request, res: Response) => {
  const { actorId, title, description, condition, price, contactName, contactPhone, contactEmail } =
    req.body as {
      actorId?: string
      title?: string
      description?: string
      condition?: string
      price?: string
      contactName?: string
      contactPhone?: string
      contactEmail?: string
    }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []

  if (!actorId) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!title?.trim()) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Bitte einen Titel fuer das Angebot angeben.' })
    return
  }

  const timestamp = now()
  const listingId = createId('flea')
  const imageUrls = files.map((file) => `/uploads/fleamarket/${file.filename}`)

  db.prepare(`
    INSERT INTO flea_market_listings (
      id,
      title,
      description,
      listing_condition,
      price_cents,
      contact_name,
      contact_phone,
      contact_email,
      image_urls,
      created_by,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    listingId,
    title.trim(),
    (description || '').trim(),
    (condition || '').trim(),
    parsePriceCents(price),
    (contactName || '').trim(),
    (contactPhone || '').trim(),
    (contactEmail || '').trim(),
    JSON.stringify(imageUrls),
    actorId,
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  const listing = db
    .prepare('SELECT id, created_by, image_urls FROM flea_market_listings WHERE id = ?')
    .get(id) as { id: string; created_by: string; image_urls: string } | undefined

  if (!listing) {
    res.status(404).json({ success: false, error: 'Angebot nicht gefunden.' })
    return
  }

  if (listing.created_by !== actorId && !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Dieses Angebot darf nur vom Ersteller geloescht werden.' })
    return
  }

  let imageUrls: string[] = []
  try {
    const parsed = JSON.parse(listing.image_urls || '[]') as unknown
    if (Array.isArray(parsed)) {
      imageUrls = parsed.filter((value): value is string => typeof value === 'string')
    }
  } catch {
    imageUrls = []
  }

  db.prepare('DELETE FROM flea_market_listings WHERE id = ?').run(id)
  deleteListingImages(imageUrls)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router

