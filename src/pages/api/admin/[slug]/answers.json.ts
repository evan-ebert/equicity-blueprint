import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/guard';
import { getClientConfig } from '../../../../lib/config';
import { getAnswers, getClientRow, listUploads, toPublicUpload } from '../../../../lib/db';
import { buildFlags } from '../../../../lib/summary';
import { getEnv } from '../../../../lib/http';

/** discovery.json: the raw answers keyed by question id, plus flags and uploads, for future automation. */
export const GET: APIRoute = async ({ params, locals, cookies }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const config = params.slug ? getClientConfig(params.slug) : null;
  if (!config) return new Response('Not found', { status: 404 });
  const [answers, uploads, row] = await Promise.all([getAnswers(env.DB, config.slug), listUploads(env.DB, config.slug), getClientRow(env.DB, config.slug)]);
  const body = { client: config.slug, business: config.business, status: row?.status ?? 'not-started', submittedAt: row?.submitted_at ?? null, flags: buildFlags(config, answers, uploads), answers, uploads: uploads.map(toPublicUpload) };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="discovery-${config.slug}.json"`, 'cache-control': 'no-store' },
  });
};
