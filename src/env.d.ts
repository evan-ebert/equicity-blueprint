/// <reference types="astro/client" />

type Env = {
  DB: D1Database;
  UPLOADS: R2Bucket;
  /** Long random string used to sign session cookies. Secret. */
  SESSION_SECRET?: string;
  /** Evan's admin password for /blueprint/admin. Secret. */
  ADMIN_PASSWORD?: string;
  /** Slack incoming webhook for the #blueprint channel. Secret. */
  SLACK_WEBHOOK_URL?: string;
  /** Public origin used in Slack links, for example https://equicityseo.com */
  PUBLIC_ORIGIN?: string;
};

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
