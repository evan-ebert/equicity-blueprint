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

export const onRequest = defineMiddleware(async (_context, next) => {
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
