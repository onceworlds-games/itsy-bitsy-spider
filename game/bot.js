// The bot brain: the same stick and buttons a player has, decided from what a player sees (the drop's countdown, the water,
// dry spots, falling caps, the bird), with a skill from 0 (clumsy) to 1 (sharp) and a personality. Pure and seeded.

import { makeRng } from './rng.js';
import { rainAt, debrisIn, birdAt } from './weather.js';
import { inPocket, sampleAt, featuresIn } from './level.js';
import { WALK, GRIP_MAX } from './config.js';

export const BOT_NAMES = ['Hopper', 'Mabel', 'Dash', 'Velvet', 'Inch', 'Nettle', 'Pocket', 'Twig', 'Bramble', 'Juniper'];

const PERSONAS = {
  Hopper: { jumpy: 1.6, lead: -0.1, miss: 1.2, shelter: 0.6 },
  Mabel: { jumpy: 0.3, lead: 0.5, miss: 0.4, shelter: 1 },
  Dash: { jumpy: 0.9, lead: -0.15, miss: 1.6, shelter: 0.5 },
  Velvet: { jumpy: 0.6, lead: 0.1, miss: 0.8, shelter: 2 },
  Inch: { jumpy: 0, lead: 0.15, miss: 0.8, shelter: 1 },
};
const BALANCED = { jumpy: 1, lead: 0, miss: 1, shelter: 1 };

const lerp = (a, b, k) => a + (b - a) * k;

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
    holdT: 0,
    letGo: 0,
    jumpWait: 0.2,
    dawdle: 0,
    nextDawdle: 2,
    stuckT: 0,
    bestY: -Infinity,
    angle: 0,
    goal: null,
    debrisSeen: -1,
    debrisHold: 0,
    waitBird: false,
    out: { x: 0, y: 1, jump: false, hold: false },
  };
}

const rain = {};
const near = [];
const pt = {};

/** What the bot presses this step. */
export function think(brain, sp, level, weather, t, dt, seed = 1) {
  const o = brain.out;
  o.x = 0;
  o.y = 0;
  o.jump = false;
  o.hold = false;
  if (sp.mode !== 'surf' && sp.mode !== 'air') {
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
    brain.miss = brain.rng.next() < lerp(0.2, 0.02, k) * P.miss;
    brain.lead = Math.max(0.03, 0.06 + (1 - k) * (1 - k) + P.lead + (brain.rng.next() - 0.5) * 0.3 * (1 - k));
    brain.goal = pickShelter(brain, sp, level, rain);
  }

  // Up is always the plan.
  o.y = 1;

  if (sp.mode === 'air') {
    o.hold = brain.holdT > 0;
    return o;
  }

  // Falling debris in my lane: brace.
  if (k > 0.25) {
    debrisIn(level, weather, sp.y - 20, sp.y + 520 * (0.2 + 0.5 * k), t, near);
    for (const d of near) {
      const lane = d.d.lane;
      if (lane !== sp.side) continue;
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
      o.y = 0;
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
        if (below && seam.y - sp.y < 110) o.y = 0;
        else if (Math.abs(sp.y - seam.y) <= 45 && sp.grip > 0.5) o.hold = true;
      }
    }
    if (o.hold) return o;
  }

  // Water coming.
  const coming = rain.wet || next < 8;
  if (coming) {
    if (safe && (rain.wet || next < 1.2)) {
      // In a dry spot: wait it out.
      o.y = 0;
      brain.goal = null;
      return o;
    }
    if (brain.goal && Math.abs(brain.goal.s - sp.s) > 2) {
      const reach = Math.abs(brain.goal.s - sp.s) / WALK;
      if (reach < next + (rain.wet ? 0 : 0.05)) {
        steer(o, sp, Math.sign(brain.goal.s - sp.s));
        return o;
      }
      brain.goal = null;
    }
    const wantHold = (rain.wet && !safe) || next < brain.lead;
    if (wantHold && !brain.miss) {
      if (!sp.moss) {
        o.hold = true;
        o.y = 0;
        brain.letGo = lerp(0.6, 0.04, k) * (0.6 + brain.rng.next() * 0.8);
        return o;
      }
      // On moss: sharp bots climb on to get off it.
    }
    // Wary bots stop short of moss when the water is close.
    if (k > 0.5 && next < 2.6 && !sp.moss && mossAhead(sp, level)) {
      o.y = 0;
      return o;
    }
  }
  if (sp.holding && brain.letGo > 0) {
    brain.letGo -= dt;
    o.hold = true;
    o.y = 0;
    return o;
  }

  // Dawdling (clumsy bots look around now and then).
  brain.nextDawdle -= dt;
  if (brain.dawdle > 0) {
    brain.dawdle -= dt;
    o.y = 0;
    return o;
  }
  if (brain.nextDawdle <= 0) {
    brain.nextDawdle = 1.5 + brain.rng.next() * 3;
    if (brain.rng.next() < (1 - k) * 0.35) brain.dawdle = 0.3 + brain.rng.next() * 0.9 * (1 - k);
  }

  // Jumps: across the pipe in the sun.
  brain.jumpWait -= dt;
  const jumpy = P.jumpy * (k > 0.45 ? 1 : k > 0.25 ? 0.35 : 0);
  const margin = lerp(1.4, 0.55, k) / Math.max(0.5, P.jumpy);
  if (jumpy > 0 && Math.abs(sp.nx) > 0.85 && next > margin && brain.jumpWait <= 0 && !rain.wet) {
    if (brain.rng.next() < Math.min(1, jumpy)) {
      const err = ((brain.rng.next() - 0.5) * 2 * lerp(16, 3, k) * Math.PI) / 180;
      o.x = Math.sin(err);
      o.y = Math.cos(err);
      o.jump = true;
    }
    brain.jumpWait = lerp(0.45, 0.06, k) + brain.rng.next() * 0.2;
  }

  // Stuck somewhere odd: hop out.
  if (sp.y > brain.bestY + 8) {
    brain.bestY = sp.y;
    brain.stuckT = 0;
  } else if (!sp.holding) {
    brain.stuckT += dt;
    if (brain.stuckT > 4) {
      brain.stuckT = 0;
      o.jump = true;
      o.x = brain.rng.next() < 0.5 ? -0.6 : 0.6;
      o.y = 0.8;
    }
  }
  return o;
}

function steer(o, sp, sense) {
  // Push the stick along the surface in the wanted direction.
  o.x = -sp.ny * sense;
  o.y = sp.nx * sense;
}

/** A dry spot along this wall the bot can reach before the water, if it knows to look. */
function pickShelter(brain, sp, level, r) {
  const k = brain.skill;
  if (k * brain.persona.shelter < 0.4) return null;
  const time = (r.wet ? 0 : r.next) - 0.15;
  if (time <= 0) return null;
  let best = null;
  for (const a of level.pocketAnchors) {
    const ds = a.s - sp.s;
    if (Math.abs(ds) / WALK > time) continue;
    if (a.y < sp.y - 120 * brain.persona.shelter * k) continue; // don't go far backwards
    if (!best || a.y > best.y) best = a;
  }
  return best;
}

function mossAhead(sp, level) {
  const sense = sp.up;
  for (let d = 30; d <= 150; d += 30) {
    const p = sampleAt(level.path, sp.s + sense * d, pt);
    if (p.moss) return true;
  }
  return false;
}

export const gripFrac = (sp) => sp.grip / GRIP_MAX;
