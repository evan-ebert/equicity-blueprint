import type { APIRoute } from 'astro';
import { requireClientRound } from '../../../../../lib/roundAccess';
import { CLIENT_EDITABLE, getRoundAnswers, logEvent, saveRoundAnswer, type AnswerValue } from '../../../../../lib/db';
import { checkRoundAnswer } from '../../../../../lib/rounds';
import { errorJson, getEnv, json } from '../../../../../lib/http';

const QID = /^[a-z0-9_:.-]{1,64}$/;
const MAX_BYTES = 24_000;

/** Autosave for a round. The server enforces the lock: a sent or closed round answers 409. */
export const PUT: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = getEnv(locals);
  const ctx = await requireClientRound(env, params.slug, params.n, cookies);
  if (ctx instanceof Response) return ctx;
  if (!CLIENT_EDITABLE.includes(ctx.round.status)) return errorJson(409, 'This round was already sent, so it is closed for changes.');
  const text = await request.text();
  if (text.length > MAX_BYTES) return errorJson(413, `That note is too long to save. Try a shorter version, or text ${ctx.client.ownerName} a voice memo.`);
  let body: { qid?: string; value?: AnswerValue | null };
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson(400, 'Bad request');
  }
  if (!body.qid || !QID.test(body.qid)) return errorJson(400, 'Bad item id');
  const value = body.value ?? null;
  if (value !== null) {
    if (typeof value !== 'object' || !('v' in value)) return errorJson(400, 'Bad value');
    const problem = checkRoundAnswer(ctx.config, body.qid, value);
    if (problem) return errorJson(400, problem);
  }
  if (body.qid === '_visited' && value) {
    // Log each screen the first time the client passes it, so admin can show progress.
    const before = await getRoundAnswers(env.DB, ctx.round.id);
    const seen = new Set(Array.isArray(before._visited?.v) ? (before._visited!.v as string[]) : []);
    for (const id of value.v as string[]) if (!seen.has(id)) await logEvent(env.DB, ctx.client.slug, 'round-screen-viewed', { round: ctx.round.number, screen: id });
  }
  await saveRoundAnswer(env.DB, ctx.round.id, body.qid, value);
  return json({ ok: true });
};
