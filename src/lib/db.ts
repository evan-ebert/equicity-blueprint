/** D1 access for Equicity Blueprint. Keep every query here. */

export type ClientRow = {
  slug: string;
  passcode_hash: string | null;
  passcode_salt: string | null;
  status: 'not-started' | 'in-progress' | 'submitted' | 'archived';
  created_at: string;
  first_opened_at: string | null;
  last_activity_at: string | null;
  submitted_at: string | null;
};

export type AnswerValue = { v: unknown; exit?: 'not-sure' | 'talk' };
export type Answers = Record<string, AnswerValue>;

export type UploadRow = {
  id: string;
  slug: string;
  question_id: string;
  r2_key: string;
  file_name: string;
  content_type: string;
  size: number;
  uploaded_at: string;
};

export type PublicUpload = Pick<UploadRow, 'id' | 'question_id' | 'file_name' | 'content_type' | 'size' | 'uploaded_at'>;

export async function getClientRow(db: D1Database, slug: string): Promise<ClientRow | null> {
  return db.prepare('SELECT * FROM clients WHERE slug = ?').bind(slug).first<ClientRow>();
}

export async function listClientRows(db: D1Database): Promise<ClientRow[]> {
  const r = await db.prepare('SELECT * FROM clients').all<ClientRow>();
  return r.results ?? [];
}

export async function setPasscode(db: D1Database, slug: string, hash: string, salt: string) {
  await db
    .prepare(
      `INSERT INTO clients (slug, passcode_hash, passcode_salt) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET passcode_hash = excluded.passcode_hash, passcode_salt = excluded.passcode_salt`,
    )
    .bind(slug, hash, salt)
    .run();
}

export async function markOpened(db: D1Database, slug: string) {
  await db
    .prepare(
      `UPDATE clients SET first_opened_at = COALESCE(first_opened_at, datetime('now')), last_activity_at = datetime('now'),
       status = CASE WHEN status = 'not-started' THEN 'in-progress' ELSE status END WHERE slug = ?`,
    )
    .bind(slug)
    .run();
}

export async function getAnswers(db: D1Database, slug: string): Promise<Answers> {
  const r = await db.prepare('SELECT question_id, value FROM answers WHERE slug = ?').bind(slug).all<{ question_id: string; value: string }>();
  const out: Answers = {};
  for (const row of r.results ?? []) {
    try {
      out[row.question_id] = JSON.parse(row.value) as AnswerValue;
    } catch {
      /* ignore a corrupt row rather than break the client's session */
    }
  }
  return out;
}

export async function getAnswersUpdatedAt(db: D1Database, slug: string): Promise<Record<string, string>> {
  const r = await db.prepare('SELECT question_id, updated_at FROM answers WHERE slug = ?').bind(slug).all<{ question_id: string; updated_at: string }>();
  return Object.fromEntries((r.results ?? []).map((x) => [x.question_id, x.updated_at]));
}

export async function saveAnswer(db: D1Database, slug: string, questionId: string, value: AnswerValue | null) {
  const stmts = [
    value === null
      ? db.prepare('DELETE FROM answers WHERE slug = ? AND question_id = ?').bind(slug, questionId)
      : db
          .prepare(
            `INSERT INTO answers (slug, question_id, value, updated_at) VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(slug, question_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          )
          .bind(slug, questionId, JSON.stringify(value)),
    db
      .prepare(
        `UPDATE clients SET last_activity_at = datetime('now'),
         status = CASE WHEN status = 'not-started' THEN 'in-progress' ELSE status END WHERE slug = ?`,
      )
      .bind(slug),
  ];
  await db.batch(stmts);
}

export async function markSubmitted(db: D1Database, slug: string) {
  await db.prepare(`UPDATE clients SET status = 'submitted', submitted_at = datetime('now'), last_activity_at = datetime('now') WHERE slug = ?`).bind(slug).run();
}

export async function logEvent(db: D1Database, slug: string, type: string, data?: unknown) {
  await db.prepare('INSERT INTO events (slug, type, data) VALUES (?, ?, ?)').bind(slug, type, data === undefined ? null : JSON.stringify(data)).run();
}

export async function listEvents(db: D1Database, slug: string, limit = 50) {
  const r = await db.prepare('SELECT type, data, created_at FROM events WHERE slug = ? ORDER BY id DESC LIMIT ?').bind(slug, limit).all<{ type: string; data: string | null; created_at: string }>();
  return r.results ?? [];
}

export async function listUploads(db: D1Database, slug: string): Promise<UploadRow[]> {
  const r = await db.prepare('SELECT * FROM uploads WHERE slug = ? ORDER BY uploaded_at').bind(slug).all<UploadRow>();
  return r.results ?? [];
}

export function toPublicUpload(u: UploadRow): PublicUpload {
  return { id: u.id, question_id: u.question_id, file_name: u.file_name, content_type: u.content_type, size: u.size, uploaded_at: u.uploaded_at };
}

export async function getUpload(db: D1Database, id: string): Promise<UploadRow | null> {
  return db.prepare('SELECT * FROM uploads WHERE id = ?').bind(id).first<UploadRow>();
}

export async function insertUpload(db: D1Database, u: Omit<UploadRow, 'uploaded_at'>) {
  await db
    .prepare('INSERT INTO uploads (id, slug, question_id, r2_key, file_name, content_type, size) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(u.id, u.slug, u.question_id, u.r2_key, u.file_name, u.content_type, u.size)
    .run();
}

export async function deleteUploadRow(db: D1Database, id: string) {
  await db.prepare('DELETE FROM uploads WHERE id = ?').bind(id).run();
}

/** Wipe a client's answers, uploads and history but keep their passcode. Used for the demo client only. */
export async function resetClientData(db: D1Database, slug: string): Promise<string[]> {
  const keys = (await listUploads(db, slug)).map((u) => u.r2_key);
  await db.batch([
    db.prepare('DELETE FROM answers WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM uploads WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM events WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM submissions WHERE slug = ?').bind(slug),
    db.prepare(`UPDATE clients SET status = 'not-started', first_opened_at = NULL, last_activity_at = NULL, submitted_at = NULL WHERE slug = ?`).bind(slug),
  ]);
  return keys;
}

export type Submission = { id: number; created_at: string; answers: Answers };

/** Keep a copy of the answers as they were at the moment the client tapped Send. */
export async function addSubmission(db: D1Database, slug: string, answers: Answers) {
  await db.prepare('INSERT INTO submissions (slug, answers) VALUES (?, ?)').bind(slug, JSON.stringify(answers)).run();
}

/** Every send for a client, oldest first. */
export async function listSubmissions(db: D1Database, slug: string): Promise<Submission[]> {
  const r = await db.prepare('SELECT id, answers, created_at FROM submissions WHERE slug = ? ORDER BY id').bind(slug).all<{ id: number; answers: string; created_at: string }>();
  return (r.results ?? []).map((x) => {
    let answers: Answers = {};
    try {
      answers = JSON.parse(x.answers) as Answers;
    } catch {
      /* keep the row, show it as empty */
    }
    return { id: x.id, created_at: x.created_at, answers };
  });
}
