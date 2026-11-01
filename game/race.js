// A race on one spout: racers (bots and the local player) stepped together, hazards applied, places and points. Pure: the host
// runs its bots with it, the title runs its attract race with it, and the tests run whole cups with it.

import { buildLevel } from './level.js';
import { makeWeather, makeWorld, debrisIn, pecked } from './weather.js';
import { featuresIn } from './level.js';
import { createSpider, step, startS, knock, bumpVelocity } from './spider.js';
import { createBrain, think } from './bot.js';
import { spoutById } from './spouts.js';
import { POINTS, DEBRIS_HIT, STEP } from './config.js';

/** The start positions across the drain's floor for n racers. */
export function startXs(n) {
  const out = [];
  const span = 120;
  for (let i = 0; i < n; i++) out.push(n === 1 ? -40 : -span / 2 + (span * i) / (n - 1));
  return out;
}

const levels = new Map();
/** Levels are pure functions of the spout: build each once. */
export function levelFor(id) {
  let L = levels.get(id);
  if (!L) {
    const def = spoutById(id);
    L = buildLevel(def.pieces, { name: def.name });
    levels.set(id, L);
  }
  return L;
}

export function weatherFor(id, seed, level = levelFor(id)) {
  const def = spoutById(id);
  return makeWeather({ top: level.H, rain: def.rain, debris: def.debris ?? null, seed, firstCalm: 5, maxT: 420 });
}

/**
 * A race. entrants: [{ id, name, skill, bot }]. Bots get brains; others are stepped by whoever owns them.
 */
export function createRace(spoutId, seed, entrants) {
  const level = levelFor(spoutId);
  const weather = weatherFor(spoutId, seed, level);
  const world = makeWorld(level, weather);
  const xs = startXs(entrants.length);
  const racers = entrants.map((e, i) => {
    const sp = createSpider(level, startS(level, xs[i]));
    return { ...e, sp, brain: e.bot ? createBrain(e.name, e.skill, `${seed}:${e.id}`) : null, finish: 0, seat: i, knockedBy: null };
  });
  return { spoutId, seed, level, weather, world, racers, t: 0, firstFinish: 0, hazards: new Map() };
}

const hits = [];

/** Debris and the bird against one spider. Returns the kind of knock that took, or ''. */
export function applyHazards(sp, level, weather, t, seed, memo) {
  if (sp.mode !== 'surf' && sp.mode !== 'air') return '';
  debrisIn(level, weather, sp.y - 30, sp.y + 30, t, hits);
  for (const h of hits) {
    if (Math.abs(h.x - sp.x) < DEBRIS_HIT && Math.abs(h.y - sp.y) < DEBRIS_HIT + 4) {
      if (memo.debris === h.d.id) continue;
      memo.debris = h.d.id;
      const away = h.d.lane === 'L' ? 1 : -1;
      if (knock(sp, away * 200, -260, 'debris')) return 'debris';
      return '';
    }
  }
  for (const seam of featuresIn(level, 'seam', sp.y - 50, sp.y + 50)) {
    if (memo.bird > t) continue;
    if (pecked(level, seam, seed, t, sp.x, sp.y)) {
      memo.bird = t + 0.6;
      const away = seam.side === 'L' ? 1 : -1;
      if (knock(sp, away * 380, -150, 'bird')) return 'bird';
    }
  }
  return '';
}

/** Steps every bot racer (and their hazards and bumps) by dt. Others' spiders are stepped by their owners. */
export function stepBots(race, dt, onBump) {
  const { level, weather, world } = race;
  const t = race.t;
  for (const r of race.racers) {
    if (!r.bot) continue;
    const input = think(r.brain, r.sp, level, weather, t, dt, race.seed);
    const wasAir = r.sp.mode === 'air';
    step(r.sp, level, world, input, t, dt);
    let memo = race.hazards.get(r.id);
    if (!memo) race.hazards.set(r.id, (memo = { debris: -1, bird: 0 }));
    applyHazards(r.sp, level, weather, t, race.seed, memo);
    if (wasAir || r.sp.mode === 'air') bumpCheck(race, r, onBump);
    if (r.sp.mode === 'done' && !r.finish) {
      r.finish = t;
      if (!race.firstFinish) race.firstFinish = t;
    }
  }
}

/** A jumping racer that touches another racer knocks it (unless it's holding). */
export function bumpCheck(race, r, onBump) {
  if (r.sp.mode !== 'air') return;
  for (const o of race.racers) {
    if (o === r || o.sp.mode === 'done') continue;
    const d = Math.hypot(o.sp.x - r.sp.x, o.sp.y - r.sp.y);
    if (d > 26) continue;
    const key = `${r.id}>${o.id}`;
    const until = race.hazards.get(key) ?? 0;
    if (until > race.t) continue;
    race.hazards.set(key, race.t + 1);
    const [vx, vy] = bumpVelocity(r.sp, o.sp);
    if (o.bot || !onBump) {
      if (knock(o.sp, vx, vy, 'bump')) o.knockedBy = r.id;
    } else onBump(r, o, vx, vy);
  }
}

/** Runs a whole race of bots to the end (tests and balance). Returns { times: { id: s }, heights, t }. */
export function simulateRace(spoutId, seed, entrants, { cap = 240, close = 20, dt = STEP } = {}) {
  const race = createRace(spoutId, seed, entrants);
  while (race.t < cap) {
    stepBots(race, dt);
    race.t += dt;
    if (race.racers.every((r) => r.finish)) break;
    if (race.firstFinish && close > 0 && race.t > race.firstFinish + close) break;
  }
  const times = {};
  const heights = {};
  for (const r of race.racers) {
    if (r.finish) times[r.id] = r.finish;
    heights[r.id] = r.sp.y;
  }
  return { times, heights, t: race.t, race };
}

/**
 * Places: finishers by time, then the rest by height. Ties (within 10 ms, or 1 unit) share a place.
 * Returns [[ids of 1st], [ids of 2nd], ...].
 */
export function rankRace(ids, finishes, heights) {
  const done = ids.filter((id) => Number.isFinite(finishes[id]));
  const rest = ids.filter((id) => !Number.isFinite(finishes[id]));
  done.sort((a, b) => finishes[a] - finishes[b] || (a < b ? -1 : 1));
  rest.sort((a, b) => (heights[b] ?? 0) - (heights[a] ?? 0) || (a < b ? -1 : 1));
  const out = [];
  let prev = null;
  for (const id of done) {
    if (prev !== null && Math.abs(finishes[id] - finishes[prev]) < 0.01) out[out.length - 1].push(id);
    else out.push([id]);
    prev = id;
  }
  prev = null;
  for (const id of rest) {
    if (prev !== null && Math.abs((heights[id] ?? 0) - (heights[prev] ?? 0)) < 1) out[out.length - 1].push(id);
    else out.push([id]);
    prev = id;
  }
  return out;
}

/** Points for a ranking: a tie shares the better place's points. */
export function pointsFor(ranking) {
  const pts = {};
  let place = 0;
  for (const group of ranking) {
    for (const id of group) pts[id] = POINTS[place] ?? 0;
    place += group.length;
  }
  return pts;
}

/** The cup's final order: total points, then the better place in the last race. */
export function cupOrder(scores, lastRanking) {
  const lastPlace = {};
  lastRanking.forEach((g, i) => g.forEach((id) => (lastPlace[id] = i)));
  return Object.keys(scores).sort((a, b) => scores[b] - scores[a] || (lastPlace[a] ?? 99) - (lastPlace[b] ?? 99) || (a < b ? -1 : 1));
}

/** Bot skills for a cup: spread evenly over the cup's range, weakest first. */
export function botSkills(range, n) {
  if (n <= 0) return [];
  if (n === 1) return [(range[0] + range[1]) / 2];
  return Array.from({ length: n }, (_, i) => Math.round((range[0] + ((range[1] - range[0]) * i) / (n - 1)) * 100) / 100);
}
