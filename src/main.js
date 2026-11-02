// Boot, the screens, input, the camera and everything that turns a run into sound, motion and progress.

import './style.css';
import { createView, centerXAt } from './render/view.js';
import { texturesReady } from './render/tex.js';
import { createRun, advance, liveOrder } from './sim/run.js';
import { SPOUTS, CUPS, spoutById, cupById, starsFor, STAR_TIMES } from './sim/spouts.js';
import { SEAT_LOOKS, GRIP_MAX, M, CLOSE_AFTER, PIPE_W, STEP, WALL_T, R } from './sim/config.js';
import { rainAt, debrisComing } from './sim/weather.js';
import { BOT_NAMES, createBrain, think } from './sim/bot.js';
import { dayKey, daySeed } from './sim/monsoon.js';
import { packGhost, unpackGhost, ghostAt } from './sim/ghost.js';
import { featuresIn, inPocket } from './sim/level.js';
import { snagFor, modeName } from './sim/spider.js';
import { hashString } from './sim/rng.js';
import { rankRace, pointsFor } from './sim/race.js';
import { JOIN, INTRO, createNet, cupRules, roundInfo, stubOw, stubRoom, createLocalMatch, readLook } from './net.js';
import { createUI, setInsets, tag, h, stars } from './ui.js';
import { drawHud, hudLayout } from './hud.js';
import { fmtTime, ORD, clamp } from './paint2d.js';
import { startAudio, sfx, setRain, setMusic, setMusicWeather, setMusicHeight, musicSun, suspendAudio } from './audio.js';
import { createInput, idle } from './input.js';
import * as P from './progress.js';

const params = new URLSearchParams(location.search);
const SDK_BASE = ['', '__onceworlds', 'v1', ''].join('/');
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

// The fonts, from beside the page (works wherever the game is served).
const fontsReady = Promise.all(
  [
    ['Alfa Slab One', 'fonts/alfa-slab-one-latin-400-normal.woff2', '400'],
    ['Sofia Sans Condensed', 'fonts/sofia-sans-condensed-latin-800-normal.woff2', '800'],
  ].map(([family, file, weight]) =>
    new FontFace(family, `url(${new URL(file, document.baseURI).href})`, { weight, display: 'swap' })
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => {}),
  ),
);

// ?poster=<name>: store art (poster.js). ?poster=screen-<name>[.WxH]: one of the game's screens staged as in real play.
const POSTER = params.get('poster') ?? '';
const STAGE = /^screen-[a-z]+([.]\d{2,4}x\d{2,4})?$/.test(POSTER) ? POSTER : '';
// the store pictures drawn by the 3D renderer (badges are drawn flat, in poster.js)
const SHOT = ['cover', 'action', 'win', 'multi', 'icon'].includes(POSTER) ? POSTER : '';
if (POSTER && !STAGE && !SHOT) import('./poster.js').then((m) => m.runPoster(POSTER));
else
  boot().catch((err) => {
    console.error(err);
    if (STAGE) document.body.dataset.ready = 'error';
  });

/** A bot's look: picked from its name, from the whole wardrobe (so races show what can be earned). */
export function botLook(name) {
  const hsh = hashString(`look:${name}`);
  const pick = (list, k) => list[(hsh >>> k) % list.length];
  return {
    species: pick(P.SPECIES_LIST, 4).id,
    color: pick(P.COLORS, 0).hex,
    mark: pick(P.MARKS, 8).id,
    hat: (hsh >>> 12) % 3 === 0 ? 'none' : pick(P.HAT_LIST, 14).id,
    trail: (hsh >>> 18) % 4 === 0 ? pick(P.TRAILS, 20).id : 'none',
    dance: pick(P.DANCES, 24).id,
  };
}

const TRAIL_RGB = {
  sparkle: [[3, 2.6, 1.3]],
  bubbles: [[0.9, 1.3, 1.7]],
  leaves: [
    [0.55, 1.2, 0.35],
    [1.3, 0.9, 0.25],
  ],
  gold: [[3, 2.1, 0.5]],
  embers: [
    [3.2, 1.1, 0.25],
    [2.6, 0.5, 0.12],
    [3, 2, 0.6],
  ],
  frost: [
    [1.7, 2.3, 3],
    [2.6, 2.8, 3],
  ],
  neon: [
    [3, 0.4, 2.2],
    [0.3, 2.6, 3],
    [2.4, 3, 0.4],
  ],
};

async function boot() {
  const ow = STAGE || SHOT ? stubOw() : hasOw || stubOw();
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
  const later = (p) => {
    try {
      Promise.resolve(p).catch(() => {});
    } catch {
      /* standalone */
    }
  };
  safe(() => ow.ui.setLook({ accent: '#FFB648', panel: '#16202C', text: '#F3EDE2' }));
  safe(() => ow.controls.set(null));

  const uiRoot = document.getElementById('ui');
  const ui = createUI(uiRoot);
  let softGL = false; // drawing in software: lite, and few pixels, whatever the setting says
  const quality = () => (softGL ? 'low' : (safe(() => ow.settings.quality) ?? params.get('q') ?? 'high'));
  const reduced = () => !!safe(() => ow.settings.reducedMotion);
  const view = createView(document.getElementById('stage'), { quality: quality(), preserve: !!STAGE || !!SHOT || params.has('shot') });
  softGL = view.lite;
  // drawing in software, the server comes first: the shaders (seconds each there) wait for the join
  view.holdShaders(roomPromise);
  const juice = view.juice;
  const fx = view.fx;
  const hudCanvas = document.getElementById('hudc');
  const hctx = hudCanvas.getContext('2d');
  let reserved = safe(() => ow.ui.reserved) ?? null;
  let layout = hudLayout(innerWidth, innerHeight, reserved, false);

  // ------------------------------------------------------------ saves

  let save = P.freshSave();
  const today = () => dayKey(safe(() => ow.now()) ?? Date.now());
  const ghosts = new Map();
  const loadSaves = (async () => {
    try {
      save = P.cleanSave(await ow.save.get('progress'));
      if (!Object.keys(save.seen).length) {
        const hs = await ow.save.get('hints');
        if (hs && typeof hs === 'object') for (const k of Object.keys(hs).slice(0, 40)) save.seen[k] = Number(hs[k]) || 1;
      }
      if (!save.tut) {
        // a player from before the progress save: their spout records were kept separately
        const old = await ow.save.get('progress-v1');
        if (old) save = P.cleanSave(old);
      }
    } catch {
      save = P.freshSave();
    }
    P.rollDay(save, today());
  })();
  let saveTimer = 0;
  function saveProgress() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => later(ow.save.set('progress', save)), 400);
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
  const award = (id) => later(safe(() => ow.badges.award(id)));
  const submit = (board, score, opts) => later(safe(() => ow.leaderboards.submit(board, score, opts)));
  const gameData = () => safe(() => ow.data?.game) ?? null;
  const myLook = () => P.wornLook(save);

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
        // the platform's helpers, served beside every game (not bundled)
        const sdk = (file) => import(/* @vite-ignore */ SDK_BASE + file);
        const [m, hm, bm] = await Promise.all([sdk('match.js'), sdk('host.js'), sdk('bots.js')]);
        helpers = { createMatch: m.createMatch, createHost: hm.createHost, t: hm.t, createBots: bm.createBots };
      } catch (err) {
        console.warn('[spider] helpers unavailable, racing alone', err);
      }
    }
    const fill = () => ((room.settings?.bots ?? 'fill') === 'off' ? 0 : 6);
    if (helpers) {
      host = helpers.createHost(room);
      net = createNet({ room, host, t: helpers.t, hooks: netHooks, look: () => myLook(), botLook });
      match = helpers.createMatch(room, cupRules(() => net));
      botsHelper = helpers.createBots(match, { host, fill: fill(), names: BOT_NAMES, skill: [0.2, 0.8], think: () => null });
    } else {
      host = null;
      net = createNet({ room, host: null, t: null, hooks: netHooks, look: () => myLook(), botLook });
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
      else if (onScreen(r)) confettiAt(r, 24);
    },
    onBumped(target) {
      if (target.me) {
        sfx('bump');
        juice.add(0.35);
        juice.hit(0.05);
      } else if (onScreen(target)) sfx('bump');
    },
    onHazard(r, kind) {
      if (r.me || onScreen(r)) hazardFx(r, kind);
    },
    onFly(r, f) {
      flyFx(r, f);
    },
  };

  // ------------------------------------------------------------ input

  const input = createInput({
    playing: () => isPlaying(),
    onKey(e) {
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        if (canPause()) {
          e.preventDefault();
          setPaused(!paused);
        } else if (flow === 'wardrobe' || flow === 'spouts') {
          e.preventDefault();
          toLobby();
        }
        return true;
      }
      if (flow === 'title' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        play();
        return true;
      }
      if (!e.repeat) startAudio();
      return false;
    },
    onPointer() {
      startAudio();
    },
  });
  const touchMode = () => input.last === 'touch' || !!safe(() => ow.controls.touch);

  // The trailer's autopilot: the local spider is driven by the sharpest bot brain.
  let autoBrain = null;
  function autoInput(r, run = curRun) {
    const key = `${r.id}:${run?.seed}:${run?.def.id}`;
    if (!autoBrain || autoBrain.key !== key) {
      autoBrain = createBrain('Juniper', 0.97, `auto:${key}`);
      autoBrain.key = key;
    }
    // steered every fixed step, exactly as the bots are
    return (me, t) => think(autoBrain, me.sp, run.level, run.weather, t, STEP, run.seed, run.world);
  }

  // ------------------------------------------------------------ flows

  let flow = 'boot';
  let curRun = null; // the run on screen
  let lobbyRun = null;
  let lobbyKey = '';
  let attract = null;
  let paused = false;
  // store art: { t, frozen, done, sunny, ... }; until it is staged nothing is drawn (posters run on software renderers)
  let shot = SHOT ? { manual: true } : null;
  let posterCam = null;
  let solo = null; // { id, tutorial, ghost, doneAt }
  let mon = null; // { day, doneAt }
  let hint = { text: '', age: 0, life: 0, target: null, key: '' };
  let count = null;
  let roundShown = '';
  let wardrobeSlot = 'species';
  let flyover = null;
  const pops = [];

  const isPlaying = () => (flow === 'solo' || flow === 'monsoon' || (flow === 'race' && match?.phase === 'round' && !match.spectating && !!curRun?.me)) && !paused;
  const canPause = () => flow === 'solo' || flow === 'monsoon';
  const inRacePhase = () => !!match && ['intro', 'round', 'roundEnd', 'results'].includes(match.phase);
  const amRacing = () => !!match && !!match.me && !match.spectating;

  /** What one go earns, counted as it happens. */
  const newTally = () => ({ perfect: 0, flies: 0, gold: false, swings: 0, held: 0, mask: 0, combo: 0 });
  let tally = newTally();
  // The combo: flies, swings, perfect holds and flushes held one after another, each within COMBO_T of the last (the
  // clock stops while you hold). A wash-out, a knock or a snapped thread breaks it; the best of a climb pays silk.
  const COMBO_T = 3;
  const combo = { n: 0, left: 0, at: 0 };

  function useRun(r) {
    if (curRun !== r) {
      tally = newTally();
      combo.n = 0;
      combo.left = 0;
      was.clear();
      trailAt.clear();
      pops.length = 0;
    }
    curRun = r;
    for (const x of r.racers) {
      if (x.me) x.look = { ...myLook() };
      else if (x.bot && !x.lookSet) {
        x.look = botLook(x.name);
        x.lookSet = true;
      }
    }
    view.show(r);
    camSnap = true;
  }

  function setControls(on) {
    safe(() =>
      ow.controls.set(
        on
          ? {
              stick: 'wasd',
              buttons: [
                { id: 'jump', label: 'Jump', key: ' ' },
                { id: 'hold', label: 'Hold', key: 'j' },
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
        h('div', { class: 'sign' }, h('span', { class: 'l1', text: 'Itsy Bitsy' }), h('span', { class: 'l2', text: 'Spider' })),
        tag('Play', { main: true, silk: 18, delay: 200, onclick: play, cls: 'play' }),
      );
    });
  }

  function newAttract() {
    const pick = [1, 2, 4, 5, 8, 6, 10, 3, 7, 9][Math.floor(Math.random() * 10)];
    const seats = ['Hopper', 'Mabel', 'Dash', 'Velvet'].map((name, i) => ({ id: `a${i}`, name, bot: true, skill: [0.55, 0.7, 0.82, 0.94][i], index: i + 1 }));
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
    if (AUTOPLAY) save.tut = true;
    if (inRacePhase()) enterRace();
    else if (!save.tut) startSolo(1, true);
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
    P.rollDay(save, today());
    refreshLobby(true);
    announceLevels();
    loadCommunity();
    if (!save.seen.lobby) setTimeout(() => flow === 'lobby' && showHint('lobby', 'Ready to race', 'Ready to race', { target: 'lobby', life: 4 }), 900);
  }

  function lobbySeats() {
    const list = [];
    const players = room ? [...room.players.values()].filter((p) => p.connected !== false) : [];
    players.sort((a, b) => (a.id === room.me.id ? -1 : b.id === room.me.id ? 1 : 0));
    players.slice(0, 6).forEach((p, i) => list.push({ id: p.id, name: p.name ?? 'Player', me: p.id === room.me.id, index: i, ready: !!p.ready || p.id === room.host, dance: !!p.ready }));
    const fillBots = (room?.settings?.bots ?? 'fill') !== 'off';
    const humans = list.length;
    for (let i = humans; i < 6 && fillBots; i++) list.push({ id: `pv${i}`, name: BOT_NAMES[i - humans], bot: true, index: i, skill: 0.5 });
    return list;
  }

  const cupNow = () => cupById(Number(room?.settings?.cup) || 1);

  function ensureLobbyRun() {
    const cup = cupNow();
    const seats = lobbySeats();
    const key = `${cup.id}|${seats.map((s) => `${s.id}:${s.name}`).join(',')}`;
    if (key !== lobbyKey || !lobbyRun) {
      lobbyKey = key;
      lobbyRun = createRun({ kind: 'lobby', spout: cup.spouts[0], seed: 1, seats: seats.map((s) => ({ ...s, me: false, bot: false })) });
      lobbyRun.seatsInfo = seats;
      const mid = centerXAt(lobbyRun.level, 0);
      for (const r of lobbyRun.racers) {
        const info = seats.find((s) => s.id === r.id);
        r.isMe = !!info?.me;
        r.look = info?.me ? { ...myLook() } : info?.bot ? botLook(r.name) : SEAT_LOOKS[r.index % SEAT_LOOKS.length];
        // two rows on the drain, everyone turned to the middle
        r.st.z = r.index % 2 ? -26 : 20;
        r.st.f = r.st.x < mid ? 1 : -1;
      }
      useRun(lobbyRun);
    } else lobbyRun.seatsInfo = seats;
    if (curRun !== lobbyRun) useRun(lobbyRun);
  }

  let lobbyEls = null;
  function refreshLobby(rebuild = false) {
    if (flow !== 'lobby' && flow !== 'spouts' && flow !== 'wardrobe') return;
    ensureLobbyRun();
    if (flow !== 'lobby') return;
    const cup = cupNow();
    const isHost = !!room?.isHost;
    const botsText = `Bots: ${(room?.settings?.bots ?? 'fill') === 'off' ? 'Off' : 'Fill'}`;
    if (!rebuild && lobbyEls?.cupName.isConnected) {
      lobbyEls.cupName.textContent = cup.name;
      lobbyEls.cupSub.textContent = cup.spouts.map((id) => spoutById(id).name).join(' · ');
      lobbyEls.bots.querySelector('.face').textContent = botsText;
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
      const bots = tag(botsText, { small: true, silk: 54, onclick: toggleBots, cls: 'bots' });
      const totalStars = SPOUTS.reduce((a, s) => a + (save.spouts[s.id]?.stars ?? 0), 0);
      const monFace = h('span', { class: 'stack' }, h('span', { text: 'Monsoon' }), h('span', { class: 'sub', text: save.mon.best > 0 ? `Best ${Math.floor(save.mon.best)} m` : 'Today\'s flood' }));
      const invite = tag('+ Invite', { small: true, silk: 20, onclick: () => safe(() => ow.ui.showInvite()), cls: 'invite' });
      const lv = P.levelOf(save.silk);
      el.append(
        h('div', { class: 'cuprow' }, prev, cupTag, next),
        h('div', { class: 'botrow' }, bots, invite),
        h('div', { class: 'side' }, tag(profileFace(lv), { silk: 22, onclick: showWardrobe, cls: 'profile', label: `Spider level ${lv.level}, wardrobe` }), goalsCard()),
        h(
          'div',
          { class: 'solorow' },
          tag(h('span', { class: 'stack' }, h('span', { text: 'Spouts' }), h('span', { class: 'sub withstar' }, h('span', { class: 'star on' }), `${totalStars}/${SPOUTS.length * 3}`)), { silk: 34, onclick: showSpouts, cls: 'spouts', label: `Spouts, ${totalStars} stars` }),
          tag(monFace, { silk: 46, onclick: startMonsoon, cls: 'monsoon' }),
        ),
        h('div', { class: 'community', hidden: true }),
      );
      lobbyEls = { cupName, cupSub, prev, next, bots, invite };
      prev.hidden = !isHost;
      next.hidden = !isHost;
      bots.disabled = !isHost;
      invite.hidden = !(room && !room.stub && room.players.size < 6);
      if (communityText) showCommunity();
    });
  }

  // everyone's flushes held today, across every server
  let communityText = '';
  let communityAt = 0;
  async function loadCommunity() {
    const g = gameData();
    if (!g || performance.now() - communityAt < 20000) return showCommunity();
    communityAt = performance.now();
    let n = null;
    try {
      n = await g.get('held-today');
    } catch {
      n = null;
    }
    if (typeof n === 'number' && n > 0) communityText = `${Math.floor(n).toLocaleString('en-US')} flushes held today by everyone`;
    showCommunity();
  }
  function showCommunity() {
    const el = uiRoot.querySelector('.screen.lobby .community');
    if (!el || !communityText) return;
    el.textContent = communityText;
    el.hidden = false;
  }

  /** The level badge with its silk bar, and the streak. */
  function profileFace(lv) {
    const pct = lv.max ? 100 : Math.round((lv.into / lv.need) * 100);
    const nextU = P.nextUnlock(lv.level);
    return h(
      'span',
      { class: 'prof' },
      h('span', { class: 'lvl', text: String(lv.level) }),
      h('span', { class: 'stack left' }, h('span', { class: 'pname', text: 'Wardrobe' }), h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('span', { class: 'sub', text: lv.max ? 'Top level' : `${lv.into}/${lv.need} silk` }), nextU ? h('span', { class: 'sub next', text: `Next: ${P.unlockName(nextU)}` }) : null),
      save.streak.n > 0 ? h('span', { class: 'streak', title: 'Day streak', text: String(save.streak.n) }) : null,
    );
  }

  /** Today's three goals and the chest. */
  function goalsCard() {
    P.rollDay(save, today());
    const list = h('div', { class: 'goals' });
    for (const g of save.day.goals) {
      const k = P.GOAL_KINDS[g.kind];
      const pct = Math.round((g.have / g.n) * 100);
      list.append(h('div', { class: `goal ${g.done ? 'done' : ''}` }, h('span', { class: 'gl', text: k.label(g.n) }), h('span', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('span', { class: 'gn', text: g.done ? '✓' : `${g.have}/${g.n}` })));
    }
    const nextStreak = save.streak.last === today() ? save.streak.n : save.streak.n + 1;
    const chest = h('div', { class: `chest ${save.day.chest ? 'open' : ''}` }, h('span', { class: 'box' }), h('span', { text: save.day.chest ? 'Chest opened' : `Chest +${P.chestSilk(nextStreak)}` }));
    const wg = save.week.goal;
    const week = wg
      ? h(
          'div',
          { class: `goal week ${wg.done ? 'done' : ''}` },
          h('span', { class: 'gl', text: P.GOAL_KINDS[wg.kind].label(wg.n) }),
          h('span', { class: 'bar' }, h('i', { style: `width:${Math.round((wg.have / wg.n) * 100)}%` })),
          h('span', { class: 'gn', text: wg.done ? '✓' : `${wg.have}/${wg.n}` }),
        )
      : null;
    return tag(
      h('span', { class: 'stack goalcard' }, h('span', { class: 'gh', text: 'Today' }), list, chest, ...(week ? [h('span', { class: 'gh wk', text: `This week · +${P.SILK.week}` }), week] : [])),
      { silk: 14, cls: 'goaltag', delay: 120 },
    );
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
        const open = s.id <= save.open;
        const rec = save.spouts[s.id] ?? {};
        const total = fliesOn(s.id);
        const got = P.popcount(rec.flies ?? 0);
        const b = tag(
          h(
            'span',
            { class: 'stack' },
            h('span', { class: 'num', text: String(s.id) }),
            h('span', { class: 'name', text: s.name }),
            open ? stars(rec.stars ?? 0, 15) : h('span', { class: 'lock', text: 'Locked' }),
            open && total ? h('span', { class: 'fl' }, h('i', { class: 'flyi' }), `${got}/${total}`, h('i', { class: `gdot ${rec.gold ? 'on' : ''}` })) : null,
            rec.best ? h('span', { class: 'best', text: fmtTime(rec.best) }) : null,
          ),
          { small: true, silk: 10 + (s.id % 3) * 6, delay: s.id * 25, disabled: !open, onclick: open ? () => startSolo(s.id, false) : null, cls: `spout ${open ? '' : 'locked'}` },
        );
        grid.append(b);
      }
      el.append(grid, tag('Back', { main: true, silk: 16, onclick: toLobby, cls: 'back' }));
    });
  }
  const fliesCache = new Map();
  function fliesOn(id) {
    if (!fliesCache.has(id)) {
      try {
        const r = createRun({ kind: 'solo', spout: id, seed: 1, seats: [] });
        fliesCache.set(id, r.level.flies.filter((f) => !f.gold).length);
      } catch {
        fliesCache.set(id, 0);
      }
    }
    return fliesCache.get(id);
  }

  // ---- the wardrobe: your spider close up, the slots, the items

  function showWardrobe() {
    sfx('ui');
    flow = 'wardrobe';
    clearHint();
    hideLobby(true);
    ensureLobbyRun();
    drawWardrobe();
  }
  function drawWardrobe() {
    const lv = P.levelOf(save.silk);
    ui.show('wardrobe', (el) => {
      const tabs = h('div', { class: 'tabs' });
      for (const slot of P.SLOTS) {
        tabs.append(
          tag(slot.name, {
            small: true,
            silk: 8,
            cls: `tab ${slot.id === wardrobeSlot ? 'on' : ''}`,
            onclick: () => {
              wardrobeSlot = slot.id;
              sfx('ui');
              drawWardrobe();
            },
          }),
        );
      }
      const slot = P.SLOTS.find((s) => s.id === wardrobeSlot);
      const items = h('div', { class: 'items' });
      const worn = myLook()[slot.id === 'color' ? 'colorId' : slot.id];
      for (const item of slot.items) {
        const own = P.owns(save, item);
        const on = worn === item.id;
        const face = h(
          'span',
          { class: 'stack' },
          slot.id === 'color' ? h('i', { class: 'swatch', style: `--c:${item.hex}` }) : null,
          h('span', { class: 'iname', text: item.name }),
          own ? null : h('span', { class: 'need', text: item.feat ? item.note : `Level ${item.level}` }),
        );
        items.append(
          tag(face, {
            small: true,
            silk: 6,
            cls: `item ${on ? 'on' : ''} ${own ? '' : 'locked'}`,
            disabled: !own,
            onclick: own
              ? () => {
                  save.look[slot.id] = item.id;
                  saveProgress();
                  sfx('ui');
                  applyMyLook();
                  drawWardrobe();
                }
              : null,
          }),
        );
      }
      el.append(h('div', { class: 'wtop' }, tag(profileFace(lv), { silk: 14, cls: 'profile' }), tag('Done', { main: true, silk: 14, onclick: toLobby, cls: 'done' })), h('div', { class: 'wpanel' }, tabs, items));
    });
  }
  function applyMyLook() {
    const look = myLook();
    for (const r of curRun?.racers ?? []) if (r.me || r.isMe) r.look = { ...look };
  }

  // ---- solo and Monsoon

  function startSolo(id, tutorial) {
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
    flyover = { from: r.level.H - 200, t: 0, dur: tutorial ? 2.4 : 1.6 };
    ghostFor(def.id).then((g) => {
      if (solo && solo.id === def.id) solo.ghost = g;
    });
    blurButtons();
  }

  function startMonsoon() {
    sfx('ui');
    const day = today();
    const r = createRun({ kind: 'monsoon', monsoonSeed: daySeed(day), seats: [{ id: 'me', name: room?.me?.name ?? 'You', me: true, index: 0 }] });
    flow = 'monsoon';
    clearHint();
    paused = false;
    solo = null;
    mon = { day, doneAt: 0 };
    if (save.mon.day !== day) {
      save.mon.day = day;
      save.mon.dayBest = 0;
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
    input.clear();
    if (on) {
      setControls(false);
      ui.show('pause', (el) =>
        el.append(
          h(
            'div',
            { class: 'card' },
            tag('Paused', { silk: 40, cls: 'heading' }),
            h('div', { class: 'buttons' }, tag('Resume', { main: true, silk: 16, onclick: () => setPaused(false) }), tag('Restart', { silk: 22, onclick: restart }), tag('Back', { silk: 28, onclick: toLobby })),
          ),
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
    if (mon) startMonsoon();
    else if (solo) startSolo(solo.id, solo.tutorial);
  }

  // ------------------------------------------------------------ the match

  function onPhase(p, prev) {
    if (p === 'intro' || p === 'round') {
      if (amRacing()) {
        if (flow !== 'race') enterRace();
      } else if (flow === 'lobby' || flow === 'spouts' || flow === 'wardrobe') enterRace();
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
        tag(h('span', { class: 'stack' }, h('span', { class: 'big', text: s.name }), h('span', { class: 'sub' }, ...cup.spouts.map((sid, i) => h('span', { class: sid === s.id ? 'lit' : '', text: `${i ? ' · ' : ''}${spoutById(sid).name}` })))), {
          silk: 34,
          cls: 'spoutname',
        }),
      ),
    );
    setControls(amRacing());
  }

  function lookOf(id) {
    const r = net?.round?.run.byId.get(id) ?? curRun?.byId?.get(id);
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
    let reward = null;
    if (me && !match.spectating && !STAGE) {
      save.n.races++;
      const mine = curRun?.me;
      if (myPlace === 1) {
        save.n.wins++;
        award('out-came-the-sun');
        if (mine?.sp?.stats.washes > 0) award('up-the-spout-again');
        submit('races-won', save.n.wins);
      }
      const day = today();
      const got = [P.track(save, 'race', 1, day)];
      if (mine?.finish) {
        got.push(P.track(save, 'climb', 1, day));
        if (mine.sp && mine.sp.stats.washes === 0) got.push(P.track(save, 'dry', 1, day));
      }
      reward = P.climbReward({ kind: 'race', spout: curRun.def.id, finished: !!mine?.finish, place: myPlace, flies: tally.flies, gold: tally.gold, perfect: tally.perfect, swings: tally.swings, combo: tally.combo });
      goalsDone(got);
      grant(reward.total + got.reduce((a, g) => a + g.silk, 0));
      shareHeld();
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
      el.append(list, reward ? silkLine(reward.total) : null, nextLine(nextId ? `Next · ${spoutById(nextId).name}` : 'Cup podium'));
    });
    if (myPlace === 1 && !match.spectating) sfx('fanfare');
    setTimeout(announceLevels, 1200);
  }

  function showCupResults() {
    const res = match.results ?? match.standings;
    if (!res?.length) return;
    setControls(false);
    const me = match.me;
    const top = res.slice(0, 3);
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
      const isHost = room?.isHost && room.kind !== 'public' && match.isHost;
      const end = isHost ? tag(h('span', { class: 'withsecs' }, 'Lobby', secsEl()), { main: true, silk: 16, onclick: () => safe(() => match.skip()), cls: 'continue' }) : nextLine('Lobby');
      el.append(h('div', { class: 'cuptable' }, pod, h('div', { class: 'tablecol' }, rest, end)));
    });
    if (top[0] && curRun) {
      const r = curRun.byId.get(top[0].id);
      if (r) confettiAt(r, 70);
    }
  }

  let secsShown = [];
  function secsEl() {
    const el = h('span', { class: 'secs', text: String(Math.max(0, Math.ceil(match?.secondsLeft ?? 0))) });
    secsShown = [...secsShown.filter((x) => x.isConnected), el];
    return el;
  }
  function nextLine(text) {
    return h('div', { class: 'nextline' }, h('span', { text }), secsEl());
  }
  function silkLine(n) {
    return h('div', { class: 'silkline' }, h('i', { class: 'spool' }), `+${n} silk`);
  }

  function onResults(standings, mine) {
    if (!mine || STAGE) return;
    if (mine.place === 1) {
      save.n.cups++;
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

  // ------------------------------------------------------------ silk, goals, levels

  const levelQueue = [];
  /** Adds silk; level-ups (and what they unlock) are announced at the next calm moment. */
  function grant(n) {
    if (!(n > 0)) return;
    const r = P.addSilk(save, n);
    for (const l of r.levels) levelQueue.push(l);
    save.lastLevel = r.after;
  }
  /** Goals finished: a toast each, the chest when all three are done. */
  function goalsDone(results) {
    for (const r of results) {
      for (const g of r.done) toast(P.GOAL_KINDS[g.kind].label(g.n), `Goal · +${P.SILK.goal} silk`, 'goal');
      if (r.week) toast(P.GOAL_KINDS[r.week.kind].label(r.week.n), `This week's goal · +${P.SILK.week} silk`, 'chest');
      if (r.chest) toast('Chest opened', `+${P.chestSilk(save.streak.n)} silk · ${save.streak.n} day streak`, 'chest');
    }
  }
  function trackNow(kind, n) {
    if (STAGE) return;
    const r = P.track(save, kind, n, today());
    if (r.done.length || r.chest || r.week) {
      goalsDone([r]);
      grant(r.silk);
      saveProgress();
    }
  }
  const toasts = [];
  function toast(text, sub, kind) {
    toasts.push({ text, sub, kind });
    if (toasts.length === 1) nextToast();
  }
  function nextToast() {
    const t = toasts[0];
    if (!t) return;
    sfx(t.kind === 'chest' ? 'chest' : t.kind === 'level' ? 'levelup' : t.kind === 'unlock' ? 'unlock' : 'goal');
    const el = h('div', { class: `toast ${t.kind}` }, h('span', { class: 'tt', text: t.text }), t.sub ? h('span', { class: 'ts', text: t.sub }) : null);
    uiRoot.append(el);
    setTimeout(() => el.classList.add('out'), 2300);
    setTimeout(() => {
      el.remove();
      toasts.shift();
      nextToast();
    }, 2650);
  }
  function announceLevels() {
    while (levelQueue.length) {
      const l = levelQueue.shift();
      const what = l.unlocks.map((u) => u.name).join(', ');
      toast(`Level ${l.level}`, what ? `New · ${what}` : 'Spider level up', 'level');
    }
  }
  /** This climb's held flushes go into everyone's count for today. */
  function shareHeld() {
    const n = Math.min(20, tally.held);
    tally.held = 0;
    const g = gameData();
    if (n > 0 && g) later(safe(() => g.add('held-today', n)));
  }

  // ------------------------------------------------------------ finishing

  function onMyFinish(r) {
    sfx('finish');
    musicSun();
    juice.flashIt(0.4, 0xfff0c8);
    juice.add(0.2);
    juice.slowMo(0.3, 0.5);
    juice.punchIn(0.6);
    confettiAt(r, 60);
    setControls(false);
    if (flow === 'solo' && solo) finishSolo(r);
  }

  function finishSolo(r) {
    const id = solo.id;
    const time = Math.round(r.finish * 100) / 100;
    const n = starsFor(id, time);
    const rec = P.recordSpout(save, { spout: id, time, stars: n, fliesMask: tally.mask, gold: tally.gold });
    const tutorial = solo.tutorial;
    if (tutorial) save.tut = true;
    save.n.climbs++;
    award('first-climb');
    const dry = r.sp.stats.washes === 0;
    if (dry) award('no-washouts');
    if (SPOUTS.every((s) => save.spouts[s.id]?.best)) award('twelve-spouts');
    if (SPOUTS.every((s) => save.spouts[s.id]?.stars === 3)) award('all-stars');
    if (SPOUTS.every((s) => save.spouts[s.id]?.gold)) award('golden-flies');
    submit(`spout-${id}`, time, { lowerIsBetter: true });
    if (rec.newBest && curRun?.recorder) {
      const g = packGhost(curRun.recorder, time);
      ghosts.set(id, unpackGhost(g));
      later(ow.save.set(`ghost-${id}`, g));
    }
    const day = today();
    const got = [P.track(save, 'climb', 1, day)];
    if (dry) got.push(P.track(save, 'dry', 1, day));
    const reward = P.climbReward({ kind: tutorial ? 'tutorial' : 'solo', spout: id, finished: true, newStars: rec.newStars, flies: rec.newFlies, gold: rec.newGold, perfect: tally.perfect, swings: tally.swings, combo: tally.combo });
    const before = P.levelOf(save.silk);
    grant(reward.total + got.reduce((a, g) => a + g.silk, 0));
    goalsDone(got);
    shareHeld();
    saveProgress();
    solo.doneAt = performance.now() / 1000;
    setTimeout(() => {
      if (flow !== 'solo' || !solo || solo.id !== id) return;
      flow = 'solo-done';
      paused = false;
      const nextId = id < SPOUTS.length && save.open > id ? id + 1 : 0;
      const nextStar = n < 3 ? STAR_TIMES[id]?.[n < 2 ? 0 : 1] : 0;
      ui.show('finish', (el) => {
        el.append(
          h(
            'div',
            { class: 'card' },
            tag(
              h(
                'span',
                { class: 'stack' },
                h('span', { class: 'big', text: fmtTime(time) }),
                stars(n, 30, true),
                h('span', { class: 'sub', text: rec.newBest && rec.prevBest ? `New best · was ${fmtTime(rec.prevBest)}` : rec.prevBest ? `Best ${fmtTime(rec.prevBest)}` : spoutById(id).name }),
                nextStar ? h('span', { class: 'sub next', text: `${n < 2 ? 2 : 3} stars · under ${fmtTime(nextStar)}` }) : null,
              ),
              { silk: 40, cls: 'timecard' },
            ),
            rewardCard(reward, before),
            h(
              'div',
              { class: 'buttons' },
              tutorial ? tag('Race', { main: true, silk: 16, onclick: toLobby }) : nextId ? tag('Next', { main: true, silk: 16, onclick: () => startSolo(nextId, false) }) : null,
              tag('Again', { main: !tutorial && !nextId, silk: 22, onclick: () => startSolo(id, false) }),
              tutorial ? null : tag('Back', { silk: 28, onclick: toLobby }),
            ),
          ),
        );
        [0, 1, 2].slice(0, n).forEach((i) => setTimeout(() => sfx('star', i), 300 + i * 260));
      });
      setTimeout(announceLevels, 1600);
    }, 1500);
  }

  /** The silk earned, line by line, counting up into the level bar. */
  function rewardCard(reward, before) {
    const lines = h('div', { class: 'rlines' });
    reward.lines.forEach((l, i) => lines.append(h('div', { class: 'rl', style: `--d:${500 + i * 160}ms` }, h('span', { text: l.label }), h('span', { class: 'rs', text: `+${l.silk}` }))));
    const after = P.levelOf(save.silk);
    const pct = (lv) => (lv.max ? 100 : Math.round((lv.into / Math.max(1, lv.need)) * 100));
    const bar = h('i', { style: `width:${pct(before)}%` });
    const lvl = h('span', { class: 'lvl', text: String(before.level) });
    const total = h('span', { class: 'rs', text: '+0' });
    const lineMs = 500 + reward.lines.length * 160;
    setTimeout(() => {
      if (!bar.isConnected) return;
      bar.style.width = `${after.level > before.level ? 100 : pct(after)}%`;
      if (after.level > before.level) {
        setTimeout(() => {
          lvl.textContent = String(after.level);
          lvl.classList.add('pop');
          sfx('levelup');
          bar.style.transition = 'none';
          bar.style.width = '0%';
          void bar.offsetWidth;
          bar.style.transition = '';
          bar.style.width = `${pct(after)}%`;
        }, 800);
      }
      // the total counts up with a tick
      const steps = Math.min(16, Math.max(4, reward.lines.length * 3));
      let k = 0;
      const tick = setInterval(() => {
        k++;
        total.textContent = `+${Math.round((reward.total * k) / steps)}`;
        sfx('silkTick', k);
        if (k >= steps || !bar.isConnected) clearInterval(tick);
      }, 55);
    }, lineMs);
    return tag(h('span', { class: 'stack reward' }, lines, h('span', { class: 'rtotal' }, h('span', { text: 'Silk' }), total), h('span', { class: 'prof' }, lvl, h('span', { class: 'bar' }, bar))), {
      silk: 12,
      cls: 'rewardtag',
      delay: 300,
    });
  }

  function endMonsoon(r) {
    if (!mon || mon.doneAt) return;
    mon.doneAt = performance.now() / 1000;
    const m = Math.floor(curRun.best / M);
    sfx('flood');
    juice.add(0.5);
    juice.hit(0.08);
    fx.spray(r.sp.x, curRun.mon.flood, 30, Math.PI / 2, 1, 420);
    setControls(false);
    const prevBest = save.mon.best;
    const prevDay = save.mon.dayBest;
    if (!STAGE) {
      save.mon.best = Math.max(prevBest, m);
      save.mon.dayBest = Math.max(save.mon.dayBest, m);
      if (m >= 100) award('monsoon-100');
      submit('monsoon', m);
    }
    const day = today();
    const got = STAGE ? [] : [P.track(save, 'monsoon', m, day)];
    const reward = P.climbReward({ kind: 'monsoon', metres: m, flies: tally.flies, perfect: tally.perfect, swings: tally.swings, combo: tally.combo });
    const before = P.levelOf(save.silk);
    if (!STAGE) {
      grant(reward.total + got.reduce((a, g) => a + g.silk, 0));
      goalsDone(got);
      shareHeld();
      saveProgress();
      // today's board: everyone's best today (pushed when you beat your own)
      const g = gameData();
      if (g && m > prevDay && m >= 5) later(safe(() => g.push('monsoon-today', { d: day, m })));
    }
    const board = h('div', { class: 'board' }, h('span', { class: 'gh', text: 'Today' }));
    loadTodayBoard(day, board, m);
    setTimeout(() => {
      if (flow !== 'monsoon') return;
      flow = 'monsoon-done';
      paused = false;
      ui.show('finish', (el) =>
        el.append(
          h(
            'div',
            { class: 'card' },
            tag(h('span', { class: 'stack' }, h('span', { class: 'big', text: `${m} m` }), h('span', { class: 'sub', text: m > prevBest && prevBest ? `New best · was ${prevBest} m` : `Best ${save.mon.best} m · today ${save.mon.dayBest} m` })), {
              silk: 40,
              cls: 'timecard',
            }),
            h('div', { class: 'cardrow' }, rewardCard(reward, before), tag(board, { silk: 18, cls: 'boardtag', delay: 400 })),
            h('div', { class: 'buttons' }, tag('Again', { main: true, silk: 16, onclick: startMonsoon }), tag('Back', { silk: 26, onclick: toLobby })),
          ),
        ),
      );
      setTimeout(announceLevels, 1600);
    }, 1300);
  }

  async function loadTodayBoard(day, el, mine) {
    let items = null;
    try {
      items = await gameData()?.get('monsoon-today');
    } catch {
      items = null;
    }
    const best = new Map();
    if (Array.isArray(items)) {
      for (const it of items) {
        const v = it?.value;
        const by = it?.by;
        if (!v || typeof v !== 'object' || v.d !== day || !(typeof v.m === 'number' && v.m > 0) || !by || typeof by.name !== 'string') continue;
        const key = typeof by.id === 'string' ? by.id : by.name;
        const m = Math.min(100000, Math.floor(v.m));
        if (!best.has(key) || best.get(key).m < m) best.set(key, { name: by.name.slice(0, 20), m, me: key === room?.me?.id });
      }
    }
    const meId = room?.me?.id ?? 'me';
    const myBest = Math.max(mine, save.mon.dayBest);
    if (myBest > 0 && (!best.has(meId) || best.get(meId).m < myBest)) best.set(meId, { name: room?.me?.name ?? 'You', m: myBest, me: true });
    const rows = [...best.values()].sort((a, b) => b.m - a.m);
    const mineAt = rows.findIndex((r) => r.me);
    const shown = rows.slice(0, 5);
    if (mineAt >= 5) shown.push(rows[mineAt]);
    if (!shown.length) el.append(h('span', { class: 'sub', text: 'Be the first today' }));
    shown.forEach((r) => el.append(h('div', { class: `brow ${r.me ? 'mine' : ''}` }, h('span', { class: 'bn', text: String(rows.indexOf(r) + 1) }), h('span', { class: 'nm', text: r.name }), h('span', { text: `${r.m} m` }))));
  }

  function confettiAt(r, n = 36) {
    if (reduced()) return;
    fx.confetti(r.st.x, r.st.y + 10, n, [r.look.color, '#FFB648', '#F3EDE2', '#FFD27A']);
  }

  function hazardFx(r, kind) {
    if (kind === 'debris') {
      fx.sparks(r.st.x, r.st.y + 10, 10);
      sfx('debris');
    } else if (kind === 'bird') {
      sfx('peck');
      fx.puff(r.st.x, r.st.y, 6);
    }
    if (r.me) {
      juice.add(0.4);
      juice.hit(0.06);
    }
  }

  /** Adds to your combo; true when it popped its count over the spider. */
  function comboAdd(r, k) {
    if (!r.me || r.finish) return false;
    combo.n += k;
    combo.left = COMBO_T;
    combo.at = performance.now() / 1000;
    tally.combo = Math.max(tally.combo, combo.n);
    if (combo.n < 2) return false;
    sfx('combo', combo.n);
    pop(r, `×${combo.n}`, combo.n >= 10 ? '#FFD060' : '#F3EDE2', combo.n >= 10);
    if (combo.n === 10 || combo.n === 20) juice.punchIn(0.25);
    trackNow('combo', combo.n);
    return true;
  }
  function comboBreak(r) {
    if (!r.me) return;
    if (combo.n >= 4) {
      sfx('comboLost');
      pop(r, 'Combo lost', '#FF9A7A');
    }
    combo.n = 0;
    combo.left = 0;
  }

  function flyFx(r, f) {
    if (r.me) {
      if (f.gold) {
        tally.gold = true;
        save.n.gold++;
        sfx('gold');
        juice.flashIt(0.3, 0xffd060);
        juice.hit(0.06);
        juice.punchIn(0.3);
        fx.stars(f.x, f.y, 12);
        fx.ring(f.x, f.y, 50, [3, 2.2, 0.6]);
        pop(r, 'Golden fly!', '#FFD060', true);
        trackNow('gold', 1);
        comboAdd(r, 3);
      } else {
        tally.flies++;
        tally.mask |= 1 << Math.min(29, flyIndex(f));
        save.n.flies++;
        sfx('fly', combo.n);
        fx.glint(f.x, f.y, 0, 9, [2.4, 2.4, 2]);
        if (!comboAdd(r, 1)) pop(r, '+1', '#F3EDE2');
        trackNow('flies', 1);
      }
    } else if (onScreen(r)) fx.glint(f.x, f.y, 0, 6, [1.6, 1.6, 1.4]);
  }
  function flyIndex(f) {
    return Math.max(0, curRun.level.flies.filter((x) => !x.gold).indexOf(f));
  }

  function pop(r, text, color, big = false) {
    pops.push({ x: r.st.x, y: r.st.y, text, color, big, size: big ? 28 : 22, age: 0, life: big ? 1.3 : 0.9, rot: (Math.random() - 0.5) * 0.24 });
    if (pops.length > 8) pops.shift();
  }

  const view0 = { y0: 0, y1: 1 };
  const onScreen = (r) => r.st.y > view0.y0 - 80 && r.st.y < view0.y1 + 80;

  // What every other spider on screen does, from its state changes: dust, splashes, sparks.
  const was = new Map();
  function transitions(run) {
    for (const r of run.racers) {
      const st = r.st;
      let w = was.get(r.id);
      if (!w) {
        was.set(r.id, (w = { m: st.m, h: st.h }));
        continue;
      }
      if (w.m !== st.m && onScreen(r) && !r.me) {
        if (st.m === 'air') fx.puff(st.x, st.y - 8, 3);
        else if ((w.m === 'air' || w.m === 'swing') && st.m === 'surf') fx.puff(st.x, st.y - 10, 4);
        else if (st.m === 'washed') fx.spray(st.x, st.y, 10, Math.PI / 2, 1.3, 300);
        else if (st.m === 'dazed') fx.sparks(st.x, st.y - 10, 6);
      }
      if (st.h && !w.h && !r.me && onScreen(r)) fx.spray(st.x, st.y, 3, Math.PI / 2, 0.8, 80);
      w.m = st.m;
      w.h = st.h;
    }
  }

  // Trails (a cosmetic): a few motes behind a moving spider.
  const trailAt = new Map();
  function trails(list, real) {
    if (reduced()) return;
    for (const fr of list) {
      const tr = fr.look?.trail;
      if (!tr || tr === 'none' || fr.ghost || fr.hidden) continue;
      const st = fr.st;
      if (st.y < view0.y0 - 40 || st.y > view0.y1 + 40) continue;
      let p = trailAt.get(fr.id);
      if (!p) {
        trailAt.set(fr.id, { x: st.x, y: st.y, acc: 0 });
        continue;
      }
      const d = Math.hypot(st.x - p.x, st.y - p.y);
      p.x = st.x;
      p.y = st.y;
      if (d > 80) continue;
      p.acc += d;
      const gap = tr === 'bubbles' ? 16 : tr === 'leaves' ? 20 : 9;
      while (p.acc > gap) {
        p.acc -= gap;
        const jx = (Math.random() - 0.5) * 6;
        const jy = (Math.random() - 0.5) * 6;
        if (tr === 'rainbow') {
          const hue = (real * 0.6 + Math.random() * 0.1) % 1;
          const c = hsl(hue);
          fx.trail(st.x + jx, st.y + jy, 4, c, 3.2);
        } else if (tr === 'sparkle') {
          if (Math.random() < 0.35) fx.glint(st.x + jx * 2, st.y + jy * 2, 6, 5, TRAIL_RGB.sparkle[0]);
          else fx.trail(st.x + jx, st.y + jy, 4, TRAIL_RGB.sparkle[0], 1.8);
        } else {
          const set = TRAIL_RGB[tr] ?? TRAIL_RGB.sparkle;
          fx.trail(st.x + jx, st.y + jy, 4, set[Math.floor(Math.random() * set.length)], tr === 'bubbles' ? 3.6 : tr === 'leaves' ? 3 : tr === 'embers' ? 2 : tr === 'frost' ? 2.2 : 2.6);
          if (tr === 'frost' && Math.random() < 0.25) fx.glint(st.x + jx * 2, st.y + jy * 2, 6, 4, set[1]);
        }
      }
    }
  }
  function hsl(h) {
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0) * 2.4, f(8) * 2.4, f(4) * 2.4];
  }

  // The local spider's events: sounds, juice, words, counters, haptics.
  let washedLast = false;
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
          fx.spray(sp.x, sp.y, 3, Math.PI / 2, 0.6, 60);
          break;
        case 'perfect':
          sfx('perfect');
          tally.perfect++;
          save.n.perfect++;
          juice.punchIn(0.45);
          juice.hit(0.05);
          fx.ring(sp.x, sp.y, 44, [3, 2.4, 1.2]);
          fx.stars(sp.x, sp.y + 6, 8);
          pop(r, 'Perfect!', '#FFD060', true);
          trackNow('perfect', 1);
          comboAdd(r, 2);
          if (save.n.perfect >= 25) award('perfect-hold');
          break;
        case 'spring':
          sfx('spring');
          fx.ring(sp.x, sp.y, 28, [1.6, 2.2, 3]);
          break;
        case 'release':
          sfx('release');
          break;
        case 'leg':
          sfx('leg', e.n ?? 0);
          break;
        case 'outOfGrip':
          sfx('outOfGrip');
          juice.add(0.15);
          break;
        case 'jump':
          sfx('jump', e.speed ?? 0);
          fx.puff(sp.x - sp.nx * 8, sp.y - sp.ny * 8, 3);
          break;
        case 'land':
          if ((e.impact ?? 0) > 600) {
            sfx('bigland');
            juice.add(0.16);
            fx.puff(sp.x, sp.y, 7);
          } else {
            sfx('land');
            fx.puff(sp.x, sp.y, 3);
          }
          break;
        case 'splashOver':
          sfx('splashOver');
          fx.spray(sp.x, sp.y + 8, 8, Math.PI / 2, 1.4, 260);
          break;
        case 'survived':
          save.n.held++;
          tally.held++;
          if (save.n.held >= 10) award('hold-on');
          washedLast = false;
          trackNow('held', 1);
          comboAdd(r, 1);
          break;
        case 'silk': {
          sfx('silk');
          tally.swings++;
          save.n.swings++;
          trackNow('swing', 1);
          comboAdd(r, 1);
          const sn = curRun.level.snags[e.snag];
          if (sn) {
            fx.glint(sn.x, sn.y, 0, 12);
            fx.ring(sn.x, sn.y, 18, [2.4, 2.4, 2.2]);
          }
          break;
        }
        case 'fling':
          sfx('fling', e.speed ?? 0);
          if ((e.speed ?? 0) > 500) {
            juice.add(0.08);
            juice.punchIn(0.15);
          }
          break;
        case 'snap':
          sfx('snap');
          pop(r, 'Snap!', '#FF9A7A');
          comboBreak(r);
          break;
        case 'scrabble':
          sfx('scrabble');
          fx.puff(sp.x, sp.y, 2);
          break;
        case 'washed':
          comboBreak(r);
          sfx('washed');
          juice.add(0.45);
          juice.hit(0.07);
          save.n.washes++;
          washedLast = true;
          showHint('holdWhen', 'Hold J as it hits', 'Hold as it hits', { life: 2.4, target: 'buttons', times: 2 });
          safe(() => navigator.vibrate?.(40));
          break;
        case 'caught':
          sfx('caught');
          juice.add(0.25);
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
          comboBreak(r);
          if (e.kind === 'bump') sfx('bump');
          juice.add(0.35);
          safe(() => navigator.vibrate?.(30));
          break;
        default:
          break;
      }
    }
    sp.events.length = 0;
  }
  /** Other spiders' events are only for the picture; every list is emptied every frame. */
  function otherEvents(run) {
    for (const r of run.racers) {
      if (!r.sp) continue;
      if (!r.me && onScreen(r)) {
        for (const e of r.sp.events) {
          if (e.type === 'perfect') fx.ring(r.sp.x, r.sp.y, 30, [2.4, 2, 1]);
          else if (e.type === 'silk') {
            const sn = run.level.snags[e.snag];
            if (sn) fx.glint(sn.x, sn.y, 0, 7);
          }
        }
      }
      r.sp.events.length = 0;
    }
  }

  // ------------------------------------------------------------ hints (2-5 words, once, at the moment they matter)

  function clearHint() {
    hint.age = hint.life;
  }

  function showHint(key, keysText, touchText, opts = {}) {
    if (STAGE || AUTOPLAY) return false;
    const n = save.seen[key] ?? 0;
    if (n >= (opts.times ?? 1)) return false;
    if (hint.key === key && hint.age < hint.life) return true;
    if (hint.age < hint.life && hint.key !== key && hint.age < 0.8) return false; // let the last one be read
    save.seen[key] = n + 1;
    saveProgress();
    const touch = touchMode();
    const t = opts.target ?? null;
    hint = { key, text: touch ? touchText : keysText, age: 0, life: opts.life ?? 2.2, target: touch || t === 'lobby' || t?.wx != null ? t : null };
    return true;
  }

  function hintTarget(target) {
    if (!target) return null;
    if (typeof target === 'object') {
      if (target.wx == null) return null;
      const p = view.project(target.wx, target.wy, 0, {});
      return { x: p.x, y: p.y };
    }
    const list = reserved ?? [];
    const area = list.find((r) => r.kind === target);
    if (area) return { x: area.x + area.w * (target === 'buttons' ? 0.7 : 0.5), y: area.y + area.h * 0.5 };
    if (target === 'buttons') return { x: W - 80, y: HGT - 90 };
    if (target === 'stick') return { x: 90, y: HGT - 110 };
    if (target === 'lobby') return { x: W / 2, y: HGT - 44 };
    return null;
  }

  const rinfo = {};
  let warnWave = -1;
  let flushWave = -1;
  let holdAfter = 0;
  let lightningAt = 0;
  let sunNow = false;
  let silkTarget = null;
  function playHints(r, dt) {
    const sp = r.sp;
    if (!sp || !curRun || r.finish) return;
    const tut = solo?.tutorial;
    if (tut && sp.y < 120 && curRun.t > 0.3) showHint('climb', 'Up to climb', 'Push up to climb', { target: 'stick', life: 3 });
    rainAt(curRun.weather, sp.y, curRun.t, rinfo);
    if (rinfo.warn && rinfo.next > 0.9) showHint('rain', 'Rain coming', 'Rain coming', { life: 1.4 });
    if (rinfo.warn && rinfo.next < 0.9 && !sp.holding && !inPocket(curRun.level, sp.x, sp.y) && (tut || washedLast)) {
      showHint('hold', 'Hold J when the ring is gold', 'Hold when the ring is gold', { target: 'buttons', life: 1.2, times: 4 });
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
    if (curRun.t > 10 || featuresIn(curRun.level, 'bracket', sp.y + 40, sp.y + 260).length) showHint('jump', 'Space to jump · hold for higher', 'Jump · hold for higher', { target: 'buttons', life: 2.4 });
    if (sp.mode === 'air' && silkTarget) showHint('silk', 'Space again: silk', 'Jump again: silk', { life: 2, target: { wx: silkTarget.x, wy: silkTarget.y } });
    if (curRun.level.flies.some((f) => !f.gold && f.y > sp.y && f.y < sp.y + 260)) showHint('flies', 'Flies: a burst of speed', 'Flies: a burst of speed', { life: 2 });
    if (featuresIn(curRun.level, 'moss', sp.y, sp.y + 300).length) showHint('moss', 'Moss: no grip', 'Moss: no grip', { life: 2 });
    if (featuresIn(curRun.level, 'seam', sp.y, sp.y + 320).length) showHint('bird', 'Mind the bird', 'Mind the bird', { life: 2 });
    if (featuresIn(curRun.level, 'vent', sp.y - 100, sp.y + 200).length) showHint('vent', 'Warm air lifts jumps', 'Warm air lifts jumps', { life: 2.2 });
    if (sp.run > 0.5 && curRun.t > 6) showHint('scurry', 'Keep running: faster', 'Keep running: faster', { life: 1.8 });
  }

  // ------------------------------------------------------------ the camera

  let camSnap = true;
  const cam = { x: 0, y: 0, viewH: 420, lean: 0, rise: 95 };
  let W = 0;
  let HGT = 0;

  /** How much of the world a screen shows: close in landscape, the pipe and a margin across a portrait screen. */
  function baseViewH() {
    const aspect = W / Math.max(1, HGT);
    const across = PIPE_W + 2 * 18 + 160; // the pipe, its walls and some wall either side
    return Math.max(370, across / Math.max(0.3, aspect));
  }
  let zoomOut = 0;

  function chaseAfterFinish() {
    const me = curRun.me;
    if (flow !== 'race' || !me?.finish || curRun.t - me.finish < 2.5) return null;
    let best = null;
    for (const r of curRun.racers) if (!r.left && !r.finish && r.st && (!best || r.st.y > best.st.y)) best = r;
    return best;
  }

  function cameraTarget(dt) {
    if (posterCam) return posterCam;
    const H = curRun.level.H;
    const vh = baseViewH();
    let viewH = vh;
    let chase = null;
    const lead = 0.14;
    let ty = cam.y;
    let tx = null;
    let lean = 0;
    let rise = 95;
    let topShot = false;
    if (flow === 'title' && attract) {
      let best = null;
      for (const r of attract.racers) if (!best || r.st.y > best.st.y) best = r;
      ty = (best?.st.y ?? 0) + vh * lead;
      viewH = vh * 1.1;
    } else if (flow === 'lobby' || flow === 'spouts') {
      // the spiders on the drain, big: the pipe's width across a tall screen, close on a wide one
      viewH = W > HGT ? 250 : (PIPE_W + 50) / Math.max(0.3, W / HGT);
      ty = W > HGT ? viewH * 0.2 : -viewH * 0.1;
      tx = centerXAt(curRun.level, 0);
    } else if (flow === 'wardrobe') {
      // your spider alone, close, left of the panel (above it on a tall screen)
      const me = curRun.racers.find((r) => r.isMe) ?? curRun.racers[0];
      const wide = W / HGT >= 1.2;
      viewH = wide ? 92 : 92 / Math.max(0.45, W / HGT) * 0.6;
      const across = viewH * (W / HGT);
      ty = (me?.st.y ?? 0) + (wide ? 4 : -viewH * 0.14);
      tx = (me?.st.x ?? 0) - (me?.st.f ?? 1) * 5 + (wide ? across * 0.22 : 0);
      lean = -18;
      rise = 26;
    } else if ((chase = chaseAfterFinish())) {
      ty = chase.st.y + vh * lead;
    } else if (curRun.me && !(flow === 'race' && match?.spectating)) {
      const me = curRun.me;
      const d = drawStates.get(me.id) ?? me.st;
      const sp = me.sp;
      const vy = sp ? sp.vy ?? 0 : 0;
      const vx = sp ? sp.vx ?? 0 : 0;
      // look ahead the way you're going (more up than down), lean into swings and runs
      lookY += (clamp(vy * 0.2, -80, 140) - lookY) * (1 - Math.exp(-dt * 3));
      ty = d.y + vh * lead + lookY;
      tx = centerXAt(curRun.level, d.y) * 0.6 + d.x * 0.4;
      lean = clamp(vx * 0.07, -40, 40);
      // close on the spider while it climbs; pull back when it flies, falls or gets washed down
      const fast = clamp((Math.hypot(vx, vy) - 250) / 900, 0, 1);
      zoomOut += (fast - zoomOut) * (1 - Math.exp(-dt * (fast > zoomOut ? 5 : 1.2)));
      viewH = vh * (1 + zoomOut * 0.2);
      if (me.finish) {
        // the top: the camera just over the roof's lip, looking up past the ridge to the sun and the rainbow, the
        // spider small on the gutter at the bottom of the picture
        viewH = vh * 1.5;
        const dist = viewH / 2 / Math.tan((15 * Math.PI) / 180);
        rise = -Math.tan((5 * Math.PI) / 180) * dist;
        ty = H + 100 - rise;
        topShot = true;
      }
      if (curRun.mon) ty = Math.max(ty, curRun.mon.flood + vh * 0.38);
    } else {
      let best = null;
      for (const r of curRun.racers) if (!r.left && (!best || r.st.y > best.st.y)) best = r;
      ty = (best?.st.y ?? 0) + vh * lead;
    }
    if (flow === 'race' && match?.phase === 'intro') {
      const k = clamp(1 - (match.secondsLeft ?? 0) / INTRO, 0, 1);
      const e = k < 0.45 ? 0 : clamp((k - 0.45) / 0.35, 0, 1);
      const ease = e * e * (3 - 2 * e);
      ty = (H - vh * 0.3) * (1 - ease) + ty * ease;
      viewH = vh * (1.6 - 0.6 * ease);
      camSnap = k < 0.05;
    } else if (flyover) {
      flyover.t += dt;
      const e = clamp(flyover.t / flyover.dur, 0, 1);
      const ease = e * e * (3 - 2 * e);
      ty = flyover.from * (1 - ease) + ty * ease;
      viewH = vh * (1.7 - 0.7 * ease);
      if (e >= 1) flyover = null;
    }
    const lo = viewH * 0.3 - 60;
    const hi = H + 560 - viewH * 0.5;
    const free = flow === 'wardrobe' || flow === 'lobby' || flow === 'spouts' || topShot;
    return { y: free ? ty : clamp(ty, Math.min(lo, hi), Math.max(lo, hi)), x: tx, viewH, lean, rise };
  }
  let lookY = 0;

  // ------------------------------------------------------------ the loop

  let lastReal = performance.now() / 1000;
  let lastCount = '';
  let gloom = 0;
  let calm = 1;
  const hudState = {};
  const debrisList = [];
  const debrisMarks = [];
  const ghostRacer = { id: '__ghost', ghost: true, look: { color: '#F3EDE2', mark: 'star', species: 'jumper' }, st: { x: 0, y: 0, a: 0, m: 'surf', g: 3, h: false, f: 1, k: -1, nx: 0, ny: 1 } };
  const ghostState = {};
  const aim = { x: 0, y: 0 };
  let ghostOn = false;
  const frameRacers = [];
  const drawStates = new Map();

  function resize() {
    W = stageBox?.w ?? Math.max(1, innerWidth);
    HGT = stageBox?.h ?? Math.max(1, innerHeight);
    uiRoot.classList.toggle('short', HGT <= 460);
    uiRoot.classList.toggle('wide', W / HGT >= 1.2);
    uiRoot.classList.toggle('narrow', W < 560);
    if (STAGE) {
      reserved = stageAreas();
      if (stageBox) Object.assign(uiRoot.style, { right: 'auto', bottom: 'auto', width: `${W}px`, height: `${HGT}px` });
    }
    let pr = safe(() => ow.settings.pixelRatio(2)) ?? Math.min(devicePixelRatio || 1, 2);
    pr = Math.min(pr, Math.sqrt((softGL ? 0.12e6 : quality() === 'high' ? 3.6e6 : quality() === 'medium' ? 2.2e6 : 1.2e6) / (W * HGT)));
    view.resize(W, HGT, pr);
    const hpr = Math.min(devicePixelRatio || 1, 2);
    hudCanvas.width = Math.round(W * hpr);
    hudCanvas.height = Math.round(HGT * hpr);
    hudCanvas.style.width = `${W}px`;
    hudCanvas.style.height = `${HGT}px`;
    hudCanvas.dataset.pr = String(hpr);
    layout = hudLayout(W, HGT, reserved, touchMode());
    setInsets(uiRoot, W, HGT, reserved);
  }
  addEventListener('resize', resize);
  resize();
  safe(() =>
    ow.on('reserved', (areas) => {
      reserved = areas;
      layout = hudLayout(W, HGT, reserved, touchMode());
      setInsets(uiRoot, W, HGT, reserved);
    }),
  );
  safe(() =>
    ow.settings.on('change', () => {
      view.setQuality(quality());
      juice.reduced = reduced();
      document.body.classList.toggle('reduced', juice.reduced);
      resize();
    }),
  );
  juice.reduced = reduced();
  document.body.classList.toggle('reduced', juice.reduced);
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

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const real = nowMs / 1000;
    const dt = Math.min(0.1, Math.max(0, real - lastReal));
    lastReal = real;
    if (document.hidden || shot?.done || shot?.manual) return;
    try {
      step(dt, real);
      render(dt, real);
    } catch (err) {
      console.error(err);
    }
  }

  function step(dt, real) {
    // hit-stop and slow motion stretch the sim's time, not the page's
    let simDt = dt;
    if (juice.stop > 0) {
      juice.stop -= dt;
      simDt = Math.min(dt, 0.004);
    }
    simDt *= juice.slow;
    if (net && match && inRacePhase()) {
      const r = net.round?.run;
      const me = r?.me;
      const mine = me && me.sp && flow === 'race' && !paused ? (AUTOPLAY ? autoInput(me, r) : input.read()) : null;
      net.update(mine, real);
      if (flow === 'race' && net.round && curRun !== net.round.run) useRun(net.round.run);
      if (flow === 'race' && me && curRun === net.round?.run) myEvents(me);
    }
    if (flow === 'title' && attract) {
      advance(attract, attract.t + simDt, null, { onHazard: (r, k) => onScreen(r) && hazardFx(r, k), onFly: (r, f) => onScreen(r) && fx.glint(f.x, f.y, 0, 6) });
      const done = attract.racers.some((r) => r.finish);
      if (done && !attract.until) attract.until = real + 4;
      if ((attract.until && real > attract.until) || attract.t > 160) newAttract();
    } else if ((flow === 'solo' || flow === 'solo-done') && curRun && !paused) {
      const me = curRun.me;
      if (!flyover || flow === 'solo-done') {
        const inp = flow === 'solo' && !me.finish ? (AUTOPLAY ? autoInput(me) : input.read()) : idle();
        advance(curRun, curRun.t + simDt, inp, { onFinish: (r) => r.me && onMyFinish(r), onHazard: (r, k) => hazardFx(r, k), onFly: (r, f) => flyFx(r, f) });
        myEvents(me);
        if (flow === 'solo') playHints(me, dt);
      }
    } else if ((flow === 'monsoon' || flow === 'monsoon-done') && curRun && !paused) {
      const me = curRun.me;
      const inp = flow === 'monsoon' && !mon?.doneAt ? (AUTOPLAY ? autoInput(me) : input.read()) : idle();
      advance(curRun, curRun.t + simDt, inp, { onDrown: (r) => endMonsoon(r), onHazard: (r, k) => hazardFx(r, k), onFly: (r, f) => flyFx(r, f) });
      myEvents(me);
      if (flow === 'monsoon') playHints(me, dt);
    } else if (flow === 'shot' && curRun && shot && !shot.frozen) {
      // store art: the staged run plays up to its moment, then holds still
      advance(curRun, Math.min(shot.t, curRun.t + simDt), null, { onHazard: (r, k) => hazardFx(r, k), onFly: (r, f) => flyFx(r, f), onFinish: (r) => confettiAt(r, 70) });
      if (curRun.t + STEP > shot.t + 1e-9) shot.frozen = true;
    } else if (flow === 'race' && curRun?.me && match?.phase === 'round') {
      playHints(curRun.me, dt);
    }
    if (curRun) otherEvents(curRun);
    if (combo.left > 0 && isPlaying() && !curRun?.me?.sp?.holding) {
      combo.left -= simDt;
      if (combo.left <= 0) combo.n = 0;
    }
    if (secsShown.length) {
      const v = String(Math.max(0, Math.ceil(match?.secondsLeft ?? 0)));
      for (const el of secsShown) if (el.textContent !== v) el.textContent = v;
    }
    if (AUTOPLAY) autoplayDriver(real);
    if (hint.text) hint.age += dt;
    if (count) count.age += dt;
    for (const p of pops) p.age += dt;
    while (pops.length && pops[0].age > pops[0].life) pops.shift();
  }

  /**
   * At the top a spider hops out of the pipe's mouth onto the gutter beside it and dances there, in the sun, in the
   * order they arrived (first on the right of the mouth, second on the left, then further out).
   */
  const gutterSt = new Map();
  function onTheGutter(run, r, st) {
    const last = run.level.spans[run.level.spans.length - 1];
    let slot = 0;
    for (const o of run.racers) if (o !== r && o.finish && (o.finish < r.finish || (o.finish === r.finish && o.index < r.index))) slot++;
    const side = slot % 2 ? -1 : 1;
    const tx = last.cx + side * (last.half + WALL_T + 34 + Math.floor(slot / 2) * 44);
    const ty = run.level.H + R;
    let g = gutterSt.get(r.id);
    if (!g || g.run !== run) gutterSt.set(r.id, (g = { run, x0: st.x, y0: st.y, st: { ...st } }));
    const k = clamp((run.t - r.finish) / 0.55, 0, 1);
    const o = g.st;
    Object.assign(o, st);
    if (k < 1) {
      const e = k * k * (3 - 2 * k);
      o.x = g.x0 + (tx - g.x0) * e;
      o.y = g.y0 + (ty - g.y0) * e + Math.sin(k * Math.PI) * 46;
      o.m = 'air';
    } else {
      o.x = tx;
      o.y = ty;
      o.nx = 0;
      o.ny = 1;
      o.f = -side;
      o.m = 'done';
    }
    return o;
  }

  /** The state the picture shows for a racer: between its last two steps when this page simulates it. */
  function drawState(run, r) {
    let d = drawStates.get(r.id);
    if (!d) drawStates.set(r.id, (d = {}));
    Object.assign(d, r.st);
    if (r.sp && r.px != null && run.alpha != null && (r.me || (r.bot && run.simBots))) {
      const a = run.alpha;
      if (Math.hypot(r.st.x - r.px, r.st.y - r.py) < 60) {
        d.x = r.px + (r.st.x - r.px) * a;
        d.y = r.py + (r.st.y - r.py) * a;
      }
    }
    return d;
  }

  function render(dt, real) {
    if (!curRun) return;
    const run = curRun;
    // ---- who to draw (first: the camera follows the drawn spider, not the stepped one)
    frameRacers.length = 0;
    for (const r of run.racers) {
      let st = drawState(run, r);
      if (r.finish && st.m === 'done' && run.kind !== 'lobby' && run.kind !== 'attract') st = onTheGutter(run, r, st);
      frameRacers.push({ id: r.id, look: r.look, st, ghost: false, wet: false, hidden: r.left && !r.finish && run.kind === 'race' });
    }
    // ---- camera
    const ct = cameraTarget(dt);
    const snap = camSnap;
    camSnap = false;
    const k = 1 - Math.exp(-dt * (Math.abs(ct.y - cam.y) > 400 ? 9 : 6));
    if (snap) {
      cam.y = ct.y;
      cam.viewH = ct.viewH;
    } else {
      cam.y += (ct.y - cam.y) * k;
      cam.viewH += (ct.viewH - cam.viewH) * (1 - Math.exp(-dt * 4));
    }
    const cxT = ct.x ?? centerXAt(run.level, cam.y);
    cam.x = snap ? cxT : cam.x + (cxT - cam.x) * (1 - Math.exp(-dt * 4));
    cam.lean = snap ? ct.lean : cam.lean + (ct.lean - cam.lean) * (1 - Math.exp(-dt * 2.5));
    cam.rise = snap ? ct.rise : cam.rise + (ct.rise - cam.rise) * (1 - Math.exp(-dt * 4));
    cam.fov = ct.fov;
    cam.pos = ct.pos;
    cam.look = ct.look;
    view0.y0 = cam.y - cam.viewH * 0.6;
    view0.y1 = cam.y + cam.viewH * 0.6;

    // ---- weather where the eye is
    const t = run.kind === 'lobby' ? 0 : run.t;
    const chasing = !!chaseAfterFinish();
    const refY = run.me && flow !== 'lobby' && !chasing ? run.me.st.y : cam.y;
    rainAt(run.weather, refY, t, rinfo);
    const warnK = rinfo.warn ? clamp(1 - rinfo.next / rinfo.warn.warn, 0, 1) : 0;
    const sunny = !!shot?.sunny || (!!run.me?.finish && run.kind !== 'lobby' && !chasing);
    const quiet = run.kind === 'lobby' || flow === 'wardrobe' || flow === 'spouts';
    const calmTarget = quiet ? 0.7 : sunny ? 1 : rinfo.wet || rinfo.warn ? 0 : clamp((rinfo.next - 1.5) / 2, 0, 1);
    calm += (calmTarget - calm) * (shot ? 1 : 1 - Math.exp(-dt * 2));
    const gloomTarget = shot?.gloom ?? (quiet || sunny ? 0 : rinfo.wet ? 1 : warnK);
    gloom += (gloomTarget - gloom) * (shot ? 1 : 1 - Math.exp(-dt * 3));
    sunNow = sunny;
    weatherSounds(run, warnK, real, sunny);
    if (run.me && !quiet) setMusicHeight(run.mon ? Math.min(1, run.best / 20000) : run.me.st.y / run.level.H);

    transitions(run);
    for (const fr of frameRacers) if (fr.id === run.me?.id) fr.wet = !!rinfo.wet;
    if (flow === 'lobby' && run.seatsInfo) {
      // a player who's ready dances
      for (const fr of frameRacers) {
        const info = run.seatsInfo.find((x) => x.id === fr.id);
        if (info?.dance) fr.st = { ...fr.st, m: 'done' };
      }
    }
    if (flow === 'wardrobe') {
      for (const fr of frameRacers) {
        const r = run.byId.get(fr.id);
        if (!r?.isMe) fr.hidden = true;
        else fr.st = { ...fr.st, m: wardrobeSlot === 'dance' ? 'done' : 'surf' };
      }
    }
    if (shot?.only) for (const fr of frameRacers) if (fr.id !== shot.only) fr.hidden = true;
    if (shot?.pose) for (const fr of frameRacers) if (fr.id === shot.only) fr.st = { ...fr.st, m: shot.pose };
    ghostOn = false;
    if (solo?.ghost && (flow === 'solo' || flow === 'solo-done') && ghostAt(solo.ghost, run.t, ghostState)) {
      const st = ghostRacer.st;
      st.x = ghostState.x;
      st.y = ghostState.y;
      st.m = modeName(ghostState.m);
      const a = ((ghostState.a ?? 0) * Math.PI) / 180;
      st.nx = Math.sin(a);
      st.ny = Math.cos(a);
      ghostRacer.look = { ...myLook(), hat: 'none', trail: 'none' };
      frameRacers.push(ghostRacer);
      ghostOn = true;
    }
    trails(frameRacers, real);
    view.frame({
      t,
      dt,
      real,
      cam,
      weather: { gloom, drizzle: warnK, sunny: sunny ? 1 : 0 },
      snap: !!shot,
      noDraw: !!shot?.noDraw,
      racers: frameRacers,
      ate: run.me?.ate ?? null,
      flood: run.mon ? run.mon.flood : null,
    });
    if (!shot) drawHud2d(run, t, warnK, real);
  }

  function weatherSounds(run, warnK, real, sunny) {
    if (run.kind === 'lobby' || flow === 'title' || flow === 'closed' || flow === 'wardrobe' || flow === 'spouts' || sunny) {
      setRain(sunny ? 0.15 + 0.6 * gloom : 0.25);
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
      juice.flashIt(0.9, 0xdfe8ff);
      setTimeout(() => sfx('thunder'), 250);
    }
    if (rinfo.wet && rinfo.wave && rinfo.wave.id !== flushWave) {
      flushWave = rinfo.wave.id;
      sfx('flush', rinfo.left);
      juice.add(0.22);
    }
    if (!rinfo.wet && flushWave >= 0 && run.t > 0 && rinfo.warn === null && warnWave === flushWave && calm < 0.05 && rinfo.next > 2) {
      flushWave = -2;
      sfx('sun');
    }
    setMusicWeather(rinfo.wet ? 'flush' : wave ? 'warn' : 'sun');
  }

  function drawHud2d(run, t, warnK, real) {
    const pr = Number(hudCanvas.dataset.pr) || 1;
    hctx.setTransform(pr, 0, 0, pr, 0, 0);
    hctx.clearRect(0, 0, W, HGT);
    drawHud(hctx, hudFor(run, t, warnK, real));
  }

  function hudFor(run, t, warnK, real) {
    const hs = hudState;
    hs.W = W;
    hs.H = HGT;
    hs.t = real;
    hs.layout = layout;
    hs.reduced = reduced();
    hs.touch = touchMode();
    for (const k of ['label', 'sub', 'subColor', 'line', 'me', 'names', 'hint', 'countdown', 'debris', 'ring', 'target', 'flies', 'pops']) hs[k] = null;
    const showWeather = flow === 'solo' || flow === 'monsoon' || flow === 'race' || flow === 'solo-done' || flow === 'monsoon-done';
    const proj = (x, y) => view.project(x, y, 0, {});
    if (!showWeather) {
      hs.weather = null;
      if (flow === 'lobby') {
        hs.names = [];
        for (const r of run.racers) {
          const info = run.seatsInfo?.find((s) => s.id === r.id);
          const p = proj(r.st.x, r.st.y + 6);
          hs.names.push({ name: r.name, sx: p.x, sy: p.y - 10, color: info?.bot ? 'rgba(243,237,226,0.6)' : info?.me ? '#FFB648' : '#F3EDE2', ready: !info?.bot && !!info?.ready });
        }
        if (hint.text && hint.age < hint.life) hs.hint = { ...hint, x: W / 2, y: HGT * 0.42, target: hintTarget(hint.target) };
      }
      return hs;
    }
    const wv = hs.weather ?? (hs.weather = {});
    wv.calm = calm;
    wv.warnK = sunNow ? 0 : warnK;
    wv.next = sunNow ? 99 : rinfo.next;
    wv.kind = rinfo.kind;
    wv.wet = sunNow ? false : rinfo.wet;
    wv.left = rinfo.left;
    wv.dur = rinfo.wave ? rinfo.wave.end : 1;
    const me = run.me;
    if (run.kind === 'race') {
      const fin = net?.finishes() ?? {};
      if (match?.phase === 'results') hs.label = null;
      else if (match?.spectating || !me) hs.label = fmtTime(t, true);
      else hs.label = ORD(liveOrder(run, fin).indexOf(me.id) + 1);
      const times = Object.values(fin);
      if (times.length && match?.phase === 'round') {
        const left = Math.max(0, Math.min(...times) + CLOSE_AFTER - t);
        hs.sub = `0:${String(Math.ceil(left)).padStart(2, '0')}`;
        hs.subColor = '#9E2A12';
      }
    } else if (run.mon) {
      hs.label = `${Math.floor(Math.max(0, run.best) / M)} m`;
      hs.sub = save.mon.best ? `Best ${save.mon.best} m` : null;
    } else if (solo) {
      hs.label = fmtTime(me?.finish ? Math.round(me.finish * 100) / 100 : t);
      const best = save.spouts[solo.id]?.best;
      if (best) hs.sub = `Best ${fmtTime(best)}`;
      const total = run.level.flies.filter((f) => !f.gold).length;
      if (total) hs.flies = { have: tally.flies, total, gold: run.level.flies.some((f) => f.gold) ? tally.gold : null };
    }
    if (flow === 'solo-done' || flow === 'monsoon-done') hs.label = hs.sub = hs.flies = null;
    // the climb line
    const top = run.mon ? Math.max(save.mon.best * M, run.best + 2500, 3000) : run.level.H;
    const beads = [];
    for (const r of run.racers) beads.push({ y: r.st.y, look: r.look, me: r.me, alpha: r.left ? 0.4 : 1 });
    if (ghostOn) beads.push({ y: ghostRacer.st.y, look: SEAT_LOOKS[5], ghost: true });
    hs.line = { top, beads, flood: run.mon ? run.mon.flood : null, setting: !!hs.sub && run.kind === 'race' };
    // you: chevron, grip, the water's ring, the bolt your silk would catch
    const meDraw = me ? drawStates.get(me.id) ?? me.st : null;
    silkTarget = null;
    if (me && me.sp && !(match?.spectating && run.kind === 'race') && flow !== 'solo-done' && flow !== 'monsoon-done') {
      const p = proj(meDraw.x, meDraw.y);
      hs.me = { sx: p.x, sy: p.y, grip: me.sp.grip / GRIP_MAX, combo: combo.n >= 2 ? combo.n : 0, comboK: combo.left / COMBO_T };
      if (!me.finish && rinfo.warn && !rinfo.wet && rinfo.next < 1.4 && !inPocket(run.level, me.sp.x, me.sp.y) && isPlaying()) hs.ring = { sx: p.x, sy: p.y, next: rinfo.next, kind: rinfo.kind, holding: me.sp.holding };
      if (me.sp.mode === 'air' && isPlaying()) {
        aim.x = (input.has('right') ? 1 : 0) - (input.has('left') ? 1 : 0);
        aim.y = (input.has('up') ? 1 : 0) - (input.has('down') ? 1 : 0);
        const i = safe(() => snagFor(me.sp, run.level, aim));
        if (i != null && i >= 0) {
          silkTarget = run.level.snags[i];
          const q = proj(silkTarget.x, silkTarget.y);
          hs.target = { sx: q.x, sy: q.y, live: (me.sp.silkCd ?? 0) <= 0 };
        }
      }
    }
    if (run.kind === 'race') {
      hs.names = [];
      for (const r of run.racers) {
        if (r.me || r.st.y < view0.y0 || r.st.y > view0.y1) continue;
        const d = drawStates.get(r.id) ?? r.st;
        const p = proj(d.x, d.y);
        hs.names.push({ name: r.name, sx: p.x, sy: p.y, color: r.left || r.away ? 'rgba(243,237,226,0.5)' : '#F3EDE2' });
      }
    }
    if (ghostOn && ghostRacer.st.y > view0.y0 && ghostRacer.st.y < view0.y1) {
      const p = proj(ghostRacer.st.x, ghostRacer.st.y);
      (hs.names ??= []).push({ name: 'Best', sx: p.x, sy: p.y, color: 'rgba(243,237,226,0.62)' });
    }
    debrisMarks.length = 0;
    for (const d of me?.finish || mon?.doneAt ? [] : debrisComing(run.weather, view0.y1, t, 1.2, debrisList)) {
      const x = centerXAt(run.level, view0.y1) + (d.d.lane === 'L' ? -68 : 68);
      debrisMarks.push(proj(x, view0.y1 - 40).x);
      if (me?.sp) showHint('debris', 'Caps falling: hold', 'Caps falling: hold', { life: 1.8 });
    }
    hs.debris = debrisMarks.length ? debrisMarks : null;
    if (pops.length) {
      hs.pops = pops.map((p) => {
        const q = proj(p.x, p.y);
        return { ...p, sx: q.x, sy: q.y };
      });
    }
    if (hint.text && hint.age < hint.life && me) {
      const p = proj(meDraw.x, meDraw.y);
      hs.hint = { ...hint, x: clamp(p.x, 140, W - 140), y: clamp(p.y - 110, 70, HGT - 160), target: hintTarget(hint.target) };
    }
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

  function stageAreas() {
    const out = [{ kind: 'menu', x: 0, y: 0, w: 140, h: 64, label: 'menu' }];
    if (/^screen-lobby/.test(STAGE)) out.push({ kind: 'lobby', x: Math.round(W / 2 - Math.min(170, W / 2 - 12)), y: HGT - 12 - 56, w: Math.min(340, W - 24), h: 56, label: 'Ready · Start' });
    return out;
  }

  async function stage(name) {
    for (const a of reserved ?? []) {
      const box = h('div', { text: a.label ?? '' });
      box.style.cssText = `position:fixed;left:${a.x}px;top:${a.y}px;width:${a.w}px;height:${a.h}px;box-sizing:border-box;border:2px dashed rgba(243,237,226,.55);border-radius:${a.kind === 'lobby' ? 999 : 12}px;background:rgba(14,20,27,.55);color:#f3ede2;font:800 14px var(--text);display:flex;align-items:center;justify-content:center;z-index:5;pointer-events:none`;
      document.body.append(box);
    }
    // A player some way in: seven spouts open, a Monsoon best, level 14, a goal done, a four-day streak.
    save.tut = true;
    save.open = 7;
    [3, 3, 2, 3, 1, 2].forEach((n, i) => (save.spouts[i + 1] = { best: [24.6, 31.2, 38.9, 44.7, 52.3, 58.1][i], stars: n, flies: (1 << (3 + i)) - 1, gold: i % 2 === 0 }));
    save.mon.best = 212;
    save.mon.day = today();
    save.mon.dayBest = 64;
    save.silk = 3400;
    save.look = { species: 'peacock', color: 'violet', mark: 'chevron', hat: 'flower', trail: 'sparkle', dance: 'hop' };
    save.streak = { n: 4, last: today(), best: 6 };
    P.rollDay(save, today());
    save.day.goals[0].have = save.day.goals[0].n;
    save.day.goals[0].done = true;
    save.day.goals[1].have = Math.floor(save.day.goals[1].n / 2);
    let settle = 2600;
    if (name === 'lobby' || name === 'spouts' || name === 'wardrobe') {
      room.stub = false;
      room.kind = 'private';
      room.settings.cup = 2;
      room.players.set('p2', { id: 'p2', name: 'Pip', ready: true, connected: true, presence: null });
      communityText = '12,480 flushes held today by everyone';
      toLobby();
      if (name === 'spouts') showSpouts();
      if (name === 'wardrobe') {
        wardrobeSlot = P.SLOTS.some((x) => x.id === params.get('slot')) ? params.get('slot') : 'hat';
        showWardrobe();
      }
    } else if (name === 'solo') {
      startSolo(7, false);
      flyover = null;
      const me = curRun.me;
      while (!me.finish && curRun.t < 240) advance(curRun, curRun.t + 1 / 60, autoInput(me), { onFly: (r, f) => flyFx(r, f), onFinish: () => {} });
      me.sp.events.length = 0;
      onMyFinish(me);
      camSnap = true;
      settle = 3800;
    } else if (name === 'monsoon') {
      startMonsoon();
      const me = curRun.me;
      while (!mon.doneAt && curRun.t < 600) advance(curRun, curRun.t + 1 / 60, curRun.t < 50 ? autoInput(me) : idle(), { onDrown: (r) => endMonsoon(r) });
      me.sp.events.length = 0;
      camSnap = true;
      settle = 3400;
    } else if (name === 'play') {
      // mid-climb, for checking the HUD
      startSolo(4, false);
      flyover = null;
      const me = curRun.me;
      while (curRun.t < 9.3) advance(curRun, curRun.t + 1 / 60, autoInput(me), {});
      me.sp.events.length = 0;
      camSnap = true;
      paused = true;
      settle = 1500;
    } else if (name === 'race' || name === 'results') {
      const cup = cupById(1);
      const seats = [
        { id: 'me', name: 'You', bot: false, me: true, index: 0 },
        { id: 'p2', name: 'Pip', bot: false, me: false, index: 1 },
        ...BOT_NAMES.slice(0, 4).map((n, i) => ({ id: `bot:${i + 2}`, name: n, bot: true, me: false, index: i + 2 })),
      ];
      const run = createRun({ kind: 'race', spout: cup.spouts[2], seed: 31, seats: seats.map((x) => ({ ...x, bot: !x.me, skill: [0.5, 0.7, 0.35, 0.6, 0.8, 0.45][x.index] })) });
      for (const r of run.racers) r.name = seats[r.index].name;
      useRun(run);
      while (run.racers.filter((r) => r.finish).length < 4 && run.t < 120) advance(run, run.t + 1 / 60, autoInput(run.me, run));
      for (const r of run.racers) if (r.sp) r.sp.events.length = 0;
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

  // ------------------------------------------------------------ store art (?poster=cover|action|win|multi|icon)

  const LOOKS = {
    coral: { species: 'jumper', color: '#FF6F59', mark: 'stripes', hat: 'none', trail: 'none', dance: 'hop' },
    hero: { species: 'jumper', color: '#FF6F59', mark: 'stripes', hat: 'sou', trail: 'none', dance: 'wave' },
    gold: { species: 'peacock', color: '#FFB648', mark: 'chevron', hat: 'flower', trail: 'sparkle', dance: 'wave' },
    sky: { species: 'orb', color: '#5CC8FF', mark: 'dots', hat: 'beanie', trail: 'bubbles', dance: 'spin' },
    leaf: { species: 'longlegs', color: '#9BD35A', mark: 'ring', hat: 'acorn', trail: 'leaves', dance: 'drum' },
    violet: { species: 'tarantula', color: '#A88BFF', mark: 'star', hat: 'crown', trail: 'none', dance: 'flip' },
    rose: { species: 'jumper', color: '#FF8FB1', mark: 'spots', hat: 'party', trail: 'rainbow', dance: 'hop' },
  };
  // Each picture: a race of bots on one spout, stopped at a moment found by simulating it (the sim is deterministic),
  // and a camera placed on it.
  const SHOTS = {
    cover: { spout: 8, seed: 10, t: 15.17, n: 5, sign: true, looks: { b2: 'coral', b0: 'gold', b1: 'sky', b3: 'leaf', b4: 'violet' }, cam: { x: -20, y: 2190, viewH: 360, lean: 20, rise: 70 } },
    action: { spout: 1, seed: 4, t: 8.98, n: 5, gloom: 0.55, looks: { b0: 'coral', b1: 'gold', b2: 'sky', b3: 'leaf', b4: 'violet' }, cam: { x: 80, y: 2190, viewH: 190, lean: 70, rise: 40 } },
    win: { spout: 1, seed: 4, t: 15.6, n: 5, live: 1.6, burst: 0.4, sunny: true, payoff: { sun: [0.22, 0.3, -0.93], rb: [-0.25, -0.36, -0.9] }, looks: { b0: 'coral', b1: 'gold', b2: 'sky', b3: 'leaf', b4: 'violet' }, cam: { x: 112, y: 3165, viewH: 330, lean: -50, rise: -40 } },
    multi: { spout: 6, seed: 10, t: 4.48, n: 5, looks: { b0: 'coral', b1: 'gold', b2: 'sky', b3: 'leaf', b4: 'violet' }, cam: { x: 105, y: 1220, viewH: 380, lean: 30, rise: 70 } },
    icon: { spout: 1, seed: 4, t: 15.6, n: 5, live: 1.6, only: 'b0', portrait: ['#f2fbff', '#7fd0ff', '#1b4fae'], looks: { b0: 'hero', b1: 'gold', b2: 'sky', b3: 'leaf', b4: 'violet' }, cam: { x: 258, y: 3081, viewH: 80, pos: [160, 3112, 30], look: [258, 3081, 0], fov: 39 } },
  };

  async function storeShot(name) {
    const S = { ...SHOTS[name] };
    // ?cam=x,y,viewH,lean,rise: try a camera without a rebuild
    const camQ = params.get('cam')?.split(',').map(Number);
    if (camQ?.length >= 3 && camQ.every(Number.isFinite)) S.cam = { x: camQ[0], y: camQ[1], viewH: camQ[2], lean: camQ[3] ?? 0, rise: camQ[4] ?? 95 };
    if (params.has('t')) S.t = Number(params.get('t')) || S.t;
    if (params.has('spout')) S.spout = Math.max(1, Math.min(12, Number(params.get('spout')) || S.spout));
    juice.reduced = true;
    hudCanvas.style.display = 'none';
    uiRoot.style.display = 'none';
    const seats = BOT_NAMES.slice(0, S.n).map((n, i) => ({ id: `b${i}`, name: n, bot: true, skill: [0.95, 0.8, 0.7, 0.6, 0.85, 0.5][i], index: i }));
    const run = createRun({ kind: 'race', spout: S.spout, seed: S.seed, seats });
    // ?look=species.colour.pattern.hat.trail.dance dresses the first spider (to look at a wardrobe item)
    const lookQ = readLook(params.get('look'));
    for (const r of run.racers) {
      r.look = { ...(r.id === 'b0' && lookQ ? lookQ : LOOKS[S.looks?.[r.id]] ?? botLook(r.name)) };
      r.lookSet = true;
    }
    const t0 = Math.max(0, S.t - (S.live ?? 0.8));
    while (advance(run, Math.min(t0, run.t + 1), null) > 0);
    for (const r of run.racers) if (r.sp) r.sp.events.length = 0;
    useRun(run);
    // this spout's walls and ground load now; the picture waits for them
    await texturesReady(8000);
    flow = 'shot';
    shot = { t: S.t, frozen: false, done: false, sunny: !!S.sunny, gloom: S.gloom, only: S.only, pose: params.get('pose') ?? S.pose };
    posterCam = { x: S.cam.x, y: S.cam.y, viewH: S.cam.viewH, lean: S.cam.lean ?? 0, rise: S.cam.rise ?? 95, fov: S.cam.fov, pos: S.cam.pos, look: S.cam.look };
    const posQ = params.get('pos')?.split(',').map(Number);
    if (posQ?.length === 7 && posQ.every(Number.isFinite)) Object.assign(posterCam, { pos: posQ.slice(0, 3), look: posQ.slice(3, 6), fov: posQ[6], x: posQ[3], y: posQ[4] });
    camSnap = true;
    if (S.payoff) view.setPayoff(S.payoff.sun, S.payoff.rb);
    if (S.portrait) view.portrait(S.portrait);
    if (S.sign) {
      const sign = h('div', { class: 'sign poster-sign' }, h('span', { class: 'l1', text: 'Itsy Bitsy' }), h('span', { class: 'l2', text: 'Spider' }));
      document.body.append(sign);
    }
    // the last moments play at a fixed 60 frames a second without drawing (the picture is the same on a slow machine
    // or a software renderer), then one frame is drawn
    shot.manual = true;
    shot.noDraw = true;
    const dt = 1 / 60;
    let real = 0;
    let burst = !S.burst;
    for (let i = 0; i < 600 && !shot.frozen; i++) {
      if (!burst && run.t >= S.t - S.burst) {
        // the moment's own confetti, from everyone up top
        burst = true;
        for (const r of run.racers) if (r.finish) confettiAt(r, 44);
      }
      step(dt, real);
      render(dt, real);
      real += dt;
    }
    for (let i = 0; i < 3; i++) {
      step(dt, real);
      render(dt, real);
      real += dt;
    }
    shot.noDraw = false;
    render(dt, real);
    for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
    shot.done = true;
    await fontsReady;
    document.body.dataset.ready = '1';
  }

  // ------------------------------------------------------------ go
  await fontsReady;
  await texturesReady(6000);
  requestAnimationFrame(frame);
  await connect(roomPromise);
  await Promise.race([loadSaves, new Promise((r) => setTimeout(r, 1500))]);
  if (SHOT) return storeShot(SHOT);
  if (STAGE) return stage(STAGE.slice(7).replace(/[.].*$/, ''));
  if (params.has('view')) {
    // a quick way to look at one spout: ?view=<spout>
    await loadSaves;
    save.tut = true;
    save.open = Math.max(save.open, Number(params.get('view')) || 1);
    startSolo(Number(params.get('view')) || 1, false);
    flyover = null;
  } else if (inRacePhase() && amRacing()) enterRace();
  else showTitle();
  if (inRacePhase() && match.phase === 'intro') showSpoutTag();
  document.body.dataset.flow = 'ready';
}
