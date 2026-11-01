// Monsoon: one endless spout a day (seeded by the date), the rain quickening with height and the drain backing up from below.
// Pure: the run is a function of the seed and the player's own climb.

import { makeRng, hashString } from './rng.js';
import { buildLevel } from './level.js';
import { pieceHeight } from './pieces.js';
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

/**
 * Today's spout: a long stack of the same set pieces the spouts are made of (twig ladders, rain-heads, bolt shafts over
 * moss, vent columns, nooks), harder with height, with flies all the way up and a golden one every 40 m or so.
 */
export function monsoonPieces(seed) {
  const rng = makeRng(`monsoon:${seed}`);
  const pieces = [{ k: 'start' }, { k: 'straight', h: 500, gap: 250, flies: [{ x: -86, y: 200 }, { x: -86, y: 330 }] }];
  let y = 660;
  let x = 0;
  let last = '';
  let nextGold = 25 * M;
  const side = () => (rng.chance(0.5) ? 'L' : 'R');
  const sx = (s) => (s === 'L' ? -1 : 1);
  const fly = (fx, fy) => ({ x: Math.round(fx), y: Math.round(fy) });
  while (y < MONSOON_TOP - 1200) {
    const m = y / M;
    const hard = clamp01(m / 200);
    const gap = Math.round(lerp(320, 220, hard));
    const roll = rng.next();
    let piece;
    let kind;
    if (roll < 0.14 && last !== 'jog') {
      kind = 'jog';
      // Keep the pipe near the middle of the house.
      const dir = x > 120 ? -1 : x < -120 ? 1 : rng.chance(0.5) ? 1 : -1;
      const d = dir * rng.int(80, 130);
      x += d;
      piece = { k: 'jog', d, a: rng.int(100, 150), b: rng.int(110, 150), ring: rng.chance(0.5) };
    } else if (roll < 0.24 && last !== 'bracket') {
      kind = 'bracket';
      const s = side();
      piece = { k: 'bracket', side: s, len: rng.int(74, 86), h: 260, flies: rng.chance(0.5) ? [fly(-sx(s) * 86, 140)] : [] };
    } else if (roll < 0.31 && last !== 'alcove') {
      kind = 'alcove';
      const s = side();
      piece = { k: 'alcove', side: s, h: 240, flies: [fly(sx(s) * 132, 120)] };
    } else if (roll < 0.4 && m > 12 && last !== 'hopper') {
      kind = 'hopper';
      const w = rng.int(210, 250);
      const h = rng.int(380, 460);
      const flare = w - 100;
      const t1 = rng.chance(0.5) ? -1 : 1;
      piece = {
        k: 'hopper',
        w,
        h,
        bars: [
          { x: t1 * (w - 140), y: flare + 120, len: 120, tilt: -t1 * 7, kind: 'twig' },
          { x: -t1 * (w - 140), y: flare + 290, len: 120, tilt: t1 * 7, kind: 'twig' },
        ],
        snags: m > 30 ? [{ x: 0, y: flare + h - 60 }] : [],
        flies: [fly(t1 * (w - 60), flare + 200), fly(-t1 * (w - 60), flare + 370)],
      };
    } else if (roll < 0.52 && m > 4 && last !== 'ladder') {
      kind = 'ladder';
      const n = rng.int(3, 4);
      const leaf = rng.chance(0.4);
      const step = rng.int(150, 175);
      const first = rng.chance(0.5) ? -1 : 1;
      const bars = [];
      const flies = [];
      for (let i = 0; i < n; i++) {
        const bx = (i % 2 ? -first : first) * 32;
        const by = 150 + i * step;
        const tilt = leaf ? (bx < 0 ? 12 : -12) : (bx < 0 ? 5 : -5);
        bars.push({ x: bx, y: by, len: leaf ? 112 : 100, tilt, kind: leaf ? 'leaf' : 'twig' });
        if (rng.chance(0.7)) flies.push(fly(bx, by + 65));
      }
      piece = { k: 'straight', h: 150 + n * step + 60, gap: 0, bars, flies };
    } else if (roll < 0.62 && m > 25 && last !== 'shaft') {
      kind = 'shaft';
      // Moss up both walls, bolts down the middle: swing it, or race the water up the slippery wall.
      const n = rng.int(2, 3);
      const step = rng.int(230, 260);
      const h = 120 + n * step + 120;
      const first = rng.chance(0.5) ? -1 : 1;
      const snags = [];
      const flies = [];
      for (let i = 0; i < n; i++) {
        snags.push({ x: (i % 2 ? -first : first) * 35, y: 200 + i * step });
        flies.push(fly(0, 300 + i * step));
      }
      const mid = Math.round(h / 2);
      piece = {
        k: 'straight',
        h,
        gap: 0,
        moss: [
          { side: 'L', y0: 60, y1: mid - 60 },
          { side: 'R', y0: 60, y1: mid - 60 },
          { side: 'L', y0: mid + 60, y1: h - 60 },
          { side: 'R', y0: mid + 60, y1: h - 60 },
        ],
        snags,
        bars: [{ x: -first * 25, y: mid, len: 90, tilt: 0, kind: 'twig' }],
        flies,
      };
    } else if (roll < 0.7 && m > 10 && last !== 'vent') {
      kind = 'vent';
      const s = side();
      const h = rng.int(6, 8) * 80;
      piece = {
        k: 'straight',
        h,
        gap: 0,
        vent: { side: s, y: 60 },
        bars: [{ x: -sx(s) * 32, y: Math.round(h * 0.55), len: 100, tilt: sx(s) * 5, kind: 'twig' }],
        flies: [fly(sx(s) * 40, 220), fly(sx(s) * 40, 360), fly(sx(s) * 40, Math.min(h - 40, 500))],
      };
    } else {
      kind = 'straight';
      const h = rng.int(4, 8) * 80;
      const longDrop = m > 40 && rng.chance(0.15);
      piece = { k: 'straight', h: longDrop ? rng.int(8, 11) * 80 : h, gap: longDrop ? 0 : gap, flies: [] };
      if (longDrop) {
        piece.rings = [];
        piece.snags = [{ x: rng.int(-30, 30), y: Math.round(piece.h / 2) }];
      }
      if (m > 20 && rng.chance(0.25)) {
        const a = rng.int(40, Math.max(60, piece.h - 260));
        piece.moss = [{ side: side(), y0: a, y1: a + rng.int(160, 260) }];
      }
      if (m > 80 && rng.chance(0.2)) piece.seam = { side: side(), y: Math.round(piece.h / 2) };
      for (let i = rng.int(1, 2); i > 0; i--) piece.flies.push(fly(rng.chance(0.5) ? rng.int(-88, 88) : 0, rng.int(80, piece.h - 60)));
    }
    // A golden fly now and then, somewhere that costs a little nerve.
    if (y >= nextGold && piece.k !== 'jog') {
      nextGold = y + rng.int(35, 50) * M;
      const h = pieceH(piece);
      const gx = piece.k === 'hopper' ? 0 : rng.chance(0.5) ? -60 : 60;
      (piece.flies ??= []).push({ x: gx, y: Math.round(h * 0.8), gold: true });
    }
    pieces.push(piece);
    last = kind;
    y += pieceH(piece);
  }
  pieces.push({ k: 'straight', h: 400, gap: 200 }, { k: 'top' });
  return pieces;
}

const pieceH = pieceHeight;

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
