import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../../lib/guard';
import { loadRound, roundDisplayKey, roundImageKey } from '../../../../../../lib/roundAccess';
import { deleteRoundImage, getRoundImage, upsertRoundImage } from '../../../../../../lib/db';
import { configImages } from '../../../../../../lib/rounds';
import { errorJson, getEnv, json } from '../../../../../../lib/http';

const MAX_SIZE = 10 * 1024 * 1024;

/**
 * Admin upload of one round image. The browser sends the original (kind=full) and a resized
 * copy (kind=display) as two requests, each well inside Webflow Cloud's request limits.
 */
export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const ctx = await loadRound(env.DB, params.slug, params.n);
  if (!ctx) return errorJson(404, 'Not found');
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const name = String(form?.get('name') ?? '');
  const kind = String(form?.get('kind') ?? 'full');
  const width = Number(form?.get('width') ?? 0) || null;
  const height = Number(form?.get('height') ?? 0) || null;
  if (!configImages(ctx.config).includes(name)) return errorJson(400, `The config does not name an image called ${name || '(blank)'}.`);
  if (!(file instanceof File) || file.size === 0) return errorJson(400, 'No file received.');
  if (file.size > MAX_SIZE) return errorJson(413, 'That image is over 10 MB. Export a smaller JPG.');
  if (!/^image\/(jpeg|png)$/.test(file.type)) return errorJson(415, 'Use a JPG or PNG.');
  if (kind !== 'full' && kind !== 'display') return errorJson(400, 'Bad kind');
  const key = kind === 'full' ? roundImageKey(ctx.client.slug, ctx.round.number, name) : roundDisplayKey(ctx.client.slug, ctx.round.number, name);
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { slug: ctx.client.slug, round: String(ctx.round.number), name, kind } });
  const existing = await getRoundImage(env.DB, ctx.round.id, name);
  await upsertRoundImage(env.DB, {
    round_id: ctx.round.id,
    name,
    r2_key: kind === 'full' ? key : existing?.r2_key ?? '',
    display_key: kind === 'display' ? key : existing?.display_key ?? '',
    width: kind === 'full' ? width : existing?.width ?? null,
    height: kind === 'full' ? height : existing?.height ?? null,
  });
  const row = await getRoundImage(env.DB, ctx.round.id, name);
  return json({ ok: true, ready: !!(row?.r2_key && row.display_key) });
};

export const DELETE: APIRoute = async ({ params, url, locals, cookies }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const ctx = await loadRound(env.DB, params.slug, params.n);
  if (!ctx) return errorJson(404, 'Not found');
  const name = url.searchParams.get('name') ?? '';
  const row = await getRoundImage(env.DB, ctx.round.id, name);
  if (!row) return errorJson(404, 'Not found');
  await env.UPLOADS.delete([row.r2_key, row.display_key].filter(Boolean));
  await deleteRoundImage(env.DB, ctx.round.id, name);
  return json({ ok: true });
};
