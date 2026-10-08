import { findCopyViolations } from './copy-rules.mjs';

/** Fails `astro build` (which is what Webflow Cloud runs) if client-facing copy has an em or en dash. */
export default function copyLint() {
  return {
    name: 'equicity-copy-lint',
    hooks: {
      'astro:build:start': () => {
        const problems = findCopyViolations();
        if (problems.length) throw new Error('Copy check failed:\n' + problems.join('\n'));
      },
    },
  };
}
