import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOUTS, CUPS } from '../src/sim/spouts.js';
import { buildLevel, sampleAt, inPocket, centerX, raycast } from '../src/sim/level.js';
import { createSpider, step, startS } from '../src/sim/spider.js';
import { HALF, R } from '../src/sim/config.js';

const dry = { water: () => null, wetRaw: () => false, lift: () => false };

test('twelve spouts in four cups, climbing in height', () => {
  assert.equal(SPOUTS.length, 12);
  assert.deepEqual(CUPS.flatMap((c) => c.spouts), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  let last = 0;
  for (const def of SPOUTS) {
    const L = buildLevel(def.pieces);
    assert.ok(L.H >= 2900 && L.H <= 8200, `${def.name} is ${L.H}`);
    assert.ok(L.H >= last - 120, `${def.name} should not be shorter than the spout before`);
    last = L.H;
  }
});

test('every path is clean: no zero or backwards segments, normals point into the pipe', () => {
  for (const def of SPOUTS) {
    const level = buildLevel(def.pieces);
    const { path } = level;
    for (let i = 0; i < path.n - 1; i++) {
      const len = path.cum[i + 1] - path.cum[i];
      assert.ok(len > 1e-3, `${def.name}: zero-length segment ${i}`);
      assert.ok(Number.isFinite(path.x[i]) && Number.isFinite(path.y[i]));
    }
    // Midway up, a point offset along the normal from a wall is inside the pipe.
    for (let s = 50; s < path.length - 50; s += 97) {
      const p = sampleAt(path, s, {});
      if (p.y >= level.H) continue; // the gutter runs along the roof
      const cx = centerX(level, p.y);
      assert.ok(Math.abs(p.x - cx) < HALF + 80, `${def.name}: path point far outside at s=${s}`);
    }
  }
});

test('every dry pocket lies on the walking path', () => {
  for (const def of SPOUTS) {
    const L = buildLevel(def.pieces);
    const reached = new Set(L.pocketAnchors.map((a) => a.k));
    for (let k = 0; k < L.pockets.length; k++) assert.ok(reached.has(k), `${def.name}: pocket ${k} is off the path`);
    for (const a of L.pocketAnchors) assert.ok(inPocket(L, a.x, a.y));
  }
});

test('Up alone climbs every spout to the sun on a dry day', () => {
  for (const def of SPOUTS) {
    const L = buildLevel(def.pieces);
    const sp = createSpider(L, startS(L, -40));
    let t = 0;
    while (sp.mode !== 'done' && t < 120) {
      step(sp, L, dry, { x: 0, y: 1, jump: false, hold: false }, t, 1 / 120);
      sp.events.length = 0;
      t += 1 / 120;
    }
    assert.equal(sp.mode, 'done', `${def.name}: stuck at ${sp.y.toFixed(0)}`);
    assert.ok(t > L.H / 160 && t < L.H / 100, `${def.name}: ${t.toFixed(1)} s`);
  }
});

test('the drain floor sends Up toward the nearer wall, walls lead up', () => {
  const L = buildLevel(SPOUTS[0].pieces);
  const left = sampleAt(L.path, startS(L, -40), {});
  const right = sampleAt(L.path, startS(L, 40), {});
  assert.equal(left.y, R);
  // Going the "up" way from either side of the floor raises the spider.
  for (const p of [left, right]) {
    const sp = createSpider(L, startS(L, p.x));
    for (let i = 0; i < 240; i++) step(sp, L, dry, { x: 0, y: 1, jump: false, hold: false }, i / 120, 1 / 120);
    assert.ok(sp.y > 150);
  }
});

test('a ray across the pipe hits the far wall from the inside only', () => {
  const L = buildLevel(SPOUTS[0].pieces);
  const hit = raycast(L, -40, 300, 200, 300);
  assert.ok(hit);
  assert.ok(Math.abs(hit.x - (HALF - R)) < 0.5);
  assert.ok(hit.nx < -0.9);
  // From outside the free space going out: nothing.
  assert.equal(raycast(L, 0, 300, 0, 310), null);
});
