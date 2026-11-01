// Boot, the screens, input, the camera and everything that turns a run into sound and motion.

import { SEAT_LOOKS, GRIP_MAX, M, CLOSE_AFTER } from './config.js';
import { SPOUTS, CUPS, spoutById, cupById, starsFor } from './spouts.js';
import { createRun, advance, liveOrder } from './run.js';
import { createScene, createRain } from './scene.js';
import { createWater } from './water.js';
import { createFx, updateFx, spray, puff, sparks, confetti, addTrauma, hitStop, flash } from './fx.js';
import { createView, fitView, setCamera, screenTransform, toScreenX, toScreenY } from './view.js';
import { renderWorld, updatePuppets } from './draw.js';
import { drawHud, hudLayout } from './hud.js';
import { createUI, setInsets, tag, h, stars } from './ui.js';
import { startAudio, sfx, setRain, setMusic, setMusicWeather, suspendAudio } from './audio.js';
import { JOIN, INTRO, createNet, cupRules, roundInfo, stubOw, stubRoom, createLocalMatch } from './net.js';
import { rainAt, debrisComing } from './weather.js';
import { BOT_NAMES, createBrain, think } from './bot.js';
import { dayKey, daySeed } from './monsoon.js';
import { packGhost, unpackGhost, ghostAt, GHOST_HZ } from './ghost.js';
import { fmtTime, ORD, clamp } from './paint.js';
import { featuresIn, inPocket } from './level.js';
import { rankRace, pointsFor } from './race.js';

const params = new URLSearchParams(location.search);
const hasOw = typeof window.onceworlds === 'object' && window.onceworlds;

// ?debug outside Onceworlds: errors printed on screen, for browsers whose console can't be seen.
if (!hasOw && params.has('debug')) {
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:40%;overflow:auto;margin:0;padding:6px;font:11px monospace;background:rgba(120,0,0,.85);color:#fff;z-index:99;white-space:pre-wrap';
  const say = (t) => {
    if (!pre.isConnected) document.body.append(pre);
    pre.textContent += `${t}\n`;
  };
  window.addEventListener('error', (e) => say(`error: ${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => say(`rejection: ${e.reason && (e.reason.stack || e.reason)}`));
}

// ?poster=<name>: store art (poster.js). ?poster=screen-<name>[.WxH]: one of the game's screens staged as in real play, in a box
// of that size when one is given (a debug view to check layouts at phone sizes; players never reach it).
const POSTER = params.get('poster') ?? '';
const STAGE = /^screen-[a-z]+([.]\d{2,4}x\d{2,4})?$/.test(POSTER) ? POSTER : '';
if (POSTER && !STAGE) import('./poster.js').then((m) => m.runPoster(POSTER));
else
  boot().catch((err) => {
    console.error(err);
    if (STAGE) document.body.dataset.ready = 'error';
  });

async function boot() {
  const ow = STAGE ? stubOw() : hasOw || stubOw();
  const stageBox = (() => {
    const m = /[.](\d+)x(\d+)$/.exec(STAGE);
    return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
  })();
  // Join first, before anything heavy, so a reload never misses its seat.
  const roomPromise = joinRoom(ow);
  const AUTOPLAY = params.has('autoplay') && ow.mode !== 'production';
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  safe(() => ow.ui.setLook({ accent: '#FFB648', panel: '#16202C', text: '#F3EDE2' }));
  safe(() => ow.controls.set(null));

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false }) ?? canvas.getContext('2d');
  const uiRoot = document.getElementById('ui');
  const ui = createUI(uiRoot);
  const view = createView();
  const fx = createFx();
  const water = createWater();
  const puppets = new Map();
  const scenes = new Map();
  let rain = createRain(quality());
  let reserved = safe(() => ow.ui.reserved) ?? null;
  let layout = hudLayout(innerWidth, innerHeight, reserved, false);

  function quality() {
    return safe(() => ow.settings.quality) ?? 'high';
  }
  function reduced() {
    return !!safe(() => ow.settings.reducedMotion);
  }
  function touchMode() {
    return lastInput === 'touch' || !!safe(() => ow.controls.touch);
  }

  // ------------------------------------------------------------ saves

  let progress = {
    v: 1,
    tut: false,
    open: 1,
    stars: {},
    best: {},
    mon: { best: 0, day: '', dayBest: 0 },
    n: { held: 0, washes: 0, races: 0, wins: 0, cups: 0 },
  };
  let seen = {};
  const ghosts = new Map();
  const loadSaves = (async () => {
    try {
      const p = await ow.save.get('progress');
      if (p && typeof p === 'object') {
        progress.tut = !!p.tut;
        progress.open = clamp(Number(p.open) || 1, 1, 12);
        for (const s of SPOUTS) {
          const st = Number(p.stars?.[s.id]);
          if (st >= 1 && st <= 3) progress.stars[s.id] = st;
          const b = Number(p.best?.[s.id]);
          if (b > 1 && b < 1000) progress.best[s.id] = b;
        }
        if (p.mon && typeof p.mon === 'object') {
          progress.mon.best = Math.max(0, Number(p.mon.best) || 0);
          progress.mon.day = typeof p.mon.day === 'string' ? p.mon.day.slice(0, 10) : '';
          progress.mon.dayBest = Math.max(0, Number(p.mon.dayBest) || 0);
        }
        for (const k of Object.keys(progress.n)) progress.n[k] = Math.max(0, Number(p.n?.[k]) || 0);
      }
      const hs = await ow.save.get('hints');
      if (hs && typeof hs === 'object') for (const k of Object.keys(hs).slice(0, 40)) seen[k] = Number(hs[k]) || 1;
    } catch {
      /* fresh start */
    }
  })();
  let saveTimer = 0;
  function saveProgress() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      ow.save.set('progress', progress).catch(() => {});
      ow.save.set('hints', seen).catch(() => {});
    }, 600);
  }
  async function ghostFor(id) {
    if (ghosts.has(id)) return ghosts.get(id);
    let g = null;
    try {
      g = unpackGhost(await ow.save.get(`ghost-${id}`));
    } catch {
      g = null;
    }
    ghosts.set(id, g);
    return g;
  }
  const award = (id) => {
    try {
      ow.badges.award(id).catch(() => {});
    } catch {
      /* standalone */
    }
  };
  const submit = (board, score, opts) => {
    try {
      ow.leaderboards.submit(board, score, opts).catch(() => {});
    } catch {
      /* standalone */
    }
  };

  // ------------------------------------------------------------ the room, the match, the race layer

  let room = null;
  let match = null;
  let host = null;
  let net = null;
  let botsHelper = null;

  async function connect(promise) {
    room = await promise;
    let helpers = null;
    if (!room.stub) {
      try {
        const [m, hm, bm] = await Promise.all([import('/__onceworlds/v1/match.js'), import('/__onceworlds/v1/host.js'), import('/__onceworlds/v1/bots.js')]);
        helpers = { createMatch: m.createMatch, createHost: hm.createHost, t: hm.t, createBots: bm.createBots };
      } catch (err) {
        console.warn('[spider] helpers unavailable, racing alone', err);
      }
    }
    const fill = () => ((room.settings?.bots ?? 'fill') === 'off' ? 0 : 6);
    if (helpers) {
      host = helpers.createHost(room);
      net = createNet({ room, host, t: helpers.t, hooks: netHooks });
      match = helpers.createMatch(room, cupRules(() => net));
      botsHelper = helpers.createBots(match, { host, fill: fill(), names: BOT_NAMES, skill: [0.2, 0.8], think: () => null });
    } else {
      host = null;
      net = createNet({ room, host: null, t: null, hooks: netHooks });
      match = createLocalMatch(room, cupRules(() => net), { fill });
      botsHelper = null;
    }
    net.attach(match);
    match.on('phase', onPhase);
    match.on('results', onResults);
    room.on('settings', () => {
      botsHelper?.setFill?.(fill());
      if (flow === 'lobby') refreshLobby();
    });
    for (const ev of ['join', 'leave', 'host', 'rename', 'ready', 'away', 'back']) room.on(ev, () => flow === 'lobby' && refreshLobby());
    room.on('close', (reason) => {
      if (reason === 'left' || reason === 'moved') return;
      showClosed(reason);
    });
    room.on('reconnect', () => flow === 'lobby' && refreshLobby());
  }

  async function joinRoom(o) {
    if (!o.rooms || o.stub) return stubRoom();
    try {
      return await o.rooms.join(JOIN);
    } catch (err) {
      console.warn('[spider] join failed, playing alone', err);
      return stubRoom();
    }
  }

  const netHooks = {
    onRun(r) {
      if (flow === 'race' || inRacePhase()) useRun(r);
    },
    onFinish(r) {
      if (r.me) onMyFinish(r);
      else if (onScreen(r)) confettiAt(r);
    },
    onBumped(target, by) {
      if (target.me) {
        sfx('bump');
        addTrauma(fx, 0.35);
        hitStop(fx, 0.05);
      } else if (onScreen(target)) sfx('bump');
      void by;
    },
    onHazard(r, kind) {
      if (r.me || onScreen(r)) hazardFx(r, kind);
    },
  };

  // ------------------------------------------------------------ input

  const held = new Set();
  let jumpQueued = false;
  let lastInput = 'keys';
  const input = { x: 0, y: 0, jump: false, hold: false };
  const KEYMAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'jump',
    KeyK: 'jump',
    KeyJ: 'hold',
    ShiftLeft: 'hold',
    ShiftRight: 'hold',
  };
  const keyOf = (e) => KEYMAP[e.code] ?? (e.key === ' ' ? 'jump' : e.key === 'j' || e.key === 'J' ? 'hold' : null);
  addEventListener('keydown', (e) => {
    if (e.isTrusted && !e.repeat) lastInput = 'keys';
    const k = keyOf(e);
    const playing = isPlaying();
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
      if (canPause()) {
        e.preventDefault();
        setPaused(!paused);
      }
      return;
    }
    if (flow === 'title' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      e.preventDefault();
      play();
      return;
    }
    if (!k) return;
    // Keys are tracked all the time (Up held through the count-in climbs on GO); jumps only count in play.
    held.add(k);
    if (!playing) return;
    e.preventDefault();
    if (k === 'jump' && !e.repeat) jumpQueued = true;
  });
  addEventListener('keyup', (e) => {
    const k = keyOf(e);
    if (k) held.delete(k);
  });
  addEventListener('blur', () => held.clear());
  addEventListener(
    'pointerdown',
    (e) => {
      lastInput = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'keys';
      startAudio();
    },
    { capture: true },
  );

  function readInput() {
    input.x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    input.y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
    input.hold = held.has('hold');
    input.jump = jumpQueued;
    jumpQueued = false;
    return input;
  }

  // The trailer's autopilot: the local spider is driven by the sharpest bot brain.
  let autoBrain = null;
  function autoInput(r, dt) {
    if (!autoBrain || autoBrain.key !== r.id + curRun?.seed) {
      autoBrain = createBrain('Juniper', 0.97, `auto:${curRun?.seed}`);
      autoBrain.key = r.id + curRun?.seed;
    }
    const o = think(autoBrain, r.sp, curRun.level, curRun.weather, curRun.t, dt, curRun.seed);
    input.x = o.x;
    input.y = o.y;
    input.jump = o.jump;
    input.hold = o.hold;
    return input;
  }

  // ------------------------------------------------------------ flows

  let flow = 'boot';
  let curRun = null; // the run on screen
  let lobbyRun = null;
  let lobbyKey = '';
  let attract = null;
  let paused = false;
  let solo = null; // { id, tutorial, ghost, doneAt }
  let mon = null; // { day, doneAt }
  let hint = { text: '', age: 0, life: 0, target: null, key: '' };
  let count = null;
  let roundShown = '';

  const isPlaying = () => (flow === 'solo' || flow === 'monsoon' || (flow === 'race' && match?.phase === 'round' && !match.spectating && !!curRun?.me)) && !paused;
  const canPause = () => flow === 'solo' || flow === 'monsoon';
  const inRacePhase = () => !!match && ['intro', 'round', 'roundEnd', 'results'].includes(match.phase);
  const amRacing = () => !!match && !!match.me && !match.spectating;

  function useRun(r) {
    curRun = r;
    puppets.clear();
    if (!scenes.has(r.level)) scenes.set(r.level, createScene(r.level, { facade: r.def.facade }));
    camSnap = true;
  }

  function setControls(on) {
    safe(() =>
      ow.controls.set(
        on
          ? {
              stick: 'wasd',
              buttons: [
                { id: 'hold', label: 'Hold', key: 'j' },
                { id: 'jump', label: 'Jump', key: ' ' },
              ],
            }
          : null,
      ),
    );
  }
  const hideLobby = (on) => safe(() => room?.hideLobby?.(on));

  function showTitle() {
    flow = 'title';
    clearHint();
    hideLobby(true);
    setControls(false);
    setMusic('menu');
    newAttract();
    ui.show('title', (el) => {
      el.append(
        h('div', { class: 'sign', style: '--silk:44px' }, h('span', { class: 'l1', text: 'Itsy Bitsy' }), h('span', { class: 'l2', text: 'Spider' })),
        tag('Play', { main: true, silk: 18, delay: 200, onclick: play, cls: 'play' }),
      );
    });
  }

  function newAttract() {
    const pick = [1, 2, 4, 5, 8, 6][Math.floor(Math.random() * 6)];
    const seats = ['Hopper', 'Mabel', 'Dash', 'Velvet'].map((name, i) => ({ id: `a${i}`, name, bot: true, skill: [0.45, 0.62, 0.78, 0.92][i], index: i + 1 }));
    attract = createRun({ kind: 'attract', spout: pick, seed: Math.floor(Math.random() * 1e6), seats });
    attract.until = 0;
    useRun(attract);
  }

  let starting = false;
  async function play() {
    if (starting || flow !== 'title') return;
    starting = true;
    startAudio();
    sfx('ui');
    await loadSaves;
    starting = false;
    if (flow !== 'title') return;
    if (AUTOPLAY) progress.tut = true;
    if (inRacePhase()) enterRace(); // a race is on: watch it, and race from the next one
    else if (!progress.tut) startSolo(1, true);
    else toLobby();
  }

  function toLobby() {
    flow = 'lobby';
    clearHint();
    paused = false;
    solo = null;
    mon = null;
    hideLobby(false);
    setControls(false);
    setMusic('menu');
    setMusicWeather('sun');
    lobbyKey = '';
    refreshLobby(true);
    if (!seen.lobby) setTimeout(() => flow === 'lobby' && showHint('lobby', 'Ready to race', 'Ready to race', { target: 'lobby', life: 4 }), 900);
  }

  function lobbySeats() {
    const list = [];
    const players = room ? [...room.players.values()].filter((p) => p.connected !== false) : [];
    players.sort((a, b) => (a.id === room.me.id ? -1 : b.id === room.me.id ? 1 : 0));
    players.slice(0, 6).forEach((p, i) => list.push({ id: p.id, name: p.name ?? 'Player', me: p.id === room.me.id, index: i, ready: !!p.ready || p.id === room.host }));
    const fillBots = (room?.settings?.bots ?? 'fill') !== 'off';
    const humans = list.length;
    for (let i = humans; i < 6 && fillBots; i++) list.push({ id: `pv${i}`, name: BOT_NAMES[i - humans], bot: true, index: i, skill: 0.5 });
    return list;
  }

  function cupNow() {
    return cupById(Number(room?.settings?.cup) || 1);
  }

  let lobbyEls = null;
  function refreshLobby(rebuild = false) {
    if (flow !== 'lobby' && flow !== 'spouts') return;
    const cup = cupNow();
    const seats = lobbySeats();
    const key = `${cup.id}|${seats.map((s) => `${s.id}:${s.name}`).join(',')}`;
    if (key !== lobbyKey || !lobbyRun) {
      lobbyKey = key;
      lobbyRun = createRun({ kind: 'lobby', spout: cup.spouts[0], seed: 1, seats: seats.map((s) => ({ ...s, me: false })) });
      lobbyRun.seatsInfo = seats;
      lobbyRun.facing = seats.map((s, i) => (i % 2 ? -1 : 1));
      for (const r of lobbyRun.racers) r.st.f = lobbyRun.facing[r.index] ?? 1;
      useRun(lobbyRun);
    } else lobbyRun.seatsInfo = seats;
    if (flow !== 'lobby') return;
    const isHost = !!room?.isHost && room.match?.phase !== 'playing';
    if (!rebuild && lobbyEls) {
      lobbyEls.cupName.textContent = cup.name;
      lobbyEls.cupSub.textContent = cup.spouts.map((id) => spoutById(id).name).join(' · ');
      lobbyEls.bots.querySelector('.face').textContent = `Bots: ${(room?.settings?.bots ?? 'fill') === 'off' ? 'Off' : 'Fill'}`;
      lobbyEls.prev.hidden = !isHost;
      lobbyEls.next.hidden = !isHost;
      lobbyEls.bots.disabled = !isHost;
      lobbyEls.invite.hidden = !(room && !room.stub && room.players.size < 6);
      return;
    }
    ui.show('lobby', (el) => {
      const cupName = h('span', { class: 'big', text: cup.name });
      const cupSub = h('span', { class: 'sub', text: cup.spouts.map((id) => spoutById(id).name).join(' · ') });
      const prev = tag('‹', { small: true, silk: 30, label: 'Previous cup', onclick: () => changeCup(-1), cls: 'arrow' });
      const next = tag('›', { small: true, silk: 30, label: 'Next cup', onclick: () => changeCup(1), cls: 'arrow' });
      const cupTag = tag(h('span', { class: 'stack' }, cupName, cupSub), { silk: 30, cls: 'cup' });
      const bots = tag(`Bots: ${(room?.settings?.bots ?? 'fill') === 'off' ? 'Off' : 'Fill'}`, { small: true, silk: 54, onclick: toggleBots, cls: 'bots' });
      const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
      const monLabel = progress.mon.best > 0 ? `Monsoon ${Math.floor(progress.mon.best)} m` : 'Monsoon';
      const invite = tag('+ Invite', { small: true, silk: 20, onclick: () => safe(() => ow.ui.showInvite()), cls: 'invite' });
      el.append(
        h('div', { class: 'cuprow' }, prev, cupTag, next),
        h('div', { class: 'botrow' }, bots),
        h(
          'div',
          { class: 'solorow' },
          tag(h('span', { class: 'withstar' }, 'Spouts', h('span', { class: 'star on', style: 'font-size:20px' }), `${totalStars}/36`), { silk: 34, onclick: showSpouts, cls: 'spouts', label: `Spouts, ${totalStars} of 36 stars` }),
          tag(monLabel, { silk: 46, onclick: startMonsoon, cls: 'monsoon' }),
          invite,
        ),
      );
      lobbyEls = { cupName, cupSub, prev, next, bots, invite };
      prev.hidden = !isHost;
      next.hidden = !isHost;
      bots.disabled = !isHost;
      invite.hidden = !(room && !room.stub && room.players.size < 6);
    });
  }

  function changeCup(d) {
    if (!room?.isHost) return;
    sfx('ui');
    const id = ((cupNow().id - 1 + d + CUPS.length) % CUPS.length) + 1;
    safe(() => room.setSetting('cup', id));
    safe(() => room.clearReady?.());
    if (room.stub) room.settings.cup = id;
    refreshLobby();
  }
  function toggleBots() {
    if (!room?.isHost) return;
    sfx('ui');
    const v = (room.settings?.bots ?? 'fill') === 'off' ? 'fill' : 'off';
    safe(() => room.setSetting('bots', v));
    safe(() => room.clearReady?.());
    refreshLobby();
  }

  function showSpouts() {
    sfx('ui');
    flow = 'spouts';
    clearHint();
    hideLobby(true);
    ui.show('spouts', (el) => {
      const grid = h('div', { class: 'grid' });
      for (const s of SPOUTS) {
        const open = s.id <= progress.open;
        const best = progress.best[s.id];
        const b = tag(
          h('span', { class: 'stack' }, h('span', { class: 'num', text: String(s.id) }), h('span', { class: 'name', text: s.name }), open ? stars(progress.stars[s.id] ?? 0, 15) : h('span', { class: 'lock', text: 'Locked' }), best ? h('span', { class: 'best', text: fmtTime(best) }) : null),
          { small: true, silk: 10 + (s.id % 3) * 6, delay: s.id * 25, disabled: !open, onclick: open ? () => startSolo(s.id, false) : null, cls: `spout ${open ? '' : 'locked'}` },
        );
        grid.append(b);
      }
      el.append(grid, tag('Back', { main: true, silk: 16, onclick: toLobby, cls: 'back' }));
    });
  }

  async function startSolo(id, tutorial) {
    sfx('ui');
    const def = spoutById(id);
    const name = room?.me?.name ?? 'You';
    const r = createRun({ kind: tutorial ? 'tutorial' : 'solo', spout: def.id, seed: 1000 + def.id, seats: [{ id: 'me', name, me: true, index: 0 }] });
    flow = 'solo';
    clearHint();
    paused = false;
    solo = { id: def.id, tutorial, ghost: null, doneAt: 0 };
    mon = null;
    useRun(r);
    hideLobby(true);
    setControls(true);
    setMusic('race');
    soloScreen(def.name);
    flyover = { from: r.level.H - 200, t: 0, dur: tutorial ? 2.2 : 1.4 };
    ghostFor(def.id).then((g) => {
      if (solo && solo.id === def.id) solo.ghost = g;
    });
    blurButtons();
  }

  function startMonsoon() {
    sfx('ui');
    const day = dayKey(safe(() => ow.now()) ?? Date.now());
    const r = createRun({ kind: 'monsoon', monsoonSeed: daySeed(day), seats: [{ id: 'me', name: room?.me?.name ?? 'You', me: true, index: 0 }] });
    flow = 'monsoon';
    clearHint();
    paused = false;
    solo = null;
    mon = { day, doneAt: 0 };
    if (progress.mon.day !== day) {
      progress.mon.day = day;
      progress.mon.dayBest = 0;
    }
    useRun(r);
    hideLobby(true);
    setControls(true);
    setMusic('race');
    soloScreen('Monsoon');
    flyover = null;
    setTimeout(() => flow === 'monsoon' && showHint('flood', 'The flood rises', 'The flood rises', { life: 2.5 }), 1200);
    blurButtons();
  }

  /** The climb's screen: its name for a moment, and a pause tag (the only way to pause on a phone besides the menu). */
  function soloScreen(name) {
    ui.show('solo', (el) => {
      if (name) el.append(tag(name, { silk: 30, cls: 'spoutname fade' }));
      el.append(tag('II', { small: true, silk: 8, label: 'Pause', onclick: () => setPaused(true), cls: 'pausebtn' }));
    });
  }

  function blurButtons() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function setPaused(on) {
    if (!canPause() || paused === on) return;
    paused = on;
    held.clear();
    if (on) {
      setControls(false);
      ui.show('pause', (el) =>
        el.append(
          h('div', { class: 'card' }, tag('Paused', { silk: 40, cls: 'heading' }), h('div', { class: 'buttons' }, tag('Resume', { main: true, silk: 16, onclick: () => setPaused(false) }), tag('Restart', { silk: 22, onclick: restart }), tag('Back', { silk: 28, onclick: toLobby }))),
        ),
      );
    } else {
      setControls(flow === 'solo' || flow === 'monsoon');
      soloScreen('');
      blurButtons();
    }
  }

  function restart() {
    paused = false;
    if (flow === 'monsoon' || mon) startMonsoon();
    else if (solo) startSolo(solo.id, solo.tutorial);
  }

  // ------------------------------------------------------------ the match

  function onPhase(p, prev) {
    if (p === 'intro' || p === 'round') {
      if (amRacing()) {
        if (flow !== 'race') enterRace();
      } else if (flow === 'lobby' || flow === 'spouts') enterRace();
      if (p === 'intro') showSpoutTag();
      if (p === 'round' && flow === 'race') {
        ui.show('race', () => {});
        if (prev === 'intro') {
          count = { text: 'GO', age: 0 };
          sfx('go');
        }
      }
    } else if (p === 'roundEnd') {
      if (flow === 'race') showRoundEnd();
    } else if (p === 'results') {
      if (flow === 'race') showCupResults();
    } else if (p === 'lobby') {
      net?.clear();
      if (flow === 'race') toLobby();
      else if (flow === 'lobby') refreshLobby();
    }
    if (flow === 'race') hideLobby(true);
  }

  function enterRace() {
    flow = 'race';
    clearHint();
    paused = false;
    solo = null;
    mon = null;
    roundShown = '';
    hideLobby(true);
    setMusic('race');
    setControls(amRacing());
    blurButtons();
    if (net?.round) useRun(net.round.run);
  }

  function showSpoutTag() {
    const info = roundInfo(match);
    if (flow !== 'race' || !info) return;
    const id = match.roundId;
    if (roundShown === id) return;
    roundShown = id;
    const cup = cupById(Number(match.settings?.cup) || 1);
    const s = spoutById(info.s);
    ui.show('intro', (el) =>
      el.append(
        tag(h('span', { class: 'stack' }, h('span', { class: 'big', text: s.name }), h('span', { class: 'sub' }, ...cup.spouts.map((sid, i) => h('span', { class: sid === s.id ? 'lit' : '', text: `${i ? ' · ' : ''}${spoutById(sid).name}` })))), { silk: 34, cls: 'spoutname' }),
      ),
    );
    setControls(amRacing());
  }

  /** A seat's colour and pattern: as its spider wore them in the race (its place in the seat list). */
  function lookOf(id) {
    const r = net?.round?.run.byId.get(id);
    if (r) return r.look;
    const i = match.seats.findIndex((x) => x.id === id);
    return SEAT_LOOKS[Math.max(0, i) % SEAT_LOOKS.length];
  }

  function showRoundEnd() {
    const last = match.last;
    if (!last) return;
    setControls(false);
    const me = match.me;
    let myPlace = 0;
    last.ranking.forEach((g, i) => g.includes(me?.id) && (myPlace = i + 1));
    if (me && !match.spectating) {
      progress.n.races++;
      const mine = curRun?.me;
      if (myPlace === 1) {
        progress.n.wins++;
        award('out-came-the-sun');
        if (mine?.sp?.stats.washes > 0) award('up-the-spout-again');
        submit('races-won', progress.n.wins);
      }
      saveProgress();
    }
    const rows = [];
    let place = 1;
    for (const g of last.ranking) {
      for (const id of g) {
        const seat = match.seats.find((s) => s.id === id);
        rows.push({ id, place, name: seat?.name ?? '?', pts: last.points[id] ?? 0, me: id === me?.id, look: lookOf(id) });
      }
      place += g.length;
    }
    ui.show('roundend', (el) => {
      const list = h('div', { class: 'places' });
      rows.slice(0, 6).forEach((r, i) => {
        list.append(
          tag(h('span', { class: 'row' }, h('span', { class: 'pl', text: ORD(r.place) }), h('i', { class: `mark ${r.look.mark}`, style: `--c:${r.look.color}` }), h('span', { class: 'nm', text: r.name }), h('span', { class: 'pts', text: `+${r.pts}` })), {
            silk: 14 + i * 9,
            delay: 120 * i,
            small: true,
            cls: r.me ? 'mine' : '',
          }),
        );
      });
      const nextId = match.round < match.rounds ? cupById(Number(match.settings?.cup) || 1).spouts[match.round] : 0;
      el.append(list, nextLine(nextId ? `Next · ${spoutById(nextId).name}` : 'Cup podium'));
    });
    if (myPlace === 1 && !match.spectating) sfx('fanfare');
  }

  function showCupResults() {
    const res = match.results ?? match.standings;
    if (!res?.length) return;
    setControls(false);
    const me = match.me;
    const top = res.slice(0, 3);
    const mine = res.find((s) => s.id === me?.id);
    ui.show('results', (el) => {
      const pod = h('div', { class: 'podium' });
      for (const [i, s] of top.entries()) {
        const look = lookOf(s.id);
        pod.append(
          tag(h('span', { class: 'stack' }, h('span', { class: 'big', text: ORD(s.place) }), h('span', { class: 'nm' }, h('i', { class: `mark ${look.mark}`, style: `--c:${look.color}` }), s.name), h('span', { class: 'sub', text: `${s.points} pts` })), {
            silk: [70, 30, 100][i],
            delay: [400, 0, 800][i],
            cls: `p${i + 1} ${s.id === me?.id ? 'mine' : ''}`,
          }),
        );
      }
      const rest = h('div', { class: 'places' });
      res.slice(3, 6).forEach((s, i) => {
        const look = lookOf(s.id);
        rest.append(
          tag(h('span', { class: 'row' }, h('span', { class: 'pl', text: ORD(s.place) }), h('i', { class: `mark ${look.mark}`, style: `--c:${look.color}` }), h('span', { class: 'nm', text: s.name }), h('span', { class: 'pts', text: `${s.points} pts` })), {
            silk: 10,
            delay: 1000 + 120 * i,
            small: true,
            cls: s.id === me?.id ? 'mine' : '',
          }),
        );
      });
      const host = room?.isHost && room.kind !== 'public' && match.isHost;
      const end = host ? tag(h('span', { class: 'withsecs' }, 'Lobby', secsEl()), { main: true, silk: 16, onclick: () => safe(() => match.skip()), cls: 'continue' }) : nextLine('Lobby');
      el.append(h('div', { class: 'cuptable' }, pod, h('div', { class: 'tablecol' }, rest, end)));
    });
    if (top[0] && curRun) {
      const r = curRun.byId.get(top[0].id);
      if (r) confettiAt(r, 70);
    }
  }

  /** The seconds left of a round-end card or the results, kept live by the frame loop. */
  let secsShown = [];
  function secsEl() {
    const el = h('span', { class: 'secs', text: String(Math.max(0, Math.ceil(match?.secondsLeft ?? 0))) });
    secsShown = [...secsShown.filter((x) => x.isConnected), el];
    return el;
  }
  /** What comes next after this card: a label and its seconds. */
  function nextLine(text) {
    return h('div', { class: 'nextline' }, h('span', { text }), secsEl());
  }

  function onResults(standings, mine) {
    if (!mine) return;
    if (mine.place === 1) {
      progress.n.cups++;
      award('cup-winner');
      sfx('fanfare');
    }
    saveProgress();
  }

  function showClosed(reason) {
    flow = 'closed';
    setControls(false);
    const text = reason === 'kicked' ? 'You were removed' : reason === 'replaced' ? 'Playing in another tab' : 'Connection lost';
    const button = reason === 'kicked' ? 'Play' : reason === 'replaced' ? 'Play here' : 'Rejoin';
    ui.show('closed', (el) =>
      el.append(
        h(
          'div',
          { class: 'card' },
          tag(text, { silk: 40, cls: 'heading' }),
          tag(button, {
            main: true,
            silk: 16,
            onclick: async () => {
              ui.show('closed', null);
              try {
                match?.dispose?.();
                host?.dispose?.();
              } catch {
                /* already gone */
              }
              await connect(joinRoom(ow));
              toLobby();
            },
          }),
        ),
      ),
    );
  }

  // ------------------------------------------------------------ finishing, effects

  function onMyFinish(r) {
    sfx('finish');
    flash(fx, 0.5);
    addTrauma(fx, 0.2);
    confettiAt(r, 50);
    setControls(false);
    if (flow === 'solo' && solo) finishSolo(r);
  }

  function finishSolo(r) {
    const id = solo.id;
    const time = Math.round(r.finish * 100) / 100; // as kept and shown everywhere
    const prevBest = progress.best[id];
    const newBest = !prevBest || time < prevBest;
    const n = starsFor(id, time);
    progress.best[id] = newBest ? time : prevBest;
    progress.stars[id] = Math.max(progress.stars[id] ?? 0, n);
    progress.open = Math.max(progress.open, Math.min(12, id + 1));
    if (solo.tutorial) progress.tut = true;
    award('first-climb');
    if (r.sp.stats.washes === 0) award('no-washouts');
    if (SPOUTS.every((s) => progress.best[s.id])) award('twelve-spouts');
    if (SPOUTS.every((s) => progress.stars[s.id] === 3)) award('all-stars');
    submit(`spout-${id}`, Math.round(time * 100) / 100, { lowerIsBetter: true });
    if (newBest && curRun?.recorder) {
      const g = packGhost(curRun.recorder, time);
      ghosts.set(id, unpackGhost(g));
      ow.save.set(`ghost-${id}`, g).catch(() => {});
    }
    saveProgress();
    solo.doneAt = performance.now() / 1000;
    const tutorial = solo.tutorial;
    setTimeout(() => {
      if (flow !== 'solo' || !solo || solo.id !== id) return;
      flow = 'solo-done';
      paused = false;
      ui.show('finish', (el) => {
        const nextId = id < 12 ? id + 1 : 0;
        el.append(
          h(
            'div',
            { class: 'card' },
            tag(h('span', { class: 'stack' }, h('span', { class: 'big', text: fmtTime(time) }), stars(n, 30, true), h('span', { class: 'sub', text: newBest && prevBest ? `New best · was ${fmtTime(prevBest)}` : prevBest ? `Best ${fmtTime(prevBest)}` : spoutById(id).name })), { silk: 40, cls: 'timecard' }),
            h(
              'div',
              { class: 'buttons' },
              tutorial ? tag('Race', { main: true, silk: 16, onclick: toLobby }) : nextId ? tag('Next', { main: true, silk: 16, onclick: () => startSolo(nextId, false) }) : null,
              tag('Again', { main: !tutorial && !nextId, silk: 22, onclick: () => startSolo(id, false) }),
              tutorial ? null : tag('Back', { silk: 28, onclick: toLobby }),
            ),
          ),
        );
        n &&
          [0, 1, 2].slice(0, n).forEach((i) =>
            setTimeout(() => sfx('star', i), 300 + i * 260),
          );
      });
    }, 1400);
  }

  function endMonsoon(r) {
    if (!mon || mon.doneAt) return;
    mon.doneAt = performance.now() / 1000;
    const m = Math.floor(curRun.best / M);
    sfx('flood');
    addTrauma(fx, 0.5);
    spray(fx, r.sp.x, curRun.mon.flood, 30, Math.PI / 2, 1, 420);
    setControls(false);
    const prevBest = progress.mon.best;
    progress.mon.best = Math.max(prevBest, m);
    progress.mon.dayBest = Math.max(progress.mon.dayBest, m);
    if (m >= 100) award('monsoon-100');
    submit('monsoon', m);
    saveProgress();
    setTimeout(() => {
      if (flow !== 'monsoon') return;
      flow = 'monsoon-done';
      paused = false;
      ui.show('finish', (el) =>
        el.append(
          h(
            'div',
            { class: 'card' },
            tag(h('span', { class: 'stack' }, h('span', { class: 'big', text: `${m} m` }), h('span', { class: 'sub', text: m > prevBest && prevBest ? `New best · was ${prevBest} m` : progress.mon.dayBest > m ? `Best ${progress.mon.best} m · today ${progress.mon.dayBest} m` : `Best ${progress.mon.best} m · best today` })), { silk: 40, cls: 'timecard' }),
            h('div', { class: 'buttons' }, tag('Again', { main: true, silk: 16, onclick: startMonsoon }), tag('Back', { silk: 26, onclick: toLobby })),
          ),
        ),
      );
    }, 1300);
  }

  function confettiAt(r, n = 36) {
    if (reduced()) return;
    confetti(fx, r.st.x, r.st.y + 10, n, [r.look.color, '#FFB648', '#F3EDE2', '#FFD27A']);
  }

  function hazardFx(r, kind) {
    if (kind === 'debris') {
      sparks(fx, r.st.x, r.st.y + 10, 10);
      sfx('debris');
    } else if (kind === 'bird') {
      sfx('peck');
      puff(fx, r.st.x, r.st.y, 6);
    }
    if (r.me) {
      addTrauma(fx, 0.4);
      hitStop(fx, 0.06);
    }
  }

  const onScreen = (r) => r.st.y > view.y0 - 50 && r.st.y < view.y1 + 50;

  // Effects from what the spiders do (the same for every spider, wherever its state comes from).
  const was = new Map();
  function transitions(run) {
    for (const r of run.racers) {
      const st = r.st;
      let w = was.get(r.id);
      if (!w || w.run !== run) {
        was.set(r.id, (w = { run, m: st.m, h: st.h }));
        continue;
      }
      if (w.m !== st.m && onScreen(r)) {
        const near = r.me ? 1 : 0.5;
        if (st.m === 'air') puff(fx, st.x, st.y - 8, 3);
        else if (w.m === 'air' && st.m === 'surf') puff(fx, st.x, st.y - 10, 4);
        else if (st.m === 'washed') spray(fx, st.x, st.y, 14 * near, Math.PI / 2, 1.3, 300);
        else if (st.m === 'dazed') {
          sparks(fx, st.x, st.y - 10, 6);
          if (!r.me) sfx('caught');
        }
      }
      if (st.h && !w.h && !r.me && onScreen(r)) spray(fx, st.x, st.y, 3, Math.PI / 2, 0.8, 80);
      w.m = st.m;
      w.h = st.h;
    }
  }

  // The local spider's own events: sounds, shake and haptics.
  function myEvents(r) {
    const sp = r.sp;
    if (!sp) return;
    for (const e of sp.events) {
      switch (e.type) {
        case 'step':
          sfx('step');
          break;
        case 'hold':
          sfx('hold');
          break;
        case 'release':
          sfx('release');
          break;
        case 'leg':
          sfx('leg', e.n ?? 0);
          break;
        case 'outOfGrip':
          sfx('outOfGrip');
          addTrauma(fx, 0.15);
          break;
        case 'jump':
          sfx('jump');
          break;
        case 'land':
          sfx('land');
          if ((e.impact ?? 0) > 500) addTrauma(fx, 0.15);
          break;
        case 'splashOver':
          sfx('splashOver');
          spray(fx, sp.x, sp.y + 8, 8, Math.PI / 2, 1.4, 260);
          break;
        case 'survived':
          progress.n.held++;
          if (progress.n.held >= 10) award('hold-on');
          washedLast = false;
          saveProgress();
          break;
        case 'washed':
          sfx('washed');
          addTrauma(fx, 0.45);
          hitStop(fx, 0.07);
          progress.n.washes++;
          washedLast = true;
          showHint('holdWhen', 'Hold when it hits', 'Hold when it hits', { life: 2.4 });
          safe(() => navigator.vibrate?.(40));
          break;
        case 'caught':
          sfx('caught');
          addTrauma(fx, 0.25);
          if ((e.drop ?? 0) >= 1000) award('washed-out');
          break;
        case 'washEnd':
          if ((e.drop ?? 0) >= 1000) award('washed-out');
          break;
        case 'recover':
          sfx('recover');
          break;
        case 'shrug':
          sfx('shrug');
          break;
        case 'knocked':
          if (e.kind === 'bump') sfx('bump');
          addTrauma(fx, 0.35);
          safe(() => navigator.vibrate?.(30));
          break;
        default:
          break;
      }
    }
    sp.events.length = 0;
  }

  // ------------------------------------------------------------ hints (2-5 words, once, at the moment they matter)

  /** A screen change takes the last screen's hint away. */
  function clearHint() {
    hint.age = hint.life;
  }

  function showHint(key, keysText, touchText, opts = {}) {
    if (STAGE || (AUTOPLAY && params.has('nohints'))) return false;
    const count = seen[key] ?? 0;
    if (count >= (opts.times ?? 1) && !opts.always) return false;
    if (hint.key === key && hint.age < hint.life) return true;
    seen[key] = count + 1;
    saveProgress();
    const touch = touchMode();
    // Keyboard hints name the key; touch hints name the button and point at it. Arrows to places in the world point on both.
    const t = opts.target ?? null;
    hint = { key, text: touch ? touchText : keysText, age: 0, life: opts.life ?? 2.2, target: touch || t === 'lobby' || t?.wx != null ? t : null };
    return true;
  }

  function hintTarget(target) {
    if (!target) return null;
    if (typeof target === 'object') return target.wx != null ? { x: toScreenX(view, target.wx), y: toScreenY(view, target.wy) } : null;
    const list = reserved ?? [];
    const area = list.find((r) => r.kind === target);
    if (area) return { x: area.x + area.w * (target === 'buttons' ? 0.7 : 0.5), y: area.y + area.h * 0.5 };
    if (target === 'buttons') return { x: w - 80, y: hgt - 90 };
    if (target === 'stick') return { x: 90, y: hgt - 110 };
    if (target === 'lobby') return { x: w / 2, y: hgt - 44 };
    return null;
  }

  const rinfo = {};
  let warnWave = -1;
  let flushWave = -1;
  let holdAfter = 0;
  let washedLast = false;
  let lightningAt = 0;
  let sunNow = false; // this spider is at the top and the sky has cleared for it
  function playHints(r, dt) {
    const sp = r.sp;
    if (!sp || !curRun || r.finish) return;
    const tut = solo?.tutorial;
    if (tut && sp.y < 120 && curRun.t > 0.3) showHint('climb', 'Up to climb', 'Push up to climb', { target: 'stick', life: 3 });
    rainAt(curRun.weather, sp.y, curRun.t, rinfo);
    if (rinfo.warn && rinfo.next > 0.8) showHint('rain', 'Rain coming', 'Rain coming', { life: 1.4 });
    // Hold: taught in the tutorial, then again only after a wash-out.
    if (rinfo.warn && rinfo.next < 0.7 && !sp.holding && !inPocket(curRun.level, sp.x, sp.y) && (tut || washedLast)) {
      showHint('hold', 'Hold J', 'Hold!', { target: 'buttons', life: 1, times: 6 });
    }
    if (!rinfo.wet && sp.holding && !rinfo.warn) {
      holdAfter += dt;
      if (holdAfter > 0.6) showHint('letgo', 'Let go to climb', 'Let go to climb', { life: 1.6, times: 2 });
    } else holdAfter = 0;
    if (rinfo.warn && curRun.level.pocketAnchors.length) {
      for (const a of curRun.level.pocketAnchors) {
        if (a.y > sp.y + 20 && a.y < sp.y + 320) {
          if (showHint('dry', 'Dry spot', 'Dry spot', { life: 1.8, target: { wx: a.x, wy: a.y } })) break;
        }
      }
    }
    if (curRun.t > 14 || featuresIn(curRun.level, 'bracket', sp.y + 40, sp.y + 260).length) showHint('jump', 'Space to jump', 'Tap Jump', { target: 'buttons', life: 2.2 });
    if (featuresIn(curRun.level, 'moss', sp.y, sp.y + 300).length) showHint('moss', 'Moss: no grip', 'Moss: no grip', { life: 2 });
    if (featuresIn(curRun.level, 'seam', sp.y, sp.y + 320).length) showHint('bird', 'Mind the bird', 'Mind the bird', { life: 2 });
    if (featuresIn(curRun.level, 'vent', sp.y - 100, sp.y + 200).length) showHint('vent', 'Warm air lifts jumps', 'Warm air lifts jumps', { life: 2.2 });
  }

  // ------------------------------------------------------------ the loop

  let camSnap = true;
  let camY = 0;
  let camX = 0;
  let flyover = null;
  let calm = 1;
  let gloom = 0;
  let lastReal = performance.now() / 1000;
  let lastCount = '';
  let w = 0;
  let hgt = 0;
  const hudState = { weather: { calm: 1, warnK: 0, next: 9, kind: '', wet: false, left: 0, dur: 1 } };
  const debrisMarks = [];
  const debrisList = [];

  function resize() {
    w = stageBox?.w ?? Math.max(1, innerWidth);
    hgt = stageBox?.h ?? Math.max(1, innerHeight);
    // What the CSS would ask the viewport (see style.css): set from this page's own size.
    uiRoot.classList.toggle('short', hgt <= 460);
    uiRoot.classList.toggle('wide', w / hgt >= 1.2);
    uiRoot.style.setProperty('--vw', `${w / 100}px`);
    if (STAGE) {
      reserved = stageAreas();
      if (stageBox) Object.assign(uiRoot.style, { right: 'auto', bottom: 'auto', width: `${w}px`, height: `${hgt}px` });
    }
    let pr = safe(() => ow.settings.pixelRatio(2)) ?? Math.min(devicePixelRatio || 1, 2);
    pr = Math.min(pr, Math.sqrt(3.6e6 / (w * hgt)));
    fitView(view, w, hgt, pr);
    canvas.width = view.Wd;
    canvas.height = view.Hd;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${hgt}px`;
    layout = hudLayout(w, hgt, reserved, touchMode());
    setInsets(uiRoot, w, hgt, reserved);
  }
  addEventListener('resize', resize);
  resize();
  safe(() =>
    ow.on('reserved', (areas) => {
      reserved = areas;
      layout = hudLayout(w, hgt, reserved, touchMode());
      setInsets(uiRoot, w, hgt, reserved);
    }),
  );
  safe(() =>
    ow.settings.on('change', () => {
      rain = createRain(quality());
      fx.reduced = reduced();
      fx.density = quality() === 'low' ? 0.5 : 1;
      document.body.classList.toggle('reduced', fx.reduced);
      resize();
    }),
  );
  fx.reduced = reduced();
  fx.density = quality() === 'low' ? 0.5 : 1;
  document.body.classList.toggle('reduced', fx.reduced);
  let pausedByMenu = false;
  safe(() =>
    ow.on('pause', () => {
      if (canPause() && !paused) pausedByMenu = true;
      setPaused(true);
    }),
  );
  safe(() =>
    ow.on('resume', () => {
      if (pausedByMenu) setPaused(false);
      pausedByMenu = false;
    }),
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      setPaused(true);
      suspendAudio(true);
    } else {
      suspendAudio(false);
      lastReal = performance.now() / 1000;
    }
  });

  /** In a race, a moment after this spider reaches the sun: the best spider still climbing, to watch. */
  function chaseAfterFinish() {
    const me = curRun.me;
    if (flow !== 'race' || !me?.finish || curRun.t - me.finish < 2.5) return null;
    let best = null;
    for (const r of curRun.racers) if (!r.left && !r.finish && r.st && (!best || r.st.y > best.st.y)) best = r;
    return best;
  }

  function cameraTarget(dt) {
    const H = curRun.level.H;
    let chase = null;
    const lead = view.landscape ? 0.2 : 0.1;
    let ty = camY;
    if (flow === 'title' && attract) {
      let best = null;
      for (const r of attract.racers) if (!best || r.st.y > best.st.y) best = r;
      ty = (best?.st.y ?? 0) + view.viewH * lead;
    } else if (flow === 'lobby' || flow === 'spouts') {
      ty = view.viewH * 0.5 - (view.landscape ? 150 : 210);
    } else if ((chase = chaseAfterFinish())) {
      ty = chase.st.y + view.viewH * lead;
    } else if (curRun.me && !(flow === 'race' && match?.spectating)) {
      ty = curRun.me.st.y + view.viewH * lead;
      // Made it: the camera lifts to the sky and the sun over the roofs, the spider still in view.
      if (curRun.me.finish) ty = Math.max(ty, Math.min(H + 200, curRun.me.st.y + view.viewH * 0.5 - 60));
      if (curRun.mon) ty = Math.max(ty, curRun.mon.flood + view.viewH * 0.5 - 140);
    } else {
      // Watching: follow the leader.
      let best = null;
      for (const r of curRun.racers) if (!r.left && (!best || r.st.y > best.st.y)) best = r;
      ty = (best?.st.y ?? 0) + view.viewH * lead;
    }
    // The flyover before a race: from the sun down to the start.
    if (flow === 'race' && match?.phase === 'intro') {
      const k = clamp(1 - (match.secondsLeft ?? 0) / INTRO, 0, 1);
      const e = k < 0.45 ? 0 : clamp((k - 0.45) / 0.35, 0, 1);
      const ease = e * e * (3 - 2 * e);
      ty = (H - view.viewH * 0.3) * (1 - ease) + ty * ease;
      camSnap = k < 0.05;
    } else if (flyover) {
      flyover.t += dt;
      const e = clamp(flyover.t / flyover.dur, 0, 1);
      const ease = e * e * (3 - 2 * e);
      ty = flyover.from * (1 - ease) + ty * ease;
      if (e >= 1) flyover = null;
    }
    const lo = view.viewH * 0.5 - 240;
    const hi = H + 560 - view.viewH * 0.5;
    return clamp(ty, lo, Math.max(lo, hi));
  }

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const real = nowMs / 1000;
    const dt = Math.min(0.1, Math.max(0, real - lastReal));
    lastReal = real;
    if (document.hidden) return;
    updateFx(fx, dt);
    step(dt, real);
    render(dt, real);
  }

  function step(dt, real) {
    if (fx.stop > 0) {
      fx.stop -= dt;
      dt = Math.min(dt, 0.004);
    }
    // The race layer runs whatever this page shows (a match keeps going behind a solo climb).
    if (net && match && inRacePhase()) {
      const r = net.round?.run;
      const me = r?.me;
      const mine = me && me.sp && flow === 'race' && !paused ? (AUTOPLAY ? autoInput(me, dt) : readInput()) : null;
      net.update(mine, real);
      if (flow === 'race' && net.round && curRun !== net.round.run) useRun(net.round.run);
      if (flow === 'race' && me && curRun === r) myEvents(me);
    }
    if (flow === 'title' && attract) {
      advance(attract, attract.t + dt, null, { onHazard: (r, k) => onScreen(r) && hazardFx(r, k) });
      const done = attract.racers.some((r) => r.finish);
      if (done && !attract.until) attract.until = real + 4;
      if ((attract.until && real > attract.until) || attract.t > 160) newAttract();
    } else if ((flow === 'solo' || flow === 'solo-done') && curRun && !paused) {
      const me = curRun.me;
      if (!flyover || flow === 'solo-done') {
        const inp = flow === 'solo' && !me.finish ? (AUTOPLAY ? autoInput(me, dt) : readInput()) : null;
        advance(curRun, curRun.t + dt, inp ?? { x: 0, y: 0, jump: false, hold: false }, { onFinish: (r) => r.me && onMyFinish(r), onHazard: (r, k) => hazardFx(r, k) });
        myEvents(me);
        if (flow === 'solo') playHints(me, dt);
      }
    } else if ((flow === 'monsoon' || flow === 'monsoon-done') && curRun && !paused) {
      const me = curRun.me;
      const inp = flow === 'monsoon' && !mon?.doneAt ? (AUTOPLAY ? autoInput(me, dt) : readInput()) : { x: 0, y: 0, jump: false, hold: false };
      advance(curRun, curRun.t + dt, inp, { onDrown: (r) => endMonsoon(r), onHazard: (r, k) => hazardFx(r, k) });
      myEvents(me);
      if (flow === 'monsoon') playHints(me, dt);
    } else if (flow === 'race' && curRun?.me && match?.phase === 'round') {
      playHints(curRun.me, dt);
    }
    if (secsShown.length) {
      const v = String(Math.max(0, Math.ceil(match?.secondsLeft ?? 0)));
      for (const el of secsShown) if (el.textContent !== v) el.textContent = v;
    }
    if (AUTOPLAY) autoplayDriver(real);
    if (hint.text) hint.age += dt;
    if (count) count.age += dt;
  }

  // ------------------------------------------------------------ drawing

  const ghostRacer = { id: '__ghost', st: { x: 0, y: 0, a: 0, m: 'surf', g: 3, h: false, f: 1 } };
  const ghostState = {};
  const MODE_NAMES = ['surf', 'air', 'tumble', 'washed', 'dazed', 'done', 'drowned'];

  function render(dt, real) {
    if (!curRun) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#16202C';
      ctx.fillRect(0, 0, view.Wd, view.Hd);
      return;
    }
    const run = curRun;
    const scene = scenes.get(run.level) ?? createScene(run.level, { facade: run.def.facade });
    scenes.set(run.level, scene);
    // Camera.
    const ty = cameraTarget(dt);
    const snap = camSnap;
    camSnap = false;
    if (snap) camY = ty;
    else camY += (ty - camY) * (1 - Math.exp(-dt * (Math.abs(ty - camY) > 400 ? 9 : 5)));
    const cx = centerXAt(run, camY);
    camX = snap ? cx : camX + (cx - camX) * (1 - Math.exp(-dt * 4));
    setCamera(view, camX + fx.sx / view.z, camY + fx.sy / view.z);
    // Weather where the eye is: your spider, or the middle of the screen.
    const t = run.kind === 'lobby' ? 0 : run.t;
    const chasing = !!chaseAfterFinish();
    const refY = run.me && flow !== 'lobby' && !chasing ? run.me.st.y : camY;
    rainAt(run.weather, refY, t, rinfo);
    const warnK = rinfo.warn ? clamp(1 - rinfo.next / rinfo.warn.warn, 0, 1) : 0;
    // Out came the sun: for a spider at the top, the sky clears (until the camera goes back down to watch).
    const sunny = !!run.me?.finish && run.kind !== 'lobby' && !chasing;
    const calmTarget = run.kind === 'lobby' ? 0.6 : sunny ? 1 : rinfo.wet || rinfo.warn ? 0 : clamp((rinfo.next - 1.5) / 2, 0, 1);
    calm += (calmTarget - calm) * (1 - Math.exp(-dt * 2));
    const gloomTarget = sunny ? 0 : rinfo.wet ? 1 : warnK;
    gloom += (gloomTarget - gloom) * (1 - Math.exp(-dt * 3));
    sunNow = sunny;
    weatherSounds(run, warnK, real, sunny);
    // Puppets.
    updatePuppets(puppets, run, dt);
    let ghost = null;
    if (solo?.ghost && (flow === 'solo' || flow === 'solo-done')) {
      ghostAt(solo.ghost, run.t, ghostState);
      const st = ghostRacer.st;
      st.x = ghostState.x;
      st.y = ghostState.y;
      st.a = ghostState.a ?? 0;
      st.m = MODE_NAMES[ghostState.m] ?? 'surf';
      st.f = 1;
      updatePuppets(puppets, { racers: [] }, dt, [ghostRacer]);
      ghost = ghostRacer;
    }
    transitions(run);
    // Lobby spiders face each other and sit still.
    renderWorld(ctx, view, scene, run, {
      t,
      real,
      puppets,
      fx,
      rain,
      water,
      calm,
      gloom,
      heavy: 0.25 + 0.75 * gloom,
      flash: fx.flash,
      ghost,
      flood: run.mon ? run.mon.flood : null,
    });
    screenTransform(ctx, view);
    drawHud(ctx, hudFor(run, t, warnK, real));
  }

  function centerXAt(run, y) {
    const c = run.level.center;
    if (!c.length) return 0;
    let lo = 0;
    for (let i = 0; i < c.length - 1; i++) if (c[i + 1][1] <= y) lo = i + 1;
    const a = c[lo];
    const b = c[Math.min(c.length - 1, lo + 1)];
    if (b[1] === a[1]) return a[0];
    return a[0] + ((b[0] - a[0]) * clamp((y - a[1]) / (b[1] - a[1]), 0, 1));
  }

  function weatherSounds(run, warnK, real, sunny) {
    if (run.kind === 'lobby' || flow === 'title' || flow === 'closed' || sunny) {
      setRain(sunny ? 0.2 + 0.8 * gloom : 0.25);
      setMusicWeather('sun');
      return;
    }
    setRain(0.2 + 0.8 * gloom);
    const wave = rinfo.warn;
    if (wave && wave.id !== warnWave && run.t > 0.1) {
      warnWave = wave.id;
      sfx('warn');
      if (run.def.lightning && !reduced()) lightningAt = real + 0.4 + Math.random() * 1.2;
    }
    if (lightningAt && real > lightningAt) {
      lightningAt = 0;
      flash(fx, 1);
      setTimeout(() => sfx('thunder'), 250);
    }
    if (rinfo.wet && rinfo.wave && rinfo.wave.id !== flushWave) {
      flushWave = rinfo.wave.id;
      sfx('flush', rinfo.left);
      addTrauma(fx, 0.22);
    }
    if (!rinfo.wet && flushWave >= 0 && run.t > 0 && rinfo.warn === null && warnWave === flushWave && calm < 0.05 && rinfo.next > 2) {
      flushWave = -2;
      sfx('sun');
    }
    setMusicWeather(rinfo.wet ? 'flush' : wave ? 'warn' : 'sun');
    void warnK;
  }

  function hudFor(run, t, warnK, real) {
    const hs = hudState;
    hs.W = w;
    hs.H = hgt;
    hs.t = real;
    hs.layout = layout;
    hs.reduced = reduced();
    hs.touch = touchMode();
    hs.label = null;
    hs.sub = null;
    hs.subColor = null;
    hs.line = null;
    hs.me = null;
    hs.names = null;
    hs.hint = null;
    hs.countdown = null;
    hs.debris = null;
    const showWeather = flow === 'solo' || flow === 'monsoon' || flow === 'race' || flow === 'solo-done' || flow === 'monsoon-done';
    if (!showWeather) {
      hs.weather = null;
      if (flow === 'lobby') {
        // Names over the spiders on the bench.
        hs.names = [];
        for (const r of run.racers) {
          const info = run.seatsInfo?.find((s) => s.id === r.id);
          hs.names.push({ name: r.name, sx: toScreenX(view, r.st.x), sy: toScreenY(view, r.st.y) - 6, color: info?.bot ? 'rgba(243,237,226,0.6)' : info?.me ? '#FFB648' : '#F3EDE2', ready: !info?.bot && !!info?.ready });
        }
        if (hint.text && hint.age < hint.life) hs.hint = { ...hint, x: w / 2, y: hgt * 0.42, target: hintTarget(hint.target) };
      }
      return hs;
    }
    const wv = hs.weather ?? (hs.weather = {});
    hudState.weather = wv;
    wv.calm = calm;
    // At the top in the sun: no more warnings for you.
    wv.warnK = sunNow ? 0 : warnK;
    wv.next = sunNow ? 99 : rinfo.next;
    wv.kind = rinfo.kind;
    wv.wet = sunNow ? false : rinfo.wet;
    wv.left = rinfo.left;
    wv.dur = rinfo.wave ? rinfo.wave.end : 1;
    const me = run.me;
    // Label: place, clock or metres.
    if (run.kind === 'race') {
      const fin = net?.finishes() ?? {};
      if (match?.phase === 'results') hs.label = null;
      else if (match?.spectating || !me) hs.label = fmtTime(t, true);
      else {
        const order = liveOrder(run, fin);
        hs.label = ORD(order.indexOf(me.id) + 1);
      }
      const times = Object.values(fin);
      if (times.length && match?.phase === 'round') {
        const left = Math.max(0, Math.min(...times) + CLOSE_AFTER - t);
        hs.sub = `0:${String(Math.ceil(left)).padStart(2, '0')}`;
        hs.subColor = '#9E2A12';
      }
    } else if (run.mon) {
      hs.label = `${Math.floor(Math.max(0, run.best) / M)} m`;
      hs.sub = progress.mon.best ? `Best ${progress.mon.best} m` : null;
    } else if (solo) {
      hs.label = fmtTime(me?.finish ? Math.round(me.finish * 100) / 100 : t);
      const best = progress.best[solo.id];
      if (best) hs.sub = `Best ${fmtTime(best)}`;
    }
    if (flow === 'solo-done' || flow === 'monsoon-done') hs.label = hs.sub = null; // the card says it
    // The climb line.
    const top = run.mon ? Math.max(progress.mon.best * M, run.best + 2500, 3000) : run.level.H;
    const beads = [];
    for (const r of run.racers) beads.push({ y: r.st.y, look: r.look, me: r.me, alpha: r.left ? 0.4 : 1 });
    if (solo?.ghost && (flow === 'solo' || flow === 'solo-done')) beads.push({ y: ghostRacer.st.y, look: SEAT_LOOKS[5], ghost: true });
    hs.line = { top, beads, flood: run.mon ? run.mon.flood : null, setting: !!hs.sub && run.kind === 'race' };
    // You: chevron and grip; the others: names.
    if (me && me.sp && !(match?.spectating && run.kind === 'race')) {
      hs.me = { sx: toScreenX(view, me.st.x), sy: toScreenY(view, me.st.y), grip: me.sp.grip / GRIP_MAX };
    }
    if (run.kind === 'race') {
      hs.names = [];
      for (const r of run.racers) {
        if (r.me || r.st.y < view.y0 || r.st.y > view.y1) continue;
        hs.names.push({ name: r.name, sx: toScreenX(view, r.st.x), sy: toScreenY(view, r.st.y), color: r.left || r.away ? 'rgba(243,237,226,0.5)' : '#F3EDE2' });
      }
    }
    // Your best, as a ghost: named.
    if (solo?.ghost && (flow === 'solo' || flow === 'solo-done') && ghostRacer.st.y > view.y0 && ghostRacer.st.y < view.y1) {
      (hs.names ??= []).push({ name: 'Best', sx: toScreenX(view, ghostRacer.st.x), sy: toScreenY(view, ghostRacer.st.y), color: 'rgba(243,237,226,0.62)' });
    }
    // Falling debris coming into view.
    debrisMarks.length = 0;
    for (const d of me?.finish || mon?.doneAt ? [] : debrisComing(run.weather, view.y1, t, 1.2, debrisList)) {
      const x = run.level ? centerXAt(run, view.y1) + (d.d.lane === 'L' ? -68 : 68) : 0;
      debrisMarks.push(toScreenX(view, x));
      if (me?.sp) showHint('debris', 'Caps falling: hold', 'Caps falling: hold', { life: 1.8 });
    }
    hs.debris = debrisMarks.length ? debrisMarks : null;
    if (hint.text && hint.age < hint.life && me) {
      const sx = clamp(toScreenX(view, me.st.x), 110, w - 110);
      const sy = clamp(toScreenY(view, me.st.y) - 96, 70, hgt - 160);
      hs.hint = { ...hint, x: sx, y: sy, target: hintTarget(hint.target) };
    }
    // The 3-2-1 before a race.
    if (flow === 'race' && match?.phase === 'intro') {
      const left = match.secondsLeft ?? 0;
      if (left <= 3) {
        const n = Math.max(1, Math.ceil(left));
        const text = String(n);
        if (text !== lastCount) {
          lastCount = text;
          sfx('count', n === 1 ? 1 : 0);
        }
        hs.countdown = { text, k: 1 - (left - (n - 1)) };
      }
    } else if (count && count.age < 0.8) {
      hs.countdown = { text: count.text, k: count.age / 0.8 };
      lastCount = '';
    }
    return hs;
  }

  // ------------------------------------------------------------ the trailer's autopilot

  let autoAt = 0;
  let autoCup = false;
  function autoplayDriver(real) {
    if (real < autoAt) return;
    autoAt = real + 0.5;
    if (flow === 'title') play();
    if (flow !== 'lobby' || !room || !match) return;
    const want = Number(params.get('cup')) || 0;
    if (want && !autoCup && room.isHost) {
      autoCup = true;
      safe(() => room.setSetting('cup', want));
      if (room.stub) room.settings.cup = want;
      return;
    }
    if (params.get('autoplay') === 'monsoon') return startMonsoon();
    if (params.get('autoplay') === 'solo') return startSolo(Number(params.get('spout')) || 1, false);
    if (match.phase === 'lobby') {
      if (room.isHost && room.kind !== 'public') safe(() => match.start());
      else safe(() => match.ready(true));
    }
  }

  // ------------------------------------------------------------ the debug screens (?poster=screen-<name>[.WxH])

  /** Where the platform's pieces sit in play (its menu at the top left; the lobby bar with Ready/Start at the bottom). */
  function stageAreas() {
    const out = [{ kind: 'menu', x: 0, y: 0, w: 140, h: 64, label: 'menu' }];
    if (/^screen-lobby/.test(STAGE)) out.push({ kind: 'lobby', x: Math.round(w / 2 - Math.min(170, w / 2 - 12)), y: hgt - 12 - 56, w: Math.min(340, w - 24), h: 56, label: 'Ready · Start' });
    return out;
  }

  /** Stages one screen as a player meets it, waits for it to settle, then says data-ready. */
  async function stage(name) {
    for (const a of reserved ?? []) {
      const box = h('div', { text: a.label ?? '' });
      box.style.cssText = `position:fixed;left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;box-sizing:border-box;border:2px dashed rgba(243,237,226,.55);border-radius:${a.kind === 'lobby' ? 999 : 12}px;background:rgba(14,20,27,.55);color:#f3ede2;font:800 14px var(--text);display:flex;align-items:center;justify-content:center;z-index:5;pointer-events:none`;
      document.body.append(box);
    }
    if (stageBox) {
      const frameBox = h('div', {});
      frameBox.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${hgt}px;box-sizing:content-box;border-right:3px solid #ff3d7f;border-bottom:3px solid #ff3d7f;pointer-events:none;z-index:6`;
      document.body.append(frameBox);
    }
    // A player some way in: six spouts climbed, a Monsoon best.
    progress.tut = true;
    progress.open = 7;
    [3, 3, 2, 3, 1, 2].forEach((n, i) => (progress.stars[i + 1] = n));
    [24.6, 31.2, 38.9, 44.7, 52.3, 58.1].forEach((t, i) => (progress.best[i + 1] = t));
    progress.mon.best = 212;
    progress.mon.day = dayKey(Date.now());
    progress.mon.dayBest = 64;
    let settle = 2200;
    const idle = { x: 0, y: 0, jump: false, hold: false };
    if (name === 'lobby' || name === 'spouts') {
      room.stub = false;
      room.kind = 'private';
      room.settings.cup = 2;
      room.players.set('p2', { id: 'p2', name: 'Pip', ready: true, connected: true, presence: null });
      toLobby();
      if (name === 'spouts') showSpouts();
    } else if (name === 'solo') {
      // Spout 7 climbed by the bot brain; the old best is that same climb slowed down, so its ghost trails a little behind.
      ghosts.set(7, null);
      await startSolo(7, false);
      await new Promise((r) => setTimeout(r, 0));
      flyover = null;
      const me = curRun.me;
      while (!me.finish && curRun.t < 240) advance(curRun, curRun.t + 1 / 60, autoInput(me, 1 / 60));
      const was = Math.round((me.finish + 4) * 10) / 10;
      const raw = unpackGhost(packGhost(curRun.recorder, me.finish));
      const slow = { xs: [], ys: [], as: [], ms: [], t: was };
      const at = {};
      for (let i = 0; i <= was * GHOST_HZ; i++) {
        if (!ghostAt(raw, Math.min((i / GHOST_HZ) * (me.finish / was), raw.xs.length / GHOST_HZ - 0.11), at)) break;
        slow.xs.push(at.x);
        slow.ys.push(at.y);
        slow.as.push(at.a);
        slow.ms.push(at.m);
      }
      progress.best[7] = was;
      ghosts.set(7, slow);
      solo.ghost = slow;
      onMyFinish(me);
      camSnap = true;
      settle = 3600;
    } else if (name === 'monsoon') {
      startMonsoon();
      const me = curRun.me;
      while (!mon.doneAt && curRun.t < 600) advance(curRun, curRun.t + 1 / 60, curRun.t < 50 ? autoInput(me, 1 / 60) : idle, { onDrown: (r) => endMonsoon(r) });
      camSnap = true;
      settle = 3400;
    } else if (name === 'race' || name === 'results') {
      // The end of a cup: spout 3 just raced (its places), then the cup's podium. You, a friend and four bots.
      const cup = cupById(1);
      const seats = [
        { id: 'me', name: 'You', bot: false, me: true, index: 0 },
        { id: 'p2', name: 'Pip', bot: false, me: false, index: 1 },
        ...BOT_NAMES.slice(0, 4).map((n, i) => ({ id: `bot:${i + 2}`, name: n, bot: true, me: false, index: i + 2 })),
      ];
      const run = createRun({ kind: 'race', spout: cup.spouts[2], seed: 31, seats: seats.map((x) => ({ ...x, bot: !x.me, skill: [0.5, 0.7, 0.35, 0.6, 0.8, 0.45][x.index] })) });
      for (const r of run.racers) r.name = seats[r.index].name;
      useRun(run);
      while (curRunDone(run) && run.t < 120) advance(run, run.t + 1 / 60, autoInput(run.me, 1 / 60));
      const ids = seats.map((x) => x.id);
      const fin = {};
      const heights = {};
      for (const r of run.racers) {
        if (r.finish) fin[r.id] = r.finish;
        heights[r.id] = r.sp ? r.sp.y : 0;
      }
      const ranking = rankRace(ids, fin, heights);
      const points = pointsFor(ranking);
      const totals = { me: 23, p2: 21, 'bot:2': 9, 'bot:3': 14, 'bot:4': 26, 'bot:5': 8 };
      for (const id of ids) totals[id] += points[id] ?? 0;
      const order = [...ids].sort((a, b) => totals[b] - totals[a]);
      const standings = order.map((id, i) => ({ id, name: seats.find((x) => x.id === id).name, points: totals[id], place: i + 1, bot: id.startsWith('bot:') }));
      const final = name === 'results';
      match = {
        phase: final ? 'results' : 'roundEnd',
        paused: false,
        isHost: true,
        round: 3,
        rounds: 3,
        roundId: 'stage.3',
        seats: seats.map((x) => ({ ...x, team: 0, away: false, idle: false, left: false })),
        get present() {
          return this.seats;
        },
        me: { ...seats[0] },
        spectating: false,
        scores: totals,
        standings,
        results: final ? standings : null,
        last: final ? null : { ranking, points },
        data: null,
        settings: { cup: 1 },
        secondsLeft: final ? 14 : 4,
        elapsed: run.t * 1000,
        on: () => () => {},
        skip() {},
        ready() {},
        start() {},
      };
      room.kind = 'private';
      flow = 'race';
      clearHint();
      setControls(false);
      camSnap = true;
      if (final) showCupResults();
      else showRoundEnd();
    } else showTitle();
    await new Promise((r) => setTimeout(r, settle));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    document.body.dataset.ready = '1';
  }
  /** The staged race runs until four spiders are at the top. */
  function curRunDone(run) {
    return run.racers.filter((r) => r.finish).length < 4;
  }

  // ------------------------------------------------------------ go

  requestAnimationFrame(frame);
  await connect(roomPromise);
  await Promise.race([loadSaves, new Promise((r) => setTimeout(r, 1500))]);
  if (STAGE) return stage(STAGE.slice(7).replace(/[.].*$/, ''));
  if (inRacePhase() && amRacing()) enterRace();
  else showTitle();
  if (inRacePhase() && match.phase === 'intro') showSpoutTag();
  document.body.dataset.flow = 'ready';
}
