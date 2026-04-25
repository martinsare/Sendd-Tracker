-- Senedd Tracker MVP (SQLite schema)
-- This schema is applied automatically on backend startup in `backend/src/db.ts`.

CREATE TABLE IF NOT EXISTS http_cache (
  cache_key TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  content_type TEXT,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_http_cache_expires_at ON http_cache(expires_at);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  party TEXT,
  area_name TEXT,
  area_type TEXT,
  profile_url TEXT,
  image_url TEXT,
  senedd_uid INTEGER,
  updated_at INTEGER NOT NULL,
  last_updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS plenary_transcripts (
  meeting_id INTEGER PRIMARY KEY,
  meeting_date TEXT,
  transcript_url TEXT NOT NULL,
  fetched_at INTEGER,
  parsed_at INTEGER,
  parse_version INTEGER NOT NULL,
  last_updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS spoken_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id INTEGER NOT NULL,
  contribution_id INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  context_en TEXT,
  context_cy TEXT,
  snippet_en TEXT NOT NULL,
  snippet_cy TEXT,
  full_text_en TEXT,
  full_text_cy TEXT,
  source_url TEXT NOT NULL,
  confidence TEXT NOT NULL,
  extracted_at INTEGER NOT NULL,
  last_updated_at INTEGER,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE(meeting_id, contribution_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_spoken_contributions_member_id ON spoken_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_spoken_contributions_occurred_at ON spoken_contributions(occurred_at);
