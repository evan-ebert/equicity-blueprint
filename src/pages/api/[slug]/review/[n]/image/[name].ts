import type { APIRoute } from 'astro';
import { canSeeRound, loadRound } from '../../../../../../lib/roundAccess';
import { getRoundImage } from '../../../../../../lib/db';
import { getEnv } from '../../../../../../lib/http';

/** A round image, display size or full size. Only the signed-in client and the admin can load it. */
export const GET: APIRoute = async ({ params, url, locals, cookies }) => {
  const env = getEnv(locals);
  const ctx = await loadRound(env.DB, params.slug, params.n);
  if (!ctx || !params.name) return new Response('Not found', { status: 404 });
  if (!(await canSeeRound(env, ctx, cookies))) return new Response('Not found', { status: 404 });
  const img = await getRoundImage(env.DB, ctx.round.id, params.name);
  if (!img) return new Response('Not found', { status: 404 });
  const full = url.searchParams.get('size') === 'full';
  const key = full ? img.r2_key : img.display_key || img.r2_key;
  const obj = await env.UPLOADS.get(key);
  if (!obj) return new Response('Missing from storage', { status: 410 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'cache-control': 'private, no-cache',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
};
