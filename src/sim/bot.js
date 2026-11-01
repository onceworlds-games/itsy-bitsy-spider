// The bot brain: the same stick and buttons a player has. When the water is coming it decides like a player watching the
// drop (hold, run for a dry spot, or keep going); in the sun it imagines a handful of moves (walk on, jump this way or that,
// a short or full leap, a silk swing off a snag) on a copy of its spider through the real physics and the real rain, and
// takes the one that climbs fastest without ending up in the water. Skill (0 clumsy .. 1 sharp) decides how many moves it
// imagines, how cleanly it carries one out, how it times its holds and how long it dawdles; a personality tilts the
// choices. Pure and seeded.

import { makeRng } from './rng.js';
import { rainAt, debrisIn, birdAt } from './weather.js';
import { inPocket, featuresIn, sampleAt, lowerBound } from './level.js';
import { WALK, GRIP_MAX, STEP, FLY_R } from './config.js';
import { createSpider, copySpider, step, snagFor } from './spider.js';

export const BOT_NAMES = ['Hopper', 'Mabel', 'Dash', 'Velvet', 'Inch', 'Nettle', 'Pocket', 'Twig', 'Bramble', 'Juniper'];

const PERSONAS = {
  Hopper: { jumpy: 1.2, lead: -0.05, miss: 1.2, shelter: 0.6, walk: 0.85, silk: 1.1 },
  Mabel: { jumpy: 0.95, lead: 0.35, miss: 0.4, shelter: 1, walk: 1.05, silk: 0.9 },
  Dash: { jumpy: 1.1, lead: -0.1, miss: 1.6, shelter: 0.5, walk: 1, silk: 1.2 },
  Velvet: { jumpy: 1, lead: 0.1, miss: 0.8, shelter: 2, walk: 1, silk: 1 },
  Inch: { jumpy: 0.85, lead: 0.15, miss: 0.8, shelter: 1, walk: 1.15, silk: 0.8 },
};
const BALANCED = { jumpy: 1, lead: 0, miss: 1, shelter: 1, walk: 1, silk: 1 };

const lerp = (a, b, k) => a + (b - a) * k;
const PLAN_DT = 1 / 60;
const HORIZON = 1.5;

export function createBrain(name, skill, seed) {
  const persona = PERSONAS[name] ?? BALANCED;
  return {
    name,
    skill: Math.max(0, Math.min(1, skill)),
    persona,
    rng: makeRng(`bot:${name}:${seed}`),
    wave: -1,
    miss: false,
    lead: 0,
    letGo: 0,
    dawdle: 0,
    nextDawdle: 2,
    stuckT: 0,
    bestY: -Infinity,
    goal: null,
    debrisSeen: -1,
    debrisHold: 0,
    plan: null,
    wait: 0,
    lastMode: 'surf',
    ghost: null,
    snagAt: -1,
    out: { x: 0, y: 1, jump: false, jumpHeld: false, hold: false },
  };
}

const rain = {};
const near = [];

/** What the bot presses this step. world is the run's world (water, lift) for imagining moves. */
export function think(brain, sp, level, weather, t, dt, seed = 1, world = null) {
  const o = brain.out;
  o.x = 0;
  o.y = 0;
  o.jump = false;
  o.jumpHeld = false;
  o.hold = false;
  const landed = brain.lastMode !== 'surf' && sp.mode === 'surf';
  brain.lastMode = sp.mode;
  if (sp.mode !== 'surf' && sp.mode !== 'air' && sp.mode !== 'swing') {
    brain.plan = null;
    brain.goal = null;
    return o;
  }
  const k = brain.skill;
  const P = brain.persona;
  rainAt(weather, sp.y, t, rain);
  const safe = inPocket(level, sp.x, sp.y);
  const next = rain.next;

  // A new wave on its way: how early this bot holds, and whether it fumbles this one.
  const upcoming = rain.warn ?? (rain.wet ? rain.wave : null);
  if (upcoming && upcoming.id !== brain.wave) {
    brain.wave = upcoming.id;
    brain.miss = brain.rng.next() < lerp(0.18, 0.015, k) * P.miss;
    // Sharp bots plant in the last quarter-second (a perfect hold); clumsy ones a second early.
    brain.lead = Math.max(0.04, lerp(1.1, 0.08, k) + P.lead * (1 - k) + (brain.rng.next() - 0.5) * lerp(0.5, 0.1, k));
    brain.goal = pickShelter(brain, sp, level, rain);
  }

  // In the air: carry on with the plan (a jump held, a swing let go on time).
  if (sp.mode === 'air' || sp.mode === 'swing') {
    if (brain.plan) runPlan(brain, sp, t, o);
    else o.y = 1;
    return o;
  }

  // Falling debris in my lane: brace.
  if (k > 0.25) {
    debrisIn(level, weather, sp.y - 20, sp.y + 520 * (0.2 + 0.5 * k), t, near);
    for (const d of near) {
      if (d.d.lane !== sp.side) continue;
      const inS = (d.y - sp.y) / 520;
      if (inS > 0 && inS < lerp(0.25, 0.6, k) && brain.debrisSeen !== d.d.id) {
        brain.debrisSeen = d.d.id;
        if (brain.rng.next() < lerp(0.4, 0.95, k)) brain.debrisHold = inS + 0.25;
      }
    }
  }
  if (brain.debrisHold > 0) {
    brain.debrisHold -= dt;
    if (sp.grip > 0.6) {
      o.hold = true;
      brain.plan = null;
      return o;
    }
  }

  // The bird: sharp bots wait for it to pull back, or hold if it's already lunging.
  if (k > 0.45) {
    for (const seam of featuresIn(level, 'seam', sp.y - 90, sp.y + 140)) {
      if (seam.side !== sp.side) continue;
      const b = birdAt(seam, seed, t, {});
      const below = sp.y < seam.y - 45;
      if (b.phase === 'windup' || b.phase === 'peck' || (b.phase === 'look' && b.k > 0.75)) {
        if (below && seam.y - sp.y < 110) {
          brain.plan = null;
          return o;
        }
        if (Math.abs(sp.y - seam.y) <= 45 && sp.grip > 0.5) {
          o.hold = true;
          brain.plan = null;
          return o;
        }
      }
    }
  }

  // Water coming.
  const coming = rain.wet || next < 8;
  if (coming) {
    if (safe && (rain.wet || next < 1.2)) {
      // In a dry spot: wait it out.
      brain.goal = null;
      brain.plan = null;
      return o;
    }
    if (brain.goal && Math.abs(brain.goal.s - sp.s) > 2 && brain.goal.pi === sp.pi) {
      const reach = Math.abs(brain.goal.s - sp.s) / WALK;
      if (reach < next + (rain.wet ? 0 : 0.05)) {
        brain.plan = null;
        steer(o, sp, Math.sign(brain.goal.s - sp.s));
        return o;
      }
      brain.goal = null;
    }
    const wantHold = (rain.wet && !safe) || next < brain.lead;
    if (wantHold && !brain.miss && !sp.moss) {
      o.hold = true;
      brain.plan = null;
      brain.letGo = lerp(0.5, 0.03, k) * (0.6 + brain.rng.next() * 0.8);
      return o;
    }
    // Wary bots stop short of moss when the water is close.
    if (k > 0.5 && next < 2.6 && !sp.moss && mossAhead(sp, level)) {
      brain.plan = null;
      return o;
    }
  }
  if (sp.holding && brain.letGo > 0) {
    brain.letGo -= dt;
    o.hold = true;
    return o;
  }

  // Dawdling (clumsy bots look around now and then).
  brain.nextDawdle -= dt;
  if (brain.dawdle > 0) {
    brain.dawdle -= dt;
    return o;
  }
  if (brain.nextDawdle <= 0) {
    brain.nextDawdle = 1.5 + brain.rng.next() * 3;
    if (brain.rng.next() < (1 - k) * 0.3) brain.dawdle = 0.25 + brain.rng.next() * 0.8 * (1 - k);
  }

  // Stuck somewhere odd: hop out.
  if (sp.y > brain.bestY + 8) {
    brain.bestY = sp.y;
    brain.stuckT = 0;
  } else if (!sp.holding) {
    brain.stuckT += dt;
    if (brain.stuckT > 3.5) {
      brain.stuckT = 0;
      brain.plan = { start: t, x: brain.rng.next() < 0.5 ? -0.7 : 0.7, y: 0.7, jump: true, hold: 0.4, silk: -1, silkHold: 0, walk: 0, flew: false, silked: false };
    }
  }

  // A plan in hand: keep doing it (a walk runs out; a jump has been made).
  if (brain.plan && !landed) {
    runPlan(brain, sp, t, o);
    if (brain.plan) return o;
  }
  if (landed) {
    brain.plan = null;
    brain.wait = lerp(0.3, 0.015, k) * (0.5 + brain.rng.next());
  }
  if (brain.wait > 0) {
    brain.wait -= dt;
    o.y = 1;
    return o;
  }
  if (world) {
    brain.plan = choose(brain, sp, level, world, t, next);
    runPlan(brain, sp, t, o);
  } else o.y = 1;
  return o;
}

/** Plays the current plan's buttons at time t. A plan: walk for a while, or a jump (and maybe a swing off a snag). */
function runPlan(brain, sp, t, o) {
  const p = brain.plan;
  if (!p) return;
  const e = t - p.start;
  if (!p.jump) {
    o.y = 1;
    o.x = p.x;
    if (e >= p.walk) brain.plan = null;
    return;
  }
  o.x = p.x;
  o.y = p.y;
  if (!p.flew) {
    o.jump = true;
    p.flew = true;
  }
  if (e < p.hold) o.jumpHeld = true;
  if (p.silk >= 0 && e >= p.silk) {
    if (!p.silked) {
      p.silked = true;
      o.jump = true;
    }
    if (e < p.silk + p.silkHold) o.jumpHeld = true;
  }
  if (sp.mode === 'surf' && e > 0.1) brain.plan = null;
}

// ---------------------------------------------------------------------------------------------------- imagining moves

const ANGLES = [0, 22, -22, 45, -45, 70, -70];
const scratchIn = { x: 0, y: 0, jump: false, jumpHeld: false, hold: false };

/** Picks the best move from here by trying them on a copy of the spider. */
function choose(brain, sp, level, world, t, next) {
  const k = brain.skill;
  const P = brain.persona;
  const nAngles = k > 0.7 ? 7 : k > 0.4 ? 5 : 3;
  const swings = k > 0.65 ? [0.45, 0.8] : k > 0.3 ? [0.6] : [];
  // Walking on is the baseline.
  const walk = { start: t, jump: false, x: 0, y: 1, walk: 0.35, hold: 0, silk: -1, silkHold: 0, flew: false, silked: false };
  let best = walk;
  let bestScore = imagine(brain, sp, level, world, t, walk) * P.walk;
  if (next < 0.5) return best;
  const err = lerp(14, 1.5, k);
  for (let i = 0; i < nAngles; i++) {
    const holds = k > 0.5 && i < 3 ? [0.45, 0.12] : [0.45];
    for (const hold of holds) {
      const a = ((ANGLES[i] + (brain.rng.next() - 0.5) * 2 * err) * Math.PI) / 180;
      const plan = { start: t, jump: true, x: Math.sin(a), y: Math.cos(a), walk: 0, hold: hold + (brain.rng.next() - 0.5) * lerp(0.08, 0.01, k), silk: -1, silkHold: 0, flew: false, silked: false };
      const s = imagine(brain, sp, level, world, t, plan) * P.jumpy;
      if (s > bestScore) {
        best = plan;
        bestScore = s;
      }
      // A swing off whatever snag comes into reach on the way.
      const snagAt = brain.snagAt;
      if (swings.length && snagAt >= 0) {
        for (const sh of swings) {
          const at = snagAt + (brain.rng.next() - 0.5) * lerp(0.1, 0.015, k);
          const sw = { ...plan, hold: Math.min(plan.hold, Math.max(0.05, at - 0.03)), silk: Math.max(0.06, at), silkHold: sh + (brain.rng.next() - 0.5) * lerp(0.2, 0.03, k) };
          const ss = imagine(brain, sp, level, world, t, sw) * P.jumpy * P.silk;
          if (ss > bestScore) {
            best = sw;
            bestScore = ss;
          }
        }
      }
    }
  }
  // A clumsy bot sometimes just walks on whatever it saw.
  if (brain.rng.next() < lerp(0.25, 0, k)) best = walk;
  best.start = t;
  best.flew = false;
  best.silked = false;
  return best;
}

/**
 * Runs a plan on a copy of the spider through the real physics and rain. Scores height gained per second, ending on a
 * surface; being washed is a disaster. Also notes the first moment a snag comes into reach (brain.snagAt).
 */
function imagine(brain, sp, level, world, t0, plan) {
  if (!brain.ghost) {
    brain.ghost = createSpider(level, 0);
    brain.ghost.events = [];
  }
  const g = copySpider(brain.ghost, sp);
  g.events.length = 0;
  const saved = brain.plan;
  brain.plan = { ...plan, start: t0, flew: false, silked: false };
  brain.snagAt = -1;
  const y0 = sp.y;
  let t = t0;
  let flew = false;
  let flies = 0;
  let end = HORIZON;
  const fl = level.flies;
  for (let e = 0; e < HORIZON; e += PLAN_DT) {
    scratchIn.x = 0;
    scratchIn.y = 0;
    scratchIn.jump = false;
    scratchIn.jumpHeld = false;
    scratchIn.hold = false;
    if (brain.plan) runPlan(brain, g, t, scratchIn);
    else scratchIn.y = 1;
    step(g, level, world, scratchIn, t, PLAN_DT);
    g.events.length = 0;
    t += PLAN_DT;
    if (g.mode === 'washed' || g.mode === 'tumble') {
      brain.plan = saved;
      return -1000;
    }
    if (g.mode === 'air' || g.mode === 'swing') flew = true;
    if (g.mode === 'air' && brain.snagAt < 0 && plan.silk < 0) {
      const i = snagFor(g, level, scratchIn);
      if (i >= 0 && level.snags[i].y > g.y + 20) brain.snagAt = t - t0;
    }
    if (fl.length && g.mode !== 'surf') {
      for (let i = lowerBound(fl, g.y - FLY_R); i < fl.length && fl[i].y <= g.y + FLY_R; i++) if (Math.hypot(fl[i].x - g.x, fl[i].y - g.y) < FLY_R) flies++;
    }
    if (g.mode === 'done') {
      brain.plan = saved;
      return 4000 / Math.max(0.1, e + PLAN_DT);
    }
    if (plan.jump && flew && g.mode === 'surf') {
      end = e + PLAN_DT;
      break;
    }
    if (!plan.jump && e >= plan.walk) {
      end = e + PLAN_DT;
      break;
    }
  }
  brain.plan = saved;
  let score = (g.y - y0) / Math.max(0.3, end);
  if (g.mode !== 'surf') score -= 120;
  // Landing just before the water with no time to plant is risky.
  if (world.weather) {
    rainAt(world.weather, g.y, t, rain);
    if (rain.next < 0.25 && !inPocket(level, g.x, g.y)) score -= 80;
  }
  score += Math.min(3, flies) * 25;
  return score;
}

function steer(o, sp, sense) {
  // Push the stick along the surface in the wanted direction.
  o.x = -sp.ny * sense;
  o.y = sp.nx * sense;
}

/** A dry spot along this surface the bot can reach before the water, if it knows to look. */
function pickShelter(brain, sp, level, r) {
  const k = brain.skill;
  if (k * brain.persona.shelter < 0.4) return null;
  const time = (r.wet ? 0 : r.next) - 0.15;
  if (time <= 0) return null;
  let best = null;
  for (const a of level.pocketAnchors) {
    if (a.pi !== sp.pi) continue;
    const ds = a.s - sp.s;
    if (Math.abs(ds) / WALK > time) continue;
    if (a.y < sp.y - 120 * brain.persona.shelter * k) continue; // don't go far backwards
    if (!best || a.y > best.y) best = a;
  }
  return best;
}

const pt = {};
function mossAhead(sp, level) {
  const sense = sp.up || 1;
  const path = level.paths[sp.pi];
  for (let d = 30; d <= 150; d += 30) {
    const p = sampleAt(path, sp.s + sense * d, pt);
    if (p.moss) return true;
  }
  return false;
}

export const gripFrac = (sp) => sp.grip / GRIP_MAX;
