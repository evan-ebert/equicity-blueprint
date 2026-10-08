/**
 * The client-facing Blueprint. One React island: welcome, chapters, a halfway checkpoint, review, done.
 * Every answer saves on its own (debounced), unsaved changes survive a reload, and the position syncs so
 * the client can pick up on any device.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientConfig } from '../lib/config';
import { buildChapters, chapterProgress, isVisible, type AnswerValue, type Answers, type Chapter, type Screen } from '../lib/chapters';
import { buildReview, type UploadInfo } from '../lib/summary';
import { Icon, MarkerCircle } from './icons';
import { QuestionView, type Ctx } from './questions';

type Props = {
  config: ClientConfig;
  slug: string;
  base: string;
  initialAnswers: Answers;
  initialUploads: UploadInfo[];
  submittedAt: string | null;
  /** Evan's read-only look at a client's blueprint: nothing saves, uploads and sending are off. */
  preview?: boolean;
};

type Step =
  | { key: string; kind: 'welcome'; chapter: Chapter; screen: Screen }
  | { key: string; kind: 'screen'; chapter: Chapter; screen: Screen }
  | { key: string; kind: 'break'; chapter: Chapter }
  | { key: 'review'; kind: 'review' };

type SaveState = 'idle' | 'saving' | 'saved' | 'retrying' | 'expired' | 'preview';

const MAX_UPLOAD = 25 * 1024 * 1024;
const PHOTO_RESIZE_OVER = 4 * 1024 * 1024;
const OK_EXT = /\.(png|jpe?g|webp|gif|heic|heif|svg|pdf|ai|eps)$/i;
const BREAK_AFTER_CHAPTER = 4;

// ---------- small storage helpers (per device, best effort) ----------

function readPending(slug: string): Record<string, AnswerValue | null> {
  try {
    const raw = localStorage.getItem(`bp:${slug}:pending`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { at: number; items: Record<string, AnswerValue | null> };
    if (!parsed?.items || Date.now() - parsed.at > 14 * 86400_000) return {};
    return parsed.items;
  } catch {
    return {};
  }
}

function writePending(slug: string, items: Map<string, AnswerValue | null>) {
  try {
    if (!items.size) localStorage.removeItem(`bp:${slug}:pending`);
    else localStorage.setItem(`bp:${slug}:pending`, JSON.stringify({ at: Date.now(), items: Object.fromEntries(items) }));
  } catch {
    // Private mode or storage blocked: the in-memory queue still retries.
  }
}

// ---------- images over the size limit get resized in the browser ----------

async function shrinkImage(file: File, maxEdge: number): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_UPLOAD && blob.size < file.size) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  }
  return file;
}

// ---------- the app ----------

export default function App({ config, slug, base, initialAnswers, initialUploads, submittedAt: initialSubmittedAt, preview = false }: Props) {
  const api = (path: string) => `${base}api/${slug}/${path}`;
  const chapters = useMemo(() => buildChapters(config), [config]);
  const owner = config.ownerName;

  // Answers, with any changes that never reached the server applied on top.
  const pending = useRef<Map<string, AnswerValue | null>>(new Map());
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [uploads, setUploads] = useState<UploadInfo[]>(initialUploads);
  const [submittedAt, setSubmittedAt] = useState<string | null>(initialSubmittedAt);
  const [save, setSave] = useState<SaveState>(preview ? 'preview' : 'idle');
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // ----- the steps -----
  const steps = useMemo(() => {
    const out: Step[] = [];
    for (const chapter of chapters) {
      for (const screen of chapter.screens) {
        if (screen.kind === 'welcome') out.push({ key: 'welcome', kind: 'welcome', chapter, screen });
        else if (screen.questions.length === 0 || screen.questions.some((q) => isVisible(q, answers))) out.push({ key: `${chapter.id}/${screen.id}`, kind: 'screen', chapter, screen });
      }
      if (chapter.n === BREAK_AFTER_CHAPTER && chapters.length > BREAK_AFTER_CHAPTER) out.push({ key: 'break', kind: 'break', chapter });
    }
    out.push({ key: 'review', kind: 'review' });
    return out;
  }, [chapters, answers]);

  const savedPos = typeof answers._pos?.v === 'string' ? (answers._pos.v as string) : null;
  const [pos, setPos] = useState<string>(() => (preview ? 'welcome' : savedPos ?? 'welcome'));
  const resumed = useRef(!preview && !!savedPos && savedPos !== 'welcome');
  const index = Math.max(0, steps.findIndex((s) => s.key === pos));
  const step = steps[index];

  // ----- saving -----
  const timer = useRef<number | undefined>(undefined);
  const inflight = useRef(false);
  const backoff = useRef(2000);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (inflight.current || !pending.current.size) return;
    inflight.current = true;
    setSave((s) => (s === 'expired' ? s : 'saving'));
    let failed = false;
    try {
      for (const [qid, value] of [...pending.current.entries()]) {
        const res = await fetch(api('answer'), {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ qid, value }),
        });
        if (res.status === 401) {
          setSave('expired');
          return;
        }
        if (res.status === 400 || res.status === 413) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setToast(body?.error ?? "That answer didn't save. Try a shorter version?");
        } else if (!res.ok) {
          failed = true;
          break;
        }
        if (pending.current.get(qid) === value) pending.current.delete(qid);
      }
    } catch {
      failed = true;
    } finally {
      inflight.current = false;
      writePending(slug, pending.current);
    }
    if (failed) {
      setSave('retrying');
      timer.current = window.setTimeout(() => void flush(), backoff.current);
      backoff.current = Math.min(backoff.current * 2, 30000);
      return;
    }
    backoff.current = 2000;
    if (pending.current.size) timer.current = window.setTimeout(() => void flush(), 50);
    else setSave((s) => (s === 'expired' ? s : 'saved'));
  }, [slug]);

  const queue = useCallback(
    (qid: string, value: AnswerValue | null, delay = 450) => {
      if (preview) return;
      pending.current.set(qid, value);
      writePending(slug, pending.current);
      setSave((s) => (s === 'expired' ? s : 'saving'));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [flush, slug, preview],
  );

  const setAnswer = useCallback(
    (qid: string, value: AnswerValue | null) => {
      setAnswers((a) => {
        const next = { ...a };
        if (value === null) delete next[qid];
        else next[qid] = value;
        return next;
      });
      queue(qid, value);
    },
    [queue],
  );

  // Retry unsaved changes from last time (kept on this device), flush when the connection comes back, and on the way out.
  useEffect(() => {
    if (preview) return;
    const local = readPending(slug);
    const entries = Object.entries(local).filter(([qid]) => !pending.current.has(qid));
    if (entries.length) {
      for (const [qid, v] of entries) pending.current.set(qid, v);
      setAnswers((a) => {
        const merged = { ...a };
        for (const [qid, v] of entries) {
          if (v === null) delete merged[qid];
          else merged[qid] = v;
        }
        return merged;
      });
      const localPos = local._pos?.v;
      if (typeof localPos === 'string') setPos(localPos);
    }
    if (pending.current.size) void flush();
    const online = () => void flush();
    const leave = () => {
      if (document.visibilityState === 'hidden' || !document.visibilityState) {
        for (const [qid, value] of pending.current.entries()) {
          try {
            void fetch(api('answer'), { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ qid, value }) });
          } catch {
            // The local copy stays queued for next time.
          }
        }
      }
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('pagehide', leave);
    };
  }, [flush]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (resumed.current) {
      resumed.current = false;
      setToast('Welcome back. You\'re right where you left off.');
    }
  }, []);

  // ----- navigation -----
  const heading = useRef<HTMLHeadingElement>(null);
  const go = useCallback(
    (key: string) => {
      setPos(key);
      setDone(false);
      setMenuOpen(false);
      queue('_pos', { v: key }, 900);
      window.scrollTo({ top: 0 });
      window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 30);
    },
    [queue],
  );
  const next = () => go(steps[Math.min(index + 1, steps.length - 1)].key);
  const back = () => go(steps[Math.max(index - 1, 0)].key);
  const firstStepOf = (chapter: Chapter) => steps.find((s) => s.kind !== 'break' && s.kind !== 'review' && s.chapter.id === chapter.id)?.key ?? 'welcome';

  // ----- uploads -----
  const upload: Ctx['upload'] = useCallback(
    async (qid, original, onProgress) => {
      if (preview) throw new Error('Uploads are off in preview.');
      if (!OK_EXT.test(original.name) && !/^image\//.test(original.type)) throw new Error("That file type isn't supported here. Images, PDF, SVG, AI and EPS all work.");
      let file = original;
      // Big phone photos get resized to web size on the device, so uploads finish quickly on a slow connection.
      // Logo and cover files are never touched.
      if (/^image\/(jpeg|webp)$/.test(file.type) && file.size > PHOTO_RESIZE_OVER && !/logo|cover/.test(qid)) {
        file = await shrinkImage(file, 3200).catch(() => original);
      }
      if (file.size > MAX_UPLOAD) {
        file = await shrinkImage(file, 4000).catch(() => file);
        if (file.size > MAX_UPLOAD) throw new Error(`That file is over 25 MB. Try a smaller version, or text it to ${owner}.`);
      }
      const form = new FormData();
      form.append('qid', qid);
      form.append('file', file, OK_EXT.test(file.name) ? file.name : `${file.name}.${(file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', api('upload'));
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        xhr.onload = () => {
          let body: { ok?: boolean; error?: string; upload?: UploadInfo } | null = null;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            // Not JSON: fall through to the generic message.
          }
          if (xhr.status === 401) setSave('expired');
          if (xhr.status >= 200 && xhr.status < 300 && body?.ok && body.upload) {
            onProgress(100);
            setUploads((u) => [...u, body!.upload!]);
            resolve();
          } else reject(new Error(body?.error ?? "That upload didn't go through. Try again?"));
        };
        xhr.onerror = () => reject(new Error("That upload didn't go through. Check your connection and try again."));
        xhr.send(form);
      });
    },
    [owner, preview],
  );

  const removeUpload: Ctx['removeUpload'] = useCallback(async (id) => {
    if (preview) {
      setToast('Preview only. Files stay as they are.');
      return;
    }
    const res = await fetch(`${api('upload')}?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
    if (res?.status === 401) setSave('expired');
    if (res?.ok || res?.status === 404) setUploads((u) => u.filter((x) => x.id !== id));
    else setToast("Couldn't remove that file just now. Try again in a moment.");
  }, []);

  const ctx: Ctx = { config, answers, uploads, upload, removeUpload };

  // ----- submit -----
  const submit = async () => {
    if (preview) {
      setDone(true);
      window.scrollTo({ top: 0 });
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await flush();
      if (pending.current.size) throw new Error('unsaved');
      const res = await fetch(api('submit'), { method: 'POST', credentials: 'same-origin' });
      if (res.status === 401) {
        setSave('expired');
        throw new Error('expired');
      }
      if (!res.ok) throw new Error('failed');
      setSubmittedAt(new Date().toISOString());
      setDone(true);
      window.scrollTo({ top: 0 });
      window.setTimeout(() => heading.current?.focus({ preventScroll: true }), 30);
    } catch {
      setSendError(`That didn't send. Check your connection and try again. Your answers are saved either way.`);
    } finally {
      setSending(false);
    }
  };

  // ----- render -----
  const chapter = step.kind === 'review' ? null : step.chapter;
  const remainingMinutes = (from: number) => chapters.filter((c) => c.n > from).reduce((n, c) => n + c.minutes, 0);

  return (
    <div className="bp-app">
      <TopBar
        base={base}
        chapters={chapters}
        answers={answers}
        current={done ? null : chapter}
        label={done ? 'All set' : step.kind === 'review' ? 'Review and send' : step.kind === 'break' ? 'Halfway' : `Chapter ${chapter!.n} of ${chapters.length}: ${chapter!.title}`}
        minutes={step.kind === 'screen' && !done ? chapter!.minutes : null}
        save={save}
        onMenu={() => setMenuOpen(true)}
      />

      {preview && (
        <div className="bp-banner bp-banner--preview" role="note">
          <Icon name="lock" size={18} />
          <span>Preview. Nothing you do here is saved, and {config.firstName} won't see it. Sending just shows the done screen.</span>
          <a className="eq-btn eq-btn--secondary" href={`${base}admin/${slug}`}>
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

      {done ? (
        <Done config={config} heading={heading} onBack={() => go('review')} />
      ) : step.kind === 'welcome' ? (
        <Welcome config={config} chapters={chapters} heading={heading} title={step.screen.title} resumed={!!savedPos && savedPos !== 'welcome'} onStart={() => go(savedPos && savedPos !== 'welcome' && steps.some((s) => s.key === savedPos) ? savedPos : steps[1].key)} />
      ) : step.kind === 'break' ? (
        <Checkpoint config={config} heading={heading} minutes={remainingMinutes(BREAK_AFTER_CHAPTER)} onReview={() => go('review')} />
      ) : step.kind === 'review' ? (
        <Review config={config} chapters={chapters} answers={answers} uploads={uploads} heading={heading} submittedAt={submittedAt} sendError={sendError} onEdit={(chapterId, screenId) => go(`${chapterId}/${screenId}`)} />
      ) : (
        <main className="eq-page bp-screen" id="main">
          <header className="eq-stack" style={{ gap: 12 }}>
            {step.screen.eyebrow && <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>{step.screen.eyebrow}</span>}
            <h1 className="eq-h1" ref={heading} tabIndex={-1}>
              {step.screen.title}
            </h1>
            {step.screen.lead && <p className="eq-lead">{step.screen.lead}</p>}
          </header>
          {step.screen.why && (
            <aside className="eq-why">
              <span className="eq-why__label">Why we ask</span>
              <p>{step.screen.why}</p>
            </aside>
          )}
          {step.screen.questions
            .filter((q) => isVisible(q, answers))
            .map((q) => (
              <QuestionView key={q.id} q={q} value={answers[q.id]} set={(v) => setAnswer(q.id, v)} ctx={ctx} />
            ))}
        </main>
      )}

      {!done && step.kind !== 'welcome' && (
        <nav className="eq-bar" aria-label="Move between steps">
          {index > 0 && (
            <button type="button" className="eq-btn eq-btn--secondary" onClick={back}>
              <Icon name="back" size={18} />
              Back
            </button>
          )}
          {step.kind === 'review' ? (
            <button type="button" className="eq-btn eq-btn--primary" onClick={() => void submit()} disabled={sending}>
              {sending ? 'Sending...' : submittedAt ? 'Send my updates' : `Send it to ${owner}`}
              {!sending && <Icon name="arrow" size={18} />}
            </button>
          ) : (
            <button type="button" className="eq-btn eq-btn--primary" onClick={next}>
              {nextLabel(steps, index)}
              <Icon name="arrow" size={18} />
            </button>
          )}
        </nav>
      )}

      {menuOpen && <ChapterMenu chapters={chapters} answers={answers} current={done ? null : chapter?.id ?? null} onClose={() => setMenuOpen(false)} onPick={(c) => go(firstStepOf(c))} onReview={() => go('review')} slug={slug} base={base} preview={preview} />}

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

function nextLabel(steps: Step[], index: number): string {
  const here = steps[index];
  const after = steps[index + 1];
  if (!after) return 'Continue';
  if (after.kind === 'review') return 'Review my answers';
  if (after.kind === 'break') return 'Continue';
  if (here.kind === 'break') return `Keep going`;
  if (here.kind === 'screen' && after.kind === 'screen' && after.chapter.id !== here.chapter.id) return `Next: ${after.chapter.title}`;
  return 'Continue';
}

// ---------- pieces ----------

function TopBar({ base, chapters, answers, current, label, minutes, save, onMenu }: { base: string; chapters: Chapter[]; answers: Answers; current: Chapter | null; label: string; minutes: number | null; save: SaveState; onMenu: () => void }) {
  return (
    <header className="eq-top">
      <div className="eq-top__row">
        <img className="eq-top__logo" src={`${base}equicity-logo.png`} alt="Equicity" width={110} height={22} />
        <span className="eq-top__meta bp-save" data-state={save} aria-live="polite">
          {save === 'saving' && 'Saving...'}
          {save === 'saved' && (
            <>
              <Icon name="saved" />
              Saved
            </>
          )}
          {save === 'retrying' && (
            <>
              <Icon name="clock" />
              Will save in a moment
            </>
          )}
          {save === 'preview' && 'Preview only'}
          {save === 'idle' && (
            <>
              <Icon name="saved" />
              Autosave on
            </>
          )}
        </span>
        <button type="button" className="eq-btn eq-btn--quiet bp-menu-btn" onClick={onMenu} aria-haspopup="dialog">
          <Icon name="list" size={18} />
          Chapters
        </button>
      </div>
      <div className="eq-segs" aria-hidden="true">
        {chapters.map((c) => {
          const p = chapterProgress(c, answers);
          return (
            <span key={c.id} className={`eq-seg${p >= 1 ? ' eq-seg--done' : ''}`} data-current={current?.id === c.id}>
              <span style={{ width: `${Math.round(p * 100)}%` }} />
            </span>
          );
        })}
      </div>
      <div className="eq-top__row">
        <span className="eq-top__chapter">{label}</span>
        {minutes !== null && (
          <span className="eq-top__meta">
            <Icon name="clock" />
            About {minutes} min
          </span>
        )}
      </div>
    </header>
  );
}

function Welcome({ config, chapters, heading, title, resumed, onStart }: { config: ClientConfig; chapters: Chapter[]; heading: React.RefObject<HTMLHeadingElement | null>; title: string; resumed: boolean; onStart: () => void }) {
  const owner = config.ownerName;
  const core = chapters.filter((c) => c.n <= BREAK_AFTER_CHAPTER);
  const rest = chapters.filter((c) => c.n > BREAK_AFTER_CHAPTER);
  return (
    <main className="eq-page" id="main">
      <header className="eq-stack" style={{ gap: 14 }}>
        <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>
          Your blueprint
        </span>
        <h1 className="eq-h1" ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="eq-lead">{config.welcomeNote}</p>
      </header>

      <ul className="bp-how">
        <li>
          <Icon name="clock" />
          <span>
            About {config.timeTargetMinutes} minutes for the first {core.length} chapters. The rest is quicker, and you can do it whenever you have a few minutes.
          </span>
        </li>
        <li>
          <Icon name="saved" />
          <span>Everything saves as you go. Open the same link on any device, enter your code, and you'll pick up where you left off.</span>
        </li>
        <li>
          <Icon name="heart" />
          <span>Tap what you love, skip what you don't. "Not sure yet" and "Let's talk about it" are always good answers.</span>
        </li>
        <li>
          <Icon name="lock" />
          <span>Private to you and {owner}. You'll never be asked for a password here.</span>
        </li>
      </ul>

      <section className="eq-stack" aria-label="Chapters">
        <span className="eq-why__label">The chapters</span>
        <ol className="bp-toc">
          {core.map((c) => (
            <li key={c.id}>
              <span className="bp-toc__n">{c.n}</span>
              <span className="bp-toc__t">{c.title}</span>
              <span className="bp-toc__m">{c.minutes} min</span>
            </li>
          ))}
        </ol>
        {rest.length > 0 && (
          <>
            <span className="eq-field__help">Then, whenever suits you</span>
            <ol className="bp-toc bp-toc--quiet">
              {rest.map((c) => (
                <li key={c.id}>
                  <span className="bp-toc__n">{c.n}</span>
                  <span className="bp-toc__t">{c.title}</span>
                  <span className="bp-toc__m">{c.minutes} min</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="eq-muted" style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
          Anytime before {config.dates.allDue} is perfect.
        </p>
      </section>

      <button type="button" className="eq-btn eq-btn--primary eq-btn--block" onClick={onStart}>
        {resumed ? 'Pick up where you left off' : "Let's start"}
        <Icon name="arrow" size={18} />
      </button>
    </main>
  );
}

function Checkpoint({ config, heading, minutes, onReview }: { config: ClientConfig; heading: React.RefObject<HTMLHeadingElement | null>; minutes: number; onReview: () => void }) {
  return (
    <main className="eq-page" id="main">
      <header className="eq-stack" style={{ gap: 14 }}>
        <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>
          Halfway
        </span>
        <h1 className="eq-h1" ref={heading} tabIndex={-1}>
          That's the <span className="eq-hl">big part</span> done.
        </h1>
        <p className="eq-lead">
          Your look and feel are in, and that's what {config.ownerName} needs most to start on your homepage direction. Next up: your pages, how people reach you, files and access, and how we'll work. About {minutes} minutes.
        </p>
      </header>
      <aside className="eq-why">
        <span className="eq-why__label">Need a break?</span>
        <p>Everything's saved. Come back with the same link and code whenever you like, and you'll land right here.</p>
      </aside>
      <button type="button" className="eq-btn eq-btn--quiet" style={{ justifySelf: 'start' }} onClick={onReview}>
        Review what you have so far
      </button>
    </main>
  );
}

function Review({
  config,
  chapters,
  answers,
  uploads,
  heading,
  submittedAt,
  sendError,
  onEdit,
}: {
  config: ClientConfig;
  chapters: Chapter[];
  answers: Answers;
  uploads: UploadInfo[];
  heading: React.RefObject<HTMLHeadingElement | null>;
  submittedAt: string | null;
  sendError: string | null;
  onEdit: (chapterId: string, screenId: string) => void;
}) {
  const sections = useMemo(() => buildReview(config, answers, uploads, chapters), [config, answers, uploads, chapters]);
  const talk = sections.flatMap((s) => s.items).filter((i) => i.exit === 'talk').length;
  return (
    <main className="eq-page" id="main">
      <header className="eq-stack" style={{ gap: 14 }}>
        <span className="eq-eyebrow" style={{ justifySelf: 'start' }}>
          {submittedAt ? 'Sent' : 'Almost done'}
        </span>
        <h1 className="eq-h1" ref={heading} tabIndex={-1}>
          Here's what we heard
        </h1>
        <p className="eq-lead">
          Look it over and tap Edit to change anything. {submittedAt ? `You already sent this to ${config.ownerName}. Changes save on their own, and you can send again so ${config.ownerName} gets a heads up.` : `When it feels right, send it to ${config.ownerName}. Gaps are fine.`}
        </p>
        {talk > 0 && (
          <p className="eq-muted" style={{ margin: 0 }}>
            {talk === 1 ? "One thing is marked to talk about. We'll cover it on our call." : `${talk} things are marked to talk about. We'll cover them on our call.`}
          </p>
        )}
      </header>

      {sections.map((s) => (
        <section key={`${s.chapterId}/${s.screenId}`} className="bp-review" aria-label={s.title}>
          <div className="bp-review__head">
            <h2 className="bp-review__title">{s.title}</h2>
            <button type="button" className="eq-btn eq-btn--quiet" onClick={() => onEdit(s.chapterId, s.screenId)}>
              <Icon name="edit" size={16} />
              Edit
            </button>
          </div>
          {s.items.length === 0 ? (
            <p className="eq-muted" style={{ margin: 0, fontSize: 15 }}>
              Skipped for now
            </p>
          ) : (
            <dl className="bp-review__list">
              {s.items.map((it) => (
                <div key={it.qid}>
                  <dt>{it.label}</dt>
                  <dd>
                    {it.text}
                    {it.exit && <span className="eq-status" style={{ marginLeft: it.text ? 8 : 0 }}>{it.exit === 'talk' ? "Let's talk about it" : 'Not sure yet'}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}

      {sendError && (
        <p className="eq-field__warn" role="alert">
          <Icon name="alert" size={18} />
          <span>{sendError}</span>
        </p>
      )}
      <p className="eq-muted" style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>
        You can still change anything after you send it.
      </p>
    </main>
  );
}

function Done({ config, heading, onBack }: { config: ClientConfig; heading: React.RefObject<HTMLHeadingElement | null>; onBack: () => void }) {
  const owner = config.ownerName;
  return (
    <main className="eq-page bp-done" id="main">
      <header className="eq-stack" style={{ gap: 18 }}>
        <h1 className="eq-display" ref={heading} tabIndex={-1}>
          You're{' '}
          <span className="eq-circled">
            all set
            <MarkerCircle />
          </span>
        </h1>
        <p className="eq-lead">
          Thanks, {config.firstName}. {owner} has everything and will go through it before your call.
        </p>
      </header>

      <section className="eq-stack" aria-label="What happens next">
        <span className="eq-why__label">What happens next</span>
        <ol className="bp-next">
          <li>
            <b>{owner} reads through your answers</b>
            <span>and pulls together a direction for your homepage.</span>
          </li>
          <li>
            <b>We go over it together on our call</b>
            <span>including anything you marked to talk about.</span>
          </li>
          <li>
            <b>{owner} will send your voice memo prompts next</b>
            <span>so we can capture your story in your own words.</span>
          </li>
        </ol>
      </section>

      {config.dates.timeline.length > 0 && (
        <section className="eq-stack" aria-label="The timeline">
          <span className="eq-why__label">The timeline</span>
          <ol className="bp-next bp-next--timeline">
            {config.dates.timeline.map((t, i) => (
              <li key={i}>
                <b>{t.label}</b>
                <span>{t.when}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <aside className="eq-why">
        <span className="eq-why__label">Thought of something?</span>
        <p>Come back anytime with the same link and code. Change what you like, then send it again.</p>
      </aside>
      <button type="button" className="eq-btn eq-btn--secondary" style={{ justifySelf: 'start' }} onClick={onBack}>
        <Icon name="edit" size={18} />
        Back to my answers
      </button>
    </main>
  );
}

function ChapterMenu({ chapters, answers, current, onClose, onPick, onReview, slug, base, preview }: { chapters: Chapter[]; answers: Answers; current: string | null; onClose: () => void; onPick: (c: Chapter) => void; onReview: () => void; slug: string; base: string; preview: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="bp-sheet" role="dialog" aria-modal="true" aria-label="Chapters">
      <button type="button" className="bp-sheet__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <div className="bp-sheet__panel" ref={panel}>
        <div className="bp-sheet__head">
          <h2 className="bp-review__title" style={{ fontSize: 18 }}>
            Chapters
          </h2>
          <button type="button" className="eq-btn eq-btn--quiet" onClick={onClose}>
            <Icon name="x" size={18} />
            Close
          </button>
        </div>
        <ol className="bp-chapters">
          {chapters.map((c) => {
            const p = chapterProgress(c, answers);
            const status = p >= 1 ? 'Done' : p > 0 ? 'Started' : 'Not started';
            return (
              <li key={c.id}>
                <button type="button" className="bp-chapter" aria-current={current === c.id ? 'step' : undefined} onClick={() => onPick(c)}>
                  <span className="bp-toc__n">{c.n}</span>
                  <span className="bp-chapter__t">
                    {c.title}
                    <span className="bp-chapter__m">About {c.minutes} min</span>
                  </span>
                  <span className={`eq-status${p >= 1 ? ' eq-status--done' : ''}`}>{status}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="eq-btn eq-btn--primary eq-btn--block" onClick={onReview}>
          Review and send
        </button>
        {!preview && (
          <form method="post" action={`${base}api/${slug}/logout`} style={{ display: 'grid' }}>
            <button type="submit" className="eq-btn eq-btn--quiet">
              Sign out on this device
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
