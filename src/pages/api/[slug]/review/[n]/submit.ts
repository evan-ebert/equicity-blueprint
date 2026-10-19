import type { APIRoute } from 'astro';
import { requireClientRound } from '../../../../../lib/roundAccess';
import { CLIENT_EDITABLE, addRoundSubmission, getRoundAnswers, listRoundSubmissions, logEvent, setRoundStatus } from '../../../../../lib/db';
import { buildRoundSlack, buildRoundSummary, diffRoundAnswers } from '../../../../../lib/rounds';
import { notifySlack } from '../../../../../lib/notify';
import { errorJson, getEnv, json, withBase } from '../../../../../lib/http';

/** Send a round: keep a copy of every answer, lock it, and tell Evan in Slack. */
export const POST: APIRoute = async ({ params, locals, cookies, url }) => {
  const env = getEnv(locals);
  const ctx = await requireClientRound(env, params.slug, params.n, cookies);
  if (ctx instanceof Response) return ctx;
  if (!CLIENT_EDITABLE.includes(ctx.round.status)) return errorJson(409, 'This round was already sent.');
  const [answers, earlier] = await Promise.all([getRoundAnswers(env.DB, ctx.round.id), listRoundSubmissions(env.DB, ctx.round.id)]);
  const summary = buildRoundSummary(ctx.config, answers);
  if (summary.missing.length) return errorJson(400, `Pick an option for "${summary.missing[0].title}" first.`);
  await addRoundSubmission(env.DB, ctx.round.id, answers);
  await setRoundStatus(env.DB, ctx.round.id, 'submitted');
  const previous = earlier.at(-1);
  const changes = previous ? diffRoundAnswers(ctx.config, previous.answers, answers) : [];
  await logEvent(env.DB, ctx.client.slug, 'round-submitted', { round: ctx.round.number, resend: !!previous, changes: changes.length, attention: summary.attention.length });
  const origin = env.PUBLIC_ORIGIN || url.origin;
  const adminUrl = `${origin}${withBase(`admin/${ctx.client.slug}/review/${ctx.round.number}`)}`;
  const who = `${ctx.client.fullName ?? ctx.client.firstName} (${ctx.client.business})`;
  await notifySlack(env, buildRoundSlack(ctx.config, answers, { who, number: ctx.round.number, adminUrl, resend: !!previous, changes }));
  return json({ ok: true, submittedAt: new Date().toISOString() });
};
