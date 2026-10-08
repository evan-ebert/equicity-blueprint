import type { AstroCookies } from 'astro';
import { getClientConfig, type ClientConfig } from './config';
import { ADMIN_COOKIE, SetupError, clientCookieName, hasAdminSession, hasClientSession } from './auth';
import { errorJson } from './http';

/** Resolve the client for an API call and check the session. Returns a config or an error Response. */
export async function requireClient(env: Env, slug: string | undefined, cookies: AstroCookies): Promise<ClientConfig | Response> {
  const config = slug ? getClientConfig(slug) : null;
  if (!config) return errorJson(404, 'Not found');
  try {
    const ok = await hasClientSession(env, config.slug, cookies.get(clientCookieName(config.slug))?.value);
    if (!ok) return errorJson(401, 'Your session ended. Reload the page and enter your code again.');
  } catch (e) {
    if (e instanceof SetupError) return errorJson(503, 'This blueprint is still being set up. Please text Evan.');
    throw e;
  }
  return config;
}

export async function requireAdmin(env: Env, cookies: AstroCookies): Promise<true | Response> {
  try {
    if (await hasAdminSession(env, cookies.get(ADMIN_COOKIE)?.value)) return true;
  } catch (e) {
    if (e instanceof SetupError) return errorJson(503, e.message);
    throw e;
  }
  return errorJson(401, 'Admin login required');
}
