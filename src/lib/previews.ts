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

async function tryCapture(bucket: R2Bucket, slug: string, id: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(shotUrl(url), { redirect: 'follow', headers: { 'user-agent': 'EquicityBlueprint/1.0 (+https://equicityseo.com)' } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('jpeg')) return false;
    const body = await res.arrayBuffer();
    if (body.byteLength < 15_000) return false; // the "still generating" image is tiny
    await bucket.put(previewKey(slug, id), body, { httpMetadata: { contentType: 'image/jpeg' }, customMetadata: { url } });
    return true;
  } catch {
    return false;
  }
}

/** Capture every example that isn't saved yet (or all of them when `all`), in a few short rounds. */
export async function capturePreviews(bucket: R2Bucket, c: ClientConfig, all = false): Promise<{ ready: number; total: number }> {
  const have = new Set(all ? [] : await savedPreviewIds(bucket, c.slug));
  let todo = c.examples.filter((e) => !have.has(e.id));
  // Two short rounds keep the request well under Webflow Cloud's 20 second limit.
  for (let round = 0; round < 2 && todo.length; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, 6000));
    const done = await Promise.all(todo.map((e) => tryCapture(bucket, c.slug, e.id, e.url)));
    todo = todo.filter((_, i) => !done[i]);
  }
  return { ready: c.examples.length - todo.length, total: c.examples.length };
}
