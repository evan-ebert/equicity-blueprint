// Client-facing copy rules: no em dashes or en dashes anywhere in app source or client configs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src', 'configs'];
const EXT = /\.(astro|tsx?|jsx?|mjs|json|css|md|html)$/;
const BANNED = [
  { ch: '—', name: 'em dash' },
  { ch: '–', name: 'en dash' },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

export function findCopyViolations(cwd = process.cwd()) {
  const problems = [];
  for (const root of ROOTS) {
    let files = [];
    try { files = walk(join(cwd, root)); } catch { continue; }
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const b of BANNED) {
          if (line.includes(b.ch)) problems.push(`${relative(cwd, file)}:${i + 1} has an ${b.name}`);
        }
      });
    }
  }
  return problems;
}
