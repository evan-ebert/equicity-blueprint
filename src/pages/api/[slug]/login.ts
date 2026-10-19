import type { APIRoute } from 'astro';
import { getClientConfig } from '../../../lib/config';
import { SetupError, allowAttempt, clearAttempts, clientCookieName, clientIp, cookieOptions, startClientSession, verifyCode } from '../../../lib/auth';
import { getClientRow, logEvent, markOpened } from '../../../lib/db';
import { notifySlack } from '../../../lib/notify';
import { BASE, getEnv, redirect } from '../../../lib/http';

/** Plain form POST from the gate. Works without JavaScript. */
export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = getEnv(locals);
  const config = params.slug ? getClientConfig(params.slug) : null;
  if (!config) return new Response('Not found', { status: 404 });
  const slug = config.slug;
  const form = await request.formData().catch(() => null);
  const code = String(form?.get('code') ?? '');
  // Where to land after the code: the client's home, or one of their review rounds. Nothing else.
  const wanted = String(form?.get('next') ?? '').replace(/^\/+/, '');
  const next = new RegExp(`^${slug}(/review/\\d{1,3})?$`).test(wanted) ? wanted : slug;
  const back = (q: string) => redirect(`${next}?e=${q}`);

  const key = `client:${slug}:${clientIp(request)}`;
  if (!(await allowAttempt(env.DB, key))) return back('wait');

  const row = await getClientRow(env.DB, slug);
  if (!row?.passcode_hash || !row.passcode_salt) return back('notready');
  const ok = code.length >= 4 && (await verifyCode(code, row.passcode_hash, row.passcode_salt));
  if (!ok) {
    await logEvent(env.DB, slug, 'login-failed');
    return back('code');
  }
  try {
    const session = await startClientSession(env, slug);
    cookies.set(clientCookieName(slug), session.token, cookieOptions(BASE, session.days));
  } catch (e) {
    if (e instanceof SetupError) return back('setup');
    throw e;
  }
  await clearAttempts(env.DB, key);
  await markOpened(env.DB, slug);
  await logEvent(env.DB, slug, 'opened');
  if (!row.first_opened_at) await notifySlack(env, `${config.fullName ?? config.firstName} (${config.business}) just opened their blueprint for the first time.`);
  return redirect(next);
};
