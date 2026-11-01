// Racing together. A match is a cup of three spouts (createMatch); each page simulates its own spider and sends it in
// presence; the host's page also runs the bots and writes them to host:bots ten times a second; rain is the same pure
// function of the round's seed and the match clock everywhere. Finishes go through the host (ordered by the room's clock),
// bumps are applied by the page of the spider that was bumped. Everything read from the room is checked first.
// Also: a stand-in for the SDK and a local match for when the page runs without the platform (posters, a plain server).

import { createRun, advance, restoreRacer, heightOf } from './run.js';
import { pack, knock, bumpVelocity, modeName, modeCode, angleOf } from './spider.js';
import { CUPS, cupById } from './spouts.js';
import { POINTS, CLOSE_AFTER, ROUND_CAP, STEP } from './config.js';
import { rankRace, botSkills, pointsFor, cupOrder } from './race.js';
import { hashString } from './rng.js';
import { BOT_NAMES } from './bot.js';

export const SETTINGS = [
  { id: 'cup', label: 'Cup', options: CUPS.map((c) => ({ value: c.id, label: c.name })), default: 1 },
  { id: 'bots', label: 'Bots', options: [{ value: 'fill', label: 'Fill' }, { value: 'off', label: 'Off' }], default: 'fill' },
];
export const JOIN = { maxPlayers: 6, minPlayers: 1, lobby: 'bar', countdown: 0, settings: SETTINGS };
export const INTRO = 5;
export const RULES = { rounds: 3, introSeconds: INTRO, roundSeconds: ROUND_CAP, roundEndSeconds: 6, resultsSeconds: 20, points: POINTS, admit: 'round' };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** host:bots, as every page checks it: { r: round id, t: round ms, b: [[id, x, y, angle, mode, grip×10, holding, facing, finish ms]] }. */
export function validBots(v) {
  if (v === null) return true;
  if (!isObj(v) || !str(v.r, 80) || !num(v.t, 0, 1e7) || !Array.isArray(v.b) || v.b.length > 8) return false;
  return v.b.every(
    (e) =>
      Array.isArray(e) &&
      e.length === 9 &&
      str(e[0], 32) &&
      num(e[1], -1e5, 1e5) &&
      num(e[2], -1e4, 2e5) &&
      num(e[3], -1000, 1000) &&
      num(e[4], 0, 6) &&
      num(e[5], 0, 30) &&
      num(e[6], 0, 1) &&
      num(e[7], -1, 1) &&
      num(e[8], 0, 1e7),
  );
}

/** match.data, as every page checks it. */
export function validRound(v) {
  if (!isObj(v) || !num(v.s, 1, 12) || !num(v.seed, 0, 2 ** 32) || !isObj(v.fin)) return false;
  const keys = Object.keys(v.fin);
  return keys.length <= 16 && keys.every((k) => k.length <= 64 && num(v.fin[k], 0, 1e7));
}

/** A player's presence in a race: { v, r, x, y, a, m, g, h, f, d }. Returns a drawing state or null. */
export function readPresence(p, rid, level) {
  if (!isObj(p) || p.v !== 1 || p.r !== rid) return null;
  if (!num(p.x, -5000, 5000) || !num(p.y, -600, level.H + 800) || !num(p.a, -1000, 1000)) return null;
  if (!num(p.m, 0, 6) || !num(p.g, 0, 30) || !num(p.h, 0, 1) || !num(p.f, -1, 1) || !num(p.d, 0, 1e7)) return null;
  return { x: p.x, y: p.y, a: p.a, m: modeName(p.m | 0), g: p.g / 10, h: p.h === 1, f: p.f < 0 ? -1 : 1, d: p.d };
}

export const roundSeed = (rid) => hashString(`round:${rid}`) >>> 0;
export const spoutOf = (cup, round) => cupById(cup).spouts[Math.max(0, Math.min(2, round - 1))];

/** A round's spout and seed from the cup, the round and its id: what the host's startRound returns. */
const planRound = (m) => ({ s: spoutOf(Number(m.settings?.cup) || 1, m.round), seed: roundSeed(m.roundId), fin: {} });

/**
 * The round's data: match.data once the round plays, and during the intro (before the host's
 * startRound has run) the same spout and seed worked out on every page, so the count-in shows the spout.
 */
export function roundInfo(m) {
  if (!m) return null;
  if (validRound(m.data)) return m.data;
  if (m.phase !== 'intro' || !(m.round > 0) || !m.roundId) return null;
  const d = planRound(m);
  return validRound(d) ? d : null;
}

/** The skills of a race's bots: spread over the cup's range, by seat. */
export function seatSkills(cup, seats) {
  const bots = seats.filter((s) => s.bot);
  const skills = botSkills(cupById(cup).bots, bots.length);
  const out = new Map();
  bots.forEach((s, i) => out.set(s.id, skills[bots.length - 1 - i] ?? 0.5));
  return out;
}

/**
 * The race layer. env: { room, match (set later with attach), host, t (schema helpers), hooks: { onRun(run), onFinish(r),
 * onBumped(kind), onEvent } }.
 */
export function createNet(env) {
  const { room, host, t } = env;
  const hooks = env.hooks ?? {};
  let match = null;
  let cur = null;
  let presAt = 0;
  let snapAt = 0;
  const snaps = [];
  const bumpSeen = new Map();
  let lastRanking = null;

  const botsState = host
    ? host.state('bots', { schema: validBots, initial: null })
    : { get: () => null, set() {}, on() {} };
  botsState.on?.((v) => {
    if (!v || !cur || v.r !== cur.rid) return;
    if (snaps.length && snaps[snaps.length - 1].t >= v.t) return;
    snaps.push(v);
    if (snaps.length > 6) snaps.shift();
  });

  const finish = host
    ? host.rpc('finish', {
        args: t ? { r: t.string(80), ms: t.int(0, 1e7) } : undefined,
        rate: 2,
        validate: (from, a) => {
          if (!match || match.phase !== 'round') return 'not racing';
          if (a.r !== match.roundId) return 'old round';
          const d = match.data;
          if (!validRound(d) || d.fin[from.id] != null) return 'done';
          if (!match.seats.some((s) => s.id === from.id && !s.bot)) return 'not in it';
          return true;
        },
        run: (from, a, info) => {
          // The room's clock decides the order: when it took the call in, on this round's clock.
          const now = match.elapsed;
          const at = typeof info?.matchTime === 'number' && typeof room.matchNow === 'function' ? now - Math.max(0, room.matchNow() - info.matchTime) : now;
          const ms = Math.max(1000, Math.min(now, Math.max(a.ms, at - 400)));
          match.setData((d) => {
            if (d.fin[from.id] == null) d.fin[from.id] = Math.round(ms);
          });
        },
      })
    : null;

  room.on('message', (data, from) => {
    if (!isObj(data) || data.$ow || data.t !== 'bump' || !cur) return;
    if (data.r !== cur.rid || !str(data.id, 64) || !from || typeof from.id !== 'string') return;
    const target = cur.run.byId.get(data.id);
    if (!target || !target.sp) return;
    if (!(target.me || (target.bot && cur.run.simBots))) return;
    // Who bumped: a player (as this page sees them), or one of the host's bots.
    let by = cur.run.byId.get(from.id);
    if (str(data.by, 32) && from.id === room.host) by = cur.run.byId.get(data.by);
    if (!by) return;
    const key = `${by.id}>${target.id}`;
    const nowS = cur.run.t;
    if ((bumpSeen.get(key) ?? -9) > nowS - 0.9) return;
    const bx = by.sp && (by.me || (by.bot && cur.run.simBots)) ? by.sp.x : by.st.x;
    const byY = by.sp && (by.me || (by.bot && cur.run.simBots)) ? by.sp.y : by.st.y;
    if (Math.hypot(bx - target.sp.x, byY - target.sp.y) > 90) return;
    bumpSeen.set(key, nowS);
    const [vx, vy] = bumpVelocity({ x: bx, y: byY }, target.sp);
    if (knock(target.sp, vx, vy, 'bump')) hooks.onBumped?.(target, by);
  });

  const netHooks = {
    onFinish(r) {
      if (!cur) return;
      const ms = Math.round(r.finish * 1000);
      if (r.me && finish) finish({ r: cur.rid, ms });
      else if (match?.isHost) {
        match.setData((d) => {
          if (d.fin[r.id] == null) d.fin[r.id] = ms;
        });
      }
      hooks.onFinish?.(r);
    },
    onBump(from, to) {
      if (!cur) return;
      if (to.bot) {
        if (from.me && !room.isHost) room.send({ t: 'bump', r: cur.rid, id: to.id }, { to: room.host });
      } else if (from.me) room.send({ t: 'bump', r: cur.rid, id: to.id }, { to: to.id });
      else if (from.bot && room.isHost) room.send({ t: 'bump', r: cur.rid, id: to.id, by: from.id }, { to: to.id });
    },
    onKnock(target, by) {
      hooks.onBumped?.(target, by);
    },
    onHazard(r, kind) {
      hooks.onHazard?.(r, kind);
    },
  };

  function buildRound() {
    const d = roundInfo(match);
    const rid = match.roundId;
    const cup = Number(match.settings?.cup) || 1;
    const skills = seatSkills(cup, match.seats);
    const seats = match.seats.map((s) => ({ id: s.id, name: s.name, bot: s.bot, me: s.me && !match.spectating, skill: skills.get(s.id) ?? 0.5, index: s.index }));
    const run = createRun({ kind: 'race', spout: d.s, seed: d.seed, seats, simBots: match.isHost });
    cur = { rid, run, round: match.round, spout: d.s };
    snaps.length = 0;
    bumpSeen.clear();
    // A reload in the middle of a race: carry on from where this spider was.
    const mine = run.me;
    const pres = room.me?.presence;
    if (mine && isObj(pres) && pres.r === rid) {
      const st = readPresence(pres, rid, run.level);
      if (st) restoreRacer(run, mine, [st.x, st.y, st.a, modeCode(st.m), st.g * 10, st.h ? 1 : 0, st.f]);
      if (st && st.d) mine.finish = st.d / 1000;
    }
    const snap = botsState.get();
    if (validBots(snap) && snap && snap.r === rid) {
      snaps.push(snap);
      if (match.isHost) adoptBots(snap);
    }
    if (match.phase === 'round') run.t = Math.max(0, match.elapsed / 1000 - STEP);
    hooks.onRun?.(run);
  }

  function adoptBots(snap) {
    if (!cur) return;
    const run = cur.run;
    for (const e of snap.b) {
      const r = run.byId.get(e[0]);
      if (!r || !r.bot) continue;
      restoreRacer(run, r, e.slice(1, 8));
      if (e[8] && !r.finish) r.finish = e[8] / 1000;
      if (r.finish) r.sp.mode = 'done';
    }
  }

  function applySnapshots() {
    if (!snaps.length || !cur) return;
    const tMs = cur.run.t * 1000 - 150;
    let a = snaps[0];
    let b = snaps[0];
    for (let i = 0; i < snaps.length; i++) {
      if (snaps[i].t <= tMs) a = snaps[i];
      if (snaps[i].t >= tMs) {
        b = snaps[i];
        break;
      }
      b = snaps[i];
    }
    const k = b.t > a.t ? Math.max(0, Math.min(1, (tMs - a.t) / (b.t - a.t))) : 1;
    for (const eb of b.b) {
      const r = cur.run.byId.get(eb[0]);
      if (!r || !r.bot) continue;
      const ea = a.b.find((e) => e[0] === eb[0]) ?? eb;
      const st = r.st;
      st.x = ea[1] + (eb[1] - ea[1]) * k;
      st.y = ea[2] + (eb[2] - ea[2]) * k;
      let da = eb[3] - ea[3];
      if (Math.abs(da) > 300) {
        st.a = eb[3];
      } else {
        while (da > 180) da -= 360;
        while (da < -180) da += 360;
        st.a = ea[3] + da * k;
      }
      const near = k < 0.5 ? ea : eb;
      st.m = modeName(near[4]);
      st.g = near[5] / 10;
      st.h = near[6] === 1;
      st.f = near[7] < 0 ? -1 : 1;
      if (eb[8] && !r.finish) r.finish = eb[8] / 1000;
    }
  }

  function readRemotes() {
    const run = cur.run;
    for (const r of run.racers) {
      if (r.me || r.bot) continue;
      const seat = match.seats.find((s) => s.id === r.id);
      r.away = !!seat?.away;
      r.left = !!seat?.left;
      const p = typeof room.presenceAt === 'function' ? room.presenceAt(r.id, { angles: ['a'], snap: 300 }) : room.players?.get(r.id)?.presence;
      const st = readPresence(p, cur.rid, run.level);
      if (!st) continue;
      Object.assign(r.st, st);
      if (st.d && !r.finish) r.finish = st.d / 1000;
    }
  }

  function sendPresence(force) {
    const r = cur?.run.me;
    if (!r || !r.sp) return;
    const sp = r.sp;
    room.setPresence({
      v: 1,
      r: cur.rid,
      x: Math.round(sp.x * 10) / 10,
      y: Math.round(sp.y * 10) / 10,
      a: Math.round(angleOf(sp)),
      m: modeCode(sp.mode),
      g: Math.round(sp.grip * 10),
      h: sp.holding ? 1 : 0,
      f: sp.facing < 0 ? -1 : 1,
      d: r.finish ? Math.round(r.finish * 1000) : 0,
    });
    void force;
  }

  function writeSnapshot() {
    const run = cur.run;
    const b = [];
    for (const r of run.racers) if (r.bot && r.sp) b.push([r.id, ...pack(r.sp), r.finish ? Math.round(r.finish * 1000) : 0]);
    botsState.set({ r: cur.rid, t: Math.round(run.t * 1000), b });
  }

  const api = {
    get round() {
      return cur;
    },
    attach(m) {
      match = m;
    },
    /** Per frame. input: the local player's controls (or null). realNow: seconds of page time. */
    update(input, realNow) {
      if (!match) return;
      const phase = match.phase;
      const racing = phase === 'intro' || phase === 'round' || phase === 'roundEnd';
      if (!racing) return;
      if (!roundInfo(match)) return;
      if (!cur || cur.rid !== match.roundId) buildRound();
      const run = cur.run;
      // The host changed: take the bots over from the last snapshot (or hand them back).
      if (run.simBots !== match.isHost) {
        run.simBots = match.isHost;
        if (run.simBots) {
          const snap = botsState.get();
          if (validBots(snap) && snap && snap.r === cur.rid) adoptBots(snap);
        }
      }
      if (phase === 'round' && !match.paused) {
        const target = match.elapsed / 1000;
        const mineIn = run.me && run.me.sp && !match.spectating ? input : null;
        advance(run, target, mineIn, netHooks);
      }
      if (!run.simBots) applySnapshots();
      readRemotes();
      if (realNow - presAt >= 0.05 && phase !== 'intro') {
        presAt = realNow;
        sendPresence();
      }
      if (run.simBots && phase === 'round' && realNow - snapAt >= 0.1) {
        snapAt = realNow;
        writeSnapshot();
      }
    },
    /** Live finish times in seconds, from the round's data (the host's word) and what this page saw itself. */
    finishes() {
      const out = {};
      if (!cur) return out;
      const d = match?.data;
      if (validRound(d)) for (const [k, v] of Object.entries(d.fin)) out[k] = v / 1000;
      for (const r of cur.run.racers) if (r.finish && out[r.id] == null) out[r.id] = r.finish;
      return out;
    },
    /** Host: is this round over? Returns the ranking when it is. */
    hostCheck(m) {
      if (!cur || cur.rid !== m.roundId || !validRound(m.data)) return null;
      const fin = m.data.fin;
      const tS = m.elapsed / 1000;
      const present = m.present.map((s) => s.id);
      const times = Object.values(fin);
      const first = times.length ? Math.min(...times) / 1000 : null;
      const all = present.length > 0 && present.every((id) => fin[id] != null);
      if (all || (first != null && tS > first + CLOSE_AFTER)) return api.ranking(m);
      return null;
    },
    ranking(m) {
      const ids = m.seats.map((s) => s.id);
      const fin = {};
      const heights = {};
      const d = validRound(m.data) ? m.data : { fin: {} };
      for (const id of ids) {
        if (d.fin[id] != null) fin[id] = d.fin[id] / 1000;
        const r = cur?.run.byId.get(id);
        heights[id] = r ? heightOf(r) : 0;
        const seat = m.seats.find((s) => s.id === id);
        if (seat?.left && fin[id] == null) heights[id] = Math.min(heights[id], 0);
      }
      lastRanking = rankRace(ids, fin, heights);
      return lastRanking;
    },
    finalOrder(m) {
      const order = cupOrder(m.scores, lastRanking ?? m.last?.ranking ?? []);
      return order.map((id) => [id]);
    },
    resume() {
      if (!cur) return;
      cur.run.simBots = true;
      const snap = botsState.get();
      if (validBots(snap) && snap && snap.r === cur.rid) adoptBots(snap);
    },
    clear() {
      cur = null;
      snaps.length = 0;
    },
  };
  return api;
}

/** createMatch rules for a cup, wired to the race layer. */
export function cupRules(getNet) {
  return {
    ...RULES,
    data: validRound,
    startRound: planRound,
    onTick: (m) => {
      const ranking = getNet()?.hostCheck(m);
      if (ranking) m.endRound(ranking);
    },
    score: (m) => getNet()?.ranking(m) ?? [],
    final: (m) => getNet()?.finalOrder(m) ?? null,
    resume: () => getNet()?.resume(),
  };
}

export const BOT_LIST = BOT_NAMES;

// ---------------------------------------------------------------- without the platform

/** A stand-in for window.onceworlds (the file opened on its own, posters): nothing throws, saves live in memory. */
export function stubOw() {
  const mem = new Map();
  const listeners = {};
  return {
    mode: 'standalone',
    stub: true,
    player: { get: async () => ({ id: 'me', name: 'You', guest: true }), avatarUrl: async () => null, rename: async () => null },
    save: {
      get: async (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null),
      set: async (k, v) => void mem.set(k, JSON.stringify(v)),
      delete: async (k) => void mem.delete(k),
      list: async () => [...mem.keys()],
    },
    badges: { award: async () => false, list: async () => [], has: async () => false },
    leaderboards: { submit: async () => null, top: async () => ({ entries: [], me: null }) },
    controls: { set() {}, stick: { x: 0, y: 0 }, pressed: () => false, presses: () => 0, touch: false },
    ui: { reserved: null, setLook() {}, showInvite() {}, setMenuPosition() {}, setOrientation() {}, requestFullscreen() {} },
    settings: { quality: 'high', reducedMotion: false, pixelRatio: (m) => Math.min(globalThis.devicePixelRatio || 1, m ?? 2), on() {} },
    now: () => Date.now(),
    on(ev, fn) {
      (listeners[ev] ??= []).push(fn);
    },
    rooms: { join: async () => stubRoom() },
    env: {},
  };
}

/** A room with one player in it, and nobody else ever. */
export function stubRoom() {
  const me = { id: 'me', name: 'You', presence: null, connected: true };
  const players = new Map([[me.id, me]]);
  const handlers = {};
  return {
    stub: true,
    me,
    players,
    online: [me],
    host: me.id,
    isHost: true,
    kind: 'solo',
    state: {},
    settings: { cup: 1, bots: 'fill' },
    match: { phase: 'lobby', n: 0, id: '', seed: 0, participants: [] },
    connected: true,
    on(ev, fn) {
      (handlers[ev] ??= []).push(fn);
    },
    emit(ev, ...a) {
      for (const fn of handlers[ev] ?? []) fn(...a);
    },
    setPresence(p) {
      me.presence = p;
    },
    presenceAt: (id) => players.get(id)?.presence ?? null,
    setState(k, v) {
      if (v === null) delete this.state[k];
      else this.state[k] = v;
    },
    send() {},
    setReady() {},
    hideLobby() {},
    setSetting(k, v) {
      this.settings[k] = v;
      this.emit('settings', this.settings);
    },
    matchNow: () => 0,
    leave() {},
  };
}

/**
 * The same shape as the SDK's createMatch, for one player and bots, with no room behind it. Used when the helpers
 * can't load. opts: { fill: () => number }.
 */
export function createLocalMatch(room, rules, opts = {}) {
  const listeners = {};
  const emit = (ev, ...a) => (listeners[ev] ?? []).forEach((fn) => fn(...a));
  let phase = 'lobby';
  let round = 0;
  let until = 0;
  let started = 0;
  let clock = 0;
  let data = null;
  let seats = [];
  let scores = {};
  let last = null;
  let results = null;
  let mid = 0;
  const nowMs = () => clock;
  const m = {
    room,
    get phase() {
      return phase;
    },
    paused: false,
    isHost: true,
    get round() {
      return round;
    },
    rounds: rules.rounds,
    get roundId() {
      return `local${mid}.${round}`;
    },
    get seats() {
      return phase === 'lobby' ? [] : seats;
    },
    get present() {
      return seats.filter((s) => !s.left);
    },
    get me() {
      return seats.find((s) => s.me) ?? null;
    },
    spectating: false,
    get scores() {
      return scores;
    },
    get standings() {
      return standingsOf(cupOrder(scores, last?.ranking ?? []).map((id) => [id]));
    },
    get results() {
      return results;
    },
    get last() {
      return phase === 'roundEnd' ? last : null;
    },
    turn: null,
    get data() {
      return data;
    },
    get settings() {
      return room.settings;
    },
    countdown: null,
    get secondsLeft() {
      return until ? Math.max(0, (until - nowMs()) / 1000) : null;
    },
    get elapsed() {
      return phase === 'round' ? Math.max(0, nowMs() - started) : 0;
    },
    lobby: { players: [], canStart: true, waitingFor: [], bots: 0 },
    ready(on = true) {
      if (on && phase === 'lobby') m.start();
    },
    start() {
      if (phase !== 'lobby') return;
      mid++;
      const n = Math.max(1, Math.min(6, opts.fill ? opts.fill() : 6));
      seats = [{ id: room.me.id, name: room.me.name, bot: false, me: true, index: 0, team: 0, away: false, idle: false, left: false, skill: 0 }];
      for (let i = 1; i < n; i++) seats.push({ id: `bot:${i}`, name: BOT_NAMES[i - 1], bot: true, me: false, index: i, team: 0, away: false, idle: false, left: false, skill: 0.5 });
      scores = Object.fromEntries(seats.map((s) => [s.id, 0]));
      results = null;
      round = 0;
      nextRound();
    },
    endTurn() {},
    random: () => null,
    on(ev, fn) {
      (listeners[ev] ??= []).push(fn);
      return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn));
    },
    setData(v) {
      if (typeof v === 'function') {
        const copy = structuredClone(data);
        const out = v(copy);
        data = out === undefined ? copy : out;
      } else data = v;
      emit('change');
    },
    endRound(outcome) {
      if (phase !== 'round') return;
      const ranking = Array.isArray(outcome) ? outcome : rules.score?.(m) ?? [];
      const pts = pointsFor(ranking);
      for (const [k, v] of Object.entries(pts)) scores[k] = (scores[k] ?? 0) + v;
      last = { ranking, points: pts };
      setPhase('roundEnd', rules.roundEndSeconds);
    },
    skip() {
      until = nowMs();
    },
    endMatch() {
      setPhase('lobby', 0);
    },
    dispose() {
      clearInterval(timer);
    },
    _useBots() {},
  };
  function standingsOf(order) {
    const out = [];
    order.forEach((g, i) => {
      for (const id of g) {
        const s = seats.find((x) => x.id === id);
        out.push({ id, name: s?.name ?? id, points: scores[id] ?? 0, place: i + 1, bot: !!s?.bot });
      }
    });
    return out;
  }
  function setPhase(p, secs) {
    const prev = phase;
    phase = p;
    until = secs ? nowMs() + secs * 1000 : 0;
    emit('phase', p, prev);
    emit('change');
  }
  function nextRound() {
    round++;
    data = null; // as the platform's helper: startRound runs when play begins
    setPhase('intro', rules.introSeconds);
  }
  let lastTick = 0;
  const timer = setInterval(() => {
    const real = performance.now();
    const dt = lastTick ? Math.min(0.25, (real - lastTick) / 1000) : 0.1;
    lastTick = real;
    if (!m.paused) clock += dt * 1000;
    if (m.paused) return;
    if (phase === 'round') rules.onTick?.(m, dt);
    if (!until || nowMs() < until) return;
    if (phase === 'intro') {
      started = nowMs();
      data = rules.startRound ? rules.startRound(m) : {};
      setPhase('round', rules.roundSeconds);
      emit('round', round, { resumed: false });
    } else if (phase === 'round') m.endRound();
    else if (phase === 'roundEnd') {
      if (round >= rules.rounds) {
        const fin = rules.final ? rules.final(m) : null;
        results = standingsOf(fin ?? cupOrder(scores, last?.ranking ?? []).map((id) => [id]));
        setPhase('results', rules.resultsSeconds);
        emit('results', results, results.find((s) => s.id === room.me.id) ?? null);
      } else nextRound();
    } else if (phase === 'results') setPhase('lobby', 0);
  }, 50);
  m.now = nowMs;
  return m;
}
