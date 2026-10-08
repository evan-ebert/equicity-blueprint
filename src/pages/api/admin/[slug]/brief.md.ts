import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/guard';
import { getClientConfig } from '../../../../lib/config';
import { getAnswers, getClientRow, listSubmissions, listUploads } from '../../../../lib/db';
import { buildBriefMarkdown } from '../../../../lib/summary';
import { getEnv } from '../../../../lib/http';

export const GET: APIRoute = async ({ params, locals, cookies, url }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const config = params.slug ? getClientConfig(params.slug) : null;
  if (!config) return new Response('Not found', { status: 404 });
  const [answers, uploads, row, sends] = await Promise.all([getAnswers(env.DB, config.slug), listUploads(env.DB, config.slug), getClientRow(env.DB, config.slug), listSubmissions(env.DB, config.slug)]);
  const md = buildBriefMarkdown(config, answers, uploads, { submittedAt: row?.submitted_at, lastActivityAt: row?.last_activity_at, firstSent: sends[0] ? { at: sends[0].created_at, answers: sends[0].answers } : undefined });
  const inline = url.searchParams.get('view') === '1';
  return new Response(md, {
    headers: {
      'content-type': inline ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="discovery-brief-${config.slug}.md"`,
      'cache-control': 'no-store',
    },
  });
};
