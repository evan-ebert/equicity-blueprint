import type { APIRoute } from 'astro';
import { requireClient } from '../../../lib/guard';
import { addSubmission, getAnswers, getClientRow, listSubmissions, listUploads, logEvent, markSubmitted } from '../../../lib/db';
import { buildFlags, diffAnswers } from '../../../lib/summary';
import { notifySlack } from '../../../lib/notify';
import { getEnv, json, withBase } from '../../../lib/http';

/** Send: keep a copy of every answer as it stands, mark the client sent, and tell Evan in Slack. */
export const POST: APIRoute = async ({ params, locals, cookies, url }) => {
  const env = getEnv(locals);
  const config = await requireClient(env, params.slug, cookies);
  if (config instanceof Response) return config;
  const [before, answers, uploads, earlier] = await Promise.all([
    getClientRow(env.DB, config.slug),
    getAnswers(env.DB, config.slug),
    listUploads(env.DB, config.slug),
    listSubmissions(env.DB, config.slug),
  ]);
  await addSubmission(env.DB, config.slug, answers);
  await markSubmitted(env.DB, config.slug);
  const flags = buildFlags(config, answers, uploads);
  const previous = earlier.at(-1);
  const changes = previous ? diffAnswers(config, previous.answers, answers) : [];
  await logEvent(env.DB, config.slug, 'submitted', { flags: flags.length, resubmit: !!before?.submitted_at, changes: changes.length });

  const origin = env.PUBLIC_ORIGIN || url.origin;
  const admin = `${origin}${withBase(`admin/${config.slug}`)}`;
  const who = `${config.fullName ?? config.firstName} (${config.business})`;
  const lines: string[] = [];
  if (previous) {
    lines.push(`${who} sent an update. ${changes.length ? `${changes.length} answer${changes.length === 1 ? '' : 's'} changed: ${changes.slice(0, 8).map((c) => c.label).join(', ')}${changes.length > 8 ? ', and more' : ''}.` : 'No answers changed.'}`);
  } else {
    lines.push(`${who} sent their blueprint. ${uploads.length} file${uploads.length === 1 ? '' : 's'}.`);
  }
  if (flags.length) {
    lines.push('', `*Flags (${flags.length})*`);
    flags.forEach((f) => lines.push(`• ${f}`));
  }
  lines.push('', admin);
  await notifySlack(env, lines.join('\n'));
  return json({ ok: true });
};
