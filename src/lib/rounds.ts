/**
 * Review rounds: the config a round is built from, how answers are shaped, and the summaries Evan reads
 * (review screen, Slack, markdown export). Pure: shared by the browser and the server.
 */
import { z } from 'zod';
import { findBanned } from '../../scripts/copy-banned.mjs';
import type { Answers, AnswerValue } from './chapters';

export type { Answers, AnswerValue };

const ID = /^[a-z0-9-]{1,48}$/;
const IMAGE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}\.(jpe?g|png)$/;
const Id = z.string().regex(ID, 'Use lowercase letters, numbers and dashes');
const ImageName = z.string().regex(IMAGE_NAME, 'Image names are lowercase, end in .jpg or .png, and have no spaces');
const Text = z.string().trim().min(1, 'Add a line of text');

/** `label` is a short name for the review screen and export when the prompt is long. */
const Base = { id: Id, label: z.string().trim().min(1).max(80).optional() };

export const DecisionItem = z.object({
  ...Base,
  type: z.literal('decision'),
  required: z.boolean().default(false),
  prompt: Text,
  options: z.array(z.object({ key: z.string().trim().min(1).max(12), image: ImageName, label: Text, description: z.string().optional() })).min(2, 'Give 2 to 4 options').max(4, 'Give 2 to 4 options'),
  notePrompt: z.string().optional(),
});
export const SectionItem = z.object({ ...Base, type: z.literal('section'), image: ImageName, title: Text, about: z.string().optional() });
export const LinesItem = z.object({ ...Base, type: z.literal('lines'), prompt: Text, lines: z.array(Text).min(1, 'Add at least one line').max(12), notePrompt: z.string().optional() });
export const ChoiceItem = z.object({ ...Base, type: z.literal('choice'), prompt: Text, options: z.array(Text).min(2, 'Give 2 to 4 options').max(4, 'Give 2 to 4 options'), notePrompt: z.string().optional() });
export const OpenItem = z.object({ ...Base, type: z.literal('open'), prompt: Text });

export const RoundItem = z.discriminatedUnion('type', [DecisionItem, SectionItem, LinesItem, ChoiceItem, OpenItem]);
export const RoundScreen = z.object({ id: Id, title: Text, intro: z.string().optional(), items: z.array(RoundItem).min(1, 'Add at least one item') });

export const RoundConfigSchema = z.object({
  round: z.number().int().positive(),
  title: Text,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  estimate: z.string().optional(),
  intro: Text,
  doneNote: Text,
  screens: z.array(RoundScreen).min(1, 'Add at least one screen'),
});

export type RoundConfig = z.infer<typeof RoundConfigSchema>;
export type RoundItemDef = z.infer<typeof RoundItem>;
export type RoundScreenDef = z.infer<typeof RoundScreen>;
export type Rating = 'love' | 'maybe' | 'no';

export const RATING_TEXT: Record<Rating, string> = { love: 'Love it', maybe: 'Maybe', no: 'Not for me' };
export const SECTION_TAGS = ['Photo', 'Words', 'Layout', 'Colors'];

/** Walk every string in a value, reporting the path of each one. */
function* strings(value: unknown, path: string[] = []): Generator<[string[], string]> {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value)) for (let i = 0; i < value.length; i++) yield* strings(value[i], [...path, String(i)]);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, [...path, k]);
}

function describePath(path: (string | number)[], config: unknown): string {
  // Turn screens.1.items.3.about into "screen home, item home-work, about" where ids are available.
  const parts: string[] = [];
  let cursor: any = config;
  for (let i = 0; i < path.length; i++) {
    const key = String(path[i]);
    cursor = cursor?.[key];
    if ((path[i - 1] === 'screens' || path[i - 1] === 'items' || path[i - 1] === 'options') && cursor && typeof cursor === 'object') {
      const label = cursor.id ?? cursor.key ?? cursor.label;
      parts[parts.length - 1] = `${String(path[i - 1]).replace(/s$/, '')} ${label ?? Number(key) + 1}`;
    } else if (/^\d+$/.test(key)) {
      parts[parts.length - 1] = `${parts[parts.length - 1]} ${Number(key) + 1}`;
    } else parts.push(key);
  }
  return parts.join(', ');
}

export type Validation = { ok: true; config: RoundConfig } | { ok: false; problems: string[] };

/** Check a config the way the build checks the repo: the schema, unique ids, and no em or en dashes anywhere. */
export function validateRoundConfig(raw: unknown): Validation {
  const problems: string[] = [];
  const parsed = RoundConfigSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path.length ? describePath(issue.path, raw) : 'the config';
      let msg = issue.message;
      if (issue.code === 'invalid_union_discriminator') msg = 'type must be one of decision, section, lines, choice or open';
      if (issue.code === 'invalid_type' && issue.received === 'undefined') msg = 'is missing';
      problems.push(`${where}: ${msg}`);
    }
  }
  for (const [path, text] of strings(raw)) {
    for (const name of findBanned(text)) problems.push(`${describePath(path, raw)} has an ${name}: "${text.length > 70 ? text.slice(0, 70) + '...' : text}"`);
  }
  if (parsed.success) {
    const seen = new Map<string, string>();
    for (const s of parsed.data.screens) {
      if (seen.has(s.id)) problems.push(`Two screens share the id "${s.id}"`);
      seen.set(s.id, 'screen');
      for (const it of s.items) {
        if (seen.has(it.id)) problems.push(`The id "${it.id}" is used more than once`);
        seen.set(it.id, 'item');
        if (it.type === 'decision') {
          const keys = new Set(it.options.map((o) => o.key));
          if (keys.size !== it.options.length) problems.push(`Decision "${it.id}" has two options with the same key`);
        }
      }
    }
    if (parsed.data.screens.filter((s) => s.items.some((i) => i.type === 'decision')).length > 1) problems.push('Keep decisions on one screen so the client sees them together');
  }
  if (!problems.length && parsed.success) return { ok: true, config: parsed.data };
  return { ok: false, problems: [...new Set(problems)] };
}

export function parseRoundConfig(json: string): RoundConfig | null {
  try {
    const r = validateRoundConfig(JSON.parse(json));
    return r.ok ? r.config : null;
  } catch {
    return null;
  }
}

/** Every image name the config mentions, in order, without repeats. */
export function configImages(config: RoundConfig): string[] {
  const out: string[] = [];
  for (const s of config.screens)
    for (const it of s.items) {
      if (it.type === 'section' && !out.includes(it.image)) out.push(it.image);
      if (it.type === 'decision') for (const o of it.options) if (!out.includes(o.image)) out.push(o.image);
    }
  return out;
}

export function flatItems(config: RoundConfig): { screen: RoundScreenDef; item: RoundItemDef }[] {
  return config.screens.flatMap((screen) => screen.items.map((item) => ({ screen, item })));
}

export function findItem(config: RoundConfig, id: string): RoundItemDef | undefined {
  return flatItems(config).find((x) => x.item.id === id)?.item;
}

// ---------- answer shapes ----------

export type DecisionAnswer = { pick?: string; note?: string };
export type SectionAnswer = { r?: Rating; tags?: string[]; note?: string };
export type LinesAnswer = { r?: Record<string, Rating>; note?: string };
export type ChoiceAnswer = { pick?: string; note?: string };
export type OpenAnswer = { text?: string };

const Rate = z.enum(['love', 'maybe', 'no']);
const Note = z.string().max(4000).optional();
const AnswerShapes = {
  decision: z.object({ pick: z.string().max(12).optional(), note: Note }).strict(),
  section: z.object({ r: Rate.optional(), tags: z.array(z.string().max(24)).max(8).optional(), note: Note }).strict(),
  lines: z.object({ r: z.record(z.string().regex(/^\d{1,2}$/), Rate).optional(), note: Note }).strict(),
  choice: z.object({ pick: z.string().max(200).optional(), note: Note }).strict(),
  open: z.object({ text: z.string().max(8000).optional() }).strict(),
};

/** Check one saved value against its item. Returns a message when it doesn't fit. */
export function checkRoundAnswer(config: RoundConfig, itemId: string, value: AnswerValue): string | null {
  if (itemId === '_pos') return typeof value.v === 'string' && value.v.length <= 80 ? null : 'Bad position';
  if (itemId === '_visited') return Array.isArray(value.v) && value.v.every((x) => typeof x === 'string') && value.v.length <= 60 ? null : 'Bad visited list';
  const item = findItem(config, itemId);
  if (!item) return 'Unknown item';
  const r = AnswerShapes[item.type].safeParse(value.v ?? {});
  if (!r.success) return 'Bad value';
  const pick = (r.data as { pick?: string }).pick;
  if (item.type === 'decision' && pick !== undefined && !item.options.some((o) => o.key === pick)) return 'Bad pick';
  if (item.type === 'choice' && pick !== undefined && !item.options.includes(pick)) return 'Bad pick';
  return null;
}

export function visitedRoundScreens(a: Answers): Set<string> {
  const v = a._visited?.v;
  return new Set(Array.isArray(v) ? (v as string[]) : []);
}

// ---------- summaries ----------

export type ItemSummary = {
  id: string;
  type: RoundItemDef['type'];
  title: string;
  /** The short answer: "Love it", "B (opens with you)", "Right amount", or "" when there is none. */
  answer: string;
  rating?: Rating;
  tags: string[];
  note?: string;
  /** For lines: each line with its rating. */
  lines?: { text: string; rating?: Rating }[];
  /** A section or line list with nothing on it counts as approved. */
  approved: boolean;
  required: boolean;
  answered: boolean;
};
export type ScreenSummary = { id: string; title: string; items: ItemSummary[] };
export type Counts = { love: number; maybe: number; no: number; none: number };
export type RoundSummary = { screens: ScreenSummary[]; counts: Counts; attention: string[]; decision?: ItemSummary; missing: ItemSummary[] };

const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);

export function summarizeItem(item: RoundItemDef, raw: AnswerValue | undefined): ItemSummary {
  const v = (raw?.v ?? {}) as Record<string, unknown>;
  const base = { id: item.id, type: item.type, tags: [] as string[], required: item.type === 'decision' && item.required, approved: false };
  switch (item.type) {
    case 'decision': {
      const a = v as DecisionAnswer;
      const opt = item.options.find((o) => o.key === a.pick);
      return { ...base, title: item.label ?? item.prompt, answer: opt ? `${opt.key} (${opt.label.replace(/^[A-Z]:\s*/, '').replace(/^[A-Z]/, (c) => c.toLowerCase())})` : '', note: clean(a.note), answered: !!opt };
    }
    case 'section': {
      const a = v as SectionAnswer;
      return { ...base, title: item.label ?? item.title, answer: a.r ? RATING_TEXT[a.r] : '', rating: a.r, tags: a.tags ?? [], note: clean(a.note), approved: !a.r && !clean(a.note), answered: !!a.r || !!clean(a.note) };
    }
    case 'lines': {
      const a = v as LinesAnswer;
      const lines = item.lines.map((text, i) => ({ text, rating: a.r?.[String(i)] }));
      const rated = lines.filter((l) => l.rating).length;
      return { ...base, title: item.label ?? item.prompt, answer: rated ? `${rated} of ${lines.length} rated` : '', lines, note: clean(a.note), approved: rated === 0 && !clean(a.note), answered: rated > 0 || !!clean(a.note) };
    }
    case 'choice': {
      const a = v as ChoiceAnswer;
      return { ...base, title: item.label ?? item.prompt, answer: a.pick && item.options.includes(a.pick) ? a.pick : '', note: clean(a.note), answered: !!a.pick };
    }
    case 'open': {
      const a = v as OpenAnswer;
      return { ...base, title: item.label ?? item.prompt, answer: clean(a.text) ?? '', answered: !!clean(a.text) };
    }
  }
}

export function buildRoundSummary(config: RoundConfig, answers: Answers): RoundSummary {
  const counts: Counts = { love: 0, maybe: 0, no: 0, none: 0 };
  const attention: string[] = [];
  let decision: ItemSummary | undefined;
  const missing: ItemSummary[] = [];
  const screens: ScreenSummary[] = config.screens.map((s) => ({
    id: s.id,
    title: s.title,
    items: s.items.map((item) => {
      const sum = summarizeItem(item, answers[item.id]);
      if (sum.type === 'section') {
        if (sum.rating) counts[sum.rating]++;
        else counts.none++;
        if (sum.rating === 'no' || (sum.rating === 'maybe' && (sum.note || sum.tags.length))) attention.push(sum.tags.length ? `${sum.title} (${sum.tags.join(', ')})` : sum.title);
      }
      if (sum.type === 'lines' && sum.lines) {
        for (const l of sum.lines) {
          if (l.rating) counts[l.rating]++;
          else counts.none++;
          if (l.rating === 'no') attention.push(`Line: ${l.text}`);
        }
      }
      if (sum.type === 'decision' && !decision) decision = sum;
      if (sum.required && !sum.answered) missing.push(sum);
      return sum;
    }),
  }));
  return { screens, counts, attention, decision, missing };
}

export type RoundChange = { id: string; title: string; before: string; after: string };

function itemText(sum: ItemSummary): string {
  const parts: string[] = [];
  if (sum.type === 'lines' && sum.lines) parts.push(sum.lines.map((l) => `${l.rating ? RATING_TEXT[l.rating] : 'No comment'}: ${l.text}`).join(' / '));
  else if (sum.type === 'section') parts.push(sum.answer || 'No comments (approved)');
  else parts.push(sum.answer || '(blank)');
  if (sum.tags.length) parts.push(`Tags: ${sum.tags.join(', ')}`);
  if (sum.note) parts.push(`Note: "${sum.note}"`);
  return parts.join('. ');
}

export function diffRoundAnswers(config: RoundConfig, before: Answers, after: Answers): RoundChange[] {
  const out: RoundChange[] = [];
  for (const { item } of flatItems(config)) {
    if (JSON.stringify(before[item.id] ?? null) === JSON.stringify(after[item.id] ?? null)) continue;
    const b = itemText(summarizeItem(item, before[item.id]));
    const a = itemText(summarizeItem(item, after[item.id]));
    if (b !== a) out.push({ id: item.id, title: summarizeItem(item, undefined).title, before: b, after: a });
  }
  return out;
}

// ---------- dates and text ----------

export function longDate(s: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!s) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return s;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}), ...(dateOnly ? { timeZone: 'UTC' } : { timeZone: 'America/Los_Angeles' }) });
}

export function countsText(c: Counts): string {
  return `Loved: ${c.love}. Maybe: ${c.maybe}. Not for me: ${c.no}. No comments: ${c.none}.`;
}

/** The export Evan pastes into the client's Claude project. */
export function buildRoundMarkdown(
  config: RoundConfig,
  answers: Answers,
  meta: { business: string; number: number; submittedAt?: string | null; openedAt?: string | null; firstSent?: { at: string; answers: Answers } },
): string {
  const sum = buildRoundSummary(config, answers);
  const L: string[] = [];
  L.push(`# Review Round ${meta.number}: ${meta.business}, ${config.title.replace(/^[A-Z]/, (c) => c.toLowerCase())}`);
  L.push(`${meta.submittedAt ? `Submitted ${longDate(meta.submittedAt, { year: true })}.` : 'Not sent yet.'}${meta.openedAt ? ` Opened ${longDate(meta.openedAt)}.` : ''}`);
  L.push('');
  for (const screen of sum.screens) {
    const decisions = screen.items.filter((i) => i.type === 'decision');
    const rest = screen.items.filter((i) => i.type !== 'decision');
    for (const d of decisions) {
      L.push(`## Decision: ${d.title.replace(/\?$/, '').replace(/^[A-Z]/, (c) => c.toLowerCase())}`);
      L.push(`Picked: ${d.answer || 'nothing yet'}`);
      if (d.note) L.push(`Note: "${d.note}"`);
      L.push('');
    }
    if (!rest.length) continue;
    L.push(`## ${screen.title}`);
    for (const it of rest) {
      if (it.type === 'section') {
        L.push(`### ${it.title}: ${it.rating ? RATING_TEXT[it.rating] : 'no comments (approved)'}`);
        if (it.tags.length) L.push(`Tags: ${it.tags.join(', ')}`);
        if (it.note) L.push(`Note: "${it.note}"`);
      } else if (it.type === 'lines' && it.lines) {
        L.push(`### ${it.title}`);
        for (const l of it.lines) L.push(`- ${l.rating ? RATING_TEXT[l.rating] : 'No comment'}: ${l.text}`);
        if (it.note) L.push(`Note: "${it.note}"`);
      } else if (it.type === 'choice') {
        L.push(`### ${it.title}: ${it.answer || 'no answer'}`);
        if (it.note) L.push(`Note: "${it.note}"`);
      } else if (it.type === 'open') {
        L.push(`### ${it.title}`);
        L.push(it.answer ? `"${it.answer}"` : 'Nothing added.');
      }
    }
    L.push('');
  }
  L.push('## Summary');
  L.push(countsText(sum.counts));
  L.push(`Needs attention: ${sum.attention.length ? sum.attention.join(', ') : 'nothing flagged'}`);
  L.push('');
  if (meta.firstSent) {
    const changes = diffRoundAnswers(config, meta.firstSent.answers, answers);
    if (changes.length) {
      L.push('## Changed since the first send');
      L.push(`First sent ${longDate(meta.firstSent.at, { year: true })}.`);
      for (const c of changes) L.push(`- ${c.title}: was ${c.before}; now ${c.after}`);
      L.push('');
    }
  }
  return L.join('\n');
}

/** The Slack message when a round is sent. */
export function buildRoundSlack(config: RoundConfig, answers: Answers, meta: { who: string; number: number; adminUrl: string; resend: boolean; changes: RoundChange[] }): string {
  const sum = buildRoundSummary(config, answers);
  const lines: string[] = [];
  lines.push(`${meta.who} ${meta.resend ? 'sent an update to' : 'sent'} Round ${meta.number}: ${config.title}.`);
  if (sum.decision) lines.push(`Decision: ${sum.decision.answer || 'none'}${sum.decision.note ? ` ("${sum.decision.note}")` : ''}`);
  lines.push(countsText(sum.counts));
  if (sum.attention.length) {
    lines.push('', `*Needs attention (${sum.attention.length})*`);
    sum.attention.forEach((a) => lines.push(`• ${a}`));
  }
  if (meta.resend) lines.push('', meta.changes.length ? `Changed: ${meta.changes.map((c) => c.title).join(', ')}` : 'Nothing changed since the last send.');
  lines.push('', meta.adminUrl);
  return lines.join('\n');
}
