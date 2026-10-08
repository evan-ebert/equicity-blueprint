/** Small helpers shared by API routes and pages. */

/** The app's mount path with a trailing slash: "/" locally, "/blueprint/" on equicityseo.com. */
export const BASE = (() => {
  const b = import.meta.env.BASE_URL || '/';
  return b.endsWith('/') ? b : `${b}/`;
})();

/** Build an app URL from a path like "hart-to-heart" or "api/hart-to-heart/answer". */
export function withBase(path: string): string {
  return BASE + path.replace(/^\/+/, '');
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorJson(status: number, message: string): Response {
  return json({ ok: false, error: message }, { status });
}

export function redirect(path: string, status = 303): Response {
  return new Response(null, { status, headers: { location: withBase(path), 'cache-control': 'no-store' } });
}

export function getEnv(locals: App.Locals): Env {
  return locals.runtime.env;
}
