/** A small, dependency-free confetti burst in Equicity colors. Skipped when the person prefers reduced motion. */
const COLORS = ['#2d7ff9', '#f4527b', '#0b0c0f', '#d9e8fc', '#1d5fd1'];

export function burstConfetti() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: `${w}px`, height: `${h}px`, pointerEvents: 'none', zIndex: '60' });
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: 140 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) + (Math.random() * 40 - 20);
    const speed = 9 + Math.random() * 8;
    return {
      x: fromLeft ? -10 : w + 10,
      y: h * 0.55,
      vx: Math.cos((angle * Math.PI) / 180) * speed,
      vy: Math.sin((angle * Math.PI) / 180) * speed,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.3,
      round: Math.random() < 0.3,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1400) / 600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 2000) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
