/** Resolve a client's round for API calls and pages, and say who may see it. */
import type { AstroCookies } from 'astro';
import { ADMIN_COOKIE, SetupError, clientCookieName, hasAdminSession, hasClientSession } from './auth';
import { getClientConfig, type ClientConfig } from './config';
import { CLIENT_VISIBLE, getRound, type RoundRow } from './db';
import { errorJson } from './http';
import { parseRoundConfig, type RoundConfig } from './rounds';

export type RoundContext = { client: ClientConfig; round: RoundRow; config: RoundConfig };

export function parseRoundNumber(n: string | undefined): number | null {
  return n && /^\d{1,3}$/.test(n) ? Number(n) : null;
}

/** The round and its parsed config, or null when either is missing or the stored config is somehow invalid. */
export async function loadRound(db: D1Database, slug: string | undefined, n: string | undefined): Promise<RoundContext | null> {
  const client = slug ? getClientConfig(slug) : null;
  const number = parseRoundNumber(n);
  if (!client || number === null) return null;
  const round = await getRound(db, client.slug, number);
  if (!round) return null;
  const config = parseRoundConfig(round.config);
  if (!config) return null;
  return { client, round, config };
}

/** Client API: a signed-in client on a round they can see. Returns the context or an error response. */
export async function requireClientRound(env: Env, slug: string | undefined, n: string | undefined, cookies: AstroCookies): Promise<RoundContext | Response> {
  const ctx = await loadRound(env.DB, slug, n);
  if (!ctx) return errorJson(404, 'Not found');
  try {
    const ok = await hasClientSession(env, ctx.client.slug, cookies.get(clientCookieName(ctx.client.slug))?.value);
    if (!ok) return errorJson(401, 'Your session ended. Reload the page and enter your code again.');
  } catch (e) {
    if (e instanceof SetupError) return errorJson(503, 'This blueprint is still being set up. Please text Evan.');
    throw e;
  }
  if (!CLIENT_VISIBLE.includes(ctx.round.status)) return errorJson(404, 'Not found');
  return ctx;
}

/** Images: the signed-in client (when the round is visible to them) or the admin (always). */
export async function canSeeRound(env: Env, ctx: RoundContext, cookies: AstroCookies): Promise<boolean> {
  try {
    if (await hasAdminSession(env, cookies.get(ADMIN_COOKIE)?.value)) return true;
    if (!CLIENT_VISIBLE.includes(ctx.round.status)) return false;
    return await hasClientSession(env, ctx.client.slug, cookies.get(clientCookieName(ctx.client.slug))?.value);
  } catch (e) {
    if (e instanceof SetupError) return false;
    throw e;
  }
}

export const roundImageKey = (slug: string, n: number, name: string) => `rounds/${slug}/${n}/${name}`;
export const roundDisplayKey = (slug: string, n: number, name: string) => `rounds/${slug}/${n}/display/${name}`;
