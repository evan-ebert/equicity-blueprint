import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, SetupError, allowAttempt, checkAdminPassword, clearAttempts, clientIp, cookieOptions, startAdminSession } from '../../../lib/auth';
import { BASE, getEnv, redirect } from '../../../lib/http';

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  const env = getEnv(locals);
  const form = await request.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');
  const key = `admin:${clientIp(request)}`;
  if (!(await allowAttempt(env.DB, key, 6))) return redirect('admin?e=wait');
  try {
    if (!(await checkAdminPassword(env, password))) return redirect('admin?e=password');
    const s = await startAdminSession(env);
    cookies.set(ADMIN_COOKIE, s.token, cookieOptions(BASE, s.days));
  } catch (e) {
    if (e instanceof SetupError) return redirect('admin?e=setup');
    throw e;
  }
  await clearAttempts(env.DB, key);
  return redirect('admin');
};
