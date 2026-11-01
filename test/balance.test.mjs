// Balance: the numbers in DESIGN.md hold when bots play whole races and cups.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateRace, botSkills, rankRace, pointsFor, cupOrder } from '../src/sim/race.js';
import { SPOUTS, CUPS, STAR_TIMES, starsFor } from '../src/sim/spouts.js';
import { BOT_NAMES } from '../src/sim/bot.js';

const median = (list) => {
  const a = list.slice().sort((x, y) => x - y);
  return a[a.length >> 1];
};

function soloTimes(id, skill, seeds, name = 'Twig') {
  const out = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const r = simulateRace(id, seed * 7 + 1, [{ id: 'a', name, skill, bot: true }], { close: 0, cap: 400 });
    out.push(r.times.a ?? 400);
    for (const v of Object.values(r.heights)) assert.ok(Number.isFinite(v), 'no NaN');
  }
  return out;
}

test('every cup bot finishes every spout of its cup, races end in time, nothing goes NaN', () => {
  for (const cup of CUPS) {
    const skills = botSkills(cup.bots, 5);
    for (const id of cup.spouts) {
      let finished = 0;
      let total = 0;
      for (let seed = 1; seed <= 5; seed++) {
        const entrants = skills.map((skill, i) => ({ id: `bot:${i}`, name: BOT_NAMES[(i + seed) % BOT_NAMES.length], skill, bot: true }));
        const r = simulateRace(id, seed, entrants, { close: 0, cap: 300 });
        total += entrants.length;
        finished += Object.keys(r.times).length;
        for (const s of r.race.racers) {
          assert.ok(Number.isFinite(s.sp.x) && Number.isFinite(s.sp.y) && s.sp.grip >= 0, 'sane spider');
        }
        // The winner's race fits the designed length.
        const best = Math.min(...Object.values(r.times));
        assert.ok(best > 12 && best < 150, `spout ${id}: winner took ${best}`);
      }
      assert.ok(finished / total >= 0.9, `spout ${id}: only ${finished}/${total} finished`);
    }
  }
});

test('skill orders finishing times', () => {
  for (const def of SPOUTS) {
    const weak = median(soloTimes(def.id, 0.25, 5));
    const mid = median(soloTimes(def.id, 0.55, 5));
    const sharp = median(soloTimes(def.id, 0.95, 5));
    assert.ok(sharp <= mid + 2 && mid < weak, `${def.name}: ${sharp} / ${mid} / ${weak}`);
  }
});

test('star times are fair: the sharpest bots reach gold often, middling bots reach silver', () => {
  for (const def of SPOUTS) {
    const [silver, gold] = STAR_TIMES[def.id];
    assert.ok(gold < silver);
    const sharp = soloTimes(def.id, 0.9, 8);
    const golds = sharp.filter((t) => starsFor(def.id, t) === 3).length;
    assert.ok(golds >= 2, `${def.name}: gold reached ${golds}/8`);
    const mid = soloTimes(def.id, 0.5, 8);
    assert.ok(mid.filter((t) => starsFor(def.id, t) >= 2).length >= 2, `${def.name}: silver too hard`);
  }
});

test('a beginner beats the weakest bot of the first race', () => {
  const beginner = median(soloTimes(1, 0.2, 9, 'Nettle'));
  const weakest = median(soloTimes(1, CUPS[0].bots[0], 9, 'Inch'));
  assert.ok(beginner < weakest, `${beginner} vs ${weakest}`);
});

test('no runaway leader: among equal bots, the leader after two races still loses some cups', () => {
  let leaderLost = 0;
  const cups = 14;
  for (let c = 0; c < cups; c++) {
    const entrants = ['Nettle', 'Pocket', 'Twig', 'Bramble', 'Juniper', 'Hopper'].map((name, i) => ({ id: `b${i}`, name, skill: 0.6, bot: true }));
    const scores = Object.fromEntries(entrants.map((e) => [e.id, 0]));
    let leader = null;
    let last = [];
    CUPS[c % 4].spouts.forEach((id, round) => {
      const r = simulateRace(id, c * 31 + round, entrants, { close: 20, cap: 240 });
      last = rankRace(entrants.map((e) => e.id), r.times, r.heights);
      const pts = pointsFor(last);
      for (const [k, v] of Object.entries(pts)) scores[k] += v;
      if (round === 1) leader = cupOrder(scores, last)[0];
    });
    if (cupOrder(scores, last)[0] !== leader) leaderLost++;
  }
  assert.ok(leaderLost >= 2, `the leader after two races won ${cups - leaderLost} of ${cups}`);
});
