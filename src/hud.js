// The HUD, drawn on a 2D canvas over the 3D world in the world's own language: zinc tags hanging on silk (the weather
// drop, your place or clock, the flies), a gutter strip along the top edge that fills as the rain comes, the climb line (a
// silk thread from the ground to the sun with a bead for every spider), grip round your spider, the closing ring that
// shows when the water will reach you (gold in the perfect window), the bolt your silk would catch, names, words that
// pop off the spider (Perfect!, Spring!), short hints and the stamped 3-2-1.

import { FONT_DISPLAY, FONT_TEXT, outlined, markPath, roundRect, clamp, easeOutBack } from './paint2d.js';
import { PERFECT } from './sim/config.js';

const ZINC_A = '#A9BBC4';
const ZINC_B = '#6B7F8A';
const INK = '#0E141B';
const BONE = '#F3EDE2';
const GOLD = '#FFB648';
const WATER = '#86D2F0';
const BRICK = '#C8563A';

/** A riveted zinc plate hanging on two silk threads from the top edge. */
export function plate(ctx, x, y, w, h, sway = 0, threadTop = 0) {
  ctx.save();
  ctx.strokeStyle = 'rgba(243,237,226,0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.22, threadTop);
  ctx.lineTo(x + w * 0.22 + sway, y + 4);
  ctx.moveTo(x + w * 0.78, threadTop);
  ctx.lineTo(x + w * 0.78 + sway, y + 4);
  ctx.stroke();
  ctx.translate(x + w / 2 + sway, y);
  ctx.rotate(sway * 0.01);
  ctx.translate(-w / 2, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  roundRect(ctx, 3, 5, w, h, 7);
  ctx.fill();
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, ZINC_A);
  grd.addColorStop(1, ZINC_B);
  ctx.fillStyle = grd;
  ctx.beginPath();
  roundRect(ctx, 0, 0, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = '#3A4852';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(6, 2.5, w - 12, 1.5);
  ctx.fillStyle = '#3A4852';
  for (const [rx, ry] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Stamped text on a plate: ink with a light lower edge. */
function stamp(ctx, text, x, y, size, font = FONT_DISPLAY, color = INK) {
  ctx.font = `${font === FONT_TEXT ? 800 : 400} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(text, x, y + 1.5);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function teardrop(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.55);
  ctx.bezierCurveTo(x + r * 0.5, y - r * 0.8, x + r, y - r * 0.35, x + r, y + r * 0.15);
  ctx.arc(x, y + r * 0.15, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.35, x - r * 0.5, y - r * 0.8, x, y - r * 1.55);
  ctx.closePath();
}

function burst(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.72 : r;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Where the HUD can go: the top right, below the platform's menu if it sits there. */
export function hudLayout(W, H, reserved, touch) {
  let top = 10;
  let right = W - 10;
  let bottom = H - 12;
  for (const r of reserved ?? []) {
    if (r.kind === 'menu' && r.x + r.w > W - 170 && r.y < 90) top = Math.max(top, r.y + r.h + 8);
    if ((r.kind === 'buttons' || r.kind === 'stick') && r.x + r.w > W - 60) bottom = Math.min(bottom, r.y - 10);
    if (r.kind === 'lobby') bottom = Math.min(bottom, r.y - 8);
  }
  if (!reserved && touch) bottom = Math.min(bottom, H - 220);
  return { top, right, bottom, drop: { x: right - 66, y: top + 6, w: 66, h: 66 } };
}

/**
 * Draws the HUD (screen transform set, CSS pixels).
 * h: { W, H, t, layout, weather: { calm, warnK, next, kind, wet, left, dur }, label, sub, closing, line, me, names, hint,
 *      debris, countdown, go, reduced, touch, buttons }
 */
export function drawHud(ctx, h) {
  const { W, t, layout } = h;
  const sway = h.reduced ? 0 : Math.sin(t * 1.3) * 1.5;
  // The gutter strip along the top edge: fills as the rain comes, full and pouring under the flush.
  const w = h.weather;
  if (w) {
    const fill = w.wet ? 1 : clamp(w.warnK, 0, 1);
    if (fill > 0) {
      ctx.fillStyle = 'rgba(14,20,27,0.75)';
      ctx.fillRect(0, 0, W, 9);
      const half = (W / 2) * fill;
      ctx.fillStyle = w.kind === 'surge' ? BRICK : WATER;
      ctx.fillRect(0, 0, half, 7);
      ctx.fillRect(W - half, 0, half, 7);
      ctx.fillStyle = 'rgba(238,249,255,0.9)';
      ctx.fillRect(half - 3, 0, 3, 7);
      ctx.fillRect(W - half, 0, 3, 7);
      if (w.wet || (w.next < 0.7 && Math.floor(t * 8) % 2 === 0)) {
        ctx.fillStyle = 'rgba(238,249,255,0.5)';
        ctx.fillRect(0, 7, W, 2);
      }
    }
  }
  // The weather drop (only in play).
  const d = layout.drop;
  const cx = d.x + d.w / 2 + sway;
  const cy = d.y + d.h / 2 + 2;
  if (w) plate(ctx, d.x, d.y, d.w, d.h, sway, 0);
  if (!w) {
    /* the title and the lobby: no weather */
  } else if (w.wet || w.warnK > 0) {
    if (w.wet) {
      // Draining as the water passes over you.
      const k = clamp(w.left / Math.max(0.5, w.dur), 0, 1);
      ctx.save();
      teardrop(ctx, cx, cy + 4, 17);
      ctx.fillStyle = '#2C4A5C';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = WATER;
      ctx.fillRect(cx - 20, cy + 22 - 46 * k, 40, 46 * k);
      ctx.restore();
      teardrop(ctx, cx, cy + 4, 17);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      const k = 0.55 + 0.45 * clamp(w.warnK, 0, 1);
      const pulse = w.next < 1 && !h.reduced ? 1 + 0.08 * Math.sin(t * 25) : 1;
      if (w.kind === 'surge') burst(ctx, cx, cy + 2, 25 * k * pulse);
      else teardrop(ctx, cx, cy + 4, 17 * k * pulse);
      ctx.fillStyle = w.kind === 'surge' ? BRICK : WATER;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      outlined(ctx, String(Math.max(1, Math.ceil(w.next))), cx, cy + 7, 22, { font: FONT_DISPLAY, weight: 400, line: 4 });
    }
  } else {
    // Sun.
    const calm = clamp(w.calm, 0, 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(h.reduced ? 0 : t * 0.4);
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-4, 15);
      ctx.lineTo(0, 24);
      ctx.lineTo(4, 15);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = calm > 0.5 ? GOLD : '#E0A04A';
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // Your place, the clock or the metres, on the tag beside it.
  if (h.label) {
    ctx.font = `400 30px ${FONT_DISPLAY}`;
    const tw = Math.max(70, ctx.measureText(h.label).width + 30);
    const x = d.x - tw - 8;
    plate(ctx, x, d.y + 4, tw, 56, sway * 0.8, 0);
    stamp(ctx, h.label, x + tw / 2 + sway * 0.8, d.y + 33, 30);
    if (h.sub) {
      ctx.font = `800 17px ${FONT_TEXT}`;
      const sw = Math.max(64, ctx.measureText(h.sub).width + 24);
      plate(ctx, x + tw - sw, d.y + 68, sw, 30, sway * 0.6, d.y + 60);
      stamp(ctx, h.sub, x + tw - sw / 2 + sway * 0.6, d.y + 84, 17, FONT_TEXT, h.subColor ?? INK);
    }
  }
  if (h.line) drawClimbLine(ctx, h);
  if (h.debris) {
    for (const x of h.debris) {
      ctx.fillStyle = BRICK;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, 14);
      ctx.lineTo(x + 10, 14);
      ctx.lineTo(x, 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // Names over the others (stepped up where they would overlap), a chevron over you, grip round you.
  if (h.names) packNames(ctx, h.names, h.me);
  if (h.me) {
    const m = h.me;
    const bob = h.reduced ? 0 : Math.sin(t * 4) * 2;
    ctx.fillStyle = BONE;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(m.sx - 9, m.sy - 44 + bob);
    ctx.lineTo(m.sx + 9, m.sy - 44 + bob);
    ctx.lineTo(m.sx, m.sy - 33 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (m.combo) {
      // the combo: a gold disc beside the chevron, its rim draining as the time to keep it going runs out
      const x = m.sx + 30;
      const y = m.sy - 40 + bob;
      const r = m.combo >= 10 ? 17 : 15;
      ctx.fillStyle = m.combo >= 10 ? GOLD : BONE;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = m.comboK > 0.3 ? 'rgba(14,20,27,0.75)' : BRICK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(m.comboK, 0, 1));
      ctx.stroke();
      stamp(ctx, `×${m.combo}`, x, y + 1, m.combo >= 10 ? 13 : 12);
    }
    if (m.grip < 0.999) {
      const k = clamp(m.grip, 0, 1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(14,20,27,0.6)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, 30, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = k > 0.35 ? GOLD : BRICK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
    }
  }
  if (h.ring) drawApproach(ctx, h);
  if (h.target) drawTarget(ctx, h);
  if (h.flies) drawFlies(ctx, h);
  if (h.pops?.length) drawPops(ctx, h);
  if (h.hint) drawHint(ctx, h);
  if (h.countdown) drawCount(ctx, h);
}

/**
 * The water closing in on you: a ring that shrinks onto your spider as the flush front comes down, reaching it as the
 * water does. It turns gold in the perfect window (Hold now: no grip lost, and a spring after).
 */
function drawApproach(ctx, h) {
  const r = h.ring;
  const k = clamp(r.next / 1.4, 0, 1);
  const rad = 26 + k * 70;
  const perfect = r.next <= PERFECT;
  const a = clamp((1.4 - r.next) / 0.3, 0, 1) * (r.holding ? 0.35 : 1);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineWidth = perfect ? 6 : 3.5;
  ctx.strokeStyle = 'rgba(14,20,27,0.55)';
  ctx.beginPath();
  ctx.arc(r.sx, r.sy, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = perfect ? 4 : 2;
  ctx.strokeStyle = perfect ? GOLD : r.kind === 'surge' ? BRICK : WATER;
  ctx.setLineDash(perfect ? [] : [10, 6]);
  ctx.lineDashOffset = -h.t * 40;
  ctx.beginPath();
  ctx.arc(r.sx, r.sy, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // the target: where the ring will meet (the perfect band)
  ctx.globalAlpha = a * 0.5;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(r.sx, r.sy, 26 + (PERFECT / 1.4) * 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** The bolt your silk would catch from here: a turning reticle on it. */
function drawTarget(ctx, h) {
  const tg = h.target;
  ctx.save();
  ctx.translate(tg.sx, tg.sy);
  ctx.rotate(h.reduced ? 0 : h.t * 3);
  const r = 13 + (h.reduced ? 0 : Math.sin(h.t * 10) * 1.5);
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = INK;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r, i * (Math.PI / 2) + 0.2, i * (Math.PI / 2) + Math.PI / 2 - 0.2);
    ctx.stroke();
  }
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = tg.live ? BONE : 'rgba(243,237,226,0.5)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r, i * (Math.PI / 2) + 0.2, i * (Math.PI / 2) + Math.PI / 2 - 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Flies caught on this spout (and the golden one) on a small tag under the clock. */
function drawFlies(ctx, h) {
  const f = h.flies;
  const d = h.layout.drop;
  const x = d.x - 8 - 92;
  const y = d.y + (h.sub ? 104 : 68);
  plate(ctx, x, y, 92, 30, 0, y - 8);
  // a fly
  ctx.save();
  ctx.translate(x + 18, y + 15);
  ctx.fillStyle = 'rgba(243,237,226,0.85)';
  ctx.beginPath();
  ctx.ellipse(-4, -5, 5, 3, -0.5, 0, Math.PI * 2);
  ctx.ellipse(4, -5, 5, 3, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.font = `800 17px ${FONT_TEXT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(`${f.have}/${f.total}`, x + 30, y + 16);
  if (f.gold != null) {
    ctx.fillStyle = f.gold ? GOLD : 'rgba(14,20,27,0.25)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 78, y + 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** Words that pop off a spider and float up: Perfect!, Spring!, +fly. */
function drawPops(ctx, h) {
  for (const p of h.pops) {
    const k = clamp(p.age / p.life, 0, 1);
    const inK = clamp(p.age / 0.18, 0, 1);
    const a = k > 0.7 ? (1 - k) / 0.3 : 1;
    const s = h.reduced ? 1 : (0.6 + 0.4 * easeOutBack(inK)) * (p.big ? 1.25 : 1);
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.translate(p.sx, p.sy - 30 - k * 46);
    ctx.rotate(p.rot ?? 0);
    ctx.scale(s, s);
    outlined(ctx, p.text, 0, 0, p.size ?? 24, { font: FONT_DISPLAY, weight: 400, line: 6, fill: p.color ?? BONE });
    ctx.restore();
  }
}

function drawClimbLine(ctx, h) {
  const { layout, line } = h;
  const x = layout.right - 12;
  const y0 = layout.drop.y + layout.drop.h + (h.sub ? 46 : 20);
  const y1 = layout.bottom - 8;
  if (y1 - y0 < 80) return;
  const ys = (v) => y1 - (y1 - y0) * clamp(v / line.top, 0, 1);
  ctx.strokeStyle = 'rgba(243,237,226,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  if (line.flood != null) {
    const fy = ys(Math.max(0, line.flood));
    ctx.fillStyle = 'rgba(134,210,240,0.8)';
    ctx.fillRect(x - 4, fy, 8, y1 - fy);
  }
  // The sun at the top (orange once it's setting).
  ctx.fillStyle = line.setting ? '#FF7A3C' : GOLD;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y0 - 2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5C4A35';
  ctx.fillRect(x - 8, y1, 16, 3);
  let mine = null;
  for (const b of line.beads) {
    if (b.me) {
      mine = b;
      continue;
    }
    bead(ctx, x, ys(b.y), b, 6);
  }
  if (mine) bead(ctx, x, ys(mine.y), mine, 9);
}

function bead(ctx, x, y, b, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = b.alpha ?? 1;
  ctx.fillStyle = b.ghost ? 'rgba(243,237,226,0.55)' : b.look.color;
  ctx.strokeStyle = b.me ? BONE : INK;
  ctx.lineWidth = b.me ? 3 : 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!b.ghost) {
    ctx.fillStyle = INK;
    markPath(ctx, b.look.mark, r * 0.55);
    ctx.fill('evenodd');
  }
  ctx.restore();
}

function drawHint(ctx, h) {
  const hint = h.hint;
  const k = clamp(hint.age / 0.25, 0, 1);
  const out = clamp((hint.life - hint.age) / 0.3, 0, 1);
  const a = Math.min(k, out);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const size = 26;
  const pop = h.reduced ? 1 : 0.85 + 0.15 * easeOutBack(k);
  ctx.translate(hint.x, hint.y);
  ctx.scale(pop, pop);
  outlined(ctx, hint.text, 0, 0, size, { font: FONT_DISPLAY, weight: 400, line: 6 });
  ctx.restore();
  if (hint.target) {
    // An arrow to the button it names.
    const { x, y } = hint.target;
    const dx = x - hint.x;
    const dy = y - hint.y;
    const len = Math.hypot(dx, dy);
    if (len > 60) {
      const ux = dx / len;
      const uy = dy / len;
      const bob = h.reduced ? 0 : Math.sin(h.t * 8) * 5;
      const sx = hint.x + ux * 34;
      const sy = hint.y + uy * 22;
      const ex = x - ux * (40 - bob);
      const ey = y - uy * (40 - bob);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ex + ux * 14, ey + uy * 14);
      ctx.lineTo(ex - uy * 10, ey + ux * 10);
      ctx.lineTo(ex + uy * 10, ey - ux * 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawCount(ctx, h) {
  const c = h.countdown;
  const k = clamp(c.k, 0, 1);
  const scale = h.reduced ? 1 : 1.5 - 0.5 * easeOutBack(Math.min(1, k * 3));
  const a = k > 0.75 ? (1 - k) * 4 : 1;
  ctx.save();
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.translate(h.W / 2, h.H * 0.4);
  ctx.scale(scale, scale);
  const big = Math.min(150, h.W * 0.32);
  outlined(ctx, c.text, 0, 0, big, { font: FONT_DISPLAY, weight: 400, line: big * 0.12, fill: c.text === 'GO' ? GOLD : BONE });
  if (c.text !== 'GO' && !h.reduced) {
    // Three drips running off the numeral.
    ctx.fillStyle = WATER;
    for (let i = -1; i <= 1; i++) {
      const dy = big * 0.42 + k * big * 0.5 * (1 + 0.3 * i * i);
      ctx.beginPath();
      ctx.arc(i * big * 0.18, dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * Names over the spiders: each at its spider unless it would cover a name already placed (or your chevron); then it
 * steps up a row, with a silk thread down to its spider. A gold check follows a player who is ready.
 */
function packNames(ctx, names, me) {
  ctx.font = `800 16px ${FONT_TEXT}`;
  const sorted = [...names].sort((a, b) => b.sy - a.sy || a.sx - b.sx);
  const boxes = me ? [{ x0: me.sx - 11, x1: me.sx + 11, y: me.sy - 38 }] : [];
  const placed = sorted.map((n) => {
    const tw = ctx.measureText(n.name).width;
    const wd = tw + (n.ready ? 17 : 0);
    const x0 = n.sx - wd / 2;
    const x1 = n.sx + wd / 2;
    let y = n.sy - 32;
    for (let k = 0; k < 8 && boxes.some((b) => x0 < b.x1 + 6 && x1 > b.x0 - 6 && Math.abs(y - b.y) < 19); k++) y -= 21;
    boxes.push({ x0, x1, y });
    return { n, tw, x0, y, lifted: y < n.sy - 33 };
  });
  ctx.strokeStyle = 'rgba(243,237,226,0.45)';
  ctx.lineWidth = 1;
  for (const p of placed) {
    if (!p.lifted) continue;
    ctx.beginPath();
    ctx.moveTo(p.n.sx, p.y + 9);
    ctx.lineTo(p.n.sx, p.n.sy - 20);
    ctx.stroke();
  }
  for (const p of placed) {
    outlined(ctx, p.n.name, p.x0 + p.tw / 2, p.y, 16, { fill: p.n.color ?? BONE });
    if (p.n.ready) {
      const cx = p.x0 + p.tw + 10;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 5, p.y);
      ctx.lineTo(cx - 1, p.y + 4);
      ctx.lineTo(cx + 6, p.y - 5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
  }
}
