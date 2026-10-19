import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../../lib/guard';
import { loadRound } from '../../../../../../lib/roundAccess';
import { getRoundAnswers, listRoundSubmissions } from '../../../../../../lib/db';
import { buildRoundMarkdown } from '../../../../../../lib/rounds';
import { getEnv } from '../../../../../../lib/http';

/** review-round-<slug>-r<n>.md, written to paste into the client's Claude project. */
export const GET: APIRoute = async ({ params, locals, cookies, url }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const ctx = await loadRound(env.DB, params.slug, params.n);
  if (!ctx) return new Response('Not found', { status: 404 });
  const [answers, sends] = await Promise.all([getRoundAnswers(env.DB, ctx.round.id), listRoundSubmissions(env.DB, ctx.round.id)]);
  // Export what was last sent when there is a send; otherwise the live answers (a draft look).
  const sent = sends.at(-1);
  const md = buildRoundMarkdown(ctx.config, sent ? sent.answers : answers, {
    business: ctx.client.business,
    number: ctx.round.number,
    submittedAt: sent?.created_at ?? null,
    openedAt: ctx.round.opened_at,
    firstSent: sends.length > 1 ? { at: sends[0].created_at, answers: sends[0].answers } : undefined,
  });
  const inline = url.searchParams.get('view') === '1';
  return new Response(md, {
    headers: {
      'content-type': inline ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="review-round-${ctx.client.slug}-r${ctx.round.number}.md"`,
      'cache-control': 'no-store',
    },
  });
};
