import type { APIRoute } from 'astro';
import { ADMIN_COOKIE } from '../../../lib/auth';
import { BASE, redirect } from '../../../lib/http';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE, { path: BASE });
  return redirect('admin');
};
