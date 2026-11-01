// A spout's geometry: pieces stacked into one wall chain (right wall down, the drain's floor, left wall up, the gutter at both
// ends), the path the spider's centre walks along (the chain pushed out by the spider's radius, with arcs round outside
// corners), dry pockets, features and the queries the physics, bots and renderer need. Pure.

import { buildPiece } from './pieces.js';
import { HALF, R, CATCH_NY } from './config.js';

const BUCKET = 64;

/** Builds a level from a list of piece descriptors. */
export function buildLevel(pieces, opts = {}) {
  let cx = 0;
  let y = 0;
  const left = [];
  const right = [];
  const pockets = [];
  const features = [];
  const center = [];
  const spans = [];
  const push = (list, pts) => {
    for (const p of pts) {
      const last = list[list.length - 1];
      if (last && Math.abs(last[0] - p[0]) < 1e-6 && Math.abs(last[1] - p[1]) < 1e-6) continue;
      list.push(p);
    }
  };
  for (const piece of pieces) {
    const built = buildPiece(piece, cx, y);
    push(left, built.left);
    push(right, built.right);
    push(center, built.center);
    for (const p of built.pockets) pockets.push(p);
    for (const f of built.features) features.push(f);
    spans.push({ k: piece.k, y0: y, y1: y + built.h, cx, exit: built.exit, piece });
    cx = built.exit;
    y += built.h;
  }
  const top = pieces.length && pieces[pieces.length - 1].k === 'top' ? y : Infinity;

  // One chain, free space on the right of travel: right wall top to bottom, the floor, left wall bottom to top.
  const chain = [];
  const sides = [];
  for (let i = right.length - 1; i >= 0; i--) {
    chain.push(right[i]);
    sides.push(right[i][1] >= top - 1e-6 && i === right.length - 1 ? 'G' : 'R');
  }
  for (let i = 0; i < left.length; i++) {
    chain.push(left[i]);
    sides.push(left[i][1] >= top - 1e-6 && i === left.length - 1 ? 'G' : 'L');
  }
  const path = offsetPath(chain, sides, R);
  markMoss(path, features);
  computeUp(path);
  const index = buildIndex(path);
  const pocketBoxes = pockets.map((poly) => bbox(poly));
  // Where the walking path passes through each dry pocket: bots aim for the middle of it.
  const pocketAnchors = [];
  pockets.forEach((poly, k) => {
    let run = null;
    for (let i = 0; i <= path.n; i++) {
      const inside = i < path.n && pointInPoly(poly, path.x[i], path.y[i]);
      if (inside && !run) run = { a: path.cum[i], b: path.cum[i] };
      else if (inside) run.b = path.cum[i];
      else if (run) {
        const s = (run.a + run.b) / 2;
        const p = sampleAt(path, s, {});
        pocketAnchors.push({ k, s, x: p.x, y: p.y, len: run.b - run.a });
        run = null;
      }
    }
  });

  const level = {
    pieces,
    H: Number.isFinite(top) ? top : y,
    height: y,
    finishY: Number.isFinite(top) ? top : Infinity,
    left,
    right,
    chain,
    path,
    pockets,
    pocketBoxes,
    pocketAnchors,
    features,
    center,
    spans,
    index,
    name: opts.name ?? '',
  };
  return level;
}

function bbox(poly) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** The path the spider's centre follows: the chain offset by r, arcs at outside corners, mitres at inside corners. */
export function offsetPath(chain, sides, r) {
  const n = chain.length;
  const dirs = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = chain[i + 1][0] - chain[i][0];
    const dy = chain[i + 1][1] - chain[i][1];
    const len = Math.hypot(dx, dy) || 1;
    dirs.push([dx / len, dy / len]);
  }
  const xs = [];
  const ys = [];
  const nxs = [];
  const nys = [];
  const side = [];
  const add = (x, y, nx, ny, sd) => {
    const k = xs.length - 1;
    if (k >= 0 && Math.abs(xs[k] - x) < 0.01 && Math.abs(ys[k] - y) < 0.01) {
      nxs[k] = nx;
      nys[k] = ny;
      return;
    }
    xs.push(x);
    ys.push(y);
    nxs.push(nx);
    nys.push(ny);
    side.push(sd);
  };
  for (let j = 0; j < n; j++) {
    const [px, py] = chain[j];
    const sd = sides[j];
    if (j === 0 || j === n - 1) {
      const d = dirs[j === 0 ? 0 : n - 2];
      const nx = d[1];
      const ny = -d[0];
      add(px + nx * r, py + ny * r, nx, ny, sd);
      continue;
    }
    const d1 = dirs[j - 1];
    const d2 = dirs[j];
    const n1 = [d1[1], -d1[0]];
    const n2 = [d2[1], -d2[0]];
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const dot = d1[0] * d2[0] + d1[1] * d2[1];
    if (Math.abs(cross) < 1e-6 && dot > 0) {
      add(px + n1[0] * r, py + n1[1] * r, n1[0], n1[1], sd);
    } else if (cross > 0) {
      // Outside corner: walk round it.
      const a1 = Math.atan2(n1[1], n1[0]);
      let sweep = Math.atan2(n2[1], n2[0]) - a1;
      while (sweep <= -Math.PI) sweep += Math.PI * 2;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
      for (let k = 0; k <= steps; k++) {
        const a = a1 + (sweep * k) / steps;
        add(px + Math.cos(a) * r, py + Math.sin(a) * r, Math.cos(a), Math.sin(a), sd);
      }
    } else {
      // Inside corner: the two offset lines meet.
      const nd = n1[0] * n2[0] + n1[1] * n2[1];
      const k = r / (1 + nd);
      const mx = n1[0] + n2[0];
      const my = n1[1] + n2[1];
      const ml = Math.hypot(mx, my) || 1;
      add(px + mx * k, py + my * k, mx / ml, my / ml, sd);
    }
  }
  const count = xs.length;
  const cum = new Float64Array(count);
  for (let i = 1; i < count; i++) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  // Each segment's own normal (the free side): what landing and standing use. Vertex normals only smooth the arcs.
  const snx = new Float64Array(Math.max(1, count - 1));
  const sny = new Float64Array(Math.max(1, count - 1));
  for (let i = 0; i < count - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    const dy = ys[i + 1] - ys[i];
    const l = Math.hypot(dx, dy) || 1;
    snx[i] = dy / l;
    sny[i] = -dx / l;
  }
  return {
    snx,
    sny,
    mossPatches: [],
    n: count,
    x: Float64Array.from(xs),
    y: Float64Array.from(ys),
    nx: Float64Array.from(nxs),
    ny: Float64Array.from(nys),
    side,
    cum,
    length: cum[count - 1],
    up: new Int8Array(count),
  };
}

function markMoss(path, features) {
  path.mossPatches = features.filter((f) => f.kind === 'moss').map((f) => ({ side: f.side, y0: f.y0, y1: f.y1 }));
}

/** Moss under a wall point (moss only grows on the walls themselves, not on ledges). */
export function mossAt(path, side, y, snx) {
  if (Math.abs(snx) < 0.7) return 0;
  for (const m of path.mossPatches) if (m.side === side && y >= m.y0 && y <= m.y1) return 1;
  return 0;
}

/** For every path point: which way along the path gains height sooner (+1 forward, -1 back). */
function computeUp(path) {
  const { n, y, cum, up } = path;
  const RISE = 40;
  const LIMIT = 900;
  for (let i = 0; i < n; i++) {
    let fwd = Infinity;
    for (let j = i + 1; j < n && cum[j] - cum[i] < LIMIT; j++) {
      if (y[j] > y[i] + RISE) {
        fwd = cum[j] - cum[i];
        break;
      }
    }
    let back = Infinity;
    for (let j = i - 1; j >= 0 && cum[i] - cum[j] < LIMIT; j--) {
      if (y[j] > y[i] + RISE) {
        back = cum[i] - cum[j];
        break;
      }
    }
    if (fwd === Infinity && back === Infinity) up[i] = path.side[i] === 'R' ? -1 : 1;
    else up[i] = fwd <= back ? 1 : -1;
  }
}

function buildIndex(path) {
  const buckets = new Map();
  for (let i = 0; i < path.n - 1; i++) {
    const lo = Math.floor((Math.min(path.y[i], path.y[i + 1]) - 2) / BUCKET);
    const hi = Math.floor((Math.max(path.y[i], path.y[i + 1]) + 2) / BUCKET);
    for (let b = lo; b <= hi; b++) {
      let list = buckets.get(b);
      if (!list) buckets.set(b, (list = []));
      list.push(i);
    }
  }
  return { buckets, stamp: new Uint32Array(path.n), mark: 1 };
}

/** The point on the path at arclength s: { x, y, nx, ny, i (segment), up, moss }. Writes into `out` when given. */
export function sampleAt(path, s, out = {}) {
  const { cum, n } = path;
  if (s <= 0) return fill(out, path, 0, 0);
  if (s >= path.length) return fill(out, path, n - 2, 1);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = cum[lo + 1] - cum[lo] || 1;
  return fill(out, path, lo, (s - cum[lo]) / seg);
}

function fill(out, path, i, f) {
  const j = Math.min(path.n - 1, i + 1);
  out.x = path.x[i] + (path.x[j] - path.x[i]) * f;
  out.y = path.y[i] + (path.y[j] - path.y[i]) * f;
  const si = Math.min(i, path.n - 2);
  out.nx = path.snx[si];
  out.ny = path.sny[si];
  out.i = i;
  const k = f < 0.5 ? i : j;
  out.up = path.up[k];
  out.side = path.side[k];
  out.moss = mossAt(path, out.side, out.y, out.nx);
  return out;
}

/**
 * The first place the segment (x0,y0)→(x1,y1) crosses the path, or null: { t (0..1 along the move), s, x, y, nx, ny, i }.
 * `skipFrom`/`skipTo` leave out a stretch of arclength (the surface a jump just left).
 */
export function raycast(level, x0, y0, x1, y1, skipFrom = -1, skipTo = -1) {
  const { path, index } = level;
  const lo = Math.floor((Math.min(y0, y1) - 2) / BUCKET);
  const hi = Math.floor((Math.max(y0, y1) + 2) / BUCKET);
  index.mark = (index.mark + 1) >>> 0 || 1;
  let best = null;
  let bestT = Infinity;
  const rx = x1 - x0;
  const ry = y1 - y0;
  for (let b = lo; b <= hi; b++) {
    const list = index.buckets.get(b);
    if (!list) continue;
    for (const i of list) {
      if (index.stamp[i] === index.mark) continue;
      index.stamp[i] = index.mark;
      const ax = path.x[i];
      const ay = path.y[i];
      const sx = path.x[i + 1] - ax;
      const sy = path.y[i + 1] - ay;
      const den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = ax - x0;
      const qy = ay - y0;
      const t = (qx * sy - qy * sx) / den;
      const u = (qx * ry - qy * rx) / den;
      if (t < -1e-9 || t > 1 || u < -1e-9 || u > 1 + 1e-9) continue;
      // Only crossings from the free side count (moving against the surface's normal).
      const nx = path.snx[i];
      const ny = path.sny[i];
      if (rx * nx + ry * ny >= 0) continue;
      const s = path.cum[i] + (path.cum[i + 1] - path.cum[i]) * u;
      if (skipFrom >= 0 && s >= skipFrom && s <= skipTo) continue;
      if (t < bestT) {
        bestT = t;
        best = { t, s, x: ax + sx * u, y: ay + sy * u, nx, ny, i };
      }
    }
  }
  return best;
}

/** Nearest path point to (x, y) within `max` units: { s, x, y, d } or null. */
export function nearest(level, x, y, max = 40) {
  const { path, index } = level;
  const lo = Math.floor((y - max) / BUCKET);
  const hi = Math.floor((y + max) / BUCKET);
  index.mark = (index.mark + 1) >>> 0 || 1;
  let best = null;
  for (let b = lo; b <= hi; b++) {
    const list = index.buckets.get(b);
    if (!list) continue;
    for (const i of list) {
      if (index.stamp[i] === index.mark) continue;
      index.stamp[i] = index.mark;
      const ax = path.x[i];
      const ay = path.y[i];
      const sx = path.x[i + 1] - ax;
      const sy = path.y[i + 1] - ay;
      const l2 = sx * sx + sy * sy || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * sx + (y - ay) * sy) / l2));
      const px = ax + sx * u;
      const py = ay + sy * u;
      const d = Math.hypot(px - x, py - y);
      if (d <= max && (!best || d < best.d)) best = { s: path.cum[i] + (path.cum[i + 1] - path.cum[i]) * u, x: px, y: py, d };
    }
  }
  return best;
}

export function inPocket(level, x, y) {
  const { pockets, pocketBoxes } = level;
  for (let k = 0; k < pockets.length; k++) {
    const b = pocketBoxes[k];
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
    if (pointInPoly(pockets[k], x, y)) return true;
  }
  return false;
}

export function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The pipe's centre line at height y. */
export function centerX(level, y) {
  const c = level.center;
  if (y <= c[0][1]) return c[0][0];
  let lo = 0;
  let hi = c.length - 1;
  if (y >= c[hi][1]) return c[hi][0];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (c[mid][1] <= y) lo = mid;
    else hi = mid;
  }
  const dy = c[hi][1] - c[lo][1] || 1;
  return c[lo][0] + ((c[hi][0] - c[lo][0]) * (y - c[lo][1])) / dy;
}

/** Inner wall x at height y (rings and brackets ignored). */
export const wallX = (level, side, y) => centerX(level, y) + (side === 'L' ? -HALF : HALF);

/** Is this path point a ledge that catches a washed spider? */
export const isCatch = (ny) => ny > CATCH_NY;

/** Features of one kind overlapping [y0, y1]. */
export function featuresIn(level, kind, y0, y1) {
  const out = [];
  for (const f of level.features) {
    if (f.kind !== kind) continue;
    const a = f.y0 ?? f.y;
    const b = f.y1 ?? f.y;
    if (b >= y0 && a <= y1) out.push(f);
  }
  return out;
}
