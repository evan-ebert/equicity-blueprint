import type { APIRoute } from 'astro';
import { getAllClientConfigs } from '../../../../lib/config';
import { ADMIN_COOKIE, SetupError, clientCookieName, hasAdminSession, hasClientSession } from '../../../../lib/auth';
import { previewKey } from '../../../../lib/previews';
import { getEnv } from '../../../../lib/http';

/** A saved example-site screenshot. Visible to that client (signed in) and to Evan. */
export const GET: APIRoute = async ({ params, locals, cookies }) => {
  const env = getEnv(locals);
  const config = getAllClientConfigs().find((c) => c.slug === params.slug);
  const example = config?.examples.find((e) => e.id === params.id);
  if (!config || !example) return new Response('Not found', { status: 404 });
  let ok = false;
  try {
    ok = (await hasClientSession(env, config.slug, cookies.get(clientCookieName(config.slug))?.value)) || (await hasAdminSession(env, cookies.get(ADMIN_COOKIE)?.value));
  } catch (e) {
    if (!(e instanceof SetupError)) throw e;
  }
  if (!ok) return new Response('Not found', { status: 404 });
  const obj = await env.UPLOADS.get(previewKey(config.slug, example.id));
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'cache-control': 'private, no-cache' } });
};
