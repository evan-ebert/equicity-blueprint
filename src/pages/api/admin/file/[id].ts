import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/guard';
import { getUpload } from '../../../../lib/db';
import { getEnv } from '../../../../lib/http';

/** Admin-only download of a client upload. Always an attachment, never rendered inline (SVGs included). */
export const GET: APIRoute = async ({ params, locals, cookies }) => {
  const env = getEnv(locals);
  const ok = await requireAdmin(env, cookies);
  if (ok instanceof Response) return ok;
  const row = params.id ? await getUpload(env.DB, params.id) : null;
  if (!row) return new Response('Not found', { status: 404 });
  const obj = await env.UPLOADS.get(row.r2_key);
  if (!obj) return new Response('Missing from storage', { status: 410 });
  return new Response(obj.body, {
    headers: {
      'content-type': row.content_type === 'image/svg+xml' ? 'application/octet-stream' : row.content_type,
      'content-disposition': `attachment; filename="${row.file_name.replace(/"/g, '')}"`,
      'content-security-policy': "default-src 'none'; sandbox",
      'cache-control': 'no-store',
    },
  });
};
