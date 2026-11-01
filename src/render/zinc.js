// Weathered galvanised zinc, painted once on canvases: the crystal spangle of the coating, rain streaks running down,
// grime and a little white rust under the joints, and a crimped seam with rivets where one length of pipe meets the
// next. One tile is SEG_W x SEG_H world units; the seams line up between the back plate and the walls.

import * as THREE from 'three';
import { canvasTex, texSet, rand } from './tex.js';

export const SEG_W = 300;
export const SEG_H = 1200;

function paintZinc(ctx, w, h, rough) {
  const r = rand(907);
  // the coating's base, a little lighter at the top of each length (less grime)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (rough) {
    g.addColorStop(0, '#7a7a7a');
    g.addColorStop(1, '#8c8c8c');
  } else {
    g.addColorStop(0, '#c9ced2');
    g.addColorStop(1, '#b4babf');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const wrap = (draw, x, y, ww, hh) => {
    draw(x, y);
    if (x < ww) draw(x + w, y);
    if (x > w - ww) draw(x - w, y);
    if (y < hh) draw(x, y + h);
    if (y > h - hh) draw(x, y - h);
  };
  // spangle: irregular crystals, each a slightly different shade
  for (let i = 0; i < 900; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const rad = 6 + r() * 16;
    const n = 5 + Math.floor(r() * 4);
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.6;
      const d = rad * (0.6 + r() * 0.5);
      pts.push([Math.cos(a) * d, Math.sin(a) * d * 1.15]);
    }
    const light = r() < 0.5;
    const v = rough ? (light ? 255 : 0) : light ? 255 : 90;
    ctx.fillStyle = `rgba(${v},${v},${rough ? v : v + 6},${rough ? 0.03 + r() * 0.06 : 0.012 + r() * 0.03})`;
    wrap((x, y) => {
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
      ctx.closePath();
      ctx.fill();
    }, cx, cy, rad * 2, rad * 2);
  }
  // rain streaks: long thin runs, some grime (dark), some washed clean (light and smoother)
  for (let i = 0; i < 220; i++) {
    const x = r() * w;
    const y0 = r() * h;
    const len = 80 + r() * 600;
    const wd = 1 + r() * (r() < 0.2 ? 9 : 4);
    const dark = r() < 0.62;
    const a = 0.03 + r() * (dark ? 0.12 : 0.08);
    const col = rough ? (dark ? '255,255,255' : '0,0,0') : dark ? '60,58,52' : '245,248,250';
    wrap((xx, yy) => {
      const gr = ctx.createLinearGradient(0, yy, 0, yy + len);
      gr.addColorStop(0, `rgba(${col},0)`);
      gr.addColorStop(0.15, `rgba(${col},${a})`);
      gr.addColorStop(0.85, `rgba(${col},${a * 0.7})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(xx - wd / 2, yy);
      ctx.lineTo(xx + wd / 2, yy);
      ctx.lineTo(xx + wd * 0.3 + Math.sin(i) * 2, yy + len);
      ctx.lineTo(xx - wd * 0.3 + Math.sin(i) * 2, yy + len);
      ctx.fill();
    }, x, y0, wd + 4, len);
  }
  // the joint: grime gathers under it, white rust blooms on it, then a crimped lip and rivets
  const seamY = 40;
  const gr = ctx.createLinearGradient(0, seamY, 0, seamY + 160);
  gr.addColorStop(0, rough ? 'rgba(255,255,255,0.25)' : 'rgba(70,64,52,0.28)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, seamY, w, 160);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const rr = 6 + r() * 22;
    const rg = ctx.createRadialGradient(x, seamY + 10, 0, x, seamY + 10, rr);
    const c = rough ? '255,255,255' : '236,236,226';
    rg.addColorStop(0, `rgba(${c},${0.2 + r() * 0.25})`);
    rg.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(x - rr, seamY + 10 - rr, rr * 2, rr * 2);
    // a white run below it
    const len = 20 + r() * 140;
    ctx.fillStyle = `rgba(${c},${0.08 + r() * 0.1})`;
    ctx.fillRect(x - 1.5, seamY + 10, 3, len);
  }
  if (rough) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, seamY - 8, w, 18);
  } else {
    ctx.fillStyle = 'rgba(40,42,44,0.55)';
    ctx.fillRect(0, seamY - 9, w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(0, seamY - 6, w, 3);
    ctx.fillStyle = 'rgba(30,32,34,0.35)';
    ctx.fillRect(0, seamY + 6, w, 4);
    for (let x = w / 8; x < w; x += w / 4) {
      const rg = ctx.createRadialGradient(x - 1.5, seamY - 1.5, 0.5, x, seamY, 5);
      rg.addColorStop(0, '#f2f4f5');
      rg.addColorStop(0.6, '#8d9296');
      rg.addColorStop(1, 'rgba(40,40,40,0.6)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, seamY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function zincMaps() {
  const map = canvasTex('zinc-c', 512, 2048, (c, w, h) => paintZinc(c, w, h, false), { repeat: true });
  const rough = canvasTex('zinc-r', 256, 1024, (c, w, h) => paintZinc(c, w, h, true), { repeat: true, linear: true });
  return { map, rough };
}

const cache = new Map();
/**
 * Zinc for geometry whose UVs are in world units divided by `tile` (Geo.build(tile)). `along`: the streaks run along u
 * (walls, whose u is the length down the wall) instead of v.
 */
export function zincMat(o = {}) {
  const key = `${o.key ?? 'zinc'}|${o.tile ?? 420}|${o.along ? 1 : 0}`;
  let m = cache.get(key);
  if (m) return m;
  const tile = o.tile ?? 420;
  const { map, rough } = zincMaps();
  const set = texSet('Metal021');
  const rep = (t, rx, ry, rot) => {
    const c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.rotation = rot;
    c.needsUpdate = true;
    return c;
  };
  const rot = o.along ? Math.PI / 2 : 0;
  // rotated a quarter turn, the texture's u runs across the wall (its depth) and v along it
  const [rx, ry] = [tile / SEG_W, tile / SEG_H];
  const normalMap = set.normalMap.clone();
  normalMap.repeat.set(tile / 160, tile / 160);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  m = new THREE.MeshStandardMaterial({
    map: rep(map, rx, ry, rot),
    roughnessMap: rep(rough, rx, ry, rot),
    normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    metalness: o.metal ?? 0.8,
    roughness: o.rough ?? 0.75,
    color: o.color ?? new THREE.Color(1.55, 1.62, 1.68),
    envMapIntensity: o.env ?? 1.2,
    vertexColors: !!o.vertexColors,
  });
  // the Metal021 normal map may still be loading: upload the clone when it arrives
  if (!set.normalMap.image) {
    normalMap.version = 0;
    const poll = setInterval(() => {
      if (set.normalMap.image) {
        normalMap.needsUpdate = true;
        clearInterval(poll);
      }
    }, 100);
  }
  cache.set(key, m);
  return m;
}

/** The rolled front edge of the cut, in vertex colours (bright bead inside, dull face, dark outer lip). */
export function edgeMat() {
  let m = cache.get('edge');
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.5, vertexColors: true });
    cache.set('edge', m);
  }
  return m;
}
