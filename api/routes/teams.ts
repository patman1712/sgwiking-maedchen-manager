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
const uploadDir = path.join(DATA_DIR, 'uploads', 'teams')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname) || '.jpg'
    callback(null, `team-${req.params.id}-${Date.now()}${extension}`)
  },
})

const upload = multer({ storage })

const canManageMatches = (actorId: string, teamId: string) =>
  isAdminOrBoard(actorId) || userHasTeamRole(actorId, teamId, 'trainer')

const normalizeFussballDeTeamId = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  const urlMatch = trimmed.match(/team-id\/([a-z0-9]+)/i)
  if (urlMatch?.[1]) {
    return urlMatch[1].toUpperCase()
  }

  const plainMatch = trimmed.match(/([a-z0-9]{10,})/i)
  return (plainMatch?.[1] ?? '').toUpperCase()
}

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )

const stripHtml = (value: string) =>
  decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const parseGermanKickoff = (value: string) => {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{2,4}).*?(\d{2}:\d{2})/)

  if (!match) {
    return null
  }

  const [, day, month, rawYear, time] = match
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
  return new Date(`${year}-${month}-${day}T${time}:00`).toISOString()
}

const getSeasonDateRange = (season: string) => {
  const match = season.match(/(\d{4})\s*\/\s*(\d{4})/)

  if (!match) {
    return null
  }

  const [, fromYear, toYear] = match
  return {
    from: `${fromYear}-07-01`,
    to: `${toYear}-06-30`,
  }
}

const parseFussballDeMatches = (html: string, teamName: string, teamId: string) => {
  const rows = Array.from(html.matchAll(/<tr(?: class="([^"]*)")?>([\s\S]*?)<\/tr>/g))
  const matches: Array<{
    opponent: string
    kickoffAt: string
    location: string
    isHome: boolean
  }> = []
  let currentKickoffAt: string | null = null

  rows.forEach(([, rowClass = '', content]) => {
    if (rowClass.includes('row-competition')) {
      const dateMatch = content.match(/<td class="column-date">([\s\S]*?)<\/td>/)
      currentKickoffAt = dateMatch ? parseGermanKickoff(stripHtml(dateMatch[1])) : null
      return
    }

    if (!content.includes('column-club') || !content.includes('column-detail') || !currentKickoffAt) {
      return
    }

    const clubNames = Array.from(
      content.matchAll(/<div class="club-name">\s*([\s\S]*?)\s*<\/div>/g),
    ).map((entry) => stripHtml(entry[1]))

    if (clubNames.length < 2) {
      return
    }

    const clubLinks = Array.from(content.matchAll(/href="([^"]*team-id\/[^"]+)"/g)).map(
      (entry) => entry[1],
    )
    const homeIsCurrentTeam = clubLinks[0]?.includes(`team-id/${teamId}`) || clubNames[0] === teamName
    const awayIsCurrentTeam = clubLinks[1]?.includes(`team-id/${teamId}`) || clubNames[1] === teamName

    if (!homeIsCurrentTeam && !awayIsCurrentTeam) {
      return
    }

    const isHome = homeIsCurrentTeam
    const opponent = isHome ? clubNames[1] : clubNames[0]
    const venueMatch = content.match(/<td class="column-venue[^"]*">([\s\S]*?)<\/td>/)
    const venueText = venueMatch ? stripHtml(venueMatch[1]) : ''
    const location = venueText || (isHome ? 'Heimspiel' : 'Auswaertsspiel')

    matches.push({
      opponent,
      kickoffAt: currentKickoffAt,
      location,
      isHome,
    })
  })

  return matches
}

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

router.post('/', (req: Request, res: Response) => {
  const { name, ageGroup, season, trainingDay, location, notes, fussballDeTeamId } = req.body as Record<string, string>

  if (!name || !ageGroup || !season || !trainingDay || !location) {
    res.status(400).json({ success: false, error: 'Bitte alle Pflichtfelder ausfuellen.' })
    return
  }

  const teamId = createId('team')
  const timestamp = now()

  db.prepare(`
    INSERT INTO teams (
      id,
      name,
      age_group,
      season,
      training_day,
      location,
      notes,
      fussball_de_team_id,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    teamId,
    name,
    ageGroup,
    season,
    trainingDay,
    location,
    notes ?? '',
    normalizeFussballDeTeamId(fussballDeTeamId ?? ''),
    timestamp,
  )

  db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, 'team', ?, ?, ?)
  `).run(createId('conversation'), `${name} Teamchat`, teamId, timestamp, timestamp)

  res.json({
    success: true,
    teamId,
    ...getBootstrapData(null),
  })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { name, ageGroup, season, trainingDay, location, notes, fussballDeTeamId } = req.body as Record<string, string>

  db.prepare(`
    UPDATE teams
    SET name = ?, age_group = ?, season = ?, training_day = ?, location = ?, notes = ?, fussball_de_team_id = ?
    WHERE id = ?
  `).run(
    name,
    ageGroup,
    season,
    trainingDay,
    location,
    notes ?? '',
    normalizeFussballDeTeamId(fussballDeTeamId ?? ''),
    id,
  )

  db.prepare(`
    UPDATE conversations
    SET title = ?
    WHERE team_id = ? AND type = 'team'
  `).run(`${name} Teamchat`, id)

  res.json({
    success: true,
    ...getBootstrapData(null),
  })
})

router.post('/:id/import-fussballde', async (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = req.body.actorId as string | undefined

  const team = db
    .prepare('SELECT id, name, season, fussball_de_team_id, location FROM teams WHERE id = ?')
    .get(id) as
    | { id: string; name: string; season: string; fussball_de_team_id: string; location: string }
    | undefined

  if (!team) {
    res.status(404).json({ success: false, error: 'Mannschaft nicht gefunden.' })
    return
  }

  if (!actorId) {
    res.status(400).json({ success: false, error: 'Fehlender Benutzerkontext.' })
    return
  }

  if (!canManageMatches(actorId, id)) {
    res.status(403).json({
      success: false,
      error: 'Den Spielplan duerfen nur zustaendige Trainer, Admin oder Vorstand importieren.',
    })
    return
  }

  if (!team.fussball_de_team_id) {
    res.status(400).json({
      success: false,
      error: 'Bitte zuerst in der Teamverwaltung eine fussball.de Team-ID hinterlegen.',
    })
    return
  }

  const normalizedTeamId = normalizeFussballDeTeamId(team.fussball_de_team_id)

  if (!normalizedTeamId) {
    res.status(400).json({
      success: false,
      error: 'Bitte eine gueltige fussball.de Team-ID hinterlegen.',
    })
    return
  }

  try {
    const url = `https://www.fussball.de/ajax.team.matchplan/-/mode/PAGE/prev-season-allowed/true/team-id/${normalizedTeamId}`

    const response = await fetch(url, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      res.status(502).json({
        success: false,
        error: 'fussball.de konnte gerade nicht geladen werden.',
      })
      return
    }

    const html = await response.text()
    const importedMatches = parseFussballDeMatches(html, team.name, normalizedTeamId)

    if (!importedMatches.length) {
      res.status(400).json({
        success: false,
        error: 'Es konnten keine Spiele aus fussball.de erkannt werden.',
      })
      return
    }

    const insertMatch = db.prepare(`
      INSERT INTO matches (id, team_id, opponent, kickoff_at, location, is_home, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const findExisting = db.prepare(
      'SELECT id FROM matches WHERE team_id = ? AND opponent = ? AND kickoff_at = ? LIMIT 1',
    )

    let importedCount = 0
    const timestamp = now()

    importedMatches.forEach((match) => {
      const existing = findExisting.get(id, match.opponent, match.kickoffAt) as
        | { id: string }
        | undefined

      if (existing) {
        return
      }

      insertMatch.run(
        createId('match'),
        id,
        match.opponent,
        match.kickoffAt,
        match.location || (match.isHome ? team.location : 'Auswaertsspiel'),
        match.isHome ? 1 : 0,
        '',
        timestamp,
      )
      importedCount += 1
    })

    res.json({
      success: true,
      importedCount,
      ...getBootstrapData(actorId),
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'Der Import von fussball.de ist fehlgeschlagen.',
    })
  }
})

router.put('/:id/members', (req: Request, res: Response) => {
  const { id } = req.params
  const { actorId, trainerIds, playerIds } = req.body as {
    actorId?: string
    trainerIds?: string[]
    playerIds?: string[]
  }

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({
      success: false,
      error: 'Teamzuweisungen koennen nur von Admin oder Vorstand geaendert werden.',
    })
    return
  }

  const timestamp = now()
  const nextTrainerIds = trainerIds ?? []
  const nextPlayerIds = playerIds ?? []
  const keepIds = new Set([...nextTrainerIds, ...nextPlayerIds])

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM team_members WHERE team_id = ? AND membership_role IN (?, ?)').run(
      id,
      'trainer',
      'player',
    )

    const insertMember = db.prepare(`
      INSERT INTO team_members (id, team_id, user_id, membership_role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)

    nextTrainerIds.forEach((userId) => {
      insertMember.run(createId('member'), id, userId, 'trainer', timestamp)
    })

    nextPlayerIds.forEach((userId) => {
      insertMember.run(createId('member'), id, userId, 'player', timestamp)
    })

    const adminIds = (
      db.prepare("SELECT id FROM users WHERE role IN ('admin', 'board')").all() as { id: string }[]
    ).map((row) => row.id)

    const teamConversation = db
      .prepare("SELECT id FROM conversations WHERE team_id = ? AND type = 'team'")
      .get(id) as { id: string } | undefined

    if (teamConversation) {
      db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ?').run(
        teamConversation.id,
      )

      const participantIds = Array.from(new Set([...adminIds, ...keepIds]))
      const insertParticipant = db.prepare(`
        INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
        VALUES (?, ?, ?, ?)
      `)

      participantIds.forEach((userId) => {
        insertParticipant.run(createId('participant'), teamConversation.id, userId, timestamp)
      })
    }
  })

  transaction()

  res.json({
    success: true,
    ...getBootstrapData(actorId),
  })
})

router.post('/:id/photo', upload.single('photo'), (req: Request, res: Response) => {
  const { id } = req.params
  const actorId = req.body.actorId as string | undefined

  if (!actorId || !isAdminOrBoard(actorId)) {
    res.status(403).json({ success: false, error: 'Mannschaftsfotos koennen nur von Admin oder Vorstand geaendert werden.' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, error: 'Bitte eine Bilddatei auswaehlen.' })
    return
  }

  const current = db.prepare('SELECT photo_url FROM teams WHERE id = ?').get(id) as {
    photo_url: string | null
  } | undefined

  const photoUrl = `/uploads/teams/${req.file.filename}?v=${encodeURIComponent(now())}`
  db.prepare('UPDATE teams SET photo_url = ? WHERE id = ?').run(photoUrl, id)

  if (current?.photo_url) {
    const match = current.photo_url.match(/\/uploads\/teams\/([^?]+)/)
    const filename = match?.[1]
    if (filename) {
      try {
        fs.unlinkSync(path.join(uploadDir, filename))
      } catch {
        // ignore
      }
    }
  }

  res.json({
    success: true,
    photoUrl,
    ...getBootstrapData(actorId),
  })
})

export default router
