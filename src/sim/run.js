// One climb on screen: a level, its weather and the spiders in it. The local player's spider and any bots this page runs
// are simulated here at the fixed step; spiders from the network only carry a drawing state. Used by the title's attract
// race, the lobby, solo spouts, Monsoon and online races. Pure: no page.

import { STEP, SEAT_LOOKS, FLY_R } from './config.js';
import { createSpider, step, startS, knock, bumpVelocity, angleOf, unpack, eatFly, modeCode } from './spider.js';
import { createBrain, think } from './bot.js';
import { startXs, levelFor, weatherFor, applyHazards } from './course.js';
import { makeWorld } from './weather.js';
import { spoutById } from './spouts.js';
import { createMonsoon } from './monsoon.js';
import { createRecorder, record } from './ghost.js';
import { lowerBound } from './level.js';

/**
 * opts: { kind, spout, seed, seats: [{ id, name, bot, skill, me, index, look }], monsoonSeed, simBots (default true) }
 * Seats are in start order (their index picks the start position).
 */
export function createRun(opts) {
  let level;
  let weather;
  let mon = null;
  let def;
  if (opts.kind === 'monsoon') {
    mon = createMonsoon(opts.monsoonSeed ?? 1);
    level = mon.level;
    weather = mon.weather;
    def = { id: 0, name: 'Monsoon', theme: 'monsoon', lightning: true };
  } else {
    def = spoutById(opts.spout ?? 1);
    level = levelFor(def.id);
    weather = weatherFor(def.id, opts.seed ?? 1, level);
  }
  const world = mon ? mon.world : makeWorld(level, weather);
  const seats = opts.seats ?? [];
  const xs = startXs(Math.max(1, seats.length));
  const run = {
    kind: opts.kind,
    def,
    level,
    weather,
    world,
    mon,
    seed: opts.seed ?? 1,
    t: 0,
    simBots: opts.simBots !== false,
    racers: [],
    byId: new Map(),
    me: null,
    firstFinish: 0,
    pairs: new Map(),
    recorder: null,
    best: 0,
  };
  seats.forEach((seat, i) => {
    const s = startS(level, xs[seat.index ?? i] ?? xs[i]);
    const r = {
      id: seat.id,
      name: seat.name,
      bot: !!seat.bot,
      me: !!seat.me,
      skill: seat.skill ?? 0.5,
      index: seat.index ?? i,
      look: seat.look ?? SEAT_LOOKS[(seat.index ?? i) % SEAT_LOOKS.length],
      sp: seat.me || seat.bot ? createSpider(level, s) : null,
      brain: seat.bot ? createBrain(seat.name, seat.skill ?? 0.5, `${run.seed}:${seat.id}`) : null,
      memo: { debris: -1, bird: 0 },
      ate: new Uint8Array(level.flies.length),
      finish: 0,
      st: { x: 0, y: 0, a: 0, m: 'surf', g: 3, h: false, f: 1, k: -1, nx: 0, ny: 1 },
      away: false,
      left: false,
      startS: s,
    };
    // Until the network says otherwise, everyone stands at their start.
    const p = r.sp ?? createSpider(level, s);
    Object.assign(r.st, { x: p.x, y: p.y, a: angleOf(p), nx: p.nx, ny: p.ny });
    run.racers.push(r);
    run.byId.set(r.id, r);
    if (r.me) run.me = r;
  });
  if (run.me && (opts.kind === 'solo' || opts.kind === 'tutorial')) run.recorder = createRecorder();
  syncAll(run);
  return run;
}

function sync(run, r) {
  // Spiders this page doesn't run (other players, bots on a page that isn't the host) take their state from the network.
  if (!r.sp || !(r.me || (r.bot && run.simBots))) return;
  const sp = r.sp;
  const st = r.st;
  st.x = sp.x;
  st.y = sp.y;
  st.a = angleOf(sp);
  st.m = sp.mode;
  st.g = sp.grip;
  st.h = sp.holding;
  st.f = sp.facing;
  st.k = sp.mode === 'swing' ? sp.snag : -1;
  st.nx = sp.nx;
  st.ny = sp.ny;
}

export function syncAll(run) {
  for (const r of run.racers) sync(run, r);
}

/** Puts a racer's spider back where a packed copy says (a reload, a new host taking over a bot). */
export function restoreRacer(run, r, packed) {
  const sp = unpack(run.level, packed);
  if (r.sp) {
    sp.stats = r.sp.stats;
    sp.events = r.sp.events;
  }
  r.sp = sp;
  sync(run, r);
}

/**
 * Steps the simulation from run.t up to `target` seconds (fixed steps). input: the local player's
 * { x, y, jump, jumpHeld, hold } (jump is consumed by the first step). hooks: { onFinish(r), onBump(from, to, vx, vy),
 * onDrown(r), onHazard(r, kind), onFly(r, fly), onStep(run) }.
 */
export function advance(run, target, input, hooks = {}) {
  let n = 0;
  if (target - run.t > 1.5) run.t = target - 1.5;
  while (run.t + STEP <= target + 1e-9 && n < 240) {
    // where everyone was before this step: the picture interpolates from here to the step's result
    for (const r of run.racers) {
      if (r.sp) {
        r.px = r.sp.x;
        r.py = r.sp.y;
      }
    }
    stepOnce(run, input, hooks);
    if (input) input.jump = false;
    run.t += STEP;
    n++;
    if (hooks.onStep) hooks.onStep(run);
  }
  syncAll(run);
  // how far the picture is between the last step and the next (0..1)
  run.alpha = Math.max(0, Math.min(1, (target - run.t) / STEP));
  return n;
}

/** One fixed step of everything this page simulates. */
export function stepOnce(run, input, hooks = {}) {
  const { level, world, weather } = run;
  const t = run.t;
  if (run.mon) run.mon.advance(t, STEP, run.me?.sp ? Math.max(run.best, run.me.sp.y) : run.best);
  for (const r of run.racers) {
    if (!r.sp) continue;
    if (r.me) {
      if (!input) continue;
    } else if (!r.bot || !run.simBots) continue;
    const sp = r.sp;
    const wasAir = sp.mode === 'air' || sp.mode === 'swing';
    const inp = r.me ? input : think(r.brain, sp, level, weather, t, STEP, run.seed, world);
    step(sp, level, world, inp, t, STEP);
    const hit = applyHazards(sp, level, weather, t, run.seed, r.memo);
    if (hit && hooks.onHazard) hooks.onHazard(r, hit);
    if (wasAir || sp.mode === 'air') bumps(run, r, hooks);
    flies(run, r, hooks);
    if (sp.mode === 'done' && !r.finish) {
      r.finish = t + STEP;
      if (!run.firstFinish) run.firstFinish = r.finish;
      if (hooks.onFinish) hooks.onFinish(r);
    }
    if (r.me) {
      if (sp.y > run.best) run.best = sp.y;
      if (run.recorder) record(run.recorder, STEP, sp.x, sp.y, angleOf(sp), modeCode(sp.mode));
      if (run.mon && sp.mode !== 'drowned' && sp.y < run.mon.flood) {
        sp.mode = 'drowned';
        sp.vx = 0;
        sp.vy = 0;
        sp.holding = false;
        if (hooks.onDrown) hooks.onDrown(r);
      }
    }
  }
}

/** Flies this spider touches: eaten (its own; everyone has their own flies to catch). */
function flies(run, r, hooks) {
  const fl = run.level.flies;
  if (!fl.length) return;
  const sp = r.sp;
  if (sp.mode === 'washed' || sp.mode === 'dazed' || sp.mode === 'done' || sp.mode === 'drowned') return;
  for (let i = lowerBound(fl, sp.y - FLY_R); i < fl.length && fl[i].y <= sp.y + FLY_R; i++) {
    const f = fl[i];
    if (r.ate[f.id]) continue;
    if (Math.hypot(f.x - sp.x, f.y - sp.y) > FLY_R) continue;
    r.ate[f.id] = 1;
    eatFly(sp, f.gold);
    if (hooks.onFly) hooks.onFly(r, f);
  }
}

/** A jumper touching another spider knocks it: our own spiders directly, others through hooks.onBump (the network). */
function bumps(run, r, hooks) {
  if (r.sp.mode !== 'air') return;
  for (const o of run.racers) {
    if (o === r || o.left || o.st.m === 'done' || o.st.m === 'drowned') continue;
    const ox = o.sp ? o.sp.x : o.st.x;
    const oy = o.sp ? o.sp.y : o.st.y;
    if (Math.hypot(ox - r.sp.x, oy - r.sp.y) > 26) continue;
    const key = `${r.id}>${o.id}`;
    if ((run.pairs.get(key) ?? -1) > run.t) continue;
    run.pairs.set(key, run.t + 1);
    const [vx, vy] = bumpVelocity(r.sp, { x: ox, y: oy, nx: o.sp ? o.sp.nx : 0 });
    const ours = o.sp && (o.me || (o.bot && run.simBots));
    if (ours) {
      if (knock(o.sp, vx, vy, 'bump') && hooks.onKnock) hooks.onKnock(o, r);
    } else if (hooks.onBump) hooks.onBump(r, o, vx, vy);
  }
}

/** The racer's height for places (finishers first by time). */
export const heightOf = (r) => (r.sp ? r.sp.y : r.st.y);

/** Live places: finishers by time, then by height. Returns ids in order. */
export function liveOrder(run, finishes) {
  const list = run.racers.slice();
  list.sort((a, b) => {
    const fa = finishes?.[a.id] ?? (a.finish || Infinity);
    const fb = finishes?.[b.id] ?? (b.finish || Infinity);
    if (fa !== fb) return fa - fb;
    return heightOf(b) - heightOf(a);
  });
  return list.map((r) => r.id);
}
