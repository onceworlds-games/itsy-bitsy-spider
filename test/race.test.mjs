import test from 'node:test';
import assert from 'node:assert/strict';
import { rankRace, pointsFor, cupOrder, botSkills, startXs, applyHazards } from '../src/sim/race.js';
import { createRun, stepOnce, syncAll, advance } from '../src/sim/run.js';
import { createBrain, think } from '../src/sim/bot.js';
import { STEP } from '../src/sim/config.js';
import { POINTS } from '../src/sim/config.js';
import { packGhost, unpackGhost, createRecorder, record, ghostAt } from '../src/sim/ghost.js';
import { knock, snagFor } from '../src/sim/spider.js';

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
  assert.ok(startXs(6).every((x) => Math.abs(x) <= 100 - 30));
});

test('a jump into a racer knocks it, once a second at most', () => {
  const run = createRun({ kind: 'solo', spout: 1, seed: 1, seats: [{ id: 'a', name: 'A', bot: true, skill: 0.5 }, { id: 'b', name: 'B', bot: true, skill: 0.5 }] });
  const [a, b] = run.racers;
  let knocks = 0;
  const hooks = { onKnock: () => knocks++ };
  // b stands on the left wall; a drops onto it.
  a.sp.mode = 'air';
  a.sp.x = b.sp.x;
  a.sp.y = b.sp.y + 10;
  a.sp.vx = 0;
  a.sp.vy = 0;
  stepOnce(run, null, hooks);
  assert.ok(b.sp.mode === 'tumble' || knocks === 1, 'knocked');
  assert.equal(knock(b.sp, 1, 1, 'bump'), false, 'immune for a second');
});

test('falling debris knocks a walker, bounces off a holder', () => {
  const run = createRun({ kind: 'solo', spout: 4, seed: 3, seats: [{ id: 'a', name: 'A', me: true }] });
  const sp = run.racers[0].sp;
  const d = run.weather.debris[0];
  assert.ok(d, 'the Barn drops caps');
  const t = d.t0 + 2;
  sp.mode = 'surf';
  sp.x = d.lane === 'L' ? -85 + 17 : 85 - 17;
  sp.y = d.top - 520 * 2;
  assert.equal(applyHazards(sp, run.level, run.weather, t, 3, { debris: -1, bird: 0 }), 'debris');
  sp.mode = 'surf';
  sp.holding = true;
  sp.immune = 0;
  assert.equal(applyHazards(sp, run.level, run.weather, t, 3, { debris: -1, bird: 0 }), '');
});

test('flies: eaten once each, a short burst of speed, the golden one counted', () => {
  const run = createRun({ kind: 'solo', spout: 1, seed: 1, seats: [{ id: 'me', name: 'Me', me: true }] });
  const me = run.racers[0];
  const fl = run.level.flies;
  const gold = fl.find((f) => f.gold);
  assert.ok(gold && fl.filter((f) => f.gold).length === 1);
  const eaten = [];
  for (const f of [fl[0], fl[0], gold]) {
    me.sp.mode = 'air';
    me.sp.x = f.x;
    me.sp.y = f.y;
    me.sp.vx = 0;
    me.sp.vy = 0;
    stepOnce(run, { x: 0, y: 0, jump: false, jumpHeld: false, hold: false }, { onFly: (r, fly) => eaten.push(fly) });
  }
  assert.deepEqual(
    eaten.map((f) => f.id),
    [fl[0].id, gold.id],
  );
  assert.equal(me.sp.stats.flies, 2);
  assert.ok(me.sp.boost > 0);
});

test('silk: Jump in the air near a bolt swings from it; letting go flings you on', () => {
  const run = createRun({ kind: 'solo', spout: 3, seed: 1, seats: [{ id: 'me', name: 'Me', me: true }] });
  const sp = run.racers[0].sp;
  const sn = run.level.snags[0];
  sp.mode = 'air';
  sp.x = sn.x - 90;
  sp.y = sn.y - 110;
  sp.vx = 200;
  sp.vy = 200;
  assert.ok(snagFor(sp, run.level, null) >= 0, 'a bolt in reach');
  stepOnce(run, { x: 1, y: 0, jump: true, jumpHeld: true, hold: false }, {});
  assert.equal(sp.mode, 'swing');
  assert.equal(sp.stats.swings, 1);
  for (let i = 0; i < 30; i++) stepOnce(run, { x: 1, y: 0, jump: false, jumpHeld: true, hold: false }, {});
  assert.equal(sp.mode, 'swing');
  assert.ok(Math.hypot(sp.x - sn.x, sp.y - sn.y) <= Math.hypot(90, 110) + 1, 'the silk reels in');
  stepOnce(run, { x: 1, y: 0, jump: false, jumpHeld: false, hold: false }, {});
  stepOnce(run, { x: 1, y: 0, jump: false, jumpHeld: false, hold: false }, {});
  assert.equal(sp.mode, 'air');
});

test('an online race: every page simulates its own spider and the bots it hosts, nothing else', () => {
  const seats = [
    { id: 'me', name: 'Me', me: true, index: 0 },
    { id: 'p2', name: 'Other', index: 1 },
    { id: 'bot:0', name: 'Twig', bot: true, skill: 0.6, index: 2 },
  ];
  const host = createRun({ kind: 'race', spout: 2, seed: 5, seats });
  const guest = createRun({ kind: 'race', spout: 2, seed: 5, seats, simBots: false });
  assert.ok(host.racers[2].sp && host.racers[1].sp === null);
  for (let i = 0; i < 240; i++) {
    stepOnce(host, { x: 0, y: 1, jump: false, jumpHeld: false, hold: false }, {});
    stepOnce(guest, { x: 0, y: 1, jump: false, jumpHeld: false, hold: false }, {});
    host.t += 1 / 120;
    guest.t += 1 / 120;
  }
  syncAll(host);
  syncAll(guest);
  assert.ok(host.racers[2].st.y > 200, 'the host climbs its bots');
  assert.ok(guest.racers[2].st.y < 50, 'a guest waits for the host');
  assert.ok(Math.abs(host.me.st.y - guest.me.st.y) < 1, 'the same input climbs the same on every page');
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

test('a steering function drives the player every step, as sharp as the sharpest bot (the trailer autopilot)', () => {
  const seats = [
    { id: 'me', name: 'Me', me: true, index: 0 },
    { id: 'bot:0', name: 'Mabel', bot: true, skill: 0.95, index: 1 },
  ];
  const run = createRun({ kind: 'race', spout: 1, seed: 7, seats });
  const brain = createBrain('Juniper', 0.97, 'auto:test');
  const steer = (r, t) => think(brain, r.sp, run.level, run.weather, t, STEP, run.seed, run.world);
  // a page at 30 frames a second: four steps per call
  while (!run.me.finish && run.t < 120) advance(run, run.t + 1 / 30, steer);
  assert.ok(run.me.finish, 'the autopilot reaches the sun');
  const bot = run.racers[1];
  while (!bot.finish && run.t < 160) advance(run, run.t + 1 / 30, null);
  assert.ok(run.me.finish < (bot.finish ?? 999) * 1.35, `autopilot ${run.me.finish.toFixed(1)} s vs bot ${bot.finish?.toFixed(1)} s`);
});
