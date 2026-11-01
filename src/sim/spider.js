// One spider, stepped at a fixed rate: running along any surface (Up always climbs, the direction latched while the stick is
// held the same way; speed builds the longer you run), jumps (tap for a hop, hold for the full arc, the running speed
// carried into the leap), silk (Jump again in the air near a snag: swing, reel up, let go to fling), Hold and grip (a
// perfect hold just before the water costs no grip and springs you on after), being washed down to the next ledge, knocks
// from bumps, debris and the bird. Pure: the same code moves the player, the bots, the title's racers and the tests.

import * as C from './config.js';
import { sampleAt, raycast, nearest, centerX, wrapS, clearLine, lowerBound } from './level.js';

const MODES = ['surf', 'air', 'tumble', 'washed', 'dazed', 'done', 'drowned', 'swing'];
export const MODE_COUNT = MODES.length;
export const modeCode = (m) => Math.max(0, MODES.indexOf(m));
export const modeName = (c) => MODES[c] ?? 'surf';

export function createSpider(level, s = 0, pi = 0) {
  const sp = {
    mode: 'surf',
    pi: 0,
    s: 0,
    v: 0,
    sense: 0,
    latch: '',
    run: 0,
    x: 0,
    y: 0,
    nx: 0,
    ny: 1,
    vx: 0,
    vy: 0,
    facing: 1,
    grip: C.GRIP_MAX,
    holding: false,
    holdT: -9,
    refill: 0,
    timer: 0,
    immune: 0,
    jumpBuf: 0,
    departS: -1,
    departPi: 0,
    departNx: 0,
    departNy: 1,
    rise: false,
    cut: false,
    moss: false,
    side: 'L',
    up: 1,
    walked: 0,
    legsLost: 0,
    wetWave: -1,
    heldWave: -1,
    perfectWave: -1,
    graceWave: -1,
    grace: 0,
    washY: 0,
    doneT: 0,
    scrabble: 0,
    boost: 0,
    boostK: 1,
    snag: -1,
    lastSnag: -1,
    rope: 0,
    ax: 0,
    ay: 0,
    silkCd: 0,
    stats: { held: 0, perfect: 0, washes: 0, maxDrop: 0, knocks: 0, jumps: 0, swings: 0, flies: 0, springs: 0 },
    events: [],
  };
  placeOn(sp, level, s, pi);
  return sp;
}

/** Copies one spider's state into another (the bots imagine moves on a copy). Events and stats stay the target's own. */
export function copySpider(dst, src) {
  for (const k in src) {
    if (k === 'events' || k === 'stats') continue;
    dst[k] = src[k];
  }
  return dst;
}

const tmp = {};

/** Puts the spider on a path at arclength s. */
export function placeOn(sp, level, s, pi = 0) {
  sp.mode = 'surf';
  sp.pi = pi;
  sp.s = wrapS(level.paths[pi], s);
  sp.v = 0;
  sp.run = 0;
  syncSurf(sp, level);
}

/** Start position: on the drain's floor, at a given x (spread the racers across it). */
export function startS(level, x) {
  const hit = nearest(level, x, C.R, 60);
  return hit ? hit.s : 0;
}

function syncSurf(sp, level) {
  const path = level.paths[sp.pi];
  const p = sampleAt(path, sp.s, tmp);
  sp.x = p.x;
  sp.y = p.y;
  sp.nx = p.nx;
  sp.ny = p.ny;
  sp.up = p.up;
  sp.moss = !!p.moss;
  sp.side = p.side;
  return p;
}

const ev = (sp, type, extra) => {
  if (sp.events.length < 24) sp.events.push(extra ? { type, ...extra } : { type });
};

/** Which way along the surface the stick means (+1 forward, -1 back, 0 none). */
function chooseSense(sp, ix, iy) {
  const mag = Math.hypot(ix, iy);
  if (mag < 0.2) return 0;
  const tx = -sp.ny;
  const ty = sp.nx;
  const proj = ix * tx + iy * ty;
  if (Math.abs(proj) >= 0.38 * mag) return Math.sign(proj);
  if (iy > 0.3) return sp.up;
  if (iy < -0.3) return -sp.up;
  return 0;
}

const keyOf = (ix, iy) => `${Math.round(ix * 2)},${Math.round(iy * 2)}`;

/** The speed the spider runs at right now (scurry builds over SCURRY_T; boosts on top). */
export function runSpeed(sp) {
  const k = Math.min(1, sp.run / C.SCURRY_T);
  const base = C.WALK + (C.SCURRY - C.WALK) * k * k * (3 - 2 * k);
  return base * (sp.boost > 0 ? sp.boostK : 1);
}

/**
 * Advances the spider by dt. input: { x, y (y up, -1..1), jump (pressed since the last step), jumpHeld, hold (held) }.
 * world: { water(x, y, t) → wave|null, wetRaw(y, t), lift(x, y) }.
 */
export function step(sp, level, world, input, t, dt) {
  if (sp.mode === 'done' || sp.mode === 'drowned') return;
  if (sp.immune > 0) sp.immune -= dt;
  if (sp.jumpBuf > 0) sp.jumpBuf -= dt;
  if (sp.scrabble > 0) sp.scrabble -= dt;
  if (sp.silkCd > 0) sp.silkCd -= dt;
  if (sp.boost > 0) sp.boost -= dt;
  const pressed = !!input.jump;
  if (pressed && sp.mode !== 'air') sp.jumpBuf = C.JUMP_BUFFER;

  switch (sp.mode) {
    case 'surf':
      surf(sp, level, input, t, dt);
      break;
    case 'air':
      if (pressed && trySilk(sp, level, input)) {
        swing(sp, level, world, input, dt);
        break;
      }
      if (pressed) sp.jumpBuf = C.JUMP_BUFFER;
      air(sp, level, world, input, dt);
      break;
    case 'tumble':
      air(sp, level, world, input, dt);
      break;
    case 'swing':
      swing(sp, level, world, input, dt);
      break;
    case 'washed':
      washed(sp, level, world, t, dt);
      break;
    case 'dazed':
      dazed(sp, level, world, t, dt);
      break;
  }

  // The water, before grip: a perfect hold spends none while it passes.
  let wave = null;
  if (sp.mode === 'surf' || sp.mode === 'air' || sp.mode === 'tumble' || sp.mode === 'swing') {
    wave = world.water(sp.x, sp.y, t);
    if (wave) {
      if (sp.mode === 'surf' && !sp.holding && sp.graceWave !== wave.id && !sp.moss) {
        // Touched by the front this instant: a hold right now still counts.
        sp.graceWave = wave.id;
        sp.grace = C.LATE_GRACE;
      }
      if (sp.mode === 'surf' && !sp.holding && sp.graceWave === wave.id && sp.grace > 0) {
        sp.grace -= dt;
        if (input.hold && sp.grip >= C.GRIP_MIN_START) {
          sp.holding = true;
          sp.holdT = t;
          ev(sp, 'hold', { late: true });
        }
      }
      if (sp.mode === 'surf' && sp.holding) {
        if (sp.wetWave !== wave.id) {
          sp.wetWave = wave.id;
          if (t - sp.holdT <= C.PERFECT && sp.perfectWave !== wave.id) {
            sp.perfectWave = wave.id;
            sp.stats.perfect++;
            ev(sp, 'perfect');
          } else ev(sp, 'splashOver');
        }
        sp.heldWave = wave.id;
      } else if (!(sp.mode === 'surf' && sp.graceWave === wave.id && sp.grace > 0)) {
        if (sp.mode === 'swing') ev(sp, 'snap');
        wash(sp);
        wave = null;
      }
    } else if (sp.heldWave >= 0 && sp.mode === 'surf') {
      // Came through a wave holding on.
      if (!world.wetRaw(sp.y, t) || sp.heldWave !== sp.wetWave) {
        sp.stats.held++;
        const perfect = sp.perfectWave === sp.heldWave;
        ev(sp, 'survived', { perfect });
        if (perfect) {
          sp.boost = C.SPRING_T;
          sp.boostK = C.SPRING_K;
          sp.stats.springs++;
          ev(sp, 'spring');
        }
        sp.heldWave = -1;
        sp.wetWave = -1;
      }
    }
  }

  // Grip: drains while holding (not while a perfect hold sits under its wave), refills after a moment.
  if (sp.holding) {
    const free = wave && sp.perfectWave === wave.id;
    if (!free) {
      const before = sp.grip;
      sp.grip -= dt;
      const step8 = C.GRIP_MAX / 8;
      if (Math.floor(before / step8) > Math.floor(Math.max(0, sp.grip) / step8)) {
        sp.legsLost = Math.min(8, sp.legsLost + 1);
        ev(sp, 'leg', { n: sp.legsLost });
      }
    }
    sp.refill = C.GRIP_REFILL_DELAY;
    if (sp.grip <= 0) {
      sp.grip = 0;
      sp.holding = false;
      ev(sp, 'outOfGrip');
    }
  } else {
    if (sp.refill > 0) sp.refill -= dt;
    else sp.grip = Math.min(C.GRIP_MAX, sp.grip + dt);
    sp.legsLost = Math.round((1 - sp.grip / C.GRIP_MAX) * 8);
  }

  // The sun at the top.
  if (sp.y >= level.finishY + 6 && (sp.mode === 'surf' || sp.mode === 'air' || sp.mode === 'swing')) {
    sp.mode = 'done';
    sp.holding = false;
    sp.snag = -1;
    sp.doneT = t;
    ev(sp, 'finish');
  }
}

function surf(sp, level, input, t, dt) {
  syncSurf(sp, level);
  // Hold.
  if (input.hold && !sp.holding) {
    if (sp.moss) {
      if (sp.scrabble <= 0) {
        ev(sp, 'scrabble');
        sp.scrabble = 0.5;
      }
    } else if (sp.grip >= C.GRIP_MIN_START) {
      sp.holding = true;
      sp.holdT = t;
      sp.legsLost = Math.round((1 - sp.grip / C.GRIP_MAX) * 8);
      ev(sp, 'hold');
    }
  } else if (!input.hold && sp.holding) {
    sp.holding = false;
    ev(sp, 'release');
  }
  if (sp.holding && sp.moss) {
    sp.holding = false;
    ev(sp, 'scrabble');
  }
  // Jump (also out of a hold).
  if (sp.jumpBuf > 0) {
    jump(sp, level, input);
    return;
  }
  if (sp.holding) {
    sp.v = 0;
    sp.run = 0;
    return;
  }
  const ix = input.x || 0;
  const iy = input.y || 0;
  const mag = Math.hypot(ix, iy);
  if (mag < 0.2) {
    sp.sense = 0;
    sp.latch = '';
  } else {
    const key = keyOf(ix, iy);
    if (key !== sp.latch) {
      sp.latch = key;
      sp.sense = chooseSense(sp, ix, iy);
    }
  }
  let sense = sp.sense;
  if (sense !== 0) {
    // Never walk on while the surface turns right against the stick (round an island's far side).
    const tx = -sp.ny * sense;
    const ty = sp.nx * sense;
    if ((ix * tx + iy * ty) / (mag || 1) < -0.55) sense = 0;
  }
  // Running the same way builds speed; stopping or turning back loses it.
  if (sense !== 0 && (sp.v === 0 || Math.sign(sp.v) === sense)) sp.run += dt;
  else if (sense !== 0) sp.run = 0;
  else sp.run = Math.max(0, sp.run - dt * 4);
  let target = sense * runSpeed(sp);
  if (sp.moss && sense === 0) target = -sp.up * C.MOSS_SLIDE;
  const turning = target !== 0 && sp.v !== 0 && Math.sign(target) !== Math.sign(sp.v);
  const a = (turning || target === 0 ? C.TURN_DECEL : C.ACCEL) * dt;
  sp.v = sp.v < target ? Math.min(target, sp.v + a) : Math.max(target, sp.v - a);
  const path = level.paths[sp.pi];
  const before = sp.s;
  sp.s = wrapS(path, sp.s + sp.v * dt);
  if (!path.closed && (sp.s === 0 || sp.s === path.length)) sp.v = 0;
  syncSurf(sp, level);
  let moved = Math.abs(sp.s - before);
  if (path.closed && moved > path.length / 2) moved = path.length - moved;
  if (sp.v !== 0) sp.facing = sp.v > 0 ? 1 : -1;
  sp.walked += moved;
  if (sp.walked > 11) {
    sp.walked = 0;
    ev(sp, 'step');
  }
}

function jump(sp, level, input) {
  sp.jumpBuf = 0;
  let dx = input.x || 0;
  let dy = input.y || 0;
  const n0 = sp.nx;
  const n1 = sp.ny;
  if (Math.hypot(dx, dy) < 0.2) {
    dx = n0;
    dy = n1 + 0.8;
  } else {
    const into = dx * n0 + dy * n1;
    if (into < 0) {
      dx -= into * n0;
      dy -= into * n1;
    }
    dx += 0.55 * n0;
    dy += 0.55 * n1;
  }
  const l = Math.hypot(dx, dy) || 1;
  // The running speed along the surface comes along.
  const tvx = -sp.ny * sp.v * C.CARRY;
  const tvy = sp.nx * sp.v * C.CARRY;
  sp.vx = (dx / l) * C.JUMP + tvx;
  sp.vy = (dy / l) * C.JUMP + tvy;
  if (Math.abs(sp.vx) > 1) sp.facing = Math.sign(sp.vx * -sp.ny + sp.vy * sp.nx) || sp.facing;
  sp.x += n0 * 1.5;
  sp.y += n1 * 1.5;
  sp.departS = sp.s;
  sp.departPi = sp.pi;
  sp.departNx = n0;
  sp.departNy = n1;
  sp.mode = 'air';
  sp.timer = 0;
  sp.holding = false;
  sp.rise = true;
  sp.cut = false;
  sp.stats.jumps++;
  ev(sp, 'jump', { speed: Math.abs(sp.v) });
}

function attach(sp, level, hit, mode = 'surf') {
  // Land keeping the speed along the surface (a running landing keeps running).
  sp.pi = hit.pi ?? 0;
  sp.s = hit.s;
  const p = sampleAt(level.paths[sp.pi], sp.s, tmp);
  const along = (sp.vx || 0) * -p.ny + (sp.vy || 0) * p.nx;
  sp.mode = mode;
  sp.snag = -1;
  sp.rise = false;
  sp.cut = false;
  sp.v = mode === 'surf' ? Math.max(-C.SCURRY, Math.min(C.SCURRY, along * 0.85)) : 0;
  sp.run = Math.abs(sp.v) > C.WALK ? C.SCURRY_T * Math.min(1, (Math.abs(sp.v) - C.WALK) / (C.SCURRY - C.WALK)) : 0;
  sp.sense = 0;
  sp.timer = 0;
  sp.latch = '';
  syncSurf(sp, level);
}

function air(sp, level, world, input, dt) {
  sp.timer += dt;
  // A short hop: Jump let go while rising cuts the arc.
  if (sp.rise && !input.jumpHeld && sp.mode === 'air') {
    sp.rise = false;
    sp.cut = true;
  }
  if (sp.vy <= 0) {
    sp.rise = false;
    sp.cut = false;
  }
  sp.vy -= C.GRAVITY * (sp.cut ? C.JUMP_CUT : 1) * dt;
  // A little steering in the air.
  if (sp.mode === 'air') {
    const ix = input.x || 0;
    if (Math.abs(ix) > 0.2 && sp.vx * ix < 300) sp.vx += ix * 520 * dt;
  }
  if (world.lift(sp.x, sp.y) && sp.vy < C.VENT_MAX) sp.vy = Math.min(C.VENT_MAX, sp.vy + C.VENT_ACCEL * dt);
  if (sp.vy < -C.MAX_FALL) sp.vy = -C.MAX_FALL;
  move(sp, level, input, dt, sp.mode === 'tumble' && sp.timer < C.TUMBLE_SLIDE ? 'slide' : 'stick');
}

const departSkip = { pi: 0, s0: 0, s1: 0, nx: 0, ny: 0 };

/** Moves through the air: 'stick' attaches to what it touches, 'slide' glances off. */
function move(sp, level, input, dt, how) {
  const nx = sp.x + sp.vx * dt;
  const ny = sp.y + sp.vy * dt;
  let skip = null;
  if (sp.mode === 'air' && sp.timer < C.DEPART_IGNORE) {
    departSkip.pi = sp.departPi;
    departSkip.s0 = sp.departS - 30;
    departSkip.s1 = sp.departS + 30;
    departSkip.nx = sp.departNx;
    departSkip.ny = sp.departNy;
    skip = departSkip;
  }
  const hit = raycast(level, sp.x, sp.y, nx, ny, skip);
  if (hit) {
    if (how === 'stick') {
      const impact = Math.hypot(sp.vx, sp.vy);
      attach(sp, level, hit);
      ev(sp, 'land', { impact });
      if (input && input.hold && !sp.moss && sp.grip >= C.GRIP_MIN_START) {
        sp.holding = true;
        sp.holdT = -9;
        ev(sp, 'hold');
      }
      return hit;
    }
    // Glance: stop at the surface and keep only the motion along it.
    sp.x = hit.x + hit.nx * 0.5;
    sp.y = hit.y + hit.ny * 0.5;
    const vn = sp.vx * hit.nx + sp.vy * hit.ny;
    if (vn < 0) {
      sp.vx -= vn * hit.nx;
      sp.vy -= vn * hit.ny;
    }
    return hit;
  }
  sp.x = nx;
  sp.y = ny;
  rescue(sp, level);
  return null;
}

/** A spider that somehow left the pipe goes back onto the nearest surface. */
function rescue(sp, level) {
  const off = Math.abs(sp.x - centerX(level, sp.y));
  if (off < C.HALF + 200 && sp.y > -20) return;
  const hit = nearest(level, Math.max(-60, sp.x), Math.max(C.R, sp.y), 200) ?? nearest(level, centerX(level, Math.max(C.R, sp.y)), Math.max(C.R, sp.y), 400);
  if (hit) {
    sp.vx = 0;
    sp.vy = 0;
    attach(sp, level, hit);
  }
}

// ------------------------------------------------------------------------------------------------------------- silk

/** The snag silk would catch right now from this spider, or -1. */
export function snagFor(sp, level, input) {
  const snags = level.snags;
  if (!snags.length) return -1;
  let best = -1;
  let bestScore = -Infinity;
  const v = Math.hypot(sp.vx, sp.vy) || 1;
  const ix = input?.x || 0;
  const iy = input?.y || 0;
  const im = Math.hypot(ix, iy);
  for (let i = lowerBound(snags, sp.y - 60); i < snags.length; i++) {
    const sn = snags[i];
    const dy = sn.y - sp.y;
    if (dy > C.SILK_RANGE) break;
    const dx = sn.x - sp.x;
    const d = Math.hypot(dx, dy);
    if (d > C.SILK_RANGE || d < 24) continue;
    if (sn.id === sp.lastSnag && sp.silkCd > 0) continue;
    let score = dy + ((sp.vx * dx + sp.vy * dy) / (d * v)) * 60 - d * 0.25;
    if (im > 0.2) score += ((ix * dx + iy * dy) / (d * im)) * 80;
    if (score <= bestScore) continue;
    if (!clearLine(level, sp.x, sp.y, sn.x, sn.y)) continue;
    best = i;
    bestScore = score;
  }
  return best;
}

function trySilk(sp, level, input) {
  if (sp.mode !== 'air') return false;
  const i = snagFor(sp, level, input);
  if (i < 0) return false;
  const sn = level.snags[i];
  sp.mode = 'swing';
  sp.snag = i;
  sp.lastSnag = sn.id;
  sp.ax = sn.x;
  sp.ay = sn.y;
  sp.rope = Math.hypot(sn.x - sp.x, sn.y - sp.y);
  sp.rise = false;
  sp.cut = false;
  sp.jumpBuf = 0;
  sp.timer = 0;
  sp.stats.swings++;
  ev(sp, 'silk', { snag: i });
  return true;
}

function swing(sp, level, world, input, dt) {
  sp.timer += dt;
  if (!input.jumpHeld && sp.timer > 0.05) {
    release(sp);
    air(sp, level, world, input, dt);
    return;
  }
  sp.vy -= C.GRAVITY * dt;
  let rx = sp.x - sp.ax;
  let ry = sp.y - sp.ay;
  let d = Math.hypot(rx, ry) || 1;
  // The stick pumps along the arc.
  const ix = input.x || 0;
  if (Math.abs(ix) > 0.2) {
    let tx = -ry / d;
    let ty = rx / d;
    if (tx * ix < 0) {
      tx = -tx;
      ty = -ty;
    }
    sp.vx += tx * C.SILK_PUMP * Math.abs(ix) * dt;
    sp.vy += ty * C.SILK_PUMP * Math.abs(ix) * dt;
  }
  if (sp.rope > C.SILK_MIN) sp.rope = Math.max(C.SILK_MIN, sp.rope - C.SILK_REEL * dt);
  const sv = Math.hypot(sp.vx, sp.vy);
  if (sv > C.SILK_MAXV) {
    sp.vx *= C.SILK_MAXV / sv;
    sp.vy *= C.SILK_MAXV / sv;
  }
  if (Math.abs(sp.vx) > 30) sp.facing = sp.vx > 0 ? 1 : -1;
  const hit = move(sp, level, input, dt, 'stick');
  if (hit || sp.mode !== 'swing') return;
  rx = sp.x - sp.ax;
  ry = sp.y - sp.ay;
  d = Math.hypot(rx, ry) || 1;
  if (d > sp.rope) {
    const k = sp.rope / d;
    sp.x = sp.ax + rx * k;
    sp.y = sp.ay + ry * k;
    const ux = rx / d;
    const uy = ry / d;
    const vr = sp.vx * ux + sp.vy * uy;
    if (vr > 0) {
      sp.vx -= vr * ux;
      sp.vy -= vr * uy;
    }
  }
}

function release(sp) {
  sp.mode = 'air';
  sp.vx *= C.SILK_FLING;
  sp.vy *= C.SILK_FLING;
  if (sp.vy > 0) sp.vy += 60;
  sp.snag = -1;
  sp.silkCd = C.SILK_COOLDOWN;
  sp.timer = C.DEPART_IGNORE;
  sp.rise = false;
  sp.cut = false;
  ev(sp, 'fling', { speed: Math.hypot(sp.vx, sp.vy) });
}

// ------------------------------------------------------------------------------------------------------------- water

function wash(sp) {
  sp.mode = 'washed';
  sp.holding = false;
  sp.snag = -1;
  sp.washY = sp.y;
  sp.vx = 0;
  sp.vy = Math.min(sp.vy || 0, -150);
  sp.timer = 0;
  sp.boost = 0;
  sp.stats.washes++;
  ev(sp, 'washed');
}

function washed(sp, level, world, t, dt) {
  sp.timer += dt;
  sp.vy = Math.max(-C.WASH_SPEED, sp.vy - 3000 * dt);
  const cx = centerX(level, sp.y);
  sp.vx = (sp.x < cx ? -1 : 1) * C.WASH_DRIFT;
  let budget = 2;
  let px = sp.x;
  let py = sp.y;
  let mx = sp.vx * dt;
  let my = sp.vy * dt;
  while (budget-- > 0) {
    const hit = raycast(level, px, py, px + mx, py + my);
    if (!hit) {
      px += mx;
      py += my;
      break;
    }
    if (hit.ny > C.CATCH_NY) {
      sp.vx = 0;
      sp.vy = 0;
      attach(sp, level, hit, 'dazed');
      const drop = sp.washY - sp.y;
      if (drop > sp.stats.maxDrop) sp.stats.maxDrop = drop;
      ev(sp, 'caught', { drop });
      return;
    }
    // Slide down the wall with what is left of the move.
    px = hit.x + hit.nx * 0.5;
    py = hit.y + hit.ny * 0.5;
    const rest = 1 - hit.t;
    const tx = -hit.ny;
    const ty = hit.nx;
    const along = (mx * tx + my * ty) * rest;
    mx = tx * along;
    my = ty * along;
  }
  sp.x = px;
  sp.y = py;
  rescue(sp, level);
  if (sp.mode !== 'washed') return;
  if (!world.wetRaw(sp.y, t) && sp.timer > 0.15) {
    // The water has passed: fall and grab whatever comes next.
    sp.mode = 'tumble';
    sp.timer = C.TUMBLE_SLIDE;
    const drop = sp.washY - sp.y;
    if (drop > sp.stats.maxDrop) sp.stats.maxDrop = drop;
    ev(sp, 'washEnd', { drop });
  }
  if (sp.y < 4) {
    const hit = nearest(level, sp.x, C.R, 120);
    if (hit) {
      attach(sp, level, hit, 'dazed');
      ev(sp, 'caught', { drop: sp.washY - sp.y });
    }
  }
}

function dazed(sp, level, world, t, dt) {
  syncSurf(sp, level);
  sp.holding = false;
  if (world.wetRaw(sp.y, t)) sp.timer = 0;
  else {
    sp.timer += dt;
    if (sp.timer >= C.DAZE_AFTER) {
      sp.mode = 'surf';
      sp.timer = 0;
      ev(sp, 'recover');
    }
  }
}

/** A knock (a bump, a falling cap, the bird): holding shrugs it off. Returns true when it took. */
export function knock(sp, vx, vy, kind) {
  if (sp.mode === 'done' || sp.mode === 'drowned' || sp.mode === 'washed' || sp.mode === 'dazed') return false;
  if (sp.holding && sp.mode === 'surf') {
    ev(sp, 'shrug', { kind });
    return false;
  }
  if (sp.immune > 0) return false;
  sp.mode = 'tumble';
  sp.snag = -1;
  sp.vx = vx;
  sp.vy = vy;
  sp.timer = 0;
  sp.immune = C.IMMUNE;
  sp.holding = false;
  sp.boost = 0;
  sp.stats.knocks++;
  ev(sp, 'knocked', { kind });
  return true;
}

/** A fly eaten: a short burst of speed. */
export function eatFly(sp, gold) {
  sp.stats.flies++;
  if (sp.boost <= 0 || sp.boostK <= C.FLY_K) {
    sp.boost = Math.max(sp.boost, C.FLY_T);
    sp.boostK = C.FLY_K;
  }
  ev(sp, 'fly', { gold: !!gold });
}

/** The knock a jumper gives the spider it lands on. */
export function bumpVelocity(from, to) {
  const dx = to.x - from.x;
  const l = Math.abs(dx) > 1 ? Math.sign(dx) : to.nx >= 0 ? 1 : -1;
  return [l * C.BUMP_PUSH, -C.BUMP_DOWN];
}

/** A compact copy for the network / ghosts: [x, y, angle, mode, grip×10, holding, facing, snag]. */
export function pack(sp) {
  return [Math.round(sp.x * 10) / 10, Math.round(sp.y * 10) / 10, Math.round(angleOf(sp)), modeCode(sp.mode), Math.round(sp.grip * 10), sp.holding ? 1 : 0, sp.facing, sp.mode === 'swing' ? sp.snag : -1];
}

/** The body's angle in degrees: standing on its surface, or tumbling. */
export function angleOf(sp) {
  if (sp.mode === 'surf' || sp.mode === 'dazed' || sp.mode === 'done') return (Math.atan2(sp.nx, sp.ny) * 180) / Math.PI;
  if (sp.mode === 'swing') return (Math.atan2(sp.ax - sp.x, sp.ay - sp.y) * 180) / Math.PI;
  return ((Math.atan2(sp.vx, sp.vy) * 180) / Math.PI) | 0;
}

/** Rebuilds a spider from a packed copy (a new host taking over the bots, a reload). */
export function unpack(level, data) {
  const sp = createSpider(level, 0);
  const [x, y, , m, g] = data;
  const mode = modeName(m);
  sp.grip = Math.max(0, Math.min(C.GRIP_MAX, g / 10));
  const hit = nearest(level, x, y, 30);
  if (hit && (mode === 'surf' || mode === 'dazed' || mode === 'done')) {
    sp.pi = hit.pi;
    sp.s = hit.s;
    syncSurf(sp, level);
    sp.mode = mode === 'done' ? 'done' : 'surf';
  } else {
    sp.x = x;
    sp.y = y;
    sp.mode = mode === 'done' ? 'done' : 'tumble';
    sp.timer = C.TUMBLE_SLIDE;
    sp.vx = 0;
    sp.vy = 0;
  }
  return sp;
}
