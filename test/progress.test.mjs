import test from 'node:test';
import assert from 'node:assert/strict';
import {
  levelOf,
  levelCost,
  unlocksAt,
  freshSave,
  cleanSave,
  addSilk,
  climbReward,
  recordSpout,
  goalsFor,
  track,
  rollDay,
  prevDay,
  chestSilk,
  wornLook,
  owns,
  SLOTS,
  HAT_LIST,
  SILK,
  MAX_LEVEL,
  weekOf,
  weekGoalFor,
  WEEK_KINDS,
} from '../src/progress.js';

test('levels: each costs more than the last, and every level up to 31 unlocks something', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(levelCost(1) - 1).level, 1);
  assert.equal(levelOf(levelCost(1)).level, 2);
  for (let n = 2; n < MAX_LEVEL; n++) assert.ok(levelCost(n) > levelCost(n - 1));
  for (let l = 2; l <= 31; l++) assert.ok(unlocksAt(l).length >= 1, `level ${l} unlocks nothing`);
  const top = levelOf(1e9);
  assert.equal(top.level, MAX_LEVEL);
  assert.ok(top.max);
});

test('addSilk reports every level gained and what each unlocks', () => {
  const s = freshSave();
  const r = addSilk(s, levelCost(1) + levelCost(2) + 5);
  assert.equal(r.before, 1);
  assert.equal(r.after, 3);
  assert.deepEqual(
    r.levels.map((l) => l.level),
    [2, 3],
  );
  assert.ok(r.levels[0].unlocks.length > 0);
  assert.equal(levelOf(s.silk).into, 5);
});

test('a save from storage is cleaned: junk dropped, numbers bounded, v1 records carried over', () => {
  assert.deepEqual(cleanSave(null), freshSave());
  assert.deepEqual(cleanSave('nope'), freshSave());
  const s = cleanSave({ open: 99, silk: -5, stars: { 3: 2 }, best: { 3: 31.5 }, n: { wins: 'x', held: 12 }, look: { color: { evil: 1 } }, seen: { a: 2 }, day: { key: '2026-11-01', goals: [{ kind: 'nope' }, { kind: 'flies', n: 5, have: 2 }] } });
  assert.equal(s.open, 12);
  assert.equal(s.silk, 0);
  assert.deepEqual(s.spouts[3], { best: 31.5, stars: 2, flies: 0, gold: false });
  assert.equal(s.n.wins, 0);
  assert.equal(s.n.held, 12);
  assert.equal(s.look.color, 'gold');
  assert.equal(s.day.goals.length, 1);
  assert.equal(s.day.goals[0].kind, 'flies');
});

test('the worn look falls back to owned items', () => {
  const s = freshSave();
  s.look = { species: 'tarantula', color: 'jade', mark: 'stripes', hat: 'crown', trail: 'rainbow', dance: 'flip' };
  const look = wornLook(s);
  assert.equal(look.species, 'jumper');
  assert.equal(look.colorId, 'gold');
  assert.equal(look.mark, 'stripes');
  assert.equal(look.hat, 'none');
  s.n.cups = 1;
  assert.ok(owns(s, HAT_LIST.find((h) => h.id === 'crown')));
  assert.equal(wornLook(s).hat, 'crown');
  for (const slot of SLOTS) assert.ok(owns(freshSave(), slot.items[0]), `${slot.id} starts with nothing`);
});

test('a climb earns silk for everything done in it', () => {
  const r = climbReward({ kind: 'solo', spout: 3, finished: true, newStars: 2, flies: 5, gold: true, perfect: 4, swings: 40 });
  const want = SILK.top + SILK.perSpout * 3 + 2 * SILK.star + 5 * SILK.fly + SILK.gold + 4 * SILK.perfect + SILK.swingCap;
  assert.equal(r.total, want);
  const race = climbReward({ kind: 'race', spout: 1, finished: true, place: 1 });
  assert.equal(race.total, SILK.top + SILK.perSpout + SILK.place[0]);
  assert.equal(climbReward({ kind: 'monsoon', metres: 50 }).total, Math.round(50 * SILK.metre));
});

test('spout records keep the best of everything', () => {
  const s = freshSave();
  let r = recordSpout(s, { spout: 2, time: 40, stars: 1, fliesMask: 0b101, gold: false });
  assert.ok(r.newBest);
  assert.equal(r.newStars, 1);
  assert.equal(r.newFlies, 2);
  assert.equal(s.open, 3);
  r = recordSpout(s, { spout: 2, time: 45, stars: 3, fliesMask: 0b110, gold: true });
  assert.ok(!r.newBest);
  assert.equal(r.newStars, 2);
  assert.equal(r.newFlies, 1);
  assert.ok(r.newGold);
  assert.deepEqual(s.spouts[2], { best: 40, stars: 3, flies: 0b111, gold: true });
});

test('goals of the day: three different kinds, the same for everyone that day', () => {
  const a = goalsFor('2026-11-01');
  assert.deepEqual(a, goalsFor('2026-11-01'));
  assert.equal(new Set(a.map((g) => g.kind)).size, 3);
  let differs = false;
  for (let d = 2; d < 9; d++) if (JSON.stringify(goalsFor(`2026-11-0${d}`)) !== JSON.stringify(a)) differs = true;
  assert.ok(differs);
});

test('tracking finishes goals, opens the chest once, and keeps the streak', () => {
  const s = freshSave();
  const day = '2026-11-01';
  rollDay(s, day);
  s.day.goals = [
    { kind: 'flies', n: 3, have: 0, done: false },
    { kind: 'monsoon', n: 40, have: 0, done: false },
    { kind: 'climb', n: 1, have: 0, done: false },
  ];
  let r = track(s, 'flies', 2, day);
  assert.equal(r.done.length, 0);
  r = track(s, 'flies', 2, day);
  assert.equal(r.done.length, 1);
  assert.equal(r.silk, SILK.goal);
  assert.equal(s.streak.n, 1);
  track(s, 'monsoon', 30, day);
  r = track(s, 'monsoon', 25, day);
  assert.equal(r.done.length, 0, 'a best-kind goal keeps the best, it does not add');
  r = track(s, 'climb', 1, day);
  assert.ok(!r.chest);
  r = track(s, 'monsoon', 45, day);
  assert.ok(r.chest);
  assert.equal(r.silk, SILK.goal + chestSilk(1));
  r = track(s, 'flies', 5, day);
  assert.ok(!r.chest, 'one chest a day');
  // the next day: new goals, streak 2 on the first one done
  const next = '2026-11-02';
  rollDay(s, next);
  assert.equal(s.day.key, next);
  s.day.goals[0] = { kind: 'flies', n: 1, have: 0, done: false };
  track(s, 'flies', 1, next);
  assert.equal(s.streak.n, 2);
  // a missed day breaks it
  rollDay(s, '2026-11-04');
  assert.equal(s.streak.n, 0);
  assert.equal(s.streak.best, 2);
  assert.equal(prevDay('2026-03-01'), '2026-02-28');
  assert.ok(chestSilk(8) > chestSilk(1));
  assert.equal(chestSilk(20), chestSilk(8));
});

test('the best combo of a climb pays silk from ×3, capped', () => {
  assert.equal(climbReward({ kind: 'solo', spout: 1, finished: true, combo: 2 }).total, SILK.top + SILK.perSpout);
  const r = climbReward({ kind: 'solo', spout: 1, finished: true, combo: 7 });
  assert.equal(r.total, SILK.top + SILK.perSpout + 7 * SILK.combo);
  assert.ok(r.lines.some((l) => l.label === 'Best combo ×7'));
  assert.equal(climbReward({ kind: 'monsoon', metres: 0, combo: 500 }).total, SILK.comboCap);
});

test('the goal of the week: Monday to Sunday, the same for everyone, paid once', () => {
  assert.equal(weekOf('2026-11-02'), '2026-11-02'); // a Monday
  assert.equal(weekOf('2026-11-08'), '2026-11-02'); // that Sunday
  assert.equal(weekOf('2026-11-09'), '2026-11-09');
  assert.equal(weekOf('2026-03-01'), '2026-02-23');
  const g = weekGoalFor('2026-11-02');
  assert.deepEqual(g, weekGoalFor('2026-11-02'));
  assert.ok(WEEK_KINDS[g.kind]);
  const s = freshSave();
  rollDay(s, '2026-11-03');
  assert.equal(s.week.key, '2026-11-02');
  s.week.goal = { kind: 'flies', n: 10, have: 0, done: false };
  s.day.goals = [];
  let r = track(s, 'flies', 6, '2026-11-03');
  assert.equal(r.week, null);
  r = track(s, 'flies', 6, '2026-11-04');
  assert.ok(r.week);
  assert.equal(r.silk, SILK.week);
  r = track(s, 'flies', 6, '2026-11-05');
  assert.equal(r.week, null, 'paid once');
  // a save carries it, junk is dropped
  assert.deepEqual(cleanSave(JSON.parse(JSON.stringify(s))).week, s.week);
  assert.equal(cleanSave({ week: { key: 'x', goal: { kind: 'evil', n: 3 } } }).week.goal, null);
  // the next Monday brings a new one
  rollDay(s, '2026-11-09');
  assert.equal(s.week.key, '2026-11-09');
  assert.equal(s.week.goal.done, false);
});
