// A small mesh builder: quads, strips and polygons with normals, UVs in world units and optional vertex colours.

import * as THREE from 'three';

export class Geo {
  constructor(colors = false) {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = colors ? [] : null;
    this.i = [];
  }
  get count() {
    return this.p.length / 3;
  }
  v(x, y, z, nx, ny, nz, u, w, col) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, w);
    if (this.c) this.c.push(col?.[0] ?? 1, col?.[1] ?? 1, col?.[2] ?? 1, col?.[3] ?? 1);
    return this.count - 1;
  }
  tri(a, b, c) {
    this.i.push(a, b, c);
  }
  /** A quad a-b-c-d (counter-clockwise seen from the front). */
  quad(a, b, c, d) {
    this.i.push(a, b, c, a, c, d);
  }
  /** Axis-aligned or any flat quad from 4 points [x,y,z], one normal, uvs per corner, colours per corner. */
  face(pts, nrm, uvs, cols) {
    const k = pts.map((q, j) => this.v(q[0], q[1], q[2], nrm[0], nrm[1], nrm[2], uvs[j][0], uvs[j][1], cols?.[j]));
    this.quad(k[0], k[1], k[2], k[3]);
  }
  /** A flat quad whose winding is chosen to face `nrm` (points in any order round the quad). */
  faceAuto(pts, nrm, uvs, cols) {
    const [a, b, c] = pts;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const flip = cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0;
    const k = pts.map((q, j) => this.v(q[0], q[1], q[2], nrm[0], nrm[1], nrm[2], uvs[j][0], uvs[j][1], cols?.[j]));
    if (flip) this.quad(k[0], k[3], k[2], k[1]);
    else this.quad(k[0], k[1], k[2], k[3]);
  }
  /** A box (min/max corners) with world-unit UVs on each face. */
  box(x0, y0, z0, x1, y1, z1, col) {
    const c = col ? [col, col, col, col] : null;
    this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], c);
    this.face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[x1, y0], [x0, y0], [x0, y1], [x1, y1]], c);
    this.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], c);
    this.face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[z1, y0], [z0, y0], [z0, y1], [z1, y1]], c);
    this.face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], c);
    this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], c);
  }
  /** A flat polygon (2D points in x,y) at depth z facing +z (or -z), triangulated. */
  poly(pts, z, facing = 1, col, holes = []) {
    const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
    const all = [...contour, ...hs.flat()];
    const base = this.count;
    for (const q of all) this.v(q.x, q.y, z, 0, 0, facing, q.x, q.y, col);
    for (const t of tris) {
      if (facing > 0) this.tri(base + t[0], base + t[1], base + t[2]);
      else this.tri(base + t[0], base + t[2], base + t[1]);
    }
  }
  /** Appends another Geo. */
  merge(g) {
    const base = this.count;
    this.p.push(...g.p);
    this.n.push(...g.n);
    this.uv.push(...g.uv);
    if (this.c) for (let k = 0; k < g.count; k++) this.c.push(...(g.c ? g.c.slice(k * 4, k * 4 + 4) : [1, 1, 1, 1]));
    for (const i of g.i) this.i.push(base + i);
  }
  /** The BufferGeometry, UVs divided by the tile size (units per repeat). */
  build(tile = 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    const tu = Array.isArray(tile) ? tile[0] : tile;
    const tv = Array.isArray(tile) ? tile[1] : tile;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv.map((v, k) => (k % 2 ? v / tv : v / tu)), 2));
    if (this.c) geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 4));
    const n = this.count;
    geo.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

/** Offsets a polyline [[x,y],...] by d along the left normal of travel (negative d: right), with clamped mitres. */
export function offsetLine(pts, d) {
  const out = [];
  const n = pts.length;
  const nrm = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dy) || 1;
    nrm.push([-dy / l, dx / l]);
  }
  for (let i = 0; i < n; i++) {
    const a = nrm[Math.max(0, i - 1)];
    const b = nrm[Math.min(n - 2, i)];
    let mx = a[0] + b[0];
    let my = a[1] + b[1];
    const ml = Math.hypot(mx, my);
    if (ml < 1e-4) {
      mx = b[0];
      my = b[1];
    } else {
      mx /= ml;
      my /= ml;
    }
    const cos = Math.max(0.35, mx * a[0] + my * a[1]);
    out.push([pts[i][0] + (mx * d) / cos, pts[i][1] + (my * d) / cos]);
  }
  return out;
}

/** Cumulative lengths of a polyline. */
export function cumLen(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return c;
}

/** A seeded value noise texture's worth of helpers for canvas drawing. */
export function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1 ? -x : x) + (h & 2 ? -y : y));
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const a = perm[X] + Y;
    const b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return l1 + v * (l2 - l1);
  }
  function fbm(x, y, oct = 4) {
    let t = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      t += a * noise(x * f, y * f);
      f *= 2;
      a *= 0.5;
    }
    return t;
  }
  return { noise, fbm, rand: r };
}
