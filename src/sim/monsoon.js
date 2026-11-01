// Monsoon: one endless spout a day (seeded by the date), the rain quickening with height and the drain backing up from below.
// Pure: the run is a function of the seed and the player's own climb.

import { makeRng, hashString } from './rng.js';
import { buildLevel } from './level.js';
import { makeWorld, GENTLE_FLUSH, DOUBLE_PARTS, SURGE } from './weather.js';
import { WARN, WARN_LONG, M } from './config.js';

export const MONSOON_TOP = 100000; // 1,000 m: the gutter at the very top
export const FLOOD_START = -300;
export const FLOOD_DELAY = 3;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;

/** The UTC day's key, e.g. "2026-11-01". */
export function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's spout: a long stack of pieces, harder with height. */
export function monsoonPieces(seed) {
  const rng = makeRng(`monsoon:${seed}`);
  const pieces = [{ k: 'start' }, { k: 'straight', h: 500, gap: 250 }];
  let y = 660;
  let x = 0;
  let lastKind = '';
  while (y < MONSOON_TOP - 1200) {
    const m = y / M;
    const hard = clamp01(m / 200);
    const gap = Math.round(lerp(320, 220, hard));
    const roll = rng.next();
    let piece;
    if (roll < 0.16 && lastKind !== 'jog') {
      // Keep the pipe near the middle of the house.
      const dir = x > 120 ? -1 : x < -120 ? 1 : rng.chance(0.5) ? 1 : -1;
      const d = dir * rng.int(80, 130);
      x += d;
      piece = { k: 'jog', d, a: rng.int(100, 150), b: rng.int(110, 150), ring: rng.chance(0.5) };
    } else if (roll < 0.28 && lastKind !== 'bracket') {
      piece = { k: 'bracket', side: rng.chance(0.5) ? 'L' : 'R', len: rng.int(74, 86), h: 260 };
    } else if (roll < 0.36 && lastKind !== 'alcove') {
      piece = { k: 'alcove', side: rng.chance(0.5) ? 'L' : 'R', h: 240 };
    } else {
      const h = rng.int(4, 8) * 80;
      const longDrop = m > 40 && rng.chance(0.15);
      piece = { k: 'straight', h: longDrop ? rng.int(8, 11) * 80 : h, gap: longDrop ? 0 : gap };
      if (longDrop) piece.rings = [];
      if (m > 20 && rng.chance(0.25)) {
        const a = rng.int(40, Math.max(60, piece.h - 260));
        piece.moss = [{ side: rng.chance(0.5) ? 'L' : 'R', y0: a, y1: a + rng.int(160, 260) }];
      }
      if (m > 80 && rng.chance(0.2)) piece.seam = { side: rng.chance(0.5) ? 'L' : 'R', y: Math.round(piece.h / 2) };
      if (m > 10 && rng.chance(0.12)) piece.vent = { side: rng.chance(0.5) ? 'L' : 'R', y: 60 };
    }
    pieces.push(piece);
    lastKind = piece.k;
    y += pieceH(piece);
  }
  pieces.push({ k: 'straight', h: 400, gap: 200 }, { k: 'top' });
  return pieces;
}

const pieceH = (p) => (p.k === 'jog' ? p.a + Math.abs(p.d) + p.b : p.h);

/** The rain's settings at a height (metres). */
export function monsoonRain(m) {
  const k = clamp01(m / 200);
  return {
    calm: [lerp(6, 2.2, k), lerp(7, 3, k)],
    flush: [lerp(1.4, 2.3, k), lerp(1.7, 2.5, k)],
    doubles: m > 30 ? 0.15 : 0,
    surges: m > 60 ? 0.2 : 0,
    debris: m > 30 ? [lerp(6, 3.5, clamp01((m - 30) / 120)), lerp(9, 5.5, clamp01((m - 30) / 120))] : null,
  };
}

/** Flood speed (units/s) at a flood height. */
export const floodSpeed = (y) => Math.min(160, 70 + 0.006 * Math.max(0, y));

/** A Monsoon run for a seed (the day's). Waves are made as the player climbs, a little ahead of them. */
export function createMonsoon(seed) {
  const level = buildLevel(monsoonPieces(seed), { name: 'Monsoon' });
  const rng = makeRng(`monsoon-rain:${seed}`);
  const weather = { waves: [], debris: [], seed: typeof seed === 'number' ? seed : hashString(seed) };
  const run = { seed, level, weather, world: makeWorld(level, weather), flood: FLOOD_START, nextAt: 5, debrisAt: 8, lastSurge: false, i: 0 };
  run.advance = (t, dt, playerY) => advanceMonsoon(run, rng, t, dt, playerY);
  return run;
}

function advanceMonsoon(run, rng, t, dt, playerY) {
  const m = Math.max(0, playerY) / M;
  const r = monsoonRain(m);
  // The next wave, planned once the last one has been sent.
  if (t >= run.nextAt - 9) {
    const gentle = run.i < 2;
    let kind = 'single';
    if (!gentle) {
      const roll = rng.next();
      if (!run.lastSurge && roll < r.surges) kind = 'surge';
      else if (roll < r.surges + r.doubles) kind = 'double';
    }
    run.lastSurge = kind === 'surge';
    const warn = gentle || kind === 'surge' ? WARN_LONG : WARN;
    const parts = kind === 'surge' ? [[0, SURGE]] : kind === 'double' ? DOUBLE_PARTS.map((p) => p.slice()) : [[0, gentle ? GENTLE_FLUSH : Math.round(rng.range(r.flush[0], r.flush[1]) * 100) / 100]];
    const end = parts[parts.length - 1][1];
    const t0 = run.nextAt + warn;
    const top = Math.min(MONSOON_TOP, Math.max(0, playerY) + 1700 + 200 * (t0 - t + 1));
    run.weather.waves.push({ id: run.i, t0, warn, kind, parts, end, top });
    run.i++;
    run.nextAt = t0 + end + rng.range(r.calm[0], r.calm[1]);
  }
  if (r.debris && t >= run.debrisAt) {
    const top = Math.max(0, playerY) + 1000;
    run.weather.debris.push({ id: run.weather.debris.length, t0: t, lane: rng.chance(0.5) ? 'L' : 'R', kind: rng.pick(['acorn', 'cap', 'leaf']), top });
    run.debrisAt = t + rng.range(r.debris[0], r.debris[1]);
  } else if (!r.debris) run.debrisAt = Math.max(run.debrisAt, t + 2);
  if (t > FLOOD_DELAY) run.flood += floodSpeed(run.flood) * dt;
  return run;
}

/** The day's seed from a day key. */
export const daySeed = (key) => hashString(`monsoon:${key}`);
