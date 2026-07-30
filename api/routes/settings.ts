import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import { DATA_DIR, getSettings, getUserRowById, now, setSetting } from '../db.js'

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

router.put('/social-media-layouts', (req: Request, res: Response) => {
  const actorId = req.body?.actorId as string | undefined
  const layouts = req.body?.layouts as
    | Array<{ value?: string; label?: string; enabled?: boolean }>
    | undefined

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (getUserRowById(actorId)?.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Nur Admin darf diese Namen freigeben.' })
    return
  }

  const allowedKeys = ['matchday', 'result', 'training', 'announcement']
  const sanitized =
    layouts
      ?.filter(
        (entry): entry is { value: string; label: string; enabled: boolean } =>
          Boolean(
            entry &&
              typeof entry.value === 'string' &&
              allowedKeys.includes(entry.value) &&
              typeof entry.label === 'string' &&
              typeof entry.enabled === 'boolean',
          ),
      )
      .map((entry) => ({
        value: entry.value,
        label: entry.label.trim() || allowedKeys.find((key) => key === entry.value) || entry.value,
        enabled: entry.enabled,
      })) ?? []

  if (sanitized.length !== allowedKeys.length) {
    res.status(400).json({ success: false, error: 'Die Vorlagenliste ist unvollstaendig.' })
    return
  }

  setSetting('social_media_layouts', JSON.stringify(sanitized))

  res.json({
    success: true,
    settings: getSettings(),
  })
})

export default router
