import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonsoon, monsoonPieces, dayKey, daySeed, floodSpeed, MONSOON_TOP } from '../src/sim/monsoon.js';
import { buildLevel, inPocket } from '../src/sim/level.js';
import { createSpider, step, startS } from '../src/sim/spider.js';
import { createBrain, think } from '../src/sim/bot.js';
import { applyHazards } from '../src/sim/race.js';

test('today is one spout for everyone', () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 1, 23, 59)), '2026-11-01');
  assert.equal(daySeed('2026-11-01'), daySeed('2026-11-01'));
  assert.notEqual(daySeed('2026-11-01'), daySeed('2026-11-02'));
  assert.deepEqual(monsoonPieces(daySeed('2026-11-01')), monsoonPieces(daySeed('2026-11-01')));
});

test('Monsoon spouts are valid for many seeds: clean paths, pockets on the path, near the middle', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const L = buildLevel(monsoonPieces(seed));
    assert.ok(L.H > MONSOON_TOP - 1500);
    for (let i = 0; i < L.path.n - 1; i++) assert.ok(L.path.cum[i + 1] - L.path.cum[i] > 1e-3);
    for (const a of L.pocketAnchors) assert.ok(inPocket(L, a.x, a.y));
    for (const c of L.center) assert.ok(Math.abs(c[0]) <= 300, `pipe wandered to ${c[0]}`);
    // Flies all the way up, a golden one every 50 m or so, twigs to land on, bolts to swing from.
    const gold = L.flies.filter((f) => f.gold);
    assert.ok(gold.length >= 15, `${gold.length} golden flies`);
    for (let i = 1; i < gold.length; i++) assert.ok(gold[i].y - gold[i - 1].y < 6500);
    assert.ok(L.flies.length > 200 && L.islands.length > 60 && L.snags.length > 20);
  }
});

test('the flood speeds up with height and has a ceiling', () => {
  assert.equal(floodSpeed(-300), 70);
  assert.ok(floodSpeed(10000) > floodSpeed(0));
  assert.equal(floodSpeed(1e7), 160);
});

function runBot(seed, skill) {
  const run = createMonsoon(seed);
  const sp = createSpider(run.level, startS(run.level, -40));
  const brain = createBrain('Twig', skill, seed);
  const memo = { debris: -1, bird: 0 };
  let t = 0;
  const dt = 1 / 120;
  while (t < 1500) {
    run.advance(t, dt, sp.y);
    step(sp, run.level, run.world, think(brain, sp, run.level, run.weather, t, dt, seed), t, dt);
    applyHazards(sp, run.level, run.weather, t, seed, memo);
    sp.events.length = 0;
    assert.ok(Number.isFinite(sp.y));
    if (sp.y < run.flood) break;
    t += dt;
  }
  return { m: sp.y / 100, t };
}

test('the flood catches everyone, and better climbers get higher', () => {
  const avg = (skill) => {
    let sum = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const r = runBot(seed, skill);
      assert.ok(r.t < 1500, 'the run ends');
      sum += r.m;
    }
    return sum / 3;
  };
  const low = avg(0.15);
  const high = avg(0.9);
  assert.ok(low > 15 && low < 100, `weak climber ${low} m`);
  assert.ok(high > low + 50, `sharp climber ${high} m vs ${low} m`);
});
