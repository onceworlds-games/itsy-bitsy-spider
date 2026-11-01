// Races: a whole race of bots run to the end (tests, balance, the posters), places and points, the cup's order and the
// bots' skills. Pure.

import { createRun, advance } from './run.js';
import { POINTS, STEP } from './config.js';

export { startXs, levelFor, weatherFor, applyHazards } from './course.js';

/**
 * Runs a whole race of bots to the end. entrants: [{ id, name, skill }]. Returns { times: { id: s }, heights, t, run }.
 */
export function simulateRace(spoutId, seed, entrants, { cap = 240, close = 20, dt = STEP } = {}) {
  const seats = entrants.map((e, i) => ({ id: e.id, name: e.name, bot: true, skill: e.skill, index: i }));
  const run = createRun({ kind: 'race', spout: spoutId, seed, seats });
  while (run.t < cap) {
    advance(run, run.t + Math.max(dt, STEP), null);
    if (run.racers.every((r) => r.finish)) break;
    if (run.firstFinish && close > 0 && run.t > run.firstFinish + close) break;
  }
  const times = {};
  const heights = {};
  for (const r of run.racers) {
    if (r.finish) times[r.id] = r.finish;
    heights[r.id] = r.sp.y;
  }
  return { times, heights, t: run.t, run, race: run };
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
