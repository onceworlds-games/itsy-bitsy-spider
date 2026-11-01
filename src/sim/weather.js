// The rain: waves of water that leave the gutter at t0 and travel down the pipe (the top is hit first), falling debris and the
// bird's rhythm. Everything is a pure function of the spout, the seed and the round's time, so every page sees the same flush
// at the same moment.

import { makeRng } from './rng.js';
import { FRONT_SPEED, WARN, WARN_LONG, DEBRIS_SPEED, BIRD_CYCLE, BIRD_REACH, VENT_H } from './config.js';
import { inPocket, centerX, wallX, halfAt } from './level.js';

export const DOUBLE_PARTS = [
  [0, 1.2],
  [2.2, 3.4],
];
export const SURGE = 3.4;
export const GENTLE_FLUSH = 1.2;

/**
 * Waves for a race (or a solo spout): { waves, debris }. rain = { calm: [lo, hi], flush: [lo, hi], doubles, surges },
 * debris = { every: [lo, hi] } or null. The first two flushes are gentle (3 s warning, 1.2 s of water).
 */
export function makeWeather({ top, rain, debris = null, seed = 1, firstCalm = 5, maxT = 400 }) {
  const rng = makeRng(`rain:${seed}`);
  const waves = [];
  let t = firstCalm;
  let lastSurge = false;
  for (let i = 0; t < maxT; i++) {
    const gentle = i < 2;
    let kind = 'single';
    if (!gentle) {
      const roll = rng.next();
      if (!lastSurge && roll < (rain.surges ?? 0)) kind = 'surge';
      else if (roll < (rain.surges ?? 0) + (rain.doubles ?? 0)) kind = 'double';
    }
    lastSurge = kind === 'surge';
    const warn = gentle || kind === 'surge' ? WARN_LONG : WARN;
    const t0 = t + warn;
    let parts;
    if (kind === 'surge') parts = [[0, SURGE]];
    else if (kind === 'double') parts = DOUBLE_PARTS.map((p) => p.slice());
    else parts = [[0, gentle ? GENTLE_FLUSH : round2(rng.range(rain.flush[0], rain.flush[1]))]];
    const end = parts[parts.length - 1][1];
    waves.push({ id: i, t0: round2(t0), warn, kind, parts, end, top });
    t = t0 + end + rng.range(rain.calm[0], rain.calm[1]);
  }
  const drops = [];
  if (debris) {
    const drng = makeRng(`debris:${seed}`);
    for (let d = 3 + drng.range(0, 2); d < maxT; d += drng.range(debris.every[0], debris.every[1])) {
      drops.push({ id: drops.length, t0: round2(d), lane: drng.chance(0.5) ? 'L' : 'R', kind: drng.pick(['acorn', 'cap', 'cap', 'leaf']), top });
    }
  }
  return { waves, debris: drops, seed };
}

const round2 = (v) => Math.round(v * 100) / 100;

/** When the water of `wave` reaches height y (seconds), or Infinity above its source. */
export const arrival = (wave, y) => (y > wave.top + 1 ? Infinity : wave.t0 + (wave.top - y) / FRONT_SPEED);

/**
 * The rain at height y and time t: { wet, wave, next (seconds until the next water here, Infinity if none), warn (the
 * wave being warned about, while its warning runs), left (seconds of water left over this spot), kind }.
 */
export function rainAt(weather, y, t, out = {}) {
  out.wet = false;
  out.wave = null;
  out.next = Infinity;
  out.warn = null;
  out.left = 0;
  out.kind = '';
  const waves = weather.waves;
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    const a = arrival(w, y);
    if (a === Infinity) continue;
    if (a - w.warn - 6 > t) break; // later waves are later still
    for (const [p0, p1] of w.parts) {
      const start = a + p0;
      const stop = a + p1;
      if (t >= start && t < stop) {
        out.wet = true;
        out.wave = w;
        out.left = stop - t;
        out.kind = w.kind;
      } else if (start > t && start - t < out.next) {
        out.next = start - t;
        if (t >= a - w.warn) {
          out.warn = w;
          out.kind = w.kind;
        }
      }
    }
    if (out.wet && out.next < Infinity) break;
  }
  return out;
}

/** Debris pieces between heights y0 and y1 at time t: [{ d, x, y }]. */
export function debrisIn(level, weather, y0, y1, t, out = []) {
  out.length = 0;
  for (const d of weather.debris) {
    const y = d.top - DEBRIS_SPEED * (t - d.t0);
    if (t < d.t0) break;
    if (y < y0 - 40 || y > y1 + 40 || y < -50) continue;
    const s = d.lane === 'L' ? 1 : -1;
    out.push({ d, x: wallX(level, d.lane, y) + s * 17, y });
  }
  return out;
}

/** Debris that will come into view within `ahead` seconds (for the top-edge markers): [{ d, inS }]. */
export function debrisComing(weather, viewTop, t, ahead = 1.2, out = []) {
  out.length = 0;
  for (const d of weather.debris) {
    if (d.t0 > t + ahead + 30) break;
    const y = d.top - DEBRIS_SPEED * (t - d.t0);
    if (y <= viewTop) continue;
    const inS = (y - viewTop) / DEBRIS_SPEED;
    if (inS <= ahead && y - DEBRIS_SPEED * ahead <= viewTop) out.push({ d, inS });
  }
  return out;
}

/** The bird at a seam: { phase: 'look' | 'windup' | 'peck' | 'back', k (0..1 through the phase), reach (0..1) }. */
export function birdAt(seam, seed, t, out = {}) {
  const off = ((((seam.y * 7919 + seed * 104729) % 9973) + 9973) % 9973) / 9973;
  const c = (((t / BIRD_CYCLE + off) % 1) + 1) % 1;
  const T = c * BIRD_CYCLE;
  if (T < 1.2) Object.assign(out, { phase: 'look', k: T / 1.2, reach: 0 });
  else if (T < 1.7) Object.assign(out, { phase: 'windup', k: (T - 1.2) / 0.5, reach: -0.15 * ((T - 1.2) / 0.5) });
  else if (T < 1.95) Object.assign(out, { phase: 'peck', k: (T - 1.7) / 0.25, reach: Math.sin(((T - 1.7) / 0.25) * Math.PI) });
  else Object.assign(out, { phase: 'back', k: (T - 1.95) / 1.25, reach: 0 });
  return out;
}

/** Is (x, y) inside the bird's peck right now? */
export function pecked(level, seam, seed, t, x, y) {
  const b = birdAt(seam, seed, t, scratchBird);
  if (b.phase !== 'peck' || b.reach < 0.35) return false;
  if (Math.abs(y - seam.y) > 40) return false;
  const wx = wallX(level, seam.side, y);
  const into = seam.side === 'L' ? x - wx : wx - x;
  return into >= -4 && into <= BIRD_REACH * b.reach + 14;
}
const scratchBird = {};

/** Is (x, y) in a warm-air vent's column? */
export function inLift(level, x, y) {
  for (const f of level.features) {
    if (f.kind !== 'vent') continue;
    if (y < f.y || y > f.y + VENT_H) continue;
    if (Math.abs(x - centerX(level, y)) <= halfAt(level, y)) return true;
  }
  return false;
}

/** The world the spider physics asks about. */
export function makeWorld(level, weather) {
  const r = {};
  return {
    level,
    weather,
    water(x, y, t) {
      rainAt(weather, y, t, r);
      if (r.wet && inPocket(level, x, y)) return null;
      return r.wet ? r.wave : null;
    },
    wetRaw(y, t) {
      return rainAt(weather, y, t, r).wet;
    },
    lift: (x, y) => inLift(level, x, y),
  };
}
