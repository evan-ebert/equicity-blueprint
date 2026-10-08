import type { APIRoute } from 'astro';
import { clientCookieName } from '../../../lib/auth';
import { BASE, redirect } from '../../../lib/http';

export const POST: APIRoute = async ({ params, cookies }) => {
  const slug = String(params.slug ?? '');
  cookies.delete(clientCookieName(slug), { path: BASE });
  return redirect(slug);
};
