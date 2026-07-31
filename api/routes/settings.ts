import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import { DATA_DIR, getSettings, now, setSetting } from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.png'
    callback(null, `team-logo-${Date.now()}${extension}`)
  },
})

const upload = multer({ storage })

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    settings: getSettings(),
  })
})

router.post('/logo', upload.single('logo'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'Bitte eine Bilddatei auswaehlen.' })
    return
  }

  const logoUrl = `/uploads/${req.file.filename}?v=${encodeURIComponent(now())}`
  setSetting('team_logo_url', logoUrl)

  res.json({
    success: true,
    settings: getSettings(),
  })
})

export default router
