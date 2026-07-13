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

const normalizeFussballDeAssetUrl = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  if (value.startsWith('/')) {
    return `https://www.fussball.de${value}`
  }

  return value
}

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

const getPreviousSeason = (season: string) => {
  const match = season.match(/(\d{4})\s*\/\s*(\d{4})/)

  if (!match) {
    return null
  }

  const fromYear = Number(match[1])
  const toYear = Number(match[2])

  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) {
    return null
  }

  return `${fromYear - 1}/${toYear - 1}`
}

const buildFussballDeMatchplanUrl = (params: {
  teamId: string
  from?: string | null
  to?: string | null
  max: number
  offset: number
}) => {
  const segments = [
    'https://www.fussball.de/ajax.team.matchplan/-/mime-type/JSON/mode/PAGE/prev-season-allowed/true/show-filter/false/show-venues/true',
  ]

  if (params.to) {
    segments.push(`datum-bis/${params.to}`)
  }

  if (params.from) {
    segments.push(`datum-von/${params.from}`)
  }

  segments.push(`max/${params.max}`)
  segments.push(`offset/${params.offset}`)
  segments.push(`team-id/${params.teamId}`)

  return segments.join('/')
}

const buildFussballDeTableNavUrl = (teamId: string) =>
  `https://www.fussball.de/ajax.team.table.nav/-/team-id/${teamId}`

const buildFussballDeTableUrl = (params: {
  teamId: string
  seasonCode: string
  competitionId: string
}) =>
  `https://www.fussball.de/ajax.team.table/-/saison/${params.seasonCode}/staffel/${params.competitionId}/team-id/${params.teamId}`

const fetchFussballDeText = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error('fussball.de konnte gerade nicht geladen werden.')
  }

  return response.text()
}

const toFussballDeSeasonCode = (season: string) => {
  const match = season.match(/(\d{4})\s*\/\s*(\d{4})/)

  if (!match) {
    return null
  }

  return `${match[1].slice(-2)}${match[2].slice(-2)}`
}

const parseFussballDeTableNav = (html: string) => {
  const seasonOptions = Array.from(
    html.matchAll(/<option value="([^"]+)"([^>]*)>([\s\S]*?)<\/option>/g),
  )
    .map(([, value, attributes, label]) => ({
      value,
      label: stripHtml(label),
      selected: attributes.includes('selected'),
    }))
    .filter((option) => /^\d{4}$/.test(option.value))

  const competitionBlockMatch = html.match(
    /<select size="1" name="staffel">([\s\S]*?)<\/select>/,
  )
  const competitionOptions = competitionBlockMatch
    ? Array.from(competitionBlockMatch[1].matchAll(/<option value="([^"]+)"([^>]*)>([\s\S]*?)<\/option>/g)).map(
        ([, value, attributes, label]) => ({
          value,
          label: stripHtml(label),
          selected: attributes.includes('selected'),
        }),
      )
    : []

  return {
    seasons: seasonOptions,
    competitions: competitionOptions,
  }
}

const parseFussballDeTable = (html: string) =>
  Array.from(html.matchAll(/<tr(?: class="([^"]*)")?>([\s\S]*?)<\/tr>/g))
    .map(([, rowClass = '', content]) => {
      const columns = Array.from(content.matchAll(/<td(?: class="([^"]*)")?[^>]*>([\s\S]*?)<\/td>/g)).map(
        ([, className = '', inner]) => ({
          className,
          inner,
          text: stripHtml(inner),
        }),
      )

      const teamColumn = columns.find((column) => column.className.includes('column-club'))
      const logoMatch = teamColumn?.inner.match(/<img src="([^"]+)"/)
      const clubNameMatch = teamColumn?.inner.match(/<div class="club-name">\s*([\s\S]*?)\s*<\/div>/)

      if (!teamColumn || columns.length < 9) {
        return null
      }

      return {
        rank: columns.find((column) => column.className.includes('column-rank'))?.text ?? '',
        teamName: clubNameMatch ? stripHtml(clubNameMatch[1]) : teamColumn.text,
        logoUrl: normalizeFussballDeAssetUrl(logoMatch?.[1] ?? null),
        matchesPlayed: columns[3]?.text ?? '',
        wins: columns[4]?.text ?? '',
        draws: columns[5]?.text ?? '',
        losses: columns[6]?.text ?? '',
        goals: columns[7]?.text ?? '',
        goalDifference: columns[8]?.text ?? '',
        points: columns[9]?.text ?? '',
        isOwnTeam: rowClass.includes('own'),
      }
    })
    .filter(Boolean)

const parseFussballDeMatches = (html: string, teamName: string, teamId: string) => {
  const rows = Array.from(html.matchAll(/<tr(?: class="([^"]*)")?>([\s\S]*?)<\/tr>/g))
  const matches: Array<{
    opponent: string
    kickoffAt: string
    location: string
    isHome: boolean
    competition: string
    homeTeamName: string
    awayTeamName: string
    homeLogoUrl: string | null
    awayLogoUrl: string | null
    matchUrl: string | null
  }> = []
  let currentKickoffAt: string | null = null
  let currentCompetition = ''
  let lastMatchIndex = -1

  rows.forEach(([, rowClass = '', content]) => {
    if (rowClass.includes('row-competition')) {
      const dateMatch = content.match(/<td class="column-date">([\s\S]*?)<\/td>/)
      currentKickoffAt = dateMatch ? parseGermanKickoff(stripHtml(dateMatch[1])) : null
      const competitionMatch = content.match(/<td colspan="3" class="column-team">\s*<a>([\s\S]*?)<\/a>/)
      currentCompetition = competitionMatch ? stripHtml(competitionMatch[1]) : ''
      return
    }

    if (rowClass.includes('row-venue')) {
      if (lastMatchIndex >= 0 && matches[lastMatchIndex]) {
        const venueText = stripHtml(content)
        if (venueText) {
          matches[lastMatchIndex].location = venueText
        }
      }
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
    const clubLogoUrls = Array.from(
      content.matchAll(/data-responsive-image="([^"]+)"/g),
    ).map((entry) => normalizeFussballDeAssetUrl(entry[1]))
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
    const matchUrlMatch = content.match(/href="(https:\/\/www\.fussball\.de\/spiel\/[^"]+)"/)

    matches.push({
      opponent,
      kickoffAt: currentKickoffAt,
      location,
      isHome,
      competition: currentCompetition,
      homeTeamName: clubNames[0],
      awayTeamName: clubNames[1],
      homeLogoUrl: clubLogoUrls[0] ?? null,
      awayLogoUrl: clubLogoUrls[1] ?? null,
      matchUrl: matchUrlMatch?.[1] ?? null,
    })
    lastMatchIndex = matches.length - 1
  })

  return matches
}

const fetchMatchResultFromFussballDe = async (matchUrl: string) => {
  const response = await fetch(matchUrl, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  })

  if (!response.ok) {
    return null
  }

  const html = await response.text()

  if (!html.includes('end-result') || !html.includes('icon-verified')) {
    return null
  }

  const homeGoals = (html.match(/'type':'[^']*goal'[^}]*'team':'home'/g) ?? []).length
  const awayGoals = (html.match(/'type':'[^']*goal'[^}]*'team':'away'/g) ?? []).length

  return `${homeGoals}:${awayGoals}`
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

router.get('/:id/fussballde-table', async (req: Request, res: Response) => {
  const { id } = req.params
  const requestedSeason = (req.query.season as string | undefined) ?? ''

  const team = db
    .prepare('SELECT id, season, fussball_de_team_id FROM teams WHERE id = ?')
    .get(id) as
    | { id: string; season: string; fussball_de_team_id: string }
    | undefined

  if (!team) {
    res.status(404).json({ success: false, error: 'Mannschaft nicht gefunden.' })
    return
  }

  const normalizedTeamId = normalizeFussballDeTeamId(team.fussball_de_team_id)
  if (!normalizedTeamId) {
    res.status(400).json({ success: false, error: 'Keine gueltige fussball.de Team-ID hinterlegt.' })
    return
  }

  try {
    const navHtml = await fetchFussballDeText(buildFussballDeTableNavUrl(normalizedTeamId))
    const nav = parseFussballDeTableNav(navHtml)
    const preferredSeasonCode =
      toFussballDeSeasonCode(requestedSeason || team.season) ??
      nav.seasons.find((entry) => entry.selected)?.value ??
      nav.seasons[0]?.value

    const selectedSeason =
      nav.seasons.find((entry) => entry.value === preferredSeasonCode) ??
      nav.seasons.find((entry) => entry.selected) ??
      nav.seasons[0]

    const selectedCompetition =
      nav.competitions.find((entry) => entry.selected) ?? nav.competitions[0]

    if (!selectedSeason || !selectedCompetition) {
      res.json({
        success: true,
        season: requestedSeason || team.season,
        competition: null,
        standings: [],
      })
      return
    }

    const tableHtml = await fetchFussballDeText(
      buildFussballDeTableUrl({
        teamId: normalizedTeamId,
        seasonCode: selectedSeason.value,
        competitionId: selectedCompetition.value,
      }),
    )

    res.json({
      success: true,
      season: selectedSeason.label,
      competition: selectedCompetition.label,
      standings: parseFussballDeTable(tableHtml),
    })
  } catch {
    res.status(500).json({
      success: false,
      error: 'Die Tabelle von fussball.de konnte nicht geladen werden.',
    })
  }
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
    const seasonRanges = (() => {
      const ranges: Array<{ from: string | null; to: string | null }> = []
      const current = getSeasonDateRange(team.season)
      if (current) {
        ranges.push(current)
      }

      const prevSeason = getPreviousSeason(team.season)
      if (prevSeason) {
        const previous = getSeasonDateRange(prevSeason)
        if (previous) {
          ranges.push(previous)
        }
      }

      return ranges.length ? ranges : [{ from: null, to: null }]
    })()

    const importedMatches: Array<{
      opponent: string
      kickoffAt: string
      location: string
      isHome: boolean
      competition: string
      homeTeamName: string
      awayTeamName: string
      homeLogoUrl: string | null
      awayLogoUrl: string | null
      matchUrl: string | null
    }> = []

    for (const range of seasonRanges) {
      const max = 200
      let offset = 0
      let finished = false

      while (!finished) {
        const url = buildFussballDeMatchplanUrl({
          teamId: normalizedTeamId,
          from: range?.from ?? null,
          to: range?.to ?? null,
          max,
          offset,
        })

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

        const data = (await response.json()) as {
          success: boolean
          html?: string
          final?: boolean
          lastIndex?: number
        }

        if (!data.success || !data.html) {
          finished = true
          continue
        }

        const parsed = parseFussballDeMatches(data.html, team.name, normalizedTeamId)
        importedMatches.push(...parsed)

        if (data.final || typeof data.lastIndex !== 'number' || data.lastIndex < max - 1) {
          finished = true
        } else {
          offset += max
        }
      }
    }

    const uniqueKey = (match: { opponent: string; kickoffAt: string }) =>
      `${match.opponent}__${match.kickoffAt}`
    const uniqueMatches = Array.from(
      new Map(importedMatches.map((match) => [uniqueKey(match), match])).values(),
    )

    if (!uniqueMatches.length) {
      res.status(400).json({
        success: false,
        error: 'Es konnten keine Spiele aus fussball.de erkannt werden.',
      })
      return
    }

    const insertMatch = db.prepare(`
      INSERT INTO matches (
        id,
        team_id,
        opponent,
        kickoff_at,
        location,
        is_home,
        competition,
        home_team_name,
        away_team_name,
        home_logo_url,
        away_logo_url,
        result,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const findExisting = db.prepare(`
      SELECT id, result
      FROM matches
      WHERE team_id = ? AND opponent = ? AND kickoff_at = ?
      LIMIT 1
    `)
    const updateMatch = db.prepare(`
      UPDATE matches
      SET
        location = ?,
        is_home = ?,
        competition = ?,
        home_team_name = ?,
        away_team_name = ?,
        home_logo_url = ?,
        away_logo_url = ?,
        result = COALESCE(NULLIF(?, ''), result)
      WHERE id = ?
    `)

    let importedCount = 0
    const timestamp = now()
    const matchIdToUrl = new Map<string, string>()

    uniqueMatches.forEach((match) => {
      const location = match.location || (match.isHome ? team.location : 'Auswaertsspiel')
      const existing = findExisting.get(id, match.opponent, match.kickoffAt) as
        | { id: string; result: string }
        | undefined

      if (existing) {
        updateMatch.run(
          location,
          match.isHome ? 1 : 0,
          match.competition ?? '',
          match.homeTeamName ?? (match.isHome ? team.name : match.opponent),
          match.awayTeamName ?? (match.isHome ? match.opponent : team.name),
          match.homeLogoUrl ?? '',
          match.awayLogoUrl ?? '',
          '',
          existing.id,
        )
        if (match.matchUrl) {
          matchIdToUrl.set(existing.id, match.matchUrl)
        }
        return
      }

      const matchId = createId('match')
      insertMatch.run(
        matchId,
        id,
        match.opponent,
        match.kickoffAt,
        location,
        match.isHome ? 1 : 0,
        match.competition ?? '',
        match.homeTeamName ?? (match.isHome ? team.name : match.opponent),
        match.awayTeamName ?? (match.isHome ? match.opponent : team.name),
        match.homeLogoUrl ?? '',
        match.awayLogoUrl ?? '',
        '',
        timestamp,
      )
      importedCount += 1

      if (match.matchUrl) {
        matchIdToUrl.set(matchId, match.matchUrl)
      }
    })

    const nowDate = Date.now()
    for (const [matchId, matchUrl] of matchIdToUrl.entries()) {
      const row = db.prepare('SELECT kickoff_at, result FROM matches WHERE id = ?').get(matchId) as
        | { kickoff_at: string; result: string }
        | undefined

      if (!row) {
        continue
      }

      const kickoffTime = new Date(row.kickoff_at).getTime()
      if (!Number.isFinite(kickoffTime) || kickoffTime > nowDate) {
        continue
      }

      if (row.result && row.result.trim()) {
        continue
      }

      const result = await fetchMatchResultFromFussballDe(matchUrl)
      if (!result) {
        continue
      }

      db.prepare('UPDATE matches SET result = ? WHERE id = ?').run(result, matchId)
    }

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
