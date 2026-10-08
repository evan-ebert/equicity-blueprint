/**
 * Example-site screenshots, saved in the app's private storage so they load instantly for the client.
 * Captured on demand from Evan's admin page through the WordPress mShots service, which renders a site
 * the first time it's asked and returns the finished JPEG on later requests.
 */
import type { ClientConfig } from './config';

export const previewKey = (slug: string, id: string) => `examples/${slug}/${id}.jpg`;

/** Ids of the examples that already have a saved screenshot. */
export async function savedPreviewIds(bucket: R2Bucket, slug: string): Promise<string[]> {
  const list = await bucket.list({ prefix: `examples/${slug}/` });
  return list.objects.map((o) => o.key.split('/').pop()!.replace(/\.jpg$/, ''));
}

const shotUrl = (url: string) => `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1440&h=1080`;

const UA = { 'user-agent': 'EquicityBlueprint/1.0 (+https://equicityseo.com)' };

async function store(bucket: R2Bucket, slug: string, id: string, url: string, res: Response, source: string): Promise<boolean> {
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !/image\/(jpeg|png|webp)/.test(type)) return false;
  const body = await res.arrayBuffer();
  if (body.byteLength < 15_000) return false; // "still generating" placeholders are tiny
  await bucket.put(previewKey(slug, id), body, { httpMetadata: { contentType: type.split(';')[0] }, customMetadata: { url, source } });
  return true;
}

/** WordPress mShots: renders on the first request, returns the finished JPEG on later ones. */
async function tryMshots(bucket: R2Bucket, slug: string, id: string, url: string): Promise<boolean> {
  try {
    return await store(bucket, slug, id, url, await fetch(shotUrl(url), { redirect: 'follow', headers: UA }), 'mshots');
  } catch {
    return false;
  }
}

/** Microlink, a second screenshot service (free tier, limited per day) for sites mShots can't render. */
async function tryMicrolink(bucket: R2Bucket, slug: string, id: string, url: string): Promise<boolean> {
  try {
    const api = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&viewport.width=1440&viewport.height=1080`;
    const res = await fetch(api, { headers: UA });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string; data?: { screenshot?: { url?: string } } };
    const shot = data.data?.screenshot?.url;
    if (data.status !== 'success' || !shot) return false;
    return await store(bucket, slug, id, url, await fetch(shot, { headers: UA }), 'microlink');
  } catch {
    return false;
  }
}

/** Evan's own screenshot, uploaded from admin. */
export async function savePreviewUpload(bucket: R2Bucket, slug: string, id: string, file: File): Promise<string | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return 'Use a JPG, PNG or WebP screenshot.';
  if (file.size > 10 * 1024 * 1024) return 'That screenshot is over 10 MB.';
  await bucket.put(previewKey(slug, id), await file.arrayBuffer(), { httpMetadata: { contentType: file.type }, customMetadata: { source: 'upload' } });
  return null;
}

export async function removePreview(bucket: R2Bucket, slug: string, id: string) {
  await bucket.delete(previewKey(slug, id));
}

/** Capture every example that isn't saved yet (or all of them when `all`), in a few short rounds. */
export async function capturePreviews(bucket: R2Bucket, c: ClientConfig, all = false): Promise<{ ready: number; total: number }> {
  const have = new Set(all ? [] : await savedPreviewIds(bucket, c.slug));
  let todo = c.examples.filter((e) => !e.image && !have.has(e.id));
  // Two short rounds keep the request well under Webflow Cloud's 20 second limit.
  for (let round = 0; round < 2 && todo.length; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 6000));
    const done = await Promise.all(todo.map(async (e) => (await tryMshots(bucket, c.slug, e.id, e.url)) || (round === 1 && (await tryMicrolink(bucket, c.slug, e.id, e.url)))));
    todo = todo.filter((_, i) => !done[i]);
  }
  return { ready: c.examples.length - todo.length, total: c.examples.length };
}
