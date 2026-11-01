// Small drawing helpers shared by the renderer, the HUD and the posters.

export const FONT_DISPLAY = '"Alfa Slab One", Georgia, serif';
export const FONT_TEXT = '"Sofia Sans Condensed", "Arial Narrow", sans-serif';

const cache = new Map();

/** '#rrggbb' → [r, g, b]. */
export function rgb(hex) {
  let c = cache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, c);
  }
  return c;
}

/** The colour darkened (k < 1) or lightened (k > 1). */
export function shade(hex, k) {
  const [r, g, b] = rgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mixes two colours. */
export function mix(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  const f = (i) => Math.round(x[i] + (y[i] - x[i]) * k);
  return `rgb(${f(0)},${f(1)},${f(2)})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Text in bone with an ink outline: readable over anything. */
export function outlined(ctx, text, x, y, size, opts = {}) {
  ctx.font = `${opts.weight ?? 800} ${size}px ${opts.font ?? FONT_TEXT}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = opts.baseline ?? 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = opts.line ?? Math.max(3, size * 0.22);
  ctx.strokeStyle = opts.stroke ?? '#0E141B';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.fill ?? '#F3EDE2';
  ctx.fillText(text, x, y);
}

/** The seat's pattern symbol, centred at (0, 0), about r across. Drawn in the current fill style. */
export function markPath(ctx, mark, r) {
  ctx.beginPath();
  switch (mark) {
    case 'ring':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2, true);
      break;
    case 'stripes':
      for (let i = -1; i <= 1; i++) ctx.rect(i * r * 0.7 - r * 0.18, -r, r * 0.36, r * 2);
      break;
    case 'dots':
      for (const [x, y] of [[-0.5, -0.45], [0.5, -0.45], [0, 0.5]]) {
        ctx.moveTo(x * r + r * 0.36, y * r);
        ctx.arc(x * r, y * r, r * 0.36, 0, Math.PI * 2);
      }
      break;
    case 'chevron':
      ctx.moveTo(-r, -r * 0.2);
      ctx.lineTo(0, r * 0.75);
      ctx.lineTo(r, -r * 0.2);
      ctx.lineTo(r, -r * 0.75);
      ctx.lineTo(0, r * 0.2);
      ctx.lineTo(-r, -r * 0.75);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      break;
    default: {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
    }
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);
export const easeOutBack = (k) => {
  const c = 1.7;
  return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
};

/** Seconds as 0:23.4 (or 23.4 under a minute when short). */
export function fmtTime(s, short = false) {
  if (!Number.isFinite(s)) return '–';
  // Tenths cut, not rounded: a best kept to hundredths shows as the clock showed it, and 59.96 never reads 0:60.0.
  const d = Math.floor(s * 10 + 1e-6);
  const m = Math.floor(d / 600);
  const r = ((d - m * 600) / 10).toFixed(1);
  if (short && m === 0) return r;
  return `${m}:${r.padStart(4, '0')}`;
}

export const ORD = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH'}`;
