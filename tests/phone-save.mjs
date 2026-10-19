/**
 * Part 1 acceptance tests: save and resume on a phone (390 x 844, touch, mobile viewport).
 *
 * Run against a local dev server:
 *   npm run db:apply:local && npm run dev        (in one terminal)
 *   node tests/phone-save.mjs                    (in another)
 *
 * Needs the `playwright` package (npm i -D playwright, or a global install) and Chromium.
 * Reads ADMIN_PASSWORD from .dev.vars. BASE_URL defaults to http://127.0.0.1:4321/.
 * The demo client is used, and its answers are cleared first.
 */
import { readFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:4321/').replace(/\/?$/, '/');
const SLUG = process.env.SLUG ?? 'demo';
const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const m = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_PASSWORD=(.*)$/m);
  if (!m) throw new Error('Set ADMIN_PASSWORD or add it to .dev.vars');
  return m[1].trim().replace(/^"|"$/g, '');
}

const results = [];
async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (e) {
    results.push({ name, ok: false, error: e });
    console.log(`FAIL  ${name}\n      ${e?.stack ?? e}`);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Admin: sign in, clear the demo client, set a fresh code and return it. */
async function freshCode(browser) {
  const ctx = await browser.newContext();
  const r1 = await ctx.request.post(`${BASE}api/admin/login`, { form: { password: adminPassword() }, maxRedirects: 0 });
  assert(r1.status() === 303, `admin login gave ${r1.status()}`);
  // Session cookies are Secure. Over plain http the Node side would drop them, so pin the cookie by hand.
  const m0 = (r1.headers()['set-cookie'] ?? '').match(/bp_admin=([^;]+)/);
  assert(m0, 'admin login set no cookie (wrong password?)');
  await ctx.addCookies([{ name: 'bp_admin', value: m0[1], domain: new URL(BASE).hostname, path: '/', secure: false, httpOnly: true }]);
  if (SLUG === 'demo') await ctx.request.post(`${BASE}admin/${SLUG}`, { form: { action: 'reset' } });
  const r2 = await ctx.request.post(`${BASE}admin/${SLUG}`, { form: { action: 'passcode' } });
  const html = await r2.text();
  const m = html.match(/letter-spacing:0\.12em">([A-Z0-9 ]+)</);
  assert(m, 'could not read the new code from the admin page');
  await ctx.close();
  return m[1].replace(/\s/g, '');
}

/** A "laptop": the same client session used straight against the API (cookie sent by hand, see freshCode). */
function laptop(ctx) {
  const headers = async () => ({ cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ') });
  const put = async (qid, value) => {
    const r = await ctx.request.put(`${BASE}api/${SLUG}/answer`, { data: { qid, value }, headers: await headers() });
    assert(r.ok(), `laptop save of ${qid} gave ${r.status()}`);
  };
  const state = async () => (await ctx.request.get(`${BASE}api/${SLUG}/state`, { headers: await headers() })).json();
  return { put, state };
}

/** The app is server rendered, so wait for React to take over before tapping anything. */
async function ready(page) {
  await page.waitForSelector('.bp-app');
  await page.waitForSelector('astro-island:not([ssr])');
}

async function signIn(page, code) {
  await page.goto(`${BASE}${SLUG}`);
  await page.fill('input[name=code]', code);
  await page.click('button[type=submit]');
  await ready(page);
}

async function open(page) {
  await page.goto(`${BASE}${SLUG}`);
  await ready(page);
}

const saveText = (page) => page.locator('.bp-save').innerText();
async function waitSave(page, text, timeout = 45_000) {
  await page.waitForFunction((t) => document.querySelector('.bp-save')?.textContent?.includes(t), text, { timeout });
}

/** Pretend the tab went to the background and came back (iOS restores from memory, so no reload happens). */
async function backgroundThenReturn(page, { persisted = false, hiddenFor = 0 } = {}) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  if (hiddenFor) await sleep(hiddenFor);
  await page.evaluate((p) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    if (p) window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, persisted);
}

const browser = await chromium.launch();
try {
  const code = await freshCode(browser);
  let state = null; // storageState carried between "closed" and "reopened" tabs

  await test('1. Answer on the phone, close the tab, reopen: every answer is there', async () => {
    const ctx = await browser.newContext(PHONE);
    const page = await ctx.newPage();
    await signIn(page, code);
    await page.getByRole('button', { name: "Let's start" }).click();
    await page.getByRole('radio', { name: 'Yes' }).click();
    await page.getByPlaceholder(/555|\(/).first().fill('206 555 0100');
    await waitSave(page, 'Saved');
    state = await ctx.storageState();
    await ctx.close();

    const ctx2 = await browser.newContext({ ...PHONE, storageState: state });
    const page2 = await ctx2.newPage();
    await open(page2);
    assert((await page2.getByRole('radio', { name: 'Yes' }).getAttribute('aria-checked')) === 'true', 'the Yes answer was lost');
    assert((await page2.getByPlaceholder(/555|\(/).first().inputValue()) === '206 555 0100', 'the phone number was lost');
    state = await ctx2.storageState();
    await ctx2.close();
  });

  await test('2. Answer a chapter on the laptop, open on the phone: answers show and the chapter is done', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: state });
    const lap = laptop(ctx);
    await lap.put('words-like', { v: 'Steady and kind' });
    await lap.put('weighs-in', { v: { choice: 'just-me' } });
    await lap.put('_visited', { v: ['welcome/basics', 'feel/feel'] });
    await lap.put('_pos', { v: 'feel/feel' });
    const page = await ctx.newPage();
    await open(page);
    assert((await page.locator('.eq-seg--done').count()) >= 2, 'chapters 1 and 2 should show as done');
    // The saved position is the feel screen, so the app lands there with no tap.
    assert((await page.getByPlaceholder('Steady, honest, warm').inputValue()) === 'Steady and kind', "the laptop's answer did not show");
    state = await ctx.storageState();
    await ctx.close();
  });

  await test('3. Phone tab already open; laptop answers; back to the phone tab: the answer appears without a reload', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: state });
    const page = await ctx.newPage();
    await open(page);
    const lap = laptop(ctx);
    await lap.put('words-avoid', { v: 'Clinical' });
    await backgroundThenReturn(page, { persisted: true });
    await page.waitForFunction(() => document.querySelector('input[placeholder="Anything that feels off"]')?.value === 'Clinical', null, { timeout: 15_000 });
    await ctx.close();
  });

  await test('4. Answer, lock the phone for a while, unlock, keep going: nothing lost or duplicated', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: state });
    const page = await ctx.newPage();
    await open(page);
    await page.getByPlaceholder('Steady, honest, warm').fill('Steady, kind, clear');
    await waitSave(page, 'Saved');
    // Hidden for longer than the 30 second threshold, so coming back refetches from the server.
    await backgroundThenReturn(page, { hiddenFor: 31_000 });
    await sleep(1500);
    assert((await page.getByPlaceholder('Steady, honest, warm').inputValue()) === 'Steady, kind, clear', 'answer changed after the refetch');
    const s = await laptop(ctx).state();
    assert(s.answers['words-like']?.v === 'Steady, kind, clear', 'server lost the answer');
    await page.getByPlaceholder('Anything that feels off').fill('Clinical, cold');
    await waitSave(page, 'Saved');
    state = await ctx.storageState();
    await ctx.close();
  });

  await test('5. Airplane mode: "Not saved yet. We\'ll keep trying." then both save on their own once back online', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: state });
    const page = await ctx.newPage();
    await open(page);
    await ctx.setOffline(true);
    await page.getByPlaceholder('Steady, honest, warm').fill('Offline one');
    await page.getByPlaceholder('Anything that feels off').fill('Offline two');
    await waitSave(page, 'Not saved yet', 20_000);
    assert((await saveText(page)).includes("We'll keep trying"), `expected the full retry message, got "${await saveText(page)}"`);
    await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('bp:demo:pending') ?? '{"items":{}}').items).length === 2, null, { timeout: 10_000 }).catch(() => {});
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitSave(page, 'Saved', 60_000);
    const s = await laptop(ctx).state();
    assert(s.answers['words-like']?.v === 'Offline one' && s.answers['words-avoid']?.v === 'Offline two', 'the offline answers did not reach the server');
    state = await ctx.storageState();
    await ctx.close();
  });

  await test('6. Unsent answer queued on the phone; laptop changes it later; reopen the phone: the laptop\'s newer answer stays', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: state });
    const page = await ctx.newPage();
    await open(page);
    await ctx.setOffline(true);
    await page.getByPlaceholder('Steady, honest, warm').fill('Phone, stale');
    await waitSave(page, 'Not saved yet', 20_000);
    const queued = await ctx.storageState(); // the tab closes with the answer still queued
    await ctx.close();
    await sleep(1500); // D1 timestamps have one second resolution
    const lapCtx = await browser.newContext({ storageState: state });
    await laptop(lapCtx).put('words-like', { v: 'Laptop, newer' });
    await lapCtx.close();
    await sleep(500);
    const ctx2 = await browser.newContext({ ...PHONE, storageState: queued });
    const page2 = await ctx2.newPage();
    await open(page2);
    await sleep(2500);
    assert((await page2.getByPlaceholder('Steady, honest, warm').inputValue()) === 'Laptop, newer', 'the stale phone answer overwrote the laptop');
    const s = await laptop(ctx2).state();
    assert(s.answers['words-like']?.v === 'Laptop, newer', 'the server was rolled back to the stale answer');
    state = await ctx2.storageState();
    await ctx2.close();
  });

  await test('7. Navigate away and back (Safari swipe): answers stay correct', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: state });
    const page = await ctx.newPage();
    await open(page);
    await page.goto('about:blank');
    await page.goBack();
    await ready(page);
    await backgroundThenReturn(page, { persisted: true });
    await sleep(1500);
    assert((await page.getByPlaceholder('Steady, honest, warm').inputValue()) === 'Laptop, newer', 'answer wrong after going back');
    await ctx.close();
  });

  await test('8. On a 375 px wide screen the save state is visible at all times', async () => {
    const ctx = await browser.newContext({ ...PHONE, viewport: { width: 375, height: 667 }, storageState: state });
    const page = await ctx.newPage();
    await open(page);
    const visible = async () => {
      const box = await page.locator('.bp-save').boundingBox();
      const text = (await saveText(page)).trim();
      assert(box && box.width > 20 && box.height > 10, 'save indicator has no size');
      assert(box.x + box.width <= 375, 'save indicator overflows the screen');
      assert(text.length > 0, 'save indicator is empty');
      return text;
    };
    assert((await visible()) === 'Autosave on', 'idle state missing');
    await ctx.setOffline(true);
    await page.getByPlaceholder('Steady, honest, warm').fill('Narrow');
    await waitSave(page, 'Not saved yet', 20_000);
    await visible();
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await waitSave(page, 'Saved', 60_000);
    assert((await visible()) === 'Saved', 'saved state missing');
    await ctx.close();
  });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
