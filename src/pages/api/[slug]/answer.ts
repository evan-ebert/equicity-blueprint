import type { APIRoute } from 'astro';
import { requireClient } from '../../../lib/guard';
import { saveAnswer, type AnswerValue } from '../../../lib/db';
import { errorJson, getEnv, json } from '../../../lib/http';

const QID = /^[a-z0-9_:.-]{1,64}$/;
const MAX_BYTES = 24_000;

/** Autosave: one answer per call. A null value clears the answer. */
export const PUT: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = getEnv(locals);
  const config = await requireClient(env, params.slug, cookies);
  if (config instanceof Response) return config;
  const text = await request.text();
  if (text.length > MAX_BYTES) return errorJson(413, 'That answer is too long to save. Try a shorter version, or text Evan a voice memo.');
  let body: { qid?: string; value?: AnswerValue | null };
  try {
    body = JSON.parse(text);
  } catch {
    return errorJson(400, 'Bad request');
  }
  if (!body.qid || !QID.test(body.qid)) return errorJson(400, 'Bad question id');
  const value = body.value ?? null;
  if (value !== null) {
    if (typeof value !== 'object' || !('v' in value)) return errorJson(400, 'Bad value');
    if (value.exit && value.exit !== 'not-sure' && value.exit !== 'talk') return errorJson(400, 'Bad exit');
  }
  await saveAnswer(env.DB, config.slug, body.qid, value);
  return json({ ok: true });
};
