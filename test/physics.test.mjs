import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLevel, sampleAt } from '../src/sim/level.js';
import { createSpider, step, startS, knock, placeOn, pack, unpack } from '../src/sim/spider.js';
import { makeWorld } from '../src/sim/weather.js';
import { GRIP_MAX, HALF, R, FRONT_SPEED } from '../src/sim/config.js';

const dt = 1 / 120;
const L = buildLevel([{ k: 'start' }, { k: 'straight', h: 1600, gap: 400 }, { k: 'straight', h: 600, moss: [{ side: 'L', y0: 100, y1: 400 }], gap: 0 }, { k: 'top' }]);
const dry = { water: () => null, wetRaw: () => false, lift: () => false };
const idle = { x: 0, y: 0, jump: false, hold: false };

/** A weather with one flush leaving the gutter at t0. */
const flushAt = (t0, dur) => makeWorld(L, { waves: [{ id: 0, t0, warn: 2, kind: 'single', parts: [[0, dur]], end: dur, top: L.H }], debris: [] });

/** A spider standing on the left wall at height y. */
function onWall(y) {
  const sp = createSpider(L, 0);
  let best = 0;
  let bd = Infinity;
  for (let s = 0; s < L.path.length; s += 1) {
    const p = sampleAt(L.path, s, {});
    if (p.side === 'L' && Math.abs(p.nx - 1) < 1e-6) {
      const d = Math.abs(p.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
  }
  placeOn(sp, L, best);
  return sp;
}

function run(sp, world, input, from, to) {
  for (let t = from; t < to; t += dt) {
    step(sp, L, world, typeof input === 'function' ? input(t) : input, t, dt);
    sp.events.length = 0;
  }
}

test('holding through a flush keeps your place and counts as held', () => {
  const sp = onWall(700);
  const arrive = (L.H - 700) / FRONT_SPEED + 1;
  const world = flushAt(1, 1.8);
  run(sp, world, (t) => ({ x: 0, y: 0, jump: false, hold: t > arrive - 0.1 && t < arrive + 2 }), 0, arrive + 2.5);
  assert.equal(sp.mode, 'surf');
  assert.ok(Math.abs(sp.y - 700) < 1);
  assert.equal(sp.stats.held, 1);
  assert.equal(sp.stats.washes, 0);
});

test('not holding: washed down until a ring catches you, then dazed until the water passes', () => {
  const sp = onWall(1100);
  const world = flushAt(0, 2);
  const arrive = (L.H - 1100) / FRONT_SPEED;
  run(sp, world, idle, 0, arrive + 0.12);
  assert.equal(sp.mode, 'washed');
  run(sp, world, idle, arrive + 0.12, arrive + 1.5);
  assert.equal(sp.mode, 'dazed');
  // The ring below 1100 is at 160 + 800 = 960: caught on its top.
  assert.ok(sp.y > 960 && sp.y < 1000, `caught at ${sp.y}`);
  run(sp, world, idle, arrive + 1.5, arrive + 3.5);
  assert.equal(sp.mode, 'surf');
});

test('grip lasts three seconds, then the legs let go', () => {
  const sp = onWall(700);
  run(sp, dry, { x: 0, y: 0, jump: false, hold: true }, 0, GRIP_MAX - 0.05);
  assert.ok(sp.holding);
  run(sp, dry, { x: 0, y: 0, jump: false, hold: true }, GRIP_MAX - 0.05, GRIP_MAX + 0.1);
  assert.equal(sp.holding, false);
  assert.equal(sp.grip, 0);
  // Refills after a short delay.
  run(sp, dry, idle, 4, 5.5);
  assert.ok(sp.grip > 1);
});

test('holding too early runs out mid-flush and washes you', () => {
  const sp = onWall(700);
  const arrive = (L.H - 700) / FRONT_SPEED + 1;
  const world = flushAt(1, 2.2);
  run(sp, world, { x: 0, y: 0, jump: false, hold: true }, 0.2, arrive + 2.3);
  assert.ok(sp.stats.washes === 1);
});

test('moss: Hold does nothing and you slide down', () => {
  const sp = onWall(160 + 1600 + 250);
  const y0 = sp.y;
  run(sp, dry, { x: 0, y: 0, jump: false, hold: true }, 0, 1);
  assert.equal(sp.holding, false);
  assert.ok(sp.moss);
  assert.ok(sp.y < y0 - 30);
});

test('Up + Jump from the left wall lands on the right wall, higher', () => {
  const sp = onWall(700);
  run(sp, dry, { x: 0, y: 1, jump: true, jumpHeld: true, hold: false }, 0, dt);
  assert.equal(sp.mode, 'air');
  run(sp, dry, { x: 0, y: 0, jump: false, jumpHeld: true, hold: false }, dt, 1.2);
  assert.equal(sp.mode, 'surf');
  assert.ok(sp.x > HALF - R - 1, `landed at x=${sp.x}`);
  assert.ok(sp.y > 700 + 90 && sp.y < 700 + 170, `landed at y=${sp.y}`);
});

test('a knock takes unless you hold; holding shrugs it off', () => {
  const a = onWall(700);
  assert.equal(knock(a, 200, -100, 'bump'), true);
  assert.equal(a.mode, 'tumble');
  const b = onWall(700);
  run(b, dry, { x: 0, y: 0, jump: false, hold: true }, 0, 0.1);
  assert.equal(knock(b, 200, -100, 'bump'), false);
  assert.equal(b.mode, 'surf');
  // A tumble ends stuck to a surface.
  run(a, dry, idle, 0, 2);
  assert.equal(a.mode, 'surf');
});

test('the stick direction is latched round corners and never flips mid-press', () => {
  // Walk Up over a ring: the spider goes round it and keeps climbing.
  const sp = onWall(500);
  let lowest = Infinity;
  run(sp, dry, (t) => {
    lowest = Math.min(lowest, sp.y);
    return { x: 0, y: 1, jump: false, hold: false };
  }, 0, 3);
  assert.ok(sp.y > 800);
  assert.ok(lowest >= 499);
  // Pressing Right on the floor walks right, up the right wall, and does not come back.
  const f = createSpider(L, startS(L, -60));
  let prevX = f.x;
  let back = 0;
  run(f, dry, () => {
    if (f.x < prevX - 0.01 && f.y < 20) back++;
    prevX = f.x;
    return { x: 1, y: 0, jump: false, hold: false };
  }, 0, 2);
  assert.equal(back, 0);
  assert.ok(f.y > 60);
});

test('the top of the spout is the finish', () => {
  const sp = onWall(L.H - 60);
  run(sp, dry, { x: 0, y: 1, jump: false, hold: false }, 0, 2);
  assert.equal(sp.mode, 'done');
});

test('pack and unpack keep a spider where it was', () => {
  const sp = onWall(900);
  const copy = unpack(L, pack(sp));
  assert.ok(Math.hypot(copy.x - sp.x, copy.y - sp.y) < 1);
  assert.equal(copy.mode, 'surf');
});
