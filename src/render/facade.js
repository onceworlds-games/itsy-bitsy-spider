// The building behind the pipe, at a spider's scale: its wall (brick, boards, plaster, stone or concrete, with a plinth and
// stripes), windows set into it (reveals, frames, sills, rain on the glass, a lit room behind with curtains, shutters,
// flower boxes), ivy that moves in the wind, stains under the sills, wall lamps, the theme's signature pieces (a clock,
// a sign, an awning, a greenhouse's glass), the ground at the foot and the roof above the gutter.

import * as THREE from 'three';
import { Geo } from './geo.js';
import { pbr, plain, canvasTex, rand } from './tex.js';
import { roomTex, stainedTex, rainGlassNormal, ivyLeafTex, curtainTex, stainTex } from './paint.js';
import { buildProps, windMaterial, wind } from './props.js';
import { DEPTH, WALL_T } from '../sim/config.js';
import { drainHole } from './pipe.js';

const D2 = DEPTH / 2;
export const ZW = -D2 - WALL_T - 36; // the wall's face
const REV = 70; // window reveal depth
const ROOM = 320; // how deep the rooms behind the windows go

const TIME = { day: 0.55, dawn: 0.9, dusk: 1.35, night: 1.9, storm: 1.5 };

export function buildFacade(level, theme) {
  const group = new THREE.Group();
  group.name = 'facade';
  const H = level.H;
  const rnd = rand(Math.round(H) * 7 + theme.key.length * 131);
  const X0 = -5200;
  const X1 = 5200;
  const top = H - 110;
  const lit = TIME[theme.time] ?? 1;

  // ---------------------------------------------------------------- windows
  const wins = placeWindows(level, theme, rnd);

  // ---------------------------------------------------------------- the wall, in bands (plinth, stripes, the rest)
  const holes = wins.map((w) => ({ x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 }));
  if (theme.glass) holes.push({ x0: X0, x1: X1, y0: theme.glass.from, y1: top });
  const bands = [];
  const plinthH = theme.plinth?.h ?? 0;
  if (plinthH) bands.push({ y0: -40, y1: plinthH, mat: pbr(theme.plinth.id, { tile: theme.plinth.tile, color: theme.plinth.color, key: `plinth:${theme.key}` }), z: ZW + 14, tile: theme.plinth.tile });
  const wallMat = pbr(theme.wall.id, { tile: theme.wall.tile, color: theme.wall.color, normal: theme.wall.normal ?? 1, key: `wall:${theme.key}` });
  const stripeMat = theme.stripes ? pbr(theme.wall.id, { tile: theme.wall.tile, color: theme.stripes.color, normal: theme.wall.normal ?? 1, key: `stripe:${theme.key}` }) : null;
  let y = plinthH || -40;
  if (theme.stripes) {
    const st = theme.stripes;
    for (let s = st.every * 0.6; s < top; s += st.every) {
      if (s > y) bands.push({ y0: y, y1: s, mat: wallMat, z: ZW, tile: theme.wall.tile });
      bands.push({ y0: s, y1: Math.min(top, s + st.h), mat: stripeMat, z: ZW, tile: theme.wall.tile });
      y = Math.min(top, s + st.h);
    }
  }
  if (y < top) bands.push({ y0: y, y1: top, mat: wallMat, z: ZW, tile: theme.wall.tile });
  // the monsoon tower changes building every so often
  if (theme.cycle) {
    bands.length = 0;
    const every = 3600;
    for (let b = 0, y0 = -40; y0 < top; b++, y0 += every) {
      const id = theme.cycle[b % theme.cycle.length];
      const tile = id.startsWith('Wood') ? [1500, 1500] : id.startsWith('Plaster') ? [1800, 1800] : id === 'Bricks060' ? [1400, 1400] : [1800, 1800];
      bands.push({ y0, y1: Math.min(top, y0 + every), mat: pbr(id, { tile, color: 0xd0ccc8, key: `cycle:${id}` }), z: ZW, tile });
    }
  }
  for (const b of bands) {
    const g = new Geo();
    wallCells(g, X0, X1, b.y0, b.y1, holes, b.z);
    if (b.z > ZW) {
      // the plinth's top edge
      g.face([[X0, b.y1, b.z], [X1, b.y1, b.z], [X1, b.y1, ZW], [X0, b.y1, ZW]], [0, 1, 0], [[X0, 0], [X1, 0], [X1, 14], [X0, 14]]);
    }
    const m = new THREE.Mesh(g.build(1), b.mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------------------------------------------------------------- the windows themselves
  const frameMat = plain(`frame:${theme.frame}`, { color: theme.frame ?? 0xf1ead9, roughness: 0.55, metalness: 0 });
  const revealGeo = new Geo();
  const frameGeo = new Geo();
  const sillGeo = new Geo();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x3a4650,
    metalness: 1,
    roughness: 0.06,
    normalMap: rainGlassNormal(),
    normalScale: new THREE.Vector2(0.9, 0.9),
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    envMapIntensity: 1.4,
  });
  glassMat.normalMap.repeat.set(1 / 700, 1 / 700);
  const rooms = [];
  for (const w of wins) {
    const { x0, x1, y0, y1 } = w;
    // reveals
    revealGeo.faceAuto([[x0, y0, ZW - REV], [x0, y1, ZW - REV], [x0, y1, ZW], [x0, y0, ZW]], [1, 0, 0], [[0, y0], [0, y1], [REV, y1], [REV, y0]]);
    revealGeo.faceAuto([[x1, y0, ZW], [x1, y1, ZW], [x1, y1, ZW - REV], [x1, y0, ZW - REV]], [-1, 0, 0], [[0, y0], [0, y1], [REV, y1], [REV, y0]]);
    revealGeo.faceAuto([[x0, y1, ZW], [x1, y1, ZW], [x1, y1, ZW - REV], [x0, y1, ZW - REV]], [0, -1, 0], [[x0, 0], [x1, 0], [x1, REV], [x0, REV]]);
    revealGeo.faceAuto([[x0, y0, ZW], [x1, y0, ZW], [x1, y0, ZW - REV], [x0, y0, ZW - REV]], [0, 1, 0], [[x0, 0], [x1, 0], [x1, REV], [x0, REV]]);
    // frame and glazing bars
    const F = w.round ? 0 : 30;
    const zf0 = ZW - 58;
    const zf1 = ZW - 30;
    if (F) {
      frameGeo.box(x0, y0, zf0, x0 + F, y1, zf1);
      frameGeo.box(x1 - F, y0, zf0, x1, y1, zf1);
      frameGeo.box(x0, y1 - F, zf0, x1, y1, zf1);
      frameGeo.box(x0, y0, zf0, x1, y0 + F + 10, zf1);
      const cx = (x0 + x1) / 2;
      if (!w.stained) {
        frameGeo.box(cx - 9, y0, zf0 + 4, cx + 9, y1, zf1 - 4);
        const yb = y0 + (y1 - y0) * (w.tall ? 0.62 : 0.56);
        frameGeo.box(x0, yb - 9, zf0 + 4, x1, yb + 9, zf1 - 4);
        if (w.tall) frameGeo.box(x0, y0 + (y1 - y0) * 0.3 - 10, zf0 + 6, x1, y0 + (y1 - y0) * 0.3 + 10, zf1 - 6);
      }
      if (w.cross) {
        // barn doors: a white X brace across
        const t = 34;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const ang = Math.atan2(dy, dx);
        const len = Math.hypot(dx, dy);
        for (const sgn of [1, -1]) {
          const b = new THREE.BoxGeometry(len, t, 26);
          b.rotateZ(sgn * ang);
          b.translate(cx, (y0 + y1) / 2, ZW - 20);
          const m = new THREE.Mesh(b, frameMat);
          m.castShadow = true;
          group.add(m);
        }
      }
    } else {
      // a porthole: a brass ring round a round pane
      const r = (x1 - x0) / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 14, 18, 12, 40), plain('brass', { color: 0xc8a050, metalness: 1, roughness: 0.3 }));
      ring.position.set((x0 + x1) / 2, (y0 + y1) / 2, ZW + 4);
      ring.castShadow = true;
      group.add(ring);
      // the wall round the circle fills the square hole's corners
      const shape = new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
      const hole = new THREE.Path();
      hole.absarc((x0 + x1) / 2, (y0 + y1) / 2, r - 14, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const sg = new THREE.ShapeGeometry(shape, 24);
      const uv = sg.attributes.uv;
      const pp = sg.attributes.position;
      // world units: the wall material repeats every tile
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i), pp.getY(i));
      sg.translate(0, 0, ZW);
      const ms = new THREE.Mesh(sg, wallMat);
      ms.receiveShadow = true;
      group.add(ms);
    }
    // sill
    if (w.sill) {
      sillGeo.box(x0 - 44, y0 - 40, ZW - 40, x1 + 44, y0 + 4, ZW + 54);
    }
    // the glass
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), glassMat);
    glass.position.set((x0 + x1) / 2, (y0 + y1) / 2, ZW - 44);
    // rain-normal UVs in world units so every pane's drops differ
    const guv = glass.geometry.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, x0 + guv.getX(i) * (x1 - x0), y0 + guv.getY(i) * (y1 - y0));
    glass.renderOrder = 3;
    group.add(glass);
    // the room behind
    rooms.push(roomBox(w, lit));
    for (const r of rooms[rooms.length - 1].meshes) group.add(r);
    // curtains
    if (w.curtains) {
      const ct = curtainTex(w.curtains);
      const cm = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9, emissive: new THREE.Color(w.curtains), emissiveIntensity: 0.18 * lit, emissiveMap: ct });
      for (const s of [-1, 1]) {
        const cw = (x1 - x0) * (0.2 + rnd() * 0.08);
        const c = new THREE.Mesh(new THREE.PlaneGeometry(cw, y1 - y0 - 60), cm);
        c.position.set(s < 0 ? x0 + cw / 2 + 20 : x1 - cw / 2 - 20, (y0 + y1) / 2 + 10, ZW - 90);
        group.add(c);
      }
    }
    // shutters
    if (w.shutters) {
      const st = shutterMat(w.shutters);
      const sw = (x1 - x0) / 2;
      for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(sw, y1 - y0, 10), st);
        sh.position.set(s < 0 ? x0 - sw / 2 - 18 : x1 + sw / 2 + 18, (y0 + y1) / 2, ZW + 8);
        sh.castShadow = true;
        sh.receiveShadow = true;
        group.add(sh);
      }
    }
    // stains under the sill's ends
    const stain = new THREE.MeshBasicMaterial({ map: stainTex(), transparent: true, color: 0x000000, opacity: 0.32, depthWrite: false });
    for (const sx of [x0 - 30, x1 + 30]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(90, 560 + rnd() * 400), stain);
      s.geometry.translate(0, -s.geometry.parameters.height / 2, 0);
      s.position.set(sx, y0 - 40, ZW + 1);
      s.renderOrder = 1;
      group.add(s);
    }
  }
  if (revealGeo.count) {
    const m = new THREE.Mesh(revealGeo.build(1), wallMat);
    m.receiveShadow = true;
    group.add(m);
  }
  if (frameGeo.count) {
    const m = new THREE.Mesh(frameGeo.build(1), frameMat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  if (sillGeo.count) {
    const sm = pbr('Concrete036', { tile: 900, color: 0xe2dccd, key: 'sill' });
    const m = new THREE.Mesh(sillGeo.build(1), sm);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------------------------------------------------------------- the greenhouse's glass wall
  if (theme.glass) group.add(glassWall(level, theme, X0, X1, top, lit));

  // ---------------------------------------------------------------- stains from the gutter
  {
    const stain = new THREE.MeshBasicMaterial({ map: stainTex(), transparent: true, color: 0x000000, opacity: 0.28, depthWrite: false });
    for (let k = 0; k < 7; k++) {
      const x = (rnd() - 0.5) * 3200;
      const h = 600 + rnd() * 1400;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(240 + rnd() * 200, h), stain);
      s.position.set(x, top - h / 2, ZW + 1.2);
      s.renderOrder = 1;
      group.add(s);
    }
  }

  // ---------------------------------------------------------------- ivy
  if (theme.ivy) group.add(ivy(level, theme, wins, rnd));

  // ---------------------------------------------------------------- lamps
  const lamps = [];
  if (theme.time !== 'day') {
    let side = rnd() < 0.5 ? -1 : 1;
    for (let ly = 1100; ly < H - 500; ly += 1500 + rnd() * 500) {
      const lx = clearX(level, side * 420, ly, 90);
      if (lx == null || wins.some((w) => lx > w.x0 - 150 && lx < w.x1 + 150 && ly > w.y0 - 200 && ly < w.y1 + 200)) {
        side = -side;
        continue;
      }
      lamps.push(wallLamp(group, lx, ly));
      side = -side;
    }
  }

  // ---------------------------------------------------------------- signature pieces
  let clock = null;
  if (theme.clock) clock = clockFace(group, level, theme, rnd);
  if (theme.sign) shopSign(group, level, theme);
  if (theme.awning) awning(group, theme, wins);

  // ---------------------------------------------------------------- the ground and what's on it
  const ground = theme.ground;
  {
    const g = new Geo();
    // cut round the drain
    const d = drainHole(level);
    const rect = (ax, az, bx, bz) => g.faceAuto([[ax, -0.6, az], [bx, -0.6, az], [bx, -0.6, bz], [ax, -0.6, bz]], [0, 1, 0], [[ax, az], [bx, az], [bx, bz], [ax, bz]]);
    rect(X0 * 2, ZW, d.x0, 9000);
    rect(d.x1, ZW, X1 * 2, 9000);
    rect(d.x0, ZW, d.x1, d.z0);
    rect(d.x0, d.z1, d.x1, 9000);
    const gm = pbr(ground.id, { tile: ground.tile, color: ground.color, key: `ground:${theme.key}`, normal: 1.2 });
    const m = new THREE.Mesh(g.build(1), gm);
    m.receiveShadow = true;
    m.rotation.x = 0;
    group.add(m);
  }
  const props = buildProps(level, theme, rnd, ZW);
  group.add(props.group);

  // ---------------------------------------------------------------- the roof
  group.add(roof(level, theme, top));

  return {
    group,
    windows: wins,
    lamps,
    update(t, mood) {
      wind.uniforms.time.value = t;
      wind.uniforms.strength.value = 0.5 + (mood?.storm ?? 0) * 1.6;
      const glowK = lit * (1 + (mood?.storm ?? 0) * 0.35);
      for (const r of rooms) r.set(glowK);
      if (clock) clock.update();
      props.update?.(t, mood);
    },
  };
}

// --------------------------------------------------------------------------------------------- placement

function pipeHalfAt(level, y) {
  const s = level.spans.find((q) => y >= q.y0 && y < q.y1) ?? level.spans[level.spans.length - 1];
  // jogs move the centre within the span; use the wider of its two ends
  const c0 = s.cx;
  const c1 = s.exit ?? s.cx;
  return { lo: Math.min(c0, c1) - s.half - WALL_T - 60, hi: Math.max(c0, c1) + s.half + WALL_T + 60 };
}

function pipeBox(level, y0, y1) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = y0; y <= y1; y += 50) {
    const b = pipeHalfAt(level, Math.max(0, Math.min(level.H - 1, y)));
    lo = Math.min(lo, b.lo);
    hi = Math.max(hi, b.hi);
  }
  return { lo, hi };
}

/** An x near `want` clear of the pipe by `margin` at height y, or null. */
function clearX(level, want, y, margin) {
  const b = pipeBox(level, y - 100, y + 100);
  if (want > b.lo - margin && want < b.hi + margin) return want < (b.lo + b.hi) / 2 ? b.lo - margin : b.hi + margin;
  return want;
}

function placeWindows(level, theme, rnd) {
  const f = theme.floors;
  const out = [];
  if (!f) return out;
  const H = level.H;
  const top = H - 400;
  let floor = 0;
  for (let y0 = f.first; y0 + f.h < top; y0 += f.every || Infinity, floor++) {
    for (const xc of f.xs) {
      const y1 = y0 + f.h;
      const pb = pipeBox(level, y0 - 120, y1 + 120);
      let x0 = xc - f.w / 2;
      let x1 = xc + f.w / 2;
      // keep clear of the pipe (and its clips)
      if (xc < 0 && x1 > pb.lo - 60) {
        const d = x1 - (pb.lo - 60);
        x0 -= d;
        x1 -= d;
      }
      if (xc > 0 && x0 < pb.hi + 60) {
        const d = pb.hi + 60 - x0;
        x0 += d;
        x1 += d;
      }
      const v = Math.floor(rnd() * 4);
      const curtains = ['living', 'kitchen', 'flat', 'hall'].includes(f.interior) ? ['#9a3a3a', '#3a5a8a', '#c8a050', '#4a6a3a'][v] : null;
      out.push({
        x0,
        x1,
        y0,
        y1,
        style: f.interior,
        v,
        sill: !!f.sill,
        shutters: f.shutters ?? null,
        curtains,
        stained: !!f.stained,
        round: !!f.round,
        cross: !!f.cross,
        tall: f.h / f.w > 1.6,
        box: f.box ?? null,
      });
    }
    if (!f.every) break;
  }
  return out;
}

// --------------------------------------------------------------------------------------------- wall cells

function wallCells(g, x0, x1, y0, y1, holes, z) {
  const xs = new Set([x0, x1]);
  const ys = new Set([y0, y1]);
  for (const h of holes) {
    if (h.y1 <= y0 || h.y0 >= y1) continue;
    xs.add(Math.max(x0, Math.min(x1, h.x0)));
    xs.add(Math.max(x0, Math.min(x1, h.x1)));
    ys.add(Math.max(y0, Math.min(y1, h.y0)));
    ys.add(Math.max(y0, Math.min(y1, h.y1)));
  }
  const X = [...xs].sort((a, b) => a - b);
  const Y = [...ys].sort((a, b) => a - b);
  for (let j = 0; j < Y.length - 1; j++) {
    // merge runs of solid cells along a row
    let run = null;
    for (let i = 0; i < X.length - 1; i++) {
      const mx = (X[i] + X[i + 1]) / 2;
      const my = (Y[j] + Y[j + 1]) / 2;
      const solid = !holes.some((h) => mx > h.x0 && mx < h.x1 && my > h.y0 && my < h.y1);
      if (solid && run == null) run = X[i];
      if ((!solid || i === X.length - 2) && run != null) {
        const xe = solid ? X[i + 1] : X[i];
        if (xe > run) g.face([[run, Y[j], z], [xe, Y[j], z], [xe, Y[j + 1], z], [run, Y[j + 1], z]], [0, 0, 1], [[run, Y[j]], [xe, Y[j]], [xe, Y[j + 1]], [run, Y[j + 1]]].map(([u, v]) => [u, v]));
        run = null;
      }
    }
  }
}

// --------------------------------------------------------------------------------------------- rooms

function roomBox(w, lit) {
  const { x0, x1, y0, y1 } = w;
  const meshes = [];
  let sideMat = null;
  const pad = 140;
  const zb = ZW - ROOM;
  const tex = w.stained ? stainedTex(w.v) : roomTex(w.style, w.v);
  // the back wall of the room: bigger than the window, so looking in at an angle shows more of it
  const back = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(lit, lit, lit) });
  const bw = x1 - x0 + pad * 2;
  const bh = y1 - y0 + pad * 2;
  if (w.stained) {
    // stained glass sits in the window itself, lit from inside
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), back);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, ZW - 50);
    meshes.push(m);
  } else {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), back);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, zb);
    meshes.push(m);
    // the room's sides, ceiling and floor, dim
    const side = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12 * lit, 0.09 * lit, 0.07 * lit), side: THREE.DoubleSide });
    const g = new Geo();
    const X0 = x0 - pad;
    const X1 = x1 + pad;
    const Y0 = y0 - pad;
    const Y1 = y1 + pad;
    const zf = ZW - REV;
    g.face([[X0, Y0, zf], [X0, Y0, zb], [X0, Y1, zb], [X0, Y1, zf]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    g.face([[X1, Y0, zb], [X1, Y0, zf], [X1, Y1, zf], [X1, Y1, zb]], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    g.face([[X0, Y1, zf], [X0, Y1, zb], [X1, Y1, zb], [X1, Y1, zf]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    g.face([[X0, Y0, zb], [X0, Y0, zf], [X1, Y0, zf], [X1, Y0, zb]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    // and the inside of the wall around the opening
    g.face([[X0, Y0, zf], [X1, Y0, zf], [X1, y0, zf], [X0, y0, zf]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    g.face([[X0, y1, zf], [X1, y1, zf], [X1, Y1, zf], [X0, Y1, zf]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    g.face([[X0, y0, zf], [x0, y0, zf], [x0, y1, zf], [X0, y1, zf]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    g.face([[x1, y0, zf], [X1, y0, zf], [X1, y1, zf], [x1, y1, zf]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    meshes.push(new THREE.Mesh(g.build(1), side));
    sideMat = side;
  }
  return {
    meshes,
    set(k) {
      back.color.setScalar(k);
      if (sideMat) sideMat.color.setRGB(0.12 * k, 0.09 * k, 0.07 * k);
    },
  };
}

const shutterMats = new Map();
function shutterMat(color) {
  let m = shutterMats.get(color);
  if (m) return m;
  const tex = canvasTex(`louvre:${color}`, 128, 256, (ctx, w, h) => {
    const c = new THREE.Color(color);
    ctx.fillStyle = `#${c.getHexString()}`;
    ctx.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(10, y + 8, w - 20, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(10, y, w - 20, 3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  shutterMats.set(color, m);
  return m;
}

// --------------------------------------------------------------------------------------------- greenhouse glass

function glassWall(level, theme, X0, X1, top, lit) {
  const g = new THREE.Group();
  const y0 = theme.glass.from;
  const bars = new Geo();
  const step = 620;
  for (let x = Math.ceil(X0 / step) * step; x <= X1; x += step) bars.box(x - 20, y0, ZW - 30, x + 20, top, ZW + 10);
  for (let yy = y0; yy <= top; yy += 900) bars.box(X0, yy - 18, ZW - 30, X1, yy + 18, ZW + 10);
  const m = new THREE.Mesh(bars.build(1), plain(`frame:${theme.glass.frame}`, { color: theme.glass.frame, roughness: 0.5 }));
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  const tex = roomTex('plants', 0).clone();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set((X1 - X0) / 1400, (top - y0) / 1400);
  tex.needsUpdate = true;
  const plants = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, top - y0), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(lit * 0.9, lit, lit * 0.9) }));
  plants.position.set((X0 + X1) / 2, (y0 + top) / 2, ZW - 260);
  g.add(plants);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0, top - y0),
    new THREE.MeshStandardMaterial({ color: 0x4a5a5a, metalness: 1, roughness: 0.08, normalMap: rainGlassNormal(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glass.position.set((X0 + X1) / 2, (y0 + top) / 2, ZW - 6);
  glass.renderOrder = 3;
  g.add(glass);
  // a misty sheen of condensation
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, top - y0), new THREE.MeshBasicMaterial({ color: 0xcfe8e0, transparent: true, opacity: 0.12, depthWrite: false }));
  mist.position.set((X0 + X1) / 2, (y0 + top) / 2, ZW - 8);
  g.add(mist);
  return g;
}

// --------------------------------------------------------------------------------------------- ivy

function ivy(level, theme, wins, rnd) {
  const g = new THREE.Group();
  const cfg = theme.ivy;
  const leaves = [];
  const stems = [];
  const inWin = (x, y) => wins.some((w) => x > w.x0 - 40 && x < w.x1 + 40 && y > w.y0 - 80 && y < w.y1 + 40);
  for (let v = 0; v < cfg.n; v++) {
    let x = (rnd() < 0.5 ? -1 : 1) * (260 + rnd() * 1100);
    let y = 0;
    let dir = (rnd() - 0.5) * 0.6;
    const maxY = 900 + rnd() * Math.min(level.H * 0.8, 5000);
    const pts = [new THREE.Vector3(x, y, ZW + 6)];
    let branchAt = 300 + rnd() * 400;
    while (y < maxY) {
      dir += (rnd() - 0.5) * 0.5;
      dir = Math.max(-0.9, Math.min(0.9, dir));
      let nx = x + Math.sin(dir) * 28;
      const ny = y + Math.cos(dir) * 28;
      if (inWin(nx, ny)) {
        nx = x + (rnd() < 0.5 ? -40 : 40);
        dir = -dir;
      }
      x = nx;
      y = ny;
      pts.push(new THREE.Vector3(x, y, ZW + 6 + rnd() * 6));
      // leaves along the vine, alternating, bigger near the bottom
      const n = 2;
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 1 : -1;
        const size = (30 + rnd() * 26) * (1.25 - (y / maxY) * 0.4);
        leaves.push({ x: x + side * (10 + rnd() * 16), y: y + (rnd() - 0.5) * 20, z: ZW + 10 + rnd() * 22, s: size, r: side * (0.4 + rnd() * 0.7), t: rnd() * 0.6 - 0.3, c: rnd() });
      }
      if (y > branchAt) {
        branchAt += 500 + rnd() * 500;
        dir += rnd() < 0.5 ? 0.7 : -0.7;
      }
    }
    stems.push(pts);
  }
  // stems
  const stemMat = plain('ivyStem', { color: 0x5a4632, roughness: 0.9 });
  for (const pts of stems) {
    if (pts.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 3, 5, false), stemMat);
    tube.castShadow = true;
    g.add(tube);
  }
  // leaves (instanced, swaying)
  const geo = new THREE.PlaneGeometry(1, 1, 1, 2);
  geo.translate(0, 0.5, 0);
  const mat = windMaterial(
    new THREE.MeshStandardMaterial({ map: ivyLeafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, color: 0xffffff }),
    1,
  );
  const im = new THREE.InstancedMesh(geo, mat, leaves.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const base = new THREE.Color(cfg.color);
  const col = new THREE.Color();
  leaves.forEach((l, i) => {
    e.set(-0.5 + l.t, l.t * 0.5, l.r);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(l.x, l.y, l.z), q, new THREE.Vector3(l.s, l.s, l.s));
    im.setMatrixAt(i, m4);
    col.copy(base).offsetHSL((l.c - 0.5) * 0.06, (l.c - 0.5) * 0.2, (l.c - 0.5) * 0.18);
    im.setColorAt(i, col);
  });
  im.castShadow = true;
  im.receiveShadow = true;
  g.add(im);
  // flowers among them
  if (cfg.flowers > 0) {
    const fl = leaves.filter(() => rnd() < cfg.flowers * 0.25);
    const fg = new THREE.IcosahedronGeometry(14, 0);
    const fm = new THREE.MeshStandardMaterial({ color: cfg.flower ?? 0xff6f8f, roughness: 0.6, emissive: new THREE.Color(cfg.flower ?? 0xff6f8f), emissiveIntensity: 0.08 });
    const fi = new THREE.InstancedMesh(fg, fm, fl.length);
    fl.forEach((l, i) => {
      m4.compose(new THREE.Vector3(l.x + 10, l.y + 20, l.z + 14), q.identity(), new THREE.Vector3(1, 1, 0.6));
      fi.setMatrixAt(i, m4);
    });
    g.add(fi);
  }
  return g;
}

// --------------------------------------------------------------------------------------------- lamps, clock, sign, awning

function wallLamp(group, x, y) {
  const g = new THREE.Group();
  const iron = plain('lampIron', { color: 0x1c1d20, metalness: 0.8, roughness: 0.45 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(90, 150, 14), iron);
  plate.position.set(0, 0, 7);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 140, 8), iron);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 30, 75);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(70, 50, 6), iron);
  cap.position.set(0, 70, 150);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(52, 40, 90, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.1, 1.0), side: THREE.DoubleSide }));
  glass.position.set(0, 0, 150);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(20, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 6, 3) }));
  bulb.position.set(0, 4, 150);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(44, 30, 18, 6), iron);
  base.position.set(0, -52, 150);
  g.add(plate, arm, cap, glass, bulb, base);
  for (const c of g.children) c.castShadow = c !== glass && c !== bulb;
  g.position.set(x, y, ZW);
  g.scale.setScalar(0.62);
  group.add(g);
  return { x, y: y, z: ZW + 93 };
}

function clockFace(group, level, theme, rnd) {
  const r = 250;
  const y = level.H + theme.clock.y;
  const x = clearX(level, theme.clock.side * 640, y, r + 60);
  const face = canvasTex('clockFace', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f1e9d6';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#2a2420';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    R.forEach((t, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(w / 2 + Math.cos(a) * (w / 2 - 80), h / 2 + Math.sin(a) * (w / 2 - 80));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(t, 0, 0);
      ctx.restore();
    });
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      ctx.fillRect(w / 2 + Math.cos(a) * (w / 2 - 44) - 2, h / 2 + Math.sin(a) * (w / 2 - 44) - 2, 4, 4);
    }
  });
  const g = new THREE.Group();
  g.position.set(x, y, ZW + 30);
  const surround = new THREE.Mesh(new THREE.TorusGeometry(r + 20, 34, 12, 48), pbr('Bricks076A', { tile: 900, color: 0xe8e2d4, key: 'clockStone' }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6, emissive: new THREE.Color(1, 0.95, 0.85), emissiveMap: face, emissiveIntensity: 0.25 }));
  disc.position.z = 6;
  const handMat = plain('clockHand', { color: 0x1a1612, metalness: 0.6, roughness: 0.4 });
  const hour = new THREE.Mesh(new THREE.BoxGeometry(26, r * 0.55, 8), handMat);
  hour.geometry.translate(0, r * 0.22, 0);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(16, r * 0.82, 8), handMat);
  minute.geometry.translate(0, r * 0.36, 0);
  hour.position.z = 14;
  minute.position.z = 22;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 12, 16), handMat);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 28;
  for (const m of [surround, hour, minute, pin]) m.castShadow = true;
  g.add(surround, disc, hour, minute, pin);
  group.add(g);
  return {
    update() {
      const d = new Date();
      const mins = d.getMinutes() + d.getSeconds() / 60;
      const hrs = (d.getHours() % 12) + mins / 60;
      minute.rotation.z = -(mins / 60) * Math.PI * 2;
      hour.rotation.z = -(hrs / 12) * Math.PI * 2;
    },
  };
}

function shopSign(group, level, theme) {
  const s = theme.sign;
  const y = s.y;
  const x = clearX(level, s.side * 600, y, 420);
  const tex = canvasTex(`sign:${s.text}`, 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = s.ink;
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = s.ink;
    ctx.font = 'bold 150px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.text, w / 2, h / 2 + 8);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(760, 190, 30), [
    plain('signEdge', { color: 0x3a1a16, roughness: 0.6 }),
    plain('signEdge', {}),
    plain('signEdge', {}),
    plain('signEdge', {}),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1, emissive: new THREE.Color(1, 0.8, 0.5), emissiveMap: tex, emissiveIntensity: 0.25 }),
    plain('signEdge', {}),
  ]);
  board.position.set(x, y, ZW + 26);
  board.castShadow = true;
  group.add(board);
}

function awning(group, theme, wins) {
  const a = theme.awning;
  const w = wins.find((q) => Math.sign((q.x0 + q.x1) / 2) === a.side) ?? wins[0];
  if (!w) return;
  const tex = canvasTex(`awning:${a.color}`, 512, 256, (ctx, W, H) => {
    for (let x = 0; x < W; x += 64) {
      ctx.fillStyle = (x / 64) % 2 ? a.alt : a.color;
      ctx.fillRect(x, 0, 64, H);
    }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
  const width = w.x1 - w.x0 + 160;
  const depth = 380;
  const geo = new THREE.PlaneGeometry(width, depth, 1, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) / depth + 0.5; // 0 at the outer edge, 1 at the wall
    p.setZ(i, (1 - v) * depth * 0.95 - Math.sin(v * Math.PI) * 30);
    p.setY(i, v * 200);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
  m.position.set((w.x0 + w.x1) / 2, w.y1 + 40, ZW);
  m.castShadow = true;
  group.add(m);
  // the scalloped valance hanging from the front edge
  const val = canvasTex(`valance:${a.color}`, 512, 64, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    for (let x = 0; x < W; x += 64) {
      ctx.fillStyle = (x / 64) % 2 ? a.alt : a.color;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 64, 0);
      ctx.lineTo(x + 64, H * 0.5);
      ctx.arc(x + 32, H * 0.5, 32, 0, Math.PI);
      ctx.fill();
    }
  });
  const vm = new THREE.Mesh(new THREE.PlaneGeometry(width, 70), new THREE.MeshStandardMaterial({ map: val, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }));
  vm.position.set((w.x0 + w.x1) / 2, w.y1 + 40 - 35, ZW + depth * 0.95);
  group.add(vm);
}

// --------------------------------------------------------------------------------------------- the roof

function roof(level, theme, top) {
  const g = new THREE.Group();
  const H = level.H;
  const fasciaMat = plain(`fascia:${theme.fascia}`, { color: theme.fascia, roughness: 0.6 });
  // the eave sits low over the gutter: the roof starts just behind the spiders at the top
  const EAVE = H + 80;
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(12000, EAVE - (H - 130), 36), fasciaMat);
  fascia.position.set(0, (EAVE + H - 130) / 2, -D2 - WALL_T - 22);
  fascia.receiveShadow = true;
  g.add(fascia);
  // soffit under the eaves
  // (it stops behind the pipe's back: it must never show inside the cut-open pipe)
  const soffitBack = -D2 - WALL_T - 1;
  const soffit = new THREE.Mesh(new THREE.BoxGeometry(12000, 20, soffitBack - (ZW - 40)), fasciaMat);
  soffit.position.set(0, top, (soffitBack + ZW - 40) / 2);
  g.add(soffit);
  const pitch = THREE.MathUtils.degToRad(theme.roof?.glass ? 24 : 30);
  // a short pitch up to a ridge, so the sky and the sun are right there above the gutter when you reach the top
  const len = 500;
  const rt = theme.roof.tile;
  const tiles = pbr(theme.roof.id, { tile: rt, color: theme.roof.color, normal: 1.4, env: 0.3, key: `roof:${theme.key}` });
  const geo = new THREE.PlaneGeometry(12000, len);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12000, uv.getY(i) * len); // world units: the material repeats every tile
  geo.translate(0, len / 2, 0);
  const plane = new THREE.Mesh(geo, tiles);
  plane.rotation.x = -(Math.PI / 2 - pitch);
  plane.position.set(0, EAVE, -D2 - WALL_T - 10);
  plane.receiveShadow = true;
  plane.castShadow = true;
  g.add(plane);
  // the tiles' front edge: a thick lip
  // (UVs in world units, so its faces show tiles rather than one stretched texel)
  const lipGeo = new Geo();
  lipGeo.box(-6000, EAVE - 15, -D2 - WALL_T - 25, 6000, EAVE + 25, -D2 - WALL_T + 65);
  const lip = new THREE.Mesh(lipGeo.build(1), tiles);
  lip.castShadow = true;
  g.add(lip);
  // the ridge: a row of round capping tiles along the top, the far slope falling away behind it
  const rx = EAVE + Math.sin(pitch) * len;
  const rz = -D2 - WALL_T - 10 - Math.cos(pitch) * len;
  const capMat = plain(`ridge:${theme.key}`, { color: new THREE.Color(theme.roof.color).multiplyScalar(0.6), roughness: 0.8 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 12000, 16), capMat);
  cap.rotation.z = Math.PI / 2; // along the ridge, sitting over the join of the two slopes
  cap.position.set(0, rx - 4, rz);
  cap.castShadow = true;
  g.add(cap);
  const back = new THREE.Mesh(geo.clone(), tiles);
  back.rotation.x = -(Math.PI / 2 + pitch);
  back.position.set(0, rx, rz);
  g.add(back);
  return g;
}
