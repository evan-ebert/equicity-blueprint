// The characters client-facing copy must never contain. Pure, no imports: shared by the build-time lint
// (scripts/copy-rules.mjs) and the runtime check on uploaded round configs (src/lib/rounds.ts).
export const BANNED = [
  { ch: '—', name: 'em dash' },
  { ch: '–', name: 'en dash' },
];

/** The names of every banned character found in a string, in order of first appearance. */
export function findBanned(text) {
  return BANNED.filter((b) => text.includes(b.ch)).map((b) => b.name);
}
