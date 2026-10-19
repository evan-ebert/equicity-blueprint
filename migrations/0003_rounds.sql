-- Review rounds: a client's structured feedback on a design, one round at a time. Keyed by client slug like everything else.

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | open | submitted | reopened | closed
  config TEXT NOT NULL, -- JSON, validated by src/lib/rounds.ts
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  opened_at TEXT,
  submitted_at TEXT,
  UNIQUE (slug, number)
);

CREATE TABLE IF NOT EXISTS round_images (
  round_id INTEGER NOT NULL,
  name TEXT NOT NULL, -- the file name the config uses, e.g. r1-hero-a.jpg
  r2_key TEXT NOT NULL,
  display_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, name)
);

CREATE TABLE IF NOT EXISTS round_answers (
  round_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON: { v: <value> }
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, item_id)
);

-- A copy of every answer each time the client sends the round. Never changes.
CREATE TABLE IF NOT EXISTS round_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS round_submissions_by_round ON round_submissions (round_id, id);

-- events gains the types round-opened, round-screen-viewed, round-submitted, round-reopened (no schema change).
