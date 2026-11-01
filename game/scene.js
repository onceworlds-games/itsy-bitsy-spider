// The world behind the spiders: the house wall, the cut-away pipe and its features (cached in horizontal bands of device
// pixels so a phone draws a handful of images a frame), the sky and the sun at the top, rain in three layers, foreground
// ivy, sun shafts and lightning.

import { HALF, WALL_T, RING_IN, RING_H, VENT_H } from './config.js';
import { centerX } from './level.js';
import { shade, rgba, mix, clamp, lerp } from './paint.js';

const BAND_PX = 256;
const ZINC_DARK = '#33414A';
const ZINC = '#73879A';
const ZINC_MID = '#8EA2AD';
const ZINC_HI = '#D3DEE3';
const NIGHT = 0.44; // how dark the house is at night

/** A deterministic 0..1 hash of two integers. */
export function h2(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The scene for one level. look: { facade, sky: [top, bottom] }.
 */
export function createScene(level, look) {
  const facade = look.facade;
  const interior = new Path2D();
  const chainPath = new Path2D();
  level.chain.forEach(([x, y], i) => (i ? chainPath.lineTo(x, y) : chainPath.moveTo(x, y)));
  level.chain.forEach(([x, y], i) => (i ? interior.lineTo(x, y) : interior.moveTo(x, y)));
  interior.closePath();
  // Water runs everywhere inside but the dry pockets (even-odd: the pockets are holes).
  const wet = new Path2D();
  wet.addPath(interior);
  for (const poly of level.pockets) {
    poly.forEach(([x, y], i) => (i ? wet.lineTo(x, y) : wet.moveTo(x, y)));
    wet.closePath();
  }
  let cx0 = Infinity;
  let cx1 = -Infinity;
  for (const [x] of level.center) {
    cx0 = Math.min(cx0, x);
    cx1 = Math.max(cx1, x);
  }
  return {
    level,
    look,
    facade,
    interior,
    wet,
    chainPath,
    cx0,
    cx1,
    bands: new Map(),
    bandScale: 0,
    bx0: 0,
    bx1: 0,
    tick: 0,
    ivy: makeIvy(level),
  };
}

function makeIvy(level) {
  const out = [];
  for (let y = 300, k = 0; y < level.H + 200; y += 520 + h2(k, 3) * 500, k++) {
    out.push({ y, side: h2(k, 5) < 0.5 ? -1 : 1, len: 160 + h2(k, 8) * 220, seed: k });
  }
  return out;
}

/** Drops the cached bands (a resize or a quality change). */
export function resetBands(scene) {
  scene.bands.clear();
  scene.bandScale = 0;
}

/** Draws the static world for the current view: the sky behind, then the cached bands. */
export function drawStatic(ctx, scene, view, env) {
  const { level } = scene;
  if (scene.bandScale !== view.s || scene.bandW !== view.viewW) {
    scene.bands.clear();
    scene.bandScale = view.s;
    scene.bandW = view.viewW;
    const margin = view.viewW / 2 + 160;
    scene.bx0 = Math.floor((scene.cx0 - margin) * view.s) / view.s;
    scene.bx1 = Math.ceil((scene.cx1 + margin) * view.s) / view.s;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Under everything: the wall's own colour (outside the bands) and the sky above the roof.
  ctx.fillStyle = shade(scene.facade.base, NIGHT * 0.8);
  ctx.fillRect(0, 0, view.Wd, view.Hd);
  if (view.y1 > level.H + 60) drawSky(ctx, scene, view, env);
  const BH = BAND_PX / view.s;
  const j0 = Math.floor(view.y0 / BH);
  const j1 = Math.floor(view.y1 / BH);
  const dx = Math.round(scene.bx0 * view.s + view.tx);
  for (let j = j0; j <= j1; j++) {
    const band = bandFor(scene, view, j);
    if (!band) continue;
    const dy = view.ty - (j + 1) * BAND_PX;
    ctx.drawImage(band, dx, dy);
  }
  // Keep the cache small: the bands in view and a few around them.
  if (scene.bands.size > j1 - j0 + 10) {
    for (const k of scene.bands.keys()) {
      if (k < j0 - 4 || k > j1 + 4) scene.bands.delete(k);
      if (scene.bands.size <= j1 - j0 + 6) break;
    }
  }
}

function bandFor(scene, view, j) {
  let band = scene.bands.get(j);
  if (band) return band;
  const s = view.s;
  const w = Math.max(1, Math.round((scene.bx1 - scene.bx0) * s));
  band = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, BAND_PX) : Object.assign(document.createElement('canvas'), { width: w, height: BAND_PX });
  const g = band.getContext('2d');
  if (!g) return null;
  const BH = BAND_PX / s;
  const y0 = j * BH;
  const y1 = (j + 1) * BH;
  g.setTransform(s, 0, 0, -s, -scene.bx0 * s, y1 * s);
  paintStatic(g, scene, scene.bx0, y0, scene.bx1, y1);
  scene.bands.set(j, band);
  return band;
}

// ---------------------------------------------------------------- the static painting (world units, y up)

function paintStatic(g, scene, x0, y0, x1, y1) {
  const { level } = scene;
  const H = level.H;
  const pad = 60;
  // The wall of the house, its windows and the ivy roots (up to the roof).
  if (y0 < H + 70) {
    g.save();
    g.beginPath();
    g.rect(x0, y0 - 2, x1 - x0, Math.min(y1, H + 70) - y0 + 4);
    g.clip();
    paintFacade(g, scene, x0, y0 - pad, x1, Math.min(y1, H + 70) + pad);
    paintWindows(g, scene, x0, y0 - 300, x1, y1 + 300);
    g.restore();
  }
  if (y0 < 0) paintGround(g, scene, x0, y0, x1, Math.min(0, y1));
  if (y1 > H - 40) paintRoof(g, scene, x0, Math.max(y0, H - 40), x1, y1);
  // The pipe's shadow on the wall.
  g.save();
  g.translate(9, -9);
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(5,8,12,0.42)';
  g.lineWidth = WALL_T * 2 + 22;
  g.stroke(scene.chainPath);
  g.restore();
  paintStraps(g, scene, y0 - 100, y1 + 100);
  // The cut walls: a bevelled band outside the chain (the interior covers the inner half).
  g.lineJoin = 'miter';
  g.miterLimit = 3;
  g.lineCap = 'butt';
  g.strokeStyle = ZINC_DARK;
  g.lineWidth = WALL_T * 2 + 4;
  g.stroke(scene.chainPath);
  g.strokeStyle = ZINC;
  g.lineWidth = WALL_T * 2 - 2;
  g.stroke(scene.chainPath);
  g.strokeStyle = ZINC_MID;
  g.lineWidth = WALL_T * 2 - 22;
  g.stroke(scene.chainPath);
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  g.lineWidth = WALL_T * 2 - 30;
  g.stroke(scene.chainPath);
  paintInterior(g, scene, y0, y1);
  paintFeatures(g, scene, y0 - 120, y1 + 120);
  // The cut edge catching the light.
  g.strokeStyle = rgba(ZINC_HI, 0.9);
  g.lineWidth = 2.2;
  g.stroke(scene.chainPath);
  paintMoss(g, scene, y0 - 20, y1 + 20);
}

function paintFacade(g, scene, x0, y0, x1, y1) {
  const f = scene.facade;
  const base = f.base;
  const dark = (k) => shade(base, NIGHT * k);
  g.fillStyle = shade(f.line, NIGHT * 0.75);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  switch (f.kind) {
    case 'brick': {
      const rh = 20;
      const bw = 50;
      for (let r = Math.floor(y0 / rh); r * rh < y1; r++) {
        const off = r & 1 ? bw / 2 : 0;
        for (let c = Math.floor((x0 - off) / bw) - 1; c * bw + off < x1; c++) {
          const k = h2(r, c);
          g.fillStyle = k < 0.07 ? dark(0.7) : shade(base, NIGHT * (0.86 + 0.28 * h2(c, r + 99)));
          g.fillRect(c * bw + off + 1.5, r * rh + 1.5, bw - 3, rh - 3);
          if (k > 0.9) {
            g.fillStyle = 'rgba(255,255,255,0.05)';
            g.fillRect(c * bw + off + 1.5, r * rh + rh - 5, bw - 3, 3);
          }
        }
      }
      break;
    }
    case 'boards': {
      const bw = 38;
      for (let c = Math.floor(x0 / bw) - 1; c * bw < x1; c++) {
        g.fillStyle = shade(base, NIGHT * (0.85 + 0.3 * h2(c, 1)));
        g.fillRect(c * bw + 1.5, y0, bw - 3, y1 - y0);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 3; i++) g.fillRect(c * bw + 6 + i * 10 + h2(c, i) * 6, y0, 1.2, y1 - y0);
        // Board ends and nails.
        const step = 460 + Math.floor(h2(c, 2) * 200);
        for (let y = Math.floor(y0 / step) * step + Math.floor(h2(c, 3) * 120); y < y1; y += step) {
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(c * bw + 1.5, y, bw - 3, 2.5);
          g.fillStyle = 'rgba(200,190,170,0.25)';
          g.fillRect(c * bw + 8, y + 8, 2.4, 2.4);
          g.fillRect(c * bw + bw - 11, y + 8, 2.4, 2.4);
        }
      }
      break;
    }
    case 'glass': {
      const pw = 120;
      const ph = 170;
      g.fillStyle = shade(f.trim, 0.32);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let r = Math.floor(y0 / ph); r * ph < y1; r++) {
        for (let c = Math.floor(x0 / pw); c * pw < x1; c++) {
          const x = c * pw + 5;
          const y = r * ph + 5;
          const lit = h2(c, r) < 0.28;
          const grd = g.createLinearGradient(x, y, x + pw, y + ph);
          if (lit) {
            grd.addColorStop(0, shade(f.window.light, 0.55));
            grd.addColorStop(1, shade(f.window.light, 0.3));
          } else {
            grd.addColorStop(0, shade(base, 0.7));
            grd.addColorStop(0.55, shade(base, 0.45));
            grd.addColorStop(1, shade(base, 0.62));
          }
          g.fillStyle = grd;
          g.fillRect(x, y, pw - 10, ph - 10);
          if (f.base === '#2C4A44' && !lit) {
            // Greenhouse plants behind the glass.
            g.fillStyle = 'rgba(20,40,24,0.75)';
            for (let i = 0; i < 4; i++) {
              g.beginPath();
              g.ellipse(x + 12 + h2(c * 7 + i, r) * (pw - 30), y + 8 + h2(c, r * 3 + i) * 50, 14, 22, h2(i, c) * 3, 0, Math.PI * 2);
              g.fill();
            }
          }
          g.fillStyle = 'rgba(255,255,255,0.05)';
          g.beginPath();
          g.moveTo(x, y + ph - 10);
          g.lineTo(x + 30, y + ph - 10);
          g.lineTo(x + pw - 10, y + 40);
          g.lineTo(x + pw - 10, y + 10);
          g.closePath();
          g.fill();
        }
      }
      break;
    }
    case 'render': {
      g.fillStyle = dark(1);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let i = Math.floor(y0 / 90); i * 90 < y1; i++) {
        for (let c = Math.floor(x0 / 140); c * 140 < x1; c++) {
          const k = h2(i, c);
          g.fillStyle = k < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)';
          g.beginPath();
          g.ellipse(c * 140 + k * 140, i * 90 + h2(c, i) * 90, 30 + k * 50, 18 + k * 30, 0, 0, Math.PI * 2);
          g.fill();
          if (k > 0.93) {
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.lineWidth = 1.2;
            g.beginPath();
            let x = c * 140 + 40;
            let y = i * 90 + 20;
            g.moveTo(x, y);
            for (let s = 0; s < 5; s++) {
              x += (h2(s, c + i) - 0.5) * 24;
              y += 12 + h2(i, s) * 10;
              g.lineTo(x, y);
            }
            g.stroke();
          }
        }
      }
      break;
    }
    case 'stone': {
      const rh = 46;
      for (let r = Math.floor(y0 / rh); r * rh < y1; r++) {
        let x = Math.floor(x0 / 100) * 100 - 100 - h2(r, 1) * 80;
        let c = 0;
        while (x < x1) {
          const w = 70 + h2(r, c) * 60;
          g.fillStyle = shade(base, NIGHT * (0.8 + 0.35 * h2(c, r + 17)));
          g.fillRect(x + 2.5, r * rh + 2.5, w - 5, rh - 5);
          g.fillStyle = 'rgba(255,255,255,0.04)';
          g.fillRect(x + 2.5, r * rh + rh - 8, w - 5, 5);
          x += w;
          c++;
        }
      }
      break;
    }
    case 'stripes': {
      const bh = 280;
      for (let r = Math.floor(y0 / bh); r * bh < y1; r++) {
        g.fillStyle = r & 1 ? shade(f.line, NIGHT * 1.15) : shade(base, NIGHT * 1.05);
        g.fillRect(x0, r * bh, x1 - x0, bh);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = r * bh; y < r * bh + bh; y += 35) g.fillRect(x0, y, x1 - x0, 1.5);
      }
      break;
    }
    case 'concrete': {
      const pw = 220;
      const ph = 160;
      for (let r = Math.floor(y0 / ph); r * ph < y1; r++) {
        for (let c = Math.floor(x0 / pw); c * pw < x1; c++) {
          g.fillStyle = shade(base, NIGHT * (0.85 + 0.25 * h2(c, r)));
          g.fillRect(c * pw + 2, r * ph + 2, pw - 4, ph - 4);
          const grd = g.createLinearGradient(0, r * ph + ph, 0, r * ph);
          grd.addColorStop(0, 'rgba(0,0,0,0)');
          grd.addColorStop(1, 'rgba(0,0,0,0.22)');
          g.fillStyle = grd;
          g.fillRect(c * pw + 20 + h2(r, c) * 120, r * ph + 2, 18 + h2(c, r + 4) * 30, ph - 4);
        }
      }
      break;
    }
    default:
      g.fillStyle = dark(1);
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
}

function paintWindows(g, scene, x0, y0, x1, y1) {
  const { level } = scene;
  const win = scene.facade.window;
  if (!win.every) return;
  const trim = shade(scene.facade.trim, 0.55);
  for (let k = Math.max(0, Math.floor(y0 / win.every)); k * win.every < Math.min(y1, level.H - 140); k++) {
    const wy = k * win.every + 160 + h2(k, 4) * 120;
    if (wy + win.h > level.H - 60) continue;
    const both = h2(k, 11) < 0.3;
    for (const side of both ? [-1, 1] : [h2(k, 5) < 0.5 ? -1 : 1]) {
      const cx = centerX(level, wy + win.h / 2);
      const wx = cx + side * (HALF + WALL_T + 70 + win.w / 2 + h2(k, side + 9) * 70);
      if (wx + win.w < x0 || wx - win.w > x1) continue;
      const lit = h2(k, side + 3) < 0.78;
      const l = wx - win.w / 2;
      if (lit) {
        const r = Math.max(win.w, win.h) * 1.3;
        const glow = g.createRadialGradient(wx, wy + win.h / 2, 10, wx, wy + win.h / 2, r);
        glow.addColorStop(0, rgba(win.light, 0.32));
        glow.addColorStop(1, rgba(win.light, 0));
        g.fillStyle = glow;
        g.fillRect(wx - r, wy + win.h / 2 - r, r * 2, r * 2);
      }
      // Frame, sill and lintel.
      g.fillStyle = trim;
      g.fillRect(l - 9, wy - 9, win.w + 18, win.h + 18);
      g.fillStyle = shade(scene.facade.trim, 0.75);
      g.fillRect(l - 15, wy - 16, win.w + 30, 9);
      g.fillRect(l - 6, wy + win.h + 9, win.w + 12, 7);
      const glass = g.createLinearGradient(0, wy, 0, wy + win.h);
      if (lit) {
        glass.addColorStop(0, win.light);
        glass.addColorStop(1, shade(win.light, 0.62));
      } else {
        glass.addColorStop(0, '#1A2733');
        glass.addColorStop(1, '#0F171F');
      }
      g.fillStyle = glass;
      g.fillRect(l, wy, win.w, win.h);
      if (win.stained && lit) {
        const cols = ['#C8463A', '#3A6FC8', '#E3B43A', '#4E9A52'];
        for (let i = 0; i < 6; i++) {
          g.fillStyle = rgba(cols[i % 4], 0.55);
          g.fillRect(l + (i % 2) * (win.w / 2), wy + Math.floor(i / 2) * (win.h / 3), win.w / 2, win.h / 3);
        }
      }
      if (lit) {
        // Curtains and a plant on the sill: somebody lives here.
        g.fillStyle = rgba(shade(win.light, 0.35), 0.8);
        g.fillRect(l, wy + win.h * 0.12, win.w * 0.16, win.h * 0.88);
        g.fillRect(l + win.w * 0.84, wy + win.h * 0.12, win.w * 0.16, win.h * 0.88);
        if (h2(k, side + 21) < 0.5) {
          g.fillStyle = 'rgba(40,30,20,0.85)';
          g.fillRect(wx - 8, wy, 16, 14);
          g.beginPath();
          g.ellipse(wx, wy + 24, 14, 12, 0, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.fillStyle = 'rgba(160,190,210,0.08)';
        g.beginPath();
        g.moveTo(l, wy);
        g.lineTo(l + win.w * 0.4, wy);
        g.lineTo(l, wy + win.h * 0.5);
        g.closePath();
        g.fill();
      }
      g.fillStyle = trim;
      g.fillRect(wx - 2.5, wy, 5, win.h);
      g.fillRect(l, wy + win.h * 0.55, win.w, 5);
    }
  }
}

function paintGround(g, scene, x0, y0, x1, y1) {
  const top = -WALL_T - 4;
  const grd = g.createLinearGradient(0, top, 0, top - 400);
  grd.addColorStop(0, '#2B241C');
  grd.addColorStop(1, '#120F0C');
  g.fillStyle = grd;
  g.fillRect(x0, y0, x1 - x0, Math.min(y1, top) - y0);
  // Paving at the foot of the wall, then grass.
  for (let c = Math.floor(x0 / 70); c * 70 < x1; c++) {
    g.fillStyle = shade('#6B6458', 0.45 + 0.15 * h2(c, 2));
    g.fillRect(c * 70 + 2, top - 26, 66, 24);
  }
  g.fillStyle = '#16210F';
  for (let c = Math.floor(x0 / 9); c * 9 < x1; c++) {
    const hgt = 10 + h2(c, 7) * 22;
    g.beginPath();
    g.moveTo(c * 9 - 4, top - 28);
    g.lineTo(c * 9 + (h2(c, 1) - 0.5) * 8, top - 28 - hgt);
    g.lineTo(c * 9 + 5, top - 28);
    g.fill();
  }
  // A puddle by the drain.
  const cx = centerX(scene.level, 0);
  const pud = g.createLinearGradient(cx - 200, 0, cx + 200, 0);
  pud.addColorStop(0, 'rgba(134,210,240,0)');
  pud.addColorStop(0.5, 'rgba(134,210,240,0.22)');
  pud.addColorStop(1, 'rgba(134,210,240,0)');
  g.fillStyle = pud;
  g.beginPath();
  g.ellipse(cx, top - 14, 200, 10, 0, 0, Math.PI * 2);
  g.fill();
}

function paintRoof(g, scene, x0, y0, x1, y1) {
  const H = scene.level.H;
  // The gutter: its back wall (cut away like the pipe) and its rolled lip.
  const gb = g.createLinearGradient(0, H, 0, H + 56);
  gb.addColorStop(0, '#26323B');
  gb.addColorStop(1, '#3A4852');
  g.fillStyle = gb;
  g.fillRect(x0, H, x1 - x0, 56);
  g.fillStyle = ZINC;
  g.fillRect(x0, H + 50, x1 - x0, 10);
  g.fillStyle = ZINC_HI;
  g.fillRect(x0, H + 58, x1 - x0, 2);
  g.fillStyle = ZINC_DARK;
  g.fillRect(x0, H - WALL_T - 2, x1 - x0, WALL_T + 2);
  g.fillStyle = ZINC;
  g.fillRect(x0, H - WALL_T + 2, x1 - x0, WALL_T - 4);
  g.fillStyle = rgba(ZINC_HI, 0.8);
  g.fillRect(x0, H - 2, x1 - x0, 2);
  for (let x = Math.floor(x0 / 160) * 160; x < x1; x += 160) {
    g.fillStyle = ZINC_DARK;
    g.fillRect(x, H - WALL_T, 3, WALL_T + 60);
  }
  // Fascia board and slate tiles up to the ridge.
  g.fillStyle = '#20160F';
  g.fillRect(x0, H + 60, x1 - x0, 26);
  const t0 = H + 86;
  const t1 = H + 290;
  for (let r = 0; t0 + r * 22 < Math.min(t1, y1 + 30); r++) {
    const y = t0 + r * 22;
    const off = r & 1 ? 21 : 0;
    for (let c = Math.floor((x0 - off) / 42) - 1; c * 42 + off < x1; c++) {
      g.fillStyle = shade('#3B4654', 0.55 + 0.25 * h2(r, c));
      g.fillRect(c * 42 + off + 1, y, 40, 21);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(c * 42 + off + 1, y, 40, 3);
    }
  }
  g.fillStyle = '#1C232C';
  g.fillRect(x0, t1, x1 - x0, 10);
}

function paintStraps(g, scene, y0, y1) {
  const { level } = scene;
  for (let y = Math.floor(y0 / 540) * 540 + 300; y < y1; y += 540) {
    if (y > level.H - 120 || y < 120) continue;
    const cx = centerX(level, y);
    for (const s of [-1, 1]) {
      const wx = cx + s * (HALF + WALL_T);
      g.fillStyle = '#2A3238';
      g.fillRect(Math.min(wx, wx + s * 26), y - 9, 26, 18);
      g.fillStyle = '#56636B';
      g.fillRect(Math.min(wx, wx + s * 24), y - 7, 24, 14);
      g.fillStyle = '#1A2025';
      g.beginPath();
      g.arc(wx + s * 16, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function paintInterior(g, scene, y0, y1) {
  const { level } = scene;
  g.save();
  g.clip(scene.interior);
  const lo = Math.max(y0 - 4, -60);
  const hi = Math.min(y1 + 4, level.H + 4);
  for (let y = Math.floor(lo / 8) * 8; y < hi; y += 8) {
    const cx = centerX(level, y + 4);
    const grd = g.createLinearGradient(cx - HALF - 70, 0, cx + HALF + 70, 0);
    grd.addColorStop(0, '#141C23');
    grd.addColorStop(0.3, '#2B3943');
    grd.addColorStop(0.42, '#3E4E58');
    grd.addColorStop(0.62, '#2E3C46');
    grd.addColorStop(1, '#121A20');
    g.fillStyle = grd;
    g.fillRect(cx - HALF - 80, y, PIPE_SPAN, 8.5);
  }
  // Seams round the back of the pipe, rust bleeding from them.
  for (let y = Math.floor(lo / 300) * 300 + 150; y < hi; y += 300) {
    const cx = centerX(level, y);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(cx - HALF - 80, y, PIPE_SPAN, 2);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(cx - HALF - 80, y + 2, PIPE_SPAN, 1.5);
    for (let i = 0; i < 3; i++) {
      const k = h2(Math.round(y), i);
      if (k < 0.4) continue;
      const x = cx - HALF + 20 + h2(i, Math.round(y)) * (2 * HALF - 40);
      const len = 40 + k * 90;
      const rust = g.createLinearGradient(0, y, 0, y - len);
      rust.addColorStop(0, 'rgba(158,74,49,0.45)');
      rust.addColorStop(1, 'rgba(158,74,49,0)');
      g.fillStyle = rust;
      g.fillRect(x, y - len, 4 + k * 5, len);
    }
  }
  // Dry pockets: sheltered, darker, with old silk in the corners.
  level.pockets.forEach((poly, k) => {
    const box = level.pocketBoxes[k];
    if (box.y1 < y0 - 10 || box.y0 > y1 + 10) return;
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = 'rgba(8,12,16,0.32)';
    g.fill();
    g.fillStyle = 'rgba(255,182,72,0.05)';
    g.fill();
    let bx = Infinity;
    let by = -Infinity;
    let ax = -Infinity;
    for (const [x, y] of poly) {
      bx = Math.min(bx, x);
      ax = Math.max(ax, x);
      by = Math.max(by, y);
    }
    const corner = h2(Math.round(by), 3) < 0.5 ? bx : ax;
    const dir = corner === bx ? 1 : -1;
    g.strokeStyle = 'rgba(243,237,226,0.22)';
    g.lineWidth = 0.8;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      g.moveTo(corner, by - 4 - i * 9);
      g.lineTo(corner + dir * (10 + i * 9), by - 4);
    }
    g.moveTo(corner, by - 4);
    g.lineTo(corner + dir * 34, by - 40);
    g.stroke();
  });
  g.restore();
}
const PIPE_SPAN = 2 * HALF + 160;

function paintFeatures(g, scene, y0, y1) {
  const { level } = scene;
  for (const f of level.features) {
    const fy0 = f.y0 ?? f.y;
    const fy1 = f.y1 ?? f.y;
    if (fy1 < y0 || fy0 > y1) continue;
    switch (f.kind) {
      case 'ring':
        for (const s of [-1, 1]) {
          const wx = f.x + s * HALF;
          const xo = wx + s * (WALL_T + 7);
          const l = Math.min(wx - s * RING_IN, xo);
          const w = Math.abs(xo - (wx - s * RING_IN));
          g.fillStyle = ZINC_DARK;
          g.fillRect(Math.min(wx, xo) - 1, f.y - 9, Math.abs(xo - wx) + 2, RING_H + 18);
          const grd = g.createLinearGradient(0, f.y - 8, 0, f.y + RING_H + 8);
          grd.addColorStop(0, '#5E717C');
          grd.addColorStop(0.5, '#A9BBC4');
          grd.addColorStop(1, '#5E717C');
          g.fillStyle = grd;
          g.fillRect(Math.min(wx, xo), f.y - 7, Math.abs(xo - wx), RING_H + 14);
          g.fillStyle = '#9DB0BA';
          g.fillRect(l, f.y, w, RING_H);
          g.fillStyle = rgba(ZINC_HI, 0.85);
          g.fillRect(l, f.y + RING_H - 2, w, 2);
          g.fillStyle = '#1E262C';
          for (const dy of [-1, RING_H + 1]) {
            g.beginPath();
            g.arc(wx + s * 12, f.y + dy, 2.2, 0, Math.PI * 2);
            g.fill();
          }
        }
        break;
      case 'bracket': {
        const s = f.side === 'L' ? -1 : 1;
        const wx = f.x + s * HALF;
        const tip = wx - s * f.len;
        g.fillStyle = '#5B6B74';
        g.fillRect(Math.min(wx, tip), f.y, f.len, 12);
        g.fillStyle = rgba(ZINC_HI, 0.8);
        g.fillRect(Math.min(wx, tip), f.y + 10, f.len, 2);
        g.fillStyle = '#1E262C';
        for (const k of [0.3, 0.75]) {
          g.beginPath();
          g.arc(wx - s * f.len * k, f.y + 6, 2.4, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case 'alcove': {
        const s = f.side === 'L' ? -1 : 1;
        const back = f.x + s * (HALF + f.w);
        g.fillStyle = ZINC_DARK;
        g.fillRect(Math.min(back + s * WALL_T, back + s * (WALL_T + 12)), f.y - WALL_T - 6, 12, f.hh + 2 * WALL_T + 12);
        g.fillStyle = '#6C808B';
        g.fillRect(Math.min(back + s * WALL_T, back + s * (WALL_T + 10)), f.y - WALL_T - 4, 10, f.hh + 2 * WALL_T + 8);
        break;
      }
      case 'elbow': {
        g.fillStyle = '#1E262C';
        for (const s of [-1, 1]) {
          const wx = f.x + s * HALF;
          for (let i = 0; i < 4; i++) {
            g.beginPath();
            g.arc(wx + s * 11 + (f.d * i) / 3, f.y + (Math.abs(f.d) * i) / 3, 2, 0, Math.PI * 2);
            g.fill();
          }
        }
        break;
      }
      case 'seam': {
        const s = f.side === 'L' ? -1 : 1;
        const cx = centerX(level, f.y);
        const wx = cx + s * HALF;
        g.fillStyle = '#06090C';
        g.beginPath();
        g.moveTo(wx - s * 2, f.y - 22);
        g.lineTo(wx + s * (WALL_T + 3), f.y - 26);
        g.lineTo(wx + s * (WALL_T + 3), f.y + 26);
        g.lineTo(wx - s * 2, f.y + 22);
        g.lineTo(wx + s * 6, f.y + 8);
        g.lineTo(wx - s * 1, f.y);
        g.lineTo(wx + s * 6, f.y - 9);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba(ZINC_HI, 0.6);
        g.lineWidth = 1.4;
        g.stroke();
        break;
      }
      case 'vent': {
        const cx = centerX(level, f.y + 40);
        g.fillStyle = '#0B0F13';
        g.fillRect(cx - 34, f.y + 8, 68, 34);
        const glow = g.createRadialGradient(cx, f.y + 25, 2, cx, f.y + 25, 40);
        glow.addColorStop(0, 'rgba(255,150,70,0.6)');
        glow.addColorStop(1, 'rgba(255,150,70,0)');
        g.fillStyle = glow;
        g.fillRect(cx - 34, f.y + 8, 68, 34);
        g.fillStyle = '#56656E';
        for (let i = 0; i < 5; i++) g.fillRect(cx - 34, f.y + 10 + i * 7, 68, 3);
        g.strokeStyle = '#8EA2AD';
        g.lineWidth = 2;
        g.strokeRect(cx - 35, f.y + 7, 70, 36);
        break;
      }
      case 'drain': {
        g.fillStyle = '#080B0E';
        for (let i = -3; i <= 3; i++) g.fillRect(f.x + i * 18 - 4, -WALL_T + 5, 8, WALL_T - 9);
        break;
      }
      default:
        break;
    }
  }
}

function paintMoss(g, scene, y0, y1) {
  const { level } = scene;
  for (const f of level.features) {
    if (f.kind !== 'moss' || f.y1 < y0 || f.y0 > y1) continue;
    const s = f.side === 'L' ? -1 : 1;
    for (let y = f.y0; y < f.y1; y += 5) {
      const wx = centerX(level, y) + s * HALF;
      const edge = Math.min(1, (y - f.y0) / 30, (f.y1 - y) / 30);
      for (let i = 0; i < 3; i++) {
        const k = h2(Math.round(y), i + 40);
        const r = (2.5 + k * 4.5) * (0.4 + 0.6 * edge);
        g.fillStyle = mix('#3F5A22', '#9BBF5A', h2(i, Math.round(y)));
        g.beginPath();
        g.arc(wx + s * (6 - k * 14), y + i * 1.6, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

// ---------------------------------------------------------------- the live layers

/** Sky above the roof: night clouds, a gold dawn breaking at the sun, far roofs. env: { calm, storm, flash, t }. */
function drawSky(ctx, scene, view, env) {
  const H = scene.level.H;
  const roofY = (view.ty - (H + 290) * view.s);
  const bottom = Math.min(view.Hd, Math.max(0, roofY + 4));
  if (bottom <= 0) return;
  const grd = ctx.createLinearGradient(0, 0, 0, bottom);
  const warm = clamp(env.calm, 0, 1);
  grd.addColorStop(0, mix('#0E1620', '#2A2F45', warm * 0.6));
  grd.addColorStop(0.65, mix('#1C2735', '#7A4A3A', warm * 0.75));
  grd.addColorStop(1, mix('#26303E', '#E08A3C', warm * 0.85));
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, view.Wd, bottom);
  // The sun, low over the roofs.
  const sx = (scene.cx1 + 260) * view.s + view.tx;
  const sy = view.ty - (H + 420) * view.s;
  const r = 70 * view.s;
  const glow = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 4);
  glow.addColorStop(0, `rgba(255,190,90,${0.55 * (0.35 + 0.65 * warm)})`);
  glow.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
  ctx.fillStyle = mix('#C98A4A', '#FFD27A', warm);
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  // Clouds drifting, thicker in the rain.
  const k = 0.25 + 0.75 * (1 - warm);
  for (let i = 0; i < 7; i++) {
    const cx = ((((h2(i, 1) * 3000 + env.t * (8 + i * 3)) % 3000) - 600) / 2400) * view.Wd;
    const cy = view.ty - (H + 360 + h2(i, 2) * 260) * view.s;
    const w = (220 + h2(i, 3) * 260) * view.s;
    ctx.fillStyle = `rgba(${mix('#202A36', '#5A4A50', warm * 0.5).slice(4, -1)},${0.55 * k + 0.2})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.4, cy - w * 0.08, w * 0.5, w * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Far roofs at a slower parallax.
  const par = 0.35;
  const baseY = view.ty - (H + 290) * view.s + (view.camY - H) * view.s * (1 - par) * 0.2;
  ctx.fillStyle = '#0D131A';
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let i = -1; i < 14; i++) {
    const x = ((i * 180 - view.camX * par * 0.6) % 2520) * view.s * 0.7;
    const hgt = (60 + h2(i, 9) * 120) * view.s * 0.6;
    ctx.lineTo(x, baseY - hgt * 0.4);
    ctx.lineTo(x + 40 * view.s, baseY - hgt);
    ctx.lineTo(x + 90 * view.s, baseY - hgt * 0.4);
  }
  ctx.lineTo(view.Wd, bottom);
  ctx.closePath();
  ctx.fill();
}

/** Gold shafts slanting down through the seams in the sun (calm 0..1). Screen space, device pixels. */
export function drawShafts(ctx, view, calm, t) {
  if (calm <= 0.02) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const W = view.Wd;
  const Hd = view.Hd;
  for (let i = 0; i < 4; i++) {
    const x = ((h2(i, 5) * 1.4 - 0.2 + Math.sin(t * 0.1 + i) * 0.03) * W);
    const w = (0.06 + h2(i, 6) * 0.1) * W;
    const a = calm * (0.06 + h2(i, 7) * 0.05);
    const grd = ctx.createLinearGradient(x, 0, x - Hd * 0.45, Hd);
    grd.addColorStop(0, `rgba(255,190,100,${a})`);
    grd.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w - Hd * 0.45, Hd);
    ctx.lineTo(x - Hd * 0.45 - w * 0.6, Hd);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Rain in three layers (far, mid, near), heavier as the weather builds (0..1). */
export function createRain(quality) {
  const n = quality === 'low' ? 60 : quality === 'medium' ? 110 : 160;
  const layers = [
    { par: 0.55, speed: 900, len: 10, width: 1, alpha: 0.22, drops: [] },
    { par: 1, speed: 1400, len: 18, width: 1.4, alpha: 0.3, drops: [] },
    { par: 1.5, speed: 2100, len: 34, width: 2.2, alpha: 0.26, drops: [] },
  ];
  layers.forEach((L, li) => {
    for (let i = 0; i < n; i++) L.drops.push([h2(i, li + 1), h2(li + 7, i), h2(i * 3, li)]);
  });
  return { layers, quality };
}

export function drawRain(ctx, view, rain, heavy, t) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  const W = view.Wd;
  const Hd = view.Hd;
  const z = view.s;
  for (const L of rain.layers) {
    const count = Math.floor(L.drops.length * (0.25 + 0.75 * heavy));
    ctx.strokeStyle = `rgba(200,225,240,${L.alpha * (0.6 + 0.4 * heavy)})`;
    ctx.lineWidth = L.width * Math.max(1, z * 0.7);
    ctx.beginPath();
    const len = L.len * z * (0.8 + heavy * 0.6);
    const slant = len * 0.18;
    const span = Hd + len * 2;
    const scroll = t * L.speed * z * 0.5 + view.camY * z * L.par;
    for (let i = 0; i < count; i++) {
      const d = L.drops[i];
      const x = ((((d[0] * (W + 80) + view.camX * z * (L.par - 1) * 0.3) % (W + 80)) + W + 80) % (W + 80)) - 40;
      const y = ((((d[1] * span + scroll * (0.8 + d[2] * 0.4)) % span) + span) % span) - len;
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant, y + len);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Ivy hanging in front of everything at the screen's edges (parallax 1.3). */
export function drawIvy(ctx, scene, view) {
  const par = 1.3;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const v of scene.ivy) {
    const sy = view.Hd / 2 - (v.y - view.camY) * view.s * par;
    const len = v.len * view.s * par;
    if (sy + len < -50 || sy - 60 > view.Hd) continue;
    const x = v.side < 0 ? 0 : view.Wd;
    ctx.strokeStyle = '#0A1009';
    ctx.lineWidth = 3 * view.s;
    ctx.beginPath();
    ctx.moveTo(x - v.side * 6 * view.s, sy - 40 * view.s);
    ctx.quadraticCurveTo(x - v.side * 40 * view.s, sy + len * 0.5, x - v.side * 18 * view.s, sy + len);
    ctx.stroke();
    ctx.fillStyle = '#0C150B';
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const px = x - v.side * (6 + 34 * Math.sin(k * Math.PI) + h2(v.seed, i) * 14) * view.s;
      const py = sy + len * k;
      const r = (9 + h2(i, v.seed) * 8) * view.s;
      ctx.beginPath();
      ctx.moveTo(px, py - r);
      ctx.quadraticCurveTo(px + r, py - r * 0.2, px, py + r);
      ctx.quadraticCurveTo(px - r, py - r * 0.2, px, py - r);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The whole scene darkening as the rain builds, lightning's cold flash on top. */
export function drawMood(ctx, view, gloom, flash) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (gloom > 0.01) {
    ctx.fillStyle = `rgba(10,16,24,${0.28 * gloom})`;
    ctx.fillRect(0, 0, view.Wd, view.Hd);
  }
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(225,238,255,${0.55 * flash})`;
    ctx.fillRect(0, 0, view.Wd, view.Hd);
  }
  ctx.restore();
}

/** Heat shimmer rising from the vents (world transform). */
export function drawVents(ctx, scene, view, t) {
  for (const f of scene.level.features) {
    if (f.kind !== 'vent' || f.y + VENT_H < view.y0 || f.y > view.y1) continue;
    const cx = centerX(scene.level, f.y + 40);
    ctx.strokeStyle = 'rgba(255,170,90,0.16)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const x = cx - 60 + i * 30;
      const phase = (t * 1.3 + i * 0.37) % 1;
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const y = f.y + 40 + (phase + k / 10) * (VENT_H - 60) * 0.5 + k * 18;
        const xx = x + Math.sin(t * 5 + k * 0.9 + i) * 6;
        if (k === 0) ctx.moveTo(xx, y);
        else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
  }
}

/** A falling acorn, bottle cap or leaf (world transform). */
export function drawDebris(ctx, kind, x, y, t, id) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * (id % 2 ? 7 : -6));
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(2, -2, 12, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'cap') {
    ctx.fillStyle = '#B23A2E';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 11 : 12.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#E9E1D2';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'leaf') {
    ctx.fillStyle = '#8C6A2A';
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.quadraticCurveTo(0, 10, 13, 0);
    ctx.quadraticCurveTo(0, -10, -13, 0);
    ctx.fill();
    ctx.strokeStyle = '#5A4218';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#9A6B3A';
    ctx.beginPath();
    ctx.ellipse(0, -2, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5C3D1E';
    ctx.beginPath();
    ctx.ellipse(0, 6, 9.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-3, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The bird at a seam, outside the pipe, pecking in (world transform). b: birdAt(). */
export function drawBird(ctx, level, seam, b, t) {
  const s = seam.side === 'L' ? -1 : 1;
  const cx = centerX(level, seam.y);
  const wx = cx + s * (HALF + WALL_T);
  const reach = b.phase === 'peck' ? b.reach : b.phase === 'windup' ? b.reach : 0;
  const lean = reach * 70;
  ctx.save();
  ctx.translate(wx + s * 20, seam.y - 6);
  ctx.scale(s, 1);
  // Body (outside), the head leaning in through the split.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5A4130';
  ctx.beginPath();
  ctx.ellipse(6, 0, 20, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#C9A57E';
  ctx.beginPath();
  ctx.ellipse(-2, -4, 12, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3A2A1F';
  ctx.beginPath();
  ctx.moveTo(22, 4);
  ctx.lineTo(40, 10 + Math.sin(t * 3) * 2);
  ctx.lineTo(24, -4);
  ctx.closePath();
  ctx.fill();
  const bob = b.phase === 'look' ? Math.sin(b.k * Math.PI * 4) * 3 : 0;
  const hx = -10 - lean;
  const hy = 10 + bob;
  ctx.fillStyle = '#6B4D37';
  ctx.beginPath();
  ctx.arc(hx, hy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F3B33A';
  ctx.beginPath();
  ctx.moveTo(hx - 7, hy + 2);
  ctx.lineTo(hx - 19 - reach * 6, hy - 1);
  ctx.lineTo(hx - 7, hy - 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0E141B';
  ctx.beginPath();
  ctx.arc(hx - 2, hy + 3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(hx - 2.6, hy + 3.6, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Smoothly approaches a target (critically damped, frame-rate independent). */
export const approach = (v, target, rate, dt) => target + (v - target) * Math.exp(-rate * dt);
export { lerp };
