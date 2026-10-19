# Equicity Blueprint

The private, code-gated discovery experience every Equicity design client goes through before kickoff. It runs on Webflow Cloud at **equicityseo.com/blueprint**, with one link per client (for example `equicityseo.com/blueprint/hart-to-heart`).

The full brief and decisions are in [`docs/brief.md`](docs/brief.md).

## How it works

- **Clients** open their link, enter the code Evan emailed them, and move through eight short chapters. Every answer saves on its own. They can stop and pick up on any device.
- **Evan** signs in at `/blueprint/admin` to set codes, watch progress, read answers, download files and the `brief.md` for the client's Claude project.
- **Slack** gets a message in #blueprint when a client first opens their blueprint and when they send it.
- The app never emails anyone, never asks for a password, and sets `noindex` on every response.

## Add a client

1. Copy `configs/demo.json` to `configs/<slug>.json`. The file name must match `slug`.
2. Fill it in: names, brand color, palettes, example sites, pages, services, access items and dates. The build fails with a clear message if anything is invalid, and it also fails on any em or en dash in client copy.
3. Push to `main`. Webflow Cloud builds and deploys on its own.
4. In `/blueprint/admin`, open the client, tap **Create code**, and copy the link and code into your email.

To close a client's blueprint, set `"status": "archived"` in their config and push. Their link stops working; their answers stay.

## Review rounds

A review round is how a client reacts to a design: one decision, a reaction on each section, then one Send. Rounds live at `/blueprint/<slug>/review/<n>` behind the same code as the blueprint.

1. In the client's admin page, tap **New round**. Paste or upload the round config (see `configs/rounds/hart-to-heart-r1.json` for the shape; item types are decision, section, lines, choice and open). The config is checked on upload: schema, unique ids, 2 to 4 options, and no em or en dashes anywhere.
2. Upload every image the config names (JPG or PNG, up to 10 MB). Your browser makes a 1200 px display copy; the original feeds the full-size viewer. Images are private, served only to that client and to you.
3. **Preview** the round on your phone, then **Open round** and copy the link into your email. After the code, the client lands on the round.
4. When they send, Slack gets the decision, the counts and what needs attention. **Export markdown** gives `review-round-<slug>-r<n>.md` for the client's Claude project. **Reopen** lets them change and send again; every send is kept.

## Settings (Webflow Cloud environment variables)

Set these in the Webflow dashboard under the app's environment settings. Never commit them.

| Name | What it is |
| --- | --- |
| `SESSION_SECRET` | Long random string, at least 24 characters (40+ recommended). Signs sign-in cookies. Changing it signs everyone out. |
| `ADMIN_PASSWORD` | Evan's admin password, at least 10 characters. |
| `SLACK_WEBHOOK_URL` | Incoming webhook for the private #blueprint channel. Optional; without it, nothing is posted. |
| `PUBLIC_ORIGIN` | Optional. `https://equicityseo.com`, so links in Slack and admin use the main domain. |

## Storage

- **D1 (SQLite):** clients, answers, uploads index, events and sign-in attempt limits. Schema in `migrations/`, applied on deploy.
- **R2:** uploaded files, private. Only the admin can download them. Nothing goes to the Webflow media library or CMS.

## Develop locally

```sh
npm install
npm run db:apply:local
# .dev.vars (git-ignored) needs SESSION_SECRET and ADMIN_PASSWORD
npm run dev
npm run check   # copy lint plus type check
node tests/phone-save.mjs     # Part 1: save and resume on a phone (Playwright, dev server running)
node tests/review-round.mjs   # Part 2: review rounds end to end (Playwright, dev server running)
```

Locally the app runs at `http://localhost:4321/<slug>`. On Webflow Cloud everything sits under `/blueprint`.
