import { useEffect, useRef, useState } from 'react';
import type { ClientConfig, PaletteConfig } from '../lib/config';
import { resolvePalette } from '../lib/shared';
import { LAYOUTS, TYPE_PAIRINGS, type AnswerValue, type Answers, type Question, type RepeatField } from '../lib/chapters';
import type { UploadInfo } from '../lib/summary';
import { Icon, Tick } from './icons';
import { ExampleStage, ImageryStage, LayoutStage, PaletteStage, TYPE_SPECS, TypeStage } from './galleries';

export type Ctx = {
  config: ClientConfig;
  answers: Answers;
  uploads: UploadInfo[];
  upload: (qid: string, file: File, onProgress: (pct: number) => void) => Promise<void>;
  removeUpload: (id: string) => Promise<void>;
};

type Props<V = any> = { q: Question; value: AnswerValue | undefined; set: (v: AnswerValue | null) => void; ctx: Ctx; v: V };

/** Looks like a login or password: warn before saving. */
const PASSWORD_HINT = /(pass\s*word|passcode|\bpwd\b|\bpw\s*[:=]|\blogin\s*[:=]|\buser(name)?\s*[:=]|\bpin\s*[:=])/i;
export function looksLikeSecret(s: string) {
  return PASSWORD_HINT.test(s);
}

function setV(set: Props['set'], value: AnswerValue | undefined, v: unknown) {
  set({ v, ...(value?.exit ? {} : {}) });
}

// ---------- shared pieces ----------

export function Exits({ q, value, set }: { q: Question; value: AnswerValue | undefined; set: Props['set'] }) {
  const toggle = (exit: 'not-sure' | 'talk') => {
    if (value?.exit === exit) set(value.v === undefined || value.v === null ? null : { v: value.v });
    else set({ v: value?.v ?? null, exit });
  };
  return (
    <div className="eq-exits">
      <button type="button" className="eq-exit" aria-pressed={value?.exit === 'not-sure'} onClick={() => toggle('not-sure')}>
        {q.exitLabels?.notSure ?? 'Not sure yet'}
      </button>
      <button type="button" className="eq-exit" aria-pressed={value?.exit === 'talk'} onClick={() => toggle('talk')}>
        {q.exitLabels?.talk ?? "Let's talk about it"}
      </button>
    </div>
  );
}

/** A text input that saves on a short pause and warns if the text looks like a password. */
export function TextBox({
  value,
  onSave,
  placeholder,
  multiline,
  inputType = 'text',
  label,
  hideLabel,
  help,
}: {
  value: string;
  onSave: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  inputType?: string;
  label: string;
  hideLabel?: boolean;
  help?: string;
}) {
  const [text, setText] = useState(value);
  const [override, setOverride] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(value);
  useEffect(() => {
    if (value !== latest.current) {
      latest.current = value;
      setText(value);
    }
  }, [value]);
  const secret = !override && looksLikeSecret(text);
  const commit = (s: string) => {
    if (!override && looksLikeSecret(s)) return;
    latest.current = s;
    onSave(s);
  };
  const change = (s: string) => {
    setText(s);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(s), 700);
  };
  const common = {
    className: 'eq-input',
    value: text,
    placeholder,
    'aria-label': hideLabel ? label : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(e.target.value),
    onBlur: () => {
      window.clearTimeout(timer.current);
      if (text !== latest.current) commit(text);
    },
  };
  return (
    <label className="eq-field">
      {!hideLabel && <span className="eq-field__label">{label}</span>}
      {multiline ? <textarea {...common} rows={3} /> : <input {...common} type={inputType} inputMode={inputType === 'url' ? 'url' : undefined} />}
      {help && <span className="eq-field__help">{help}</span>}
      {secret && (
        <span className="eq-field__warn" role="alert">
          <Icon name="alert" size={18} />
          <span>
            This looks like it might be a login or password, so we haven't saved it. Please don't share passwords here. We'll show you how to invite us instead.{' '}
            <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 32, padding: '0 4px' }} onClick={() => { setOverride(true); onSave(text); }}>
              It's not a password, save it
            </button>
          </span>
        </span>
      )}
    </label>
  );
}

function Chip({ on, onClick, children, row, role }: { on: boolean; onClick: () => void; children: React.ReactNode; row?: boolean; role?: 'radio' }) {
  const aria = role === 'radio' ? { role: 'radio', 'aria-checked': on } : { 'aria-pressed': on };
  return (
    <button type="button" className={`eq-chip${row ? ' eq-chip--row' : ''}`} onClick={onClick} {...aria}>
      {row ? (
        <>
          <span>{children}</span>
          <Tick />
        </>
      ) : (
        <>
          <Tick />
          {children}
        </>
      )}
    </button>
  );
}

// ---------- question types ----------

function Confirm({ q, value, set }: Props) {
  if (q.type !== 'confirm') return null;
  const v = (value?.v ?? {}) as Record<string, string | boolean>;
  return (
    <div className="eq-stack" style={{ gap: 14 }}>
      {q.fields.map((f) => (
        <TextBox key={f.id} label={f.label} inputType={f.inputType} value={(v[f.id] as string) ?? f.value} onSave={(s) => set({ v: { ...v, [f.id]: s === f.value ? undefined : s, confirmed: true } })} />
      ))}
      <button type="button" className="eq-chip eq-chip--row" role="checkbox" aria-checked={!!v.confirmed} onClick={() => set({ v: { ...v, confirmed: !v.confirmed } })}>
        <span>Looks right</span>
        <Tick />
      </button>
    </div>
  );
}

function Tap({ q, value, set }: Props) {
  if (q.type !== 'tap') return null;
  const v = (value?.v ?? {}) as { choice?: string };
  const note = v.choice ? q.notes?.[v.choice] : undefined;
  return (
    <div className="eq-stack">
      <div className="eq-chips--stack" role="radiogroup" aria-label={q.title}>
        {q.options.map((o) => (
          <Chip key={o.id} row role="radio" on={v.choice === o.id} onClick={() => set({ v: { choice: o.id } })}>
            {o.label}
            {q.recommended === o.id && <span className="eq-status eq-status--done" style={{ marginLeft: 8 }}>What we recommend</span>}
          </Chip>
        ))}
      </div>
      {q.recommended && q.notes?.[q.recommended] && v.choice !== q.recommended && <p className="eq-q__hint" style={{ margin: 0 }}>{q.notes[q.recommended]}</p>}
      {note && <p style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: 'var(--blue-tint)', fontSize: 15, lineHeight: '22px' }}>{note}</p>}
    </div>
  );
}

function Multi({ q, value, set }: Props) {
  if (q.type !== 'multi') return null;
  const stored = value?.v as { picks?: string[]; other?: string } | undefined;
  const v = stored ?? (q.defaultAll ? { picks: q.options.map((o) => o.id) } : { picks: [] });
  const picks = v.picks ?? [];
  const full = q.max !== undefined && picks.length >= q.max;
  const toggle = (id: string) => {
    const has = picks.includes(id);
    if (!has && full) return;
    set({ v: { ...v, picks: has ? picks.filter((x) => x !== id) : [...picks, id] } });
  };
  return (
    <div className="eq-stack">
      <div className="eq-chips">
        {q.options.map((o) => (
          <Chip key={o.id} on={picks.includes(o.id)} onClick={() => toggle(o.id)}>
            {o.label}
          </Chip>
        ))}
      </div>
      {full && <p className="eq-q__hint" style={{ margin: 0 }}>That's {q.max}. Tap one to swap it out.</p>}
      {q.other && <TextBox label="Something else" hideLabel placeholder="Something else? Add it here" value={v.other ?? ''} onSave={(s) => set({ v: { ...v, picks, other: s || undefined } })} />}
      {q.anyNote && (picks.length > 0 || v.other) && <p style={{ margin: 0, padding: '12px 14px', borderRadius: 12, background: 'var(--blue-tint)', fontSize: 15, lineHeight: '22px' }}>{q.anyNote}</p>}
    </div>
  );
}

const RATES = [
  { id: 'love', label: 'Love it', icon: 'heart' },
  { id: 'maybe', label: 'Maybe', icon: 'maybe' },
  { id: 'no', label: 'Not for me', icon: 'x' },
] as const;

/** The palette and type the client likes best so far, used to render later tiles. */
export function topPick(answers: Answers, qid: string, fallback: string): string {
  const v = (answers[qid]?.v ?? {}) as Record<string, { r?: string }>;
  const love = Object.entries(v).find(([, x]) => x.r === 'love');
  const maybe = Object.entries(v).find(([, x]) => x.r === 'maybe');
  return love?.[0] ?? maybe?.[0] ?? fallback;
}

function Rate({ q, value, set, ctx }: Props) {
  if (q.type !== 'rate') return null;
  const c = ctx.config;
  const v = (value?.v ?? {}) as Record<string, { r?: string; note?: string; tags?: string[] }>;
  const brand = { short: c.businessShort, line: c.brand.sampleLine, headline: c.brand.sampleHeadline, cta: c.brand.sampleCta };
  const palettes = c.palettes.map((p) => resolvePalette(p, c.brand.primary));
  const pal = palettes.find((p) => p.id === topPick(ctx.answers, 'palettes', palettes[0].id)) ?? palettes[0];
  const typeSpec = TYPE_SPECS[topPick(ctx.answers, 'type-pairings', 'classic-serif')] ?? TYPE_SPECS['classic-serif'];
  const update = (id: string, patch: { r?: string; note?: string; tags?: string[] }) => set({ v: { ...v, [id]: { ...v[id], ...patch } } });

  const stage = (id: string): React.ReactNode => {
    switch (q.gallery) {
      case 'palette':
        return <PaletteStage p={palettes.find((p) => p.id === id) as PaletteConfig} brand={brand} type={typeSpec} />;
      case 'type':
        return <TypeStage spec={TYPE_SPECS[id]} p={pal} brand={brand} business={c.business} />;
      case 'layout':
        return <LayoutStage id={id} p={pal} type={typeSpec} brand={brand} firstName={c.firstName} />;
      case 'imagery': {
        const img = c.imagery.find((i) => i.id === id)!;
        return <ImageryStage src={img.src} label={img.label} credit={img.credit} creditUrl={img.creditUrl} />;
      }
      case 'example': {
        const ex = c.examples.find((e) => e.id === id)!;
        return <ExampleStage url={ex.url} name={ex.name} />;
      }
    }
  };
  const meta = (id: string) => {
    if (q.gallery === 'palette') return c.palettes.find((p) => p.id === id)?.note;
    if (q.gallery === 'type') return TYPE_PAIRINGS.find((t) => t.id === id)?.note;
    if (q.gallery === 'layout') return LAYOUTS.find((l) => l.id === id)?.note;
    if (q.gallery === 'example') return c.examples.find((e) => e.id === id)?.why;
    return undefined;
  };

  return (
    <div className="eq-stack" style={{ gap: 20 }}>
      {q.items.map((item) => {
        const r = v[item.id]?.r;
        const ex = q.gallery === 'example' ? c.examples.find((e) => e.id === item.id) : undefined;
        return (
          <article key={item.id} className="eq-tile" data-rating={r ?? ''}>
            {stage(item.id)}
            <div className="eq-tile__body">
              <h3 className="eq-tile__title">{item.label}</h3>
              {meta(item.id) && <p className="eq-tile__note">{meta(item.id)}</p>}
              {ex && (
                <a className="eq-btn eq-btn--secondary" href={ex.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start', minHeight: 44 }}>
                  Open the site <Icon name="external" size={18} />
                </a>
              )}
              <div className="eq-rate" role="group" aria-label={`Rate ${item.label}`}>
                {RATES.map((x) => (
                  <button key={x.id} type="button" className="eq-rate__btn" data-value={x.id} aria-pressed={r === x.id} onClick={() => update(item.id, { r: x.id })}>
                    <Icon name={x.icon} size={18} />
                    {x.label}
                  </button>
                ))}
              </div>
              {q.tags && (r === 'love' || r === 'maybe') && (
                <div className="eq-stack" style={{ gap: 8 }}>
                  <span className="eq-field__help">What do you like about it?</span>
                  <div className="eq-chips" style={{ gap: 8 }}>
                    {q.tags.map((t) => {
                      const tags = v[item.id]?.tags ?? [];
                      const on = tags.includes(t.label);
                      return (
                        <Chip key={t.id} on={on} onClick={() => update(item.id, { tags: on ? tags.filter((x) => x !== t.label) : [...tags, t.label] })}>
                          {t.label}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}
              {(r === 'love' || (q.tags && r === 'maybe')) && (
                <TextBox label="What do you love about it?" hideLabel placeholder={q.tags ? 'Anything else? (optional)' : 'What do you love about it? (optional)'} value={v[item.id]?.note ?? ''} onSave={(s) => update(item.id, { note: s || undefined })} />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Sliders({ q, value, set }: Props) {
  if (q.type !== 'sliders') return null;
  const v = (value?.v ?? {}) as Record<string, number>;
  return (
    <div className="eq-stack" style={{ gap: 18 }}>
      {q.sliders.map((s) => {
        const touched = typeof v[s.id] === 'number';
        return (
          <div className="eq-scale" key={s.id}>
            <div className="eq-scale__ends" aria-hidden="true">
              <span>{s.left}</span>
              <span>{s.right}</span>
            </div>
            <input
              className="eq-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={touched ? v[s.id] : 50}
              data-touched={touched}
              aria-label={`${s.left} to ${s.right}`}
              aria-valuetext={touched ? `${v[s.id]} out of 100` : 'Not set'}
              onChange={(e) => set({ v: { ...v, [s.id]: Number(e.target.value) } })}
            />
            {!touched && (
              <span className="eq-scale__hint">
                Not moved yet.{' '}
                <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 32, padding: '0 4px' }} onClick={() => set({ v: { ...v, [s.id]: 50 } })}>
                  The middle is right
                </button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Rank({ q, value, set }: Props) {
  if (q.type !== 'rank') return null;
  const ids = q.items.map((i) => i.id);
  const stored = Array.isArray(value?.v) ? (value!.v as string[]) : null;
  const order = stored ? [...stored.filter((id) => ids.includes(id)), ...ids.filter((id) => !stored.includes(id))] : ids;
  const [drag, setDrag] = useState<{ id: string; startY: number; dy: number } | null>(null);
  const rowH = 68;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    set({ v: next });
  };
  const onDown = (e: React.PointerEvent, id: string) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, startY: e.clientY, dy: 0 });
  };
  const onMove = (e: React.PointerEvent) => drag && setDrag({ ...drag, dy: e.clientY - drag.startY });
  const onUp = () => {
    if (!drag) return;
    const from = order.indexOf(drag.id);
    move(from, Math.max(0, Math.min(order.length - 1, from + Math.round(drag.dy / rowH))));
    setDrag(null);
  };
  return (
    <ol className="eq-rank">
      {order.map((id, i) => {
        const item = q.items.find((x) => x.id === id)!;
        const dragging = drag?.id === id;
        return (
          <li key={id} className="eq-rank__item" data-dragging={dragging} style={dragging ? { transform: `translateY(${drag!.dy}px)`, position: 'relative', zIndex: 2 } : undefined}>
            <span className="eq-rank__grip" onPointerDown={(e) => onDown(e, id)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)} aria-hidden="true">
              <Icon name="grip" />
            </span>
            <span className="eq-rank__num">{i + 1}</span>
            <span className="eq-rank__label">{item.label}</span>
            <span className="eq-rank__moves">
              <button type="button" className="eq-rank__move" aria-label={`Move ${item.label} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                <Icon name="up" />
              </button>
              <button type="button" className="eq-rank__move" aria-label={`Move ${item.label} down`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>
                <Icon name="down" />
              </button>
            </span>
          </li>
        );
      })}
      {!stored && (
        <li>
          <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 40 }} onClick={() => set({ v: order })}>
            This order is right
          </button>
        </li>
      )}
    </ol>
  );
}

function Short({ q, value, set }: Props) {
  if (q.type !== 'short') return null;
  return <TextBox label={q.title} hideLabel placeholder={q.placeholder} multiline={q.multiline} inputType={q.inputType} value={(value?.v as string) ?? ''} onSave={(s) => set(s ? { v: s, ...(value?.exit ? { exit: value.exit } : {}) } : value?.exit ? { v: null, exit: value.exit } : null)} />;
}

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Uploader({ qid, accept, multiple, help, title, ctx }: { qid: string; accept: string; multiple: boolean; help: string; title: string; ctx: Ctx }) {
  const files = ctx.uploads.filter((u) => u.question_id === qid);
  const [pending, setPending] = useState<{ key: string; name: string; pct: number; error?: string }[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const start = async (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list).slice(0, multiple ? 20 : 1)) {
      const key = `${f.name}-${Date.now()}-${Math.random()}`;
      setPending((p) => [...p, { key, name: f.name, pct: 0 }]);
      try {
        await ctx.upload(qid, f, (pct) => setPending((p) => p.map((x) => (x.key === key ? { ...x, pct } : x))));
        setPending((p) => p.filter((x) => x.key !== key));
      } catch (e) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
      }
    }
  };
  return (
    <div className="eq-stack">
      <label
        className="eq-drop"
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void start(e.dataTransfer.files);
        }}
      >
        <Icon name="upload" style={{ color: 'var(--blue)' }} />
        <span className="eq-drop__title">{files.length ? 'Add more' : multiple ? 'Add files' : 'Add a file'}</span>
        <span className="eq-field__help">{help}</span>
        <input ref={input} type="file" accept={accept} multiple={multiple} aria-label={title} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={(e) => { void start(e.target.files); e.target.value = ''; }} />
      </label>
      {(files.length > 0 || pending.length > 0) && (
        <div className="eq-files">
          {files.map((f) => (
            <div className="eq-file" key={f.id}>
              <span className="eq-file__thumb">
                <Icon name="file" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="eq-file__name">{f.file_name}</div>
                <div className="eq-file__meta">{fmtSize(f.size)}, uploaded</div>
              </div>
              <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 44 }} onClick={() => void ctx.removeUpload(f.id)}>
                Remove
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div className="eq-file" key={p.key}>
              <span className="eq-file__thumb">
                <Icon name="file" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="eq-file__name">{p.name}</div>
                {p.error ? <div className="eq-field__warn">{p.error}</div> : <div className="eq-file__bar"><span style={{ width: `${p.pct}%` }} /></div>}
              </div>
              {p.error ? (
                <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 44 }} onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                  Dismiss
                </button>
              ) : (
                <span className="eq-file__meta">{p.pct}%</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Upload({ q, ctx }: Props) {
  if (q.type !== 'upload') return null;
  return <Uploader qid={q.id} accept={q.accept} multiple={q.multiple} help={q.help} title={q.title} ctx={ctx} />;
}

function Extra({ q, value, set, ctx }: Props) {
  if (q.type !== 'extra') return null;
  const v = (value?.v ?? {}) as { note?: string };
  const [showUpload, setShowUpload] = useState(ctx.uploads.some((u) => u.question_id === q.id));
  return (
    <div className="eq-stack">
      <TextBox label={q.title} hideLabel placeholder={q.placeholder} help="Optional. A screenshot works too." value={v.note ?? ''} onSave={(s) => set(s ? { v: { note: s } } : null)} />
      {showUpload ? (
        <Uploader qid={q.id} accept="image/*,application/pdf" multiple help="Screenshots or images, up to 25 MB each" title="Add a screenshot" ctx={ctx} />
      ) : (
        <button type="button" className="eq-btn eq-btn--quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setShowUpload(true)}>
          <Icon name="upload" size={18} />
          Add a screenshot
        </button>
      )}
    </div>
  );
}

function RepeatFieldInput({ f, row, update }: { f: RepeatField; row: Record<string, any>; update: (patch: Record<string, unknown>) => void }) {
  switch (f.kind) {
    case 'text':
    case 'url':
    case 'textarea':
      return <TextBox label={f.label} inputType={f.kind === 'url' ? 'url' : 'text'} multiline={f.kind === 'textarea'} placeholder={'placeholder' in f ? f.placeholder : undefined} value={row[f.id] ?? ''} onSave={(s) => update({ [f.id]: s })} />;
    case 'tap':
      return (
        <div className="eq-stack" style={{ gap: 8 }}>
          <span className="eq-field__label">{f.label}</span>
          <div className="eq-chips" style={{ gap: 8 }}>
            {f.options.map((o) => (
              <Chip key={o.id} on={row[f.id] === o.id} onClick={() => update({ [f.id]: o.id })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      );
    case 'multi': {
      const picks: string[] = row[f.id] ?? [];
      return (
        <div className="eq-stack" style={{ gap: 8 }}>
          <span className="eq-field__label">{f.label}</span>
          <div className="eq-chips" style={{ gap: 8 }}>
            {f.options.map((o) => (
              <Chip key={o.id} on={picks.includes(o.id)} onClick={() => update({ [f.id]: picks.includes(o.id) ? picks.filter((x) => x !== o.id) : [...picks, o.id] })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      );
    }
    case 'check':
      return (
        <button type="button" className="eq-chip eq-chip--row" role="checkbox" aria-checked={!!row[f.id]} onClick={() => update({ [f.id]: !row[f.id] })}>
          <span>{f.label}</span>
          <Tick />
        </button>
      );
  }
}

function Repeat({ q, value, set }: Props) {
  if (q.type !== 'repeat') return null;
  const rows = (Array.isArray(value?.v) ? value!.v : []) as Record<string, any>[];
  const save = (next: Record<string, any>[]) => set(next.length ? { v: next } : null);
  return (
    <div className="eq-stack" style={{ gap: 14 }}>
      {rows.map((row, i) => (
        <section key={i} className="eq-access" aria-label={`${q.itemLabel} ${i + 1}`}>
          <div className="eq-access__head">
            <h3 className="eq-access__title" style={{ fontSize: 16 }}>
              {q.itemLabel} {i + 1}
            </h3>
            <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 40 }} onClick={() => save(rows.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
          {q.fields.map((f) => (
            <RepeatFieldInput key={f.id} f={f} row={row} update={(patch) => save(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))} />
          ))}
        </section>
      ))}
      {rows.length < q.max && (
        <button type="button" className="eq-btn eq-btn--secondary" style={{ alignSelf: 'flex-start' }} onClick={() => save([...rows, {}])}>
          <Icon name="plus" size={18} />
          {q.addLabel}
        </button>
      )}
    </div>
  );
}

function Pages({ q, value, set }: Props) {
  if (q.type !== 'pages') return null;
  const v = (value?.v ?? {}) as { starred?: string[]; notes?: Record<string, string> };
  const starred = v.starred ?? [];
  const notes = v.notes ?? {};
  const [open, setOpen] = useState<string | null>(null);
  const groups: { id: 'services' | 'work' | 'core'; label: string }[] = [
    { id: 'services', label: 'Services' },
    { id: 'work', label: 'Your work' },
    { id: 'core', label: 'The essentials' },
  ];
  const toggleStar = (id: string) => set({ v: { ...v, starred: starred.includes(id) ? starred.filter((x) => x !== id) : [...starred, id] } });
  return (
    <div className="eq-stack" style={{ gap: 20 }}>
      {groups.map((g) => {
        const pages = q.pages.filter((p) => p.group === g.id);
        if (!pages.length) return null;
        return (
          <div key={g.id} className="eq-stack" style={{ gap: 8 }}>
            <span className="eq-why__label">{g.label}</span>
            {pages.map((p) => {
              const on = starred.includes(p.id);
              const showNote = open === p.id || !!notes[p.id];
              return (
                <div key={p.id} style={{ display: 'grid', gap: 8, padding: '4px 4px 4px 16px', border: on ? '2px solid var(--blue)' : '1.5px solid var(--line-control)', borderRadius: 16, background: 'var(--paper)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48 }}>
                    <span style={{ display: 'grid' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      {!showNote && (
                        <button type="button" className="eq-btn eq-btn--quiet" style={{ minHeight: 28, padding: 0, justifyContent: 'flex-start', fontSize: 14 }} onClick={() => setOpen(p.id)}>
                          Add a note
                        </button>
                      )}
                    </span>
                    <button type="button" aria-label={`${on ? 'Unstar' : 'Star'} ${p.name}`} aria-pressed={on} onClick={() => toggleStar(p.id)} style={{ flex: 'none', width: 48, height: 48, border: 0, background: 'transparent', borderRadius: 12, color: on ? 'var(--blue)' : 'var(--slate)', cursor: 'pointer' }}>
                      <Icon name="star" size={22} fill={on ? 'var(--blue)' : undefined} />
                    </button>
                  </div>
                  {showNote && (
                    <div style={{ paddingRight: 12, paddingBottom: 10 }}>
                      <TextBox label={`What should the ${p.name} page do or include?`} help="What should this page do or include?" hideLabel value={notes[p.id] ?? ''} onSave={(s) => set({ v: { ...v, starred, notes: { ...notes, [p.id]: s } } })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Access({ q, value, set }: Props) {
  if (q.type !== 'access') return null;
  const v = (value?.v ?? {}) as Record<string, { status?: string; detail?: string }>;
  const update = (id: string, patch: { status?: string; detail?: string }) => set({ v: { ...v, [id]: { ...v[id], ...patch } } });
  return (
    <div className="eq-stack" style={{ gap: 14 }}>
      {q.items.map((item) => {
        const x = v[item.id] ?? {};
        const status = item.statuses.find((s) => s.id === x.status);
        return (
          <section key={item.id} className="eq-access">
            <div className="eq-access__head">
              <h3 className="eq-access__title">{item.title}</h3>
              <span className={`eq-status${x.status === 'done' ? ' eq-status--done' : ''}`}>{status?.label ?? 'Not started'}</span>
            </div>
            <ol className="eq-access__steps">
              {item.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            {item.detail?.kind === 'short' && <TextBox label={item.detail.label} placeholder={item.detail.placeholder} value={x.detail ?? ''} onSave={(s) => update(item.id, { detail: s })} />}
            {item.detail?.kind === 'tap' && (
              <div className="eq-stack" style={{ gap: 8 }}>
                <span className="eq-field__label">{item.detail.label}</span>
                <div className="eq-chips" style={{ gap: 8 }}>
                  {item.detail.options.map((o) => (
                    <Chip key={o.id} on={x.detail === o.id} onClick={() => update(item.id, { detail: o.id, status: x.status ?? 'done' })}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            <div className="eq-chips" style={{ gap: 8 }} role="radiogroup" aria-label={`${item.title} status`}>
              {item.statuses.map((s) => (
                <Chip key={s.id} role="radio" on={x.status === s.id} onClick={() => update(item.id, { status: s.id })}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Agree({ q, value, set }: Props) {
  if (q.type !== 'agree') return null;
  const on = value?.v === true;
  return (
    <div className="eq-stack">
      <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, fontSize: 16, lineHeight: '24px' }}>
        {q.points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <button type="button" className="eq-chip eq-chip--row" role="checkbox" aria-checked={on} onClick={() => set(on ? null : { v: true })}>
        <span>{q.agreeLabel}</span>
        <Tick />
      </button>
    </div>
  );
}

function Timeline({ q }: Props) {
  if (q.type !== 'timeline') return null;
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 12 }}>
      {q.items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 999, background: 'var(--blue-tint)', color: 'var(--blue-ink)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          <span style={{ fontSize: 16, lineHeight: '24px' }}>
            <b>{it.label}</b>
            <br />
            <span style={{ color: 'var(--slate)' }}>{it.when}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const RENDERERS: Record<Question['type'], (p: Props) => React.ReactNode> = {
  confirm: Confirm,
  tap: Tap,
  multi: Multi,
  rate: Rate,
  sliders: Sliders,
  rank: Rank,
  short: Short,
  upload: Upload,
  repeat: Repeat,
  pages: Pages,
  access: Access,
  agree: Agree,
  timeline: Timeline,
  extra: Extra,
};

export function QuestionView({ q, value, set, ctx }: { q: Question; value: AnswerValue | undefined; set: (v: AnswerValue | null) => void; ctx: Ctx }) {
  const R = RENDERERS[q.type];
  const titleIsRedundant = (q.type === 'confirm' || q.type === 'rate' || q.type === 'pages' || q.type === 'access') && false;
  return (
    <section className="eq-q" aria-labelledby={`q-${q.id}`}>
      {!titleIsRedundant && (
        <h2 id={`q-${q.id}`} className="eq-q__title" style={{ fontSize: 20, lineHeight: '27px' }}>
          {q.title}
        </h2>
      )}
      {q.hint && <p className="eq-q__hint">{q.hint}</p>}
      <R q={q} value={value} set={set} ctx={ctx} v={value?.v} />
      {q.exits && <Exits q={q} value={value} set={set} />}
    </section>
  );
}

export { setV };
