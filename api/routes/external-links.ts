import { Router, type Request, type Response } from 'express'
import {
  createCustomExternalLink,
  deleteCustomExternalLink,
  getBootstrapData,
  getCustomExternalLinkById,
  getUserRowById,
  now,
  updateCustomExternalLink,
} from '../db.js'

type UserRole = 'admin' | 'trainer' | 'player' | 'board' | 'social'

const router = Router()

const assertAdmin = (actorId: string | null | undefined, res: Response) => {
  if (!actorId) {
    res.status(401).json({ success: false, error: 'Bitte zuerst anmelden.' })
    return null
  }

  const actor = getUserRowById(actorId)
  if (!actor) {
    res.status(401).json({ success: false, error: 'Benutzer nicht gefunden.' })
    return null
  }

  if (actor.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Nur Vereinsadmin darf diese Aktion durchfuehren.' })
    return null
  }

  return actor
}

const validRoles: UserRole[] = ['admin', 'trainer', 'player', 'board', 'social']
const sanitizeRoleVisibility = (raw: unknown): UserRole[] => {
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is UserRole => validRoles.includes(entry as UserRole))
}

const normalizeUrl = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  const trimmed = raw.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    actorId?: string
    menuName?: unknown
    url?: unknown
    roleVisibility?: unknown
    sortOrder?: unknown
  }

  const actor = assertAdmin(body.actorId, res)
  if (!actor) return

  const menuName = typeof body.menuName === 'string' ? body.menuName.trim() : ''
  const url = normalizeUrl(body.url)
  const roleVisibility = sanitizeRoleVisibility(body.roleVisibility)
  const sortOrder =
    typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : 0

  if (!menuName) {
    res.status(400).json({ success: false, error: 'Bitte einen Menuenamen eingeben.' })
    return
  }

  if (!url || url === 'https://') {
    res.status(400).json({ success: false, error: 'Bitte eine gueltige URL eingeben.' })
    return
  }

  createCustomExternalLink({
    createdBy: actor.id,
    menuName,
    url,
    roleVisibility: roleVisibility.length ? roleVisibility : [...validRoles],
    sortOrder,
  })

  res.json({
    success: true,
    ...getBootstrapData(actor.id),
  })
})

router.put('/:linkId', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as {
    actorId?: string
    menuName?: unknown
    url?: unknown
    roleVisibility?: unknown
    sortOrder?: unknown
  }

  const { linkId } = req.params
  const actor = assertAdmin(body.actorId, res)
  if (!actor) return

  const existing = getCustomExternalLinkById(linkId)
  if (!existing) {
    res.status(404).json({ success: false, error: 'Link nicht gefunden.' })
    return
  }

  const patch: Parameters<typeof updateCustomExternalLink>[1] = {}

  if (typeof body.menuName === 'string' && body.menuName.trim()) {
    patch.menuName = body.menuName.trim()
  }

  if (typeof body.url === 'string' && body.url.trim()) {
    const nextUrl = normalizeUrl(body.url)
    if (nextUrl && nextUrl !== 'https://') {
      patch.url = nextUrl
    }
  }

  if (Array.isArray(body.roleVisibility)) {
    const sanitized = sanitizeRoleVisibility(body.roleVisibility)
    patch.roleVisibility = sanitized.length ? sanitized : [...validRoles]
  }

  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    patch.sortOrder = body.sortOrder
  }

  updateCustomExternalLink(linkId, patch)

  res.json({
    success: true,
    ...getBootstrapData(actor.id),
  })
})

router.delete('/:linkId', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { actorId?: string }
  const { linkId } = req.params

  const actor = assertAdmin(body.actorId, res)
  if (!actor) return

  const existing = getCustomExternalLinkById(linkId)
  if (!existing) {
    res.status(404).json({ success: false, error: 'Link nicht gefunden.' })
    return
  }

  deleteCustomExternalLink(linkId)

  res.json({
    success: true,
    ...getBootstrapData(actor.id),
  })
})

export default router
