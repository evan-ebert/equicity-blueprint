/**
 * Access for Equicity Blueprint. Clients get a per-client link plus a short code; Evan gets an admin password.
 * Codes are stored as salted PBKDF2 hashes. Sessions are HMAC-signed, HttpOnly cookies. No emails, ever.
 */

const enc = new TextEncoder();
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE_LENGTH = 6;
const PBKDF2_ITERATIONS = 100_000;
const CLIENT_SESSION_DAYS = 60;
const ADMIN_SESSION_DAYS = 14;

export class SetupError extends Error {}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Codes are forgiving: case, spaces and dashes don't matter. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export async function hashCode(code: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(normalizeCode(code)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: b64url(bits), salt: b64url(salt) };
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyCode(code: string, hash: string, salt: string): Promise<boolean> {
  const h = await hashCode(code, salt);
  return safeEqual(h.hash, hash);
}

function requireSecret(env: Env): string {
  const s = env.SESSION_SECRET;
  if (!s || s.length < 24) throw new SetupError('SESSION_SECRET is missing or too short. Add it in the app settings in Webflow.');
  return s;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

type SessionPayload = { s: string; exp: number };

export async function signSession(env: Env, subject: string, days: number): Promise<string> {
  const payload: SessionPayload = { s: subject, exp: Math.floor(Date.now() / 1000) + days * 86400 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(requireSecret(env), body)}`;
}

export async function readSession(env: Env, token: string | undefined, subject: string): Promise<boolean> {
  if (!token) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = await hmac(requireSecret(env), body);
  if (!safeEqual(sig, expected)) return false;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    return p.s === subject && p.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export const clientCookieName = (slug: string) => `bp_c_${slug.replace(/[^a-z0-9]/g, '_')}`;
export const ADMIN_COOKIE = 'bp_admin';

export function cookieOptions(base: string, days: number) {
  return { path: base, httpOnly: true, secure: true, sameSite: 'lax' as const, maxAge: days * 86400 };
}

export async function startClientSession(env: Env, slug: string) {
  return { token: await signSession(env, `client:${slug}`, CLIENT_SESSION_DAYS), days: CLIENT_SESSION_DAYS };
}

export async function hasClientSession(env: Env, slug: string, token: string | undefined) {
  return readSession(env, token, `client:${slug}`);
}

export async function startAdminSession(env: Env) {
  return { token: await signSession(env, 'admin', ADMIN_SESSION_DAYS), days: ADMIN_SESSION_DAYS };
}

export async function hasAdminSession(env: Env, token: string | undefined) {
  return readSession(env, token, 'admin');
}

export async function checkAdminPassword(env: Env, password: string): Promise<boolean> {
  const expected = env.ADMIN_PASSWORD;
  if (!expected || expected.length < 10) throw new SetupError('ADMIN_PASSWORD is missing or shorter than 10 characters. Add it in the app settings in Webflow.');
  const secret = requireSecret(env);
  // Compare HMACs so the comparison is constant-time regardless of length.
  return safeEqual(await hmac(secret, password), await hmac(secret, expected));
}

/** Simple fixed-window limiter in D1: 8 tries per 15 minutes per key. */
export async function allowAttempt(db: D1Database, key: string, max = 8, windowSeconds = 900): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('SELECT count, window_start FROM attempts WHERE key = ?').bind(key).first<{ count: number; window_start: number }>();
  if (!row || now - row.window_start > windowSeconds) {
    await db.prepare('INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start').bind(key, now).run();
    return true;
  }
  if (row.count >= max) return false;
  await db.prepare('UPDATE attempts SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}

export async function clearAttempts(db: D1Database, key: string) {
  await db.prepare('DELETE FROM attempts WHERE key = ?').bind(key).run();
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
