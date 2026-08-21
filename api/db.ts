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

const detectUsersRoleConstraintIncludesSocial = () => {
  try {
    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get() as { sql: string } | undefined
    return Boolean(row?.sql?.includes("'social'"))
  } catch {
    return false
  }
}
let usersRoleConstraintSupportsSocial = detectUsersRoleConstraintIncludesSocial()

const detectSocialMediaManagerColumnExists = () => {
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
    return cols.some((c) => c.name === 'is_social_media_manager')
  } catch {
    return false
  }
}
let hasSocialMediaManagerColumn = detectSocialMediaManagerColumnExists()

export const refreshUsersRoleConstraintCapabilities = () => {
  usersRoleConstraintSupportsSocial = detectUsersRoleConstraintIncludesSocial()
  hasSocialMediaManagerColumn = detectSocialMediaManagerColumnExists()
}
export const usersRoleConstraintAllowsSocial = () => usersRoleConstraintSupportsSocial
export const LEGACY_SOCIAL_ROLE_STORAGE = 'board' as const
export const canUseLegacySocialMarkerColumn = () => hasSocialMediaManagerColumn

const usersTableSql = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'",
).get() as { sql: string } | undefined

if (usersTableSql && !usersTableSql.sql.includes("'board'")) {
  try {
    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          phone TEXT DEFAULT '',
          role TEXT NOT NULL CHECK(role IN ('admin', 'trainer', 'player', 'board', 'social')),
          notes TEXT DEFAULT '',
          avatar_url TEXT DEFAULT NULL,
          member_number TEXT DEFAULT '',
          birthday TEXT DEFAULT '',
          address TEXT DEFAULT '',
          parent_name TEXT DEFAULT '',
          parent_phone TEXT DEFAULT '',
          parent_email TEXT DEFAULT '',
          is_member INTEGER NOT NULL DEFAULT 0,
          has_membership_application INTEGER NOT NULL DEFAULT 0,
          has_medical_certificate INTEGER NOT NULL DEFAULT 0,
          has_photo_consent_social INTEGER NOT NULL DEFAULT 0,
          is_social_media_manager INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        INSERT INTO users_new (
          id,
          full_name,
          email,
          password,
          phone,
          role,
          notes,
          avatar_url,
          member_number,
          birthday,
          address,
          parent_name,
          parent_phone,
          parent_email,
          is_member,
          has_membership_application,
          has_medical_certificate,
          has_photo_consent_social,
          0,
          created_at
        )
        SELECT
          id,
          full_name,
          email,
          password,
          phone,
          role,
          notes,
          NULL,
          '',
          '',
          '',
          '',
          '',
          '',
          0,
          0,
          0,
          0,
          created_at
        FROM users;

        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `)
    })()
    db.pragma('foreign_keys = ON')
  } catch (err) {
    console.warn('[db] users-table-board-migration konnte nicht durchgefuehrt werden (Restriktion). Server startet trotzdem.', (err as Error)?.message ?? String(err))
    try { db.pragma('foreign_keys = ON') } catch { /* ignore */ }
  }
}

const migrateUsersTableAddSocialRole = (() => {
  try {
    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get() as { sql: string } | undefined
    const originalSql = row?.sql ?? ''
    if (!originalSql) return
    if (originalSql.includes("'social'")) return

    const existingCols = db
      .pragma('table_info(users)') as Array<{ cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number }>
    const colList = existingCols.map((c) => `"${c.name}"`).join(', ')
    const hasSocialManagerCol = existingCols.some((c) => c.name === 'is_social_media_manager')

    db.pragma('foreign_keys = OFF')
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          phone TEXT DEFAULT '',
          role TEXT NOT NULL CHECK(role IN ('admin', 'trainer', 'player', 'board', 'social')),
          notes TEXT DEFAULT '',
          avatar_url TEXT DEFAULT NULL,
          member_number TEXT DEFAULT '',
          birthday TEXT DEFAULT '',
          address TEXT DEFAULT '',
          parent_name TEXT DEFAULT '',
          parent_phone TEXT DEFAULT '',
          parent_email TEXT DEFAULT '',
          is_member INTEGER NOT NULL DEFAULT 0,
          has_membership_application INTEGER NOT NULL DEFAULT 0,
          has_medical_certificate INTEGER NOT NULL DEFAULT 0,
          has_photo_consent_social INTEGER NOT NULL DEFAULT 0,
          is_member_file_url TEXT DEFAULT NULL,
          membership_application_file_url TEXT DEFAULT NULL,
          medical_certificate_file_url TEXT DEFAULT NULL,
          photo_consent_social_file_url TEXT DEFAULT NULL,
          must_change_password INTEGER NOT NULL DEFAULT 0,
          privacy_accepted_at TEXT DEFAULT NULL,
          social_media_enabled INTEGER NOT NULL DEFAULT 0,
          is_social_media_manager INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        INSERT INTO users_new (${colList}${hasSocialManagerCol ? '' : ''}) SELECT ${colList}${hasSocialManagerCol ? '' : ''} FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `)
    })()
    db.pragma('foreign_keys = ON')
  } catch (err) {
    console.warn('[db] migrateUsersTableAddSocialRole konnte nicht automatisch durchgefuehrt werden. Server startet trotzdem.', (err as Error)?.message ?? String(err))
    try { db.pragma('foreign_keys = ON') } catch { /* ignore */ }
  }
})()

try {
  const currentUserCols = (
    db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
  ).map((column) => column.name)
  if (!currentUserCols.includes('is_social_media_manager')) {
    db.prepare('ALTER TABLE users ADD COLUMN is_social_media_manager INTEGER NOT NULL DEFAULT 0').run()
    console.log('[db] Legacy-Spalte is_social_media_manager erfolgreich hinzugefuegt (Sichere Social-Rollen-Erkennung).')
  }
} catch (err) {
  console.warn('[db] Konnte is_social_media_manager Spalte nicht hinzufuegen (optional).', (err as Error)?.message ?? String(err))
}

export const getGermanyDstOffsetMinutes = (year: number, monthOneBased: number, day: number, hour: number, minute: number) => {
  const lastSundayOf = (y: number, mIdxZeroBased: number) => {
    const lastDay = new Date(Date.UTC(y, mIdxZeroBased + 1, 0)).getUTCDate()
    const date = new Date(Date.UTC(y, mIdxZeroBased, lastDay))
    const weekday = date.getUTCDay()
    return lastDay - weekday
  }
  const mIdx = monthOneBased - 1
  const dstStart = lastSundayOf(year, 2)
  const dstEnd = lastSundayOf(year, 9)
  const localMinutes = hour * 60 + minute
  const isDstStartDay = mIdx === 2 && day === dstStart
  const isDstEndDay = mIdx === 9 && day === dstEnd
  if (mIdx > 2 && mIdx < 9) return 120
  if (mIdx === 2) {
    if (day > dstStart) return 120
    if (isDstStartDay && localMinutes >= 2 * 60) return 120
    return 60
  }
  if (mIdx === 9) {
    if (day < dstEnd) return 120
    if (isDstEndDay && localMinutes < 2 * 60) return 120
    return 60
  }
  return 60
}

export const toBerlinNormalizedIso = (value: string | null | undefined) => {
  if (!value) return null
  if (value.includes('Z') || /[+\-]\d{2}:\d{2}$/.test(value)) {
    const t = new Date(value).getTime()
    if (!Number.isFinite(t)) return null
    return new Date(t).toISOString()
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) {
    const onlyDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (onlyDate) {
      const [, y, m, d] = onlyDate
      const offsetMinutes = getGermanyDstOffsetMinutes(Number(y), Number(m), Number(d), 12, 0)
      const sign = offsetMinutes >= 0 ? '+' : '-'
      const absMin = Math.abs(offsetMinutes)
      const hh = String(Math.floor(absMin / 60)).padStart(2, '0')
      const mm = String(absMin % 60).padStart(2, '0')
      return new Date(`${y}-${m}-${d}T12:00:00${sign}${hh}:${mm}`).toISOString()
    }
    const fallbackGermanDate = value.match(/(\d{2})\.(\d{2})\.(\d{2,4}).*?(\d{2}):(\d{2})/)
    if (fallbackGermanDate) {
      const [, day, month, rawYear, timeHour, timeMinute] = fallbackGermanDate
      const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
      const y = Number(year)
      const mo = Number(month)
      const d = Number(day)
      const h = Number(timeHour)
      const min = Number(timeMinute)
      const offsetMinutes = getGermanyDstOffsetMinutes(y, mo, d, h, min)
      const sign = offsetMinutes >= 0 ? '+' : '-'
      const absMin = Math.abs(offsetMinutes)
      const hh = String(Math.floor(absMin / 60)).padStart(2, '0')
      const mm = String(absMin % 60).padStart(2, '0')
      return new Date(`${year}-${month}-${day}T${timeHour}:${timeMinute}:00${sign}${hh}:${mm}`).toISOString()
    }
    const fallbackOnlyDateDe = value.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/)
    if (fallbackOnlyDateDe) {
      const [, day, month, rawYear] = fallbackOnlyDateDe
      const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
      const y = Number(year)
      const mo = Number(month)
      const d = Number(day)
      const offsetMinutes = getGermanyDstOffsetMinutes(y, mo, d, 12, 0)
      const sign = offsetMinutes >= 0 ? '+' : '-'
      const absMin = Math.abs(offsetMinutes)
      const hh = String(Math.floor(absMin / 60)).padStart(2, '0')
      const mm = String(absMin % 60).padStart(2, '0')
      return new Date(`${year}-${month}-${day}T12:00:00${sign}${hh}:${mm}`).toISOString()
    }
    const t = new Date(value).getTime()
    if (!Number.isFinite(t)) return null
    return new Date(t).toISOString()
  }
  const [, yStr, mStr, dStr, hStr, minStr, secStr] = match
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  const h = Number(hStr)
  const min = Number(minStr)
  const sec = secStr ? Number(secStr) : 0
  const offsetMinutes = getGermanyDstOffsetMinutes(y, m, d, h, min)
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMinutes)
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0')
  const mm = String(absMin % 60).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return new Date(`${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:${ss}${sign}${hh}:${mm}`).toISOString()
}

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
    fussball_de_team_id TEXT DEFAULT '',
    photo_url TEXT DEFAULT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    role TEXT NOT NULL CHECK(role IN ('admin', 'trainer', 'player', 'board', 'social')),
    notes TEXT DEFAULT '',
    avatar_url TEXT DEFAULT NULL,
    member_number TEXT DEFAULT '',
    birthday TEXT DEFAULT '',
    address TEXT DEFAULT '',
    parent_name TEXT DEFAULT '',
    parent_phone TEXT DEFAULT '',
    parent_email TEXT DEFAULT '',
    is_member INTEGER NOT NULL DEFAULT 0,
    has_membership_application INTEGER NOT NULL DEFAULT 0,
    has_medical_certificate INTEGER NOT NULL DEFAULT 0,
    has_photo_consent_social INTEGER NOT NULL DEFAULT 0,
    is_member_file_url TEXT DEFAULT NULL,
    membership_application_file_url TEXT DEFAULT NULL,
    medical_certificate_file_url TEXT DEFAULT NULL,
    photo_consent_social_file_url TEXT DEFAULT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    privacy_accepted_at TEXT DEFAULT NULL,
    social_media_enabled INTEGER NOT NULL DEFAULT 0,
    is_social_media_manager INTEGER NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    opponent TEXT NOT NULL,
    kickoff_at TEXT NOT NULL,
    location TEXT NOT NULL,
    is_home INTEGER NOT NULL DEFAULT 1,
    competition TEXT DEFAULT '',
    home_team_name TEXT DEFAULT '',
    away_team_name TEXT DEFAULT '',
    home_logo_url TEXT DEFAULT '',
    away_logo_url TEXT DEFAULT '',
    result TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    product_info TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    item_condition TEXT DEFAULT '',
    image_url TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_events (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    starts_at TEXT NOT NULL,
    ends_at TEXT DEFAULT '',
    category TEXT DEFAULT 'training',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_event_settings (
    team_id TEXT PRIMARY KEY,
    response_close_hours_before INTEGER NOT NULL DEFAULT 24,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_event_responses (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('accepted', 'declined')),
    updated_at TEXT NOT NULL,
    UNIQUE(event_id, user_id),
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_cashbook_entries (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('in', 'out')),
    amount_cents INTEGER NOT NULL,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    booked_at TEXT NOT NULL,
    receipt_url TEXT DEFAULT NULL,
    original_received INTEGER NOT NULL DEFAULT 0,
    original_received_by TEXT DEFAULT NULL,
    original_received_at TEXT DEFAULT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(original_received_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS pending_player_applications (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    birthday TEXT DEFAULT '',
    address TEXT DEFAULT '',
    parent_name TEXT DEFAULT '',
    parent_phone TEXT DEFAULT '',
    parent_email TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    requested_by TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by TEXT DEFAULT NULL,
    reviewed_at TEXT DEFAULT NULL,
    created_user_id TEXT DEFAULT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(created_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS match_reschedule_requests (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    match_id TEXT DEFAULT NULL,
    match_label TEXT NOT NULL,
    proposed_kickoff_at TEXT NOT NULL,
    reason TEXT NOT NULL,
    coordination_notes TEXT DEFAULT '',
    requested_by TEXT NOT NULL,
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'done')) DEFAULT 'pending',
    handled_by TEXT DEFAULT NULL,
    handled_at TEXT DEFAULT NULL,
    completed_by TEXT DEFAULT NULL,
    completed_at TEXT DEFAULT NULL,
    admin_notification_at TEXT DEFAULT NULL,
    trainer_notification_at TEXT DEFAULT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE SET NULL,
    FOREIGN KEY(requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(handled_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(completed_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS flea_market_listings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    listing_condition TEXT DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0,
    contact_name TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    contact_email TEXT DEFAULT '',
    image_urls TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tournament_offers (
    id TEXT PRIMARY KEY,
    group_id TEXT DEFAULT NULL,
    team_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    starts_at TEXT NOT NULL,
    tournament_plan_url TEXT DEFAULT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    response_status TEXT NOT NULL CHECK(response_status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    responded_by TEXT DEFAULT NULL,
    responded_at TEXT DEFAULT NULL,
    registration_status TEXT NOT NULL CHECK(registration_status IN ('open', 'registered', 'cancelled')) DEFAULT 'open',
    registration_updated_by TEXT DEFAULT NULL,
    registration_updated_at TEXT DEFAULT NULL,
    tournament_reply_status TEXT NOT NULL CHECK(tournament_reply_status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    tournament_reply_updated_by TEXT DEFAULT NULL,
    tournament_reply_updated_at TEXT DEFAULT NULL,
    trainer_notification_at TEXT DEFAULT NULL,
    admin_notification_at TEXT DEFAULT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(responded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(registration_updated_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(tournament_reply_updated_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS social_media_drafts (
    id TEXT PRIMARY KEY,
    draft_type TEXT NOT NULL CHECK(draft_type IN ('feed', 'story')),
    layout TEXT NOT NULL DEFAULT 'matchday',
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    call_to_action TEXT DEFAULT '',
    image_urls TEXT DEFAULT '[]',
    layers_json TEXT DEFAULT '[]',
    is_template INTEGER NOT NULL DEFAULT 0,
    posting_text TEXT DEFAULT '',
    hashtags TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted')),
    admin_notification_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_media_crests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_media_fonts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_media_asset_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_media_assets (
    id TEXT PRIMARY KEY,
    folder_id TEXT DEFAULT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(folder_id) REFERENCES social_media_asset_folders(id) ON DELETE SET NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS social_media_text_snippets (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS key_assignments (
    id TEXT PRIMARY KEY,
    key_type TEXT NOT NULL DEFAULT 'haupttor',
    key_label TEXT NOT NULL,
    trainer_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('not_handed_over', 'handed_over', 'returned')) DEFAULT 'not_handed_over',
    handed_over_by TEXT DEFAULT NULL,
    handed_over_at TEXT DEFAULT NULL,
    returned_by TEXT DEFAULT NULL,
    returned_at TEXT DEFAULT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(trainer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(handed_over_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(returned_by) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS custom_external_links (
    id TEXT PRIMARY KEY,
    menu_name TEXT NOT NULL,
    url TEXT NOT NULL,
    role_visibility TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
  );
`)

const teamColumns = (
  db.prepare('PRAGMA table_info(teams)').all() as { name: string }[]
).map((column) => column.name)

if (!teamColumns.includes('photo_url')) {
  db.prepare('ALTER TABLE teams ADD COLUMN photo_url TEXT DEFAULT NULL').run()
}

if (!teamColumns.includes('fussball_de_team_id')) {
  db.prepare("ALTER TABLE teams ADD COLUMN fussball_de_team_id TEXT DEFAULT ''").run()
}

const userColumns = (
  db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
).map((column) => column.name)

if (!userColumns.includes('avatar_url')) {
  db.prepare('ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL').run()
}

if (!userColumns.includes('member_number')) {
  db.prepare("ALTER TABLE users ADD COLUMN member_number TEXT DEFAULT ''").run()
}

if (!userColumns.includes('birthday')) {
  db.prepare("ALTER TABLE users ADD COLUMN birthday TEXT DEFAULT ''").run()
}

if (!userColumns.includes('address')) {
  db.prepare("ALTER TABLE users ADD COLUMN address TEXT DEFAULT ''").run()
}

if (!userColumns.includes('parent_name')) {
  db.prepare("ALTER TABLE users ADD COLUMN parent_name TEXT DEFAULT ''").run()
}

if (!userColumns.includes('parent_phone')) {
  db.prepare("ALTER TABLE users ADD COLUMN parent_phone TEXT DEFAULT ''").run()
}

if (!userColumns.includes('parent_email')) {
  db.prepare("ALTER TABLE users ADD COLUMN parent_email TEXT DEFAULT ''").run()
}

if (!userColumns.includes('is_member')) {
  db.prepare('ALTER TABLE users ADD COLUMN is_member INTEGER NOT NULL DEFAULT 0').run()
}

if (!userColumns.includes('has_membership_application')) {
  db.prepare(
    'ALTER TABLE users ADD COLUMN has_membership_application INTEGER NOT NULL DEFAULT 0',
  ).run()
}

if (!userColumns.includes('has_medical_certificate')) {
  db.prepare('ALTER TABLE users ADD COLUMN has_medical_certificate INTEGER NOT NULL DEFAULT 0').run()
}

if (!userColumns.includes('has_photo_consent_social')) {
  db.prepare(
    'ALTER TABLE users ADD COLUMN has_photo_consent_social INTEGER NOT NULL DEFAULT 0',
  ).run()
}

if (!userColumns.includes('is_member_file_url')) {
  db.prepare('ALTER TABLE users ADD COLUMN is_member_file_url TEXT DEFAULT NULL').run()
}

if (!userColumns.includes('membership_application_file_url')) {
  db.prepare(
    'ALTER TABLE users ADD COLUMN membership_application_file_url TEXT DEFAULT NULL',
  ).run()
}

if (!userColumns.includes('medical_certificate_file_url')) {
  db.prepare('ALTER TABLE users ADD COLUMN medical_certificate_file_url TEXT DEFAULT NULL').run()
}

if (!userColumns.includes('photo_consent_social_file_url')) {
  db.prepare(
    'ALTER TABLE users ADD COLUMN photo_consent_social_file_url TEXT DEFAULT NULL',
  ).run()
}

if (!userColumns.includes('must_change_password')) {
  db.prepare('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0').run()
}

if (!userColumns.includes('privacy_accepted_at')) {
  db.prepare('ALTER TABLE users ADD COLUMN privacy_accepted_at TEXT DEFAULT NULL').run()
}

if (!userColumns.includes('social_media_enabled')) {
  db.prepare('ALTER TABLE users ADD COLUMN social_media_enabled INTEGER NOT NULL DEFAULT 0').run()
}

const matchColumns = (
  db.prepare('PRAGMA table_info(matches)').all() as { name: string }[]
).map((column) => column.name)

if (!matchColumns.includes('competition')) {
  db.prepare("ALTER TABLE matches ADD COLUMN competition TEXT DEFAULT ''").run()
}

if (!matchColumns.includes('home_team_name')) {
  db.prepare("ALTER TABLE matches ADD COLUMN home_team_name TEXT DEFAULT ''").run()
}

if (!matchColumns.includes('away_team_name')) {
  db.prepare("ALTER TABLE matches ADD COLUMN away_team_name TEXT DEFAULT ''").run()
}

if (!matchColumns.includes('home_logo_url')) {
  db.prepare("ALTER TABLE matches ADD COLUMN home_logo_url TEXT DEFAULT ''").run()
}

if (!matchColumns.includes('away_logo_url')) {
  db.prepare("ALTER TABLE matches ADD COLUMN away_logo_url TEXT DEFAULT ''").run()
}

if (!matchColumns.includes('fussball_de_match_url')) {
  db.prepare("ALTER TABLE matches ADD COLUMN fussball_de_match_url TEXT DEFAULT ''").run()
}

if (!matchColumns.includes('is_manual')) {
  db.prepare('ALTER TABLE matches ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0').run()
}

if (!matchColumns.includes('last_synced_at')) {
  db.prepare('ALTER TABLE matches ADD COLUMN last_synced_at TEXT DEFAULT NULL').run()
}

const inventoryItemColumns = (
  db.prepare('PRAGMA table_info(inventory_items)').all() as { name: string }[]
).map((column) => column.name)

if (!inventoryItemColumns.includes('product_info')) {
  db.prepare("ALTER TABLE inventory_items ADD COLUMN product_info TEXT DEFAULT ''").run()
}

if (!inventoryItemColumns.includes('notes')) {
  db.prepare("ALTER TABLE inventory_items ADD COLUMN notes TEXT DEFAULT ''").run()
}

if (!inventoryItemColumns.includes('item_condition')) {
  db.prepare("ALTER TABLE inventory_items ADD COLUMN item_condition TEXT DEFAULT ''").run()
}

if (!inventoryItemColumns.includes('image_url')) {
  db.prepare('ALTER TABLE inventory_items ADD COLUMN image_url TEXT DEFAULT NULL').run()
}

const teamEventColumns = (
  db.prepare('PRAGMA table_info(team_events)').all() as { name: string }[]
).map((column) => column.name)

if (!teamEventColumns.includes('recurrence_id')) {
  db.prepare("ALTER TABLE team_events ADD COLUMN recurrence_id TEXT DEFAULT ''").run()
}

if (!teamEventColumns.includes('recurrence_pattern')) {
  db.prepare("ALTER TABLE team_events ADD COLUMN recurrence_pattern TEXT DEFAULT ''").run()
}

if (!teamEventColumns.includes('recurrence_ordinal')) {
  db.prepare('ALTER TABLE team_events ADD COLUMN recurrence_ordinal INTEGER NOT NULL DEFAULT 0').run()
}

if (!teamEventColumns.includes('recurrence_total')) {
  db.prepare('ALTER TABLE team_events ADD COLUMN recurrence_total INTEGER NOT NULL DEFAULT 0').run()
}

if (!teamEventColumns.includes('recurrence_edited_individually')) {
  db.prepare('ALTER TABLE team_events ADD COLUMN recurrence_edited_individually INTEGER NOT NULL DEFAULT 0').run()
}

const socialMediaDraftColumns = (
  db.prepare('PRAGMA table_info(social_media_drafts)').all() as { name: string }[]
).map((column) => column.name)

if (!socialMediaDraftColumns.includes('layers_json')) {
  db.prepare("ALTER TABLE social_media_drafts ADD COLUMN layers_json TEXT DEFAULT '[]'").run()
}

if (!socialMediaDraftColumns.includes('is_template')) {
  db.prepare('ALTER TABLE social_media_drafts ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0').run()
}

if (!socialMediaDraftColumns.includes('posting_text')) {
  db.prepare("ALTER TABLE social_media_drafts ADD COLUMN posting_text TEXT DEFAULT ''").run()
}

if (!socialMediaDraftColumns.includes('hashtags')) {
  db.prepare("ALTER TABLE social_media_drafts ADD COLUMN hashtags TEXT DEFAULT '[]'").run()
}

if (!socialMediaDraftColumns.includes('status')) {
  try {
    db.prepare(
      "ALTER TABLE social_media_drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'",
    ).run()
  } catch {
    try {
      db.prepare("ALTER TABLE social_media_drafts ADD COLUMN status TEXT DEFAULT 'draft'").run()
    } catch {
      /* ignore, strict SQLite erlaubt teilweise kein NOT NULL bei ALTER TABLE, Default reicht uns */
    }
  }
}

if (!socialMediaDraftColumns.includes('admin_notification_at')) {
  db.prepare('ALTER TABLE social_media_drafts ADD COLUMN admin_notification_at TEXT DEFAULT NULL').run()
}

const tournamentOfferColumns = (
  db.prepare('PRAGMA table_info(tournament_offers)').all() as { name: string }[]
).map((column) => column.name)

if (!tournamentOfferColumns.includes('group_id')) {
  db.prepare('ALTER TABLE tournament_offers ADD COLUMN group_id TEXT DEFAULT NULL').run()
}

if (!tournamentOfferColumns.includes('registration_status')) {
  db.prepare(
    "ALTER TABLE tournament_offers ADD COLUMN registration_status TEXT NOT NULL DEFAULT 'open'",
  ).run()
}

if (!tournamentOfferColumns.includes('registration_updated_by')) {
  db.prepare('ALTER TABLE tournament_offers ADD COLUMN registration_updated_by TEXT DEFAULT NULL').run()
}

if (!tournamentOfferColumns.includes('registration_updated_at')) {
  db.prepare('ALTER TABLE tournament_offers ADD COLUMN registration_updated_at TEXT DEFAULT NULL').run()
}

if (!tournamentOfferColumns.includes('tournament_reply_status')) {
  db.prepare(
    "ALTER TABLE tournament_offers ADD COLUMN tournament_reply_status TEXT NOT NULL DEFAULT 'pending'",
  ).run()
}

if (!tournamentOfferColumns.includes('tournament_reply_updated_by')) {
  db.prepare(
    'ALTER TABLE tournament_offers ADD COLUMN tournament_reply_updated_by TEXT DEFAULT NULL',
  ).run()
}

if (!tournamentOfferColumns.includes('tournament_reply_updated_at')) {
  db.prepare(
    'ALTER TABLE tournament_offers ADD COLUMN tournament_reply_updated_at TEXT DEFAULT NULL',
  ).run()
}

if (!tournamentOfferColumns.includes('trainer_notification_at')) {
  db.prepare('ALTER TABLE tournament_offers ADD COLUMN trainer_notification_at TEXT DEFAULT NULL').run()
}

if (!tournamentOfferColumns.includes('admin_notification_at')) {
  db.prepare('ALTER TABLE tournament_offers ADD COLUMN admin_notification_at TEXT DEFAULT NULL').run()
}

const matchRescheduleColumns = (
  db.prepare('PRAGMA table_info(match_reschedule_requests)').all() as { name: string }[]
).map((column) => column.name)

if (!matchRescheduleColumns.includes('admin_notification_at')) {
  db.prepare('ALTER TABLE match_reschedule_requests ADD COLUMN admin_notification_at TEXT DEFAULT NULL').run()
}

if (!matchRescheduleColumns.includes('trainer_notification_at')) {
  db.prepare('ALTER TABLE match_reschedule_requests ADD COLUMN trainer_notification_at TEXT DEFAULT NULL').run()
}

const now = () => new Date().toISOString()
const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`

const teamCount = db.prepare('SELECT COUNT(*) AS count FROM teams').get() as { count: number }

if (teamCount.count === 0) {
  const createdAt = now()
  const insertTeam = db.prepare(`
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
  `)
  const insertUser = db.prepare(`
    INSERT INTO users (
      id,
      full_name,
      email,
      password,
      phone,
      role,
      notes,
      avatar_url,
      member_number,
      birthday,
      address,
      parent_name,
      parent_phone,
      parent_email,
      is_member,
      has_membership_application,
      has_medical_certificate,
      has_photo_consent_social,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      {
        id: 'user_board_1',
        fullName: 'Katrin Weber',
        email: 'vorstand@wiking-verein.de',
        password: 'vorstand123',
        phone: '0160 4455667',
        role: 'board',
        notes: 'Vorstand Organisation und Vereinskoordination.',
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
        '',
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
        null,
        '',
        '',
        '',
        '',
        '',
        '',
        0,
        0,
        0,
        0,
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

const boardUserCount = db
  .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'board'")
  .get() as { count: number }

if (boardUserCount.count === 0) {
  db.prepare(`
    INSERT INTO users (
      id,
      full_name,
      email,
      password,
      phone,
      role,
      notes,
      avatar_url,
      member_number,
      birthday,
      address,
      parent_name,
      parent_phone,
      parent_email,
      is_member,
      has_membership_application,
      has_medical_certificate,
      has_photo_consent_social,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'user_board_1',
    'Katrin Weber',
    'vorstand@wiking-verein.de',
    bcrypt.hashSync('vorstand123', 10),
    '0160 4455667',
    'board',
    'Vorstand Organisation und Vereinskoordination.',
    null,
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    0,
    0,
    0,
    now(),
  )
}

const socialSnippetCount = db
  .prepare('SELECT COUNT(*) AS count FROM social_media_text_snippets')
  .get() as { count: number }

if (socialSnippetCount.count === 0) {
  const insertSnippet = db.prepare(`
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
  `)

  const createdAt = now()
  ;[
    {
      label: 'Spieltag',
      content: 'Heute ist Spieltag. Wir freuen uns ueber jede Unterstuetzung am Spielfeldrand.',
      category: 'Spieltag',
    },
    {
      label: 'Ergebnis',
      content:
        'Starke Teamleistung heute. Danke an alle Spielerinnen, Eltern und Fans fuer die Unterstuetzung.',
      category: 'Ergebnis',
    },
    {
      label: 'Training',
      content:
        'Volle Energie im Training. Schritt fuer Schritt arbeiten wir weiter an unserem Spiel.',
      category: 'Training',
    },
    {
      label: 'Hinweis',
      content: 'Weitere Infos folgen ueber unsere Vereinskanaele und direkt im Team.',
      category: 'Allgemein',
    },
  ].forEach((snippet) => {
    insertSnippet.run(
      createId('snippet'),
      snippet.label,
      snippet.content,
      snippet.category,
      'user_admin',
      createdAt,
      createdAt,
    )
  })
}

type TeamRow = {
  id: string
  name: string
  age_group: string
  season: string
  training_day: string
  location: string
  notes: string
  fussball_de_team_id: string
  photo_url: string | null
  created_at: string
}

type UserRow = {
  id: string
  full_name: string
  email: string
  password: string
  phone: string
  role: 'admin' | 'trainer' | 'player' | 'board' | 'social'
  notes: string
  avatar_url: string | null
  member_number: string
  birthday: string
  address: string
  parent_name: string
  parent_phone: string
  parent_email: string
  is_member: number
  has_membership_application: number
  has_medical_certificate: number
  has_photo_consent_social: number
  is_member_file_url: string | null
  membership_application_file_url: string | null
  medical_certificate_file_url: string | null
  photo_consent_social_file_url: string | null
  must_change_password: number
  privacy_accepted_at: string | null
  social_media_enabled: number
  is_social_media_manager?: number
  created_at: string
}

export const getUserRowById = (userId: string) =>
  db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined

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

type MatchRow = {
  id: string
  team_id: string
  opponent: string
  kickoff_at: string
  location: string
  is_home: number
  competition: string
  home_team_name: string
  away_team_name: string
  home_logo_url: string
  away_logo_url: string
  result: string
  created_at: string
}

type InventoryItemRow = {
  id: string
  team_id: string
  category: string
  name: string
  quantity: number
  product_info: string
  notes: string
  item_condition: string
  image_url: string | null
  created_at: string
}

type CashbookEntryRow = {
  id: string
  team_id: string
  entry_type: 'in' | 'out'
  amount_cents: number
  title: string
  notes: string
  booked_at: string
  receipt_url: string | null
  original_received: number
  original_received_by: string | null
  original_received_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

type PendingPlayerApplicationRow = {
  id: string
  team_id: string
  full_name: string
  email: string
  phone: string
  birthday: string
  address: string
  parent_name: string
  parent_phone: string
  parent_email: string
  notes: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_user_id: string | null
}

type MatchRescheduleRequestRow = {
  id: string
  team_id: string
  match_id: string | null
  match_label: string
  proposed_kickoff_at: string
  reason: string
  coordination_notes: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'in_progress' | 'done'
  handled_by: string | null
  handled_at: string | null
  completed_by: string | null
  completed_at: string | null
  admin_notification_at: string | null
  trainer_notification_at: string | null
}

type FleaMarketListingRow = {
  id: string
  title: string
  description: string
  listing_condition: string
  price_cents: number
  contact_name: string
  contact_phone: string
  contact_email: string
  image_urls: string
  created_by: string
  created_at: string
  updated_at: string
}

type TournamentOfferRow = {
  id: string
  group_id: string | null
  team_id: string
  title: string
  description: string
  location: string
  starts_at: string
  tournament_plan_url: string | null
  created_by: string
  created_at: string
  updated_at: string
  response_status: 'pending' | 'accepted' | 'declined'
  responded_by: string | null
  responded_at: string | null
  registration_status: 'open' | 'registered' | 'cancelled'
  registration_updated_by: string | null
  registration_updated_at: string | null
  tournament_reply_status: 'pending' | 'accepted' | 'declined'
  tournament_reply_updated_by: string | null
  tournament_reply_updated_at: string | null
  trainer_notification_at: string | null
  admin_notification_at: string | null
}

type SocialMediaDraftRow = {
  id: string
  draft_type: 'feed' | 'story'
  layout: string
  title: string
  subtitle: string
  caption: string
  call_to_action: string
  image_urls: string
  layers_json: string
  is_template: number
  posting_text?: string
  hashtags?: string
  status?: 'draft' | 'submitted'
  admin_notification_at?: string | null
  created_by: string
  created_at: string
  updated_at: string
}

type SocialMediaTextSnippetRow = {
  id: string
  label: string
  content: string
  category: string
  created_by: string
  created_at: string
  updated_at: string
}

type SocialMediaCrestRow = {
  id: string
  name: string
  image_url: string
  created_by: string
  created_at: string
  updated_at: string
}

type SocialMediaFontRow = {
  id: string
  name: string
  family: string
  file_url: string
  created_by: string
  created_at: string
  updated_at: string
}

type SocialMediaAssetFolderRow = {
  id: string
  name: string
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

type SocialMediaAssetRow = {
  id: string
  folder_id: string | null
  name: string
  image_url: string
  created_by: string
  created_at: string
  updated_at: string
}

export const mapTeam = (row: TeamRow) => ({
  id: row.id,
  name: row.name,
  ageGroup: row.age_group,
  season: row.season,
  trainingDay: row.training_day,
  location: row.location,
  notes: row.notes,
  fussballDeTeamId: row.fussball_de_team_id,
  photoUrl: row.photo_url,
  createdAt: row.created_at,
})

export const getTeamIdsByUserId = (userId: string) =>
  (
    db.prepare('SELECT team_id FROM team_members WHERE user_id = ? ORDER BY created_at ASC').all(userId) as {
      team_id: string
    }[]
  ).map((row) => row.team_id)

export const mapUser = (row: UserRow, includePassword = false) => {
  const mustChangePassword = Boolean(row.must_change_password)
  const privacyAcceptedAt = row.privacy_accepted_at || null
  const hasLegacySocialMarker = Boolean(row.is_social_media_manager)
  let effectiveRole: 'admin' | 'trainer' | 'player' | 'board' | 'social' = row.role
  if (row.role !== 'social') {
    if (hasLegacySocialMarker) {
      effectiveRole = 'social'
    } else if (!usersRoleConstraintSupportsSocial && row.role === LEGACY_SOCIAL_ROLE_STORAGE) {
      effectiveRole = row.role
    }
  }
  const base = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: effectiveRole,
    teamIds: getTeamIdsByUserId(row.id),
    notes: row.notes,
    avatarUrl: row.avatar_url,
    memberNumber: row.member_number,
    birthday: row.birthday,
    address: row.address,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    parentEmail: row.parent_email,
    isMember: Boolean(row.is_member),
    hasMembershipApplication: Boolean(row.has_membership_application),
    hasMedicalCertificate: Boolean(row.has_medical_certificate),
    hasPhotoConsentSocial: Boolean(row.has_photo_consent_social),
    isMemberFileUrl: row.is_member_file_url || null,
    membershipApplicationFileUrl: row.membership_application_file_url || null,
    medicalCertificateFileUrl: row.medical_certificate_file_url || null,
    photoConsentSocialFileUrl: row.photo_consent_social_file_url || null,
    mustChangePassword,
    privacyAcceptedAt,
    requiresOnboarding: effectiveRole === 'player' && (mustChangePassword || !privacyAcceptedAt),
    socialMediaEnabled: Boolean(row.social_media_enabled),
    isSocialMediaManager: Boolean(row.is_social_media_manager),
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
  const row = getUserRowById(userId)
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

export const userHasTeamRole = (
  userId: string,
  teamId: string,
  membershipRole: 'trainer' | 'player' | 'admin',
) => {
  const row = db
    .prepare(
      'SELECT id FROM team_members WHERE user_id = ? AND team_id = ? AND membership_role = ? LIMIT 1',
    )
    .get(userId, teamId, membershipRole) as { id: string } | undefined

  return Boolean(row)
}

export const isAdminOrBoard = (userId: string) => {
  const row = getUserRowById(userId)
  if (!row) return false
  if (row.role === 'admin') return true
  if (row.role === 'board') return !Boolean(row.is_social_media_manager)
  if (row.role === 'social') return false
  return false
}

export const canManageSocialMedia = (userId: string) => {
  const row = getUserRowById(userId)
  if (!row) {
    return false
  }

  return (
    row.role === 'admin' ||
    row.role === 'board' ||
    Boolean(row.is_social_media_manager)
  )
}

export const canUseSocialMedia = (userId: string) => {
  const row = getUserRowById(userId)
  if (!row) {
    return false
  }

  if (canManageSocialMedia(userId)) {
    return true
  }

  if (row.role === 'social') {
    return true
  }

  return Boolean(row.social_media_enabled)
}

const getVisibleConversationRows = (userId?: string | null) => {
  const rows = db.prepare(
    'SELECT * FROM conversations ORDER BY updated_at DESC, created_at DESC',
  ).all() as ConversationRow[]

  if (!userId) {
    return rows
  }

  const currentUser = getUserRowById(userId)
  if (!currentUser) {
    return []
  }

  if (currentUser.role === 'admin') {
    return rows
  }

  const userTeamIds = getTeamIdsByUserId(userId)

  return rows.filter((row) => {
    if (row.type === 'team') {
      if (currentUser.role === 'board') {
        return true
      }

      return Boolean(row.team_id && userTeamIds.includes(row.team_id))
    }

    return getParticipantsForConversation(row).includes(userId)
  })
}

export const canManagePlayerFromMenu = (actorId: string) => isAdminOrBoard(actorId)

export const canEditPlayer = (actorId: string, playerId: string) => {
  if (isAdminOrBoard(actorId)) {
    return true
  }

  const actor = getUserRowById(actorId)
  const player = getUserRowById(playerId)

  if (!actor || !player || actor.role !== 'trainer' || player.role !== 'player') {
    return false
  }

  const actorTeamIds = getTeamIdsByUserId(actorId)
  const playerTeamIds = getTeamIdsByUserId(playerId)

  return actorTeamIds.some((teamId) => playerTeamIds.includes(teamId))
}

export const getConversations = (userId?: string | null) =>
  getVisibleConversationRows(userId).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    teamId: row.team_id ?? undefined,
    participantIds: getParticipantsForConversation(row),
    updatedAt: row.updated_at,
  }))

export const getMessages = (userId?: string | null) => {
  const visibleConversationIds = new Set(getVisibleConversationRows(userId).map((row) => row.id))

  return (
    db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as MessageRow[]
  )
    .filter((row) => visibleConversationIds.has(row.conversation_id))
    .map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  }))
}

export const getMatches = () =>
  (
    db.prepare('SELECT * FROM matches ORDER BY kickoff_at ASC, created_at ASC').all() as MatchRow[]
  ).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    opponent: row.opponent,
    kickoffAt: row.kickoff_at,
    location: row.location,
    isHome: Boolean(row.is_home),
    competition: row.competition || '',
    homeTeamName: row.home_team_name || '',
    awayTeamName: row.away_team_name || '',
    homeLogoUrl: row.home_logo_url || null,
    awayLogoUrl: row.away_logo_url || null,
    result: row.result || null,
    createdAt: row.created_at,
  }))

export const getInventoryItems = () =>
  (
    db
      .prepare(
        'SELECT * FROM inventory_items ORDER BY category COLLATE NOCASE ASC, name COLLATE NOCASE ASC, created_at DESC',
      )
      .all() as InventoryItemRow[]
  ).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    category: row.category,
    name: row.name,
    quantity: Number(row.quantity) || 0,
    productInfo: row.product_info || '',
    notes: row.notes || '',
    condition: row.item_condition || '',
    imageUrl: row.image_url || null,
    createdAt: row.created_at,
  }))

export const getCashbookEntries = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM team_cashbook_entries ORDER BY booked_at DESC, created_at DESC',
  ).all() as CashbookEntryRow[]

  if (actor.role === 'admin' || actor.role === 'board') {
    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      entryType: row.entry_type,
      amountCents: Number(row.amount_cents) || 0,
      title: row.title,
      notes: row.notes || '',
      bookedAt: row.booked_at,
      receiptUrl: row.receipt_url || null,
      originalReceived: Boolean(row.original_received),
      originalReceivedBy: row.original_received_by || null,
      originalReceivedAt: row.original_received_at || null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  if (actor.role !== 'trainer') {
    return []
  }

  const actorTeamIds = new Set(getTeamIdsByUserId(userId))

  return rows
    .filter((row) => actorTeamIds.has(row.team_id))
    .map((row) => ({
      id: row.id,
      teamId: row.team_id,
      entryType: row.entry_type,
      amountCents: Number(row.amount_cents) || 0,
      title: row.title,
      notes: row.notes || '',
      bookedAt: row.booked_at,
      receiptUrl: row.receipt_url || null,
      originalReceived: Boolean(row.original_received),
      originalReceivedBy: row.original_received_by || null,
      originalReceivedAt: row.original_received_at || null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
}

export const getPendingPlayerApplications = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM pending_player_applications ORDER BY requested_at DESC',
  ).all() as PendingPlayerApplicationRow[]

  if (actor.role === 'admin' || actor.role === 'board') {
    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      fullName: row.full_name,
      email: row.email || '',
      phone: row.phone || '',
      birthday: row.birthday || '',
      address: row.address || '',
      parentName: row.parent_name || '',
      parentPhone: row.parent_phone || '',
      parentEmail: row.parent_email || '',
      notes: row.notes || '',
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      status: row.status,
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,
      createdUserId: row.created_user_id || null,
    }))
  }

  return []
}

export const getMatchRescheduleRequests = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor) {
    return []
  }

  if (actor.role === 'admin' || actor.role === 'board') {
    const rows = db.prepare(
      'SELECT * FROM match_reschedule_requests ORDER BY requested_at DESC',
    ).all() as MatchRescheduleRequestRow[]

    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      matchId: row.match_id || null,
      matchLabel: row.match_label,
      proposedKickoffAt: row.proposed_kickoff_at,
      reason: row.reason,
      coordinationNotes: row.coordination_notes || '',
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      updatedAt:
        row.completed_at || row.handled_at || row.trainer_notification_at || row.admin_notification_at || row.requested_at,
      status: row.status,
      handledBy: row.handled_by || null,
      handledAt: row.handled_at || null,
      completedBy: row.completed_by || null,
      completedAt: row.completed_at || null,
      adminNotificationAt: row.admin_notification_at || null,
      trainerNotificationAt: row.trainer_notification_at || null,
    }))
  }

  if (actor.role === 'trainer') {
    const rows = db.prepare(
      `SELECT requests.*
       FROM match_reschedule_requests requests
       JOIN team_members members
         ON members.team_id = requests.team_id
        AND members.user_id = ?
        AND members.membership_role = 'trainer'
       ORDER BY requests.requested_at DESC`,
    ).all(userId) as MatchRescheduleRequestRow[]

    return rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      matchId: row.match_id || null,
      matchLabel: row.match_label,
      proposedKickoffAt: row.proposed_kickoff_at,
      reason: row.reason,
      coordinationNotes: row.coordination_notes || '',
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      updatedAt:
        row.completed_at || row.handled_at || row.trainer_notification_at || row.admin_notification_at || row.requested_at,
      status: row.status,
      handledBy: row.handled_by || null,
      handledAt: row.handled_at || null,
      completedBy: row.completed_by || null,
      completedAt: row.completed_at || null,
      adminNotificationAt: row.admin_notification_at || null,
      trainerNotificationAt: row.trainer_notification_at || null,
    }))
  }

  return []
}

type KeyAssignmentRow = {
  id: string;
  key_type: string;
  key_label: string;
  trainer_id: string;
  status: "not_handed_over" | "handed_over" | "returned";
  handed_over_by: string | null;
  handed_over_at: string | null;
  returned_by: string | null;
  returned_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const getKeyAssignments = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor) {
    return []
  }

  let rows: KeyAssignmentRow[] = []

  if (actor.role === 'admin' || actor.role === 'board') {
    rows = db.prepare(
      'SELECT * FROM key_assignments ORDER BY updated_at DESC, created_at DESC',
    ).all() as KeyAssignmentRow[]
  } else if (actor.role === 'trainer') {
    rows = db.prepare(
      'SELECT * FROM key_assignments WHERE trainer_id = ? ORDER BY updated_at DESC, created_at DESC',
    ).all(userId) as KeyAssignmentRow[]
  }

  return rows.map((row) => ({
    id: row.id,
    keyType: row.key_type,
    keyLabel: row.key_label,
    trainerId: row.trainer_id,
    status: row.status,
    handedOverBy: row.handed_over_by,
    handedOverAt: row.handed_over_at,
    returnedBy: row.returned_by,
    returnedAt: row.returned_at,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const getFleaMarketListings = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM flea_market_listings ORDER BY updated_at DESC, created_at DESC',
  ).all() as FleaMarketListingRow[]

  return rows.map((row) => {
    let imageUrls: string[] = []
    try {
      const parsed = JSON.parse(row.image_urls || '[]') as unknown
      if (Array.isArray(parsed)) {
        imageUrls = parsed.filter((value): value is string => typeof value === 'string')
      }
    } catch {
      imageUrls = []
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      condition: row.listing_condition || '',
      priceCents: Number(row.price_cents) || 0,
      contactName: row.contact_name || '',
      contactPhone: row.contact_phone || '',
      contactEmail: row.contact_email || '',
      imageUrls,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  })
}

export const getTournamentOffers = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor) {
    return []
  }

  const visibleTeamIds =
    actor.role === 'admin' || actor.role === 'board' ? null : getTeamIdsByUserId(userId)

  if (actor.role === 'player') {
    return []
  }

  const rows =
    visibleTeamIds === null
      ? (db
          .prepare('SELECT * FROM tournament_offers ORDER BY starts_at ASC, created_at DESC')
          .all() as TournamentOfferRow[])
      : visibleTeamIds.length
        ? (db
            .prepare(
              `SELECT * FROM tournament_offers
               WHERE team_id IN (${visibleTeamIds.map(() => '?').join(', ')})
               ORDER BY starts_at ASC, created_at DESC`,
            )
            .all(...visibleTeamIds) as TournamentOfferRow[])
        : []

  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id || row.id,
    teamId: row.team_id,
    title: row.title,
    description: row.description || '',
    location: row.location || '',
    startsAt: row.starts_at,
    tournamentPlanUrl: row.tournament_plan_url || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    responseStatus: row.response_status,
    respondedBy: row.responded_by || null,
    respondedAt: row.responded_at || null,
    registrationStatus: row.registration_status || 'open',
    registrationUpdatedBy: row.registration_updated_by || null,
    registrationUpdatedAt: row.registration_updated_at || null,
    tournamentReplyStatus: row.tournament_reply_status || 'pending',
    tournamentReplyUpdatedBy: row.tournament_reply_updated_by || null,
    tournamentReplyUpdatedAt: row.tournament_reply_updated_at || null,
    trainerNotificationAt: row.trainer_notification_at || null,
    adminNotificationAt: row.admin_notification_at || null,
  }))
}

export const getSocialMediaDrafts = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor || !canUseSocialMedia(userId)) {
    return []
  }

  const rows =
    actor.role === 'admin'
      ? (db
          .prepare('SELECT * FROM social_media_drafts ORDER BY updated_at DESC, created_at DESC')
          .all() as SocialMediaDraftRow[])
      : (db
          .prepare(
            'SELECT * FROM social_media_drafts WHERE is_template = 1 OR created_by = ? ORDER BY updated_at DESC, created_at DESC',
          )
          .all(userId) as SocialMediaDraftRow[])

  return rows.map((row) => {
    let imageUrls: string[] = []
    try {
      const parsed = JSON.parse(row.image_urls || '[]') as unknown
      if (Array.isArray(parsed)) {
        imageUrls = parsed.filter((value): value is string => typeof value === 'string')
      }
    } catch {
      imageUrls = []
    }

    let layers: Array<{
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
    }> = []
    try {
      const parsed = JSON.parse(row.layers_json || '[]') as unknown
      if (Array.isArray(parsed)) {
        layers = parsed.filter(
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
            lockPosition?: boolean
            lockSize?: boolean
            fontFamily?: string
            fontSize?: number
            textColor?: string
            textAlign?: string
            textEffect?: string
          } =>
            Boolean(
              entry &&
                typeof entry === 'object' &&
                typeof (entry as { id?: unknown }).id === 'string' &&
                typeof (entry as { kind?: unknown }).kind === 'string' &&
                typeof (entry as { label?: unknown }).label === 'string' &&
                typeof (entry as { position?: unknown }).position === 'string' &&
                typeof (entry as { style?: unknown }).style === 'string' &&
                typeof (entry as { enabled?: unknown }).enabled === 'boolean' &&
                ((entry as { centerX?: unknown }).centerX === undefined ||
                  typeof (entry as { centerX?: unknown }).centerX === 'number') &&
                ((entry as { centerY?: unknown }).centerY === undefined ||
                  typeof (entry as { centerY?: unknown }).centerY === 'number') &&
                ((entry as { widthPercent?: unknown }).widthPercent === undefined ||
                  typeof (entry as { widthPercent?: unknown }).widthPercent === 'number') &&
                ((entry as { heightPercent?: unknown }).heightPercent === undefined ||
                  typeof (entry as { heightPercent?: unknown }).heightPercent === 'number') &&
                ((entry as { lockPosition?: unknown }).lockPosition === undefined ||
                  typeof (entry as { lockPosition?: unknown }).lockPosition === 'boolean') &&
                ((entry as { lockSize?: unknown }).lockSize === undefined ||
                  typeof (entry as { lockSize?: unknown }).lockSize === 'boolean') &&
                ((entry as { fontFamily?: unknown }).fontFamily === undefined ||
                  typeof (entry as { fontFamily?: unknown }).fontFamily === 'string') &&
                ((entry as { fontSize?: unknown }).fontSize === undefined ||
                  typeof (entry as { fontSize?: unknown }).fontSize === 'number') &&
                ((entry as { textColor?: unknown }).textColor === undefined ||
                  typeof (entry as { textColor?: unknown }).textColor === 'string') &&
                ((entry as { textAlign?: unknown }).textAlign === undefined ||
                  typeof (entry as { textAlign?: unknown }).textAlign === 'string') &&
                ((entry as { textEffect?: unknown }).textEffect === undefined ||
                  typeof (entry as { textEffect?: unknown }).textEffect === 'string'),
            ),
        )
      }
    } catch {
      layers = []
    }

    return {
      id: row.id,
      draftType: row.draft_type,
      layout: row.layout,
      title: row.title,
      subtitle: row.subtitle || '',
      caption: row.caption || '',
      callToAction: row.call_to_action || '',
      imageUrls,
      layers,
      isTemplate: Boolean(row.is_template),
      postingText: row.posting_text || '',
      hashtags: (() => {
        try {
          const parsed = JSON.parse(row.hashtags || '[]')
          if (!Array.isArray(parsed)) return []
          return parsed
            .filter((entry): entry is string => typeof entry === 'string')
            .slice(0, 10)
        } catch {
          return []
        }
      })(),
      status: (row.status === 'submitted' ? 'submitted' : 'draft'),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      adminNotificationAt: row.admin_notification_at ?? null,
    }
  })
}

export const getSocialMediaTextSnippets = (userId?: string | null) => {
  if (!userId) {
    return []
  }

  const actor = getUserRowById(userId)
  if (!actor || !canUseSocialMedia(userId)) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM social_media_text_snippets ORDER BY category COLLATE NOCASE ASC, label COLLATE NOCASE ASC',
  ).all() as SocialMediaTextSnippetRow[]

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    content: row.content,
    category: row.category || '',
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const getSocialMediaCrests = (userId?: string | null) => {
  if (!userId || !canUseSocialMedia(userId)) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM social_media_crests ORDER BY updated_at DESC, created_at DESC',
  ).all() as SocialMediaCrestRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const getSocialMediaFonts = (userId?: string | null) => {
  if (!userId || !canUseSocialMedia(userId)) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM social_media_fonts ORDER BY updated_at DESC, created_at DESC',
  ).all() as SocialMediaFontRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    family: row.family,
    fileUrl: row.file_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const getSocialMediaAssetFolders = (userId?: string | null) => {
  if (!userId || !canUseSocialMedia(userId)) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM social_media_asset_folders ORDER BY sort_order ASC, name COLLATE NOCASE ASC, created_at DESC',
  ).all() as SocialMediaAssetFolderRow[]

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const createSocialMediaAssetFolder = (input: { actorId: string; name: string; sortOrder?: number | null }) => {
  if (!isAdminOrBoard(input.actorId)) throw new Error('Zugriff verweigert.')
  const name = input.name.trim()
  if (!name) throw new Error('Ordnername fehlt.')
  const id = createId('smaf')
  const timestamp = now()
  db.prepare(
    'INSERT INTO social_media_asset_folders (id, name, sort_order, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name, input.sortOrder ?? 0, input.actorId, timestamp, timestamp)
  return id
}

export const deleteSocialMediaAssetFolder = (input: { actorId: string; folderId: string }) => {
  if (!isAdminOrBoard(input.actorId)) throw new Error('Zugriff verweigert.')
  const folder = db
    .prepare('SELECT id FROM social_media_asset_folders WHERE id = ?')
    .get(input.folderId)
  if (!folder) return
  db.prepare('DELETE FROM social_media_asset_folders WHERE id = ?').run(input.folderId)
}

export const getSocialMediaAssets = (userId?: string | null) => {
  if (!userId || !canUseSocialMedia(userId)) {
    return []
  }

  const rows = db.prepare(
    'SELECT * FROM social_media_assets ORDER BY updated_at DESC, created_at DESC',
  ).all() as SocialMediaAssetRow[]

  return rows.map((row) => ({
    id: row.id,
    folderId: row.folder_id,
    name: row.name,
    imageUrl: row.image_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const createSocialMediaAsset = (input: {
  actorId: string
  folderId?: string | null
  name: string
  imageUrl: string
}) => {
  if (!canUseSocialMedia(input.actorId)) throw new Error('Zugriff verweigert.')
  const name = input.name.trim() || 'Asset'
  const id = createId('sma')
  const timestamp = now()
  db.prepare(
    'INSERT INTO social_media_assets (id, folder_id, name, image_url, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.folderId ?? null, name, input.imageUrl, input.actorId, timestamp, timestamp)
  return id
}

export const deleteSocialMediaAsset = (input: { actorId: string; assetId: string }) => {
  if (!canUseSocialMedia(input.actorId)) throw new Error('Zugriff verweigert.')
  const row = db
    .prepare('SELECT * FROM social_media_assets WHERE id = ?')
    .get(input.assetId) as SocialMediaAssetRow | undefined
  if (!row) return
  const canManage = isAdminOrBoard(input.actorId)
  if (!canManage && row.created_by !== input.actorId) throw new Error('Zugriff verweigert.')
  if (row.image_url.startsWith('/uploads/social-media/')) {
    const fullPath = path.join(DATA_DIR, row.image_url)
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
  }
  db.prepare('DELETE FROM social_media_assets WHERE id = ?').run(input.assetId)
}

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

const defaultSocialMediaLayouts = [
  { value: 'matchday', label: 'Spieltag', enabled: true },
  { value: 'result', label: 'Ergebnis', enabled: true },
  { value: 'training', label: 'Training', enabled: true },
  { value: 'announcement', label: 'Ankuendigung', enabled: true },
]

const getSocialMediaLayouts = () => {
  const rawValue = getSetting('social_media_layouts')
  if (!rawValue) {
    return defaultSocialMediaLayouts
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (Array.isArray(parsed)) {
      const mapped = parsed.filter(
        (
          entry,
        ): entry is { value: string; label: string; enabled: boolean } =>
          Boolean(
            entry &&
              typeof entry === 'object' &&
              typeof (entry as { value?: unknown }).value === 'string' &&
              typeof (entry as { label?: unknown }).label === 'string' &&
              typeof (entry as { enabled?: unknown }).enabled === 'boolean',
          ),
      )

      if (mapped.length) {
        return defaultSocialMediaLayouts.map((layout) => {
          const override = mapped.find((entry) => entry.value === layout.value)
          return override ? override : layout
        })
      }
    }
  } catch {
    return defaultSocialMediaLayouts
  }

  return defaultSocialMediaLayouts
}

type UserRole = 'admin' | 'trainer' | 'player' | 'board' | 'social'

const parseRoleVisibility = (raw: unknown): UserRole[] => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (entry): entry is UserRole =>
            entry === 'admin' ||
            entry === 'trainer' ||
            entry === 'player' ||
            entry === 'board' ||
            entry === 'social',
        )
      }
    } catch {
      // ignore parse errors and fall back to empty.
    }
  }

  return []
}

type CustomExternalLinkRow = {
  id: string
  menu_name: string
  url: string
  role_visibility: string
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

const mapCustomExternalLink = (row: CustomExternalLinkRow) => ({
  id: row.id,
  menuName: row.menu_name,
  url: row.url,
  roleVisibility: parseRoleVisibility(row.role_visibility),
  sortOrder: row.sort_order,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const getCustomExternalLinks = () => {
  const rows = db
    .prepare('SELECT * FROM custom_external_links ORDER BY sort_order ASC, created_at DESC')
    .all() as CustomExternalLinkRow[]

  return rows.map(mapCustomExternalLink)
}

export const getCustomExternalLinkById = (linkId: string) => {
  const row = db
    .prepare('SELECT * FROM custom_external_links WHERE id = ?')
    .get(linkId) as CustomExternalLinkRow | undefined

  return row ? mapCustomExternalLink(row) : null
}

export const createCustomExternalLink = (input: {
  createdBy: string
  menuName: string
  url: string
  roleVisibility: UserRole[]
  sortOrder: number
}) => {
  const id = createId()
  const timestamp = now()

  db.prepare(
    `
    INSERT INTO custom_external_links
      (id, menu_name, url, role_visibility, sort_order, created_by, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    input.menuName,
    input.url,
    JSON.stringify(input.roleVisibility),
    input.sortOrder,
    input.createdBy,
    timestamp,
    timestamp,
  )

  return getCustomExternalLinkById(id)!
}

export const updateCustomExternalLink = (
  linkId: string,
  input: {
    menuName?: string
    url?: string
    roleVisibility?: UserRole[]
    sortOrder?: number
  },
) => {
  const current = getCustomExternalLinkById(linkId)
  if (!current) return null

  const nextMenuName = input.menuName ?? current.menuName
  const nextUrl = input.url ?? current.url
  const nextRoleVisibility = input.roleVisibility ?? current.roleVisibility
  const nextSortOrder = input.sortOrder ?? current.sortOrder

  db.prepare(
    `
    UPDATE custom_external_links
    SET menu_name = ?, url = ?, role_visibility = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `,
  ).run(
    nextMenuName,
    nextUrl,
    JSON.stringify(nextRoleVisibility),
    nextSortOrder,
    now(),
    linkId,
  )

  return getCustomExternalLinkById(linkId)
}

export const deleteCustomExternalLink = (linkId: string) => {
  db.prepare('DELETE FROM custom_external_links WHERE id = ?').run(linkId)
}

export const getSettings = () => ({
  clubName: getSetting('club_name') ?? 'SG Wiking Offenbach',
  logoUrl: getSetting('team_logo_url'),
  socialMediaLayouts: getSocialMediaLayouts(),
})

export const getBootstrapData = (userId?: string | null) => ({
  teams: getTeams(),
  users: getUsers(),
  matches: getMatches(),
  inventoryItems: getInventoryItems(),
  cashbookEntries: getCashbookEntries(userId),
  pendingPlayerApplications: getPendingPlayerApplications(userId),
  matchRescheduleRequests: getMatchRescheduleRequests(userId),
  keyAssignments: getKeyAssignments(userId),
  fleaMarketListings: getFleaMarketListings(userId),
  tournamentOffers: getTournamentOffers(userId),
  socialMediaDrafts: getSocialMediaDrafts(userId),
  socialMediaCrests: getSocialMediaCrests(userId),
  socialMediaFonts: getSocialMediaFonts(userId),
  socialMediaAssetFolders: getSocialMediaAssetFolders(userId),
  socialMediaAssets: getSocialMediaAssets(userId),
  socialMediaTextSnippets: getSocialMediaTextSnippets(userId),
  conversations: getConversations(userId),
  messages: getMessages(userId),
  customExternalLinks: getCustomExternalLinks(),
  settings: getSettings(),
  currentUser: userId ? getUserById(userId) : null,
})

export default db
export { createId, DATA_DIR, now }
