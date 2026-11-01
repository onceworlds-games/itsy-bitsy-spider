// The race layer through a fake room: several pages sharing presence, host state, messages and the host's finish rpc.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNet, readPresence, validBots, validRound, roundSeed, roundInfo, cupRules, seatSkills } from '../src/net.js';
import { placeOn } from '../src/sim/spider.js';
import { CLOSE_AFTER } from '../src/sim/config.js';

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function makeHub(seats) {
  const rid = 'm1.1';
  return {
    hostId: seats[0].id,
    players: new Map(),
    pages: [],
    state: {},
    subs: {},
    rpcs: {},
    time: 0,
    m: { phase: 'round', round: 1, roundId: rid, data: { s: 1, seed: roundSeed(rid), fin: {} }, seats, elapsed: 0 },
  };
}

function makePage(hub, id) {
  const handlers = {};
  const room = {
    me: { id, name: id, presence: null },
    get host() {
      return hub.hostId;
    },
    get isHost() {
      return hub.hostId === id;
    },
    players: hub.players,
    on(ev, fn) {
      (handlers[ev] ??= []).push(fn);
    },
    emit(ev, ...a) {
      for (const fn of handlers[ev] ?? []) fn(...a);
    },
    setPresence(p) {
      room.me.presence = clone(p);
      hub.players.get(id).presence = clone(p);
    },
    presenceAt: (pid) => hub.players.get(pid)?.presence ?? null,
    send(data, opts = {}) {
      for (const pg of hub.pages) if (pg.room !== room && (!opts.to || pg.room.me.id === opts.to)) pg.room.emit('message', clone(data), { id });
    },
    matchNow: () => hub.time,
  };
  hub.players.set(id, { id, name: id, presence: null });
  const host = {
    state(name, { schema, initial }) {
      if (!(name in hub.state)) hub.state[name] = initial;
      const subs = (hub.subs[name] ??= []);
      return {
        get: () => hub.state[name],
        set(v) {
          if (!room.isHost) return;
          assert.ok(schema(v), `host:${name} fails its own schema`);
          hub.state[name] = clone(v);
          for (const fn of subs) fn(hub.state[name]);
        },
        on: (fn) => subs.push(fn),
      };
    },
    rpc(name, def) {
      (hub.rpcs[name] ??= new Map()).set(id, def);
      return (args) => {
        const d = hub.rpcs[name].get(hub.hostId);
        const from = { id };
        const ok = d.validate(from, clone(args));
        if (ok === true) d.run(from, clone(args), { matchTime: hub.time });
        return ok;
      };
    },
  };
  const match = {
    get phase() {
      return hub.m.phase;
    },
    get round() {
      return hub.m.round;
    },
    get roundId() {
      return hub.m.roundId;
    },
    get data() {
      return hub.m.data;
    },
    settings: { cup: 1, bots: 'fill' },
    get seats() {
      return hub.m.seats.map((s) => ({ ...s, me: s.id === id }));
    },
    get present() {
      return hub.m.seats.filter((s) => !s.left);
    },
    get spectating() {
      return !hub.m.seats.some((s) => s.id === id);
    },
    get isHost() {
      return room.isHost;
    },
    get elapsed() {
      return hub.m.elapsed;
    },
    paused: false,
    scores: {},
    setData(fn) {
      if (!room.isHost) return;
      const copy = clone(hub.m.data);
      const out = fn(copy);
      hub.m.data = out === undefined ? copy : out;
    },
  };
  const events = { finished: [], bumped: [] };
  const net = createNet({ room, host, t: null, hooks: { onFinish: (r) => events.finished.push(r.id), onBumped: (r) => events.bumped.push(r.id) } });
  net.attach(match);
  const page = { id, room, match, net, events, gone: false };
  hub.pages.push(page);
  return page;
}

const UP = () => ({ x: 0, y: 1, jump: false, hold: false });

function run(hub, seconds) {
  const dt = 1000 / 60;
  for (let i = 0; i < seconds * 60; i++) {
    hub.m.elapsed += dt;
    hub.time += dt;
    for (const p of hub.pages) if (!p.gone) p.net.update(UP(), hub.m.elapsed / 1000);
  }
}

const SEATS = () => [
  { id: 'A', name: 'A', bot: false, index: 0 },
  { id: 'B', name: 'B', bot: false, index: 1 },
  { id: 'bot:1', name: 'Hopper', bot: true, index: 2 },
  { id: 'bot:2', name: 'Mabel', bot: true, index: 3 },
];

test('every page sees the others: players from presence, bots from the host 150 ms behind', () => {
  const hub = makeHub(SEATS());
  const a = makePage(hub, 'A');
  const b = makePage(hub, 'B');
  run(hub, 4);
  const ra = a.net.round.run;
  const rb = b.net.round.run;
  // B as A sees it, and the other way round.
  assert.ok(Math.abs(ra.byId.get('B').st.y - rb.me.sp.y) < 10);
  assert.ok(Math.abs(rb.byId.get('A').st.y - ra.me.sp.y) < 10);
  // Bots: simulated on A (the host), interpolated on B.
  assert.equal(ra.simBots, true);
  assert.equal(rb.simBots, false);
  for (const id of ['bot:1', 'bot:2']) {
    const real = ra.byId.get(id).sp;
    const seen = rb.byId.get(id).st;
    assert.ok(real.y > 100, `${id} climbed`);
    assert.ok(Math.abs(seen.y - real.y) < 150, `${id} on B is close to the host's (${seen.y} vs ${real.y})`);
  }
});

test('finishing goes through the host, once, for this round only', () => {
  const hub = makeHub(SEATS());
  const a = makePage(hub, 'A');
  const b = makePage(hub, 'B');
  run(hub, 1);
  const me = b.net.round.run.me;
  placeOn(me.sp, b.net.round.run.level, b.net.round.run.level.path.length);
  run(hub, 0.5);
  assert.ok(hub.m.data.fin.B > 0, 'B is in the finishes');
  assert.deepEqual(b.events.finished, ['B']);
  // A second call, or one for another round, is refused.
  const call = b.net.round && hub.rpcs.finish.get('B');
  assert.ok(call);
  const finish = (args) => {
    const d = hub.rpcs.finish.get(hub.hostId);
    return d.validate({ id: 'B' }, args);
  };
  assert.notEqual(finish({ r: 'm1.1', ms: 5000 }), true);
  assert.notEqual(finish({ r: 'old', ms: 5000 }), true);
  assert.notEqual(hub.rpcs.finish.get(hub.hostId).validate({ id: 'bot:1' }, { r: 'm1.1', ms: 1 }), true, 'bots never call it');
  // Every page reads the same finishes.
  assert.ok(a.net.finishes().B > 0);
  void a;
});

test('a new host takes the bots over from the last snapshot and keeps them climbing', () => {
  const hub = makeHub(SEATS());
  const a = makePage(hub, 'A');
  const b = makePage(hub, 'B');
  run(hub, 3);
  const snap = hub.state.bots;
  assert.ok(validBots(snap));
  // A's tab closes: B becomes the host.
  a.gone = true;
  hub.m.seats.find((s) => s.id === 'A').left = true;
  hub.hostId = 'B';
  run(hub, 0.1);
  const rb = b.net.round.run;
  assert.equal(rb.simBots, true);
  const before = rb.byId.get('bot:1').sp.y;
  const snapY = snap.b.find((e) => e[0] === 'bot:1')[2];
  assert.ok(Math.abs(before - snapY) < 80, 'adopted where the snapshot left it');
  run(hub, 3);
  assert.ok(rb.byId.get('bot:1').sp.y > before + 50, 'still climbing on the new host');
  assert.ok(hub.state.bots.t > snap.t, 'the new host writes snapshots');
});

test('a latecomer watches: no spider of its own, no presence', () => {
  const hub = makeHub(SEATS());
  makePage(hub, 'A');
  makePage(hub, 'B');
  run(hub, 2);
  const c = makePage(hub, 'C');
  run(hub, 1);
  assert.equal(c.net.round.run.me, null);
  assert.equal(hub.players.get('C').presence, null);
  assert.ok(c.net.round.run.byId.get('A').st.y > 50);
});

test('a leaver ranks below everyone still racing; the round ends when the rest finish or time runs out', () => {
  const hub = makeHub(SEATS());
  const a = makePage(hub, 'A');
  const b = makePage(hub, 'B');
  run(hub, 3);
  b.gone = true;
  hub.m.seats.find((s) => s.id === 'B').left = true;
  const ranking = a.net.ranking(a.match);
  assert.deepEqual(ranking[ranking.length - 1], ['B']);
  assert.equal(a.net.hostCheck(a.match), null);
  // A finishes; the bots haven't: the sun sets 20 s after the first finish.
  hub.m.data.fin.A = hub.m.elapsed;
  assert.equal(a.net.hostCheck(a.match), null);
  hub.m.elapsed += (CLOSE_AFTER + 1) * 1000;
  assert.ok(a.net.hostCheck(a.match));
  // The cup's rules wire the same check.
  const rules = cupRules(() => a.net);
  let ended = null;
  rules.onTick({ ...a.match, roundId: hub.m.roundId, data: hub.m.data, elapsed: hub.m.elapsed, present: a.match.present, seats: a.match.seats, endRound: (r) => (ended = r) });
  assert.ok(ended && ended[0].includes('A'));
});

test('bumps are applied only from someone close, once a second, and never forged', () => {
  const hub = makeHub(SEATS());
  const a = makePage(hub, 'A');
  const b = makePage(hub, 'B');
  run(hub, 2);
  const mine = b.net.round.run.me.sp;
  const rid = hub.m.roundId;
  // A far away: dropped.
  hub.players.get('A').presence = { v: 1, r: rid, x: mine.x, y: mine.y + 400, a: 0, m: 1, g: 30, h: 0, f: 1, d: 0 };
  b.net.update(null, 99);
  a.room.send({ t: 'bump', r: rid, id: 'B' }, { to: 'B' });
  assert.equal(b.events.bumped.length, 0);
  // Malformed or for another round: dropped.
  a.room.send({ t: 'bump', r: 'old', id: 'B' }, { to: 'B' });
  a.room.send({ t: 'bump', r: rid, id: { x: 1 } }, { to: 'B' });
  a.room.send('bump', { to: 'B' });
  assert.equal(b.events.bumped.length, 0);
  // A non-host pretending to be a bot: by is ignored, A itself is still far.
  a.room.send({ t: 'bump', r: rid, id: 'B', by: 'bot:1' }, { to: 'B' });
  assert.equal(b.events.bumped.length, 0);
  // Close: taken, then not again within the second.
  hub.players.get('A').presence = { v: 1, r: rid, x: mine.x + 10, y: mine.y + 12, a: 0, m: 1, g: 30, h: 0, f: 1, d: 0 };
  b.net.update(null, 100);
  mine.holding = false;
  a.room.send({ t: 'bump', r: rid, id: 'B' }, { to: 'B' });
  assert.deepEqual(b.events.bumped, ['B']);
  assert.equal(mine.mode, 'tumble');
  a.room.send({ t: 'bump', r: rid, id: 'B' }, { to: 'B' });
  assert.equal(b.events.bumped.length, 1);
});

test('presence, snapshots and round data are checked before use', () => {
  const level = { H: 5000 };
  const ok = { v: 1, r: 'x', x: 10, y: 200, a: 90, m: 0, g: 30, h: 1, f: -1, d: 0 };
  assert.deepEqual(readPresence(ok, 'x', level), { x: 10, y: 200, a: 90, m: 'surf', g: 3, h: true, f: -1, d: 0 });
  for (const bad of [null, [], { ...ok, v: 2 }, { ...ok, r: 'y' }, { ...ok, x: NaN }, { ...ok, y: 1e9 }, { ...ok, m: 9 }, { ...ok, g: 'x' }, { ...ok, f: 3 }]) {
    assert.equal(readPresence(bad, 'x', level), null);
  }
  const snap = { r: 'x', t: 100, b: [['bot:1', 0, 100, 0, 0, 30, 0, 1, 0]] };
  assert.ok(validBots(snap));
  assert.ok(validBots(null));
  assert.ok(!validBots({ ...snap, b: [['bot:1', 0, 100, 0, 0, 30, 0, 1]] }));
  assert.ok(!validBots({ ...snap, b: [['bot:1', 0, Infinity, 0, 0, 30, 0, 1, 0]] }));
  assert.ok(!validBots({ ...snap, b: new Array(9).fill(snap.b[0]) }));
  assert.ok(validRound({ s: 3, seed: 5, fin: { a: 1000 } }));
  assert.ok(!validRound({ s: 13, seed: 5, fin: {} }));
  assert.ok(!validRound({ s: 3, seed: 5, fin: { a: -1 } }));
  assert.ok(!validRound({ s: 3, seed: 5, fin: [] }));
});

test('bots in a race get the cup skill range, the best seat the strongest', () => {
  const seats = [{ id: 'p', bot: false }, { id: 'b1', bot: true }, { id: 'b2', bot: true }, { id: 'b3', bot: true }];
  const s = seatSkills(1, seats);
  assert.equal(s.size, 3);
  assert.ok(s.get('b1') >= s.get('b2') && s.get('b2') >= s.get('b3'));
  assert.ok([...s.values()].every((v) => v >= 0 && v <= 0.55));
});

test('the intro shows the spout the host will start', () => {
  const m = { phase: 'intro', round: 2, roundId: 'm7.2', settings: { cup: 3 }, data: null };
  const early = roundInfo(m);
  assert.ok(early && validRound(early));
  const d = cupRules(() => null).startRound(m);
  assert.deepEqual(early, d);
  assert.equal(roundInfo({ ...m, phase: 'lobby' }), null);
  assert.equal(roundInfo({ ...m, phase: 'round', data: { s: 4, seed: 9, fin: {} } }).s, 4);
});
