# Equicity Blueprint (formerly "Equicity Discovery")

Build brief for Equicity Production. Prepared October 7, 2026 from the Hart to Heart project. First client: Ernest Hart, Hart to Heart Consulting.

Working name: Equicity Discovery. Final name and URL path get set in Production alongside the brand.

---

## 1. The idea

A private, passcode-gated web app on equicityseo.com that every new design client goes through before kickoff and before the first design concept. It replaces the PDFs, long recap emails, and scattered "send me your logo" asks with one link.

The client moves through eight short chapters: how the site should feel, color, type, layout and imagery galleries, sites they love and hate, logo and files, their offers, how leads should flow, and the access we need. Most of it is tapping, not typing. The galleries render in the client's own brand colors and business name, so it feels made for them.

What comes out:

- **For Equicity:** a structured discovery brief (markdown and JSON) that drops straight into the client's Claude project, with automatic flags for scope, pass-through costs, decisions, and missing items.
- **For the client:** a clean "here's what we heard" summary they keep. That is the value-add they can feel.

Positioning: a premium tool that reflects what Equicity has learned building hundreds of websites, offered to design clients as part of working with us.

## 2. Why it's worth building, and the guardrails

Why:

- **One ask instead of ten.** Equicity's rule is that client updates end with exactly one ask. This turns the whole "what you owe us by Friday" list into one link.
- **Better design direction, faster.** Reactions to real visuals beat "send me two sites you like." Love, maybe, or no on rendered options gives us a ranked palette, type, and layout direction before the first concept.
- **Fewer late surprises.** Decisions that usually surface in week 4 (lead flow, prices on the site, logo refresh, who else weighs in) get answered in week 1.
- **Reusable.** Every future design client runs through it. New client means a new config, not new code.
- **Shows the process instead of telling it.** Each chapter carries one line of "why we ask" written from experience. That is where the expertise lands.

Guardrails:

- **Saves the client time, never adds homework.** About 25 minutes total across eight short chapters, with the essentials (about 12 minutes) first. Everything else is skippable with "not sure yet" or "let's talk."
- **Never collects passwords or credentials.** The access chapter gives invite instructions and tracks status only.
- **Collects website decisions, not client stories.** For Ernest especially, anything about families belongs in voice memos under the confidentiality clause, never in free-text boxes here.
- **Never emails the client.** Evan sends the link from his own inbox. Ernest's spam filter has caught real leads and Equicity's own invoice, so app-sent emails cannot be the path.
- **Voice-friendly.** Any open question can be answered with a voice memo instead (v1: a note that says "or text Evan a memo"; v2: record in the app).

---

## 3. First client: Hart to Heart project summary

### What we're building

Rebuild of harttoheartconsulting.com from WordPress (built 2021) to Webflow, repositioned around the family intervention work. A visitor who is the right person should feel affirmed in reaching out within ten seconds of landing.

**Agreed pages:** Home, About, Process, five service pages (Family Intervention, Marriage Repair, Estrangement and Adult Child Reconnection, Narcissistic Family Dynamics, Continuing Care), Groups and Cohorts, Book, Contact, and a blog template. Privacy and terms carried over. Anything beyond this list is quoted separately.

**Deliverables:**

- Custom design around the gold and white brand, restrained and human imagery, mobile first, meaningfully faster than the current site
- Full copy rewrite from Ernest's voice memos (27 prompts, already written)
- Spam-protected inquiry form with a short intake, routed to a Calendly welcome session
- A hub for podcast appearances, YouTube, the book, the Passion.io app (link-ready), and groups and cohorts
- Blog framework for the monthly retainer post
- SEO foundation, including organization and person schema
- Migration with a full redirect map; WordPress retired at launch

**Not included:** paid ads, link building, video production, photography, and anything beyond the agreed list (a logo redesign would fall here).

### Timeline

Assumes kickoff the week of October 5. Slow approvals shift everything day for day.

| Phase | Dates | What happens |
|---|---|---|
| Weeks 1 to 2 | Oct 5 to Oct 16 | Kickoff, design direction, voice memos, copy drafts, access. Client deliverables due Fri Oct 16 |
| Weeks 3 to 4 | Oct 19 to Oct 30 | Design and build in Webflow, CMS, form, Calendly, embeds |
| Weeks 5 to 6 | Nov 2 to Nov 13 | Full review, two revision rounds (feedback due Nov 9 and Nov 20) |
| Buffer | Nov 16 to Nov 27 | Final fixes, redirect map, launch checklist, written approval by Tue Nov 24. Thanksgiving week stays clear |
| Launch | Week of Nov 30 | DNS cutover target Tue Dec 1, redirects live, WordPress retired |

Status as of Oct 7: agreement signed, first invoice paid Oct 2, kickoff gate cleared. Ernest emailed Oct 7 asking what's next. New plan: he goes through the discovery app this weekend, and a results call early next week takes the place of the standalone kickoff call.

### What we still need from Ernest (the app's job for him)

| Need | Chapter |
|---|---|
| Design direction: feel, sites he likes and dislikes, imagery | 2, 3, 4 |
| Logo files, exact gold and white values, headshots, photos he owns | 3, 4, 7 |
| Lead capture decision, intake questions, where leads land, who replies, Calendly tier, Stripe | 6 |
| Groups and cohorts details (or a "coming soon" decision) | 5 |
| Book: title, cover, launch date, where it sells, what the page should do | 5 |
| Passion.io app name and status | 5 |
| Testimonials with permission and how each person is named | 6 |
| Marriage Recovery Center: can we name it, use the logo, any language they own | 6 |
| Podcast list with favorites, YouTube channel | 6 |
| Access: WordPress, host, registrar and DNS, Google Business Profile, Search Console and Analytics, Calendly | 7 |
| Where his email is hosted (DNS cutover risk) | 7 |
| What a "round" of feedback means, the five business day window | 8 |

Stays outside the app: the 27 voice memo prompts (the copy source, already in motion) and anything billing related (Evan and Catherine handle that directly).

### Client context that shapes the app

- Very little spare time this fall. Short chapters, save and resume, one due date set by Evan.
- Prefers voice memos over meetings and typing. Assume he does this on his phone in two or three sittings.
- Aggressive spam filter. The link comes from Evan's inbox, never from the app.
- Five years of trust with Evan. Warm, low-pressure tone throughout.
- Sensitive niche. The app's copy for him stays calm, and nothing invites him to describe client situations.
- Gold and white stays. Galleries explore around it, not away from it.

---

## 4. Experience design

### Principles

- **Mobile first.** Big tap targets, one question per screen where it helps, no horizontal scrolling.
- **Taps before typing.** Every chapter opens with visual or multiple choice items. Open text is optional and short.
- **Always an exit.** "Not sure yet," "Let's talk about it," "Skip for now." Skips become flags in the brief, never blockers.
- **Save on every answer.** Resume on any device with the same link and passcode.
- **Progress by chapter** with time estimates. Finishing a chapter gets a quiet, warm moment, no gamified noise.
- **Prefilled where we already know.** Existing clients confirm instead of retyping.
- **One "why we ask" line per chapter,** written from experience. Example: "Gold looks beautiful on buttons and accents, but it's hard to read as body text, so we pair it with a darker color for words."
- **Equicity brand in the shell, client brand in the galleries.**
- **No em dashes or en dashes in any client-facing copy.** Casual, warm, direct. No pressure language.

### Chapter map

| # | Chapter | Time | Priority |
|---|---|---|---|
| 1 | Welcome and what we already know | 2 min | Essential, first batch |
| 2 | The feel | 2 to 3 min | Essential, first batch |
| 3 | The look: color, type, layout, imagery | 5 min | Essential, first batch |
| 4 | Sites you love and hate, logo | 3 min | Essential, first batch |
| 5 | Your offers: services, groups, book, app | 4 min | By due date |
| 6 | Getting the right people to reach out | 4 min | By due date |
| 7 | Files and access | 3 min | By due date |
| 8 | How we'll work, review and send | 2 min | By due date |

Chapters 1 to 4 take about 12 minutes and unlock the homepage direction.

---

## 5. Chapters and questions (Ernest's config)

Input types: **[confirm]** prefilled, tap to confirm or edit. **[tap]** single choice. **[multi]** multiple choice. **[rate]** love, maybe, not for me. **[slider]** two-ended scale, starts centered. **[rank]** drag to order. **[short]** short text. **[upload]** file upload. **[repeat]** add another card.

### Chapter 1: Welcome and what we already know

Welcome screen:

- Greeting by first name and a short note from Evan
- How it works: about 25 minutes, eight short chapters, saves as you go, do it in pieces
- "Anything you share here stays between us and is only used to build your site."
- "Please never type a password here. When we need access to something, we'll show you how to invite us."

Confirm what we know **[confirm]**:

- Business name: Hart to Heart Consulting
- Name and credentials on the site: Ernest Hart, RS, BS, CAI
- Title: Owner and Lead Interventionist
- Based in: Seattle, WA
- Public email on the site: ernest@harttoheartconsulting.com (or a different one)
- Show a phone number on the site? **[tap]** yes, no
- The five services
- Where he works with families **[multi]**: in person around Seattle, online anywhere, travel to families, international

What success looks like **[multi, up to 2]**: "A year from now, the new site is working if..." more inquiries, better-fit inquiries, group and cohort sign-ups, book sales, podcast listeners becoming clients, other **[short]**

Internal note: his goal is to grow Hart to Heart into a much bigger share of his practice. Do not display revenue figures in the app.

### Chapter 2: The feel

- **The ten second test [multi, up to 3]:** "Someone lands on your site late at night after a hard day with their family. What should they feel first?" Safe, understood, calm, hopeful, not alone, respected, steady, relieved, ready to reach out, other **[short]**
- **Sliders [slider]:**
  - Calm to energetic
  - Warm and personal to expert and clinical
  - Classic to modern
  - Quiet and minimal to rich and layered
  - Leads with Ernest to leads with the family's story
- **Who the site speaks to first [rank]:** parents, adult children, spouses and couples, professionals who refer, podcast listeners
- **How to talk about narcissistic dynamics [tap]:** use the term directly, use it gently with context, describe the behavior and skip the label, let's talk
- **Words that feel like you [short, optional]** and **words to avoid [short, optional]**
- **Who else weighs in on the site [tap]:** just me, me and one other person **[short]** name and role

Why we ask: "Most redesigns go sideways on feel, not features. Getting this right first makes every page easier."

### Chapter 3: The look

**3a. Color [rate].** Five palette cards, each a live mini homepage section rendered in that palette with "Hart to Heart" and a neutral sample line. All built on gold and white:

1. Gold, warm white, charcoal: grounded and classic
2. Gold, ivory, deep navy: trusted and professional
3. Soft gold, cream, sage: calm and natural
4. Gold, white, warm stone: quiet and editorial
5. Gold, white, deep plum: warm and personal

Then: "Do you know your exact gold?" **[tap]** I'll paste the color code, use the gold from my logo, not sure so you pick

Why we ask: the gold contrast line from section 4.

**3b. Type [rate].** Four pairings rendered with his business name and a sample heading:

1. Classic serif headings with a clean sans body: established, trustworthy
2. Soft humanist sans throughout: friendly, approachable
3. Editorial high-contrast serif: thoughtful, literary (a natural tie to the book)
4. Modern geometric sans: clear and current

Galleries use free web fonts. A premium font choice gets flagged as a pass-through cost needing approval.

**3c. Homepage layout [rate].** Six hero styles, rendered in his top-rated palette from 3a and favorite type from 3b:

1. Portrait of Ernest beside the headline
2. Full-width calm photo with the headline over it
3. Text-led editorial with a small image
4. Short, quiet looping video (from his YouTube or podcast clips)
5. Headline with a client quote front and center
6. Minimal with soft texture and lots of space

Page rhythm **[tap]:** short and scannable, longer and story-driven, a mix

Why we ask: "Go with your gut. We read patterns across your answers, not any single tile literally."

**3d. Imagery [rate].** Eight style tiles from free-license stock, credited:

candid families together in calm moments, hands and small details, nature and light, Ernest in real settings, warm textures and abstract, illustration, documentary-style real life, two people in conversation

Never list **[confirm, add your own]:** prefilled with stock "sad person at a window" shots, staged arguments, and crying close-ups. Plus **[short]** for anything else.

Headshots **[tap]:** recent professional, older professional, none yet
Photos he owns from speaking, podcasts, or events **[tap]:** yes, I'll upload them in chapter 7; no

Photography isn't part of the build. "None yet" becomes a flag for Evan; the app itself stays pressure-free.

### Chapter 4: Sites you love and hate, logo

- **Two or three sites you like [repeat]:** link, plus what you like **[multi]**: colors, photos, layout, the words, the feeling, easy to use. Optional note.
- **One site you don't like:** link, plus what bugs you (same tags)
- **Anyone in your field whose site gets it right? [short, optional]**
- **Logo [tap]:** keep it as is, small cleanup, I'd like something new, not sure
  - If "something new," the app says: "Good to know. That's a separate conversation from this build, and Evan will follow up." Flag as scope.
- **Logo files [upload]:** SVG, AI, EPS, PDF, or PNG. Or **[tap]** "I don't know where they are" (we pull from the current site).
- **Does the logo have a symbol that works on its own,** for the browser tab icon? **[tap]** yes, no, not sure

### Chapter 5: Your offers

Services:

- **[rank]** the five services by what you most want to grow
- **[multi]** which ones bring your best-fit clients
- **[multi, up to 3]** feature on the homepage
- **Any service name you'd change? [short, optional]**
- **Prices on the site [tap]:** show prices, "starting at," no prices so we talk on the call, not sure

Groups and cohorts:

- **Ready to list groups? [tap]** yes, not yet so show "coming soon" with a waitlist, let's talk
- If yes **[repeat]:** name, who it's for, format (online, in person, hybrid), schedule, length, price (or "ask"), how to join (Calendly, Passion.io, email, form), status (open, waitlist, full, coming soon)

Book:

- Title or working title **[short]**
- Cover **[tap]** done, in progress, not started, plus **[upload]**
- Launch date (date, or "not set")
- Where it sells **[multi]:** Amazon, my site, bookstores, not sure
- What the book page should do first **[tap]:** sell copies, collect emails, book calls

Passion.io app:

- App name **[short]**, status **[tap]** live, in progress, paused, not sure, expected launch (date, or "not sure")
- The site will not promise dates.

Why we ask: "Groups, the book, and the app each get a 'coming soon' version, so nothing has to be finished by launch."

### Chapter 6: Getting the right people to reach out

**Lead flow [tap],** shown as two simple step diagrams:

- A. Free 15 minute call first, paid session second. Labeled "What we recommend," with one line on why: someone reaching out about their family can feel turned away by a card form.
- B. Book a paid session right away
- C. Not sure, let's talk

**Intake questions [multi, pick 3 to 5]:** name, email, phone, who this is about (me, my child, my spouse, my parent, the whole family), a few words about what's going on, how you heard about Ernest (podcast, referral, search, other), best time to reach you, time zone or location, plus write your own

**Where inquiries go [tap]:** a new dedicated address, a label in my current inbox, not sure. Line: "Real inquiries have landed in spam before, so we'll set this up and test it before launch."

**Who replies [tap]:** me, someone else **[short]**
**How fast [tap]:** same day, within 1 business day, within 2, other
**Calendly [tap]:** free, paid, not sure. **Stripe connected [tap]:** yes, no, not sure. Note: paid tools pass through at cost, with approval first.

Proof:

- **Credentials [confirm]:** RS, BS, CAI. Anything else **[short]**
- **Marriage Recovery Center:** name the partnership on the site? Use their logo? Any language they need to approve? Each **[tap]** yes, no, need to ask them
- **Testimonials [repeat]:** quote (paste, or **[upload]** a screenshot), how to name them **[tap]** full name, first name, initials, anonymous with context like "parent of two," and a **permission confirmed** checkbox. Line: "Nothing goes on the site without permission."
- **Podcasts [repeat]:** link and show name. Star up to three to feature.
- **YouTube channel [short]** and any other profiles **[short]**

### Chapter 7: Files and access

**Uploads [upload, multiple]:** logo, headshots, photos, book cover, anything else. Or **[tap]** I'll send them later.

**Access checklist.** Status only, never passwords. Each item gets **[tap]** done, I'll do it this week, need help, don't have this, plus a two or three line how-to for inviting the Equicity access email:

- **WordPress:** add Equicity as an admin user
- **Current web host:** who is it? **[short]** or not sure
- **Domain:** where is harttoheartconsulting.com registered? **[tap]** GoDaddy, Namecheap, Squarespace, other, not sure. Then delegate access, or a 10 minute screen share.
- **Email:** where does your email live? **[tap]** Google Workspace, Microsoft 365, through my web host, not sure. Internal: "web host" or "not sure" flags DNS cutover risk.
- **Google Business Profile:** add Equicity as a manager
- **Search Console and Analytics:** add Equicity as a user, or OK for us to set up new
- **Calendly:** share event links, or add us
- **YouTube:** channel link only

Line: "If something won't let you invite us, pick 'need help' and Evan will set up a quick call."

### Chapter 8: How we'll work, review and send

- **The timeline** from config as a simple visual: homepage direction, build, review rounds, launch week. Shown as targets.
- **One "sounds good" tap** covering three points:
  - Feedback within five business days keeps launch on track
  - A round is one batch of feedback per review, so send it all together when you can. A voice memo is perfect.
  - Two rounds are included
- **Best way to reach you [multi]:** text, email, voice memo, call. **Best times [short]**
- **Anything in the next eight weeks we should plan around? [short, optional]**
- **Review:** a "here's what we heard" summary grouped by chapter, with an edit link on each. Then **Send to Evan**.
- **Done screen:** thank you, what happens next ("Evan will send your homepage direction by [date]"), and a link to view or download the summary.

---

## 6. Galleries: how to build them

- **Live-rendered, not screenshots.** Palette, type, and layout tiles are HTML and CSS components that take the client's colors, business name, and sample line from config. Every tile looks made for them, there's no third-party licensing issue, and the next client gets fresh tiles for free.
- **Order matters.** Layout tiles in 3c use the top-rated palette from 3a and the favorite type from 3b. If those were skipped, fall back to the client's brand colors and pairing 1.
- **Imagery tiles** use free-license stock (Pexels or similar), with credit stored in the gallery config. Curate once, tag by niche (therapy and coaching, legal, home services, real estate, and so on), reuse across clients.
- **Optional "From our work" strip:** three to six Equicity-built sites, with client permission, as proof of experience. Never screenshots of other agencies' sites.
- **Rating control:** three large buttons (love, maybe, not for me). Swipe on mobile is a bonus, not required. Keyboard and screen reader friendly.

---

## 7. Output: the discovery brief

On submit, and on demand from the admin view, generate three things.

**1. discovery-brief.md,** written to drop straight into the client's Claude project:

```
# Discovery Brief: [Business name]
Completed [date]. Chapters skipped: [list]

## Feel
## Color (ranked, with hex values)
## Type
## Layout (loves, maybes, nos) and page rhythm
## Imagery (yes list, never list) and photo assets on hand
## References (sites liked and why, site disliked and why)
## Logo and files
## Services (ranked, featured, best fit, pricing display)
## Groups and cohorts / Book / App
## Lead flow, intake questions, inbox, who replies, response time
## Proof (credentials, partnership permissions, testimonials with naming, podcasts)
## Access status by system, and email host
## Working style and dates
## Flags for Evan
```

**2. discovery.json** with the same data keyed by question id, for future automation.

**3. A client summary page,** with a PDF download, styled in Equicity's brand. Something like "Your Website Blueprint." This is the keepsake.

**Flags for Evan** (generated by rules, listed at the top of the brief):

- Logo "something new": scope conversation, quoted separately
- Calendly paid tier or Stripe needed: pass-through cost approval
- Premium font picked: pass-through cost approval
- Testimonial without permission confirmed: do not build around it
- Any access item "need help" or "don't have this": schedule help
- Email host "web host" or "not sure": DNS cutover risk, document MX records before launch
- No headshots: discuss photography (outside build scope)
- Groups, book, or app "not yet": build coming soon states
- Partnership permissions "need to ask them": follow up before writing those pages
- Any "let's talk" answer or skipped chapter: list for the next call

---

## 8. Admin view (Equicity only)

- Client list with progress by chapter, last activity, and submitted date
- Open any client: answers by chapter, uploads, flags
- Download the brief (md, json), the client summary (pdf), and all uploads (zip)
- Create a client from a config, set or reset the passcode, copy the link
- Notify Evan when a client submits (chapter-complete notices optional)
- Admin sits behind its own login, separate from client passcodes

---

## 9. Technical approach on Webflow

### Build workflow: design first is fine

Designing before coding is welcome if it leads to a better result. Production decides the split, says exactly which steps happen in Claude Design and which in a Claude Code session, in order, and explains how the designs hand off to the build. Suggested starting point:

- **Claude Design:** the app shell in Equicity's brand, the chapter screen templates (welcome, confirm, rate, slider, rank, upload, repeat card, review, done), the gallery tile designs (palette, type, layout, imagery), and the client summary page.
- **Claude Code session:** the Webflow Cloud app itself: access and sessions, the config-driven chapter engine, gallery components built from the designs, storage and uploads, brief export, admin, and deploy at the mount path.

### Recommended: a Webflow Cloud app mounted on equicityseo.com

- Webflow Cloud hosts full-stack apps (Next.js or Astro) on Cloudflare Workers at a mount path on the Webflow site, for example equicityseo.com/discovery. Visitors move from the marketing site into the app without leaving the domain.
- Storage is built in: SQLite for clients and answers, key-value for sessions, object storage for uploads.
- Since February 2026, Cloud deploys are decoupled from Webflow site publishing, so app updates don't require republishing the site.
- Match Equicity's Webflow styles (fonts, colors, spacing) as design tokens in the app. Check whether DevLink can share the nav and footer.
- Verify first: Equicity's site plan, Webflow Cloud pricing at this tiny usage, and current framework support.

### Access model

- Each client gets a unique link (for example /discovery/hart-to-heart) plus a short passcode. Passcode stored hashed, attempts rate-limited, session in a secure cookie. Same link and passcode resume on any device.
- Webflow's native page password is one shared password per page or folder, so it can't tell clients apart. The app handles its own access. The native password can still lock a static landing page if wanted.
- No magic-link or notification emails to clients.

### Fallback if Webflow Cloud isn't a fit

A Webflow page (native password protection) with a Code Embed that loads an externally hosted bundle, plus a small backend for storage and uploads. Code Embeds cap at 50,000 characters, so the bundle lives on a CDN or Netlify. It works, but it's two systems to maintain and a shared password at the gate.

### Don't

- Store answers in Webflow CMS. It's built for public content, and one wrong toggle publishes it.
- Build on native Webflow forms. No save and resume, no galleries, no structured export.

### Data model (starting point)

- **clients:** id, slug, business name, first name, passcode hash, config (json), status, due date, created, submitted
- **answers:** client id, question id, value (json), updated at
- **uploads:** client id, kind (logo, headshot, photo, cover, testimonial, other), file key, file name, size, uploaded at
- **events:** client id, type (opened, chapter complete, submitted), timestamp
- **galleries:** shared config for palette recipes, type pairings, layout tiles, and imagery tiles (with credits and niche tags)

### Privacy and security

- noindex on every app route, disallowed in robots.txt, left out of the sitemap
- No third-party trackers inside the app
- Uploads private, served by signed URL, with type and size limits (for example 25 MB per file)
- Soft guard: if a text answer looks like a password or login, warn before saving
- Retention: archive 90 days after launch, delete on request. Welcome copy matches the contract's confidentiality clause.
- Accessibility basics: contrast, focus states, labels. Tested on iOS Safari and Android Chrome.

---

## 10. Reuse: one config per client

Each client is one config. Modules switch chapters on and off (a law firm gets no book chapter; a future ecommerce client could get a products chapter). Ernest's, with values to confirm marked:

```json
{
  "slug": "hart-to-heart",
  "firstName": "Ernest",
  "business": "Hart to Heart Consulting",
  "domain": "harttoheartconsulting.com",
  "brand": {
    "primary": "GOLD_HEX_TO_CONFIRM",
    "background": "#FFFFFF",
    "sampleLine": "Family intervention and repair"
  },
  "services": [
    "Family Intervention",
    "Marriage Repair",
    "Estrangement and Adult Child Reconnection",
    "Narcissistic Family Dynamics",
    "Continuing Care"
  ],
  "prefill": {
    "nameOnSite": "Ernest Hart, RS, BS, CAI",
    "title": "Owner and Lead Interventionist",
    "location": "Seattle, WA",
    "publicEmail": "ernest@harttoheartconsulting.com",
    "credentials": ["RS", "BS", "CAI"],
    "partner": "Marriage Recovery Center",
    "neverImagery": [
      "Stock 'sad person at a window' shots",
      "Staged arguments",
      "Crying close-ups"
    ]
  },
  "modules": { "groups": true, "book": true, "app": true, "partner": true },
  "leadFlowRecommendation": "free-call-first",
  "accessItems": ["wordpress", "host", "registrar", "email", "gbp", "gsc-ga", "calendly", "youtube"],
  "priorityChapters": [1, 2, 3, 4],
  "dates": {
    "linkSent": "2026-10-09",
    "allDue": "2026-10-11",
    "resultsCall": "2026-10-13",
    "homepageDirection": "2026-10-16",
    "launchWeek": "2026-11-30"
  },
  "equicityAccessEmail": "TO_CONFIRM"
}
```

The sample line is placeholder text for tiles only. Real copy comes from his voice memos.

---

## 11. Timeline for Ernest, with a fallback

Ernest emailed on October 7, five days after paying, asking what's next. The plan: he goes through the app over the weekend, and a results call early next week takes the place of the standalone kickoff call.

- **Thu Oct 8:** Evan replies to Ernest's email from his own inbox. Next step is a short discovery link (about 25 minutes, fine to do in pieces), landing by Friday, to go through over the weekend. Propose the results call time in the same email. Reply Thursday even if the link isn't ready yet, since he's waiting.
- **Fri Oct 9 at the latest:** link and passcode go out. One ask: go through it by Sunday.
- **Sat Oct 10 to Sun Oct 11:** Ernest goes through it. If he only gets partway, chapters 1 to 4 (about 12 minutes) are enough to start the homepage direction.
- **Mon Oct 12:** discovery brief exported into the Hart to Heart project. Homepage direction work starts.
- **Tue Oct 13 or Wed Oct 14:** results call, 30 minutes. Walk through what he picked, settle every "let's talk" item and the lead flow, confirm the timeline and how we work, and hand off the voice memo list as the next single ask.
- **Fri Oct 16:** homepage direction to Ernest, remaining access items done, first memos landing. Home and service memos may run a few days past Oct 16; copy drafting moves with them.

The done screen can show the voice memo list as "what's next, no rush," so he can start before the call if he wants. That keeps the email to one ask.

This puts the homepage direction back inside week 2, on the delivery plan's original track.

**Fallback:** if v1 isn't client-ready by Friday, October 9, send Ernest the plain recap email Friday, keep next week's call as a regular kickoff, and launch the app with the next design client. A rough tool is worse for Ernest than no tool.

**For future clients:** finishing chapters 1 to 4 gates the kickoff call, and finishing all eight gates the first design concept.

---

## 12. Acceptance criteria for v1

### The Friday cut

v1 has to be client-ready in about two days, so build in this order and ship only what's solid.

- **Must have for Ernest:** passcode gate, all eight chapters, live palette, type, and layout tiles in his colors, imagery tiles, save and resume, uploads, review and submit, notification to Evan, markdown brief export.
- **Can follow next week:** admin polish (a simple client list is fine), JSON export, the client summary PDF (the on-screen summary covers it for now), the "From our work" strip, chapter-complete notifications.

### Full v1 criteria

- Ernest can open the link on his phone, enter the passcode, and finish in about 25 minutes across sittings, resuming on another device
- Galleries render in gold and white palettes with his business name
- Skips and "let's talk" never block progress and show up as flags
- Uploads work for SVG, PNG, JPG, PDF, AI, and EPS
- No screen asks for a password; the access chapter shows invite steps and tracks status
- Evan is notified on submit; the admin view shows answers, uploads, and flags
- discovery-brief.md exports cleanly and reads well pasted into a Claude project
- The client summary page looks finished and branded
- Client-facing copy is warm and direct, with no em dashes, no en dashes, and no pressure language
- Every app route except the gate requires a valid session; noindex everywhere
- A second client can be added by config alone

---

## 13. Decisions for Evan

1. Tool name (working: Equicity Discovery) and URL path (/discovery, /blueprint, /start)
2. The Equicity email address clients invite for access
3. Results call day and time (Tue Oct 13 or Wed Oct 14)
4. A short welcome video from Evan per client (v2 is fine)
5. Chapter-complete notifications on or off

## 14. Later (not v1)

- In-app voice recording for open questions and memo prompts, with transcription
- AI-drafted design direction from the answers, for Evan to edit
- A short public version on the Equicity site as a lead magnet for prospects
- Multiple people per client (a partner who weighs in)
- Push "need help" access items into ClickUp as tasks

---

## Sources (Webflow facts, checked October 7, 2026)

- Webflow Cloud environment configuration: https://developers.webflow.com/webflow-cloud/environment/configuration
- Webflow developer changelog, Feb 27, 2026 (Cloud deploys decoupled from publishing): https://developers.webflow.com/home/changelog/2026/2/27
- Webflow Cloud guide (storage types, pricing model): https://agence-scroll.com/en/blog/webflow-cloud
- Password protect your site or pages: https://help.webflow.com/article/password-page
- Custom code embed (50,000 character limit): https://help.webflow.com/hc/en-us/articles/33961332238611
---

## 15. Amendments, October 7, 2026 (Equicity Production)

These override anything above that conflicts.

### Decisions

- **Name and path:** Equicity Blueprint, mounted at **/blueprint** on equicityseo.com. Ernest's link: equicityseo.com/blueprint/hart-to-heart.
- **Repo:** github.com/evan-ebert/equicity-blueprint (private). This repo only. Nothing in this project touches any other repository.
- **Client-facing name for the experience:** "your blueprint." Never "questionnaire" or "intake."
- **Access email clients invite (chapter 7):** evan@equicityseo.com.
- **Webflow Cloud app:** approved. Site-attached to the Equicity site, mounted at /blueprint, deploying from the repo's main branch.
- **Voice memo prompts:** not part of the app. The "27 prompts, already written" in section 3 could not be located. Evan sends memo prompts separately after the results call, written from what the client picks in the blueprint (starred pages and page notes). The done screen says the prompts are coming from Evan, with no list.
- **Time promise:** about 20 minutes for the core path. Anything that would push past that is optional and marked so. Chapters 1 to 4 stay first.

### Architecture changes to section 9

1. Astro (server rendered on Webflow Cloud) with React only for interactive pieces. No Next.js.
2. No key-value store. Sessions are signed, HttpOnly cookies. Passcode attempt limits live in SQLite. Storage is SQLite (D1) plus object storage (R2) only.
3. Uploads are never public. They are served only through the authenticated admin view. Photos are downsized on the device before upload (keeps slow phone uploads under the 20 second request limit). SVGs always download as files and never render inline.
4. No robots.txt Disallow. Every response carries `X-Robots-Tag: noindex, nofollow` plus a meta robots tag. (A Disallow would hide the noindex from crawlers.)
5. Submit notification goes to Evan through a Slack incoming webhook posting to a private #blueprint channel. The app sends no email to anyone.
6. No DevLink nav or footer in v1. A minimal header (logo plus chapter progress) keeps the client in the flow.
7. Client configs are JSON files in the repo, validated on deploy. A new client is a new file plus a passcode set in admin.
8. Brand: build to the brand reference values (#2D7FF9 blue, #D9E8FC tint, #F4527B pink, #0B0C0F ink, #5B6168 slate, white paper), not the current Webflow variables (#0679FF, about #F65B6A, black on #EEE). The live site uses system-ui for headings and body and Caveat Brush for hand-drawn stat numbers; the app does the same. The Webflow variables get synced to the brand reference after Ernest's link goes out.

### New requirements

**R1. Things you love that we didn't show.**
- Every visual chapter (2 feel, 3a color, 3b type, 3c layout, 3d imagery) ends with an optional "Love something we didn't show?" step: a short note, a link, or a screenshot upload. Always skippable.
- Tapping Love on any rated tile reveals an optional one-line "What do you love about it?" Never required.

**R2. Your pages. Chapter 5 becomes "Your pages and offers."**
- Opens with the agreed page list from config (`pages`), shown as cards. For Ernest: Home, About, Process, Family Intervention, Marriage Repair, Estrangement and Adult Child Reconnection, Narcissistic Family Dynamics, Continuing Care, Groups and Cohorts, Book, Contact, Blog.
- Each card: a star for "most excited about" (any number) and an optional note, "What should this page do or include?" (voice memo nudge allowed).
- Then **"Anything else you'd love on the site?"** [multi] podcast page, FAQ, resources or downloads, video, newsletter signup, photo gallery, events, plus [short] other. Options already covered by the agreed list for this client are hidden via config.
- Anything beyond the agreed list gets a warm, neutral line in the app ("Love it. We'll talk through the best way to fit it in.") and becomes a flag for Evan: **"Outside the agreed page list: scope conversation, quoted separately."** No pricing language in the app.
- Privacy and terms pages are carried over and are not shown as cards.

**R3. Config additions:** `pages` (array of `{id, name, group}`), `featureWishOptions` (array, optional override), and `timeTargetMinutes` (default 20).

**R4. Brief export additions:** a "Pages" section (starred pages, per-page notes, wishes beyond scope) and a "Things they love that we didn't show" section (notes, links, uploads), each also reflected in Flags for Evan when relevant.

**R5. Real sites (chapter 4 becomes "Real sites you love").**
- Opens with 4 to 6 curated example sites from config (`examples: [{id, name, url, why}]`), chosen by Evan or Claude per client.
- Each example card: a preview image (screenshot service, with a styled fallback card if it fails), an "Open the site" button that opens a new tab, the rating trio, and on Love or Maybe the "what do you like?" tags (colors, photos, layout, the words, the feeling, easy to use) plus an optional note.
- No iframes: most sites refuse to be embedded.
- Then "If you had to pick one, which feels most like you?" (single choice among the examples), then the client's own favorites (repeat: link plus tags) and one site they don't like, then the logo questions.

**R6. Uploads storage (answer to "where do files go?").** Uploads go to the app's private Webflow Cloud object storage, never the Webflow media library (which is a public CDN). Only the admin view can download them. Assets chosen for the build are moved into the client's site media library by Evan during the build.

### Roadmap (replaces section 14 order)

1. Now: one hand-written config per client.
2. Next: an admin form that builds and validates a client config (no JSON editing).
3. Later: a public, self-serve Blueprint a prospect can take before any call, using industry defaults instead of a config, delivering a brief to Evan. Doubles as a lead magnet on equicityseo.com.
4. Also later: in-app voice recording with transcription, AI-drafted design direction from the answers, multiple people per client, "need help" items pushed to ClickUp.

## 16. Build status, October 8, 2026 (overnight)

Deployed to Webflow Cloud from `main` (app "Equicity Blueprint", mounted at /blueprint). Database tables are created by migration on deploy.

### Built

- Code gate (plain form, works without JavaScript), signed sign-in cookies, attempt limits, friendly errors.
- The client app: welcome, all eight chapters, a halfway checkpoint after chapter 4, "Here's what we heard" review with Edit links, send, and the done screen ("You're all set", next steps, "Evan will send your voice memo prompts next", the timeline).
- Galleries in the client's brand: palettes, type pairings, homepage layouts, imagery (Pexels, credited), real example sites (screenshot preview, "Open the site" in a new tab, rating, tags, notes, closest pick).
- Saves every answer on its own, retries when offline, keeps unsaved changes on the device, and resumes on any device at the last screen.
- Private uploads with progress and remove. Big phone photos are resized on the device; logo and cover files never are.
- A password guard on every text box: if text looks like a login, it is not saved and the client is told to invite Evan instead.
- Admin at /blueprint/admin: sign in, client list with progress, per-client page with link and one-time code, "Open the client view", progress by chapter, flags, files, every answer, history, brief.md download and view, answers.json. Demo answers can be cleared.
- Slack notices (when the webhook is set): first open, and each send.
- noindex header and meta on every response, strict security headers, no other client's config ever reaches the browser.

### Before Ernest's link goes out

1. Add `SESSION_SECRET`, `ADMIN_PASSWORD`, `SLACK_WEBHOOK_URL` and `PUBLIC_ORIGIN` in the Webflow Cloud environment settings.
2. Sign in to /blueprint/admin, run through the demo client on a phone, then open Ernest's client view once (this also warms the example site previews).
3. Create Ernest's code and send the link and code from Evan's inbox.

### Still open

- Ernest's exact gold is a placeholder (#B8913A) until sampled from his logo.
- Client summary PDF, all-files zip, chapter-complete notices and the admin config builder are next week or later, per section 12 and the roadmap.
- Sync the Webflow site color variables to the brand reference after Ernest's link goes out.
