// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import copyLint from './scripts/copy-lint-integration.mjs';

// Webflow Cloud sets `base` and the assets prefix from the environment's mount path (/blueprint)
// at build time, so they are deliberately not set here. Every link and fetch uses import.meta.env.BASE_URL.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [react(), copyLint()],
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
});
