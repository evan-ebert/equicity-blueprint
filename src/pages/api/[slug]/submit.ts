import type { APIRoute } from 'astro';
import { requireClient } from '../../../lib/guard';
import { getAnswers, getClientRow, listUploads, logEvent, markSubmitted } from '../../../lib/db';
import { buildFlags } from '../../../lib/summary';
import { notifySlack } from '../../../lib/notify';
import { getEnv, json, withBase } from '../../../lib/http';

export const POST: APIRoute = async ({ params, locals, cookies, url }) => {
  const env = getEnv(locals);
  const config = await requireClient(env, params.slug, cookies);
  if (config instanceof Response) return config;
  const before = await getClientRow(env.DB, config.slug);
  await markSubmitted(env.DB, config.slug);
  const [answers, uploads] = await Promise.all([getAnswers(env.DB, config.slug), listUploads(env.DB, config.slug)]);
  const flags = buildFlags(config, answers, uploads);
  await logEvent(env.DB, config.slug, 'submitted', { flags: flags.length, resubmit: !!before?.submitted_at });
  const origin = env.PUBLIC_ORIGIN || url.origin;
  const admin = `${origin}${withBase(`admin/${config.slug}`)}`;
  const verb = before?.submitted_at ? 'updated' : 'sent';
  await notifySlack(
    env,
    `${config.firstName} (${config.business}) ${verb} their blueprint. ${flags.length} flag${flags.length === 1 ? '' : 's'}, ${uploads.length} file${uploads.length === 1 ? '' : 's'}.\n${admin}`,
  );
  return json({ ok: true });
};
