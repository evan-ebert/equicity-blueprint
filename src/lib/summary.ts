/**
 * Turns answers into plain words: the client's "Here's what we heard" review, the discovery-brief.md
 * for Evan's Claude project, and the rule-based flags. Shared by browser and server.
 */
import type { ClientConfig } from './config';
import { resolvePalette } from './config';
import { buildChapters, isAnswerable, isVisible, LAYOUTS, TYPE_PAIRINGS, type Answers, type Chapter, type Question } from './chapters';

export type UploadInfo = { id: string; question_id: string; file_name: string; size: number; content_type: string };
export type ReviewItem = { qid: string; label: string; text: string; exit?: 'not-sure' | 'talk' };
export type ReviewSection = { chapterId: string; chapterN: number; screenId: string; title: string; items: ReviewItem[] };

const EXIT_TEXT = { 'not-sure': 'Not sure yet', talk: "Let's talk about it" } as const;

function optLabel(q: { options?: { id: string; label: string }[] }, id: string) {
  return q.options?.find((o) => o.id === id)?.label ?? id;
}

function list(items: string[]) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function sliderWord(v: number, left: string, right: string) {
  if (v <= 20) return `strongly ${left.toLowerCase()}`;
  if (v <= 40) return `leaning ${left.toLowerCase()}`;
  if (v < 60) return `balanced between ${left.toLowerCase()} and ${right.toLowerCase()}`;
  if (v < 80) return `leaning ${right.toLowerCase()}`;
  return `strongly ${right.toLowerCase()}`;
}

export function summarize(q: Question, raw: unknown, c: ClientConfig, uploads: UploadInfo[] = []): string | null {
  const v = raw as any;
  switch (q.type) {
    case 'confirm': {
      const edits = Object.entries(v ?? {}).filter(([k, val]) => k !== 'confirmed' && typeof val === 'string');
      if (!edits.length) return v?.confirmed ? 'Confirmed as shown.' : null;
      return 'Changed: ' + edits.map(([k, val]) => `${q.fields.find((f) => f.id === k)?.label ?? k}: "${val}"`).join('; ');
    }
    case 'tap': {
      if (!v?.choice) return null;
      const label = optLabel(q, v.choice);
      return v.other ? `${label} (${v.other})` : label;
    }
    case 'multi': {
      const picks: string[] = (v?.picks ?? []).map((id: string) => optLabel(q, id));
      if (v?.other) picks.push(`"${v.other}"`);
      return picks.length ? list(picks) : null;
    }
    case 'rate': {
      const entries = Object.entries(v ?? {}) as [string, { r?: string; note?: string; tags?: string[] }][];
      if (!entries.length) return null;
      const name = (id: string) => q.items.find((i) => i.id === id)?.label ?? id;
      const by = (r: string) => entries.filter(([, x]) => x.r === r);
      const fmt = ([id, x]: [string, { note?: string; tags?: string[] }]) => {
        const extras = [x.tags?.length ? `likes the ${list(x.tags.map((t) => t.toLowerCase()))}` : '', x.note ? `"${x.note}"` : ''].filter(Boolean);
        return extras.length ? `${name(id)} (${extras.join('; ')})` : name(id);
      };
      const parts = [];
      if (by('love').length) parts.push(`Loves: ${by('love').map(fmt).join(', ')}`);
      if (by('maybe').length) parts.push(`Maybe: ${by('maybe').map(fmt).join(', ')}`);
      if (by('no').length) parts.push(`Not for them: ${by('no').map(([id]) => name(id)).join(', ')}`);
      return parts.join('. ') + '.';
    }
    case 'sliders': {
      const parts = q.sliders.filter((s) => typeof v?.[s.id] === 'number').map((s) => `${s.left} to ${s.right}: ${sliderWord(v[s.id], s.left, s.right)} (${v[s.id]}/100)`);
      return parts.length ? parts.join('; ') : null;
    }
    case 'rank': {
      const order: string[] = Array.isArray(v) ? v : [];
      return order.length ? order.map((id, i) => `${i + 1}. ${q.items.find((x) => x.id === id)?.label ?? id}`).join(', ') : null;
    }
    case 'short':
    case 'extra': {
      const text = typeof v === 'string' ? v : v?.note;
      const files = uploads.filter((u) => u.question_id === q.id);
      const parts = [text ? `"${text}"` : '', files.length ? `${files.length} file${files.length > 1 ? 's' : ''}: ${files.map((f) => f.file_name).join(', ')}` : ''].filter(Boolean);
      return parts.length ? parts.join('. ') : null;
    }
    case 'upload': {
      const files = uploads.filter((u) => u.question_id === q.id);
      return files.length ? `${files.length} file${files.length > 1 ? 's' : ''}: ${files.map((f) => f.file_name).join(', ')}` : null;
    }
    case 'repeat': {
      const rows: Record<string, unknown>[] = Array.isArray(v) ? v : [];
      if (!rows.length) return null;
      return rows
        .map((row, i) => {
          const bits = q.fields
            .map((f) => {
              const val = row[f.id];
              if (val === undefined || val === '' || val === null) return '';
              if (f.kind === 'check') return val ? f.label : '';
              if (f.kind === 'multi') return (val as string[]).length ? `${f.label.toLowerCase()}: ${list((val as string[]).map((id) => f.options.find((x) => x.id === id)?.label ?? id))}` : '';
              if (f.kind === 'tap') return `${f.label.toLowerCase()}: ${f.options.find((x) => x.id === val)?.label ?? val}`;
              return f.kind === 'url' || f.id === 'name' || f.id === 'show' ? String(val) : `${f.label.toLowerCase()}: "${val}"`;
            })
            .filter(Boolean);
          return `${q.itemLabel} ${i + 1}: ${bits.join('; ')}`;
        })
        .join('\n');
    }
    case 'pages': {
      const starred: string[] = v?.starred ?? [];
      const notes: Record<string, string> = v?.notes ?? {};
      const name = (id: string) => q.pages.find((p) => p.id === id)?.name ?? id;
      const parts = [];
      if (starred.length) parts.push(`Most excited about: ${list(starred.map(name))}`);
      const noted = Object.entries(notes).filter(([, t]) => t?.trim());
      if (noted.length) parts.push(noted.map(([id, t]) => `${name(id)}: "${t}"`).join('; '));
      return parts.length ? parts.join('. ') : null;
    }
    case 'access': {
      const entries = Object.entries(v ?? {}) as [string, { status?: string; detail?: string }][];
      if (!entries.length) return null;
      return entries
        .map(([id, x]) => {
          const item = q.items.find((i) => i.id === id);
          if (!item) return '';
          const status = item.statuses.find((s) => s.id === x.status)?.label ?? 'no status yet';
          let detail = x.detail ?? '';
          if (detail && item.detail?.kind === 'tap') detail = item.detail.options.find((o) => o.id === detail)?.label ?? detail;
          return `${item.title}: ${status}${detail ? ` (${detail})` : ''}`;
        })
        .filter(Boolean)
        .join('; ');
    }
    case 'agree':
      return v === true ? 'Agreed' : null;
    case 'timeline':
      return null;
  }
}

export function buildReview(c: ClientConfig, answers: Answers, uploads: UploadInfo[] = [], chapters: Chapter[] = buildChapters(c)): ReviewSection[] {
  const sections: ReviewSection[] = [];
  for (const ch of chapters) {
    for (const s of ch.screens) {
      if (s.kind === 'welcome') continue;
      const items: ReviewItem[] = [];
      for (const q of s.questions) {
        if (!isAnswerable(q) || !isVisible(q, answers)) continue;
        const a = answers[q.id];
        const text = a ? summarize(q, a.v, c, uploads) : q.type === 'upload' ? summarize(q, null, c, uploads) : null;
        if (text || a?.exit) items.push({ qid: q.id, label: q.label ?? q.title, text: text ?? '', exit: a?.exit });
      }
      sections.push({ chapterId: ch.id, chapterN: ch.n, screenId: s.id, title: s.eyebrow && s.eyebrow !== s.title ? `${ch.title}: ${s.eyebrow}` : ch.title, items });
    }
  }
  return sections;
}

const val = (a: Answers, id: string) => a[id]?.v as any;
const choice = (a: Answers, id: string): string | undefined => val(a, id)?.choice;

export function buildFlags(c: ClientConfig, answers: Answers, uploads: UploadInfo[] = [], chapters: Chapter[] = buildChapters(c)): string[] {
  const flags: string[] = [];
  const add = (s: string) => flags.push(s);

  if (choice(answers, 'logo-plan') === 'new') add('Logo: wants something new. Scope conversation, quoted separately.');
  if (choice(answers, 'calendly') === 'paid') add('Calendly paid tier: pass-through cost, needs approval.');
  if (choice(answers, 'stripe') === 'no' || choice(answers, 'stripe') === 'not-sure') add('Stripe not confirmed: needed if the welcome session takes payment.');
  const testimonials: any[] = val(answers, 'testimonials') ?? [];
  const noPermission = testimonials.filter((t) => t && !t.permission).length;
  if (noPermission) add(`${noPermission} testimonial${noPermission > 1 ? 's' : ''} without permission confirmed: do not build around ${noPermission > 1 ? 'them' : 'it'}.`);
  const access = (val(answers, 'access') ?? {}) as Record<string, { status?: string; detail?: string }>;
  const accessQ = chapters.flatMap((ch) => ch.screens.flatMap((s) => s.questions)).find((q) => q.type === 'access');
  for (const [id, x] of Object.entries(access)) {
    const title = accessQ && accessQ.type === 'access' ? (accessQ.items.find((i) => i.id === id)?.title ?? id) : id;
    if (x.status === 'need-help') add(`Access, ${title}: needs help. Schedule a quick call.`);
    if (x.status === 'none') add(`Access, ${title}: they don't have this. Plan to set it up.`);
  }
  const emailHost = access.email?.detail;
  if (emailHost === 'web-host' || emailHost === 'not-sure' || (c.accessItems.includes('email') && !emailHost)) add('Email host is web host, unknown or not answered: DNS cutover risk. Document MX records before launch.');
  if (choice(answers, 'headshots') === 'none') add('No headshots: discuss photography (outside build scope).');
  if (c.modules.groups && choice(answers, 'groups-ready') && choice(answers, 'groups-ready') !== 'yes') add('Groups: build a "coming soon" state with a waitlist.');
  if (c.modules.book && ['in-progress', 'not-started'].includes(choice(answers, 'book-cover') ?? '')) add('Book cover not final: build the book page with a placeholder cover.');
  if (c.modules.app && ['in-progress', 'paused', 'not-sure'].includes(choice(answers, 'app-status') ?? '')) add(`${c.appName ?? 'App'}: not live. Build a "coming soon" state, no dates promised.`);
  for (const id of ['partner-name', 'partner-logo', 'partner-language']) {
    if (choice(answers, id) === 'ask') add(`${c.partnerName ?? 'Partner'}: "${id.replace('partner-', '')}" needs their OK. Follow up before writing those pages.`);
  }
  const wishes = val(answers, 'feature-wishes');
  const wishList: string[] = [...(wishes?.picks ?? []), ...(wishes?.other ? [wishes.other] : [])];
  if (wishList.length) add(`Outside the agreed page list: ${wishList.join(', ')}. Scope conversation, quoted separately.`);
  if (choice(answers, 'exact-color') === 'paste' && val(answers, 'color-code')) add(`Brand ${c.brand.primaryName} given as ${val(answers, 'color-code')}: update the config and galleries.`);
  if (choice(answers, 'lead-flow') && choice(answers, 'lead-flow') !== c.leadFlowRecommendation && choice(answers, 'lead-flow') !== 'talk') add('Lead flow: picked something other than the recommendation. Confirm on the call.');
  const intake = val(answers, 'intake');
  const intakeCount = (intake?.picks?.length ?? 0) + (intake?.other ? 1 : 0);
  if (intake && (intakeCount < 3 || intakeCount > 5)) add(`Intake form: ${intakeCount} fields picked (target 3 to 5).`);
  if (val(answers, 'weighs-in')?.choice === 'one-other') add(`Another decision maker weighs in: ${val(answers, 'weighs-in-who') || 'name not given'}. Include them in reviews.`);

  // Exits and skipped chapters become the call agenda.
  const talk: string[] = [];
  for (const ch of chapters) {
    for (const s of ch.screens) {
      for (const q of s.questions) {
        const a = answers[q.id];
        if (a?.exit === 'talk') talk.push(q.label ?? q.title);
        else if (a?.exit === 'not-sure') talk.push(`${q.label ?? q.title} (not sure yet)`);
      }
    }
  }
  if (talk.length) add(`For the call: ${talk.join('; ')}.`);
  const skipped = chapters.filter((ch) => ch.screens.flatMap((s) => s.questions).filter((q) => isAnswerable(q) && isVisible(q, answers)).every((q) => !answers[q.id]) && ch.id !== 'welcome');
  if (skipped.length) add(`Chapters not started: ${skipped.map((ch) => `${ch.n}. ${ch.title}`).join(', ')}.`);
  if (!uploads.some((u) => u.question_id === 'logo-files') && answers['logo-files']?.exit !== 'talk') add('No logo files uploaded: pull the logo from the current site.');
  return flags;
}

export function buildBriefMarkdown(c: ClientConfig, answers: Answers, uploads: UploadInfo[], meta: { submittedAt?: string | null; lastActivityAt?: string | null }): string {
  const chapters = buildChapters(c);
  const sections = buildReview(c, answers, uploads, chapters);
  const flags = buildFlags(c, answers, uploads, chapters);
  const lines: string[] = [];
  lines.push(`# Discovery Brief: ${c.business}`);
  lines.push('');
  lines.push(`Client: ${c.firstName}, ${c.business} (${c.domain}). ${meta.submittedAt ? `Sent ${meta.submittedAt} UTC.` : `Not sent yet. Last activity ${meta.lastActivityAt ?? 'never'} UTC.`}`);
  lines.push(`Generated by Equicity Blueprint from the client's own answers. Their words are in quotes.`);
  lines.push('');
  lines.push('## Flags for Evan');
  lines.push('');
  if (flags.length) flags.forEach((f) => lines.push(`- ${f}`));
  else lines.push('- None.');
  lines.push('');

  // Design direction, condensed for whoever builds the homepage.
  const palettes = (val(answers, 'palettes') ?? {}) as Record<string, { r?: string; note?: string }>;
  const loved = Object.entries(palettes).filter(([, x]) => x.r === 'love').map(([id]) => c.palettes.find((p) => p.id === id)).filter(Boolean);
  if (loved.length) {
    lines.push('## Color (loved palettes, with hex values)');
    lines.push('');
    for (const p of loved) {
      const r = resolvePalette(p!, c.brand.primary);
      lines.push(`- ${r.name}: background ${r.bg}, text ${r.text}, accent ${r.accent}, accent text ${r.accentText}, band ${r.band}`);
    }
    lines.push('');
  }
  const typeLoves = Object.entries((val(answers, 'type-pairings') ?? {}) as Record<string, { r?: string }>).filter(([, x]) => x.r === 'love').map(([id]) => TYPE_PAIRINGS.find((t) => t.id === id)?.name ?? id);
  const layoutLoves = Object.entries((val(answers, 'layouts') ?? {}) as Record<string, { r?: string }>).filter(([, x]) => x.r === 'love').map(([id]) => LAYOUTS.find((l) => l.id === id)?.name ?? id);
  if (typeLoves.length || layoutLoves.length) {
    lines.push('## Design direction at a glance');
    lines.push('');
    if (typeLoves.length) lines.push(`- Type: ${typeLoves.join(', ')}`);
    if (layoutLoves.length) lines.push(`- Homepage: ${layoutLoves.join(', ')}`);
    const fav = choice(answers, 'favorite-example');
    if (fav) lines.push(`- Closest real site: ${c.examples.find((e) => e.id === fav)?.name ?? fav} (${c.examples.find((e) => e.id === fav)?.url ?? ''})`);
    lines.push('');
  }

  for (const s of sections) {
    lines.push(`## ${s.title}`);
    lines.push('');
    if (!s.items.length) lines.push('- Nothing answered yet.');
    for (const it of s.items) {
      const exit = it.exit ? ` [${EXIT_TEXT[it.exit]}]` : '';
      if (it.text.includes('\n')) {
        lines.push(`- **${it.label}**${exit}:`);
        it.text.split('\n').forEach((l) => lines.push(`  - ${l}`));
      } else lines.push(`- **${it.label}**${exit}: ${it.text}`);
    }
    lines.push('');
  }

  if (uploads.length) {
    lines.push('## Uploaded files');
    lines.push('');
    uploads.forEach((u) => lines.push(`- ${u.file_name} (${Math.max(1, Math.round(u.size / 1024))} KB, ${u.question_id}). Download from the Blueprint admin.`));
    lines.push('');
  }
  return lines.join('\n');
}
