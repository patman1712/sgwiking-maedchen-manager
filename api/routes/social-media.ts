import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import db, { createId, DATA_DIR, getBootstrapData, getUserRowById, isAdminOrBoard, now } from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads', 'social-media')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg'
    callback(null, `social-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`)
  },
})

const upload = multer({ storage })

const canManageSocialMedia = (actorId: string) => {
  if (isAdminOrBoard(actorId)) {
    return true
  }

  const actor = getUserRowById(actorId)
  return actor?.role === 'trainer'
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

const parseImageUrls = (value: string | null | undefined) => {
  if (!value) {
    return [] as string[]
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    return []
  }

  return []
}

const parseLayers = (value: string | null | undefined) => {
  if (!value) {
    return [] as Array<{
      id: string
      kind: string
      label: string
      position: string
      style: string
      imageRef?: string
      text?: string
      enabled: boolean
      centerX?: number
      centerY?: number
      widthPercent?: number
      heightPercent?: number
    }>
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (
          entry,
        ): entry is {
          id: string
          kind: string
          label: string
          position: string
          style: string
          imageRef?: string
          text?: string
          enabled: boolean
          centerX?: number
          centerY?: number
          widthPercent?: number
          heightPercent?: number
        } =>
          Boolean(
            entry &&
              typeof entry === 'object' &&
              typeof (entry as { id?: unknown }).id === 'string' &&
              typeof (entry as { kind?: unknown }).kind === 'string' &&
              typeof (entry as { label?: unknown }).label === 'string' &&
              typeof (entry as { position?: unknown }).position === 'string' &&
              typeof (entry as { style?: unknown }).style === 'string' &&
              typeof (entry as { enabled?: unknown }).enabled === 'boolean',
          ),
      )
    }
  } catch {
    return []
  }

  return []
}

const remapLayerImageRefs = (
  layers: Array<{
    id: string
    kind: string
    label: string
    position: string
    style: string
    imageRef?: string
    text?: string
    enabled: boolean
    centerX?: number
    centerY?: number
    widthPercent?: number
    heightPercent?: number
  }>,
  uploadedImageUrls: string[],
  retainedImageUrls: string[],
) =>
  layers.map((layer) => {
    if (!layer.imageRef) {
      return layer
    }

    const match = /^__new_(\d+)__$/.exec(layer.imageRef)
    if (match) {
      return {
        ...layer,
        imageRef: uploadedImageUrls[Number(match[1])] ?? undefined,
      }
    }

    return {
      ...layer,
      imageRef: retainedImageUrls.includes(layer.imageRef) ? layer.imageRef : undefined,
    }
  })

const deleteDraftImages = (imageUrls: string[]) => {
  imageUrls.forEach((imageUrl) => {
    const filePath = path.join(uploadDir, path.basename(imageUrl))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  })
}

router.post('/drafts', upload.array('images', 8), (req: Request, res: Response) => {
  const { actorId, draftType, layout, title, subtitle, caption, callToAction, imageOrder, layers } = req.body as {
    actorId?: string
    draftType?: 'feed' | 'story'
    layout?: string
    title?: string
    subtitle?: string
    caption?: string
    callToAction?: string
    imageOrder?: string
    layers?: string
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []

  if (!actorId) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMedia(actorId)) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Nur Trainer, Vorstand oder Admin duerfen Entwuerfe bearbeiten.' })
    return
  }

  if (!title?.trim()) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Bitte einen Titel fuer den Entwurf angeben.' })
    return
  }

  if (draftType !== 'feed' && draftType !== 'story') {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Ungueltiges Format.' })
    return
  }

  const timestamp = now()
  const uploadedImageUrls = files.map((file) => `/uploads/social-media/${file.filename}`)
  const orderEntries = parseImageUrls(imageOrder)
  const imageUrls = orderEntries.length
    ? orderEntries
        .map((entry) => {
          const match = /^__new_(\d+)__$/.exec(entry)
          if (!match) {
            return null
          }
          return uploadedImageUrls[Number(match[1])] ?? null
        })
        .filter((entry): entry is string => Boolean(entry))
    : uploadedImageUrls
  const mappedLayers = remapLayerImageRefs(parseLayers(layers), uploadedImageUrls, imageUrls)

  db.prepare(`
    INSERT INTO social_media_drafts (
      id,
      draft_type,
      layout,
      title,
      subtitle,
      caption,
      call_to_action,
      image_urls,
      layers_json,
      created_by,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('social'),
    draftType,
    (layout || 'matchday').trim(),
    title.trim(),
    (subtitle || '').trim(),
    (caption || '').trim(),
    (callToAction || '').trim(),
    JSON.stringify(imageUrls),
    JSON.stringify(mappedLayers),
    actorId,
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.put('/drafts/:id', upload.array('images', 8), (req: Request, res: Response) => {
  const { id } = req.params
  const {
    actorId,
    draftType,
    layout,
    title,
    subtitle,
    caption,
    callToAction,
    existingImageUrls,
    imageOrder,
    layers,
  } = req.body as {
    actorId?: string
    draftType?: 'feed' | 'story'
    layout?: string
    title?: string
    subtitle?: string
    caption?: string
    callToAction?: string
    existingImageUrls?: string
    imageOrder?: string
    layers?: string
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []

  if (!actorId) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMedia(actorId)) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Nur Trainer, Vorstand oder Admin duerfen Entwuerfe bearbeiten.' })
    return
  }

  const existingDraft = db
    .prepare('SELECT id, image_urls, created_by FROM social_media_drafts WHERE id = ?')
    .get(id) as { id: string; image_urls: string; created_by: string } | undefined

  if (!existingDraft) {
    cleanupFiles(files)
    res.status(404).json({ success: false, error: 'Entwurf nicht gefunden.' })
    return
  }

  if (!title?.trim()) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Bitte einen Titel fuer den Entwurf angeben.' })
    return
  }

  if (draftType !== 'feed' && draftType !== 'story') {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Ungueltiges Format.' })
    return
  }

  const retainedImageUrls = parseImageUrls(existingImageUrls)
  const uploadedImageUrls = files.map((file) => `/uploads/social-media/${file.filename}`)
  const orderEntries = parseImageUrls(imageOrder)
  const finalImageUrls = orderEntries.length
    ? orderEntries
        .map((entry) => {
          const match = /^__new_(\d+)__$/.exec(entry)
          if (match) {
            return uploadedImageUrls[Number(match[1])] ?? null
          }
          return retainedImageUrls.includes(entry) ? entry : null
        })
        .filter((entry): entry is string => Boolean(entry))
    : [...retainedImageUrls, ...uploadedImageUrls]
  const mappedLayers = remapLayerImageRefs(parseLayers(layers), uploadedImageUrls, retainedImageUrls)
  const previousImageUrls = parseImageUrls(existingDraft.image_urls)
  const removedImageUrls = previousImageUrls.filter((imageUrl) => !retainedImageUrls.includes(imageUrl))

  db.prepare(`
    UPDATE social_media_drafts
    SET
      draft_type = ?,
      layout = ?,
      title = ?,
      subtitle = ?,
      caption = ?,
      call_to_action = ?,
      image_urls = ?,
      layers_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    draftType,
    (layout || 'matchday').trim(),
    title.trim(),
    (subtitle || '').trim(),
    (caption || '').trim(),
    (callToAction || '').trim(),
    JSON.stringify(finalImageUrls),
    JSON.stringify(mappedLayers),
    now(),
    id,
  )

  deleteDraftImages(removedImageUrls)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/drafts/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMedia(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Trainer, Vorstand oder Admin duerfen Entwuerfe loeschen.' })
    return
  }

  const draft = db
    .prepare('SELECT id, image_urls FROM social_media_drafts WHERE id = ?')
    .get(id) as { id: string; image_urls: string } | undefined

  if (!draft) {
    res.status(404).json({ success: false, error: 'Entwurf nicht gefunden.' })
    return
  }

  db.prepare('DELETE FROM social_media_drafts WHERE id = ?').run(id)
  deleteDraftImages(parseImageUrls(draft.image_urls))

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/snippets', (req: Request, res: Response) => {
  const { actorId, label, content, category } = req.body as {
    actorId?: string
    label?: string
    content?: string
    category?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMedia(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Trainer, Vorstand oder Admin duerfen Textbausteine verwalten.' })
    return
  }

  if (!label?.trim() || !content?.trim()) {
    res.status(400).json({ success: false, error: 'Bitte Titel und Inhalt fuer den Textbaustein angeben.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    INSERT INTO social_media_text_snippets (
      id,
      label,
      content,
      category,
      created_by,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('snippet'),
    label.trim(),
    content.trim(),
    (category || '').trim(),
    actorId,
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.put('/snippets/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, label, content, category } = req.body as {
    actorId?: string
    label?: string
    content?: string
    category?: string
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMedia(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Trainer, Vorstand oder Admin duerfen Textbausteine verwalten.' })
    return
  }

  const existingSnippet = db
    .prepare('SELECT id FROM social_media_text_snippets WHERE id = ?')
    .get(id) as { id: string } | undefined

  if (!existingSnippet) {
    res.status(404).json({ success: false, error: 'Textbaustein nicht gefunden.' })
    return
  }

  if (!label?.trim() || !content?.trim()) {
    res.status(400).json({ success: false, error: 'Bitte Titel und Inhalt fuer den Textbaustein angeben.' })
    return
  }

  db.prepare(`
    UPDATE social_media_text_snippets
    SET
      label = ?,
      content = ?,
      category = ?,
      updated_at = ?
    WHERE id = ?
  `).run(label.trim(), content.trim(), (category || '').trim(), now(), id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/snippets/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMedia(actorId)) {
    res.status(403).json({ success: false, error: 'Nur Trainer, Vorstand oder Admin duerfen Textbausteine verwalten.' })
    return
  }

  const existingSnippet = db
    .prepare('SELECT id FROM social_media_text_snippets WHERE id = ?')
    .get(id) as { id: string } | undefined

  if (!existingSnippet) {
    res.status(404).json({ success: false, error: 'Textbaustein nicht gefunden.' })
    return
  }

  db.prepare('DELETE FROM social_media_text_snippets WHERE id = ?').run(id)

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
