import test from 'node:test';
import assert from 'node:assert/strict';
import { rankRace, pointsFor, cupOrder, botSkills, startXs, createRace, stepBots, applyHazards } from '../src/sim/race.js';
import { POINTS } from '../src/sim/config.js';
import { packGhost, unpackGhost, createRecorder, record, ghostAt } from '../src/sim/ghost.js';
import { knock } from '../src/sim/spider.js';

test('finishers by time, the rest by height, ties share a place', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const ranking = rankRace(ids, { a: 40.2, b: 38.1, c: 40.2 }, { a: 3000, b: 3000, c: 3000, d: 1200, e: 1500 });
  assert.deepEqual(ranking, [['b'], ['a', 'c'], ['e'], ['d']]);
  const pts = pointsFor(ranking);
  assert.deepEqual(pts, { b: POINTS[0], a: POINTS[1], c: POINTS[1], e: POINTS[3], d: POINTS[4] });
});

test('the cup goes to the most points, then the better last race', () => {
  assert.deepEqual(cupOrder({ a: 20, b: 20, c: 5 }, [['b'], ['a'], ['c']]), ['b', 'a', 'c']);
  assert.deepEqual(cupOrder({ a: 21, b: 20 }, [['b'], ['a']]), ['a', 'b']);
});

test('bot skills spread evenly over the cup range', () => {
  assert.deepEqual(botSkills([0, 0.5], 3), [0, 0.25, 0.5]);
  assert.deepEqual(botSkills([0.4, 0.9], 1), [0.65]);
  assert.deepEqual(botSkills([0.4, 0.9], 0), []);
  assert.equal(startXs(6).length, 6);
  assert.ok(startXs(6).every((x) => Math.abs(x) <= 60));
});

test('a jump into a racer knocks it, once a second at most', () => {
  const race = createRace(1, 1, [
    { id: 'a', name: 'A', skill: 0.5, bot: true },
    { id: 'b', name: 'B', skill: 0.5, bot: true },
  ]);
  const [a, b] = race.racers;
  a.sp.mode = 'air';
  a.sp.x = b.sp.x;
  a.sp.y = b.sp.y + 10;
  a.sp.vx = 0;
  a.sp.vy = 0;
  let calls = 0;
  stepBots(race, 1 / 120, () => calls++);
  assert.ok(b.sp.mode === 'tumble' || b.sp.immune > 0 || calls === 0);
  assert.equal(knock(b.sp, 1, 1, 'bump'), false, 'immune for a second');
});

test('falling debris knocks a walker, bounces off a holder', () => {
  const race = createRace(4, 3, [{ id: 'a', name: 'A', skill: 0.5, bot: false }]);
  const sp = race.racers[0].sp;
  const d = race.weather.debris[0];
  // Put the spider in the debris' path when it arrives.
  const t = d.t0 + 2;
  const y = d.top - 520 * 2;
  sp.mode = 'surf';
  sp.x = d.lane === 'L' ? -85 + 17 : 85 - 17;
  sp.y = y;
  const memo = { debris: -1, bird: 0 };
  assert.equal(applyHazards(sp, race.level, race.weather, t, 3, memo), 'debris');
  sp.mode = 'surf';
  sp.holding = true;
  sp.immune = 0;
  const memo2 = { debris: -1, bird: 0 };
  assert.equal(applyHazards(sp, race.level, race.weather, t, 3, memo2), '');
});

test('ghosts pack small and play back where the run went', () => {
  const rec = createRecorder();
  for (let i = 0; i < 1200; i++) record(rec, 1 / 60, Math.sin(i / 50) * 70, i * 2, i % 360, 0);
  const packed = packGhost(rec, 20);
  assert.ok(JSON.stringify(packed).length < 20000);
  const g = unpackGhost(JSON.parse(JSON.stringify(packed)));
  assert.ok(g);
  const at = ghostAt(g, 10, {});
  assert.ok(Math.abs(at.y - 1200) < 30);
  assert.equal(unpackGhost({ v: 1, d: 'x,1' }), null);
  assert.equal(unpackGhost(null), null);
});
