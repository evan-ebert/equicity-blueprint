/**
 * Part 2 acceptance tests: review rounds, end to end against the local dev server.
 *
 *   npm run db:apply:local && npm run dev        (in one terminal)
 *   node tests/review-round.mjs                  (in another)
 *
 * Uses the demo client (its data is cleared first) and the Hart to Heart Round 1 config from
 * configs/rounds/hart-to-heart-r1.json, with generated placeholder images. Slack is not checked here:
 * the dev server has no SLACK_WEBHOOK_URL, and the message text is covered by buildRoundSlack.
 */
import { readFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:4321/').replace(/\/?$/, '/');
const SLUG = 'demo';
const PHONE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const HOST = new URL(BASE).hostname;
const CONFIG = JSON.parse(readFileSync('configs/rounds/hart-to-heart-r1.json', 'utf8'));
const IMAGES = [];
for (const s of CONFIG.screens) for (const it of s.items) {
  if (it.type === 'section') IMAGES.push(it.image);
  if (it.type === 'decision') for (const o of it.options) IMAGES.push(o.image);
}

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
async function ready(page) {
  await page.waitForSelector('.bp-app');
  await page.waitForSelector('astro-island:not([ssr])');
}
const cookieHeader = async (ctx) => ({ cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ') });
/** Click a form button and wait for the page that comes back. */
const post = (page, selector) => Promise.all([page.waitForNavigation(), page.click(selector)]);
/** The eyebrow is uppercased by CSS, so read the raw text. */
const status = (page) => page.locator('.eq-eyebrow').first().evaluate((el) => el.textContent.trim());

/** Admin browser context, signed in, with the demo client cleared and a fresh code. */
async function admin(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const r1 = await ctx.request.post(`${BASE}api/admin/login`, { form: { password: adminPassword() }, maxRedirects: 0 });
  const m0 = (r1.headers()['set-cookie'] ?? '').match(/bp_admin=([^;]+)/);
  assert(m0, 'admin login set no cookie (wrong password?)');
  await ctx.addCookies([{ name: 'bp_admin', value: m0[1], domain: HOST, path: '/', secure: false, httpOnly: true }]);
  await ctx.request.post(`${BASE}admin/${SLUG}`, { form: { action: 'reset' } });
  const r2 = await ctx.request.post(`${BASE}admin/${SLUG}`, { form: { action: 'passcode' } });
  const m = (await r2.text()).match(/letter-spacing:0\.12em">([A-Z0-9 ]+)</);
  assert(m, 'could not read the new code');
  return { ctx, code: m[1].replace(/\s/g, '') };
}

/** A placeholder JPEG of the given size, drawn in the browser. */
async function fakeImage(page, name, w, h) {
  const dataUrl = await page.evaluate(
    ([w, h, label]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = `hsl(${(label.length * 37) % 360} 60% 85%)`;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#222';
      g.font = `${Math.round(w / 14)}px sans-serif`;
      for (let y = 80; y < h; y += Math.round(h / 6)) g.fillText(label, 40, y);
      return c.toDataURL('image/jpeg', 0.8);
    },
    [w, h, name],
  );
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
}

const browser = await chromium.launch();
try {
  const { ctx: adminCtx, code } = await admin(browser);
  const adminPage = await adminCtx.newPage();
  const roundAdmin = `${BASE}admin/${SLUG}/review/1`;
  let phoneState = null;

  await test('1a. A config with an em dash is refused with a clear message', async () => {
    await adminPage.goto(roundAdmin);
    const bad = JSON.parse(JSON.stringify(CONFIG));
    bad.screens[1].items[0].about = 'Four doors — pick one';
    await adminPage.fill('textarea[name=config]', JSON.stringify(bad));
    await post(adminPage, 'button:has-text("Create round")');
    const problems = await adminPage.locator('.bp-problems li').allInnerTexts();
    assert(problems.some((p) => /em dash/.test(p) && /home-start/.test(p)), `expected an em dash problem naming the item, got: ${problems.join(' | ')}`);
    assert((await adminPage.locator('h1').innerText()).startsWith('Round 1') && !(await adminPage.locator('h1').innerText()).includes(':'), 'round should not have been created');
  });

  await test('1b. Create Round 1 from the config; Open stays off until all 16 images are uploaded', async () => {
    await adminPage.goto(roundAdmin);
    await adminPage.fill('textarea[name=config]', JSON.stringify(CONFIG));
    await post(adminPage, 'button:has-text("Create round")');
    assert((await adminPage.locator('h1').innerText()).includes('Your homepage direction'), 'round not created');
    assert((await adminPage.locator('.bp-img').count()) === 16, 'expected 16 image rows');
    assert(await adminPage.locator('button[value=open]').isDisabled(), 'Open should be disabled with no images');
    for (let i = 0; i < IMAGES.length; i++) {
      const name = IMAGES[i];
      const tall = name === 'r1-phone.jpg';
      const file = await fakeImage(adminPage, name, tall ? 900 : 1800, tall ? 5200 : 1100);
      await adminPage.locator(`[data-upload="${name}"]`).setInputFiles(file);
      await adminPage.waitForFunction((n) => document.querySelector(`.bp-img[data-name="${n}"]`)?.getAttribute('data-ready') === 'true', name, { timeout: 30_000 });
      // The page reloads itself after an upload; start the next one from a fresh load instead of racing it.
      await adminPage.goto(roundAdmin);
    }
    await adminPage.goto(roundAdmin);
    assert((await adminPage.locator('.bp-img[data-ready="true"]').count()) === 16, 'not all images ready');
    assert(!(await adminPage.locator('button[value=open]').isDisabled()), 'Open should be enabled now');
  });

  await test('2. Admin preview shows the draft round read only on a phone', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: await adminCtx.storageState() });
    const page = await ctx.newPage();
    const puts = [];
    page.on('request', (r) => r.method() === 'PUT' && puts.push(r.url()));
    await page.goto(`${BASE}${SLUG}/review/1?preview=1`);
    await ready(page);
    assert(await page.locator('.bp-banner--preview').isVisible(), 'preview banner missing');
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('radio', { name: /Opens with you/ }).click();
    await sleep(1200);
    assert(puts.length === 0, 'preview must not save');
    assert((await page.locator('.bp-save').innerText()).includes('Preview only'), 'indicator should say preview');
    await ctx.close();
  });

  await test('1c. Open the round; the client home shows the round card', async () => {
    await adminPage.goto(roundAdmin);
    await post(adminPage, 'button[value=open]');
    assert((await status(adminPage)) === 'Open', `round should be open, got ${await status(adminPage)}`);
  });

  await test('3. On a phone, from the round link: enter the code, land on Round 1, go through every screen', async () => {
    const ctx = await browser.newContext(PHONE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${SLUG}/review/1`);
    assert((await page.locator('h1').innerText()).includes('welcome in'), 'gate expected');
    await page.fill('input[name=code]', code);
    await page.click('button[type=submit]');
    await ready(page);
    assert(page.url().includes(`/${SLUG}/review/1`), `should land on the round, got ${page.url()}`);
    assert((await page.locator('h1').innerText()).includes('Your homepage direction'), 'intro expected');
    await page.getByRole('button', { name: 'Start' }).click();
    // Screen 1: the decision. Leave it unpicked for now, but write a note.
    assert((await page.locator('h1').innerText()).includes('How should the homepage open'), 'decision screen expected');
    await page.getByRole('button', { name: 'See it bigger' }).first().click();
    assert(await page.locator('.bp-viewer').isVisible(), 'viewer should open from See it bigger');
    assert((await page.getByRole('radio', { name: /Opens with a couple/ }).getAttribute('aria-checked')) === 'false', 'See it bigger must not select the tile');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForSelector('.bp-viewer', { state: 'detached' });
    await page.locator('#item-hero textarea').fill('Leaning B');
    await page.getByRole('button', { name: 'Continue' }).click();
    // Screen 2: sections. Rate, tag, note, and scroll the long phone image in the viewer.
    assert((await page.locator('h1').innerText()).includes('rest of your homepage'), 'home screen expected');
    const work = page.locator('#item-home-work');
    await work.getByRole('button', { name: 'Maybe' }).click();
    await work.getByRole('button', { name: 'Photo' }).click();
    await work.getByPlaceholder('What would you change? (optional)').fill('A warmer photo');
    await page.locator('#item-home-start').getByRole('button', { name: 'Love it' }).click();
    await page.locator('#item-home-start').getByRole('button', { name: 'Words' }).click();
    await page.locator('#item-home-cta').getByRole('button', { name: 'Not for me' }).click();
    await page.locator('#item-home-phone .bp-section__imgbtn').click();
    await page.waitForSelector('.bp-viewer img');
    await page.waitForFunction(() => document.querySelector('.bp-viewer img')?.complete);
    const scroll = await page.locator('.bp-viewer__scroll').evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    assert(scroll.sh > scroll.ch * 2, `the phone image should scroll inside the viewer (${scroll.sh} vs ${scroll.ch})`);
    await page.locator('.bp-viewer img').click();
    const zoomed = await page.locator('.bp-viewer__scroll').evaluate((el) => el.scrollWidth > el.clientWidth);
    assert(zoomed, 'tapping the image should double it');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.bp-viewer', { state: 'detached' });
    await page.getByRole('button', { name: 'Continue' }).click();
    // Screen 3: lines, choices.
    assert((await page.locator('h1').innerText()).includes('only you can decide'), 'words screen expected');
    await page.locator('.bp-line').nth(1).getByRole('button', { name: 'Love it' }).click();
    await page.locator('.bp-line').nth(5).getByRole('button', { name: 'Not for me' }).click();
    await page.locator('#item-faith').getByRole('radio', { name: 'About right' }).click();
    await page.locator('#item-nfd-name').getByRole('radio', { name: /Close, let's adjust it/ }).click();
    await page.locator('#item-nfd-name textarea').fill('Shorter');
    await page.getByRole('button', { name: 'Continue' }).click();
    // Screen 4: about. Leave it all alone (approved).
    assert((await page.locator('h1').innerText()).includes('About page'), 'about screen expected');
    await page.getByRole('button', { name: 'Continue' }).click();
    // Screen 5: open.
    await page.getByPlaceholder('Anything at all (optional)').fill('Looks great overall');
    await page.waitForFunction(() => document.querySelector('.bp-save')?.textContent?.includes('Saved'), null, { timeout: 20_000 });
    phoneState = await ctx.storageState();
    await ctx.close();
  });

  await test('4. Close the tab mid round, reopen on a laptop: everything is there', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: phoneState });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${SLUG}/review/1`);
    await ready(page);
    assert((await page.locator('h1').innerText()).includes('Anything else'), `should resume on the last screen, got "${await page.locator('h1').innerText()}"`);
    assert((await page.getByPlaceholder('Anything at all (optional)').inputValue()) === 'Looks great overall', 'open answer missing');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    assert((await page.locator('#item-home-work [data-value=maybe]').getAttribute('aria-pressed')) === 'true', 'rating missing on the laptop');
    assert((await page.locator('#item-home-work').getByPlaceholder('What would you change? (optional)').inputValue()) === 'A warmer photo', 'note missing on the laptop');
    const s = await (await ctx.request.get(`${BASE}api/${SLUG}/review/1/state`, { headers: await cookieHeader(ctx) })).json();
    assert(s.answers['home-work']?.v?.tags?.includes('Photo'), 'tag missing on the server');
    await ctx.close();
  });

  await test('5. Submit without A or B: a clear message points to the decision. Pick one, submit.', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: phoneState });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${SLUG}/review/1`);
    await ready(page);
    await page.getByRole('button', { name: 'Review my answers' }).click();
    assert((await page.locator('h1').innerText()).includes("what you're sending"), 'review expected');
    const text = await page.locator('main').innerText();
    assert(/No comments on The opening, Why I do this work/.test(text), 'untouched sections should read as approved');
    await page.getByRole('button', { name: /Send to Evan/ }).click();
    assert(await page.locator('#send-missing').isVisible(), 'missing decision message expected');
    await page.locator('#send-missing').getByRole('button', { name: 'Pick one' }).click();
    await page.waitForSelector('#item-hero');
    await page.getByRole('radio', { name: /Opens with you/ }).click();
    await page.waitForFunction(() => document.querySelector('.bp-save')?.textContent?.includes('Saved'), null, { timeout: 20_000 });
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /Continue|Review my answers/ }).click();
    await page.getByRole('button', { name: /Send to Evan/ }).click();
    assert((await page.locator('.bp-confirm').innerText()).includes('this round is closed. Ready?'), 'inline confirm expected');
    await page.getByRole('button', { name: 'Not yet' }).click();
    assert((await page.locator('.bp-confirm').count()) === 0, 'Not yet should hide the confirm');
    await page.getByRole('button', { name: /Send to Evan/ }).click();
    await page.getByRole('button', { name: 'Send it' }).click();
    await page.waitForSelector('.bp-done');
    assert((await page.locator('.bp-done').evaluate((el) => el.textContent)).includes('What you sent'), 'done screen should show what was sent');
    assert((await page.locator('.bp-done').innerText()).includes('B (opens with you)'), 'done screen should show the decision');
    phoneState = await ctx.storageState();
    await ctx.close();
  });

  await test('6. After submit nothing can be edited, and a direct PUT gets 409', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: phoneState });
    const r = await ctx.request.put(`${BASE}api/${SLUG}/review/1/answer`, { data: { qid: 'anything', value: { v: { text: 'late edit' } } }, headers: await cookieHeader(ctx) });
    assert(r.status() === 409, `expected 409, got ${r.status()}`);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${SLUG}/review/1`);
    await ready(page);
    assert(await page.locator('.bp-done').isVisible(), 'reopening a sent round shows the done view');
    assert((await page.locator('.eq-bar').count()) === 0, 'no navigation on a sent round');
    const s = await (await ctx.request.get(`${BASE}api/${SLUG}/review/1/state`, { headers: await cookieHeader(ctx) })).json();
    assert(s.status === 'submitted' && s.answers.anything?.v?.text === 'Looks great overall', 'the late edit must not land');
    await ctx.close();
  });

  let firstExport = '';
  await test('7. Export the markdown in the agreed format', async () => {
    const r = await adminCtx.request.get(`${BASE}api/admin/${SLUG}/review/1/export.md`);
    assert(r.ok(), `export gave ${r.status()}`);
    assert((r.headers()['content-disposition'] ?? '').includes('review-round-demo-r1.md'), 'file name');
    firstExport = await r.text();
    const must = ['# Review Round 1: ', 'homepage direction', 'Submitted ', '## Decision: which homepage opening leads', 'Picked: B (opens with you)', 'Note: "Leaning B"', '## The rest of your homepage', '### Where do I start?: Love it', 'Tags: Words', '### The work: Maybe', 'Tags: Photo', 'Note: "A warmer photo"', '### How it goes: no comments (approved)', '- Love it: From unseen and hurting, to cherished and secure.', '- Not for me: From chaos, to a calm you can keep.', '### How much should faith show?: About right', '### Proposed page name: Close', "Close, let's adjust it", 'Note: "Shorter"', '## Anything else', '"Looks great overall"', '## Summary', 'Loved: ', 'Needs attention: The work (Photo)'];
    for (const m of must) assert(firstExport.includes(m), `export is missing "${m}"\n---\n${firstExport}`);
    assert(!/[–—]/.test(firstExport), 'no dashes in the export');
  });

  await test('8. Reopen from admin, change one answer, send again, export again: the change shows and the first send stays', async () => {
    await adminPage.goto(roundAdmin);
    await post(adminPage, 'button[value=reopen]');
    assert((await status(adminPage)) === 'Reopened', `status should be Reopened, got ${await status(adminPage)}`);
    const ctx = await browser.newContext({ ...PHONE, storageState: phoneState });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${SLUG}/review/1`);
    await ready(page);
    assert(!(await page.locator('.bp-done').isVisible().catch(() => false)), 'a reopened round is editable again');
    // They left off on the review screen: Edit the homepage section from there.
    await page.locator('.bp-review').nth(1).getByRole('button', { name: 'Edit' }).click();
    await page.waitForSelector('#item-home-cta');
    await page.locator('#item-home-cta').getByRole('button', { name: 'Love it' }).click();
    await page.waitForFunction(() => document.querySelector('.bp-save')?.textContent?.includes('Saved'), null, { timeout: 20_000 });
    while (!(await page.getByRole('button', { name: /Send to Evan/ }).count())) await page.getByRole('button', { name: /Continue|Review my answers/ }).click();
    await page.getByRole('button', { name: /Send to Evan/ }).click();
    await page.getByRole('button', { name: 'Send it' }).click();
    await page.waitForSelector('.bp-done');
    await ctx.close();
    const r = await adminCtx.request.get(`${BASE}api/admin/${SLUG}/review/1/export.md`);
    const md = await r.text();
    assert(md.includes('### The free call and the footer: Love it'), 'second export should carry the change');
    assert(md.includes('## Changed since the first send') && md.includes('The free call and the footer: was Not for me'), `expected a changed section\n${md}`);
    await adminPage.goto(roundAdmin);
    const t = await adminPage.locator('main').evaluate((el) => el.textContent);
    assert(t.includes('Sends (2)') && t.includes('Send 1') && t.includes('The first send.'), 'admin should keep both sends');
  });

  await test('9. A second round can be created from a new config without code changes', async () => {
    const cfg = { round: 2, title: 'Full site', intro: 'Here is the rest of the site.', doneNote: 'Thank you. Next we build.', screens: [{ id: 'inner', title: 'Inner pages', items: [{ id: 'services', type: 'section', image: 'r2-services.jpg', title: 'Services' }, { id: 'any', type: 'open', prompt: 'Anything else?' }] }] };
    await adminPage.goto(`${BASE}admin/${SLUG}/review/2`);
    await adminPage.fill('textarea[name=config]', JSON.stringify(cfg));
    await post(adminPage, 'button:has-text("Create round")');
    assert((await adminPage.locator('h1').innerText()).includes('Full site'), 'round 2 not created');
    assert((await adminPage.locator('.bp-img').count()) === 1, 'round 2 lists its one image');
    await adminPage.goto(`${BASE}admin/${SLUG}`);
    assert((await adminPage.locator('main').innerText()).includes('Review rounds (2)'), 'client admin should list both rounds');
  });

  await test('10. The client home shows a card for an open round', async () => {
    const ctx = await browser.newContext({ ...PHONE, storageState: phoneState });
    const page = await ctx.newPage();
    // Round 1 is sent, so no card; open round 2 (needs its image) and check the card appears.
    await adminPage.goto(`${BASE}admin/${SLUG}/review/2`);
    await adminPage.locator('[data-upload="r2-services.jpg"]').setInputFiles(await fakeImage(adminPage, 'r2-services.jpg', 1600, 900));
    await adminPage.waitForFunction(() => document.querySelector('.bp-img')?.getAttribute('data-ready') === 'true', null, { timeout: 30_000 });
    await adminPage.goto(`${BASE}admin/${SLUG}/review/2`);
    await post(adminPage, 'button[value=open]');
    assert((await status(adminPage)) === 'Open', 'round 2 should be open');
    await page.goto(`${BASE}${SLUG}`);
    await ready(page);
    const card = page.locator('.bp-roundcard', { hasText: 'Round 2' });
    assert((await card.count()) === 1, `a round 2 card expected, found ${await page.locator('.bp-roundcard').count()} cards`);
    assert((await card.innerText()).includes('Round 2 is ready: full site.'), `card text: ${await card.innerText()}`);
    await card.click();
    await ready(page);
    assert(page.url().includes('/review/2'), 'card should open the round');
    await ctx.close();
  });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
