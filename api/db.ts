import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR =
  process.env.DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT ? '/app/data' : path.join(process.cwd(), 'data'))

fs.mkdirSync(DATA_DIR, { recursive: true })

const dbPath = path.join(DATA_DIR, 'vereinsmanager.sqlite')
console.log(`Using database at: ${dbPath}`)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age_group TEXT NOT NULL,
    season TEXT NOT NULL,
    training_day TEXT NOT NULL,
    location TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    role TEXT NOT NULL CHECK(role IN ('admin', 'trainer', 'player')),
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    membership_role TEXT NOT NULL CHECK(membership_role IN ('trainer', 'player', 'admin')),
    created_at TEXT NOT NULL,
    UNIQUE(team_id, user_id),
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('team', 'direct')),
    team_id TEXT,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversation_participants (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(conversation_id, user_id),
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

const now = () => new Date().toISOString()
const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

const teamCount = db.prepare('SELECT COUNT(*) AS count FROM teams').get() as { count: number }

if (teamCount.count === 0) {
  const createdAt = now()
  const insertTeam = db.prepare(`
    INSERT INTO teams (id, name, age_group, season, training_day, location, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertUser = db.prepare(`
    INSERT INTO users (id, full_name, email, password, phone, role, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMember = db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, membership_role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertConversation = db.prepare(`
    INSERT INTO conversations (id, title, type, team_id, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertParticipant = db.prepare(`
    INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `)
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const seed = db.transaction(() => {
    const teams = [
      {
        id: 'team_u13',
        name: 'SG Wiking U13',
        ageGroup: 'U13',
        season: '2026/2027',
        trainingDay: 'Montag & Mittwoch, 17:00 Uhr',
        location: 'Kunstrasenplatz Nord',
        notes: 'Fokus auf Technik, Ballgefuehl und Teamgeist.',
      },
      {
        id: 'team_u15',
        name: 'SG Wiking U15',
        ageGroup: 'U15',
        season: '2026/2027',
        trainingDay: 'Dienstag & Donnerstag, 18:00 Uhr',
        location: 'Hauptplatz Wiking',
        notes: 'Ligabetrieb mit erweitertem Athletiktraining.',
      },
      {
        id: 'team_u17',
        name: 'SG Wiking U17',
        ageGroup: 'U17',
        season: '2026/2027',
        trainingDay: 'Montag, Mittwoch & Freitag, 18:30 Uhr',
        location: 'Stadion Nebenfeld',
        notes: 'Leistungsbereich mit individueller Entwicklungsplanung.',
      },
    ]

    const users = [
      {
        id: 'user_admin',
        fullName: 'Lena Hoffmann',
        email: 'admin@wiking-verein.de',
        password: 'admin123',
        phone: '0170 1234567',
        role: 'admin',
        notes: 'Vereinskoordination und Gesamtverwaltung.',
      },
      {
        id: 'user_trainer_1',
        fullName: 'Maren Schulz',
        email: 'maren.schulz@wiking-verein.de',
        password: 'trainer123',
        phone: '0171 2233445',
        role: 'trainer',
        notes: 'Trainerin U13, Schwerpunkt Technik.',
      },
      {
        id: 'user_trainer_2',
        fullName: 'Svenja Becker',
        email: 'svenja.becker@wiking-verein.de',
        password: 'trainer123',
        phone: '0171 9988776',
        role: 'trainer',
        notes: 'Trainerin Leistungsbereich.',
      },
      {
        id: 'user_player_1',
        fullName: 'Nele Hansen',
        email: 'nele.hansen@wiking-verein.de',
        password: 'spielerin123',
        phone: '0151 1111111',
        role: 'player',
        notes: 'Mittelfeld, sehr hohe Trainingspraesenz.',
      },
      {
        id: 'user_player_2',
        fullName: 'Mia Jensen',
        email: 'mia.jensen@wiking-verein.de',
        password: 'spielerin123',
        phone: '0151 2222222',
        role: 'player',
        notes: 'Abwehr, Kapitaenin U15.',
      },
      {
        id: 'user_player_3',
        fullName: 'Jule Petersen',
        email: 'jule.petersen@wiking-verein.de',
        password: 'spielerin123',
        phone: '0151 3333333',
        role: 'player',
        notes: 'Angriff, Vorbereitung auf Damenbereich.',
      },
    ]

    const memberships = [
      ['team_u13', 'user_admin', 'admin'],
      ['team_u15', 'user_admin', 'admin'],
      ['team_u17', 'user_admin', 'admin'],
      ['team_u13', 'user_trainer_1', 'trainer'],
      ['team_u15', 'user_trainer_2', 'trainer'],
      ['team_u17', 'user_trainer_2', 'trainer'],
      ['team_u13', 'user_player_1', 'player'],
      ['team_u15', 'user_player_2', 'player'],
      ['team_u17', 'user_player_3', 'player'],
    ] as const

    teams.forEach((team) => {
      insertTeam.run(
        team.id,
        team.name,
        team.ageGroup,
        team.season,
        team.trainingDay,
        team.location,
        team.notes,
        createdAt,
      )
    })

    users.forEach((user) => {
      insertUser.run(
        user.id,
        user.fullName,
        user.email,
        bcrypt.hashSync(user.password, 10),
        user.phone,
        user.role,
        user.notes,
        createdAt,
      )
    })

    memberships.forEach(([teamId, userId, membershipRole]) => {
      insertMember.run(createId('member'), teamId, userId, membershipRole, createdAt)
    })

    teams.forEach((team) => {
      const conversationId = `conversation_${team.id}`
      insertConversation.run(
        conversationId,
        `${team.name} Teamchat`,
        'team',
        team.id,
        createdAt,
        createdAt,
      )

      const memberIds = memberships
        .filter(([entryTeamId]) => entryTeamId === team.id)
        .map(([, userId]) => userId)

      memberIds.forEach((userId) => {
        insertParticipant.run(createId('participant'), conversationId, userId, createdAt)
      })
    })

    insertConversation.run(
      'conversation_direct_admin_trainer',
      'Lena Hoffmann & Maren Schulz',
      'direct',
      null,
      createdAt,
      createdAt,
    )
    insertParticipant.run(
      createId('participant'),
      'conversation_direct_admin_trainer',
      'user_admin',
      createdAt,
    )
    insertParticipant.run(
      createId('participant'),
      'conversation_direct_admin_trainer',
      'user_trainer_1',
      createdAt,
    )

    insertMessage.run(
      'message_1',
      'conversation_team_u13',
      'user_trainer_1',
      'Bitte denkt an die neuen Trainingsshirts fuer Mittwoch.',
      createdAt,
    )
    insertMessage.run(
      'message_2',
      'conversation_team_u15',
      'user_trainer_2',
      'Am Donnerstag beginnen wir 15 Minuten frueher mit Athletik.',
      createdAt,
    )
    insertMessage.run(
      'message_3',
      'conversation_direct_admin_trainer',
      'user_admin',
      'Kannst du mir bitte die finale Kaderliste fuer das Wochenende schicken?',
      createdAt,
    )
  })

  seed()
}

type TeamRow = {
  id: string
  name: string
  age_group: string
  season: string
  training_day: string
  location: string
  notes: string
  created_at: string
}

type UserRow = {
  id: string
  full_name: string
  email: string
  password: string
  phone: string
  role: 'admin' | 'trainer' | 'player'
  notes: string
  created_at: string
}

type ConversationRow = {
  id: string
  title: string
  type: 'team' | 'direct'
  team_id: string | null
  updated_at: string
  created_at: string
}

type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export const mapTeam = (row: TeamRow) => ({
  id: row.id,
  name: row.name,
  ageGroup: row.age_group,
  season: row.season,
  trainingDay: row.training_day,
  location: row.location,
  notes: row.notes,
  createdAt: row.created_at,
})

export const getTeamIdsByUserId = (userId: string) =>
  (
    db.prepare('SELECT team_id FROM team_members WHERE user_id = ? ORDER BY created_at ASC').all(userId) as {
      team_id: string
    }[]
  ).map((row) => row.team_id)

export const mapUser = (row: UserRow, includePassword = false) => {
  const base = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    teamIds: getTeamIdsByUserId(row.id),
    notes: row.notes,
    createdAt: row.created_at,
  }

  return includePassword ? { ...base, password: row.password } : base
}

export const getTeams = () =>
  (db.prepare('SELECT * FROM teams ORDER BY age_group ASC').all() as TeamRow[]).map(mapTeam)

export const getUsers = () =>
  (db.prepare('SELECT * FROM users ORDER BY full_name ASC').all() as UserRow[]).map((row) =>
    mapUser(row),
  )

export const getUserById = (userId: string) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  return row ? mapUser(row) : null
}

export const getUserByEmail = (email: string) =>
  db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined

export const getParticipantsForConversation = (conversation: ConversationRow) => {
  if (conversation.type === 'team' && conversation.team_id) {
    return getTeamIdsUsers(conversation.team_id)
  }

  return (
    db.prepare(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = ? ORDER BY created_at ASC',
    ).all(conversation.id) as { user_id: string }[]
  ).map((row) => row.user_id)
}

export const getTeamIdsUsers = (teamId: string) =>
  (
    db.prepare('SELECT user_id FROM team_members WHERE team_id = ? ORDER BY created_at ASC').all(teamId) as {
      user_id: string
    }[]
  ).map((row) => row.user_id)

export const getConversations = () =>
  (
    db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC, created_at DESC').all() as ConversationRow[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    teamId: row.team_id ?? undefined,
    participantIds: getParticipantsForConversation(row),
    updatedAt: row.updated_at,
  }))

export const getMessages = () =>
  (
    db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as MessageRow[]
  ).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  }))

export const getSetting = (key: string) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined

  return row?.value ?? null
}

export const setSetting = (key: string, value: string) => {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}

export const getSettings = () => ({
  clubName: getSetting('club_name') ?? 'SG Wiking Offenbach',
  logoUrl: getSetting('team_logo_url'),
})

export const getBootstrapData = (userId?: string | null) => ({
  teams: getTeams(),
  users: getUsers(),
  conversations: getConversations(),
  messages: getMessages(),
  settings: getSettings(),
  currentUser: userId ? getUserById(userId) : null,
})

export default db
export { createId, DATA_DIR, now }
