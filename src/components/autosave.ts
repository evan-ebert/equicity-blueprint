/**
 * The save engine shared by the discovery chapters and review rounds.
 *
 * One answer per request, debounced, retried with backoff, and never left hanging: every request is
 * aborted after 12 seconds and counted as a failure. Unsent answers wait in localStorage (48 hours)
 * with the time they were set, so an old queued answer never overwrites a newer one from another
 * device. When the tab comes back (restored from memory, or visible again after half a minute away)
 * the server's answers are fetched and merged: the server wins, except for answers still queued on
 * this device that are newer than the server's copy.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AnswerValue = { v: unknown; exit?: 'not-sure' | 'talk' };
export type Answers = Record<string, AnswerValue | undefined>;
export type Queued = { value: AnswerValue | null; at: number };
export type SaveState = 'idle' | 'saving' | 'saved' | 'retrying' | 'expired' | 'locked' | 'preview';

export type ServerState = { answers: Answers; updatedAt?: Record<string, string>; now?: string };

const REQUEST_TIMEOUT = 12_000;
const QUEUE_RETENTION = 48 * 3600_000;
const REFETCH_AFTER_HIDDEN = 30_000;

/** D1 stores "YYYY-MM-DD HH:MM:SS" in UTC; the API may also send ISO strings. */
export function parseServerTime(s: string | undefined | null): number {
  if (!s) return 0;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? t : 0;
}

export function readQueue(key: string): Map<string, Queued> {
  const out = new Map<string, Queued>();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as { at?: number; items?: Record<string, Queued | AnswerValue | null> };
    if (!parsed?.items) return out;
    const cutoff = Date.now() - QUEUE_RETENTION;
    for (const [qid, item] of Object.entries(parsed.items)) {
      // Items from before timestamps existed carry the file's time.
      const q: Queued = item && typeof item === 'object' && 'at' in item && 'value' in item ? (item as Queued) : { value: item as AnswerValue | null, at: parsed.at ?? 0 };
      if (q.at >= cutoff) out.set(qid, q);
    }
  } catch {
    // Unreadable or blocked storage: start with an empty queue.
  }
  return out;
}

export function writeQueue(key: string, items: Map<string, Queued>) {
  try {
    if (!items.size) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ at: Date.now(), items: Object.fromEntries(items) }));
  } catch {
    // Private mode or storage blocked: the in-memory queue still retries.
  }
}

/** Drop queued answers the server has since moved past, then lay the rest over the server's answers. */
export function mergeServer(server: Answers, updatedAt: Record<string, string> | undefined, queue: Map<string, Queued>, skewMs: number): Answers {
  for (const [qid, q] of [...queue.entries()]) {
    const serverAt = parseServerTime(updatedAt?.[qid]);
    if (serverAt && serverAt > q.at + skewMs) queue.delete(qid);
  }
  const merged: Answers = { ...server };
  for (const [qid, q] of queue) {
    if (q.value === null) delete merged[qid];
    else merged[qid] = q.value;
  }
  return merged;
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(t);
  }
}

export type AutosaveOptions = {
  /** localStorage key for this device's queue, for example "bp:hart-to-heart:pending". */
  storageKey: string;
  /** PUT { qid, value } here. */
  saveUrl: string;
  /** GET the current answers here. */
  stateUrl: string;
  initialAnswers: Answers;
  /** Per-question server timestamps at render time, so stale queued answers are dropped before they show. */
  initialUpdatedAt?: Record<string, string>;
  /** The server's clock at render time, for devices whose clock is off. */
  serverNow?: string | null;
  /** Read only: nothing is queued or sent. */
  preview?: boolean;
  /** The server has locked this (a sent round): nothing is queued or sent. */
  locked?: boolean;
  /** Turn a state response into answers plus anything else the caller wants (uploads, status). */
  parseState?: (body: unknown) => ServerState | null;
  /** Called after a refetch merges the server's answers; `changed` says whether anything differed. */
  onRefetch?: (merged: Answers, body: unknown, changed: boolean) => void;
  /** A save came back 409: the server has locked this. */
  onLocked?: () => void;
  /** A save was refused (400 or 413) with a message for the client. */
  onRejected?: (message: string | null) => void;
};

export function useAutosave(opts: AutosaveOptions) {
  const { storageKey, saveUrl, stateUrl, preview = false, locked = false } = opts;
  const readOnly = preview || locked;
  const latest = useRef(opts);
  latest.current = opts;

  const queue = useRef<Map<string, Queued>>(new Map());
  const [answers, setAnswers] = useState<Answers>(opts.initialAnswers);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const [save, setSave] = useState<SaveState>(preview ? 'preview' : locked ? 'locked' : 'idle');
  const timer = useRef<number | undefined>(undefined);
  const inflight = useRef(false);
  const backoff = useRef(2000);
  const skew = useRef(opts.serverNow ? parseServerTime(opts.serverNow) - Date.now() : 0);
  const refetching = useRef(false);
  const stopped = useRef(false); // expired or locked: stop sending

  // A lock that arrives later (the round was sent) stops saving for good.
  useEffect(() => {
    if (!locked) return;
    stopped.current = true;
    window.clearTimeout(timer.current);
    setSave('locked');
  }, [locked]);

  const setSoft = useCallback((s: SaveState) => setSave((cur) => (cur === 'expired' || cur === 'locked' || cur === 'preview' ? cur : s)), []);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (inflight.current || stopped.current || !queue.current.size) return;
    inflight.current = true;
    setSoft('saving');
    let failed = false;
    try {
      for (const [qid, q] of [...queue.current.entries()]) {
        let res: Response;
        try {
          res = await fetchWithTimeout(saveUrl, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ qid, value: q.value }),
          });
        } catch {
          failed = true;
          break;
        }
        if (res.status === 401) {
          stopped.current = true;
          setSave('expired');
          return;
        }
        if (res.status === 409) {
          stopped.current = true;
          setSave('locked');
          latest.current.onLocked?.();
          return;
        }
        if (res.status === 400 || res.status === 413) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          latest.current.onRejected?.(body?.error ?? null);
        } else if (!res.ok) {
          failed = true;
          break;
        }
        if (queue.current.get(qid) === q) queue.current.delete(qid);
      }
    } finally {
      inflight.current = false;
      writeQueue(storageKey, queue.current);
    }
    if (failed) {
      setSoft('retrying');
      timer.current = window.setTimeout(() => void flush(), backoff.current);
      backoff.current = Math.min(backoff.current * 2, 30_000);
      return;
    }
    backoff.current = 2000;
    if (queue.current.size) timer.current = window.setTimeout(() => void flush(), 50);
    else setSoft('saved');
  }, [saveUrl, storageKey, setSoft]);

  /** Queue one answer. The delay lets a few quick taps collapse into one request. */
  const queueAnswer = useCallback(
    (qid: string, value: AnswerValue | null, delay = 450) => {
      if (readOnly || stopped.current) return;
      queue.current.set(qid, { value, at: Date.now() });
      writeQueue(storageKey, queue.current);
      setSoft('saving');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [flush, storageKey, readOnly, setSoft],
  );

  const setAnswer = useCallback(
    (qid: string, value: AnswerValue | null, delay?: number) => {
      setAnswers((a) => {
        const next = { ...a };
        if (value === null) delete next[qid];
        else next[qid] = value;
        return next;
      });
      queueAnswer(qid, value, delay);
    },
    [queueAnswer],
  );

  /** Fetch the server's answers and merge them over what this device shows. */
  const refetch = useCallback(async () => {
    if (readOnly || refetching.current || stopped.current) return;
    refetching.current = true;
    try {
      const res = await fetchWithTimeout(stateUrl, { credentials: 'same-origin', headers: { accept: 'application/json' } });
      if (res.status === 401) {
        stopped.current = true;
        setSave('expired');
        return;
      }
      if (!res.ok) return;
      const body = (await res.json()) as unknown;
      const parse = latest.current.parseState ?? ((b: unknown) => b as ServerState);
      const state = parse(body);
      if (!state || typeof state !== 'object' || !state.answers) return;
      if (state.now) skew.current = parseServerTime(state.now) - Date.now();
      const merged = mergeServer(state.answers, state.updatedAt, queue.current, skew.current);
      writeQueue(storageKey, queue.current);
      const changed = JSON.stringify(answersRef.current) !== JSON.stringify(merged);
      if (changed) setAnswers(merged);
      latest.current.onRefetch?.(merged, body, changed);
      if (queue.current.size) void flush();
    } catch {
      // Offline or slow: keep what we have. The next resume tries again.
    } finally {
      refetching.current = false;
    }
  }, [stateUrl, storageKey, readOnly, flush]);

  // Startup: apply this device's unsent answers (minus any the server has since moved past), then send them.
  // Then listen for the moments a phone comes back: a tab restored from memory, or visible again after a while.
  useEffect(() => {
    if (readOnly) return;
    const local = readQueue(storageKey);
    if (local.size) {
      for (const [qid, q] of local) if (!queue.current.has(qid)) queue.current.set(qid, q);
      setAnswers((a) => mergeServer(a, latest.current.initialUpdatedAt, queue.current, skew.current));
      writeQueue(storageKey, queue.current);
    }
    if (queue.current.size) void flush();

    let hiddenAt = 0;
    const online = () => void flush();
    const pageshow = (e: PageTransitionEvent) => {
      if (e.persisted) void refetch();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        // Push whatever is queued on the way out; the local copy stays until the server confirms.
        for (const [qid, q] of queue.current.entries()) {
          try {
            void fetch(saveUrl, { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ qid, value: q.value }) });
          } catch {
            // Still queued for next time.
          }
        }
      } else if (document.visibilityState === 'visible') {
        if (hiddenAt && Date.now() - hiddenAt > REFETCH_AFTER_HIDDEN) void refetch();
        else if (queue.current.size) void flush();
        hiddenAt = 0;
      }
    };
    const pagehide = () => {
      for (const [qid, q] of queue.current.entries()) {
        try {
          void fetch(saveUrl, { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ qid, value: q.value }) });
        } catch {
          // Still queued for next time.
        }
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('pageshow', pageshow);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('pageshow', pageshow);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [flush, refetch, saveUrl, storageKey, readOnly]);

  /** Wait for the queue to empty (used before Send). Resolves false if something is still unsent. */
  const settle = useCallback(async (): Promise<boolean> => {
    for (let i = 0; i < 40 && (inflight.current || queue.current.size); i++) {
      if (!inflight.current) await flush();
      else await new Promise((r) => window.setTimeout(r, 150));
    }
    return queue.current.size === 0;
  }, [flush]);

  const markExpired = useCallback(() => {
    stopped.current = true;
    setSave('expired');
  }, []);

  return { answers, setAnswers, setAnswer, queue: queueAnswer, save, setSave, flush, refetch, settle, markExpired, pending: queue };
}
