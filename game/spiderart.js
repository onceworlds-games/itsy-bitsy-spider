// How a spider looks and moves its legs: a chunky jumping spider in profile, eight two-segment legs that plant on the
// surface and step in an alternating gait, splay flat when holding, pop off one by one as grip runs out, tuck in a jump
// and flail when washed. A puppet follows any spider from its plain state (x, y, angle, mode, grip, holding, facing), so
// the player, the bots and spiders from the network all move the same way.

import { R, GRIP_MAX } from './config.js';
import { markPath } from './paint.js';

const L1 = 14;
const L2 = 17;
// Hips and resting feet in the spider's frame (x forward, y away from the surface; the surface is at y = -R).
const HIPS = [
  [7, 2],
  [4, 1.5],
  [0, 1.5],
  [-3, 2],
];
const FEET_NEAR = [27, 12, -7, -24];
const FEET_FAR = [22, 8, -4, -19];
const GROUP = [0, 1, 0, 1, 1, 0, 1, 0]; // alternating tetrapod gait
const LOSE_ORDER = [3, 7, 2, 6, 1, 5, 0, 4];
const INK = '#1A1F27';

export function createPuppet() {
  const legs = [];
  for (let i = 0; i < 8; i++) legs.push({ wx: NaN, wy: NaN, sx: 0, sy: 0, tx: 0, ty: 0, k: -1, lx: 0, ly: -R });
  return {
    legs,
    mode: '',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: 1,
    fy: 0,
    ux: 0,
    uy: 1,
    spin: 0,
    held: false,
    stepped: 0,
    squash: 0,
    squashV: 0,
    blink: 2,
    t: Math.random() * 10,
    lost: 0,
  };
}

/** Moves the puppet to a spider state: { x, y, a (deg), m (mode), g (grip), h (holding), f (facing) }. */
export function updatePuppet(p, st, dt) {
  p.t += dt;
  const first = p.mode === '';
  if (!first && dt > 0) {
    const vx = (st.x - p.x) / dt;
    const vy = (st.y - p.y) / dt;
    const k = Math.min(1, dt * 14);
    if (Math.abs(vx) < 3000 && Math.abs(vy) < 3000) {
      p.vx += (vx - p.vx) * k;
      p.vy += (vy - p.vy) * k;
    }
  }
  const prev = p.mode;
  p.x = st.x;
  p.y = st.y;
  const a = (st.a * Math.PI) / 180;
  const onSurface = st.m === 'surf' || st.m === 'dazed' || st.m === 'done';
  if (onSurface) {
    const nx = Math.sin(a);
    const ny = Math.cos(a);
    p.ux = nx;
    p.uy = ny;
    const f = st.f < 0 ? -1 : 1;
    p.fx = -ny * f;
    p.fy = nx * f;
    p.spin = 0;
  } else if (st.m === 'air') {
    let fx = Math.sin(a);
    let fy = Math.cos(a);
    const l = Math.hypot(fx, fy) || 1;
    fx /= l;
    fy /= l;
    // Back up toward the sky; face the way it's flying.
    let ux = -fy;
    let uy = fx;
    if (uy < 0) {
      ux = -ux;
      uy = -uy;
    }
    p.fx = fx;
    p.fy = fy;
    p.ux = ux;
    p.uy = uy;
  } else {
    // Tumbling or washed: a spinning ball of legs.
    p.spin += dt * (st.m === 'washed' ? 11 : 8) * (st.f < 0 ? -1 : 1);
    p.fx = Math.cos(p.spin);
    p.fy = Math.sin(p.spin);
    p.ux = -p.fy;
    p.uy = p.fx;
  }
  // Squash and stretch: a spring kicked by jumps and landings.
  if (!first && prev !== st.m) {
    if (st.m === 'air') p.squashV += 9;
    if (prev === 'air' && onSurface) p.squashV -= 11;
    if (st.m === 'washed') p.squashV += 6;
  }
  if (st.h && !p.held) p.squashV -= 6;
  p.held = !!st.h;
  p.squashV += (-p.squash * 260 - p.squashV * 16) * dt;
  p.squash += p.squashV * dt;
  p.squash = Math.max(-0.45, Math.min(0.45, p.squash));
  p.blink -= dt;
  if (p.blink < -0.12) p.blink = 1.5 + Math.random() * 3;
  // Legs that have let go while holding (one per 3/8 s of grip used).
  p.lost = st.h ? Math.max(0, Math.min(8, Math.floor((GRIP_MAX - st.g) / (GRIP_MAX / 8) + 0.001))) : 0;
  const surfaceChanged = onSurface && (prev !== st.m || first);
  p.mode = st.m;
  let busy0 = false;
  let busy1 = false;
  for (let i = 0; i < 8; i++) {
    if (p.legs[i].k < 0) continue;
    if (GROUP[i]) busy1 = true;
    else busy0 = true;
  }
  for (let i = 0; i < 8; i++) {
    const leg = p.legs[i];
    const near = i < 4;
    const j = i & 3;
    const lostLeg = LOSE_ORDER.indexOf(i) < p.lost;
    const cheer = st.m === 'done' && j === 0; // at the top: the front legs wave at the sun
    if (onSurface && !lostLeg && st.m !== 'dazed' && !cheer) {
      const spread = st.h ? 1.32 : 1;
      const lead = Math.max(-8, Math.min(8, (p.vx * p.fx + p.vy * p.fy) * 0.07));
      const lx = (near ? FEET_NEAR[j] : FEET_FAR[j]) * spread + lead;
      const ly = -R + (st.h ? 1 : 0);
      const tx = p.x + p.fx * lx + p.ux * ly;
      const ty = p.y + p.fy * lx + p.uy * ly;
      if (surfaceChanged || Number.isNaN(leg.wx)) {
        leg.wx = tx;
        leg.wy = ty;
        leg.k = -1;
      } else if (leg.k >= 0) {
        leg.k += dt / 0.085;
        leg.tx = tx;
        leg.ty = ty;
        if (leg.k >= 1) {
          leg.k = -1;
          leg.wx = tx;
          leg.wy = ty;
          p.stepped++;
        }
      } else {
        const d = Math.hypot(tx - leg.wx, ty - leg.wy);
        const busy = GROUP[i] ? busy0 : busy1;
        if (d > (st.h ? 3 : 12) && !busy) {
          if (GROUP[i]) busy1 = true;
          else busy0 = true;
          leg.k = 0;
          leg.sx = leg.wx;
          leg.sy = leg.wy;
          leg.tx = tx;
          leg.ty = ty;
        }
      }
      // To the spider's frame.
      let fx = leg.wx;
      let fy = leg.wy;
      if (leg.k >= 0) {
        const k = leg.k;
        fx = leg.sx + (leg.tx - leg.sx) * k;
        fy = leg.sy + (leg.ty - leg.sy) * k;
        const lift = Math.sin(k * Math.PI) * 7;
        fx += p.ux * lift;
        fy += p.uy * lift;
      }
      const dx = fx - p.x;
      const dy = fy - p.y;
      leg.lx = dx * p.fx + dy * p.fy;
      leg.ly = dx * p.ux + dy * p.uy;
    } else {
      leg.wx = NaN;
      let tx;
      let ty;
      const hip = HIPS[j];
      if (lostLeg) {
        tx = hip[0] + (j < 2 ? 10 : -10);
        ty = 13 + Math.sin(p.t * 20 + i) * 2;
      } else if (cheer) {
        tx = (near ? 15 : 11) + Math.sin(p.t * 9 + i) * 3;
        ty = 25 + Math.cos(p.t * 9 + i) * 3;
      } else if (st.m === 'air') {
        const base = near ? FEET_NEAR[j] : FEET_FAR[j];
        tx = base * 0.8 + (j < 2 ? 4 : -4);
        ty = -6 - (j === 1 || j === 2 ? 4 : 0);
      } else if (st.m === 'dazed') {
        const base = near ? FEET_NEAR[j] : FEET_FAR[j];
        tx = base * 0.9 + Math.sin(p.t * 3 + i) * 2;
        ty = -R + 1 + Math.abs(Math.sin(p.t * 2.5 + i)) * 3;
      } else {
        const base = near ? FEET_NEAR[j] : FEET_FAR[j];
        tx = base * 0.75 + Math.sin(p.t * 26 + i * 1.7) * 9;
        ty = -4 + Math.cos(p.t * 23 + i * 2.3) * 12;
      }
      const k = Math.min(1, dt * 22);
      leg.lx += (tx - leg.lx) * k;
      leg.ly += (ty - leg.ly) * k;
    }
  }
}

function knee(hx, hy, fx, fy) {
  let dx = fx - hx;
  let dy = fy - hy;
  let d = Math.hypot(dx, dy) || 0.001;
  const maxD = L1 + L2 - 0.5;
  if (d > maxD) {
    dx *= maxD / d;
    dy *= maxD / d;
    d = maxD;
  }
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const base = Math.atan2(dy, dx);
  const k1x = hx + Math.cos(base + a) * L1;
  const k1y = hy + Math.sin(base + a) * L1;
  const k2x = hx + Math.cos(base - a) * L1;
  const k2y = hy + Math.sin(base - a) * L1;
  return k1y > k2y ? [k1x, k1y, hx + dx, hy + dy] : [k2x, k2y, hx + dx, hy + dy];
}

/**
 * Draws a spider (world transform set). look: a SEAT_LOOKS entry. opts: { alpha, ghost, holding, scale, dazedT, glow }.
 */
export function drawSpider(ctx, p, look, opts = {}) {
  const ghost = !!opts.ghost;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  // Local x is the way it faces, local y its back: facing the other way mirrors the picture.
  ctx.transform(p.fx, p.fy, p.ux, p.uy, p.x, p.y);
  const sc = opts.scale ?? 1;
  if (sc !== 1) ctx.scale(sc, sc);
  const onSurface = p.mode === 'surf' || p.mode === 'dazed' || p.mode === 'done';
  // A soft shadow on the surface.
  if (onSurface && !ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, -R + 0.5, 20, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const legCol = ghost ? 'rgba(243,237,226,0.75)' : INK;
  // Far legs behind the body.
  for (let i = 4; i < 8; i++) drawLeg(ctx, p, i, legCol, look, ghost, true);
  // Body: squash and stretch around its centre.
  const sq = p.squash;
  ctx.save();
  ctx.translate(0, 3);
  ctx.scale(1 + sq * 0.6, 1 - sq * 0.7);
  ctx.translate(0, -3 + (p.held ? -2 : 0));
  drawBody(ctx, p, look, ghost);
  ctx.restore();
  for (let i = 0; i < 4; i++) drawLeg(ctx, p, i, legCol, look, ghost, false);
  // Silk dots where a holding spider's feet are planted.
  if (p.held && !ghost) {
    ctx.fillStyle = 'rgba(243,237,226,0.85)';
    for (let i = 0; i < 8; i++) {
      if (LOSE_ORDER.indexOf(i) < p.lost) continue;
      const leg = p.legs[i];
      ctx.beginPath();
      ctx.arc(leg.lx, leg.ly, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p.mode === 'dazed' && !ghost) {
    ctx.fillStyle = '#86D2F0';
    for (let i = 0; i < 3; i++) {
      const a = p.t * 5 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(6 + Math.cos(a) * 10, 19 + Math.sin(a) * 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawLeg(ctx, p, i, col, look, ghost, far) {
  const j = i & 3;
  const hip = HIPS[j];
  const hx = hip[0] + (far ? 1 : 0);
  const hy = hip[1] + (far ? 1 : 0);
  const leg = p.legs[i];
  const [kx, ky, fx, fy] = knee(hx, hy, leg.lx, leg.ly);
  ctx.strokeStyle = far && !ghost ? '#0E1218' : col;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = j === 0 ? 3.6 : 2.9;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  if (!ghost) {
    if (!far) {
      ctx.strokeStyle = 'rgba(243,237,226,0.22)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 1);
      ctx.lineTo(kx, ky + 1);
      ctx.stroke();
    }
    ctx.fillStyle = far ? look.dark : look.color;
    ctx.beginPath();
    ctx.arc(kx, ky, far ? 1.6 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBody(ctx, p, look, ghost) {
  // Abdomen with the seat's colour and symbol.
  ctx.save();
  ctx.translate(-9, 5);
  ctx.rotate(-0.12);
  if (ghost) {
    ctx.fillStyle = 'rgba(243,237,226,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11.5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 9.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const grd = ctx.createLinearGradient(0, 9, 0, -9);
    grd.addColorStop(0, look.color);
    grd.addColorStop(1, look.dark);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(-0.5, 0.8, 10.2, 7.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    markPath(ctx, look.mark, 4.6);
    ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-2, 5.4, 5.5, 1.8, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Head and thorax: dark, fuzzy-rimmed.
  ctx.fillStyle = ghost ? 'rgba(243,237,226,0.7)' : INK;
  ctx.beginPath();
  ctx.ellipse(6, 4, 9.5, 8, 0.05, 0, Math.PI * 2);
  ctx.fill();
  if (ghost) return;
  ctx.strokeStyle = 'rgba(243,237,226,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(6, 4, 9.5, 8, 0.05, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  // A band of the seat colour above the eyes.
  ctx.fillStyle = look.color;
  ctx.beginPath();
  ctx.ellipse(8, 10.5, 5, 1.6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Palps.
  ctx.fillStyle = '#F3EDE2';
  ctx.beginPath();
  ctx.ellipse(15, -1.5, 2.2, 1.6, 0.4, 0, Math.PI * 2);
  ctx.fill();
  // The big front eyes, glossy, with catchlights.
  const shut = p.blink < 0;
  ctx.fillStyle = '#05070A';
  ctx.beginPath();
  ctx.arc(11.8, 7.2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  if (shut) ctx.ellipse(13.6, 4.6, 3.9, 0.9, 0, 0, Math.PI * 2);
  else ctx.arc(13.6, 4.6, 3.9, 0, Math.PI * 2);
  ctx.fill();
  if (!shut) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(14.6, 6.1, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,182,72,0.55)';
    ctx.beginPath();
    ctx.arc(12.7, 3.4, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#05070A';
  ctx.beginPath();
  ctx.arc(5.5, 11.2, 1.3, 0, Math.PI * 2);
  ctx.fill();
}
