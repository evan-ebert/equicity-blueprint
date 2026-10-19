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
  const imgs = await db.prepare('SELECT r2_key, display_key FROM round_images WHERE round_id IN (SELECT id FROM rounds WHERE slug = ?)').bind(slug).all<{ r2_key: string; display_key: string }>();
  for (const i of imgs.results ?? []) keys.push(...[i.r2_key, i.display_key].filter(Boolean));
  await db.batch([
    db.prepare('DELETE FROM answers WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM uploads WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM events WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM submissions WHERE slug = ?').bind(slug),
    db.prepare('DELETE FROM round_answers WHERE round_id IN (SELECT id FROM rounds WHERE slug = ?)').bind(slug),
    db.prepare('DELETE FROM round_submissions WHERE round_id IN (SELECT id FROM rounds WHERE slug = ?)').bind(slug),
    db.prepare('DELETE FROM round_images WHERE round_id IN (SELECT id FROM rounds WHERE slug = ?)').bind(slug),
    db.prepare('DELETE FROM rounds WHERE slug = ?').bind(slug),
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

// ---------- review rounds ----------

export type RoundStatus = 'draft' | 'open' | 'submitted' | 'reopened' | 'closed';
export type RoundRow = {
  id: number;
  slug: string;
  number: number;
  title: string;
  status: RoundStatus;
  config: string;
  due_date: string | null;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
};
export type RoundImageRow = { round_id: number; name: string; r2_key: string; display_key: string; width: number | null; height: number | null; uploaded_at: string };
export type RoundSubmission = { id: number; created_at: string; answers: Answers };

/** Rounds a client can work on right now: open, or reopened after a send. */
export const CLIENT_EDITABLE: RoundStatus[] = ['open', 'reopened'];
/** Rounds a client can see at all (editable ones plus sent ones, read only). */
export const CLIENT_VISIBLE: RoundStatus[] = ['open', 'reopened', 'submitted', 'closed'];

export async function listRounds(db: D1Database, slug: string): Promise<RoundRow[]> {
  const r = await db.prepare('SELECT * FROM rounds WHERE slug = ? ORDER BY number').bind(slug).all<RoundRow>();
  return r.results ?? [];
}

export async function listOpenRounds(db: D1Database, slug: string): Promise<RoundRow[]> {
  const r = await db.prepare(`SELECT * FROM rounds WHERE slug = ? AND status IN ('open', 'reopened') ORDER BY number`).bind(slug).all<RoundRow>();
  return r.results ?? [];
}

export async function getRound(db: D1Database, slug: string, number: number): Promise<RoundRow | null> {
  return db.prepare('SELECT * FROM rounds WHERE slug = ? AND number = ?').bind(slug, number).first<RoundRow>();
}

export async function createRound(db: D1Database, r: { slug: string; number: number; title: string; config: string; due_date: string | null }) {
  await db.prepare('INSERT INTO rounds (slug, number, title, config, due_date) VALUES (?, ?, ?, ?, ?)').bind(r.slug, r.number, r.title, r.config, r.due_date).run();
}

export async function updateRoundConfig(db: D1Database, id: number, r: { title: string; config: string; due_date: string | null }) {
  await db.prepare('UPDATE rounds SET title = ?, config = ?, due_date = ? WHERE id = ?').bind(r.title, r.config, r.due_date, id).run();
}

export async function setRoundStatus(db: D1Database, id: number, status: RoundStatus) {
  const extra = status === 'open' ? ", opened_at = COALESCE(opened_at, datetime('now'))" : status === 'submitted' ? ", submitted_at = datetime('now')" : '';
  await db.prepare(`UPDATE rounds SET status = ?${extra} WHERE id = ?`).bind(status, id).run();
}

export async function listRoundImages(db: D1Database, roundId: number): Promise<RoundImageRow[]> {
  const r = await db.prepare('SELECT * FROM round_images WHERE round_id = ? ORDER BY name').bind(roundId).all<RoundImageRow>();
  return r.results ?? [];
}

export async function getRoundImage(db: D1Database, roundId: number, name: string): Promise<RoundImageRow | null> {
  return db.prepare('SELECT * FROM round_images WHERE round_id = ? AND name = ?').bind(roundId, name).first<RoundImageRow>();
}

export async function upsertRoundImage(db: D1Database, img: Omit<RoundImageRow, 'uploaded_at'>) {
  await db
    .prepare(
      `INSERT INTO round_images (round_id, name, r2_key, display_key, width, height, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(round_id, name) DO UPDATE SET r2_key = excluded.r2_key, display_key = excluded.display_key, width = excluded.width, height = excluded.height, uploaded_at = excluded.uploaded_at`,
    )
    .bind(img.round_id, img.name, img.r2_key, img.display_key, img.width, img.height)
    .run();
}

export async function deleteRoundImage(db: D1Database, roundId: number, name: string) {
  await db.prepare('DELETE FROM round_images WHERE round_id = ? AND name = ?').bind(roundId, name).run();
}

export async function getRoundAnswers(db: D1Database, roundId: number): Promise<Answers> {
  const r = await db.prepare('SELECT item_id, value FROM round_answers WHERE round_id = ?').bind(roundId).all<{ item_id: string; value: string }>();
  const out: Answers = {};
  for (const row of r.results ?? []) {
    try {
      out[row.item_id] = JSON.parse(row.value) as AnswerValue;
    } catch {
      /* skip a corrupt row */
    }
  }
  return out;
}

export async function getRoundAnswersUpdatedAt(db: D1Database, roundId: number): Promise<Record<string, string>> {
  const r = await db.prepare('SELECT item_id, updated_at FROM round_answers WHERE round_id = ?').bind(roundId).all<{ item_id: string; updated_at: string }>();
  return Object.fromEntries((r.results ?? []).map((x) => [x.item_id, x.updated_at]));
}

export async function getRoundLastActivity(db: D1Database, roundId: number): Promise<string | null> {
  const row = await db.prepare('SELECT MAX(updated_at) AS at FROM round_answers WHERE round_id = ?').bind(roundId).first<{ at: string | null }>();
  return row?.at ?? null;
}

export async function saveRoundAnswer(db: D1Database, roundId: number, itemId: string, value: AnswerValue | null) {
  if (value === null) await db.prepare('DELETE FROM round_answers WHERE round_id = ? AND item_id = ?').bind(roundId, itemId).run();
  else
    await db
      .prepare(
        `INSERT INTO round_answers (round_id, item_id, value, updated_at) VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(round_id, item_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(roundId, itemId, JSON.stringify(value))
      .run();
}

export async function addRoundSubmission(db: D1Database, roundId: number, answers: Answers) {
  await db.prepare('INSERT INTO round_submissions (round_id, answers) VALUES (?, ?)').bind(roundId, JSON.stringify(answers)).run();
}

export async function listRoundSubmissions(db: D1Database, roundId: number): Promise<RoundSubmission[]> {
  const r = await db.prepare('SELECT id, answers, created_at FROM round_submissions WHERE round_id = ? ORDER BY id').bind(roundId).all<{ id: number; answers: string; created_at: string }>();
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

export async function listRoundEvents(db: D1Database, slug: string, roundNumber: number, limit = 40) {
  const r = await db
    .prepare(`SELECT type, data, created_at FROM events WHERE slug = ? AND type LIKE 'round-%' AND json_extract(data, '$.round') = ? ORDER BY id DESC LIMIT ?`)
    .bind(slug, roundNumber, limit)
    .all<{ type: string; data: string | null; created_at: string }>();
  return r.results ?? [];
}
