/**
 * Gallery stages: live mini-renders in the client's own brand. Equicity styling never enters a stage.
 */
import { useState } from 'react';
import '@fontsource/libre-caslon-text/latin-400.css';
import '@fontsource/libre-caslon-text/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/nunito-sans/latin-400.css';
import '@fontsource/nunito-sans/latin-700.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-700.css';
import type { PaletteConfig } from '../lib/config';

export type TypeSpec = { id: string; heading: string; headingWeight: number; body: string; headingTracking?: string };

export const TYPE_SPECS: Record<string, TypeSpec> = {
  'classic-serif': { id: 'classic-serif', heading: '"Libre Caslon Text", Georgia, serif', headingWeight: 700, body: '"Source Sans 3", system-ui, sans-serif' },
  humanist: { id: 'humanist', heading: '"Nunito Sans", system-ui, sans-serif', headingWeight: 700, body: '"Nunito Sans", system-ui, sans-serif', headingTracking: '-0.01em' },
  editorial: { id: 'editorial', heading: '"Playfair Display", Georgia, serif', headingWeight: 600, body: '"Libre Caslon Text", Georgia, serif' },
  geometric: { id: 'geometric', heading: 'Manrope, system-ui, sans-serif', headingWeight: 700, body: 'Manrope, system-ui, sans-serif', headingTracking: '-0.02em' },
};

type Brand = { short: string; line: string; headline: string; cta: string };

const ui = (size: number, weight = 600) => ({ font: `${weight} ${size}px/1.2 system-ui, sans-serif` });
const bar = (color: string, width: string) => <span style={{ height: 5, width, borderRadius: 3, background: color, opacity: 0.16, display: 'block' }} />;

function Nav({ p, brand }: { p: PaletteConfig; brand: Brand }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', color: p.text }}>
      <span style={{ ...ui(10), letterSpacing: '0.14em', textTransform: 'uppercase' }}>{brand.short}</span>
      <span style={{ display: 'flex', gap: 10, ...ui(10, 500), opacity: 0.75 }}>
        <span>About</span>
        <span>Services</span>
        <span>Contact</span>
      </span>
    </div>
  );
}

function Cta({ p, brand, small }: { p: PaletteConfig; brand: Brand; small?: boolean }) {
  return (
    <span style={{ alignSelf: 'flex-start', marginTop: 6, padding: small ? '7px 12px' : '8px 14px', borderRadius: 999, background: p.accent, color: p.onAccent, ...ui(small ? 10 : 11) }}>
      {brand.cta}
    </span>
  );
}

export function PaletteStage({ p, brand, type }: { p: PaletteConfig; brand: Brand; type: TypeSpec }) {
  return (
    <div className="eq-tile__stage" style={{ background: p.bg }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <Nav p={p} brand={brand} />
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: '0 16px 12px' }}>
          <span style={{ ...ui(10), letterSpacing: '0.08em', textTransform: 'uppercase', color: p.accentText }}>{brand.line}</span>
          <span style={{ fontFamily: type.heading, fontWeight: type.headingWeight, letterSpacing: type.headingTracking, fontSize: 25, lineHeight: 1.08, color: p.text }}>{brand.headline}</span>
          {bar(p.text, '78%')}
          {bar(p.text, '58%')}
          <Cta p={p} brand={brand} />
        </div>
        <div style={{ height: 30, background: p.band, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: p.accent }} />
          <span style={{ height: 4, width: 90, borderRadius: 2, background: p.bandInk, opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}

export function TypeStage({ spec, p, brand, business }: { spec: TypeSpec; p: PaletteConfig; brand: Brand; business: string }) {
  return (
    <div className="eq-tile__stage" style={{ background: p.bg }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: '18px 20px', color: p.text }}>
        <span style={{ fontFamily: spec.heading, fontWeight: spec.headingWeight, letterSpacing: spec.headingTracking, fontSize: 30, lineHeight: 1.05 }}>{business}</span>
        <span style={{ fontFamily: spec.body, fontSize: 15, lineHeight: 1.5, opacity: 0.85 }}>
          {brand.line}. A short paragraph shows how longer reading feels in this pairing, line after line.
        </span>
        <span style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <span style={{ fontFamily: spec.heading, fontWeight: spec.headingWeight, fontSize: 40, lineHeight: 1, color: p.accentText }}>Aa</span>
          <span style={{ fontFamily: spec.body, fontSize: 13, opacity: 0.7 }}>{brand.cta}</span>
        </span>
      </div>
    </div>
  );
}

function Photo({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <div style={{ background: '#D9CDB6', color: '#6B5E46', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10, ...ui(10, 500), ...style }}>
      {label}
    </div>
  );
}

export function LayoutStage({ id, p, type, brand, firstName }: { id: string; p: PaletteConfig; type: TypeSpec; brand: Brand; firstName: string }) {
  const h = (size: number, color = p.text) => ({ fontFamily: type.heading, fontWeight: type.headingWeight, letterSpacing: type.headingTracking, fontSize: size, lineHeight: 1.08, color });
  const eyebrow = <span style={{ ...ui(9), letterSpacing: '0.08em', textTransform: 'uppercase', color: p.accentText }}>{brand.line}</span>;
  let body: React.ReactNode;
  switch (id) {
    case 'portrait':
      body = (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: 12, alignItems: 'center', padding: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {eyebrow}
            <span style={h(21)}>{brand.headline}</span>
            {bar(p.text, '90%')}
            <Cta p={p} brand={brand} small />
          </div>
          <Photo label={`${firstName}'s portrait`} style={{ width: 118, height: 168, borderRadius: '60px 60px 14px 14px' }} />
        </div>
      );
      break;
    case 'photo':
      body = (
        <div style={{ position: 'absolute', inset: 0, background: '#9AA5AE' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8, padding: 18, background: 'rgba(20, 24, 32, 0.38)' }}>
            <span style={{ position: 'absolute', top: 12, right: 14, color: '#fff', ...ui(10, 500), opacity: 0.85 }}>Calm, full-width photo</span>
            <span style={h(23, '#FFFFFF')}>{brand.headline}</span>
            <Cta p={p} brand={brand} small />
          </div>
        </div>
      );
      break;
    case 'editorial':
      body = (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: '20px 22px' }}>
          <span style={h(26)}>{brand.headline}.</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Photo label="" style={{ width: 54, height: 40, borderRadius: 8 }} />
            {bar(p.text, '120px')}
          </div>
        </div>
      );
      break;
    case 'video':
      body = (
        <div style={{ position: 'absolute', inset: 0, background: '#3A4250' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 8, padding: 18, background: 'rgba(0,0,0,0.25)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', color: '#fff', ...ui(9) }}>
              <span style={{ width: 0, height: 0, borderLeft: '7px solid #fff', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }} />
              Quiet looping clip
            </span>
            <span style={h(22, '#FFFFFF')}>{brand.headline}</span>
            <Cta p={p} brand={brand} small />
          </div>
        </div>
      );
      break;
    case 'quote':
      body = (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: '18px 22px' }}>
          <span style={{ ...h(44, p.accent), lineHeight: 0.6 }}>"</span>
          <span style={{ ...h(19), fontStyle: 'italic' }}>We were ready to give up. Now we have dinner together on Sundays.</span>
          <span style={{ ...ui(10, 500), color: p.text, opacity: 0.7 }}>A parent of two</span>
          <Cta p={p} brand={brand} small />
        </div>
      );
      break;
    default:
      body = (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10, padding: 22, backgroundImage: `radial-gradient(${p.text}14 1px, transparent 1px)`, backgroundSize: '10px 10px' }}>
          <span style={h(22)}>{brand.headline}</span>
          <span style={{ ...ui(10, 600), color: p.accentText }}>{brand.cta}</span>
        </div>
      );
  }
  return (
    <div className="eq-tile__stage" style={{ background: p.bg }}>
      {body}
    </div>
  );
}

export function ImageryStage({ src, label, credit, creditUrl }: { src: string; label: string; credit: string; creditUrl: string }) {
  return (
    <div className="eq-tile__stage" style={{ background: '#EEE' }}>
      <img src={src} alt={label} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <a href={creditUrl} target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', right: 8, bottom: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#fff', font: '500 11px/16px system-ui, sans-serif', textDecoration: 'none' }}>
        Photo: {credit}
      </a>
    </div>
  );
}

export function ExampleStage({ url, name, src }: { url: string; name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  })();
  // Saved screenshots only. Without one, the tile shows a clean name card and the "Open the site" button.
  const shot = src;
  return (
    <div className="eq-tile__stage" style={{ background: '#F6F7F9' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#5b6168', textAlign: 'center', padding: 16 }}>
        <span style={{ font: '700 18px/24px system-ui, sans-serif', color: '#0b0c0f' }}>{name}</span>
        <span style={{ font: '400 14px/20px system-ui, sans-serif' }}>{host}</span>
        <span style={{ font: '400 13px/18px system-ui, sans-serif' }}>Tap "Open the site" to see it live.</span>
      </div>
      {shot && !failed && <img src={shot} alt={`Preview of ${name}`} loading="lazy" onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />}
    </div>
  );
}
