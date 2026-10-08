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
```

Locally the app runs at `http://localhost:4321/<slug>`. On Webflow Cloud everything sits under `/blueprint`.
