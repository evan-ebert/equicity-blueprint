import type { APIRoute } from 'astro';
import { requireClient } from '../../../lib/guard';
import { deleteUploadRow, getUpload, insertUpload, listUploads, toPublicUpload } from '../../../lib/db';
import { errorJson, getEnv, json } from '../../../lib/http';

const MAX_SIZE = 25 * 1024 * 1024;
const MAX_FILES_PER_CLIENT = 80;
const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  svg: 'image/svg+xml', pdf: 'application/pdf', ai: 'application/postscript', eps: 'application/postscript',
};
const QID = /^[a-z0-9-]{1,64}$/;

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').slice(-120) || 'file';
}

/** Private uploads into the app's object storage. Never public, never the Webflow media library. */
export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  const env = getEnv(locals);
  const config = await requireClient(env, params.slug, cookies);
  if (config instanceof Response) return config;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const qid = String(form?.get('qid') ?? '');
  if (!(file instanceof File)) return errorJson(400, 'No file received');
  if (!QID.test(qid)) return errorJson(400, 'Bad question id');
  if (file.size > MAX_SIZE) return errorJson(413, 'That file is over 25 MB. Try a smaller version, or text it to Evan.');
  if (file.size === 0) return errorJson(400, 'That file is empty.');
  const name = safeName(file.name);
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const contentType = TYPES[ext];
  if (!contentType) return errorJson(415, 'That file type isn\'t supported here. Images, PDF, SVG, AI and EPS all work.');
  const existing = await listUploads(env.DB, config.slug);
  if (existing.length >= MAX_FILES_PER_CLIENT) return errorJson(429, 'That\'s a lot of files! Text Evan and he\'ll share a folder instead.');

  const id = crypto.randomUUID();
  const key = `${config.slug}/${id}/${name}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType }, customMetadata: { slug: config.slug, qid, originalName: name } });
  await insertUpload(env.DB, { id, slug: config.slug, question_id: qid, r2_key: key, file_name: name, content_type: contentType, size: file.size });
  return json({ ok: true, upload: toPublicUpload({ id, slug: config.slug, question_id: qid, r2_key: key, file_name: name, content_type: contentType, size: file.size, uploaded_at: new Date().toISOString() }) });
};

export const DELETE: APIRoute = async ({ params, url, locals, cookies }) => {
  const env = getEnv(locals);
  const config = await requireClient(env, params.slug, cookies);
  if (config instanceof Response) return config;
  const id = url.searchParams.get('id') ?? '';
  const row = await getUpload(env.DB, id);
  if (!row || row.slug !== config.slug) return errorJson(404, 'Not found');
  await env.UPLOADS.delete(row.r2_key);
  await deleteUploadRow(env.DB, id);
  return json({ ok: true });
};
