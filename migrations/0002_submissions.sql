-- A copy of every answer each time the client taps Send. Answers stay editable; these never change.
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  answers TEXT NOT NULL, -- JSON: the answers table for this client at the moment they sent
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS submissions_by_slug ON submissions (slug, id);
