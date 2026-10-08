import { z } from 'zod';
import { AccessItemIds, resolvePalette } from './shared';

export { AccessItemIds, resolvePalette };

/**
 * One JSON file per client in /configs. Adding a client is a new file plus a passcode set in admin.
 * Palette color values may use "{primary}" to mean the client's brand primary.
 */

const Color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|\{primary\})$/, 'Use a hex color or {primary}');

const Palette = z.object({
  id: z.string(),
  name: z.string(),
  note: z.string(),
  bg: Color,
  text: Color,
  accent: Color,
  accentText: Color,
  onAccent: Color,
  band: Color,
  bandInk: Color,
});

const CustomQuestion = z.object({
  type: z.enum(['tap', 'multi', 'short']),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  hint: z.string().optional(),
  options: z.array(z.string()).optional(),
  max: z.number().int().positive().optional(),
  why: z.string().optional(),
});

const Page = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  group: z.enum(['core', 'services', 'work']),
});

const ImageryTile = z.object({
  id: z.string(),
  label: z.string(),
  src: z.string().url(),
  credit: z.string(),
  creditUrl: z.string().url(),
});

export const ClientConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  firstName: z.string(),
  /** Full name for Evan's admin view and Slack. Clients only ever see their first name. */
  fullName: z.string().optional(),
  business: z.string(),
  businessShort: z.string(),
  domain: z.string(),
  ownerName: z.string().default('Evan'),
  accessEmail: z.string().email(),
  welcomeNote: z.string(),
  timeTargetMinutes: z.number().int().positive().default(20),
  brand: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    primaryName: z.string().default('brand color'),
    primaryConfirmed: z.boolean().default(false),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sampleLine: z.string(),
    sampleHeadline: z.string(),
    sampleCta: z.string(),
    colorWhy: z.string().optional(),
  }),
  palettes: z.array(Palette).min(2).max(6),
  typePairings: z.array(z.string()).optional(),
  layouts: z.array(z.string()).optional(),
  imagery: z.array(ImageryTile).default([]),
  examples: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        name: z.string(),
        url: z.string().url(),
        why: z.string(),
        /** A saved screenshot in /public, for example "examples/hart-to-heart/perel.jpg". */
        image: z.string().regex(/^[a-z0-9/_.-]+\.(jpg|jpeg|png|webp)$/).optional(),
      }),
    )
    .max(8)
    .default([]),
  services: z.array(z.string()).min(1),
  pages: z.array(Page).min(1),
  /** Total services the client can end up with on the pages screen (agreed ones plus any they add). */
  maxServices: z.number().int().positive().default(7),
  featureWishOptions: z.array(z.string()).optional(),
  prefill: z.object({
    nameOnSite: z.string(),
    title: z.string(),
    location: z.string(),
    publicEmail: z.string(),
    phone: z.string().optional(),
    credentials: z.array(z.string()).default([]),
    neverImagery: z.array(z.string()).default([]),
  }),
  workModes: z.array(z.string()).default([]),
  workModesPrompt: z.string().default('Where do you work with clients?'),
  successOptions: z.array(z.string()).min(2),
  feelingPrompt: z.string(),
  feelings: z.array(z.string()).min(3),
  audiences: z.array(z.string()).min(2),
  intakeOptions: z.array(z.string()).min(3),
  leadFlowRecommendation: z.enum(['free-call-first', 'paid-first']).default('free-call-first'),
  leadFlowWhy: z.string().optional(),
  custom: z
    .object({
      feel: z.array(CustomQuestion).default([]),
      offers: z.array(CustomQuestion).default([]),
      proof: z.array(CustomQuestion).default([]),
    })
    .default({}),
  modules: z
    .object({
      groups: z.boolean().default(false),
      book: z.boolean().default(false),
      app: z.boolean().default(false),
      partner: z.boolean().default(false),
      podcasts: z.boolean().default(false),
      testimonials: z.boolean().default(true),
    })
    .default({}),
  partnerName: z.string().optional(),
  appName: z.string().optional(),
  accessItems: z.array(z.enum(AccessItemIds)).min(1),
  dates: z.object({
    allDue: z.string(),
    homepageDirection: z.string(),
    launchWeek: z.string(),
    timeline: z.array(z.object({ label: z.string(), when: z.string() })).min(2),
  }),
  status: z.enum(['active', 'archived']).default('active'),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
export type PaletteConfig = z.infer<typeof Palette>;
export type CustomQuestionConfig = z.infer<typeof CustomQuestion>;

const raw = import.meta.glob('../../configs/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const parsed: Record<string, ClientConfig> = {};
for (const [path, data] of Object.entries(raw)) {
  const result = ClientConfigSchema.safeParse(data);
  if (!result.success) {
    // Fail loudly at build time so a bad config never ships.
    throw new Error(`Invalid client config ${path}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const fileSlug = path.split('/').pop()!.replace(/\.json$/, '');
  if (fileSlug !== result.data.slug) throw new Error(`Config ${path} has slug "${result.data.slug}"; the file name must match.`);
  parsed[result.data.slug] = result.data;
}

export function getClientConfig(slug: string): ClientConfig | null {
  const c = parsed[slug];
  return c && c.status === 'active' ? c : null;
}

export function getAllClientConfigs(): ClientConfig[] {
  return Object.values(parsed).sort((a, b) => a.business.localeCompare(b.business));
}

/** The slice of config the browser needs. Nothing secret lives in configs, but keep the payload lean. */
export function publicConfig(c: ClientConfig) {
  return c;
}
