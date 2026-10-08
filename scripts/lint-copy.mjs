import { findCopyViolations } from './copy-rules.mjs';
const problems = findCopyViolations();
if (problems.length) {
  console.error('Copy check failed:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('Copy check passed: no em or en dashes.');
