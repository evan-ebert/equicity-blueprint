-- Equicity Blueprint schema. Answers and uploads are private: never in Webflow CMS.

CREATE TABLE IF NOT EXISTS clients (
  slug TEXT PRIMARY KEY,
  passcode_hash TEXT,
  passcode_salt TEXT,
  status TEXT NOT NULL DEFAULT 'not-started', -- not-started | in-progress | submitted | archived
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  first_opened_at TEXT,
  last_activity_at TEXT,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS answers (
  slug TEXT NOT NULL,
  question_id TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON: { v: <value>, exit?: 'not-sure' | 'talk' }
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, question_id)
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  question_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS uploads_by_slug ON uploads (slug, question_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  type TEXT NOT NULL, -- opened | chapter-complete | submitted | login-failed
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_by_slug ON events (slug, created_at);

CREATE TABLE IF NOT EXISTS attempts (
  key TEXT PRIMARY KEY, -- e.g. "client:hart-to-heart:<ip>" or "admin:<ip>"
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL -- unix seconds
);
