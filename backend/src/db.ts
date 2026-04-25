import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./env.js";

export type Db = Database.Database;

export function openDb(): Db {
  mkdirSync(dirname(env.dbPath), { recursive: true });
  const db = new Database(env.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Db) {
  db.exec(`
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
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plenary_transcripts (
      meeting_id INTEGER PRIMARY KEY,
      meeting_date TEXT,
      transcript_url TEXT NOT NULL,
      fetched_at INTEGER,
      parsed_at INTEGER,
      parse_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plenary_votes (
      meeting_id INTEGER PRIMARY KEY,
      meeting_date TEXT,
      votes_url TEXT NOT NULL,
      fetched_at INTEGER,
      parsed_at INTEGER,
      parse_version INTEGER NOT NULL
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
      source_url TEXT NOT NULL,
      confidence TEXT NOT NULL,
      extracted_at INTEGER NOT NULL,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(meeting_id, contribution_id, member_id)
    );

    CREATE INDEX IF NOT EXISTS idx_spoken_contributions_member_id ON spoken_contributions(member_id);
    CREATE INDEX IF NOT EXISTS idx_spoken_contributions_occurred_at ON spoken_contributions(occurred_at);

    CREATE TABLE IF NOT EXISTS member_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      contribution_id INTEGER NOT NULL,
      vote_row_id INTEGER,
      member_id TEXT NOT NULL,
      member_uid INTEGER,
      member_name TEXT,
      occurred_at TEXT NOT NULL,
      vote_name_en TEXT,
      vote_name_cy TEXT,
      vote_result_en TEXT,
      vote_result_cy TEXT,
      totals_for INTEGER,
      totals_against INTEGER,
      totals_abstain INTEGER,
      member_result TEXT NOT NULL,
      source_url TEXT NOT NULL,
      confidence TEXT NOT NULL,
      extracted_at INTEGER NOT NULL,
      last_updated_at INTEGER,
      FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE,
      UNIQUE(meeting_id, contribution_id, member_id)
    );

    CREATE INDEX IF NOT EXISTS idx_member_votes_member_id ON member_votes(member_id);
    CREATE INDEX IF NOT EXISTS idx_member_votes_occurred_at ON member_votes(occurred_at);
  `);

  // Lightweight additive migrations for long-lived MVP usage (no destructive changes).
  ensureColumn(db, "members", "last_updated_at", "INTEGER");
  ensureColumn(db, "members", "senedd_uid", "INTEGER");
  ensureColumn(db, "plenary_transcripts", "last_updated_at", "INTEGER");
  ensureColumn(db, "plenary_votes", "last_updated_at", "INTEGER");
  ensureColumn(db, "spoken_contributions", "last_updated_at", "INTEGER");
  ensureColumn(db, "spoken_contributions", "full_text_en", "TEXT");
  ensureColumn(db, "spoken_contributions", "full_text_cy", "TEXT");
}

function ensureColumn(db: Db, table: string, column: string, typeSql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
}
