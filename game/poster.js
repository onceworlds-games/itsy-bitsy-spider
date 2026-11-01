// Store art: ?poster=cover|action|win|multi|icon|badge-<id>. No SDK, no room: a real race of bots is simulated with a
// fixed seed, the best moment is picked by a score, and that one frame is drawn with the game's own renderer.

import { makeRng } from './rng.js';
import { createRun, advance } from './run.js';
import { createScene, createRain } from './scene.js';
import { createWater } from './water.js';
import { createFx, updateFx, spray, puff, confetti } from './fx.js';
import { createView, fitView, setCamera, screenTransform } from './view.js';
import { renderWorld, updatePuppets } from './draw.js';
import { createPuppet, updatePuppet, drawSpider } from './spiderart.js';
import { rainAt } from './weather.js';
import { centerX } from './level.js';
import { SEAT_LOOKS } from './config.js';
import { BOT_NAMES } from './bot.js';
import { FONT_DISPLAY, FONT_TEXT, outlined, roundRect } from './paint.js';
import { plate } from './hud.js';

// Every random number in a poster comes from one seed, so the same picture comes out every time.
Math.random = makeRng('itsy-bitsy-poster').next;

const FPS = 30;
const SETTLE = 1.2;

export async function runPoster(name) {
  document.getElementById('ui')?.remove();
  const W = Math.max(1, innerWidth);
  const H = Math.max(1, innerHeight);
  const canvas = document.getElementById('game');
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  try {
    await Promise.all([document.fonts.load(`400 100px ${FONT_DISPLAY}`), document.fonts.load(`800 40px ${FONT_TEXT}`)]);
  } catch {
    /* system fonts then */
  }
  await document.fonts.ready;
  if (name.startsWith('badge-')) drawBadge(ctx, W, H, name.slice(6));
  else if (name === 'icon') drawIcon(ctx, W, H);
  else drawScenePoster(ctx, W, H, name);
  requestAnimationFrame(() => requestAnimationFrame(() => (document.body.dataset.ready = '1')));
}

// ---------------------------------------------------------------- a race, replayed to its best moment

const seatsFor = (skills) => skills.map((skill, i) => ({ id: `b${i}`, name: BOT_NAMES[i], bot: true, skill, index: i }));

/** Plays a race of bots and returns the moment where score(run) is highest: { run, puppets, fx, focus }. */
function bestMoment({ spout, seed, skills, tMin = 6, tMax = 70, score, effects }) {
  let run = createRun({ kind: 'race', spout, seed, seats: seatsFor(skills) });
  let best = -Infinity;
  let bestT = tMin;
  let focus = null;
  while (run.t < tMax) {
    advance(run, run.t + 1 / FPS, null);
    if (run.t < tMin) continue;
    const s = score(run);
    if (s && s.score > best) {
      best = s.score;
      bestT = run.t;
      focus = s;
    }
  }
  // Replay to that moment (the simulation is deterministic), letting legs and particles settle on the way in.
  run = createRun({ kind: 'race', spout, seed, seats: seatsFor(skills) });
  const puppets = new Map();
  const fx = createFx(700);
  const was = new Map();
  const dt = 1 / 60;
  while (run.t < bestT - 1e-6) {
    advance(run, Math.min(bestT, run.t + dt), null);
    if (run.t < bestT - SETTLE) continue;
    updatePuppets(puppets, run, dt);
    for (const r of run.racers) {
      const prev = was.get(r.id);
      if (prev && prev !== r.st.m) {
        if (r.st.m === 'washed') spray(fx, r.st.x, r.st.y, 18, Math.PI / 2, 1.3, 320);
        if (r.st.m === 'air') puff(fx, r.st.x, r.st.y - 8, 4);
      }
      was.set(r.id, r.st.m);
    }
    effects?.(run, fx, bestT - run.t);
    updateFx(fx, dt);
  }
  return { run, puppets, fx, focus };
}

/** Where the water's leading edge is between y0 and y1 at time t (wet above, dry below), or null. */
function frontIn(run, y0, y1, t) {
  const r = {};
  let wetAbove = rainAt(run.weather, y1, t, r).wet;
  for (let y = y1 - 20; y >= y0; y -= 20) {
    const wet = rainAt(run.weather, y, t, r).wet;
    if (wetAbove && !wet) return y + 10;
    wetAbove = wet;
  }
  return null;
}

/** Spray off every spider standing in the water (holders shed it in sheets). */
function splashHolders(run, fx) {
  const r = {};
  for (const sp of run.racers) {
    if (!rainAt(run.weather, sp.st.y, run.t, r).wet) continue;
    if (sp.st.h) spray(fx, sp.st.x, sp.st.y + 10, 2, Math.PI / 2, 1.1, 240);
  }
}

const SCENES = {
  // The flush front hits the pack: one planted, one washed, one in the air.
  cover: {
    spout: 5,
    seed: 41,
    skills: [0.95, 0.85, 0.75, 0.6, 0.45, 0.3],
    viewH: 400,
    pipeAt: 0.66,
    calm: 0.35,
    gloom: 0.55,
    effects: splashHolders,
    score(run) {
      let best = null;
      for (const c of run.racers) {
        const y0 = c.st.y - 230;
        const y1 = c.st.y + 230;
        const front = frontIn(run, y0 - 40, y1, run.t);
        let n = 0;
        let holders = 0;
        let washed = 0;
        let air = 0;
        let hit = 0;
        for (const r of run.racers) {
          if (r.st.y < y0 || r.st.y > y1) continue;
          n++;
          if (r.st.h) holders++;
          if (r.st.m === 'washed' || r.st.m === 'tumble') washed++;
          if (r.st.m === 'air') air++;
          if (front != null && r.st.h && r.st.y < front + 30 && r.st.y > front - 120) hit++;
        }
        const s = n + (holders ? 3 : 0) + (washed ? 4 : 0) + (air ? 2 : 0) + (front != null ? 5 : 0) + (hit ? 4 : 0);
        if (n >= 3 && (!best || s > best.score)) best = { score: s, y: front != null ? (front + c.st.y) / 2 : c.st.y };
      }
      return best;
    },
  },
  // Close on a spider washed down in a burst of spray.
  action: {
    spout: 7,
    seed: 12,
    skills: [0.9, 0.7, 0.55, 0.4, 0.3, 0.2],
    viewH: 230,
    pipeAt: 0.5,
    centre: true,
    calm: 0,
    gloom: 0.8,
    effects(run, fx) {
      splashHolders(run, fx);
      for (const r of run.racers) if (r.st.m === 'washed') spray(fx, r.st.x, r.st.y + 6, 3, Math.PI / 2, 1.5, 300);
    },
    score(run) {
      let best = null;
      for (const r of run.racers) {
        if (r.st.m !== 'washed' || !r.sp) continue;
        const fell = r.sp.washY - r.sp.y;
        if (fell < 90 || fell > 260) continue;
        let near = 0;
        for (const o of run.racers) if (o !== r && Math.abs(o.st.y - r.st.y) < 140) near++;
        const s = 10 + near * 2 - Math.abs(fell - 160) / 40;
        if (!best || s > best.score) best = { score: s, y: r.st.y - 50, x: r.st.x };
      }
      return best;
    },
  },
  // The first one over the gutter's edge into the sun; the rest still climbing below.
  win: {
    spout: 4,
    seed: 7,
    skills: [0.95, 0.8, 0.7, 0.55, 0.4, 0.3],
    viewH: 270,
    pipeAt: 0.5,
    calm: 1,
    gloom: 0,
    tMax: 140,
    glow: true,
    effects(run, fx, left) {
      for (const r of run.racers) if (r.finish && Math.abs(run.t - r.finish - 0.02) < 0.009) confetti(fx, r.st.x, r.st.y + 10, 90, [r.look.color, '#FFB648', '#F3EDE2', '#FFD27A']);
      void left;
    },
    score(run) {
      const first = run.racers.find((r) => r.finish);
      if (!first) return null;
      const since = run.t - first.finish;
      if (since < 0.5 || since > 0.9) return null;
      return { score: 10 - Math.abs(since - 0.7), y: run.level.finishY + 40, winner: first.id };
    },
  },
  // Six spiders across one stretch as the first water arrives: who holds, who doesn't.
  multi: {
    spout: 2,
    seed: 3,
    skills: [0.9, 0.75, 0.6, 0.5, 0.35, 0.2],
    viewH: 620,
    pipeAt: 0.5,
    calm: 0.2,
    gloom: 0.6,
    tMax: 40,
    effects: splashHolders,
    score(run) {
      if (run.racers.some((r) => r.finish)) return null;
      const front = frontIn(run, 0, run.level.H, run.t);
      if (front == null) return null;
      let n = 0;
      let holders = 0;
      let washed = 0;
      for (const r of run.racers) {
        if (r.st.y < front - 400 || r.st.y > front + 200) continue;
        n++;
        if (r.st.h) holders++;
        if (r.st.m === 'washed' || r.st.m === 'tumble') washed++;
      }
      return { score: n * 3 + Math.min(holders, 4) + (washed ? 3 : 0), y: front - 110 };
    },
  },
};

function drawScenePoster(ctx, W, H, name) {
  const def = SCENES[name] ?? SCENES.cover;
  const { run, puppets, fx, focus } = bestMoment({ ...def, score: def.score.bind(def) });
  const view = createView();
  fitView(view, W, H, 1, { minW: (def.viewH * W) / H, minH: def.viewH, minHLand: def.viewH });
  const y = focus?.y ?? run.racers[0].st.y;
  const cx = def.centre || focus?.x == null ? centerX(run.level, y) : focus.x;
  setCamera(view, cx - (def.pipeAt - 0.5) * view.viewW, y);
  const scene = createScene(run.level, { facade: run.def.facade });
  renderWorld(ctx, view, scene, run, {
    t: run.t,
    real: run.t,
    puppets,
    fx,
    rain: createRain('high'),
    water: createWater(),
    calm: def.calm,
    gloom: def.gloom,
    heavy: 0.25 + 0.75 * def.gloom,
    flash: 0,
    ghost: null,
    flood: null,
  });
  screenTransform(ctx, view);
  if (def.glow && focus?.winner) sunburst(ctx, view, run.byId.get(focus.winner), W, H);
  if (name === 'cover') titleSign(ctx, W * 0.05, H * 0.1, Math.min(W, H * 1.6) / 1280);
}

/** Out came the sun: gold light pouring down on the winner. */
function sunburst(ctx, view, r, W, H) {
  if (!r) return;
  const x = (r.st.x * view.s + view.tx) / view.pr;
  const y = (-r.st.y * view.s + view.ty) / view.pr;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - 60, 10, x, y - 60, H * 0.75);
  g.addColorStop(0, 'rgba(255,196,96,0.45)');
  g.addColorStop(0.4, 'rgba(255,170,70,0.22)');
  g.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.28;
    const len = H * 1.2;
    const w = 0.05;
    const oy = y - 70;
    const sg = ctx.createLinearGradient(x, oy, x + Math.cos(a) * len, oy + Math.sin(a) * len);
    sg.addColorStop(0, 'rgba(255,214,130,0.24)');
    sg.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x + Math.cos(a - w) * len, oy + Math.sin(a - w) * len);
    ctx.lineTo(x + Math.cos(a + w) * len, oy + Math.sin(a + w) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The game's name on a zinc sign hung by silk, as on the title screen. */
function titleSign(ctx, x, y, k) {
  const w = 470 * k;
  const h = 250 * k;
  plate(ctx, x, y, w, h, 0, 0);
  outlined(ctx, 'Itsy Bitsy', x + w / 2, y + 70 * k, 64 * k, { font: FONT_DISPLAY, weight: 400, line: 10 * k, fill: '#F3EDE2' });
  outlined(ctx, 'SPIDER', x + w / 2, y + 168 * k, 112 * k, { font: FONT_DISPLAY, weight: 400, line: 14 * k, fill: '#FFB648' });
}

// ---------------------------------------------------------------- the icon: one spider holding on in the water

function drawIcon(ctx, W, H) {
  const k = W / 512;
  ctx.save();
  ctx.scale(k, k);
  // The inside of the pipe at night, gold light breaking in at the top right.
  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#2B3A4A');
  bg.addColorStop(1, '#121A24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);
  const sun = ctx.createRadialGradient(470, 30, 10, 470, 30, 420);
  sun.addColorStop(0, 'rgba(255,196,96,0.95)');
  sun.addColorStop(0.35, 'rgba(255,170,70,0.35)');
  sun.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 512, 512);
  // The sheet of water pouring past behind it.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, -20);
  ctx.lineTo(250, -20);
  ctx.lineTo(150, 380);
  ctx.lineTo(-20, 380);
  ctx.closePath();
  ctx.clip();
  const wg = ctx.createLinearGradient(0, 0, 220, 0);
  wg.addColorStop(0, 'rgba(96,178,222,0.85)');
  wg.addColorStop(1, 'rgba(134,210,240,0.55)');
  ctx.fillStyle = wg;
  ctx.fillRect(-20, -20, 300, 420);
  for (let i = 0; i < 26; i++) {
    const x = -10 + Math.random() * 250;
    const y = -40 + Math.random() * 380;
    ctx.strokeStyle = `rgba(238,249,255,${0.25 + Math.random() * 0.45})`;
    ctx.lineWidth = 2 + Math.random() * 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 18, y + 70 + Math.random() * 60);
    ctx.stroke();
  }
  ctx.restore();
  // The zinc ring it holds on to.
  const ring = ctx.createLinearGradient(0, 360, 0, 470);
  ring.addColorStop(0, '#C6D3D9');
  ring.addColorStop(0.25, '#8FA3AD');
  ring.addColorStop(1, '#4C5E68');
  ctx.fillStyle = ring;
  ctx.beginPath();
  roundRect(ctx, 20, 368, 472, 104, 14);
  ctx.fill();
  ctx.strokeStyle = '#0E141B';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(34, 374, 444, 5);
  ctx.fillStyle = '#2E3A42';
  for (const x of [70, 442]) {
    ctx.beginPath();
    ctx.arc(x, 420, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // The spider, planted with all eight legs.
  const p = createPuppet();
  const st = { x: 0, y: 0, a: 0, m: 'surf', g: 3, h: false, f: -1 };
  for (let i = 0; i < 90; i++) updatePuppet(p, st, 1 / 60);
  p.blink = 2;
  ctx.save();
  ctx.translate(262, 372);
  ctx.scale(5.8, -5.8);
  ctx.translate(0, 12);
  drawSpider(ctx, p, SEAT_LOOKS[1], {});
  ctx.restore();
  // Spray bursting off its back.
  for (let i = 0; i < 46; i++) {
    const a = -Math.PI * (0.55 + Math.random() * 0.5);
    const d = 120 + Math.random() * 140;
    const x = 200 + Math.cos(a) * d * 0.9;
    const y = 250 + Math.sin(a) * d * 0.55;
    const r = 3 + Math.random() * 7;
    ctx.fillStyle = `rgba(238,249,255,${0.55 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- badges: a bold symbol on a coloured disc

const BADGES = {
  'first-climb': { disc: '#FFB648', ring: '#B86F12', draw: (c) => spiderSymbol(c, SEAT_LOOKS[3]) },
  'hold-on': { disc: '#2E7FB0', ring: '#174A6B', draw: (c) => holdSymbol(c) },
  'washed-out': { disc: '#1F5E73', ring: '#0F3442', draw: (c) => washSymbol(c) },
  'out-came-the-sun': { disc: '#F28A2E', ring: '#9E4A12', draw: (c) => sunSymbol(c, '#FFE08A') },
  'up-the-spout-again': { disc: '#C8563A', ring: '#7A2C1C', draw: (c) => againSymbol(c) },
  'cup-winner': { disc: '#3B4A57', ring: '#1C252D', draw: (c) => cupSymbol(c) },
  'no-washouts': { disc: '#E2D3B5', ring: '#8F7A55', draw: (c) => dryDrop(c) },
  'twelve-spouts': { disc: '#4E6E3A', ring: '#2A3E1E', draw: (c) => numberSymbol(c, '12') },
  'all-stars': { disc: '#2B3F7A', ring: '#141F45', draw: (c) => starsSymbol(c) },
  'monsoon-100': { disc: '#4A3A6E', ring: '#251B3F', draw: (c) => boltSymbol(c) },
};

function drawBadge(ctx, W, H, id) {
  const b = BADGES[id] ?? BADGES['first-climb'];
  const R = Math.min(W, H) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(R / 128, R / 128);
  // The disc: a rim, a face with a soft top light.
  ctx.beginPath();
  ctx.arc(0, 0, 124, 0, Math.PI * 2);
  ctx.fillStyle = b.ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 110, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, -110, 0, 110);
  g.addColorStop(0, lighten(b.disc, 0.18));
  g.addColorStop(1, b.disc);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 103, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  b.draw(ctx);
  ctx.restore();
}

function lighten(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const INK = '#0E141B';
const BONE = '#F3EDE2';

function inked(ctx, fill, width = 7) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drop(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.6);
  ctx.bezierCurveTo(x + r * 0.55, y - r * 0.8, x + r, y - r * 0.3, x + r, y + r * 0.2);
  ctx.arc(x, y + r * 0.2, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.3, x - r * 0.55, y - r * 0.8, x, y - r * 1.6);
  ctx.closePath();
}

function spiderSymbol(ctx, look) {
  const p = createPuppet();
  const st = { x: 0, y: 0, a: 0, m: 'done', g: 3, h: false, f: 1 };
  for (let i = 0; i < 40; i++) updatePuppet(p, st, 1 / 60);
  ctx.save();
  ctx.translate(-6, 40);
  ctx.scale(3.3, -3.3);
  drawSpider(ctx, p, look, {});
  ctx.restore();
  // The sun it climbed to.
  ctx.beginPath();
  ctx.arc(52, -58, 20, 0, Math.PI * 2);
  inked(ctx, '#FFF1C9', 5);
}

function holdSymbol(ctx) {
  // A drop splitting round eight planted feet.
  drop(ctx, 0, -6, 46);
  inked(ctx, '#86D2F0');
  ctx.fillStyle = INK;
  for (let i = 0; i < 8; i++) {
    const x = -56 + i * 16;
    ctx.beginPath();
    ctx.arc(x, 72, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = BONE;
  ctx.fillRect(-66, 80, 132, 8);
}

function washSymbol(ctx) {
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const y = -46 + k * 30;
    ctx.moveTo(-56, y);
    for (let x = -56; x <= 56; x += 4) ctx.lineTo(x, y + Math.sin((x / 56) * Math.PI * 2) * 7);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.strokeStyle = '#86D2F0';
    ctx.lineWidth = 9;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-14, 40);
  ctx.lineTo(14, 40);
  ctx.lineTo(14, 56);
  ctx.lineTo(32, 56);
  ctx.lineTo(0, 88);
  ctx.lineTo(-32, 56);
  ctx.lineTo(-14, 56);
  ctx.closePath();
  inked(ctx, BONE, 6);
}

function sunSymbol(ctx, fill) {
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.rotate((i / 12) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(-10, -50);
    ctx.lineTo(0, -82);
    ctx.lineTo(10, -50);
    ctx.closePath();
    inked(ctx, fill, 5);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  inked(ctx, fill, 7);
}

function againSymbol(ctx) {
  // An arrow that falls and climbs back up.
  ctx.beginPath();
  ctx.moveTo(-50, -40);
  ctx.lineTo(-50, 30);
  ctx.arc(0, 30, 50, Math.PI, 0, true);
  ctx.lineTo(50, -20);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50, -78);
  ctx.lineTo(84, -26);
  ctx.lineTo(16, -26);
  ctx.closePath();
  inked(ctx, BONE, 7);
}

function cupSymbol(ctx) {
  ctx.beginPath();
  ctx.moveTo(-54, -62);
  ctx.lineTo(54, -62);
  ctx.bezierCurveTo(54, 6, 26, 22, 0, 22);
  ctx.bezierCurveTo(-26, 22, -54, 6, -54, -62);
  ctx.closePath();
  inked(ctx, '#FFB648');
  ctx.beginPath();
  ctx.arc(-58, -34, 20, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(58, -34, 20, Math.PI * 1.5, Math.PI * 0.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.strokeStyle = '#FFB648';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-10, 22, 20, 28);
  inked(ctx, '#FFB648', 6);
  ctx.beginPath();
  roundRect(ctx, -40, 50, 80, 20, 5);
  inked(ctx, '#FFB648', 6);
}

function dryDrop(ctx) {
  drop(ctx, 0, 8, 46);
  inked(ctx, '#86D2F0');
  ctx.beginPath();
  ctx.moveTo(-62, 70);
  ctx.lineTo(62, -62);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#C8563A';
  ctx.lineWidth = 12;
  ctx.stroke();
}

function numberSymbol(ctx, text) {
  // A spout with its count stamped on it.
  ctx.beginPath();
  roundRect(ctx, -30, -82, 60, 150, 8);
  inked(ctx, '#A9BBC4', 6);
  ctx.fillStyle = '#6B7F8A';
  for (const y of [-40, 10]) ctx.fillRect(-30, y, 60, 7);
  outlined(ctx, text, 0, 4, 84, { font: FONT_DISPLAY, weight: 400, line: 12, fill: '#FFB648' });
}

function starsSymbol(ctx) {
  const star = (x, y, r) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    inked(ctx, '#FFB648', 6);
  };
  star(-52, 16, 30);
  star(52, 16, 30);
  star(0, -18, 44);
}

function boltSymbol(ctx) {
  ctx.beginPath();
  ctx.moveTo(14, -92);
  ctx.lineTo(-36, -8);
  ctx.lineTo(-4, -8);
  ctx.lineTo(-16, 50);
  ctx.lineTo(38, -28);
  ctx.lineTo(6, -28);
  ctx.closePath();
  inked(ctx, '#FFE08A', 7);
  outlined(ctx, '100', 0, 76, 42, { font: FONT_DISPLAY, weight: 400, line: 9, fill: BONE });
}
