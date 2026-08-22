import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { Router, type Request, type Response } from 'express'
import db, {
  canUseSocialMedia,
  createId,
  createSocialMediaAsset,
  createSocialMediaAssetFolder,
  DATA_DIR,
  deleteSocialMediaAsset,
  deleteSocialMediaAssetFolder,
  getBootstrapData,
  getUserRowById,
  isAdminOrBoard,
  now,
} from '../db.js'

const router = Router()
const uploadDir = path.join(DATA_DIR, 'uploads', 'social-media')
const crestUploadDir = path.join(DATA_DIR, 'uploads', 'social-media-crests')
const fontUploadDir = path.join(DATA_DIR, 'uploads', 'social-media-fonts')
fs.mkdirSync(uploadDir, { recursive: true })
fs.mkdirSync(crestUploadDir, { recursive: true })
fs.mkdirSync(fontUploadDir, { recursive: true })

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

const crestStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, crestUploadDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.png'
    callback(null, `crest-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`)
  },
})

const crestUpload = multer({ storage: crestStorage })

const fontStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, fontUploadDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname) || '.woff2'
    callback(null, `font-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`)
  },
})

const fontUpload = multer({ storage: fontStorage })

const canManageSocialMediaLibrary = (actorId: string) => isAdminOrBoard(actorId)
const isSharedSocialAssetUrl = (value: string) => value.startsWith('/uploads/social-media-crests/')

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
      lockPosition?: boolean
      lockSize?: boolean
      keepAspectRatio?: boolean
      baseAspectRatio?: number
      fontFamily?: string
      fontSize?: number
      textColor?: string
      textAlign?: string
      textEffect?: string
      strokeColor?: string
      strokeWidth?: number
      lineHeight?: number
      letterSpacing?: number
    }>
  }

  const acceptedKinds = new Set(['image', 'badge', 'title', 'subtitle', 'caption', 'cta'])
  const acceptedPositions = new Set([
    'full', 'topLeft', 'topRight', 'center',
    'bottomLeft', 'bottomCenter', 'bottomRight',
  ])
  const acceptedStyles = new Set([
    'cover', 'original', 'soft', 'cutout', 'glass', 'solid', 'pill', 'clean',
  ])
  const acceptedTextAligns = new Set(['left', 'center', 'right'])
  const acceptedTextEffects = new Set(['none', 'shadow', 'outline'])

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const obj = entry as Record<string, unknown>
          if (
            typeof obj.id !== 'string' ||
            typeof obj.kind !== 'string' || !acceptedKinds.has(obj.kind) ||
            typeof obj.label !== 'string' ||
            typeof obj.position !== 'string' || !acceptedPositions.has(obj.position) ||
            typeof obj.style !== 'string' || !acceptedStyles.has(obj.style)
          ) {
            return null
          }
          if (
            (obj.imageRef !== undefined && typeof obj.imageRef !== 'string') ||
            (obj.text !== undefined && typeof obj.text !== 'string') ||
            (obj.lockPosition !== undefined && typeof obj.lockPosition !== 'boolean') ||
            (obj.lockSize !== undefined && typeof obj.lockSize !== 'boolean') ||
            (obj.keepAspectRatio !== undefined && typeof obj.keepAspectRatio !== 'boolean') ||
            (obj.baseAspectRatio !== undefined && typeof obj.baseAspectRatio !== 'number') ||
            (obj.fontFamily !== undefined && typeof obj.fontFamily !== 'string') ||
            (obj.fontSize !== undefined && typeof obj.fontSize !== 'number') ||
            (obj.textColor !== undefined && typeof obj.textColor !== 'string') ||
            (obj.textAlign !== undefined && !acceptedTextAligns.has(obj.textAlign as string)) ||
            (obj.textEffect !== undefined && !acceptedTextEffects.has(obj.textEffect as string)) ||
            (obj.strokeColor !== undefined && typeof obj.strokeColor !== 'string') ||
            (obj.strokeWidth !== undefined && typeof obj.strokeWidth !== 'number') ||
            (obj.lineHeight !== undefined && typeof obj.lineHeight !== 'number') ||
            (obj.letterSpacing !== undefined && typeof obj.letterSpacing !== 'number') ||
            (obj.centerX !== undefined && typeof obj.centerX !== 'number') ||
            (obj.centerY !== undefined && typeof obj.centerY !== 'number') ||
            (obj.widthPercent !== undefined && typeof obj.widthPercent !== 'number') ||
            (obj.heightPercent !== undefined && typeof obj.heightPercent !== 'number')
          ) {
            return null
          }
          return {
            ...(entry as object),
            id: obj.id,
            kind: obj.kind,
            label: obj.label,
            position: obj.position,
            style: obj.style,
            imageRef: obj.imageRef as string | undefined,
            text: obj.text as string | undefined,
            enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
            centerX: obj.centerX as number | undefined,
            centerY: obj.centerY as number | undefined,
            widthPercent: obj.widthPercent as number | undefined,
            heightPercent: obj.heightPercent as number | undefined,
            lockPosition: typeof obj.lockPosition === 'boolean' ? obj.lockPosition : false,
            lockSize: typeof obj.lockSize === 'boolean' ? obj.lockSize : false,
            keepAspectRatio: typeof obj.keepAspectRatio === 'boolean' ? obj.keepAspectRatio : undefined,
            baseAspectRatio: obj.baseAspectRatio as number | undefined,
            fontFamily: obj.fontFamily as string | undefined,
            fontSize: obj.fontSize as number | undefined,
            textColor: obj.textColor as string | undefined,
            textAlign: (obj.textAlign as 'left' | 'center' | 'right' | undefined) ?? undefined,
            textEffect: (obj.textEffect as 'none' | 'shadow' | 'outline' | undefined) ?? undefined,
            strokeColor: obj.strokeColor as string | undefined,
            strokeWidth: obj.strokeWidth as number | undefined,
            lineHeight: obj.lineHeight as number | undefined,
            letterSpacing: obj.letterSpacing as number | undefined,
          }
        })
        .filter((entry): entry is Exclude<typeof entry, null> => entry !== null)
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
    lockPosition?: boolean
    lockSize?: boolean
    fontFamily?: string
    fontSize?: number
    textColor?: string
    textAlign?: string
    textEffect?: string
  }>,
  uploadedImageUrls: string[],
  retainedImageUrls: string[],
) =>
  layers.map((layer) => {
    if (!layer.imageRef) {
      return layer
    }

    if (isSharedSocialAssetUrl(layer.imageRef)) {
      return layer
    }

    const match = /^__new_(\d+)__$/.exec(layer.imageRef)
    if (match) {
      return {
        ...layer,
        imageRef: uploadedImageUrls[Number(match[1])] ?? undefined,
      }
    }

    return layer
  })

const deleteDraftImages = (imageUrls: string[]) => {
  imageUrls.forEach((imageUrl) => {
    if (isSharedSocialAssetUrl(imageUrl)) return;
    const filePath = path.join(uploadDir, path.basename(imageUrl))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  })
}

const parseHashtags = (value: string | undefined): string[] => {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 10)
  } catch {
    return []
  }
}

const resolveCreateImageOrder = (imageOrder: string | undefined, uploadedImageUrls: string[]) => {
  const orderEntries = parseImageUrls(imageOrder)
  if (!orderEntries.length) {
    return uploadedImageUrls
  }

  return orderEntries
    .map((entry) => {
      const match = /^__new_(\d+)__$/.exec(entry)
      if (match) {
        return uploadedImageUrls[Number(match[1])] ?? null
      }

      if (isSharedSocialAssetUrl(entry)) {
        return entry
      }

      return null
    })
    .filter((entry): entry is string => Boolean(entry))
}

const resolveUpdateImageOrder = (
  imageOrder: string | undefined,
  retainedImageUrls: string[],
  uploadedImageUrls: string[],
) => {
  const orderEntries = parseImageUrls(imageOrder)
  if (!orderEntries.length) {
    return [...retainedImageUrls, ...uploadedImageUrls]
  }

  return orderEntries
    .map((entry) => {
      const match = /^__new_(\d+)__$/.exec(entry)
      if (match) {
        return uploadedImageUrls[Number(match[1])] ?? null
      }

      if (retainedImageUrls.includes(entry) || isSharedSocialAssetUrl(entry)) {
        return entry
      }

      return null
    })
    .filter((entry): entry is string => Boolean(entry))
}

router.post('/drafts', upload.array('images', 8), (req: Request, res: Response) => {
  const { actorId, draftType, layout, title, subtitle, caption, callToAction, imageOrder, layers, isTemplate, postingText, hashtags, status } = req.body as {
    actorId?: string
    draftType?: 'feed' | 'story'
    layout?: string
    title?: string
    subtitle?: string
    caption?: string
    callToAction?: string
    imageOrder?: string
    layers?: string
    isTemplate?: string
    postingText?: string
    hashtags?: string
    status?: 'draft' | 'submitted'
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []

  if (!actorId) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canUseSocialMedia(actorId)) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Nur freigeschaltete Trainer oder Admin duerfen Social Media nutzen.' })
    return
  }

  const wantsTemplate = isTemplate === 'true'
  if (wantsTemplate && !canManageSocialMediaLibrary(actorId)) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Vorlagen koennen nur vom Admin erstellt werden.' })
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

  const normalizedHashtags = parseHashtags(hashtags)
  const normalizedStatus = status === 'submitted' ? 'submitted' : 'draft'
  const timestamp = now()
  const uploadedImageUrls = files.map((file) => `/uploads/social-media/${file.filename}`)
  const imageUrls = resolveCreateImageOrder(imageOrder, uploadedImageUrls)
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
      is_template,
      posting_text,
      hashtags,
      status,
      admin_notification_at,
      created_by,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    wantsTemplate ? 1 : 0,
    (postingText || '').trim(),
    JSON.stringify(normalizedHashtags),
    normalizedStatus,
    normalizedStatus === 'submitted' ? timestamp : null,
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
    isTemplate,
    postingText,
    hashtags,
    status,
    setAdminNotified,
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
    isTemplate?: string
    postingText?: string
    hashtags?: string
    status?: 'draft' | 'submitted'
    setAdminNotified?: string
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []

  if (!actorId) {
    cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canUseSocialMedia(actorId)) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Nur freigeschaltete Trainer oder Admin duerfen Social Media nutzen.' })
    return
  }

  const existingDraft = db
    .prepare('SELECT id, image_urls, created_by, is_template, status, admin_notification_at FROM social_media_drafts WHERE id = ?')
    .get(id) as { id: string; image_urls: string; created_by: string; is_template: number; status?: string; admin_notification_at?: string | null } | undefined

  if (!existingDraft) {
    cleanupFiles(files)
    res.status(404).json({ success: false, error: 'Entwurf nicht gefunden.' })
    return
  }

  const actorIsAdmin = canManageSocialMediaLibrary(actorId)
  const wantsTemplate = isTemplate === 'true'
  const isTemplateDraft = Boolean(existingDraft.is_template)

  if (isTemplateDraft && !actorIsAdmin) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Vorlagen koennen nur vom Admin bearbeitet werden.' })
    return
  }

  if (!isTemplateDraft && !actorIsAdmin && existingDraft.created_by !== actorId) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Du kannst nur deine eigenen Entwuerfe bearbeiten.' })
    return
  }

  if (wantsTemplate && !actorIsAdmin) {
    cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Vorlagen koennen nur vom Admin gespeichert werden.' })
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
  const finalImageUrls = resolveUpdateImageOrder(imageOrder, retainedImageUrls, uploadedImageUrls)
  const mappedLayers = remapLayerImageRefs(parseLayers(layers), uploadedImageUrls, retainedImageUrls)
  const previousImageUrls = parseImageUrls(existingDraft.image_urls)
  const removedImageUrls = previousImageUrls.filter((imageUrl) => !retainedImageUrls.includes(imageUrl))
  const normalizedHashtags = parseHashtags(hashtags)
  const normalizedStatus = status === 'submitted' ? 'submitted' : (status === 'draft' ? 'draft' : (existingDraft.status as 'draft' | 'submitted' | undefined) ?? 'draft')
  const shouldFlagAdmin =
    (setAdminNotified === 'true' && !existingDraft.admin_notification_at) ||
    (normalizedStatus === 'submitted' && !existingDraft.admin_notification_at && existingDraft.status !== 'submitted')
  const nextAdminNotificationAt = shouldFlagAdmin
    ? now()
    : (existingDraft.admin_notification_at ?? null)

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
      is_template = ?,
      posting_text = ?,
      hashtags = ?,
      status = ?,
      admin_notification_at = ?,
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
    wantsTemplate ? 1 : 0,
    (postingText || '').trim(),
    JSON.stringify(normalizedHashtags),
    normalizedStatus,
    nextAdminNotificationAt,
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

  if (!canUseSocialMedia(actorId)) {
    res.status(403).json({ success: false, error: 'Nur freigeschaltete Trainer oder Admin duerfen Social Media nutzen.' })
    return
  }

  const draft = db
    .prepare('SELECT id, image_urls, created_by, is_template FROM social_media_drafts WHERE id = ?')
    .get(id) as { id: string; image_urls: string; created_by: string; is_template: number } | undefined

  if (!draft) {
    res.status(404).json({ success: false, error: 'Entwurf nicht gefunden.' })
    return
  }

  const actorIsAdmin = canManageSocialMediaLibrary(actorId)
  if (Boolean(draft.is_template) && !actorIsAdmin) {
    res.status(403).json({ success: false, error: 'Vorlagen koennen nur vom Admin geloescht werden.' })
    return
  }

  if (!Boolean(draft.is_template) && !actorIsAdmin && draft.created_by !== actorId) {
    res.status(403).json({ success: false, error: 'Du kannst nur deine eigenen Entwuerfe loeschen.' })
    return
  }

  db.prepare('DELETE FROM social_media_drafts WHERE id = ?').run(id)
  // ACHTUNG: BIBLIOTHEKS-ASSETS UND VORLAGEN-BILDER NIEMALS LÖSCHEN!
  // Auch Draft-eigene Uploads behalten wir jetzt, ausversehen löschen ist zu gefährlich!
  // deleteDraftImages(parseImageUrls(draft.image_urls))

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

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Textbausteine koennen nur vom Admin verwaltet werden.' })
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

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Textbausteine koennen nur vom Admin verwaltet werden.' })
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

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Textbausteine koennen nur vom Admin verwaltet werden.' })
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

router.post('/crests', crestUpload.single('image'), (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const name = req.body.name as string | undefined
  const file = req.file

  if (!actorId) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMediaLibrary(actorId)) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }
    res.status(403).json({ success: false, error: 'Wappen koennen nur vom Admin verwaltet werden.' })
    return
  }

  if (!name?.trim() || !file) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }
    res.status(400).json({ success: false, error: 'Bitte Namen und Bild fuer das Wappen angeben.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    INSERT INTO social_media_crests (
      id,
      name,
      image_url,
      created_by,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    createId('crest'),
    name.trim(),
    `/uploads/social-media-crests/${file.filename}`,
    actorId,
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/crests/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Wappen koennen nur vom Admin verwaltet werden.' })
    return
  }

  const crest = db
    .prepare('SELECT id, image_url FROM social_media_crests WHERE id = ?')
    .get(id) as { id: string; image_url: string } | undefined

  if (!crest) {
    res.status(404).json({ success: false, error: 'Wappen nicht gefunden.' })
    return
  }

  db.prepare('DELETE FROM social_media_crests WHERE id = ?').run(id)
  const filePath = path.join(crestUploadDir, path.basename(crest.image_url))
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/fonts', fontUpload.single('font'), (req: Request, res: Response) => {
  const actorId = req.body.actorId as string | undefined
  const name = req.body.name as string | undefined
  const family = req.body.family as string | undefined
  const file = req.file

  if (!actorId) {
    cleanupFiles(file ? [file] : undefined)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMediaLibrary(actorId)) {
    cleanupFiles(file ? [file] : undefined)
    res.status(403).json({ success: false, error: 'Schriftarten koennen nur vom Admin verwaltet werden.' })
    return
  }

  if (!name?.trim() || !family?.trim() || !file) {
    cleanupFiles(file ? [file] : undefined)
    res.status(400).json({ success: false, error: 'Bitte Namen, Schriftfamilie und Font-Datei angeben.' })
    return
  }

  const timestamp = now()
  db.prepare(`
    INSERT INTO social_media_fonts (
      id,
      name,
      family,
      file_url,
      created_by,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId('font'),
    name.trim(),
    family.trim(),
    `/uploads/social-media-fonts/${file.filename}`,
    actorId,
    timestamp,
    timestamp,
  )

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/fonts/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Schriftarten koennen nur vom Admin verwaltet werden.' })
    return
  }

  const font = db
    .prepare('SELECT id, file_url FROM social_media_fonts WHERE id = ?')
    .get(id) as { id: string; file_url: string } | undefined

  if (!font) {
    res.status(404).json({ success: false, error: 'Schriftart nicht gefunden.' })
    return
  }

  db.prepare('DELETE FROM social_media_fonts WHERE id = ?').run(id)
  const filePath = path.join(fontUploadDir, path.basename(font.file_url))
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/asset-folders', (req: Request, res: Response) => {
  const actorId = req.body?.actorId as string | undefined
  const name = req.body?.name as string | undefined
  const sortOrder = req.body?.sortOrder as number | undefined

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Ordner koennen nur vom Admin / Vorstand angelegt werden.' })
    return
  }

  if (!name?.trim()) {
    res.status(400).json({ success: false, error: 'Ordnername fehlt.' })
    return
  }

  try {
    createSocialMediaAssetFolder({
      actorId,
      name: name.trim(),
      sortOrder: typeof sortOrder === 'number' ? sortOrder : null,
    })
  } catch (err) {
    res.status(400).json({
      success: false,
      error: (err as { message?: string })?.message ?? 'Ordner konnte nicht angelegt werden.',
    })
    return
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/asset-folders/:folderId', (req: Request, res: Response) => {
  const { folderId } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageSocialMediaLibrary(actorId)) {
    res.status(403).json({ success: false, error: 'Ordner koennen nur vom Admin / Vorstand geloescht werden.' })
    return
  }

  try {
    deleteSocialMediaAssetFolder({ actorId, folderId })
  } catch (err) {
    res.status(400).json({
      success: false,
      error: (err as { message?: string })?.message ?? 'Ordner konnte nicht geloescht werden.',
    })
    return
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/assets', upload.array('images', 16), (req: Request, res: Response) => {
  const actorId = req.body?.actorId as string | undefined
  const folderIdRaw = req.body?.folderId as string | undefined
  const folderId = folderIdRaw?.trim() || null
  const files = req.files as Express.Multer.File[] | undefined

  if (!actorId) {
    if (files?.length) cleanupFiles(files)
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canUseSocialMedia(actorId)) {
    if (files?.length) cleanupFiles(files)
    res.status(403).json({ success: false, error: 'Zugriff verweigert.' })
    return
  }

  if (!files?.length) {
    res.status(400).json({ success: false, error: 'Mindestens ein Bild zum Hochladen angeben.' })
    return
  }

  const createdAt = now()
  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const overrideName =
      (Array.isArray(req.body?.assetNames) ? req.body.assetNames[index] : undefined) ||
      file.originalname ||
      'Asset'
    const name = String(overrideName).replace(/\.[^.]+$/, '').trim() || 'Asset'
    const imageUrl = `/uploads/social-media/${file.filename}`
    try {
      createSocialMediaAsset({ actorId, folderId, name, imageUrl })
    } catch (err) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      res.status(400).json({
        success: false,
        error: (err as { message?: string })?.message ?? 'Asset konnte nicht gespeichert werden.',
      })
      return
    }
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.delete('/assets/:assetId', (req: Request, res: Response) => {
  const { assetId } = req.params
  const actorId = (req.body?.actorId as string | undefined) ?? (req.query.actorId as string | undefined)

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canUseSocialMedia(actorId)) {
    res.status(403).json({ success: false, error: 'Zugriff verweigert.' })
    return
  }

  try {
    deleteSocialMediaAsset({ actorId, assetId })
  } catch (err) {
    res.status(400).json({
      success: false,
      error: (err as { message?: string })?.message ?? 'Asset konnte nicht geloescht werden.',
    })
    return
  }

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

export default router
