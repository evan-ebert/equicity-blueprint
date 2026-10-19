# Blueprint Build Spec: Phone Fix and Review Rounds

For a Claude Code session working in the `equicity-blueprint` repo. Written October 18, 2026 from the Hart to Heart project, then revised the same evening against the live codebase so nothing gets built twice. Builds on the original build brief (`docs/brief.md`, sections 15 to 17).

**Target:** both parts live by end of day Monday, October 19, so Ernest Hart's Round 1 review link goes out Tuesday morning, October 20. Build in this order. Part 1 ships before any client opens a review round.

---

## Start here

- **Repo:** `github.com/evan-ebert/equicity-blueprint`, branch `main`. Work only in this repo. Never touch any other repository (House Dressed in particular).
- **Deploy:** pushing to `main` builds and deploys on Webflow Cloud (app "Equicity Blueprint", mounted at `/blueprint` on equicityseo.com). SQL files in `migrations/` apply automatically on deploy. Webflow runs `astro build` only and sets `base` from the mount path, so never set `base` in `astro.config.mjs`. Every link and fetch goes through `BASE` / `withBase()` from `src/lib/http.ts`.
- **Local dev:** `npm install`, `npm run db:apply:local`, a git-ignored `.dev.vars` with `SESSION_SECRET` and `ADMIN_PASSWORD`, then `npm run dev` (app at `http://127.0.0.1:4321/<slug>`). `npm run check` runs the copy lint plus type check. Playwright with Chromium is available for phone-size tests (`is_mobile`, 390 x 844).
- **Commits:** author `Evan Ebert <evan@equicityseo.com>`.
- **Hard rules (unchanged):** never ask a client for a password anywhere; the app never emails a client; client copy is warm and direct with no em dashes, no en dashes and no pressure language; mobile first; answers and uploads stay private (never Webflow CMS, never the Webflow media library, `noindex` on every response); config driven.

### What already exists. Reuse it, don't rebuild it.

| Need | Already in the code |
| --- | --- |
| Passcode gate, sessions | `src/lib/auth.ts` (PBKDF2 codes, HMAC-signed HttpOnly cookies `bp_c_<slug>` at path `BASE`, Secure, SameSite=Lax, 60 days), `src/pages/api/[slug]/login.ts`, `src/lib/guard.ts` (`requireClient`, `requireAdmin`) |
| Autosave engine | `src/components/App.tsx`: per-answer `PUT api/<slug>/answer`, debounced queue, retry with backoff, unsent answers kept in `localStorage`, `keepalive` flush on `pagehide` and `visibilitychange`, "Saving... / Saved / Will save in a moment" indicator |
| Server load of answers | `src/pages/[slug]/index.astro` renders the app with answers read from D1 on every request. `GET api/<slug>/state` also returns answers, uploads and `submittedAt`. `getAnswersUpdatedAt()` in `src/lib/db.ts` returns per-question timestamps. |
| Rating trio, tags, text boxes | `src/components/questions.tsx`: `RATES` (Love it / Maybe / Not for me, `eq-rate` buttons), `Chip`, `TextBox` (debounced save, password guard), `Uploader` |
| Equicity shell and motion | `src/components/App.tsx` (TopBar, chapter menu, toast, "Chapter done" cheer, review and done screens), `src/styles/*.css`, `src/components/confetti.ts`, `MarkerCircle` in `icons.tsx` |
| Private images in R2 | `src/lib/previews.ts` and `src/pages/api/[slug]/preview/[id].ts`: R2 bucket `UPLOADS`, served only to the signed-in client or admin. Copy this pattern for round images. |
| Admin | `src/pages/admin/index.astro`, `src/pages/admin/[slug].astro` (form-post actions, read-only **Preview** via `?preview=1` with an admin session) |
| Send history | `submissions` table (`migrations/0002_submissions.sql`): a copy of every answer on each Send, with a diff in admin |
| Notifications | `src/lib/notify.ts`: Slack incoming webhook (`SLACK_WEBHOOK_URL`) to #blueprint |
| Security | `src/middleware.ts`: CSP, `noindex`, and a proxy-aware same-origin check. Astro's built-in `checkOrigin` is off on purpose (Webflow's proxy breaks it). Webflow Cloud overrides `Cache-Control` to `private, no-cache`, so don't rely on `no-store` reaching the browser. |
| Copy lint | `scripts/copy-rules.mjs` fails the build on em or en dashes in `src/` and `configs/`. Runtime-uploaded configs are not covered, see Part 2. |

---

## Context

Ernest Hart (Hart to Heart Consulting) was the first client through Blueprint. He finished it October 14 and the brief was excellent. On the results call he reported one problem:

> "The phone version seemed like it would be the best way because it was really phone friendly, but it wasn't saving after each section. So when I came back to it, it would be like, I already did these sections, and then I'd do them again. Then I went, wait a minute, why don't I get on the laptop. The laptop version already saved the answers that I thought were gone from the phone."

So answers did reach the server. The phone didn't show them when he came back, and he redid work. He'll do his review round on his phone, so this has to be fixed first.

Next, Blueprint gets a second mode: review rounds. A review round is how a client gives feedback on a design: one decision, then a reaction on each section of each page, then submit once. It replaces scattered emails and memos with one structured batch, and it backs the agreement's "two rounds included" with a real submit button.

---

## Part 1: Fix save and resume on phones

### Step 0: Look at the evidence first (5 minutes)

In admin, open Hart to Heart and read **History**. Count the "Signed in" events and their times.

- **Many sign-ins on different days:** his phone kept losing its session. The likely cause is opening the link inside an email app's built-in browser, which keeps its own cookies and gets cleared. Answers still load after he signs in again, but what he saw first was the code screen and possibly an old copy of the page.
- **One or two sign-ins:** the session held. Focus on items 1 to 3 below.

Note what you find in the commit message. Neither case changes the fixes below.

### What review of the code found

The server is already the source of truth on a fresh page load. The gaps are what happens when a phone comes back to a page it already had open, or recovers from a bad connection:

1. **No refetch when the tab comes back.** The app loads answers once, when the page renders. iOS Safari often restores a backgrounded tab from memory (`pageshow` with `event.persisted`, or simply a tab that was never reloaded), so the phone keeps showing whatever it had, while the laptop's answers sit on the server. There is no listener that refetches. **This is the most likely cause.**
2. **Old unsent answers can overwrite newer ones.** On load, anything left in `localStorage` (key `bp:<slug>:pending`, kept up to 14 days) is applied over the server's answers and re-sent, with no check of which is newer. A phone that queued an answer and then sat for days can roll back what the client later changed on a laptop.
3. **A hung save blocks every later save.** `fetch` has no timeout. If one request hangs on a weak signal, `inflight` stays true and nothing else saves until the page is closed. The indicator sits on "Saving..." the whole time.
4. **The save indicator is hidden on small phones.** `src/styles/app.css` hides `.bp-save` below 380 px wide (iPhone SE, mini and other 375 px screens), so those clients never see "Saved" or a failure.

### What to build

- **Refetch from the server whenever the client comes back.** On `pageshow` with `event.persisted`, and on `visibilitychange` to visible after the page was hidden for more than 30 seconds, call `GET api/<slug>/state` and merge. Server answers win, except for answers still waiting in this device's queue that are newer than the server's copy.
- **Timestamp the local queue.** Store each queued answer with the time it was set, and have `GET api/<slug>/state` return `updatedAt` per question (`getAnswersUpdatedAt()` already exists). On load and on refetch, drop any queued answer older than the server's `updatedAt` for that question. Cut queue retention from 14 days to 48 hours.
- **Time out every save.** Abort a save after 12 seconds (`AbortController`), count it as a failure, and keep the retry with backoff. A failure must never leave `inflight` stuck.
- **A save indicator that's always visible.** Show it at every width (icon only below 380 px if space is tight). States: "Saving..." while a request is in flight, "Saved" only after the server confirms, and on failure "Not saved yet. We'll keep trying." It flips to "Saved" by itself once the queue empties. The indicator text has to be readable on a phone, not just an icon.
- **Resume where they left off.** This already works through the saved position (`_pos`) and the passed screens (`_visited`). Keep both, and make sure the refetch also updates the position and the chapter pills.
- **Pull the save engine into a shared hook.** Move the queue, flush, refetch and indicator out of `App.tsx` into `src/components/autosave.ts` (for example `useAutosave({ saveUrl, stateUrl, slug })`). Discovery uses it now, and review rounds in Part 2 use it with their own URLs. Don't write a second save engine.

### Acceptance tests

Run on a real iPhone in Safari and a real Android phone in Chrome. Also run them at 390 x 844 in Playwright and commit that script under `tests/` so it can be rerun.

1. Answer half a chapter on the phone. Close the tab. Reopen the link. Every answer is there.
2. Answer a chapter on the laptop. Open the link on the phone. Those answers show, and the chapter shows as done.
3. With the phone's tab already open from earlier, answer a question on the laptop, then switch back to the phone tab. The laptop's answer appears without a reload.
4. Answer on the phone, lock it for 10 minutes, unlock, keep going. Nothing lost, nothing duplicated.
5. Put the phone in airplane mode and answer two questions. The indicator says "Not saved yet. We'll keep trying." Turn airplane mode off. Both save with no action from the client, and the indicator says "Saved."
6. Leave an unsent answer queued on the phone (airplane mode, then close the tab). Change the same answer on the laptop. Reopen on the phone with signal. The laptop's newer answer stays.
7. Swipe back and forward between chapters in Safari. Answers stay correct.
8. On a 375 px wide screen, the save state is visible at all times.

---

## Part 2: Review rounds

### What a review round is

A set of screens inside a client's existing Blueprint, defined by a config. Same link, same passcode, same Equicity shell. A client can have several rounds over a project (Round 1 homepage direction, Round 2 full site, and so on). Each round opens, the client goes through it, submits once, and it locks.

- **Route:** `/blueprint/<client slug>/review/<round number>`, for example `/blueprint/hart-to-heart/review/1`. Same passcode gate and session as the discovery chapters.
- **Sign-in keeps the destination.** Today `api/[slug]/login.ts` always redirects to `<slug>`. Add a `next` field to the gate form, and accept it only when it's a path inside the same client (`<slug>` or `<slug>/review/<n>`). That way the round link in Evan's email lands on the round after the code is entered.
- **Round card.** When a round is open, the client's Blueprint home (`/<slug>`, which shows the welcome or resume screen and, for a client who already sent discovery, the review screen) shows a card at the top: "Round 1 is ready: your homepage direction." Tapping it opens the round.
- **No round counter.** Rounds are numbered, but the app doesn't count them against the two included in the agreement.

### Item types

Every round is a list of screens, and each screen is a list of items. Five item types cover everything:

1. **decision:** pick one of 2 to 4 image options. Big tiles, each with an image, a label and a one-line description. Tapping the tile selects it. A separate "See it bigger" button on each tile opens the full-screen viewer, so selecting and viewing never fight over the same tap. Optional note. Can be marked required.
2. **section:** one image of one section of a page, a title and an optional short "what this is" line. Tapping the image opens the viewer. Controls: Love it / Maybe / Not for me (reuse `RATES` and the `eq-rate` styles), optional tags (multi-select chips: Photo, Words, Layout, Colors) shown once a rating is picked, and an optional "What would you change?" text field.
3. **lines:** a list of short text lines, each rated Love it / Maybe / Not for me, plus one optional note for the whole list. Used for headlines and taglines.
4. **choice:** one question with 2 to 4 text options (single select) and an optional note.
5. **open:** a single text field with a prompt. Always optional.

Every text field carries the same helper line: "Or text Evan a voice memo, that works too." (Use `ownerName` from the client config, not a hard-coded name.) Reuse `TextBox`, which already saves on a pause and refuses to save anything that looks like a password.

### Screens and flow

1. **Intro.** A short note from Evan (from the round config), what this round is, about how long it takes, the due date ("Anytime before Thursday, October 22 is perfect."), and "Saves as you go." One button: Start.
2. **Content screens** from config, in order. Progress by screen at the top, using the same top bar and pills as the chapters. The screen fade and the "done" cheer can be reused as is.
3. **Review.** A summary of every answer, grouped by screen, each with an Edit link. Sections left unrated are listed as "No comments, so we'll treat these as approved." The client can go back and rate them.
4. **Submit.** One button: "Send to Evan." Tapping it shows a one-line confirm in the page, no browser dialogs: "Once you send this, this round is closed. Ready?" with "Send it" and "Not yet."
5. **Done.** Thank you, what happens next (`doneNote` from config), and a read-only view of what they sent. The drawn pink circle from the discovery done screen fits here.

Required items (the decision) block Submit until answered, with a plain message that links to the item. Nothing else blocks.

### Images

- **Storage:** private R2, keys `rounds/<slug>/<round>/<image name>` for the original and `rounds/<slug>/<round>/display/<image name>` for the screen version. Serve both through an authenticated route, `GET api/<slug>/review/<n>/image/<name>?size=display|full`, that allows the signed-in client and admin only (same pattern as `api/[slug]/preview/[id].ts`). No signed URLs, nothing public, never the Webflow media library.
- **Resizing happens in the admin's browser at upload.** Workers here have no image library, so the admin upload page draws each image to a canvas and uploads two files: the original and a display version about 1200 px wide (JPEG, quality 0.85). Tall images keep their aspect ratio.
- **Accepted files:** JPG and PNG up to 10 MB each. One image per request, with progress, to stay well inside Webflow Cloud's request limits.
- **On the client screen:** the display image fills the content column. Tapping it opens a full-screen viewer with the full-size image that allows pinch zoom and scrolling. Long images (a whole page, or the phone screenshot) scroll inside the viewer. Close with a large X and with the phone's back gesture. The viewport meta already allows zoom, so native pinch zoom works in the viewer.
- **CSP:** images come from `'self'`, so `src/middleware.ts` needs no change.

### Saving, locking, reopening

- Uses the Part 1 save engine (`useAutosave`) with round URLs: `PUT api/<slug>/review/<n>/answer` and `GET api/<slug>/review/<n>/state`.
- **The server enforces the lock.** Once a round is submitted, its answer endpoint returns 409 and the client shows the read-only view. The lock can't just be a hidden button.
- **On submit:** status becomes `submitted`, a copy of every answer is saved (see the data model), the timestamp is stored, and Evan gets a Slack message in #blueprint that lists the decision, the counts (Loved, Maybe, Not for me, No comments) and every item that needs attention, with a link to the round in admin.
- **Reopen from admin** (for when a client asks to add something). Status becomes `reopened`, the event is logged, and the client can edit and send again. Each send keeps its own copy, so the first submission is never lost.
- **Admin preview.** `?preview=1` with an admin session shows the round read-only, including a draft round that isn't open yet. Use it to check a round on a phone before sending the link.

### Admin

A new page per round, `admin/<slug>/review/<n>`, linked from the client's admin page.

- **Create a round:** number, title, due date, intro note, done note (all prefilled from the config when present), and the config JSON (file upload or paste).
- **Validate the config on upload, on the server,** with a zod schema in `src/lib/rounds.ts`: item types and fields, unique ids, 2 to 4 options on decisions and choices, and **no em or en dashes in any text.** The copy lint only covers files in the repo, so runtime configs need the same check (reuse the rules in `scripts/copy-rules.mjs`). Show every problem in plain words.
- **Images:** list every image the config names, with a status for each (missing, uploaded) and an upload control. The **Open round** button stays disabled until every named image is present.
- Open or close a round. Copy the round link. Preview.
- See progress (screens touched, last activity) and the submitted answers, with each send and what changed from the one before.
- **Export markdown** (format below), one click. Reopen.

### Data model additions (`migrations/0003_rounds.sql`)

Clients are keyed by `slug` everywhere in the existing schema, so rounds are too.

- **rounds:** `id`, `slug`, `number` (unique per slug), `title`, `status` (`draft`, `open`, `submitted`, `reopened`, `closed`), `config` (JSON), `due_date`, `created_at`, `opened_at`, `submitted_at`
- **round_images:** `round_id`, `name` (from config), `r2_key`, `display_key`, `width`, `height`, `uploaded_at`
- **round_answers:** `round_id`, `item_id`, `value` (JSON), `updated_at`, primary key (`round_id`, `item_id`)
- **round_submissions:** `id`, `round_id`, `answers` (JSON copy), `created_at`
- **events:** existing table; add types `round-opened`, `round-screen-viewed`, `round-submitted`, `round-reopened`

### Export: `review-round-<slug>-r<number>.md`

Written to paste straight into the client's Claude project. Internal, so plain and scannable.

```
# Review Round 1: Hart to Heart Consulting, homepage direction
Submitted Thursday, October 22, 2026. Opened Tuesday, October 20.

## Decision: which homepage opening leads
Picked: B (opens with Ernest)
Note: "..."

## Home
### Where do I start: Love it
Tags: Words
Note: "..."
### The work: Maybe
Tags: Photo
Note: "..."
### How it goes: no comments (approved)

## The "What changes" lines
- Love it: From unseen and hurting, to cherished and secure.
- Not for me: From chaos, to a calm you can keep.
Note: "..."

## Questions
### How much should faith show?: Right amount
### Proposed page name: Let's adjust it
Note: "..."

## Anything else
"..."

## Summary
Loved: 7. Maybe: 3. Not for me: 1. No comments: 4.
Needs attention: The work (Photo), [any Not for me or Maybe with a note]
```

If the round was reopened and sent again, add a final section, "Changed since the first send," listing each changed item with the old and new answer.

### Copy and design rules

- Equicity brand for the shell, same as the discovery chapters. Section images are the client's design, shown as is.
- Client-facing copy is warm and direct. No em dashes or en dashes anywhere. No pressure language. No countdowns.
- Mobile first. Tap targets at least 44 px. The three rating buttons stay large on a phone (they already stack icon over label below 420 px).
- Respect "reduce motion," as the existing animations do.
- Never emails the client. Evan sends the link from his own inbox.

### Acceptance tests

1. Create Round 1 for Hart to Heart from the config below. The admin refuses to open the round until all 16 named images are uploaded. A config with an em dash in any text is rejected with a clear message.
2. Admin Preview shows the draft round read-only on a phone.
3. Open the round. On a real iPhone, from the round link in an email: enter the passcode, land on Round 1 (not the discovery home), go through every screen, rate sections, add tags and notes, open and pinch zoom an image, scroll the long phone image.
4. Close the tab mid-round, reopen on a laptop. Everything is there (Part 1).
5. Try to submit without picking A or B. A clear message points to the decision. Pick one, submit.
6. After submit, nothing can be edited, and a direct `PUT` to the answer endpoint gets 409. The done screen shows what was sent. Evan gets the Slack message.
7. Export the markdown. It matches the format above and reads cleanly pasted into a Claude project.
8. Reopen from the admin, change one answer, send again, export again. The export shows the change, and admin still has the first send.
9. A second round for the same client can be created from a new config without code changes.

### Not in this version

Pinning or drawing comments on an image, in-app voice recording, more than one reviewer per client, comparing rounds side by side. Section tiles with notes cover what Round 1 needs. Pin comments are the first candidate for Round 2.

---

## Part 3: Round 1 for Hart to Heart

The Hart to Heart project supplies this config and the 16 images it names. Images come from the homepage direction canvas, sliced by section, named exactly as below. The config has been checked: valid JSON, no em or en dashes, and the images it names match the list below.

Load this as the round config. Due date Thursday, October 22, 2026.

```json
{
  "round": 1,
  "title": "Your homepage direction",
  "dueDate": "2026-10-22",
  "estimate": "About 8 minutes",
  "intro": "Here's the first look at your new site. Two ways the homepage could open, the rest of the homepage, and a first pass at your About page. The words are a draft in your voice, written from your blueprint and our call. Your voice memos will replace them, so react to the feel more than the exact wording. Go with your gut, and skip anything you don't have a reaction to.",
  "doneNote": "Thank you. I'll read every note and come back with the direction locked by Friday, October 23. Then we build.",
  "screens": [
    {
      "id": "opening",
      "title": "How should the homepage open?",
      "items": [
        {
          "id": "hero",
          "type": "decision",
          "required": true,
          "prompt": "Which opening feels more like Hart to Heart?",
          "options": [
            { "key": "A", "image": "r1-hero-a.jpg", "label": "A: Opens with a couple", "description": "A couple in a hard moment, with the line \"Your family can come back from this.\"" },
            { "key": "B", "image": "r1-hero-b.jpg", "label": "B: Opens with you", "description": "Your photo, with the line \"I get in the middle with you.\" A professional portrait would replace this photo before launch." }
          ],
          "notePrompt": "Anything about either one?"
        }
      ]
    },
    {
      "id": "home",
      "title": "The rest of your homepage",
      "intro": "Everything below the opening is the same in both versions.",
      "items": [
        { "id": "home-start", "type": "section", "image": "r1-home-start.jpg", "title": "Where do I start?", "about": "Four doors, so a visitor can pick the one that sounds like today." },
        { "id": "home-work", "type": "section", "image": "r1-home-work.jpg", "title": "The work", "about": "Your three homepage services." },
        { "id": "home-process", "type": "section", "image": "r1-home-process.jpg", "title": "How it goes", "about": "Your process in four steps." },
        { "id": "home-about", "type": "section", "image": "r1-home-about.jpg", "title": "About you", "about": "A short introduction that links to your About page." },
        { "id": "home-podcast", "type": "section", "image": "r1-home-podcast.jpg", "title": "Listen first", "about": "Your two starred podcast episodes." },
        { "id": "home-groups", "type": "section", "image": "r1-home-groups.jpg", "title": "Groups and cohorts", "about": "Coming soon, with a waitlist." },
        { "id": "home-book", "type": "section", "image": "r1-home-book.jpg", "title": "Love that Lands", "about": "Two free pages in exchange for an email." },
        { "id": "home-cta", "type": "section", "image": "r1-home-cta.jpg", "title": "The free call and the footer", "about": "How every page ends." },
        { "id": "home-phone", "type": "section", "image": "r1-phone.jpg", "title": "On a phone", "about": "Most visitors will see it this way." }
      ]
    },
    {
      "id": "words",
      "title": "A few things only you can decide",
      "items": [
        {
          "id": "lines",
          "type": "lines",
          "prompt": "These lines fade in and out at the top of the homepage. Which ones sound like what your clients go through?",
          "lines": [
            "From confused about why nothing lands, to clear about what she needs.",
            "From unseen and hurting, to cherished and secure.",
            "From a family that only talks in a crisis, to a family that can sit at one table.",
            "From a child who stopped calling, to a conversation that didn't end in a fight.",
            "From walking on eggshells, to saying what you mean and holding it.",
            "From chaos, to a calm you can keep."
          ],
          "notePrompt": "Any line you'd add or change?"
        },
        {
          "id": "faith",
          "type": "choice",
          "prompt": "Your faith shows up in the opening line, the About section, and your About page. How does that feel?",
          "options": ["About right", "I'd like more", "I'd like less"],
          "notePrompt": "Anything specific?"
        },
        {
          "id": "nfd-name",
          "type": "choice",
          "prompt": "Here's a proposed name for the narcissistic dynamics page. In the menu it stays \"Narcissistic Family Dynamics,\" since that's what people search for. The page itself would open with: \"Understanding and Recovering From a Narcissistic Family Dynamic,\" with assertiveness training as a named part of the work inside.",
          "options": ["That works", "Close, let's adjust it", "Let's talk about it"],
          "notePrompt": "What would you change?"
        }
      ]
    },
    {
      "id": "about",
      "title": "Your About page",
      "intro": "A first pass. The credential descriptions are placeholders until your memos come in.",
      "items": [
        { "id": "about-opening", "type": "section", "image": "r1-about-opening.jpg", "title": "The opening", "about": "Your photo and the line \"I get in the middle, then I help you find the order in it.\"" },
        { "id": "about-story", "type": "section", "image": "r1-about-story.jpg", "title": "Why I do this work", "about": "Your story. Your memos will fill this in." },
        { "id": "about-beliefs", "type": "section", "image": "r1-about-beliefs.jpg", "title": "What I believe about this work", "about": "Three things you stand for." },
        { "id": "about-credentials", "type": "section", "image": "r1-about-credentials.jpg", "title": "Credentials and training", "about": "Placeholders for now." },
        { "id": "about-expect", "type": "section", "image": "r1-about-expect.jpg", "title": "What to expect from me", "about": "How you work, in four lines." }
      ]
    },
    {
      "id": "else",
      "title": "Anything else",
      "items": [
        { "id": "anything", "type": "open", "prompt": "Anything that felt off, or anything you were hoping to see that isn't here?" }
      ]
    }
  ]
}
```

### Images the config names

r1-hero-a.jpg, r1-hero-b.jpg, r1-home-start.jpg, r1-home-work.jpg, r1-home-process.jpg, r1-home-about.jpg, r1-home-podcast.jpg, r1-home-groups.jpg, r1-home-book.jpg, r1-home-cta.jpg, r1-phone.jpg, r1-about-opening.jpg, r1-about-story.jpg, r1-about-beliefs.jpg, r1-about-credentials.jpg, r1-about-expect.jpg

**Export guidance for the slices:** JPG, desktop sections 1600 to 2400 px wide, the phone image 750 to 1200 px wide at full page height, each under 10 MB. Names are lowercase, exactly as listed.

---

## Order of work for Monday

1. Part 1, phone save and resume: Step 0 evidence, then the shared `useAutosave` hook, refetch, queue timestamps, timeouts and the always-visible indicator, with the Part 1 tests.
2. Part 2 data model (`0003_rounds.sql`), `src/lib/rounds.ts` (schema, dash check, markdown export), admin round creation, config validation and image upload with browser resizing.
3. Part 2 client screens: login `next`, round card, intro, decision, section, lines, choice, open, viewer, review, submit, done, server lock.
4. Markdown export, Slack message, reopen.
5. Load Round 1 for Hart to Heart, run every acceptance test on a phone, then hand Evan the link and the admin page for QA.

**For QA, hand back:** the commit list, the Playwright test file and its last run, the Step 0 finding, and a short list of anything not built or changed from this spec.

If Part 2 isn't solid by Tuesday noon, don't send it. Evan shares the design canvas with Ernest instead and asks "A or B?" by email. A half-working review round is worse for Ernest than no review round.
