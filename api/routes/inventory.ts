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
const uploadDir = path.join(DATA_DIR, 'uploads', 'inventory')
fs.mkdirSync(uploadDir, { recursive: true })

const canManageInventory = (actorId: string, teamId: string) =>
  isAdminOrBoard(actorId) || userHasTeamRole(actorId, teamId, 'trainer')

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg'
    callback(null, `inventory-${req.body.teamId ?? 'item'}-${Date.now()}${extension}`)
  },
})

const upload = multer({ storage })

const deleteInventoryImage = (imageUrl: string | null | undefined) => {
  if (!imageUrl) {
    return
  }

  const filename = path.basename(imageUrl)
  const filePath = path.join(uploadDir, filename)

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

router.post('/', upload.single('image'), (req: Request, res: Response) => {
  const { actorId, teamId, category, name, quantity, productInfo, notes, condition } = req.body as {
    actorId?: string
    teamId?: string
    category?: string
    name?: string
    quantity?: string
    productInfo?: string
    notes?: string
    condition?: string
  }

  if (!actorId) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!teamId || !name?.trim()) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(400).json({ success: false, error: 'Bitte mindestens Produktname und Mannschaft angeben.' })
    return
  }

  if (!canManageInventory(actorId, teamId)) {
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(403).json({
      success: false,
      error: 'Inventar kann nur von zustaendigen Trainern, Admin oder Vorstand gepflegt werden.',
    })
    return
  }

  const parsedQuantity = Number.parseInt(quantity ?? '1', 10)
  const itemId = createId('inventory')

  db.prepare(`
    INSERT INTO inventory_items (
      id,
      team_id,
      category,
      name,
      quantity,
      product_info,
      notes,
      item_condition,
      image_url,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId,
    teamId,
    (category || 'Sonstiges').trim(),
    name.trim(),
    Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
    (productInfo || '').trim(),
    (notes || '').trim(),
    (condition || '').trim(),
    req.file ? `/uploads/inventory/${req.file.filename}` : null,
    now(),
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

  const item = db
    .prepare('SELECT id, team_id, image_url FROM inventory_items WHERE id = ?')
    .get(id) as { id: string; team_id: string; image_url: string | null } | undefined

  if (!item) {
    res.status(404).json({ success: false, error: 'Inventareintrag nicht gefunden.' })
    return
  }

  if (!canManageInventory(actorId, item.team_id)) {
    res.status(403).json({
      success: false,
      error: 'Inventar kann nur von zustaendigen Trainern, Admin oder Vorstand geloescht werden.',
    })
    return
  }

  db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id)
  deleteInventoryImage(item.image_url)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
