import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWeather, rainAt, arrival, makeWorld, birdAt, pecked, debrisIn, SURGE, GENTLE_FLUSH } from '../src/sim/weather.js';
import { SPOUTS } from '../src/sim/spouts.js';
import { levelFor, weatherFor } from '../src/sim/race.js';
import { GRIP_MAX, FRONT_SPEED, WARN } from '../src/sim/config.js';
import { inPocket, centerX } from '../src/sim/level.js';

test('the same seed gives the same rain on every page', () => {
  const a = weatherFor(7, 1234);
  const b = weatherFor(7, 1234);
  assert.deepEqual(a, b);
  assert.notDeepEqual(weatherFor(7, 1235).waves, a.waves);
});

test('every wave is warned at least 2 s ahead, the first two are gentle, flushes fit a full grip', () => {
  for (const def of SPOUTS) {
    for (let seed = 1; seed <= 40; seed++) {
      const w = weatherFor(def.id, seed);
      assert.ok(w.waves.length > 10);
      let prevSurge = false;
      w.waves.forEach((wave, i) => {
        assert.ok(wave.warn >= WARN);
        if (i < 2) {
          assert.equal(wave.kind, 'single');
          assert.equal(wave.parts[0][1], GENTLE_FLUSH);
          assert.ok(wave.warn >= 3);
        }
        if (wave.kind === 'single') assert.ok(wave.end <= 2.5 && wave.end < GRIP_MAX);
        if (wave.kind === 'surge') {
          assert.equal(wave.end, SURGE);
          assert.ok(!prevSurge, 'never two surges in a row');
          assert.ok(wave.warn >= 3);
        }
        if (wave.kind === 'double') {
          const [a, b] = wave.parts;
          assert.ok(a[1] < GRIP_MAX && b[1] - b[0] < GRIP_MAX && b[0] - a[1] >= 0.9);
        }
        prevSurge = wave.kind === 'surge';
        if (i > 0) {
          const before = w.waves[i - 1];
          assert.ok(wave.t0 - wave.warn > before.t0 + before.end + 1, 'some sun between waves');
        }
      });
      if (def.rain.surges === 0) assert.ok(w.waves.every((x) => x.kind !== 'surge'));
    }
  }
});

test('water reaches the top first and travels down the pipe', () => {
  const w = weatherFor(1, 9);
  const wave = w.waves[0];
  const top = wave.top;
  assert.equal(arrival(wave, top), wave.t0);
  assert.ok(Math.abs(arrival(wave, top - FRONT_SPEED) - (wave.t0 + 1)) < 1e-9);
  const r = rainAt(w, top - 900, wave.t0 + 0.5 + 0.1, {});
  assert.equal(r.wet, true);
  const before = rainAt(w, top - 900, wave.t0 + 0.4, {});
  assert.equal(before.wet, false);
  assert.ok(before.warn === wave && before.next > 0 && before.next < 0.2);
  // Above the gutter there is no water.
  assert.equal(rainAt(w, top + 50, wave.t0 + 0.1, {}).wet, false);
});

test('dry pockets stay dry while the pipe floods', () => {
  for (const def of SPOUTS) {
    const L = levelFor(def.id);
    const w = weatherFor(def.id, 3, L);
    const world = makeWorld(L, w);
    for (const a of L.pocketAnchors) {
      const wave = w.waves[3];
      const t = arrival(wave, a.y) + 0.3;
      assert.equal(world.wetRaw(a.y, t), true);
      assert.equal(world.water(a.x, a.y, t), null, `${def.name}: pocket at ${a.y} is wet`);
      assert.ok(inPocket(L, a.x, a.y));
    }
  }
});

test('the bird pecks on a 3.2 s rhythm, and only near its seam', () => {
  const seam = { side: 'L', y: 1000, x: 0 };
  const phases = new Set();
  let pecks = 0;
  const L = levelFor(1);
  for (let t = 0; t < 3.2; t += 0.01) {
    const b = birdAt(seam, 5, t, {});
    phases.add(b.phase);
    if (pecked(L, seam, 5, t, -85 + 30, 1000)) pecks++;
    assert.equal(pecked(L, seam, 5, t, 85 - 12, 1000), false, 'the far wall is safe');
    assert.equal(pecked(L, seam, 5, t, -85 + 12, 1100), false, 'well above the seam is safe');
  }
  assert.deepEqual([...phases].sort(), ['back', 'look', 'peck', 'windup']);
  assert.ok(pecks > 5 && pecks < 40);
});

test('debris falls in its lane, along the wall', () => {
  const w = weatherFor(4, 2);
  assert.ok(w.debris.length > 20);
  const L = levelFor(4);
  const d = w.debris[0];
  const list = debrisIn(L, w, 0, L.H, d.t0 + 1, []);
  const item = list.find((x) => x.d === d);
  assert.ok(item);
  assert.ok(Math.abs(item.y - (d.top - 520)) < 1);
  assert.equal(Math.sign(item.x - centerX(L, item.y)), d.lane === 'L' ? -1 : 1);
});

test('makeWeather with no doubles or surges only makes singles', () => {
  const w = makeWeather({ top: 3000, rain: { calm: [5, 6], flush: [1.5, 1.6] }, seed: 2 });
  assert.ok(w.waves.every((x) => x.kind === 'single'));
});
