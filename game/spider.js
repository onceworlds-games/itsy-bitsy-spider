// One spider, stepped at a fixed rate: walking along any surface (Up always climbs, the direction latched while the stick is
// held the same way), jumps, Hold and grip, being washed down to the next ring, knocks from bumps, debris and the bird. Pure:
// the same code moves the player, the bots, the title's racers and the tests.

import * as C from './config.js';
import { sampleAt, raycast, nearest, centerX } from './level.js';

const MODES = ['surf', 'air', 'tumble', 'washed', 'dazed', 'done', 'drowned'];
export const modeCode = (m) => Math.max(0, MODES.indexOf(m));
export const modeName = (c) => MODES[c] ?? 'surf';

export function createSpider(level, s = 0) {
  const sp = {
    mode: 'surf',
    s: 0,
    v: 0,
    sense: 0,
    latch: '',
    x: 0,
    y: 0,
    nx: 0,
    ny: 1,
    vx: 0,
    vy: 0,
    facing: 1,
    grip: C.GRIP_MAX,
    holding: false,
    refill: 0,
    timer: 0,
    immune: 0,
    jumpBuf: 0,
    departS: -1,
    moss: false,
    side: 'L',
    up: 1,
    walked: 0,
    legsLost: 0,
    wetWave: -1,
    heldWave: -1,
    washY: 0,
    doneT: 0,
    scrabble: 0,
    stats: { held: 0, washes: 0, maxDrop: 0, knocks: 0, jumps: 0 },
    events: [],
  };
  placeOn(sp, level, s);
  return sp;
}

const tmp = {};

/** Puts the spider on the path at arclength s. */
export function placeOn(sp, level, s) {
  sp.mode = 'surf';
  sp.s = Math.max(0, Math.min(level.path.length, s));
  sp.v = 0;
  syncSurf(sp, level);
}

/** Start position: on the drain's floor, at a given x (spread the racers across it). */
export function startS(level, x) {
  const hit = nearest(level, x, C.R, 60);
  return hit ? hit.s : 0;
}

function syncSurf(sp, level) {
  const p = sampleAt(level.path, sp.s, tmp);
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

/**
 * Advances the spider by dt. input: { x, y (y up, -1..1), jump (pressed since the last step), hold (held) }.
 * world: { water(x, y, t) → wave|null, wetRaw(y, t), lift(x, y) }.
 */
export function step(sp, level, world, input, t, dt) {
  if (sp.mode === 'done' || sp.mode === 'drowned') return;
  if (sp.immune > 0) sp.immune -= dt;
  if (sp.jumpBuf > 0) sp.jumpBuf -= dt;
  if (sp.scrabble > 0) sp.scrabble -= dt;
  if (input.jump) sp.jumpBuf = C.JUMP_BUFFER;

  switch (sp.mode) {
    case 'surf':
      surf(sp, level, input, dt);
      break;
    case 'air':
    case 'tumble':
      air(sp, level, world, input, dt);
      break;
    case 'washed':
      washed(sp, level, world, t, dt);
      break;
    case 'dazed':
      dazed(sp, level, world, t, dt);
      break;
  }

  // Grip: drains while holding, refills after a moment.
  if (sp.holding) {
    const before = sp.grip;
    sp.grip -= dt;
    sp.refill = C.GRIP_REFILL_DELAY;
    const step8 = C.GRIP_MAX / 8;
    if (Math.floor(before / step8) > Math.floor(Math.max(0, sp.grip) / step8)) {
      sp.legsLost = Math.min(8, sp.legsLost + 1);
      ev(sp, 'leg', { n: sp.legsLost });
    }
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

  // The water.
  if (sp.mode === 'surf' || sp.mode === 'air' || sp.mode === 'tumble') {
    const wave = world.water(sp.x, sp.y, t);
    if (wave) {
      if (sp.mode === 'surf' && sp.holding) {
        if (sp.wetWave !== wave.id) {
          sp.wetWave = wave.id;
          ev(sp, 'splashOver');
        }
        sp.heldWave = wave.id;
      } else {
        wash(sp);
      }
    } else if (sp.heldWave >= 0 && sp.mode === 'surf') {
      // Came through a wave holding on.
      if (!world.wetRaw(sp.y, t) || sp.heldWave !== sp.wetWave) {
        sp.stats.held++;
        ev(sp, 'survived');
        sp.heldWave = -1;
        sp.wetWave = -1;
      }
    }
  }

  // The sun at the top.
  if (sp.y >= level.finishY + 6 && (sp.mode === 'surf' || sp.mode === 'air')) {
    sp.mode = 'done';
    sp.holding = false;
    sp.doneT = t;
    ev(sp, 'finish');
  }
}

function surf(sp, level, input, dt) {
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
    jump(sp, input);
    return;
  }
  if (sp.holding) {
    sp.v = 0;
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
  let target = sp.sense * C.WALK;
  if (sp.sense !== 0) {
    // Never walk on while the surface turns right against the stick (round an island's far side).
    const tx = -sp.ny * sp.sense;
    const ty = sp.nx * sp.sense;
    if ((ix * tx + iy * ty) / (mag || 1) < -0.55) target = 0;
  }
  if (sp.moss && sp.sense === 0) target = -sp.up * C.MOSS_SLIDE;
  const a = C.ACCEL * dt;
  sp.v = sp.v < target ? Math.min(target, sp.v + a) : Math.max(target, sp.v - a);
  const before = sp.s;
  sp.s = Math.max(0, Math.min(level.path.length, sp.s + sp.v * dt));
  if (sp.s === 0 || sp.s === level.path.length) sp.v = 0;
  syncSurf(sp, level);
  const moved = Math.abs(sp.s - before);
  if (sp.v !== 0) sp.facing = sp.v > 0 ? 1 : -1;
  sp.walked += moved;
  if (sp.walked > 11) {
    sp.walked = 0;
    ev(sp, 'step');
  }
}

function jump(sp, input) {
  sp.jumpBuf = 0;
  let dx = input.x || 0;
  let dy = input.y || 0;
  const n = [sp.nx, sp.ny];
  if (Math.hypot(dx, dy) < 0.2) {
    dx = n[0];
    dy = n[1] + 0.8;
  } else {
    const into = dx * n[0] + dy * n[1];
    if (into < 0) {
      dx -= into * n[0];
      dy -= into * n[1];
    }
    dx += 0.55 * n[0];
    dy += 0.55 * n[1];
  }
  const l = Math.hypot(dx, dy) || 1;
  sp.vx = (dx / l) * C.JUMP;
  sp.vy = (dy / l) * C.JUMP;
  if (Math.abs(sp.vx) > 1) sp.facing = Math.sign(sp.vx * -sp.ny + sp.vy * sp.nx) || sp.facing;
  sp.x += n[0] * 1.5;
  sp.y += n[1] * 1.5;
  sp.departS = sp.s;
  sp.mode = 'air';
  sp.timer = 0;
  sp.holding = false;
  sp.stats.jumps++;
  ev(sp, 'jump');
}

function attach(sp, level, hit, mode = 'surf') {
  sp.mode = mode;
  sp.s = hit.s;
  sp.v = 0;
  sp.timer = 0;
  sp.latch = '';
  syncSurf(sp, level);
}

function air(sp, level, world, input, dt) {
  sp.timer += dt;
  sp.vy -= C.GRAVITY * dt;
  if (world.lift(sp.x, sp.y) && sp.vy < C.VENT_MAX) sp.vy = Math.min(C.VENT_MAX, sp.vy + C.VENT_ACCEL * dt);
  if (sp.vy < -C.MAX_FALL) sp.vy = -C.MAX_FALL;
  move(sp, level, input, dt, sp.mode === 'tumble' && sp.timer < C.TUMBLE_SLIDE ? 'slide' : 'stick');
}

/** Moves through the air: 'stick' attaches to what it touches, 'slide' glances off. */
function move(sp, level, input, dt, how) {
  let nx = sp.x + sp.vx * dt;
  let ny = sp.y + sp.vy * dt;
  const skip = sp.mode === 'air' && sp.timer < C.DEPART_IGNORE ? sp.departS : -1;
  const hit = raycast(level, sp.x, sp.y, nx, ny, skip >= 0 ? skip - 30 : -1, skip >= 0 ? skip + 30 : -1);
  if (hit) {
    if (how === 'stick') {
      const impact = Math.hypot(sp.vx, sp.vy);
      attach(sp, level, hit);
      ev(sp, 'land', { impact });
      if (input && input.hold && !sp.moss && sp.grip >= C.GRIP_MIN_START) {
        sp.holding = true;
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
  if (off < C.HALF + 70 && sp.y > -20) return;
  const hit = nearest(level, Math.max(-60, sp.x), Math.max(C.R, sp.y), 160) ?? nearest(level, centerX(level, Math.max(C.R, sp.y)), Math.max(C.R, sp.y), 400);
  if (hit) attach(sp, level, hit);
}

function wash(sp) {
  sp.mode = 'washed';
  sp.holding = false;
  sp.washY = sp.y;
  sp.vx = 0;
  sp.vy = Math.min(sp.vy || 0, -150);
  sp.timer = 0;
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
  sp.vx = vx;
  sp.vy = vy;
  sp.timer = 0;
  sp.immune = C.IMMUNE;
  sp.holding = false;
  sp.stats.knocks++;
  ev(sp, 'knocked', { kind });
  return true;
}

/** The knock a jumper gives the spider it lands on. */
export function bumpVelocity(from, to) {
  const dx = to.x - from.x;
  const l = Math.abs(dx) > 1 ? Math.sign(dx) : to.nx >= 0 ? 1 : -1;
  return [l * C.BUMP_PUSH, -C.BUMP_DOWN];
}

/** A compact copy for the network / ghosts: [x, y, angle, mode, grip×10, holding, facing]. */
export function pack(sp) {
  return [Math.round(sp.x * 10) / 10, Math.round(sp.y * 10) / 10, Math.round(angleOf(sp)), modeCode(sp.mode), Math.round(sp.grip * 10), sp.holding ? 1 : 0, sp.facing];
}

/** The body's angle in degrees: standing on its surface, or tumbling. */
export function angleOf(sp) {
  if (sp.mode === 'surf' || sp.mode === 'dazed' || sp.mode === 'done') return (Math.atan2(sp.nx, sp.ny) * 180) / Math.PI;
  return ((Math.atan2(sp.vx, sp.vy) * 180) / Math.PI) | 0;
}

/** Rebuilds a spider from a packed copy (a new host taking over the bots). */
export function unpack(level, data) {
  const sp = createSpider(level, 0);
  const [x, y, , m, g] = data;
  const mode = modeName(m);
  sp.grip = Math.max(0, Math.min(C.GRIP_MAX, g / 10));
  const hit = nearest(level, x, y, 30);
  if (hit && (mode === 'surf' || mode === 'dazed' || mode === 'done')) {
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
