// A run's ghost: the spider sampled ten times a second, packed small enough for a save (deltas, whole units).

export const GHOST_HZ = 10;
const MAX_SAMPLES = 3000; // five minutes

export function createRecorder() {
  return { xs: [], ys: [], as: [], ms: [], acc: 0 };
}

/** Feed it every frame; it keeps a sample every 1/10 s. */
export function record(rec, dt, x, y, angle, mode) {
  rec.acc += dt;
  if (rec.xs.length && rec.acc < 1 / GHOST_HZ) return;
  rec.acc = rec.xs.length ? rec.acc - 1 / GHOST_HZ : 0;
  if (rec.xs.length >= MAX_SAMPLES) return;
  rec.xs.push(Math.round(x));
  rec.ys.push(Math.round(y));
  rec.as.push(Math.round(angle / 4));
  rec.ms.push(mode | 0);
}

/** Packs a recording: { v, n, d: "x,y,a,m;dx,dy,a,m;..." } with deltas. */
export function packGhost(rec, time) {
  const parts = [];
  let px = 0;
  let py = 0;
  for (let i = 0; i < rec.xs.length; i++) {
    parts.push(`${rec.xs[i] - px},${rec.ys[i] - py},${rec.as[i]},${rec.ms[i]}`);
    px = rec.xs[i];
    py = rec.ys[i];
  }
  return { v: 1, t: Math.round(time * 100) / 100, d: parts.join(';') };
}

/** Unpacks a saved ghost, or null if it doesn't look like one. */
export function unpackGhost(data) {
  if (!data || typeof data !== 'object' || data.v !== 1 || typeof data.d !== 'string' || data.d.length > 120000) return null;
  const xs = [];
  const ys = [];
  const as = [];
  const ms = [];
  let x = 0;
  let y = 0;
  for (const chunk of data.d.split(';')) {
    const f = chunk.split(',').map(Number);
    if (f.length !== 4 || f.some((v) => !Number.isFinite(v))) return null;
    x += f[0];
    y += f[1];
    xs.push(x);
    ys.push(y);
    as.push(f[2] * 4);
    ms.push(f[3]);
  }
  if (!xs.length) return null;
  return { xs, ys, as, ms, t: Number(data.t) || 0 };
}

/** Where the ghost is at time t (seconds since GO): { x, y, a, m } or null after its end. */
export function ghostAt(g, t, out = {}) {
  const f = t * GHOST_HZ;
  const i = Math.floor(f);
  if (i < 0 || i >= g.xs.length) return null;
  const j = Math.min(g.xs.length - 1, i + 1);
  const k = f - i;
  out.x = g.xs[i] + (g.xs[j] - g.xs[i]) * k;
  out.y = g.ys[i] + (g.ys[j] - g.ys[i]) * k;
  let da = g.as[j] - g.as[i];
  if (da > 180) da -= 360;
  if (da < -180) da += 360;
  out.a = g.as[i] + da * k;
  out.m = g.ms[i];
  return out;
}
