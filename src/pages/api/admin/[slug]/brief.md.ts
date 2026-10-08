import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/guard';
import { getClientConfig } from '../../../../lib/config';
import { getAnswers, getClientRow, listUploads } from '../../../../lib/db';
import { buildBriefMarkdown } from '../../../../lib/summary';
import { getEnv } from '../../../../lib/http';

export const GET: APIRoute = async ({ params, locals, cookies, url }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const config = params.slug ? getClientConfig(params.slug) : null;
  if (!config) return new Response('Not found', { status: 404 });
  const [answers, uploads, row] = await Promise.all([getAnswers(env.DB, config.slug), listUploads(env.DB, config.slug), getClientRow(env.DB, config.slug)]);
  const md = buildBriefMarkdown(config, answers, uploads, { submittedAt: row?.submitted_at, lastActivityAt: row?.last_activity_at });
  const inline = url.searchParams.get('view') === '1';
  return new Response(md, {
    headers: {
      'content-type': inline ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="discovery-brief-${config.slug}.md"`,
      'cache-control': 'no-store',
    },
  });
};
