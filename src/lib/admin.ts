/** Formatting helpers for the admin pages. Times in D1 are UTC "YYYY-MM-DD HH:MM:SS". */

export function parseDbTime(s: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
}

export function ago(s: string): string {
  const mins = Math.round((Date.now() - parseDbTime(s).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function pacific(s: string | null | undefined): string {
  if (!s) return '';
  return parseDbTime(s).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PT';
}

export function statusLabel(status: string): string {
  return { 'not-started': 'Not started', 'in-progress': 'In progress', submitted: 'Sent', archived: 'Archived' }[status] ?? status;
}

export function fileSize(n: number): string {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
