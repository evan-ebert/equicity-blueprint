import type { APIRoute } from 'astro';
import { requireClient } from '../../../lib/guard';
import { getAnswers, getClientRow, listUploads, toPublicUpload } from '../../../lib/db';
import { getEnv, json } from '../../../lib/http';

export const GET: APIRoute = async ({ params, locals, cookies }) => {
  const env = getEnv(locals);
  const config = await requireClient(env, params.slug, cookies);
  if (config instanceof Response) return config;
  const [answers, uploads, row] = await Promise.all([getAnswers(env.DB, config.slug), listUploads(env.DB, config.slug), getClientRow(env.DB, config.slug)]);
  return json({ ok: true, answers, uploads: uploads.map(toPublicUpload), submittedAt: row?.submitted_at ?? null });
};
