/**
 * The Blueprint question library. One function turns a client config into chapters, screens and questions.
 * Shared by the browser (to render) and the server (to summarize and flag), so keep it pure.
 */
import type { ClientConfig, CustomQuestionConfig } from './config';
import { AccessItemIds } from './config';

export type Opt = { id: string; label: string };
export type AnswerValue = { v: unknown; exit?: 'not-sure' | 'talk' };
export type Answers = Record<string, AnswerValue | undefined>;

export type RepeatField =
  | { id: string; label: string; kind: 'text' | 'url' | 'textarea'; placeholder?: string }
  | { id: string; label: string; kind: 'tap' | 'multi'; options: Opt[] }
  | { id: string; label: string; kind: 'check' };

export type AccessItemDef = {
  id: (typeof AccessItemIds)[number];
  title: string;
  steps: string[];
  detail?: { kind: 'short'; label: string; placeholder?: string } | { kind: 'tap'; label: string; options: Opt[] };
  statuses: Opt[];
};

type Base = {
  id: string;
  title: string;
  hint?: string;
  /** Show "Not sure yet" and "Let's talk about it". */
  exits?: boolean;
  /** Replace the default exits with custom ones (still recorded as an exit). */
  exitLabels?: { notSure?: string; talk?: string };
  showIf?: (a: Answers) => boolean;
  /** Short label used in the review screen and brief. */
  label?: string;
};

export type Question =
  | (Base & { type: 'confirm'; fields: { id: string; label: string; value: string; inputType?: 'text' | 'email' }[] })
  | (Base & { type: 'tap'; options: Opt[]; recommended?: string; notes?: Record<string, string>; other?: boolean })
  | (Base & { type: 'multi'; options: Opt[]; max?: number; min?: number; other?: boolean; defaultAll?: boolean; anyNote?: string })
  | (Base & { type: 'rate'; gallery: 'palette' | 'type' | 'layout' | 'imagery' | 'example'; items: Opt[]; tags?: Opt[] })
  | (Base & { type: 'sliders'; sliders: { id: string; left: string; right: string }[] })
  | (Base & { type: 'rank'; items: Opt[] })
  | (Base & { type: 'short'; placeholder?: string; multiline?: boolean; inputType?: 'text' | 'url' | 'email' | 'date' })
  | (Base & { type: 'upload'; accept: string; help: string; multiple: boolean })
  | (Base & { type: 'repeat'; fields: RepeatField[]; addLabel: string; itemLabel: string; max: number })
  | (Base & { type: 'pages'; pages: { id: string; name: string; group: 'core' | 'services' | 'work' }[] })
  | (Base & { type: 'access'; items: AccessItemDef[] })
  | (Base & { type: 'agree'; points: string[]; agreeLabel: string })
  | (Base & { type: 'timeline'; items: { label: string; when: string }[] })
  | (Base & { type: 'extra'; placeholder: string });

export type Screen = { id: string; eyebrow?: string; title: string; lead?: string; why?: string; questions: Question[]; kind?: 'welcome' };
export type Chapter = { id: string; n: number; title: string; minutes: number; screens: Screen[] };

const o = (label: string, id?: string): Opt => ({ id: id ?? slugify(label), label });
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export const LIKE_TAGS: Opt[] = ['Colors', 'Photos', 'Layout', 'The words', 'The feeling', 'Easy to use'].map((l) => o(l));
export const TYPE_PAIRINGS: { id: string; name: string; note: string }[] = [
  { id: 'classic-serif', name: 'Classic serif headings, clean body', note: 'Established and trustworthy' },
  { id: 'humanist', name: 'Soft, rounded sans throughout', note: 'Friendly and approachable' },
  { id: 'editorial', name: 'Editorial high-contrast serif', note: 'Thoughtful and literary' },
  { id: 'geometric', name: 'Modern geometric sans', note: 'Clear and current' },
];
export const LAYOUTS: { id: string; name: string; note: string }[] = [
  { id: 'portrait', name: 'Your portrait beside the headline', note: 'Leads with you, warm and personal' },
  { id: 'photo', name: 'Full-width photo, headline over it', note: 'Atmospheric, needs one great photo' },
  { id: 'editorial', name: 'Text-led, editorial', note: 'Words first, a small image as a quiet accent' },
  { id: 'video', name: 'A short, quiet looping video', note: 'From your YouTube or podcast clips' },
  { id: 'quote', name: 'A client quote front and center', note: 'Lets the people you helped speak first' },
  { id: 'minimal', name: 'Minimal, soft texture, lots of space', note: 'Quiet and spacious' },
];

function customToQuestion(c: CustomQuestionConfig): Question {
  const base = { id: c.id, title: c.title, hint: c.hint, exits: true };
  if (c.type === 'short') return { ...base, type: 'short', multiline: true };
  const options = (c.options ?? []).map((l) => o(l));
  if (c.type === 'multi') return { ...base, type: 'multi', options, max: c.max };
  return { ...base, type: 'tap', options };
}

const picked = (a: Answers, id: string, opt: string) => {
  const v = a[id]?.v as { choice?: string } | undefined;
  return v?.choice === opt;
};
const pickedAny = (a: Answers, id: string, opts: string[]) => opts.some((x) => picked(a, id, x));

function accessItems(c: ClientConfig): AccessItemDef[] {
  const email = c.accessEmail;
  const standard: Opt[] = [o('Done'), o("I'll do it this week", 'week'), o('Need help'), o("Don't have this", 'none')];
  const all: Record<(typeof AccessItemIds)[number], AccessItemDef> = {
    wordpress: {
      id: 'wordpress',
      title: 'WordPress',
      steps: ['Log in to your WordPress dashboard and open Users, then Add New User.', `Use ${email}, choose the Administrator role, and save.`],
      statuses: standard,
    },
    host: {
      id: 'host',
      title: 'Your current web host',
      steps: ['Just tell us who hosts the site today. No login needed.'],
      detail: { kind: 'short', label: 'Who is your host?', placeholder: 'For example GoDaddy, Bluehost, SiteGround' },
      statuses: [o('Done'), o('Not sure', 'none')],
    },
    registrar: {
      id: 'registrar',
      title: `Your domain, ${c.domain}`,
      steps: ['Tell us where the domain is registered.', 'When we launch, we will either send a delegate access invite to your account or do a 10 minute screen share together.'],
      detail: { kind: 'tap', label: 'Where is it registered?', options: [o('GoDaddy'), o('Namecheap'), o('Squarespace'), o('Other'), o('Not sure')] },
      statuses: [o('Done'), o('Need help'), o('Not sure', 'none')],
    },
    email: {
      id: 'email',
      title: 'Your email',
      steps: ['Where your email lives keeps it working when we switch the site over.'],
      detail: { kind: 'tap', label: 'Where does your email live?', options: [o('Google Workspace'), o('Microsoft 365'), o('Through my web host', 'web-host'), o('Not sure')] },
      statuses: [o('Done'), o('Need help')],
    },
    gbp: {
      id: 'gbp',
      title: 'Google Business Profile',
      steps: ['Open your profile on Google and tap Menu, then Business Profile settings.', 'Choose People and access, then Add.', `Invite ${email} as a Manager.`],
      statuses: standard,
    },
    'gsc-ga': {
      id: 'gsc-ga',
      title: 'Search Console and Analytics',
      steps: [`In Search Console, open Settings, then Users and permissions, and add ${email} as Full.`, `In Google Analytics, open Admin, then Property access management, and add ${email} as an Editor.`, 'No accounts yet? Pick "Don\'t have this" and we will set them up new.'],
      statuses: standard,
    },
    calendly: {
      id: 'calendly',
      title: 'Calendly',
      steps: ['Paste the links to the event types you use, or add us to your Calendly team if you have one.'],
      detail: { kind: 'short', label: 'Your Calendly links', placeholder: 'https://calendly.com/...' },
      statuses: standard,
    },
    youtube: {
      id: 'youtube',
      title: 'YouTube',
      steps: ['Just the link to your channel. No access needed.'],
      detail: { kind: 'short', label: 'Channel link', placeholder: 'https://youtube.com/@...' },
      statuses: [o('Done'), o("Don't have this", 'none')],
    },
  };
  return c.accessItems.map((id) => all[id]);
}

export function buildChapters(c: ClientConfig): Chapter[] {
  const first = c.firstName;
  const color = c.brand.primaryName;
  const chapters: Chapter[] = [];

  // 1. Welcome and what we already know
  chapters.push({
    id: 'welcome',
    n: 1,
    title: 'Welcome',
    minutes: 2,
    screens: [
      { id: 'welcome', kind: 'welcome', title: `Hi ${first}, let's shape your new site together.`, questions: [] },
      {
        id: 'basics',
        eyebrow: 'What we already know',
        title: 'Does this look right?',
        lead: 'Tap any line to fix it. These go on the site as written.',
        questions: [
          {
            type: 'confirm',
            id: 'basics',
            title: 'The basics',
            label: 'Basics',
            fields: [
              { id: 'business', label: 'Business name', value: c.business },
              { id: 'nameOnSite', label: 'Your name and credentials on the site', value: c.prefill.nameOnSite },
              { id: 'title', label: 'Your title', value: c.prefill.title },
              { id: 'location', label: 'Based in', value: c.prefill.location },
              { id: 'publicEmail', label: 'Public email on the site', value: c.prefill.publicEmail, inputType: 'email' },
            ],
          },
          { type: 'tap', id: 'show-phone', title: 'Show a phone number on the site?', label: 'Phone on the site', options: [o('Yes'), o('No')], exits: true },
          ...(c.workModes.length ? [{ type: 'multi', id: 'work-modes', title: c.workModesPrompt, label: 'Where you work', options: c.workModes.map((l) => o(l)) } as Question] : []),
          {
            type: 'multi',
            id: 'success',
            title: 'A year from now, the new site is working if...',
            label: 'What success looks like',
            hint: 'Pick up to 2',
            max: 2,
            other: true,
            options: c.successOptions.map((l) => o(l)),
          },
        ],
      },
    ],
  });

  // 2. The feel
  chapters.push({
    id: 'feel',
    n: 2,
    title: 'The feel',
    minutes: 3,
    screens: [
      {
        id: 'feel',
        title: 'How should your site feel?',
        why: 'Most redesigns go sideways on feel, not features. Getting this right first makes every page easier.',
        questions: [
          { type: 'multi', id: 'first-feeling', title: c.feelingPrompt, label: 'First feeling', hint: 'Pick up to 3', max: 3, other: true, options: c.feelings.map((l) => o(l)) },
          {
            type: 'sliders',
            id: 'feel-sliders',
            title: 'Slide toward what feels right',
            label: 'Feel',
            sliders: [
              { id: 'energy', left: 'Calm', right: 'Energetic' },
              { id: 'tone', left: 'Warm and personal', right: 'Expert and clinical' },
              { id: 'era', left: 'Classic', right: 'Modern' },
              { id: 'density', left: 'Quiet and minimal', right: 'Rich and layered' },
              { id: 'lead', left: `Leads with you`, right: 'Leads with the people you help' },
            ],
          },
          { type: 'rank', id: 'audiences', title: 'Who should the site speak to first?', label: 'Who it speaks to first', hint: 'Drag to reorder, or use the arrows', items: c.audiences.map((l) => o(l)), exits: true },
          ...c.custom.feel.map(customToQuestion),
          { type: 'short', id: 'words-like', title: 'Words that feel like you', label: 'Words that feel like them', hint: 'Optional', placeholder: 'Steady, honest, warm' },
          { type: 'short', id: 'words-avoid', title: 'Words to avoid', label: 'Words to avoid', hint: 'Optional', placeholder: 'Anything that feels off' },
          { type: 'tap', id: 'weighs-in', title: 'Who else weighs in on the site?', label: 'Who weighs in', options: [o('Just me'), o('Me and one other person', 'one-other')] },
          { type: 'short', id: 'weighs-in-who', title: 'Their name and role', label: 'Other decision maker', placeholder: 'For example, my wife, co-owner', showIf: (a) => picked(a, 'weighs-in', 'one-other') },
          { type: 'extra', id: 'feel-extra', title: 'Love a feeling we didn\'t name?', label: 'Feelings we missed', placeholder: 'A word, a phrase, or a site that feels right' },
        ],
      },
    ],
  });

  // 3. The look
  const lookScreens: Screen[] = [
    {
      id: 'color',
      eyebrow: 'Color',
      title: `Ways to wear your ${color}`,
      lead: 'Each one is a slice of your homepage. Go with your gut.',
      why: c.brand.colorWhy ?? `Your ${color} does the most work on buttons and accents. We pair it with a strong color for words so everything stays easy to read.`,
      questions: [
        { type: 'rate', id: 'palettes', title: 'Rate each palette', label: 'Color palettes', gallery: 'palette', items: c.palettes.map((p) => ({ id: p.id, label: p.name })) },
        {
          type: 'tap',
          id: 'exact-color',
          title: `Do you know your exact ${color}?`,
          label: `Exact ${color}`,
          options: [o("I'll paste the color code", 'paste'), o(`Use the ${color} from my logo`, 'logo'), o('Not sure, you pick', 'you-pick')],
        },
        { type: 'short', id: 'color-code', title: 'Your color code', label: 'Color code', placeholder: 'For example #B8913A', showIf: (a) => picked(a, 'exact-color', 'paste') },
        { type: 'extra', id: 'color-extra', title: 'Love a color combo we didn\'t show?', label: 'Colors we missed', placeholder: 'Describe it, or paste a link' },
      ],
    },
    {
      id: 'type',
      eyebrow: 'Type',
      title: 'Which lettering feels like you?',
      lead: `Each sample uses your business name.`,
      why: 'Type sets the voice before anyone reads a word. All of these are free web fonts, so none add a cost.',
      questions: [
        { type: 'rate', id: 'type-pairings', title: 'Rate each pairing', label: 'Type', gallery: 'type', items: TYPE_PAIRINGS.filter((t) => !c.typePairings || c.typePairings.includes(t.id)).map((t) => ({ id: t.id, label: t.name })) },
        { type: 'extra', id: 'type-extra', title: 'Love a font or lettering we didn\'t show?', label: 'Type we missed', placeholder: 'A font name, or a site whose lettering you love' },
      ],
    },
    {
      id: 'layout',
      eyebrow: 'Homepage layout',
      title: 'How should your homepage open?',
      lead: 'Shown in the palette and type you liked best so far.',
      why: 'Go with your gut. We read patterns across your answers, not any single tile literally.',
      questions: [
        { type: 'rate', id: 'layouts', title: 'Rate each layout', label: 'Homepage layouts', gallery: 'layout', items: LAYOUTS.filter((l) => !c.layouts || c.layouts.includes(l.id)).map((l) => ({ id: l.id, label: l.name })) },
        { type: 'tap', id: 'page-rhythm', title: 'How should pages read?', label: 'Page rhythm', options: [o('Short and scannable', 'short'), o('Longer and story-driven', 'long'), o('A mix', 'mix')], exits: true },
        { type: 'extra', id: 'layout-extra', title: 'Love a layout we didn\'t show?', label: 'Layouts we missed', placeholder: 'Describe it, or paste a link' },
      ],
    },
  ];
  const imageryQuestions: Question[] = [];
  if (c.imagery.length) {
    imageryQuestions.push({ type: 'rate', id: 'imagery', title: 'Rate each style', label: 'Imagery styles', gallery: 'imagery', items: c.imagery.map((i) => ({ id: i.id, label: i.label })) });
  }
  imageryQuestions.push(
    {
      type: 'multi',
      id: 'never-imagery',
      title: 'Images we should never use',
      label: 'Never use',
      hint: 'We started the list. Untick anything you disagree with, and add your own.',
      options: c.prefill.neverImagery.map((l) => o(l)),
      defaultAll: true,
      other: true,
    },
    { type: 'tap', id: 'headshots', title: 'Do you have headshots?', label: 'Headshots', options: [o('Recent and professional', 'recent'), o('Older but professional', 'older'), o('None yet', 'none')] },
    { type: 'tap', id: 'owned-photos', title: 'Do you have photos from speaking, podcasts or events?', label: 'Photos on hand', options: [o("Yes, I'll add them in chapter 7", 'yes'), o('No', 'no')] },
    { type: 'extra', id: 'imagery-extra', title: 'Love an image style we didn\'t show?', label: 'Imagery we missed', placeholder: 'Describe it, or paste a link' },
  );
  lookScreens.push({
    id: 'imagery',
    eyebrow: 'Imagery',
    title: 'What should your photos feel like?',
    lead: 'Real moments over staged ones. Tap what feels right.',
    why: 'The right photos do half the work of making someone feel safe enough to reach out.',
    questions: imageryQuestions,
  });
  chapters.push({ id: 'look', n: 3, title: 'The look', minutes: 6, screens: lookScreens });

  // 4. Real sites
  const realQuestions: Question[] = [];
  if (c.examples.length) {
    realQuestions.push(
      { type: 'rate', id: 'examples', title: 'React to each site', label: 'Example sites', hint: 'Open any of them for a closer look. It opens in a new tab.', gallery: 'example', items: c.examples.map((e) => ({ id: e.id, label: e.name })), tags: LIKE_TAGS },
      { type: 'tap', id: 'favorite-example', title: 'If you had to pick one, which feels most like you?', label: 'Closest example', options: c.examples.map((e) => ({ id: e.id, label: e.name })), exits: true },
    );
  }
  realQuestions.push(
    {
      type: 'repeat',
      id: 'own-sites',
      title: 'Any sites you love?',
      label: 'Sites they love',
      hint: 'Optional. Up to 3, from any industry.',
      addLabel: 'Add a site',
      itemLabel: 'Site',
      max: 3,
      fields: [
        { id: 'url', label: 'Link', kind: 'url', placeholder: 'https://' },
        { id: 'tags', label: 'What you like', kind: 'multi', options: LIKE_TAGS },
        { id: 'note', label: 'Anything else? (optional)', kind: 'text' },
      ],
    },
    {
      type: 'repeat',
      id: 'disliked-site',
      title: 'One site you don\'t like?',
      label: 'Site they dislike',
      hint: 'Optional, but it helps a lot.',
      addLabel: 'Add a site',
      itemLabel: 'Site',
      max: 1,
      fields: [
        { id: 'url', label: 'Link', kind: 'url', placeholder: 'https://' },
        { id: 'tags', label: 'What bugs you', kind: 'multi', options: LIKE_TAGS },
        { id: 'note', label: 'Anything else? (optional)', kind: 'text' },
      ],
    },
    { type: 'short', id: 'peer-site', title: 'Anyone in your field whose site gets it right?', label: 'Peer site', hint: 'Optional', placeholder: 'A name or a link' },
  );
  chapters.push({
    id: 'real',
    n: 4,
    title: 'Real sites and your logo',
    minutes: 4,
    screens: [
      {
        id: 'real',
        eyebrow: 'Real sites',
        title: 'Real sites, your reactions',
        lead: 'A few sites from people doing similar work. Not to copy, just to learn what you like.',
        why: 'Reactions to real sites tell us more than any description could.',
        questions: realQuestions,
      },
      {
        id: 'logo',
        eyebrow: 'Your logo',
        title: 'Your logo',
        questions: [
          {
            type: 'tap',
            id: 'logo-plan',
            title: 'What should we do with your logo?',
            label: 'Logo',
            options: [o('Keep it as is', 'keep'), o('A small cleanup', 'cleanup'), o("I'd like something new", 'new'), o('Not sure')],
            notes: { new: `Good to know. That's a separate conversation from this build, and ${c.ownerName} will follow up.` },
          },
          {
            type: 'upload',
            id: 'logo-files',
            title: 'Your logo files',
            label: 'Logo files',
            help: 'SVG, AI, EPS, PDF or PNG, up to 25 MB each',
            accept: '.svg,.ai,.eps,.pdf,.png,.jpg,.jpeg,image/*,application/pdf',
            multiple: true,
            exits: true,
            exitLabels: { notSure: "I don't know where they are", talk: "Let's talk about it" },
          },
          { type: 'tap', id: 'logo-symbol', title: 'Does your logo have a symbol that works on its own?', label: 'Logo symbol', hint: 'Like the little icon in a browser tab', options: [o('Yes'), o('No'), o('Not sure')] },
        ],
      },
    ],
  });

  // 5. Your pages and offers
  const offerQuestions: Question[] = [
    { type: 'rank', id: 'service-growth', title: 'Rank your services by what you most want to grow', label: 'Services to grow', items: c.services.map((l) => o(l)) },
    { type: 'multi', id: 'best-fit-services', title: 'Which bring your best-fit clients?', label: 'Best-fit services', options: c.services.map((l) => o(l)) },
    { type: 'multi', id: 'featured-services', title: 'Which should be on the homepage?', label: 'Homepage services', hint: 'Pick up to 3', max: 3, options: c.services.map((l) => o(l)) },
    { type: 'short', id: 'service-renames', title: 'Any service name you\'d change?', label: 'Service renames', hint: 'Optional' },
    {
      type: 'tap',
      id: 'prices',
      title: 'Prices on the site?',
      label: 'Prices',
      options: [o('Show prices', 'show'), o('"Starting at" prices', 'starting'), o('No prices, we talk on the call', 'none'), o('Not sure')],
    },
  ];
  if (c.modules.groups) {
    offerQuestions.push(
      {
        type: 'tap',
        id: 'groups-ready',
        title: 'Ready to list your groups and cohorts?',
        label: 'Groups ready',
        options: [o('Yes'), o('Not yet, show "coming soon" with a waitlist', 'soon'), o("Let's talk", 'talk')],
      },
      {
        type: 'repeat',
        id: 'groups',
        title: 'Your groups and cohorts',
        label: 'Groups',
        addLabel: 'Add a group',
        itemLabel: 'Group',
        max: 6,
        showIf: (a) => picked(a, 'groups-ready', 'yes'),
        fields: [
          { id: 'name', label: 'Name', kind: 'text' },
          { id: 'who', label: "Who it's for", kind: 'text' },
          { id: 'format', label: 'Format', kind: 'tap', options: [o('Online'), o('In person'), o('Hybrid')] },
          { id: 'schedule', label: 'Schedule and length', kind: 'text', placeholder: 'For example, Tuesdays, 8 weeks' },
          { id: 'price', label: 'Price (or "ask")', kind: 'text' },
          { id: 'join', label: 'How to join', kind: 'tap', options: [o('Calendly'), o(c.appName ?? 'My app', 'app'), o('Email'), o('A form')] },
          { id: 'status', label: 'Status', kind: 'tap', options: [o('Open'), o('Waitlist'), o('Full'), o('Coming soon')] },
        ],
      },
    );
  }
  if (c.modules.book) {
    offerQuestions.push(
      { type: 'short', id: 'book-title', title: 'Your book: title or working title', label: 'Book title' },
      { type: 'tap', id: 'book-cover', title: 'The cover', label: 'Book cover', options: [o('Done'), o('In progress'), o('Not started')] },
      { type: 'upload', id: 'book-cover-file', title: 'Add the cover', label: 'Book cover file', help: 'An image or PDF', accept: 'image/*,application/pdf', multiple: false, showIf: (a) => pickedAny(a, 'book-cover', ['done', 'in-progress']) },
      { type: 'short', id: 'book-launch', title: 'Launch date', label: 'Book launch', placeholder: 'A date, or "not set"' },
      { type: 'multi', id: 'book-sells', title: 'Where will it sell?', label: 'Book sells at', options: [o('Amazon'), o('My site'), o('Bookstores'), o('Not sure')] },
      { type: 'tap', id: 'book-page-job', title: 'What should the book page do first?', label: 'Book page job', options: [o('Sell copies'), o('Collect emails'), o('Book calls')] },
    );
  }
  if (c.modules.app) {
    offerQuestions.push(
      { type: 'short', id: 'app-name', title: `Your ${c.appName ?? ''} app name`.replace('  ', ' '), label: 'App name' },
      { type: 'tap', id: 'app-status', title: 'Where is the app at?', label: 'App status', hint: 'The site will not promise dates.', options: [o('Live'), o('In progress'), o('Paused'), o('Not sure')] },
      { type: 'short', id: 'app-launch', title: 'Expected launch', label: 'App launch', placeholder: 'A date, or "not sure"', showIf: (a) => pickedAny(a, 'app-status', ['in-progress', 'paused']) },
    );
  }
  offerQuestions.push(...c.custom.offers.map(customToQuestion));
  chapters.push({
    id: 'offers',
    n: 5,
    title: 'Your pages and offers',
    minutes: 4,
    screens: [
      {
        id: 'pages',
        eyebrow: 'Your pages',
        title: "Here's what we're building",
        lead: 'Star the pages you\'re most excited about, and tell me anything a page should do or include.',
        why: c.modules.groups || c.modules.book || c.modules.app ? 'Groups, the book and the app can each start as a "coming soon" version, so nothing has to be finished by launch.' : undefined,
        questions: [
          { type: 'pages', id: 'pages', title: 'Your pages', label: 'Pages', pages: c.pages },
          {
            type: 'multi',
            id: 'feature-wishes',
            title: "Anything else you'd love on the site?",
            label: 'Wishes beyond the agreed pages',
            options: (c.featureWishOptions ?? ['FAQ', 'Resources or downloads', 'Video', 'Newsletter signup', 'Photo gallery']).map((l) => o(l)),
            other: true,
            anyNote: "Love it. We'll talk through the best way to fit it in.",
          },
        ],
      },
      { id: 'offers', eyebrow: 'Your offers', title: 'Your services and offers', questions: offerQuestions },
    ],
  });

  // 6. Getting the right people to reach out
  const proof: Question[] = [
    { type: 'short', id: 'credentials-extra', title: `Credentials: ${c.prefill.credentials.join(', ') || 'none listed yet'}. Anything to add?`, label: 'More credentials', hint: 'Optional' },
  ];
  if (c.modules.partner && c.partnerName) {
    const yn = [o('Yes'), o('No'), o('Need to ask them', 'ask')];
    proof.push(
      { type: 'tap', id: 'partner-name', title: `Can we name ${c.partnerName} on the site?`, label: `Name ${c.partnerName}`, options: yn },
      { type: 'tap', id: 'partner-logo', title: 'Can we use their logo?', label: 'Partner logo', options: yn },
      { type: 'tap', id: 'partner-language', title: 'Is there language they need to approve?', label: 'Partner approval', options: yn },
    );
  }
  if (c.modules.testimonials) {
    proof.push({
      type: 'repeat',
      id: 'testimonials',
      title: 'Testimonials',
      label: 'Testimonials',
      hint: 'Nothing goes on the site without permission.',
      addLabel: 'Add a testimonial',
      itemLabel: 'Testimonial',
      max: 8,
      fields: [
        { id: 'quote', label: 'The quote', kind: 'textarea' },
        { id: 'naming', label: 'How should we name them?', kind: 'tap', options: [o('Full name'), o('First name'), o('Initials'), o('Anonymous, with context', 'anonymous')] },
        { id: 'context', label: 'Context (for example, "parent of two")', kind: 'text' },
        { id: 'permission', label: 'They gave permission to share this', kind: 'check' },
      ],
    });
  }
  if (c.modules.podcasts) {
    proof.push({
      type: 'repeat',
      id: 'podcasts',
      title: 'Podcast appearances',
      label: 'Podcasts',
      hint: 'Star up to three to feature.',
      addLabel: 'Add a podcast',
      itemLabel: 'Podcast',
      max: 12,
      fields: [
        { id: 'url', label: 'Link', kind: 'url', placeholder: 'https://' },
        { id: 'show', label: 'Show name', kind: 'text' },
        { id: 'featured', label: 'Feature this one', kind: 'check' },
      ],
    });
  }
  proof.push({ type: 'short', id: 'profiles', title: 'Other profiles to link to', label: 'Other profiles', hint: 'Optional. LinkedIn, Instagram, Psychology Today, anything.', multiline: true });
  proof.push(...c.custom.proof.map(customToQuestion));

  const leadOptions: Opt[] = [o('A free 15 minute call first, a paid session second', 'free-call-first'), o('Book a paid session right away', 'paid-first'), o("Not sure, let's talk", 'talk')];
  chapters.push({
    id: 'leads',
    n: 6,
    title: 'The right people reaching out',
    minutes: 4,
    screens: [
      {
        id: 'leads',
        eyebrow: 'Inquiries',
        title: 'How should inquiries flow?',
        questions: [
          {
            type: 'tap',
            id: 'lead-flow',
            title: 'When someone is ready to reach out...',
            label: 'Lead flow',
            options: leadOptions,
            recommended: c.leadFlowRecommendation,
            notes: c.leadFlowWhy ? { [c.leadFlowRecommendation]: c.leadFlowWhy } : undefined,
          },
          { type: 'multi', id: 'intake', title: 'What should the inquiry form ask?', label: 'Intake questions', hint: 'Pick 3 to 5', min: 3, max: 5, other: true, options: c.intakeOptions.map((l) => o(l)) },
          {
            type: 'tap',
            id: 'inbox',
            title: 'Where should inquiries land?',
            label: 'Inquiry inbox',
            hint: "Real inquiries have landed in spam before, so we'll set this up and test it before launch.",
            options: [o('A new dedicated address', 'new-address'), o('A label in my current inbox', 'label'), o('Not sure')],
          },
          { type: 'tap', id: 'who-replies', title: 'Who replies?', label: 'Who replies', options: [o('Me'), o('Someone else', 'someone')] },
          { type: 'short', id: 'who-replies-name', title: 'Who is it?', label: 'Replier', showIf: (a) => picked(a, 'who-replies', 'someone') },
          { type: 'tap', id: 'reply-speed', title: 'How fast do you usually reply?', label: 'Reply speed', options: [o('Same day'), o('Within 1 business day', '1-day'), o('Within 2 business days', '2-days'), o('It varies')] },
          { type: 'tap', id: 'calendly', title: 'Your Calendly plan', label: 'Calendly', hint: 'Paid tools pass through at cost, and only with your OK first.', options: [o('Free'), o('Paid'), o('Not sure'), o("I don't use Calendly", 'none')] },
          { type: 'tap', id: 'stripe', title: 'Is Stripe connected for payments?', label: 'Stripe', options: [o('Yes'), o('No'), o('Not sure')] },
        ],
      },
      { id: 'proof', eyebrow: 'Proof', title: 'What helps people trust you', questions: proof },
    ],
  });

  // 7. Files and access
  chapters.push({
    id: 'access',
    n: 7,
    title: 'Files and access',
    minutes: 3,
    screens: [
      {
        id: 'access',
        title: 'Files and access',
        lead: `No passwords, ever. For each one, invite ${c.ownerName} and tap where you're at.`,
        why: `If something won't let you invite us, pick "Need help" and ${c.ownerName} will set up a quick call.`,
        questions: [
          {
            type: 'upload',
            id: 'files',
            title: 'Headshots, photos and anything else',
            label: 'Files',
            help: 'Images, PDF, SVG, AI or EPS, up to 25 MB each',
            accept: 'image/*,.svg,.ai,.eps,.pdf,application/pdf',
            multiple: true,
            exits: true,
            exitLabels: { notSure: "I'll send them later", talk: "Let's talk about it" },
          },
          { type: 'access', id: 'access', title: 'Access checklist', label: 'Access', items: accessItems(c) },
        ],
      },
    ],
  });

  // 8. How we'll work
  chapters.push({
    id: 'work',
    n: 8,
    title: "How we'll work",
    minutes: 2,
    screens: [
      {
        id: 'work',
        title: "How we'll work together",
        questions: [
          { type: 'timeline', id: 'timeline', title: 'The plan', items: c.dates.timeline },
          {
            type: 'agree',
            id: 'working-agreement',
            title: 'How reviews work',
            label: 'Review process',
            points: [
              'Feedback within five business days keeps launch on track.',
              'A round is one batch of feedback per review, so send it all together when you can. A voice memo is perfect.',
              'Two rounds are included.',
            ],
            agreeLabel: 'Sounds good',
          },
          { type: 'multi', id: 'reach-by', title: 'Best way to reach you', label: 'Reach by', options: [o('Text'), o('Email'), o('Voice memo'), o('Call')] },
          { type: 'short', id: 'best-times', title: 'Best times', label: 'Best times', placeholder: 'For example, weekday mornings' },
          { type: 'short', id: 'plan-around', title: 'Anything in the next eight weeks we should plan around?', label: 'Plan around', hint: 'Optional', multiline: true },
        ],
      },
    ],
  });

  return chapters;
}

/** Every question in order, with its chapter and screen. */
export function flatQuestions(chapters: Chapter[]) {
  const out: { chapter: Chapter; screen: Screen; q: Question }[] = [];
  for (const chapter of chapters) for (const screen of chapter.screens) for (const q of screen.questions) out.push({ chapter, screen, q });
  return out;
}

/** Questions that can actually be answered (not display-only), visible given current answers. */
export function isAnswerable(q: Question) {
  return q.type !== 'timeline';
}

export function isVisible(q: Question, a: Answers) {
  return !q.showIf || q.showIf(a);
}

export function hasAnswer(q: Question, a: AnswerValue | undefined): boolean {
  if (!a) return false;
  if (a.exit) return true;
  const v = a.v as any;
  if (v === undefined || v === null || v === '') return false;
  switch (q.type) {
    case 'multi':
      return (v.picks?.length ?? 0) > 0 || !!v.other;
    case 'tap':
      return !!v.choice;
    case 'rate':
    case 'sliders':
      return Object.keys(v).length > 0;
    case 'repeat':
      return Array.isArray(v) && v.length > 0;
    case 'pages':
      return (v.starred?.length ?? 0) > 0 || Object.values(v.notes ?? {}).some(Boolean);
    case 'access':
      return Object.keys(v).length > 0;
    default:
      return true;
  }
}

export function chapterProgress(chapter: Chapter, answers: Answers): number {
  const qs = chapter.screens.flatMap((s) => s.questions).filter((q) => isAnswerable(q) && isVisible(q, answers));
  if (!qs.length) return answers[`_seen:${chapter.id}`] ? 1 : 0;
  const done = qs.filter((q) => hasAnswer(q, answers[q.id])).length;
  return done / qs.length;
}
