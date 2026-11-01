// The downpipe in 3D, made from the level so what you see is exactly what you stand on: the side walls (the 2D chain extruded
// through the pipe's depth, cut open down the front so the bright metal edge shows), the back plate, collars and clips,
// straps, branch stubs, the rain-head, the twigs and leaves wedged across, bolts for silk, moss, vents, the bird's seam,
// old cobwebs in every dry spot, the drain at the foot and the gutter at the top.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Geo, offsetLine, cumLen } from './geo.js';
import { pbr, plain, canvasTex, rand } from './tex.js';
import { zincMat, edgeMat } from './zinc.js';
import { DEPTH, WALL_T, RING_H } from '../sim/config.js';

export const D2 = DEPTH / 2;

/** The wall's inner surface points from the bottom up to the gutter floor. */
function trimTop(pts, H) {
  const out = [];
  for (const p of pts) {
    out.push(p);
    if (p[1] >= H - 1e-6) break;
  }
  return out;
}

export function buildPipe(level, theme = {}) {
  const group = new THREE.Group();
  group.name = 'pipe';
  const H = level.H;
  const rnd = rand(Math.round(H) * 31 + level.pieces.length);
  const zinc = zincMat();
  const zincWall = zincMat({ key: 'zincWall', along: true, vertexColors: true, color: new THREE.Color(1.15, 1.2, 1.25) });
  const zincIn = zincMat({ key: 'zincIn', metal: 0.55, rough: 0.8, color: new THREE.Color(0.6, 0.66, 0.72), env: 0.8 });
  const edge = plain('zincEdge', { color: 0xe8eef0, metalness: 1, roughness: 0.28, envMapIntensity: 1.4 });
  // painted iron, half worn through: lit like paint where it holds, metal where it doesn't
  const iron = pbr('MetalPlates013', { tile: 220, metal: 0.55, rough: 0.85, color: 0x9c9189, env: 1, key: 'pipeIron' });

  const leftIn = trimTop(level.left, H);
  const rightIn = trimTop(level.right, H);
  const leftOut = offsetLine(leftIn, WALL_T);
  const rightOut = offsetLine(rightIn, -WALL_T);

  // ---- side walls
  const walls = new Geo(true);
  const edges = new Geo(true);
  // across the cut edge, from the inside out: a bright rolled bead, the dull cut face, a darker outer lip
  const EDGE = [
    [0, 3.5, [1.25, 1.28, 1.3, 1], [1.0, 1.03, 1.05, 1]],
    [3.5, WALL_T - 3, [0.62, 0.65, 0.68, 1], [0.55, 0.58, 0.61, 1]],
    [WALL_T - 3, WALL_T, [0.42, 0.44, 0.46, 1], [0.3, 0.31, 0.33, 1]],
  ];
  const AO0 = [0.36, 0.38, 0.42, 1];
  const AO1 = [0.86, 0.87, 0.88, 1];
  const ONE = [1, 1, 1, 1];
  function wall(inn, out, inward) {
    const ci = cumLen(inn);
    const co = cumLen(out);
    for (let i = 0; i < inn.length - 1; i++) {
      const a = inn[i];
      const b = inn[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      // inward normal: left of travel for the right wall, right of travel for the left wall
      const nx = (inward * -dy) / l;
      const ny = (inward * dx) / l;
      const zm = -D2 + 34;
      walls.faceAuto([[a[0], a[1], -D2], [b[0], b[1], -D2], [b[0], b[1], zm], [a[0], a[1], zm]], [nx, ny, 0], [[ci[i], -D2], [ci[i + 1], -D2], [ci[i + 1], zm], [ci[i], zm]], [AO0, AO0, AO1, AO1]);
      walls.faceAuto([[a[0], a[1], zm], [b[0], b[1], zm], [b[0], b[1], D2], [a[0], a[1], D2]], [nx, ny, 0], [[ci[i], zm], [ci[i + 1], zm], [ci[i + 1], D2], [ci[i], D2]], [AO1, AO1, ONE, ONE]);
      // outer face
      const oa = out[i];
      const ob = out[i + 1];
      walls.faceAuto([[oa[0], oa[1], -D2 - WALL_T], [ob[0], ob[1], -D2 - WALL_T], [ob[0], ob[1], D2], [oa[0], oa[1], D2]], [-nx, -ny, 0], [[co[i], -D2], [co[i + 1], -D2], [co[i + 1], D2], [co[i], D2]], [AO1, AO1, ONE, ONE]);
    }
    // the cut edge at the front, in three strips
    for (const [d0, d1, c0, c1] of EDGE) {
      const i0 = d0 ? offsetLine(inn, -inward * d0) : inn;
      const i1 = offsetLine(inn, -inward * d1);
      for (let i = 0; i < inn.length - 1; i++) {
        const p = i0[i];
        const q = i0[i + 1];
        const u = i1[i + 1];
        const v = i1[i];
        edges.faceAuto([[p[0], p[1], D2], [q[0], q[1], D2], [u[0], u[1], D2], [v[0], v[1], D2]], [0, 0, 1], [[p[0], p[1]], [q[0], q[1]], [u[0], u[1]], [v[0], v[1]]], [c0, c0, c1, c1]);
      }
    }
    // bottom end
    const a = inn[0];
    const o = out[0];
    walls.faceAuto([[a[0], a[1], -D2 - WALL_T], [o[0], o[1], -D2 - WALL_T], [o[0], o[1], D2], [a[0], a[1], D2]], [0, -1, 0], [[a[0], -D2], [o[0], -D2], [o[0], D2], [a[0], D2]], [ONE, ONE, ONE, ONE]);
  }
  wall(leftIn, leftOut, -1);
  wall(rightIn, rightOut, 1);
  const wallMesh = new THREE.Mesh(walls.build(420), zincWall);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  const edgeMesh = new THREE.Mesh(edges.build(1), edgeMat());
  edgeMesh.receiveShadow = true;
  group.add(wallMesh, edgeMesh);

  // ---- back plate (inside face), and the shadow in the corners where it meets the walls
  const back = new Geo();
  const outline = [...leftOut, ...rightOut.slice().reverse()];
  back.poly(outline, -D2, 1);
  const backMesh = new THREE.Mesh(back.build(420), zincIn);
  backMesh.receiveShadow = true;
  group.add(backMesh);

  const ao = new Geo(true);
  const aoStrip = (inn, inward, width, z, a0) => {
    const off = offsetLine(inn, inward * width);
    for (let i = 0; i < inn.length - 1; i++) {
      const p = inn[i];
      const q = inn[i + 1];
      const r = off[i + 1];
      const s = off[i];
      const c0 = [0, 0, 0, a0];
      const c1 = [0, 0, 0, 0];
      ao.faceAuto([[p[0], p[1], z], [q[0], q[1], z], [r[0], r[1], z], [s[0], s[1], z]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], [c0, c0, c1, c1]);
    }
  };
  // left wall: inward is the right of travel (negative left-normal offset)
  aoStrip(leftIn, -1, 46, -D2 + 0.5, 0.62);
  aoStrip(rightIn, 1, 46, -D2 + 0.5, 0.62);
  const aoMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const aoMesh = new THREE.Mesh(ao.build(1), aoMat);
  aoMesh.renderOrder = 1;
  group.add(aoMesh);

  // ---- features
  const dark = new Geo();
  const bright = new Geo();
  const rivetGeo = new THREE.SphereGeometry(3.2, 10, 6);
  const rivets = [];
  const span = (y) => level.spans.find((s) => y >= s.y0 && y < s.y1) ?? level.spans[level.spans.length - 1];
  for (const f of level.features) {
    if (f.kind === 'ring') {
      // the collar: a band proud of the outer walls, with rivets on the front
      const sp = span(f.y + 1);
      const half = sp.half;
      for (const s of [-1, 1]) {
        const wx = f.x + s * (half + WALL_T);
        const x0 = s < 0 ? wx - 7 : wx - 2;
        const x1 = s < 0 ? wx + 2 : wx + 7;
        bright.box(x0, f.y - 3, -D2 - WALL_T - 2, x1, f.y + RING_H + 3, D2 + 1.5);
        rivets.push([wx - s * 6, f.y + RING_H / 2, D2 + 1.5]);
      }
    } else if (f.kind === 'bracket') {
      const s = f.side === 'L' ? -1 : 1;
      const sp = span(f.y);
      const wx = f.x + s * sp.half;
      const tip = wx - s * f.len;
      const xa = Math.min(wx, tip) - 1;
      const xb = Math.max(wx, tip) + 1;
      dark.box(xa, f.y - 1, -D2 - 1, xb, f.y + 13, D2 + 1);
      rivets.push([tip + s * 14, f.y + 6, D2 + 1.5], [tip + s * 44, f.y + 6, D2 + 1.5]);
    } else if (f.kind === 'alcove') {
      const s = f.side === 'L' ? -1 : 1;
      const sp = span(f.y + 1);
      const backX = f.x + s * (sp.half + f.w);
      // the stub's cap, a disc of darker metal across its end
      const xa = s < 0 ? backX - WALL_T - 8 : backX + WALL_T - 2;
      dark.box(xa, f.y - WALL_T - 6, -D2 - WALL_T, xa + 10, f.y + f.hh + WALL_T + 6, D2 + 2);
    } else if (f.kind === 'hopper') {
      const top = f.y + f.flare + f.inner;
      for (const s of [-1, 1]) {
        const wx = f.x + s * (f.w + WALL_T);
        bright.box(Math.min(wx, wx + s * 9), top - 12, -D2 - WALL_T - 3, Math.max(wx, wx + s * 9), top + 6, D2 + 2);
        bright.box(Math.min(wx, wx + s * 9), f.y + f.flare - 6, -D2 - WALL_T - 3, Math.max(wx, wx + s * 9), f.y + f.flare + 6, D2 + 2);
      }
    }
  }
  // clips holding the pipe to the wall, every so often on straight runs
  for (let y = 380; y < H - 200; y += 900 + Math.floor(rnd() * 300)) {
    const sp = span(y);
    if (sp.k !== 'straight' && sp.k !== 'start') continue;
    for (const s of [-1, 1]) {
      const wx = sp.cx + s * (sp.half + WALL_T);
      const x0 = s < 0 ? wx - 4 : wx;
      dark.box(x0, y, -D2 - WALL_T, x0 + 4, y + 26, D2 * 0.2);
      // the ear: a strap back to the wall (the pipe stands off it) and a plate screwed on
      const zWall = -D2 - WALL_T - 36;
      const ex = s < 0 ? wx - 34 : wx;
      dark.box(ex, y + 4, zWall, ex + 34, y + 22, -D2 - WALL_T);
      const px = s < 0 ? wx - 44 : wx + 4;
      dark.box(px, y - 4, zWall, px + 40, y + 30, zWall + 4);
      rivets.push([px + 20, y + 13, zWall + 5]);
    }
  }
  if (dark.count) {
    const m = new THREE.Mesh(dark.build(1), iron);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  if (bright.count) {
    const m = new THREE.Mesh(bright.build(420), zinc);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  if (rivets.length) {
    const im = new THREE.InstancedMesh(rivetGeo, edge, rivets.length);
    const m4 = new THREE.Matrix4();
    rivets.forEach((r, i) => im.setMatrixAt(i, m4.makeTranslation(r[0], r[1], r[2])));
    im.castShadow = true;
    group.add(im);
  }

  // ---- islands: twigs and leaves wedged across the pipe
  for (const isl of level.islands) group.add(islandMesh(isl, rnd));

  // ---- bolts for silk
  group.add(boltMeshes(level.snags));

  // ---- moss, vents, the bird's seam
  for (const f of level.features) {
    if (f.kind === 'moss') group.add(mossMesh(level, f, rnd));
    else if (f.kind === 'vent') group.add(ventMesh(level, f));
    else if (f.kind === 'seam') group.add(seamMesh(level, f));
  }

  // ---- cobwebs in the dry spots
  group.add(cobwebs(level, rnd));

  // ---- drain grate at the foot and the gutter at the top
  group.add(drainMesh(level));
  group.add(gutterMesh(level, theme));

  return { group, outline: { leftIn, rightIn, leftOut, rightOut } };
}

// ------------------------------------------------------------------------------------------------ islands

function islandMesh(isl, rnd) {
  const g = new THREE.Group();
  const a = (isl.tilt * Math.PI) / 180;
  g.position.set(isl.x, isl.y, 0);
  g.rotation.z = a;
  if (isl.kind === 'leaf') {
    const leafMat = leafMaterial(Math.floor(rnd() * 3));
    const geo = leafGeometry(isl.len * 1.08, DEPTH * 1.12, isl.t, rnd);
    const m = new THREE.Mesh(geo, leafMat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return g;
  }
  // twigs: three or four sticks jammed front to back, crossing a little, a few side shoots and a leaf caught in them
  const bark = pbr('WoodSiding008', { tile: [60, 180], rough: 1, color: 0xa07a58, normal: 1.4, key: 'bark' });
  const n = Math.max(2, Math.min(4, Math.round(isl.len / 30)));
  const step = isl.len / n;
  for (let k = 0; k < n; k++) {
    const r = (isl.t / 2) * (0.62 + rnd() * 0.3);
    const len = DEPTH + 30 + rnd() * 50;
    const geo = twigGeometry(r, len, rnd);
    const m = new THREE.Mesh(geo, bark);
    m.position.set(-isl.len / 2 + step * (k + 0.5) + (rnd() - 0.5) * step * 0.3, (isl.t / 2 - r) * 0.3 - r * 0.2, (rnd() - 0.5) * 20);
    m.rotation.set(Math.PI / 2, 0, (k % 2 ? 1 : -1) * (0.12 + rnd() * 0.22));
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    // a side shoot or two
    for (let j = 0; j < 2; j++) {
      if (rnd() < 0.45) continue;
      const sr = r * 0.4;
      const sl = 14 + rnd() * 22;
      const shoot = new THREE.Mesh(twigGeometry(sr, sl, rnd), bark);
      const along = (rnd() - 0.5) * DEPTH * 0.8;
      const side = rnd() < 0.5 ? -1 : 1;
      shoot.position.set(m.position.x + side * (r + sl * 0.35), m.position.y + r * 0.6, m.position.z + along);
      shoot.rotation.set(0, 0, side * (0.9 + rnd() * 0.5));
      shoot.castShadow = true;
      g.add(shoot);
    }
  }
  // a dead leaf snagged across the top
  if (rnd() < 0.7) {
    const leafMat = leafMaterial(1 + Math.floor(rnd() * 2));
    const leaf = new THREE.Mesh(leafGeometry(isl.len * 0.45, isl.len * 0.75, 4, rnd), leafMat);
    leaf.position.set((rnd() - 0.5) * isl.len * 0.4, isl.t / 2 - 1, (rnd() - 0.5) * 30);
    leaf.rotation.y = (rnd() - 0.5) * 2.4;
    leaf.rotation.z = (rnd() - 0.5) * 0.2;
    leaf.receiveShadow = true;
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

function twigGeometry(r, len, rnd) {
  const geo = new THREE.CylinderGeometry(r * 0.82, r, len, 9, 6, false);
  const p = geo.attributes.position;
  const bend = (rnd() - 0.5) * 8;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / len;
    p.setX(i, p.getX(i) + bend * (1 - 4 * y * y));
    const ang = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 + 0.08 * Math.sin(ang * 3 + y * 20);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  // UVs in units: round the stick and along it
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r * 3, uv.getY(i) * len * 1.2);
  return geo;
}

function leafGeometry(w, l, t, rnd) {
  // a leaf lying flat (its length along z), thick enough to stand on, its edges curling up a little
  const seg = 18;
  const geo = new THREE.PlaneGeometry(w, l, 8, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const v = z / l + 0.5; // 0..1 along
    const width = Math.max(0, Math.sin(Math.PI * Math.max(0, Math.min(1, v * 1.05)))) ** 0.8 * (w / 2);
    const u = x / (w / 2);
    p.setX(i, u * width);
    p.setY(i, t / 2 - 2 + Math.abs(u) ** 2 * 7 - Math.sin(v * Math.PI) * 2 + (rnd() - 0.5) * 0.6);
  }
  geo.computeVertexNormals();
  return geo;
}

const leafMats = [];
function leafMaterial(k) {
  if (leafMats[k]) return leafMats[k];
  const palettes = [
    ['#6f8f3c', '#a7c45a', '#3e5a22'],
    ['#c47a2c', '#e8b04a', '#7a3f16'],
    ['#9c3b25', '#d36b3a', '#5a1d12'],
  ];
  const [mid, hi, lo] = palettes[k];
  const tex = canvasTex(`leaf${k}`, 256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, lo);
    g.addColorStop(0.5, mid);
    g.addColorStop(1, lo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = hi;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let y = 18; y < h; y += 26) {
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.quadraticCurveTo(w * 0.3, y - 8, 4, y - 30);
      ctx.moveTo(w / 2, y);
      ctx.quadraticCurveTo(w * 0.7, y - 8, w - 4, y - 30);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = i % 2 ? lo : hi;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  leafMats[k] = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color(hi), side: THREE.DoubleSide, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  return leafMats[k];
}

// ------------------------------------------------------------------------------------------------ bolts, moss, vents, seams

function boltMeshes(snags) {
  const g = new THREE.Group();
  if (!snags.length) return g;
  const head = new THREE.CylinderGeometry(7.5, 7.5, 6, 6);
  head.rotateX(Math.PI / 2);
  const washer = new THREE.CylinderGeometry(11, 11, 2, 18);
  washer.rotateX(Math.PI / 2);
  const shiny = plain('bolt', { color: 0xd8dde0, metalness: 1, roughness: 0.25, envMapIntensity: 1.6 });
  const rust = plain('boltRust', { color: 0x6a4a36, metalness: 0.6, roughness: 0.7 });
  const ih = new THREE.InstancedMesh(head, shiny, snags.length);
  const iw = new THREE.InstancedMesh(washer, rust, snags.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  snags.forEach((sn, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (sn.id * 0.7) % 1);
    ih.setMatrixAt(i, m4.compose(new THREE.Vector3(sn.x, sn.y, -D2 + 5), q, s));
    iw.setMatrixAt(i, m4.compose(new THREE.Vector3(sn.x, sn.y, -D2 + 1), q, s));
  });
  ih.castShadow = true;
  g.add(ih, iw);
  return g;
}

function mossMesh(level, f, rnd) {
  const g = new THREE.Group();
  const moss = pbr('Moss002', { tile: 140, rough: 1, color: 0x9bc070, normal: 1.6, key: 'mossWall' });
  const s = f.side === 'L' ? -1 : 1;
  const geo = new Geo();
  const step = 20;
  for (let y = f.y0; y < f.y1; y += step) {
    const y1 = Math.min(f.y1, y + step);
    const x0 = wallXAt(level, f.side, y) - s * 1.2;
    const x1 = wallXAt(level, f.side, y1) - s * 1.2;
    // the patch thins out at its ends and towards the front
    const ends = Math.min(1, (y - f.y0) / 60, (f.y1 - y1) / 60);
    const zf = -D2 + (DEPTH - 6) * (0.55 + 0.45 * Math.max(0, ends));
    geo.faceAuto([[x0, y, -D2], [x1, y1, -D2], [x1, y1, zf], [x0, y, zf]], [-s, 0, 0], [[y, -D2], [y1, -D2], [y1, zf], [y, zf]]);
  }
  const m = new THREE.Mesh(geo.build(1), moss);
  m.receiveShadow = true;
  g.add(m);
  // cushions of moss along the wall, spilling onto the cut edge and the back plate
  const n = Math.round((f.y1 - f.y0) / 2.2);
  const cushion = new THREE.SphereGeometry(1, 10, 7);
  {
    const p = cushion.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 + 0.18 * Math.sin(x * 7 + y * 5) + 0.12 * Math.cos(z * 9 - y * 4);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    cushion.computeVertexNormals();
  }
  const mt = pbr('Moss002', { tile: 1, rough: 1, color: 0xffffff, normal: 1.2, key: 'mossCushion' });
  const cm = new THREE.MeshPhysicalMaterial({ map: mt.map, normalMap: mt.normalMap, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0xc8e890), sheenRoughness: 0.7, color: 0xffffff });
  const im = new THREE.InstancedMesh(cushion, cm, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const greens = [0x5f8a2c, 0x7aa03a, 0x4a7024, 0x8fae4a, 0x6a8f30];
  for (let i = 0; i < n; i++) {
    const y = f.y0 + 6 + rnd() * (f.y1 - f.y0 - 12);
    const ends = Math.min(1, (y - f.y0) / 50, (f.y1 - y) / 50);
    const wx = wallXAt(level, f.side, y);
    const r = (5 + rnd() * 9) * (0.55 + 0.45 * ends);
    const where = rnd();
    let pos;
    let sc;
    if (where < 0.7) {
      // on the inner face, bulging into the pipe
      pos = new THREE.Vector3(wx - s * r * 0.25, y, -D2 + rnd() * DEPTH);
      sc = new THREE.Vector3(r * 0.45, r, r * 1.1);
    } else if (where < 0.88) {
      // over the cut edge at the front
      pos = new THREE.Vector3(wx + s * rnd() * WALL_T, y, D2 + r * 0.15);
      sc = new THREE.Vector3(r, r, r * 0.4);
    } else {
      // creeping onto the back plate
      pos = new THREE.Vector3(wx - s * rnd() * 30, y, -D2 + r * 0.1);
      sc = new THREE.Vector3(r, r * 0.9, r * 0.35);
    }
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd() * 6.28);
    im.setMatrixAt(i, m4.compose(pos, q, sc));
    col.set(greens[Math.floor(rnd() * greens.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.1);
    im.setColorAt(i, col);
  }
  im.receiveShadow = true;
  g.add(im);
  return g;
}

function ventMesh(level, f) {
  const g = new THREE.Group();
  const s = f.side === 'L' ? -1 : 1;
  const x = wallXAt(level, f.side, f.y + 20) - s * 40;
  const grille = new Geo();
  for (let k = 0; k < 6; k++) grille.box(x - 34, f.y + 4 + k * 9, -D2, x + 34, f.y + 8 + k * 9, -D2 + 4);
  grille.box(x - 40, f.y, -D2, x - 34, f.y + 60, -D2 + 6);
  grille.box(x + 34, f.y, -D2, x + 40, f.y + 60, -D2 + 6);
  const m = new THREE.Mesh(grille.build(60), plain('vent', { color: 0x4a3a30, metalness: 0.8, roughness: 0.55 }));
  g.add(m);
  // a warm glow behind the slats
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(68, 56), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.35), transparent: true, opacity: 0.85 }));
  glow.position.set(x, f.y + 30, -D2 + 0.6);
  g.add(glow);
  return g;
}

function seamMesh(level, f) {
  const g = new THREE.Group();
  const s = f.side === 'L' ? -1 : 1;
  const x = wallXAt(level, f.side, f.y);
  // a split in the wall: a dark slot through it, with bent metal lips
  const slot = new Geo();
  slot.box(x - (s < 0 ? WALL_T + 2 : -2), f.y - 26, -30, x + (s < 0 ? 2 : WALL_T + 2), f.y + 26, 30);
  const m = new THREE.Mesh(slot.build(1), new THREE.MeshBasicMaterial({ color: 0x050607 }));
  g.add(m);
  const lips = new Geo();
  lips.box(x - (s < 0 ? WALL_T : 0) - 1, f.y + 24, -34, x + (s < 0 ? 0 : WALL_T) + 1, f.y + 30, 34);
  lips.box(x - (s < 0 ? WALL_T : 0) - 1, f.y - 30, -34, x + (s < 0 ? 0 : WALL_T) + 1, f.y - 24, 34);
  g.add(new THREE.Mesh(lips.build(60), plain('zincEdge', {})));
  return g;
}

/** The inner wall's x on a side at height y (straight runs; good enough for decoration). */
function wallXAt(level, side, y) {
  const pts = side === 'L' ? level.left : level.right;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a[1] <= y && b[1] >= y) || (a[1] >= y && b[1] <= y)) {
      if (Math.abs(b[1] - a[1]) < 1e-6) continue;
      const k = (y - a[1]) / (b[1] - a[1]);
      return a[0] + (b[0] - a[0]) * k;
    }
  }
  return side === 'L' ? -100 : 100;
}

// ------------------------------------------------------------------------------------------------ cobwebs

function cobwebTex() {
  return canvasTex(
    'cobweb',
    512,
    512,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineCap = 'round';
      // anchored at the top-left corner, threads fanning down and right, sagging spiral between them
      const ox = 6;
      const oy = 6;
      const n = 9;
      const angs = [];
      for (let i = 0; i < n; i++) angs.push((Math.PI / 2) * (i / (n - 1)) * 0.98 + 0.01);
      ctx.lineWidth = 2.4;
      for (const a of angs) {
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a) * w * 1.2, oy + Math.sin(a) * h * 1.2);
        ctx.stroke();
      }
      ctx.lineWidth = 1.6;
      for (let r = 40; r < w * 1.1; r += 34 + r * 0.08) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const a = angs[i];
          const x = ox + Math.cos(a) * r;
          const y = oy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else {
            const pa = angs[i - 1];
            const mx = ox + Math.cos((a + pa) / 2) * r * 0.9;
            const my = oy + Math.sin((a + pa) / 2) * r * 0.9;
            ctx.quadraticCurveTo(mx, my, x, y);
          }
        }
        ctx.stroke();
      }
      // a broken strand or two
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(w * 0.55, h * 0.2);
      ctx.quadraticCurveTo(w * 0.62, h * 0.45, w * 0.58, h * 0.7);
      ctx.stroke();
      // fade with distance from the corner
      ctx.globalCompositeOperation = 'destination-in';
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 1.05);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { mips: true },
  );
}

function cobwebs(level, rnd) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: cobwebTex(), transparent: true, opacity: 0.38, depthWrite: false, color: new THREE.Color(1.3, 1.3, 1.35) });
  for (const b of level.pocketBoxes) {
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    if (w < 20 || h < 20) continue;
    const size = Math.min(110, Math.max(w, h) * 0.9);
    const geo = new THREE.PlaneGeometry(size, size);
    // the corner where the web hangs: the top, against whichever side is a wall
    const cx = (b.x0 + b.x1) / 2;
    const leftWall = cx < centerAt(level, b.y1);
    const m = new THREE.Mesh(geo, mat);
    const sx = leftWall ? 1 : -1;
    m.scale.x = sx;
    m.position.set(leftWall ? b.x0 + size / 2 : b.x1 - size / 2, b.y1 - size / 2, -D2 + 1.5 + rnd() * 2);
    m.renderOrder = 2;
    g.add(m);
  }
  return g;
}

function centerAt(level, y) {
  const s = level.spans.find((q) => y >= q.y0 && y < q.y1) ?? level.spans[level.spans.length - 1];
  return s.cx;
}

// ------------------------------------------------------------------------------------------------ the drain and the gutter

/** The drain's opening in the ground (the ground is cut around it). */
export function drainHole(level) {
  const sp = level.spans[0];
  return { x0: sp.cx - sp.half - WALL_T - 16, x1: sp.cx + sp.half + WALL_T + 16, z0: -D2 - WALL_T - 14, z1: D2 + 30 };
}

function drainMesh(level) {
  const g = new THREE.Group();
  const rnd = rand(97);
  // a cast-iron gully grate set in a concrete kerb, its top flush with the floor the spiders stand on; under the bars,
  // a dark pit with a skin of water that catches the light
  const { x0: gx0, x1: gx1, z0: gz0, z1: gz1 } = drainHole(level);
  const K = 34; // the kerb's width
  const kerb = pbr('Concrete036', { tile: 260, color: 0xb9b4aa, key: 'drainKerb', normal: 1.4 });
  const kg = new Geo();
  kg.box(gx0 - K, -3, gz0 - K, gx1 + K, 0.4, gz0);
  kg.box(gx0 - K, -3, gz1, gx1 + K, 0.4, gz1 + K);
  kg.box(gx0 - K, -3, gz0, gx0, 0.4, gz1);
  kg.box(gx1, -3, gz0, gx1 + K, 0.4, gz1);
  const km = new THREE.Mesh(kg.build(1), kerb);
  km.receiveShadow = true;
  g.add(km);

  const iron = pbr('MetalPlates013', { tile: 90, metal: 1, rough: 1.1, color: 0x8a8079, env: 1.1, key: 'drainIron', normal: 1.6 });
  // the grate's rim
  const rim = new Geo();
  const RW = 9;
  rim.box(gx0, -12, gz0, gx1, 0, gz0 + RW);
  rim.box(gx0, -12, gz1 - RW, gx1, 0, gz1);
  rim.box(gx0, -12, gz0 + RW, gx0 + RW, 0, gz1 - RW);
  rim.box(gx1 - RW, -12, gz0 + RW, gx1, 0, gz1 - RW);
  const rm = new THREE.Mesh(rim.build(1), iron);
  rm.receiveShadow = true;
  rm.castShadow = true;
  g.add(rm);
  // the bars, front to back, rounded so their tops catch the light; one cross bar through the middle
  const inX0 = gx0 + RW;
  const inX1 = gx1 - RW;
  const n = Math.max(6, Math.round((inX1 - inX0) / 21));
  const pitch = (inX1 - inX0) / n;
  const barW = pitch * 0.56;
  const len = gz1 - gz0 - RW * 2;
  const barGeo = new RoundedBoxGeometry(barW, 14, len + 4, 3, 3.2);
  const bars = new THREE.InstancedMesh(barGeo, iron, n - 1);
  const m4 = new THREE.Matrix4();
  const tint = new THREE.Color();
  for (let i = 1; i < n; i++) {
    m4.makeTranslation(inX0 + i * pitch, -6.6, (gz0 + gz1) / 2);
    bars.setMatrixAt(i - 1, m4);
    // a little rust on some
    tint.setRGB(1, 1, 1).lerp(new THREE.Color(1.25, 0.82, 0.6), rnd() * rnd() * 0.8);
    bars.setColorAt(i - 1, tint);
  }
  bars.castShadow = true;
  bars.receiveShadow = true;
  g.add(bars);
  const cross = new THREE.Mesh(new RoundedBoxGeometry(inX1 - inX0 + 4, 10, 9, 2, 3), iron);
  cross.position.set((inX0 + inX1) / 2, -7, (gz0 + gz1) / 2);
  cross.receiveShadow = true;
  g.add(cross);
  // the pit: dark walls and water a little way down
  const pit = new Geo();
  const P = 46;
  pit.face([[inX0, -P, gz0 + RW], [inX1, -P, gz0 + RW], [inX1, -12, gz0 + RW], [inX0, -12, gz0 + RW]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  pit.faceAuto([[inX0, -P, gz1 - RW], [inX1, -P, gz1 - RW], [inX1, -12, gz1 - RW], [inX0, -12, gz1 - RW]], [0, 0, -1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  pit.faceAuto([[inX0, -P, gz0], [inX0, -P, gz1], [inX0, -12, gz1], [inX0, -12, gz0]], [1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  pit.faceAuto([[inX1, -P, gz0], [inX1, -P, gz1], [inX1, -12, gz1], [inX1, -12, gz0]], [-1, 0, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  g.add(new THREE.Mesh(pit.build(1), new THREE.MeshLambertMaterial({ color: 0x120f0c })));
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(inX1 - inX0, gz1 - gz0),
    new THREE.MeshLambertMaterial({ color: 0x06090a }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((inX0 + inX1) / 2, -30, (gz0 + gz1) / 2);
  g.add(water);
  return g;
}

function gutterMesh(level, theme) {
  const g = new THREE.Group();
  const H = level.H;
  const last = level.spans[level.spans.length - 1];
  const cx = last.cx;
  const half = last.half;
  // seen from above against a bright sky the gutter catches it all: a duller coat so it doesn't burn out
  const zinc = zincMat({ key: 'gutter', color: new THREE.Color(1.2, 1.25, 1.3), env: 0.85 });
  const beadMat = zincMat({ key: 'gutterBead', color: new THREE.Color(0.95, 1.0, 1.05), env: 0.6 });
  const reach = 2600;
  const geo = new Geo();
  // the floor (cut through at the pipe's mouth), its back wall rising, the rolled bead along the back top
  geo.box(cx - reach, H - 14, -D2 - WALL_T, cx - half - WALL_T, H, D2);
  geo.box(cx + half + WALL_T, H - 14, -D2 - WALL_T, cx + reach, H, D2);
  geo.box(cx - reach, H - 14, -D2 - WALL_T, cx + reach, H + 60, -D2);
  const m = new THREE.Mesh(geo.build(420), zinc);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  const lip = new Geo();
  lip.box(cx - reach, H - 14, D2, cx - half - WALL_T, H + 2, D2 + 3);
  lip.box(cx + half + WALL_T, H - 14, D2, cx + reach, H + 2, D2 + 3);
  g.add(new THREE.Mesh(lip.build(1), plain('zincEdge', {})));
  const bead = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, reach * 2, 12), beadMat);
  bead.rotation.z = Math.PI / 2;
  bead.position.set(cx, H + 60, -D2 + 4);
  bead.castShadow = true;
  g.add(bead);
  // a few leaves and twigs in the gutter, a puddle
  const rnd = rand(H | 0);
  for (let k = 0; k < 9; k++) {
    const x = cx + (rnd() < 0.5 ? -1 : 1) * (half + 80 + rnd() * 900);
    const lm = new THREE.Mesh(leafGeometry(40 + rnd() * 30, 70 + rnd() * 40, 4, rnd), leafMaterial(Math.floor(rnd() * 3)));
    lm.position.set(x, H + 1, (rnd() - 0.5) * 80);
    lm.rotation.y = rnd() * Math.PI;
    lm.receiveShadow = true;
    g.add(lm);
  }
  const puddle = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    new THREE.MeshPhysicalMaterial({ color: 0x1b2a33, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.75 }),
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(220, 60, 1);
  puddle.position.set(cx + half + 330, H + 0.6, 0);
  g.add(puddle);
  return g;
}
