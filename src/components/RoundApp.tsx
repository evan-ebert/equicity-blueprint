/**
 * A review round: intro, the screens from the round config, review, one Send, done. Same shell and
 * save engine as the discovery chapters. Once sent, the server locks the round and this shows what
 * was sent, read only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoundStatus } from '../lib/db';
import { buildRoundSummary, longDate, visitedRoundScreens, RATING_TEXT, SECTION_TAGS, type Answers, type AnswerValue, type ChoiceAnswer, type DecisionAnswer, type ItemSummary, type LinesAnswer, type OpenAnswer, type Rating, type RoundConfig, type RoundItemDef, type RoundScreenDef, type SectionAnswer } from '../lib/rounds';
import { useAutosave } from './autosave';
import { SaveIndicator } from './save';
import { Icon, MarkerCircle } from './icons';
import { Chip, RATES, TextBox } from './questions';

type Props = {
  slug: string;
  base: string;
  number: number;
  config: RoundConfig;
  ownerName: string;
  firstName: string;
  business: string;
  status: RoundStatus;
  submittedAt: string | null;
  dueDate: string | null;
  initialAnswers: Answers;
  initialUpdatedAt: Record<string, string>;
  serverNow: string;
  /** Original image sizes, for stable layout while images load. */
  images: Record<string, { width: number | null; height: number | null }>;
  preview?: boolean;
};

const DISPLAY_WIDTH = 1200;
const isLocked = (s: RoundStatus) => s === 'submitted' || s === 'closed';

export default function RoundApp({ slug, base, number, config, ownerName: owner, firstName, status, submittedAt: initialSubmittedAt, dueDate, initialAnswers, initialUpdatedAt, serverNow, images, preview = false }: Props) {
  const api = (path: string) => `${base}api/${slug}/review/${number}/${path}`;
  const imageUrl = useCallback((name: string, size: 'display' | 'full') => `${api(`image/${encodeURIComponent(name)}`)}?size=${size}`, [base, slug, number]);
  const screens = config.screens;
  const steps = useMemo(() => ['intro', ...screens.map((s) => `screen/${s.id}`), 'review'], [screens]);

  const [locked, setLocked] = useState(isLocked(status));
  const [submittedAt, setSubmittedAt] = useState(initialSubmittedAt);
  const savedPos = typeof initialAnswers._pos?.v === 'string' ? (initialAnswers._pos.v as string) : null;
  const [pos, setPos] = useState<string>(() => (isLocked(status) ? 'done' : preview ? 'intro' : savedPos && steps.includes(savedPos) ? savedPos : 'intro'));
  const [toast, setToast] = useState<string | null>(null);
  const [cheer, setCheer] = useState<{ text: string; n: number } | null>(null);
  const [viewer, setViewer] = useState<{ name: string; alt: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [missingNote, setMissingNote] = useState<ItemSummary | null>(null);

  const { answers, setAnswer, queue, save, settle, markExpired } = useAutosave({
    storageKey: `bp:${slug}:r${number}:pending`,
    saveUrl: api('answer'),
    stateUrl: api('state'),
    initialAnswers,
    initialUpdatedAt,
    serverNow,
    preview,
    locked,
    parseState: (body) => {
      const b = body as { ok?: boolean; answers?: Answers; updatedAt?: Record<string, string>; now?: string };
      return b?.ok && b.answers ? { answers: b.answers, updatedAt: b.updatedAt, now: b.now } : null;
    },
    onRefetch: (merged, body, changed) => {
      const b = body as { status?: RoundStatus; submittedAt?: string | null };
      if (b.status && isLocked(b.status)) {
        setLocked(true);
        setSubmittedAt(b.submittedAt ?? null);
        setPos('done');
        return;
      }
      if (!changed) return;
      const p = merged._pos?.v;
      if (typeof p === 'string' && steps.includes(p)) setPos((cur) => (cur === p ? cur : p));
      setToast('Picked up your latest answers.');
    },
    onLocked: () => {
      setLocked(true);
      setPos('done');
      setToast('This round was already sent, so it is closed for changes.');
    },
    onRejected: (message) => setToast(message ?? "That didn't save. Try a shorter version?"),
  });

  const summary = useMemo(() => buildRoundSummary(config, answers), [config, answers]);
  const visited = visitedRoundScreens(answers);
  const index = Math.max(0, steps.indexOf(pos));
  const screen = pos.startsWith('screen/') ? screens.find((s) => `screen/${s.id}` === pos) ?? null : null;
  const screenN = screen ? screens.indexOf(screen) + 1 : 0;

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!cheer) return;
    const t = window.setTimeout(() => setCheer(null), 1900);
    return () => window.clearTimeout(t);
  }, [cheer]);

  // ----- navigation -----
  const heading = useRef<HTMLHeadingElement>(null);
  const go = useCallback(
    (key: string, focusItem?: string) => {
      setPos(key);
      setConfirming(false);
      setSendError(null);
      if (key !== 'done') queue('_pos', { v: key }, 900);
      window.scrollTo({ top: 0 });
      window.setTimeout(() => {
        if (focusItem) {
          const el = document.getElementById(`item-${focusItem}`);
          el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
          el?.querySelector<HTMLElement>('[role="radio"], button')?.focus({ preventScroll: true });
        } else heading.current?.focus({ preventScroll: true });
      }, 40);
    },
    [queue],
  );
  const markVisited = (id: string) => {
    if (!visited.has(id)) setAnswer('_visited', { v: [...visited, id] });
  };
  const next = () => {
    if (screen) {
      markVisited(screen.id);
      setCheer({ text: `Screen ${screenN} of ${screens.length} done`, n: Date.now() });
    }
    go(steps[Math.min(index + 1, steps.length - 1)]);
  };
  const back = () => go(steps[Math.max(index - 1, 0)]);

  // ----- send -----
  const startSend = () => {
    setSendError(null);
    if (summary.missing.length) {
      setMissingNote(summary.missing[0]);
      return;
    }
    setMissingNote(null);
    setConfirming(true);
  };
  const send = async () => {
    if (preview) {
      setConfirming(false);
      setPos('done');
      window.scrollTo({ top: 0 });
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      if (!(await settle())) throw new Error("Some answers haven't saved yet. Check your connection and try again in a moment.");
      const res = await fetch(api('submit'), { method: 'POST', credentials: 'same-origin' });
      if (res.status === 401) {
        markExpired();
        throw new Error('For your privacy this device was signed out. Reload, enter your code, and send again.');
      }
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; submittedAt?: string } | null;
      if (res.status === 409) {
        setLocked(true);
        setPos('done');
        return;
      }
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That didn't send. Check your connection and try again. Your answers are saved either way.");
      setSubmittedAt(body.submittedAt ?? new Date().toISOString());
      setLocked(true);
      setConfirming(false);
      setPos('done');
      window.scrollTo({ top: 0 });
      window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 40);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "That didn't send. Try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  const ctx: ItemCtx = {
    owner,
    answers,
    set: setAnswer,
    imageUrl,
    imageSize: (name) => images[name] ?? { width: null, height: null },
    openViewer: (name, alt) => setViewer({ name, alt }),
  };

  const label = pos === 'intro' ? `Round ${number}: ${config.title}` : pos === 'review' ? 'Review and send' : pos === 'done' ? 'Sent' : `${screenN} of ${screens.length}: ${screen!.title}`;

  return (
    <div className="bp-app">
      <header className="eq-top">
        <div className="eq-top__row">
          <img className="eq-top__logo" src={`${base}equicity-logo.png`} alt="Equicity" width={110} height={22} />
          <SaveIndicator state={save} />
          <a className="eq-btn eq-btn--quiet bp-menu-btn" href={`${base}${slug}${preview ? '?preview=1' : ''}`}>
            <Icon name="back" size={18} />
            <span className="bp-menu-btn__label">Blueprint</span>
          </a>
        </div>
        <div className="eq-segs" aria-hidden="true">
          {screens.map((s) => {
            const done = visited.has(s.id) || s.items.every((it) => summary.screens.find((x) => x.id === s.id)?.items.find((i) => i.id === it.id)?.answered);
            return (
              <span key={s.id} className={`eq-seg${done ? ' eq-seg--done' : ''}`} data-current={screen?.id === s.id}>
                <span style={{ width: done ? '100%' : '0%' }} />
              </span>
            );
          })}
        </div>
        <div className="eq-top__row">
          <span className="eq-top__chapter">{label}</span>
          {pos === 'intro' && config.estimate && (
            <span className="eq-top__meta">
              <Icon name="clock" />
              {config.estimate}
            </span>
          )}
        </div>
      </header>

      {preview && (
        <div className="bp-banner bp-banner--preview" role="note">
          <Icon name="lock" size={18} />
          <span>Preview. Nothing you do here is saved, and {firstName} won't see it. Sending just shows the done screen.</span>
          <a className="eq-btn eq-btn--secondary" href={`${base}admin/${slug}/review/${number}`}>
            Back to admin
          </a>
        </div>
      )}

      {save === 'expired' && (
        <div className="bp-banner" role="alert">
          <Icon name="lock" size={18} />
          <span>For your privacy, this device was signed out. Reload and enter your code to keep going. Your recent answers are kept on this device until then.</span>
          <button type="button" className="eq-btn eq-btn--secondary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}

      {pos === 'done' ? (
        <Done config={config} owner={owner} heading={heading} summary={summary} submittedAt={submittedAt} base={base} slug={slug} preview={preview} />
      ) : pos === 'intro' ? (
        <Intro config={config} owner={owner} number={number} dueDate={dueDate} heading={heading} resumed={!!savedPos && savedPos !== 'intro' && !preview} onStart={() => { markVisited('intro'); go(savedPos && savedPos !== 'intro' && steps.includes(savedPos) && !preview ? savedPos : steps[1]); }} />
      ) : pos === 'review' ? (
        <Review owner={owner} heading={heading} summary={summary} config={config} onEdit={(screenId, itemId) => go(`screen/${screenId}`, itemId)} sendError={sendError} missing={missingNote} confirming={confirming} sending={sending} onSend={() => void send()} onNotYet={() => setConfirming(false)} />
      ) : (
        <main className="eq-page bp-screen bp-enter" id="main" key={pos}>
          <header className="eq-stack" style={{ gap: 12 }}>
            <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>
              Round {number}
            </span>
            <h1 className="eq-h1" ref={heading} tabIndex={-1}>
              {screen!.title}
            </h1>
            {screen!.intro && <p className="eq-lead">{screen!.intro}</p>}
          </header>
          {screen!.items.map((item) => (
            <ItemView key={item.id} item={item} ctx={ctx} />
          ))}
        </main>
      )}

      {pos !== 'done' && pos !== 'intro' && (
        <nav className="eq-bar" aria-label="Move between screens">
          <button type="button" className="eq-btn eq-btn--secondary" onClick={back}>
            <Icon name="back" size={18} />
            Back
          </button>
          {pos === 'review' ? (
            !confirming && (
              <button type="button" className="eq-btn eq-btn--primary" onClick={startSend} disabled={sending}>
                Send to {owner}
                <Icon name="arrow" size={18} />
              </button>
            )
          ) : (
            <button type="button" className="eq-btn eq-btn--primary" onClick={next}>
              {index + 1 === steps.length - 1 ? 'Review my answers' : 'Continue'}
              <Icon name="arrow" size={18} />
            </button>
          )}
        </nav>
      )}

      {viewer && <Viewer src={imageUrl(viewer.name, 'full')} alt={viewer.alt} onClose={() => setViewer(null)} />}

      {cheer && (
        <div className="bp-cheer" role="status" key={cheer.n}>
          <span className="bp-cheer__check" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12.5l4.2 4.2L19 7" pathLength={1} />
            </svg>
          </span>
          {cheer.text}
        </div>
      )}

      <div className="bp-toast" role="status" aria-live="polite">
        {toast && (
          <div className="bp-toast__inner">
            <span>{toast}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- screens ----------

function Intro({ config, owner, number, dueDate, heading, resumed, onStart }: { config: RoundConfig; owner: string; number: number; dueDate: string | null; heading: React.RefObject<HTMLHeadingElement | null>; resumed: boolean; onStart: () => void }) {
  const due = longDate(dueDate ?? config.dueDate ?? null);
  return (
    <main className="eq-page bp-enter" id="main">
      <header className="eq-stack" style={{ gap: 14 }}>
        <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>
          Round {number}
        </span>
        <h1 className="eq-h1" ref={heading} tabIndex={-1}>
          {config.title}
        </h1>
        <p className="eq-lead">{config.intro}</p>
      </header>
      <ul className="bp-how">
        {config.estimate && (
          <li>
            <Icon name="clock" />
            <span>{config.estimate}. {config.screens.length} short screens, then one Send.</span>
          </li>
        )}
        <li>
          <Icon name="heart" />
          <span>Tap Love it, Maybe or Not for me on each part. Anything you skip, we'll treat as approved.</span>
        </li>
        <li>
          <Icon name="saved" />
          <span>Saves as you go. Open the same link on any device, enter your code, and you'll pick up where you left off.</span>
        </li>
        <li>
          <Icon name="lock" />
          <span>Private to you and {owner}. You'll never be asked for a password here.</span>
        </li>
      </ul>
      {due && (
        <p className="eq-muted" style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
          Anytime before {due} is perfect.
        </p>
      )}
      <button type="button" className="eq-btn eq-btn--primary eq-btn--block" onClick={onStart}>
        {resumed ? 'Pick up where you left off' : 'Start'}
        <Icon name="arrow" size={18} />
      </button>
    </main>
  );
}

function Review({
  owner,
  heading,
  summary,
  config,
  onEdit,
  sendError,
  missing,
  confirming,
  sending,
  onSend,
  onNotYet,
}: {
  owner: string;
  heading: React.RefObject<HTMLHeadingElement | null>;
  summary: ReturnType<typeof buildRoundSummary>;
  config: RoundConfig;
  onEdit: (screenId: string, itemId?: string) => void;
  sendError: string | null;
  missing: ItemSummary | null;
  confirming: boolean;
  sending: boolean;
  onSend: () => void;
  onNotYet: () => void;
}) {
  const missingScreen = missing ? config.screens.find((s) => s.items.some((i) => i.id === missing.id)) : null;
  return (
    <main className="eq-page bp-enter" id="main">
      <header className="eq-stack" style={{ gap: 14 }}>
        <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>
          Almost done
        </span>
        <h1 className="eq-h1" ref={heading} tabIndex={-1}>
          Here's what you're sending
        </h1>
        <p className="eq-lead">Look it over and tap Edit to change anything. When it feels right, send it to {owner}.</p>
      </header>

      {summary.screens.map((s) => (
        <SummarySection key={s.id} screen={s} onEdit={() => onEdit(s.id)} />
      ))}

      {missing && missingScreen && (
        <p className="eq-field__warn" role="alert" id="send-missing">
          <Icon name="alert" size={18} />
          <span>
            One thing first: {missing.title.replace(/\?$/, '').replace(/^[A-Z]/, (c) => c.toLowerCase())}.{' '}
            <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 32, padding: '0 4px' }} onClick={() => onEdit(missingScreen.id, missing.id)}>
              Pick one
            </button>
          </span>
        </p>
      )}
      {sendError && (
        <p className="eq-field__warn" role="alert">
          <Icon name="alert" size={18} />
          <span>{sendError}</span>
        </p>
      )}
      {confirming ? (
        <div className="bp-confirm" role="group" aria-label="Ready to send?">
          <p>Once you send this, this round is closed. Ready?</p>
          <div className="eq-row">
            <button type="button" className="eq-btn eq-btn--primary" onClick={onSend} disabled={sending}>
              {sending ? 'Sending...' : 'Send it'}
            </button>
            <button type="button" className="eq-btn eq-btn--secondary" onClick={onNotYet} disabled={sending}>
              Not yet
            </button>
          </div>
        </div>
      ) : (
        <p className="eq-muted" style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
          Sections you left alone count as approved. If you'd rather say something, tap Edit.
        </p>
      )}
    </main>
  );
}

function SummarySection({ screen, onEdit }: { screen: { id: string; title: string; items: ItemSummary[] }; onEdit?: () => void }) {
  const said = screen.items.filter((i) => i.answered);
  const quiet = screen.items.filter((i) => !i.answered && (i.type === 'section' || i.type === 'lines'));
  const skipped = screen.items.filter((i) => !i.answered && i.type !== 'section' && i.type !== 'lines');
  return (
    <section className="bp-review" aria-label={screen.title}>
      <div className="bp-review__head">
        <h2 className="bp-review__title">{screen.title}</h2>
        {onEdit && (
          <button type="button" className="eq-btn eq-btn--quiet" onClick={onEdit}>
            <Icon name="edit" size={16} />
            Edit
          </button>
        )}
      </div>
      {said.length > 0 && (
        <dl className="bp-review__list">
          {said.map((it) => (
            <div key={it.id}>
              <dt>{it.title}</dt>
              <dd>
                {it.type === 'lines' && it.lines ? (
                  <ul className="bp-lines-sum">
                    {it.lines.filter((l) => l.rating).map((l, i) => (
                      <li key={i}>
                        <b>{RATING_TEXT[l.rating!]}:</b> {l.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  it.answer
                )}
                {it.tags.length > 0 && <span className="eq-status" style={{ marginLeft: 8 }}>{it.tags.join(', ')}</span>}
                {it.note && <span className="bp-review__note">"{it.note}"</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {quiet.length > 0 && (
        <p className="eq-muted" style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
          No comments on {quiet.map((i) => i.title).join(', ')}, so we'll treat {quiet.length === 1 ? 'it' : 'these'} as approved.
        </p>
      )}
      {skipped.length > 0 && said.length === 0 && quiet.length === 0 && (
        <p className="eq-muted" style={{ margin: 0, fontSize: 15 }}>
          {onEdit ? 'Skipped for now. Tap Edit to add anything.' : 'Nothing added.'}
        </p>
      )}
    </section>
  );
}

function Done({ config, owner, heading, summary, submittedAt, base, slug, preview }: { config: RoundConfig; owner: string; heading: React.RefObject<HTMLHeadingElement | null>; summary: ReturnType<typeof buildRoundSummary>; submittedAt: string | null; base: string; slug: string; preview: boolean }) {
  return (
    <main className="eq-page bp-done bp-enter" id="main">
      <header className="eq-stack" style={{ gap: 18 }}>
        <h1 className="eq-display" ref={heading} tabIndex={-1}>
          Thank{' '}
          <span className="eq-circled">
            you
            <MarkerCircle />
          </span>
        </h1>
        <p className="eq-lead">{config.doneNote}</p>
      </header>
      <aside className="eq-why">
        <span className="eq-why__label">What happens next</span>
        <p>{owner} reads every note and comes back with the next step. This round is closed now, so nothing here can change. Thought of something after? Text {owner}, that works too.</p>
      </aside>
      <section className="eq-stack" aria-label="What you sent">
        <span className="eq-why__label">What you sent{submittedAt ? `, ${longDate(submittedAt)}` : ''}</span>
        {summary.screens.map((s) => (
          <SummarySection key={s.id} screen={s} />
        ))}
      </section>
      <a className="eq-btn eq-btn--secondary" style={{ justifySelf: 'start' }} href={`${base}${slug}${preview ? '?preview=1' : ''}`}>
        <Icon name="back" size={18} />
        Back to your blueprint
      </a>
    </main>
  );
}

// ---------- items ----------

type ItemCtx = {
  owner: string;
  answers: Answers;
  set: (id: string, value: AnswerValue | null) => void;
  imageUrl: (name: string, size: 'display' | 'full') => string;
  imageSize: (name: string) => { width: number | null; height: number | null };
  openViewer: (name: string, alt: string) => void;
};

function displaySize(size: { width: number | null; height: number | null }) {
  if (!size.width || !size.height) return {};
  const w = Math.min(DISPLAY_WIDTH, size.width);
  return { width: w, height: Math.round((size.height * w) / size.width) };
}

function ItemView({ item, ctx }: { item: RoundItemDef; ctx: ItemCtx }) {
  const help = `Or text ${ctx.owner} a voice memo, that works too.`;
  const raw = ctx.answers[item.id];
  const update = (patch: Record<string, unknown>) => {
    const cur = (raw?.v ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...cur, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '' || (Array.isArray(next[k]) && (next[k] as unknown[]).length === 0)) delete next[k];
    ctx.set(item.id, Object.keys(next).length ? { v: next } : null);
  };
  switch (item.type) {
    case 'decision': {
      const v = (raw?.v ?? {}) as DecisionAnswer;
      return (
        <section className="eq-q" id={`item-${item.id}`} aria-labelledby={`q-${item.id}`}>
          <h2 id={`q-${item.id}`} className="eq-q__title" style={{ fontSize: 20, lineHeight: '27px' }}>
            {item.prompt}
          </h2>
          <div className="bp-decision" role="radiogroup" aria-label={item.prompt}>
            {item.options.map((o) => {
              const on = v.pick === o.key;
              return (
                <div key={o.key} className="bp-option" data-on={on}>
                  <div className="bp-option__pick" role="radio" aria-checked={on} tabIndex={0} onClick={() => update({ pick: o.key })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), update({ pick: o.key }))}>
                    <img className="bp-option__img" src={ctx.imageUrl(o.image, 'display')} alt={o.label} loading="lazy" {...displaySize(ctx.imageSize(o.image))} />
                    <span className="bp-option__body">
                      <span className="bp-option__tick" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M5 12.5l4.2 4.2L19 7" />
                        </svg>
                      </span>
                      <span>
                        <span className="bp-option__label">{o.label}</span>
                        {o.description && <span className="bp-option__desc">{o.description}</span>}
                      </span>
                    </span>
                  </div>
                  <button type="button" className="eq-btn eq-btn--quiet bp-option__bigger" onClick={() => ctx.openViewer(o.image, o.label)}>
                    <Icon name="external" size={16} />
                    See it bigger
                  </button>
                </div>
              );
            })}
          </div>
          {item.notePrompt && <TextBox label={item.notePrompt} multiline placeholder="Optional" value={v.note ?? ''} onSave={(s) => update({ note: s || undefined })} help={help} />}
        </section>
      );
    }
    case 'section': {
      const v = (raw?.v ?? {}) as SectionAnswer;
      const size = displaySize(ctx.imageSize(item.image));
      return (
        <section className="eq-q" id={`item-${item.id}`} aria-labelledby={`q-${item.id}`}>
          <article className="eq-tile bp-section" data-rating={v.r ?? ''}>
            <button type="button" className="bp-section__imgbtn" onClick={() => ctx.openViewer(item.image, item.title)} aria-label={`See ${item.title} bigger`}>
              <img className="bp-section__img" src={ctx.imageUrl(item.image, 'display')} alt="" loading="lazy" {...size} />
              <span className="bp-section__zoom" aria-hidden="true">
                <Icon name="external" size={16} />
                Tap to see it bigger
              </span>
            </button>
            <div className="eq-tile__body">
              <h2 id={`q-${item.id}`} className="eq-tile__title">
                {item.title}
              </h2>
              {item.about && <p className="eq-tile__note">{item.about}</p>}
              <RateTrio value={v.r} onPick={(r) => update({ r })} label={item.title} />
              {v.r && (
                <div className="eq-stack" style={{ gap: 8 }}>
                  <span className="eq-field__help">{v.r === 'love' ? 'What works? (optional)' : 'What is it about? (optional)'}</span>
                  <div className="eq-chips" style={{ gap: 8 }}>
                    {SECTION_TAGS.map((t) => {
                      const tags = v.tags ?? [];
                      const on = tags.includes(t);
                      return (
                        <Chip key={t} on={on} onClick={() => update({ tags: on ? tags.filter((x) => x !== t) : [...tags, t] })}>
                          {t}
                        </Chip>
                      );
                    })}
                  </div>
                  <TextBox label="What would you change?" hideLabel placeholder="What would you change? (optional)" multiline value={v.note ?? ''} onSave={(s) => update({ note: s || undefined })} help={help} />
                </div>
              )}
            </div>
          </article>
        </section>
      );
    }
    case 'lines': {
      const v = (raw?.v ?? {}) as LinesAnswer;
      return (
        <section className="eq-q" id={`item-${item.id}`} aria-labelledby={`q-${item.id}`}>
          <h2 id={`q-${item.id}`} className="eq-q__title" style={{ fontSize: 20, lineHeight: '27px' }}>
            {item.prompt}
          </h2>
          <ol className="bp-lines">
            {item.lines.map((line, i) => (
              <li key={i} className="bp-line" data-rating={v.r?.[String(i)] ?? ''}>
                <p className="bp-line__text">{line}</p>
                <RateTrio value={v.r?.[String(i)]} onPick={(r) => update({ r: { ...(v.r ?? {}), [String(i)]: r } })} label={line} />
              </li>
            ))}
          </ol>
          {item.notePrompt && <TextBox label={item.notePrompt} multiline placeholder="Optional" value={v.note ?? ''} onSave={(s) => update({ note: s || undefined })} help={help} />}
        </section>
      );
    }
    case 'choice': {
      const v = (raw?.v ?? {}) as ChoiceAnswer;
      return (
        <section className="eq-q" id={`item-${item.id}`} aria-labelledby={`q-${item.id}`}>
          <h2 id={`q-${item.id}`} className="eq-q__title" style={{ fontSize: 20, lineHeight: '27px' }}>
            {item.prompt}
          </h2>
          <div className="eq-chips--stack" role="radiogroup" aria-label={item.prompt}>
            {item.options.map((o) => (
              <Chip key={o} row role="radio" on={v.pick === o} onClick={() => update({ pick: o })}>
                {o}
              </Chip>
            ))}
          </div>
          {item.notePrompt && <TextBox label={item.notePrompt} multiline placeholder="Optional" value={v.note ?? ''} onSave={(s) => update({ note: s || undefined })} help={help} />}
        </section>
      );
    }
    case 'open': {
      const v = (raw?.v ?? {}) as OpenAnswer;
      return (
        <section className="eq-q" id={`item-${item.id}`} aria-labelledby={`q-${item.id}`}>
          <h2 id={`q-${item.id}`} className="eq-q__title" style={{ fontSize: 20, lineHeight: '27px' }}>
            {item.prompt}
          </h2>
          <TextBox label={item.prompt} hideLabel multiline placeholder="Anything at all (optional)" value={v.text ?? ''} onSave={(s) => update({ text: s || undefined })} help={help} />
        </section>
      );
    }
  }
}

function RateTrio({ value, onPick, label }: { value: Rating | undefined; onPick: (r: Rating) => void; label: string }) {
  return (
    <div className="eq-rate" role="group" aria-label={`Rate ${label}`}>
      {RATES.map((x) => (
        <button key={x.id} type="button" className="eq-rate__btn" data-value={x.id} aria-pressed={value === x.id} onClick={() => onPick(x.id)}>
          <Icon name={x.icon} size={18} />
          {x.label}
        </button>
      ))}
    </div>
  );
}

/** Full-screen image. Scrolls for tall images, pinch zooms natively, doubles on tap, closes with the X, Escape or the back gesture. */
function Viewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  // The parent re-renders while the viewer is open (save state, toasts). Keep the effect to one run, so
  // it pushes exactly one history entry and the back gesture closes the viewer in one swipe.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    document.body.style.overflow = 'hidden';
    // One history entry, so the phone's back gesture closes the viewer instead of leaving the round.
    window.history.pushState({ bpViewer: true }, '');
    const pop = () => onCloseRef.current();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('popstate', pop);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('popstate', pop);
      document.removeEventListener('keydown', key);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, []);
  const close = () => {
    if (window.history.state?.bpViewer) window.history.back();
    else onCloseRef.current();
  };
  return (
    <div className="bp-viewer" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="bp-viewer__bar">
        <span className="bp-viewer__title">{alt}</span>
        <button type="button" className="bp-viewer__close" onClick={close} ref={closeBtn} aria-label="Close">
          <Icon name="x" size={26} />
        </button>
      </div>
      <div className="bp-viewer__scroll" data-zoomed={zoomed}>
        {!loaded && <span className="bp-viewer__loading">Loading the full size image...</span>}
        <img src={src} alt={alt} onLoad={() => setLoaded(true)} onClick={() => setZoomed((z) => !z)} />
      </div>
      <p className="bp-viewer__hint">Pinch to zoom, scroll for the rest. Tap the image to double it.</p>
    </div>
  );
}

export type { RoundScreenDef };
