import type { APIRoute } from 'astro';
import { requireClientRound } from '../../../../../lib/roundAccess';
import { getRoundAnswers, getRoundAnswersUpdatedAt } from '../../../../../lib/db';
import { getEnv, json } from '../../../../../lib/http';

export const GET: APIRoute = async ({ params, locals, cookies }) => {
  const env = getEnv(locals);
  const ctx = await requireClientRound(env, params.slug, params.n, cookies);
  if (ctx instanceof Response) return ctx;
  const [answers, updatedAt] = await Promise.all([getRoundAnswers(env.DB, ctx.round.id), getRoundAnswersUpdatedAt(env.DB, ctx.round.id)]);
  return json({ ok: true, answers, updatedAt, now: new Date().toISOString(), status: ctx.round.status, submittedAt: ctx.round.submitted_at });
};
