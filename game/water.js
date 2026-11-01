// The flush: a glossy sheet of rainwater rushing down the pipe (streaks scrolling at the front's speed, a white foam front,
// a thinning tail), clipped to the pipe so the dry pockets stay dry. Also the Monsoon flood rising from below.

import { FRONT_SPEED, HALF } from './config.js';
import { centerX } from './level.js';
import { h2 } from './scene.js';

const TILE_W = 90;
const TILE_H = 420;

// [x offset from the pipe's centre, width, colour]
const GLOSS = [
  [-HALF - 14, 52, 'rgba(20,60,90,0.18)'],
  [HALF + 14, 52, 'rgba(20,60,90,0.18)'],
  [-46, 8, 'rgba(238,249,255,0.1)'],
  [41, 10, 'rgba(238,249,255,0.1)'],
  [-26, 16, 'rgba(238,249,255,0.2)'],
];

export function createWater() {
  return { tile: null, pattern: null, scale: 0 };
}

function streakPattern(water, ctx, s) {
  if (water.pattern && water.scale === s) return water.pattern;
  const w = Math.max(8, Math.round(TILE_W * s));
  const h = Math.max(8, Math.round(TILE_H * s));
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d');
  if (!g) return null;
  g.scale(s, s);
  for (let i = 0; i < 26; i++) {
    const x = h2(i, 1) * TILE_W;
    const y = h2(i, 2) * TILE_H;
    const len = 40 + h2(i, 3) * 160;
    const a = 0.1 + h2(i, 4) * 0.3;
    const width = 1 + h2(i, 5) * 2.5;
    for (const dy of [0, -TILE_H]) {
      const grd = g.createLinearGradient(0, y + dy, 0, y + dy + len);
      grd.addColorStop(0, 'rgba(238,249,255,0)');
      grd.addColorStop(0.7, `rgba(238,249,255,${a})`);
      grd.addColorStop(1, 'rgba(238,249,255,0)');
      g.fillStyle = grd;
      g.fillRect(x, y + dy, width, len);
    }
  }
  water.pattern = ctx.createPattern(c, 'repeat');
  water.scale = s;
  return water.pattern;
}

/** Wet bands in view at time t: calls fn(yFront, yTail, wave) for each part of each wave on screen. */
export function forWetBands(weather, y0, y1, t, fn) {
  for (const w of weather.waves) {
    if (w.t0 > t) break;
    for (const [p0, p1] of w.parts) {
      const yF = w.top - (t - w.t0 - p0) * FRONT_SPEED;
      if (yF > w.top) continue;
      const yT = Math.min(w.top, w.top - (t - w.t0 - p1) * FRONT_SPEED);
      if (yT < -40) continue;
      if (yT < y0 || yF > y1) continue;
      fn(yF, yT, w);
    }
  }
}

/** Draws the flushing water (world transform set). */
export function drawWater(ctx, scene, view, weather, t, water) {
  const x0 = scene.cx0 - HALF - 120;
  const width = scene.cx1 - scene.cx0 + 2 * HALF + 240;
  let any = false;
  forWetBands(weather, view.y0 - 80, view.y1 + 80, t, () => (any = true));
  if (!any) return;
  ctx.save();
  ctx.clip(scene.wet, 'evenodd');
  const pattern = streakPattern(water, ctx, view.s);
  const scroll = -((t * FRONT_SPEED) % TILE_H);
  forWetBands(weather, view.y0 - 80, view.y1 + 80, t, (yF, yT) => {
    const lo = Math.max(yF, view.y0 - 40);
    const hi = Math.min(yT, view.y1 + 40);
    const fade = Math.min(70, yT - yF);
    const solidTop = Math.min(hi, yT - fade);
    // The body of the sheet.
    if (solidTop > lo) {
      ctx.fillStyle = 'rgba(96,178,222,0.66)';
      ctx.fillRect(x0, lo, width, solidTop - lo);
    }
    if (hi > solidTop && fade > 0) {
      const grd = ctx.createLinearGradient(0, yT - fade, 0, yT);
      grd.addColorStop(0, 'rgba(96,178,222,0.66)');
      grd.addColorStop(1, 'rgba(96,178,222,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x0, Math.max(lo, yT - fade), width, hi - Math.max(lo, yT - fade));
    }
    // Gloss: bright runs down the curve of the pipe and darker edges, following its bends.
    if (solidTop > lo) {
      const line = new Path2D();
      line.moveTo(centerX(scene.level, lo), lo);
      for (let y = Math.floor(lo / 12) * 12 + 12; y < solidTop; y += 12) line.lineTo(centerX(scene.level, y), y);
      line.lineTo(centerX(scene.level, solidTop), solidTop);
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      for (const [off, w, color] of GLOSS) {
        ctx.save();
        ctx.translate(off, 0);
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.stroke(line);
        ctx.restore();
      }
    }
    // Streaks rushing down.
    if (pattern && solidTop > lo) {
      pattern.setTransform(new DOMMatrix([1 / view.s, 0, 0, 1 / view.s, 0, scroll]));
      ctx.fillStyle = pattern;
      ctx.fillRect(x0, lo, width, solidTop - lo);
    }
    // The foam front.
    if (yF > view.y0 - 60 && yF < view.y1 + 40) {
      const cxF = centerX(scene.level, yF);
      const l = cxF - HALF - 80;
      const r = cxF + HALF + 80;
      ctx.fillStyle = 'rgba(238,249,255,0.92)';
      ctx.beginPath();
      ctx.moveTo(l, yF + 34);
      for (let x = l; x <= r; x += 8) {
        const y = yF + 3 + 6 * Math.sin(x * 0.09 + t * 17) + 4 * Math.sin(x * 0.23 - t * 11) - 8 * Math.cos(((x - cxF) / (HALF + 60)) * 1.4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(r, yF + 34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(238,249,255,0.55)';
      for (let i = 0; i < 14; i++) {
        const bx = l + h2(i, Math.floor(t * 30)) * (r - l);
        const by = yF + 30 + h2(Math.floor(t * 30), i) * 40;
        ctx.beginPath();
        ctx.arc(bx, by, 2 + h2(i, 9) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(l, yF + 34, r - l, 5);
    }
  });
  ctx.restore();
}

/** The Monsoon flood: deep water rising inside the pipe, a frothing surface (world transform set). */
export function drawFlood(ctx, scene, view, flood, t) {
  if (flood < view.y0 - 20) return;
  const x0 = scene.cx0 - HALF - 200;
  const width = scene.cx1 - scene.cx0 + 2 * HALF + 400;
  ctx.save();
  ctx.clip(scene.interior);
  const grd = ctx.createLinearGradient(0, flood, 0, flood - 300);
  grd.addColorStop(0, 'rgba(70,140,180,0.88)');
  grd.addColorStop(1, 'rgba(18,40,58,0.97)');
  ctx.fillStyle = grd;
  ctx.fillRect(x0, view.y0 - 10, width, flood - view.y0 + 10);
  const cx = centerX(scene.level, flood);
  ctx.fillStyle = 'rgba(238,249,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(cx - HALF - 80, flood - 8);
  for (let x = cx - HALF - 80; x <= cx + HALF + 80; x += 6) ctx.lineTo(x, flood + 3 * Math.sin(x * 0.07 + t * 4) + 2 * Math.sin(x * 0.19 - t * 6));
  ctx.lineTo(cx + HALF + 80, flood - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(238,249,255,0.25)';
  for (let i = 0; i < 10; i++) {
    const bx = cx - HALF + h2(i, Math.floor(t * 8)) * 2 * HALF;
    ctx.beginPath();
    ctx.arc(bx, flood - 14 - h2(Math.floor(t * 8), i) * 60, 2 + h2(i, 3) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
