import { defineMiddleware } from 'astro:middleware';

/**
 * Every response is private: never indexed, never framed, no third-party scripts.
 * Images may come from the Pexels CDN (imagery tiles) and WordPress mShots (example site previews).
 */
/** If Webflow serves built assets from the Worker's own host, allow that host for scripts, styles, fonts and images. */
const ASSETS = (() => {
  try {
    const p = import.meta.env.ASSETS_PREFIX as unknown;
    return typeof p === 'string' && /^https?:\/\//.test(p) ? ` ${new URL(p).origin}` : '';
  } catch {
    return '';
  }
})();

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${ASSETS}`,
  `style-src 'self' 'unsafe-inline'${ASSETS}`,
  `img-src 'self' data: blob: https://images.pexels.com https://*.wp.com${ASSETS}`,
  `font-src 'self' data:${ASSETS}`,
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Same-origin check for anything that changes data, aware of Webflow's proxy. Browsers send Sec-Fetch-Site;
 * otherwise compare the Origin host with the hosts this request could legitimately come from.
 * Session cookies are also SameSite=Lax, so this is a second layer.
 */
function isSameOrigin(request: Request, url: URL, env: Partial<Env> | undefined): boolean {
  const h = request.headers;
  const site = h.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const origin = h.get('origin');
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = new Set<string>([url.host]);
  for (const v of [h.get('host'), h.get('x-forwarded-host')?.split(',')[0]?.trim()]) if (v) allowed.add(v);
  try {
    if (env?.PUBLIC_ORIGIN) allowed.add(new URL(env.PUBLIC_ORIGIN).host);
  } catch {
    // Ignore a malformed PUBLIC_ORIGIN.
  }
  return allowed.has(host);
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (UNSAFE.has(context.request.method) && !isSameOrigin(context.request, context.url, context.locals.runtime?.env)) {
    return new Response('Forbidden', { status: 403, headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } });
  }
  const response = await next();
  const h = response.headers;
  try {
    h.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    h.set('Referrer-Policy', 'no-referrer');
    h.set('X-Content-Type-Options', 'nosniff');
    h.set('X-Frame-Options', 'DENY');
    h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    if (!h.has('Content-Security-Policy')) h.set('Content-Security-Policy', CSP);
  } catch {
    // Some responses (redirects from fetch) have immutable headers; copy them into a new response.
    const copy = new Response(response.body, response);
    copy.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    copy.headers.set('Referrer-Policy', 'no-referrer');
    copy.headers.set('X-Content-Type-Options', 'nosniff');
    copy.headers.set('X-Frame-Options', 'DENY');
    return copy;
  }
  return response;
});
