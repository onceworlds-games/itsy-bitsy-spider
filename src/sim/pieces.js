// The piece library: every spout (handmade or Monsoon's) is a stack of these. Each piece turns a small descriptor into wall
// profiles (the inner surface of the left and right walls, bottom to top), islands (things wedged across the pipe you can
// stand on and walk round), dry pockets (polygons the flush never reaches), snags (bolts silk can catch on), flies, and
// features for the renderer (rings, moss, the bird's seam, warm-air vents). Pure: no page, no randomness.

import { HALF, RING_IN, RING_H } from './config.js';

const P = (x, y) => [x, y];

/** Rings of a straight section: explicit local heights, or one every `gap` units. */
function ringYs(piece) {
  if (Array.isArray(piece.rings)) return piece.rings.slice().sort((a, b) => a - b).filter((y) => y > 30 && y < piece.h - RING_H - 30);
  const gap = piece.gap ?? 420;
  if (!(gap > 0) || gap >= piece.h) return [];
  const out = [];
  for (let y = gap; y < piece.h - RING_H - 30; y += gap) out.push(y);
  return out;
}

/** Wall points for one side of a straight run from y0 to y1 at centre cx, with collars at the given absolute heights. */
function straightWall(side, cx, y0, y1, rings, half = HALF) {
  const s = side === 'L' ? -1 : 1;
  const wx = cx + s * half;
  const ix = cx + s * (half - RING_IN);
  const pts = [P(wx, y0)];
  for (const y of rings) pts.push(P(wx, y), P(ix, y), P(ix, y + RING_H), P(wx, y + RING_H));
  pts.push(P(wx, y1));
  return pts;
}

/** A bar wedged across the pipe: a rotated rectangle, with the dry shadow the water leaves under it. */
function bar(out, b, cx, y0) {
  const x = cx + (b.x ?? 0);
  const y = y0 + b.y;
  const len = b.len ?? 90;
  const t = b.t ?? (b.kind === 'leaf' ? 10 : 14);
  const a = ((b.tilt ?? 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hx = len / 2;
  const hy = t / 2;
  const corner = (u, v) => P(x + u * c - v * s, y + u * s + v * c);
  const poly = [corner(-hx, -hy), corner(hx, -hy), corner(hx, hy), corner(-hx, hy)];
  out.islands.push({ poly, kind: b.kind ?? 'twig', x, y, len, t, tilt: b.tilt ?? 0 });
  if (b.dry !== false) {
    const dry = b.dryH ?? 80;
    const lowL = Math.min(poly[0][1], poly[3][1]);
    const lowR = Math.min(poly[1][1], poly[2][1]);
    const xl = Math.min(poly[0][0], poly[3][0]) + 8;
    const xr = Math.max(poly[1][0], poly[2][0]) - 8;
    out.pockets.push([P(xl, lowL - dry), P(xr, lowR - dry), P(xr, lowR + 2), P(xl, lowL + 2)]);
  }
}

/** The extras any piece may carry: snags, flies and bars, in piece coordinates (x from the centre, y from the bottom). */
function extras(out, piece, cx, y0) {
  for (const sn of piece.snags ?? []) out.snags.push({ x: cx + sn.x, y: y0 + sn.y, kind: sn.kind ?? 'bolt' });
  for (const f of piece.flies ?? []) out.flies.push({ x: cx + f.x, y: y0 + f.y, gold: !!f.gold });
  for (const b of piece.bars ?? []) bar(out, b, cx, y0);
}

/**
 * Builds one piece at (cx, y0). Returns { h, exit, half, left, right, pockets, islands, snags, flies, features, center }.
 * Piece kinds:
 *   start     the drain at the bottom (a floor across the pipe)
 *   straight  { h, gap | rings, moss: [{ side, y0, y1 }], seam: { side, y }, vent: { side, y } }
 *   jog       { d, a, b, ring }: an elbow pair moving the pipe sideways by d over |d| (45°), a below and b above
 *   bracket   { side, len, h }: a strap across part of the pipe (dry underneath)
 *   alcove    { side, h }: a capped branch stub (dry inside)
 *   hopper    { w, h }: a wide rain-head box: a funnel floor, straight sides, dry shoulders under its top
 *   top       the gutter at the roof's edge (the finish)
 * Any piece also takes snags: [{ x, y }], flies: [{ x, y, gold }] and bars: [{ x, y, len, tilt, kind }].
 */
export function buildPiece(piece, cx, y0) {
  const out = { h: 0, exit: cx, half: HALF, left: [], right: [], pockets: [], islands: [], snags: [], flies: [], features: [], center: [] };
  const feat = (f) => out.features.push(f);
  switch (piece.k) {
    case 'start': {
      const h = piece.h ?? 160;
      out.h = h;
      out.left = [P(cx - HALF, y0), P(cx - HALF, y0 + h)];
      out.right = [P(cx + HALF, y0), P(cx + HALF, y0 + h)];
      out.center = [P(cx, y0), P(cx, y0 + h)];
      feat({ kind: 'drain', x: cx, y: y0 });
      break;
    }
    case 'straight': {
      const h = piece.h;
      out.h = h;
      const rings = ringYs(piece).map((y) => y0 + y);
      out.left = straightWall('L', cx, y0, y0 + h, rings);
      out.right = straightWall('R', cx, y0, y0 + h, rings);
      out.center = [P(cx, y0), P(cx, y0 + h)];
      for (const y of rings) feat({ kind: 'ring', x: cx, y });
      for (const m of piece.moss ?? []) feat({ kind: 'moss', side: m.side, y0: y0 + m.y0, y1: y0 + m.y1 });
      if (piece.seam) feat({ kind: 'seam', side: piece.seam.side, x: cx, y: y0 + piece.seam.y });
      if (piece.vent) feat({ kind: 'vent', side: piece.vent.side, x: cx, y: y0 + piece.vent.y });
      if (!rings.length && h >= 600) feat({ kind: 'drop', y0, y1: y0 + h });
      break;
    }
    case 'jog': {
      const d = piece.d;
      const a = piece.a ?? 120;
      const b = piece.b ?? 120;
      const s = Math.abs(d);
      const h = a + s + b;
      out.h = h;
      const ya = y0 + a;
      const yb = ya + s;
      const ringA = piece.ring ? [y0 + Math.round(a / 2) - 8] : [];
      out.left = [...straightWall('L', cx, y0, ya, ringA), P(cx - HALF + d, yb), P(cx - HALF + d, y0 + h)];
      out.right = [...straightWall('R', cx, y0, ya, ringA), P(cx + HALF + d, yb), P(cx + HALF + d, y0 + h)];
      for (const y of ringA) feat({ kind: 'ring', x: cx, y });
      out.center = [P(cx, y0), P(cx, ya), P(cx + d, yb), P(cx + d, y0 + h)];
      out.exit = cx + d;
      // Dry under the overhanging slant: the wall on the side the pipe moves away from.
      if (d > 0) {
        const wx = cx - HALF;
        out.pockets.push([P(wx, ya - 100), P(wx + d - 6, ya - 100), P(wx + d - 6, yb - 6), P(wx, ya)]);
      } else {
        const wx = cx + HALF;
        out.pockets.push([P(wx, ya - 100), P(wx, ya), P(wx + d + 6, yb - 6), P(wx + d + 6, ya - 100)]);
      }
      feat({ kind: 'elbow', x: cx, y: ya, d });
      break;
    }
    case 'bracket': {
      const h = piece.h ?? 260;
      const len = piece.len ?? 80;
      out.h = h;
      const yb = y0 + Math.round(h / 2);
      const s = piece.side === 'L' ? -1 : 1;
      const wx = cx + s * HALF;
      const tip = wx - s * len;
      const wall = [P(wx, y0), P(wx, yb), P(tip, yb), P(tip, yb + 12), P(wx, yb + 12), P(wx, y0 + h)];
      const plain = [P(cx - s * HALF, y0), P(cx - s * HALF, y0 + h)];
      if (s < 0) {
        out.left = wall;
        out.right = plain;
      } else {
        out.right = wall;
        out.left = plain;
      }
      out.pockets.push([P(wx, yb - 80), P(tip + s * 6, yb - 80), P(tip + s * 6, yb), P(wx, yb)]);
      out.center = [P(cx, y0), P(cx, y0 + h)];
      feat({ kind: 'bracket', side: piece.side, x: cx, y: yb, len });
      break;
    }
    case 'alcove': {
      const h = piece.h ?? 240;
      out.h = h;
      const w = 64;
      const hh = 72;
      const ya = y0 + Math.round(h / 2) - hh / 2;
      const s = piece.side === 'L' ? -1 : 1;
      const wx = cx + s * HALF;
      const back = wx + s * w;
      const wall = [P(wx, y0), P(wx, ya), P(back, ya), P(back, ya + hh), P(wx, ya + hh), P(wx, y0 + h)];
      const plain = [P(cx - s * HALF, y0), P(cx - s * HALF, y0 + h)];
      if (s < 0) {
        out.left = wall;
        out.right = plain;
      } else {
        out.right = wall;
        out.left = plain;
      }
      out.pockets.push([P(back, ya), P(wx - s * 6, ya), P(wx - s * 6, ya + hh), P(back, ya + hh)]);
      out.center = [P(cx, y0), P(cx, y0 + h)];
      feat({ kind: 'alcove', side: piece.side, x: cx, y: ya, w, hh });
      break;
    }
    case 'hopper': {
      const w = piece.w ?? 230;
      const inner = piece.h ?? 420;
      const flare = w - HALF;
      const h = flare * 2 + inner;
      out.h = h;
      out.half = w;
      const yA = y0 + flare;
      const yB = yA + inner;
      out.left = [P(cx - HALF, y0), P(cx - w, yA), P(cx - w, yB), P(cx - HALF, y0 + h)];
      out.right = [P(cx + HALF, y0), P(cx + w, yA), P(cx + w, yB), P(cx + HALF, y0 + h)];
      out.center = [P(cx, y0), P(cx, y0 + h)];
      // The shoulders under the box's top are out of the water's way.
      const dry = piece.dry ?? 110;
      out.pockets.push([P(cx - w, yB - dry), P(cx - HALF - 8, yB - dry), P(cx - HALF - 8, y0 + h - 8), P(cx - w, yB)]);
      out.pockets.push([P(cx + HALF + 8, yB - dry), P(cx + w, yB - dry), P(cx + w, yB), P(cx + HALF + 8, y0 + h - 8)]);
      feat({ kind: 'hopper', x: cx, y: y0, w, inner, flare });
      break;
    }
    case 'top': {
      const h = piece.h ?? 120;
      out.h = h;
      const reach = 260;
      out.left = [P(cx - HALF, y0), P(cx - HALF, y0 + h), P(cx - HALF - reach, y0 + h)];
      out.right = [P(cx + HALF, y0), P(cx + HALF, y0 + h), P(cx + HALF + reach, y0 + h)];
      out.center = [P(cx, y0), P(cx, y0 + h)];
      feat({ kind: 'gutter', x: cx, y: y0 + h });
      break;
    }
    default:
      throw new Error(`unknown piece ${piece.k}`);
  }
  extras(out, piece, cx, y0);
  return out;
}

/** Height of a piece without building it. */
export function pieceHeight(piece) {
  if (piece.k === 'jog') return (piece.a ?? 120) + Math.abs(piece.d) + (piece.b ?? 120);
  if (piece.k === 'start') return piece.h ?? 160;
  if (piece.k === 'top') return piece.h ?? 120;
  if (piece.k === 'bracket') return piece.h ?? 260;
  if (piece.k === 'alcove') return piece.h ?? 240;
  if (piece.k === 'hopper') return ((piece.w ?? 230) - HALF) * 2 + (piece.h ?? 420);
  return piece.h;
}
