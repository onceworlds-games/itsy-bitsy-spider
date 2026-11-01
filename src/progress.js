// Everything a player keeps: silk (earned by everything you do) and the spider level it makes, the wardrobe it unlocks,
// each spout's records (time, stars, flies, the golden fly), three goals a day with a chest, and the day streak. Pure: the
// page saves and loads the object, this module only reads and changes it.

import { makeRng } from './sim/rng.js';

// ------------------------------------------------------------------------------------------- the wardrobe

/** Every item, and the level that unlocks it (or the feat that does, for a few). */
export const COLORS = [
  { id: 'gold', hex: '#FFB648', name: 'Gold', level: 1 },
  { id: 'coral', hex: '#FF6F59', name: 'Coral', level: 1 },
  { id: 'leaf', hex: '#9BD35A', name: 'Leaf', level: 1 },
  { id: 'sky', hex: '#5CC8FF', name: 'Sky', level: 2 },
  { id: 'rose', hex: '#FF8FB1', name: 'Rose', level: 3 },
  { id: 'bone', hex: '#EDE4D3', name: 'Bone', level: 4 },
  { id: 'mint', hex: '#62E0B4', name: 'Mint', level: 6 },
  { id: 'violet', hex: '#A88BFF', name: 'Violet', level: 7 },
  { id: 'ember', hex: '#FF8A2A', name: 'Ember', level: 9 },
  { id: 'ink', hex: '#3B4250', name: 'Ink', level: 12 },
  { id: 'teal', hex: '#22A9B5', name: 'Teal', level: 14 },
  { id: 'sunflower', hex: '#FFE14D', name: 'Sunflower', level: 17 },
  { id: 'plum', hex: '#8E3B7A', name: 'Plum', level: 20 },
  { id: 'frost', hex: '#CFE8FF', name: 'Frost', level: 23 },
  { id: 'cherry', hex: '#D7263D', name: 'Cherry', level: 27 },
  { id: 'moss', hex: '#7C9A3A', name: 'Moss', level: 21 },
  { id: 'storm', hex: '#6E7F99', name: 'Storm', level: 26 },
  { id: 'peach', hex: '#FFB38A', name: 'Peach', level: 29 },
  { id: 'jade', hex: '#2E8B57', name: 'Jade', level: 31 },
];
export const MARKS = [
  { id: 'ring', name: 'Ring', level: 1 },
  { id: 'stripes', name: 'Stripes', level: 1 },
  { id: 'dots', name: 'Dots', level: 2 },
  { id: 'chevron', name: 'Chevron', level: 3 },
  { id: 'diamond', name: 'Diamond', level: 5 },
  { id: 'star', name: 'Star', level: 8 },
  { id: 'band', name: 'Band', level: 11 },
  { id: 'spots', name: 'Spots', level: 13 },
  { id: 'web', name: 'Web', level: 24 },
];
export const SPECIES_LIST = [
  { id: 'jumper', name: 'Jumper', level: 1 },
  { id: 'peacock', name: 'Peacock', level: 5 },
  { id: 'orb', name: 'Orb Weaver', level: 10 },
  { id: 'tarantula', name: 'Tarantula', level: 16 },
  { id: 'longlegs', name: 'Longlegs', level: 22 },
];
export const HAT_LIST = [
  { id: 'none', name: 'No hat', level: 1 },
  { id: 'beanie', name: 'Beanie', level: 2 },
  { id: 'cap', name: 'Cap', level: 4 },
  { id: 'flower', name: 'Flower', level: 7 },
  { id: 'acorn', name: 'Acorn', level: 10 },
  { id: 'party', name: 'Party Hat', level: 13 },
  { id: 'sou', name: "Sou'wester", level: 15 },
  { id: 'propeller', name: 'Propeller', level: 19 },
  { id: 'tophat', name: 'Top Hat', level: 25 },
  { id: 'crown', name: 'Crown', feat: 'cup', note: 'Win a cup' },
  { id: 'halo', name: 'Halo', feat: 'stars', note: 'Every star' },
];
export const TRAILS = [
  { id: 'none', name: 'No trail', level: 1 },
  { id: 'sparkle', name: 'Sparkle', level: 8 },
  { id: 'bubbles', name: 'Bubbles', level: 12 },
  { id: 'leaves', name: 'Leaves', level: 18 },
  { id: 'rainbow', name: 'Rainbow', level: 28 },
  { id: 'gold', name: 'Golden', feat: 'golds', note: 'Every golden fly' },
];
export const DANCES = [
  { id: 'wave', name: 'Wave', level: 1 },
  { id: 'hop', name: 'Hop', level: 6 },
  { id: 'spin', name: 'Spin', level: 11 },
  { id: 'drum', name: 'Drum', level: 18 },
  { id: 'flip', name: 'Flip', level: 30 },
];
export const SLOTS = [
  { id: 'species', name: 'Spider', items: SPECIES_LIST },
  { id: 'color', name: 'Colour', items: COLORS },
  { id: 'mark', name: 'Pattern', items: MARKS },
  { id: 'hat', name: 'Hat', items: HAT_LIST },
  { id: 'trail', name: 'Trail', items: TRAILS },
  { id: 'dance', name: 'Dance', items: DANCES },
];
export const MAX_LEVEL = 50;
export const SPOUT_COUNT = 12;

/** Silk from one level to the next. */
export const levelCost = (n) => 80 + 30 * (n - 1);

/** The level a total of silk makes: { level, into (silk into this level), need (silk for the next), max }. */
export function levelOf(silk) {
  let level = 1;
  let left = Math.max(0, Math.floor(Number(silk) || 0));
  while (level < MAX_LEVEL && left >= levelCost(level)) {
    left -= levelCost(level);
    level++;
  }
  return { level, into: level >= MAX_LEVEL ? 0 : left, need: level >= MAX_LEVEL ? 0 : levelCost(level), max: level >= MAX_LEVEL };
}

/** What reaching a level unlocks: [{ slot, item }]. */
export function unlocksAt(level) {
  const out = [];
  for (const slot of SLOTS) for (const item of slot.items) if (item.level === level) out.push({ slot: slot.id, item });
  return out;
}

/** The feats behind the special items, read from a save. */
export function feats(save) {
  const sp = save.spouts ?? {};
  let stars = 0;
  let golds = 0;
  for (let id = 1; id <= SPOUT_COUNT; id++) {
    stars += sp[id]?.stars ?? 0;
    if (sp[id]?.gold) golds++;
  }
  return { cup: (save.n?.cups ?? 0) > 0, stars: stars >= SPOUT_COUNT * 3, golds: golds >= SPOUT_COUNT };
}

/** Whether this item is the player's to wear. */
export function owns(save, item) {
  if (item.feat) return !!feats(save)[item.feat];
  return levelOf(save.silk).level >= item.level;
}

/** The look a save wears, with anything it doesn't own put back to the first item of that slot. */
export function wornLook(save) {
  const pick = (slotId, want) => {
    const slot = SLOTS.find((s) => s.id === slotId);
    const item = slot.items.find((i) => i.id === want);
    return item && owns(save, item) ? item : slot.items[0];
  };
  const color = pick('color', save.look?.color);
  return {
    species: pick('species', save.look?.species).id,
    color: color.hex,
    colorId: color.id,
    mark: pick('mark', save.look?.mark).id,
    hat: pick('hat', save.look?.hat).id,
    trail: pick('trail', save.look?.trail).id,
    dance: pick('dance', save.look?.dance).id,
  };
}

// ------------------------------------------------------------------------------------------- the save

export function freshSave() {
  return {
    v: 2,
    tut: false,
    open: 1,
    silk: 0,
    spouts: {},
    mon: { best: 0, day: '', dayBest: 0 },
    n: { held: 0, perfect: 0, washes: 0, races: 0, wins: 0, cups: 0, flies: 0, gold: 0, swings: 0, climbs: 0 },
    look: { species: 'jumper', color: 'gold', mark: 'ring', hat: 'none', trail: 'none', dance: 'wave' },
    day: { key: '', goals: [], chest: false },
    week: { key: '', goal: null },
    streak: { n: 0, last: '', best: 0 },
    seen: {},
    lastLevel: 1,
  };
}

const num = (v, lo, hi, d = lo) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const strv = (v, max, d = '') => (typeof v === 'string' && v.length <= max ? v : d);

/** A save as read from storage (anything at all) made safe: unknown fields dropped, numbers bounded. v1 saves carry over. */
export function cleanSave(raw) {
  const s = freshSave();
  if (!raw || typeof raw !== 'object') return s;
  s.tut = !!raw.tut;
  s.open = Math.round(num(raw.open, 1, SPOUT_COUNT, 1));
  s.silk = Math.floor(num(raw.silk, 0, 1e8, 0));
  for (let id = 1; id <= SPOUT_COUNT; id++) {
    const r = raw.spouts?.[id];
    // v1 kept stars and best times in their own maps
    const best = num(r?.best ?? raw.best?.[id], 0, 1000, 0);
    const stars = Math.round(num(r?.stars ?? raw.stars?.[id], 0, 3, 0));
    const flies = Math.floor(num(r?.flies, 0, 2 ** 30, 0));
    const gold = !!r?.gold;
    if (best > 1 || stars || flies || gold) s.spouts[id] = { best: best > 1 ? best : 0, stars, flies, gold };
  }
  if (raw.mon && typeof raw.mon === 'object') {
    s.mon.best = Math.floor(num(raw.mon.best, 0, 1e5, 0));
    s.mon.day = strv(raw.mon.day, 10);
    s.mon.dayBest = Math.floor(num(raw.mon.dayBest, 0, 1e5, 0));
  }
  for (const k of Object.keys(s.n)) s.n[k] = Math.floor(num(raw.n?.[k], 0, 1e9, 0));
  if (raw.look && typeof raw.look === 'object') for (const k of Object.keys(s.look)) s.look[k] = strv(raw.look[k], 24, s.look[k]);
  if (raw.day && typeof raw.day === 'object') {
    s.day.key = strv(raw.day.key, 10);
    s.day.chest = !!raw.day.chest;
    if (Array.isArray(raw.day.goals)) {
      s.day.goals = raw.day.goals.slice(0, 3).filter((g) => g && GOAL_KINDS[g.kind]).map((g) => ({ kind: g.kind, n: Math.round(num(g.n, 1, 1000, 1)), have: Math.floor(num(g.have, 0, 1e6, 0)), done: !!g.done }));
    }
  }
  if (raw.week && typeof raw.week === 'object') {
    s.week.key = strv(raw.week.key, 10);
    const g = raw.week.goal;
    if (g && typeof g === 'object' && WEEK_KINDS[g.kind]) s.week.goal = { kind: g.kind, n: Math.round(num(g.n, 1, 10000, 1)), have: Math.floor(num(g.have, 0, 1e6, 0)), done: !!g.done };
  }
  if (raw.streak && typeof raw.streak === 'object') {
    s.streak.n = Math.floor(num(raw.streak.n, 0, 1e4, 0));
    s.streak.best = Math.floor(num(raw.streak.best, 0, 1e4, 0));
    s.streak.last = strv(raw.streak.last, 10);
  }
  if (raw.seen && typeof raw.seen === 'object') for (const k of Object.keys(raw.seen).slice(0, 60)) if (k.length <= 24) s.seen[k] = Math.floor(num(raw.seen[k], 0, 99, 1));
  s.lastLevel = Math.round(num(raw.lastLevel, 1, MAX_LEVEL, levelOf(s.silk).level));
  return s;
}

/** Adds silk; returns { before, after, levels: [unlocks per level gained] }. */
export function addSilk(save, n) {
  const before = levelOf(save.silk).level;
  save.silk = Math.max(0, Math.floor(save.silk + Math.max(0, n)));
  const after = levelOf(save.silk).level;
  const levels = [];
  for (let l = before + 1; l <= after; l++) levels.push({ level: l, unlocks: unlocksAt(l) });
  return { before, after, levels };
}

// ------------------------------------------------------------------------------------------- what a climb earns

export const SILK = {
  top: 30,
  perSpout: 4,
  star: 10,
  fly: 2,
  gold: 25,
  perfect: 3,
  swing: 1,
  swingCap: 15,
  place: [40, 25, 15, 10, 8, 6],
  metre: 0.2,
  goal: 60,
  chest: 150,
  week: 500,
  combo: 2, // per step of the climb's best combo, from ×3
  comboCap: 40,
};

/**
 * The silk for one go, as lines for the results card. c: { kind: 'solo'|'race'|'monsoon'|'tutorial', spout, finished,
 * newStars, flies, gold, perfect, swings, place, metres, combo }.
 */
export function climbReward(c) {
  const lines = [];
  const add = (label, silk) => silk > 0 && lines.push({ label, silk: Math.round(silk) });
  if (c.kind === 'monsoon') add(`${Math.floor(c.metres ?? 0)} m`, (c.metres ?? 0) * SILK.metre);
  else if (c.finished) add('Reached the sun', SILK.top + SILK.perSpout * (c.spout ?? 1));
  if (c.kind === 'race' && c.place >= 1) add(`${['1st', '2nd', '3rd', '4th', '5th', '6th'][c.place - 1] ?? 'Raced'}`, SILK.place[c.place - 1] ?? 4);
  if (c.newStars > 0) add(c.newStars === 1 ? 'New star' : `${c.newStars} new stars`, c.newStars * SILK.star);
  if (c.flies > 0) add(`Flies ×${c.flies}`, c.flies * SILK.fly);
  if (c.gold) add('Golden fly', SILK.gold);
  if (c.perfect > 0) add(`Perfect holds ×${c.perfect}`, c.perfect * SILK.perfect);
  if (c.swings > 0) add(`Swings ×${c.swings}`, Math.min(SILK.swingCap, c.swings * SILK.swing));
  if (c.combo >= 3) add(`Best combo ×${c.combo}`, Math.min(SILK.comboCap, c.combo * SILK.combo));
  return { lines, total: lines.reduce((a, l) => a + l.silk, 0) };
}

/** Keeps a finished spout's records. r: { spout, time, stars, fliesMask, gold }. Returns what changed. */
export function recordSpout(save, r) {
  const id = r.spout;
  const cur = save.spouts[id] ?? { best: 0, stars: 0, flies: 0, gold: false };
  const prevBest = cur.best || 0;
  const newBest = r.time > 0 && (!prevBest || r.time < prevBest);
  const newStars = Math.max(0, (r.stars ?? 0) - cur.stars);
  const fliesBefore = popcount(cur.flies);
  const flies = (cur.flies | (r.fliesMask ?? 0)) >>> 0;
  const newGold = !!r.gold && !cur.gold;
  save.spouts[id] = { best: newBest ? r.time : prevBest, stars: Math.max(cur.stars, r.stars ?? 0), flies, gold: cur.gold || !!r.gold };
  if (r.time > 0) save.open = Math.max(save.open, Math.min(SPOUT_COUNT, id + 1));
  return { prevBest, newBest, newStars, newFlies: popcount(flies) - fliesBefore, newGold };
}

export function popcount(v) {
  let n = 0;
  let x = v >>> 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

// ------------------------------------------------------------------------------------------- goals of the day

/** Goal kinds: the label (with n) and the range of n. */
export const GOAL_KINDS = {
  perfect: { label: (n) => `Hold perfectly ${n} times`, short: 'Perfect holds', range: [4, 8] },
  flies: { label: (n) => `Catch ${n} flies`, short: 'Flies', range: [10, 22] },
  swing: { label: (n) => `Swing on silk ${n} times`, short: 'Swings', range: [6, 14] },
  climb: { label: (n) => `Reach the sun ${n} times`, short: 'Climbs', range: [2, 4] },
  held: { label: (n) => `Hold through ${n} flushes`, short: 'Flushes held', range: [10, 20] },
  dry: { label: (n) => (n === 1 ? 'Climb a spout bone dry' : `Climb ${n} spouts bone dry`), short: 'Bone-dry climbs', range: [1, 2] },
  race: { label: (n) => `Finish ${n} races`, short: 'Races', range: [2, 3] },
  monsoon: { label: (n) => `Reach ${n} m in Monsoon`, short: 'Monsoon metres', range: [40, 90], best: true },
  gold: { label: () => 'Catch a golden fly', short: 'Golden fly', range: [1, 1] },
  combo: { label: (n) => `Reach a ×${n} combo`, short: 'Best combo', range: [6, 12], best: true },
};

/** Today's three goals, the same for everyone: three different kinds, rounded amounts. */
export function goalsFor(day) {
  const rng = makeRng(`goals:${day}`);
  const kinds = rng.shuffle(Object.keys(GOAL_KINDS)).slice(0, 3);
  return kinds.map((kind) => {
    const [lo, hi] = GOAL_KINDS[kind].range;
    let n = rng.int(lo, hi);
    if (n >= 20) n = Math.round(n / 5) * 5;
    else if (kind === 'monsoon') n = Math.round(n / 10) * 10;
    return { kind, n, have: 0, done: false };
  });
}

// The goal of the week: one big one, the same for everyone from Monday to Sunday (UTC), worth a lot of silk.
export const WEEK_KINDS = {
  flies: { range: [100, 160] },
  perfect: { range: [30, 50] },
  swing: { range: [50, 90] },
  climb: { range: [14, 22] },
  held: { range: [70, 110] },
  race: { range: [10, 16] },
  monsoon: { range: [140, 200] },
  combo: { range: [16, 24] },
};

/** The Monday (UTC) of a "YYYY-MM-DD" day's week. */
export function weekOf(day) {
  const t = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(t)) return '';
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 86400000).toISOString().slice(0, 10);
}

/** This week's goal, the same for everyone. */
export function weekGoalFor(week) {
  const rng = makeRng(`week:${week}`);
  const kind = rng.pick(Object.keys(WEEK_KINDS));
  const [lo, hi] = WEEK_KINDS[kind].range;
  let n = rng.int(lo, hi);
  n = n >= 50 ? Math.round(n / 10) * 10 : n >= 20 ? Math.round(n / 5) * 5 : n;
  return { kind, n, have: 0, done: false };
}

/** Moves the save to today: new goals (and a new week's goal on Monday), and the streak broken if a day was missed. */
export function rollDay(save, day) {
  if (save.day.key !== day) {
    save.day = { key: day, goals: goalsFor(day), chest: false };
  }
  const wk = weekOf(day);
  if (wk && save.week.key !== wk) save.week = { key: wk, goal: weekGoalFor(wk) };
  if (save.streak.last && save.streak.last !== day && save.streak.last !== prevDay(day)) save.streak.n = 0;
}

/** The day before a "YYYY-MM-DD" key. */
export function prevDay(day) {
  const t = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(t)) return '';
  return new Date(t - 86400000).toISOString().slice(0, 10);
}

/**
 * Counts something toward today's goals (n more, or for best-kind goals a new value). Returns { done: [goals finished
 * now], chest: true when this finished all three, silk: what it earned }.
 */
export function track(save, kind, n, day) {
  rollDay(save, day);
  const out = { done: [], chest: false, silk: 0, week: null };
  const wg = save.week.goal;
  if (wg && wg.kind === kind && !wg.done) {
    wg.have = GOAL_KINDS[kind].best ? Math.max(wg.have, Math.floor(n)) : wg.have + Math.floor(n);
    if (wg.have >= wg.n) {
      wg.have = wg.n;
      wg.done = true;
      out.week = wg;
      out.silk += SILK.week;
    }
  }
  for (const g of save.day.goals) {
    if (g.kind !== kind || g.done) continue;
    g.have = GOAL_KINDS[kind].best ? Math.max(g.have, Math.floor(n)) : g.have + Math.floor(n);
    if (g.have >= g.n) {
      g.have = g.n;
      g.done = true;
      out.done.push(g);
      out.silk += SILK.goal;
    }
  }
  if (out.done.length) {
    // the streak counts days with a goal done
    if (save.streak.last !== day) {
      save.streak.n = save.streak.last === prevDay(day) ? save.streak.n + 1 : 1;
      save.streak.last = day;
      save.streak.best = Math.max(save.streak.best, save.streak.n);
    }
    if (!save.day.chest && save.day.goals.length && save.day.goals.every((g) => g.done)) {
      save.day.chest = true;
      out.chest = true;
      out.silk += chestSilk(save.streak.n);
    }
  }
  return out;
}

/** The chest grows with the streak: +10% a day, up to a week. */
export const chestSilk = (streak) => Math.round(SILK.chest * (1 + Math.min(7, Math.max(0, streak - 1)) * 0.1));
