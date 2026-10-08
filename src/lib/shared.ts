/**
 * Pure values shared by the browser and the server. Keep this file free of config loading:
 * anything imported here ends up in the client bundle, and config.ts loads every client's config.
 */

export const AccessItemIds = ['wordpress', 'host', 'registrar', 'email', 'gbp', 'gsc-ga', 'calendly', 'youtube'] as const;

type PaletteColors = { bg: string; text: string; accent: string; accentText: string; onAccent: string; band: string; bandInk: string };

/** Resolve {primary} in a palette to the client's brand primary. */
export function resolvePalette<P extends PaletteColors>(p: P, primary: string): P {
  const r = (v: string) => (v === '{primary}' ? primary : v);
  return { ...p, bg: r(p.bg), text: r(p.text), accent: r(p.accent), accentText: r(p.accentText), onAccent: r(p.onAccent), band: r(p.band), bandInk: r(p.bandInk) };
}
