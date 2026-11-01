// A spout as a course: its level and its rain (built once per spout and seed), the start line, and the hazards that knock a
// spider (falling debris, the bird). Pure.

import { buildLevel, featuresIn } from './level.js';
import { makeWeather, debrisIn, pecked } from './weather.js';
import { knock } from './spider.js';
import { spoutById } from './spouts.js';
import { DEBRIS_HIT } from './config.js';

/** The start positions across the drain's floor for n racers. */
export function startXs(n) {
  const out = [];
  const span = 140;
  for (let i = 0; i < n; i++) out.push(n === 1 ? -40 : -span / 2 + (span * i) / (n - 1));
  return out;
}

const levels = new Map();
/** Levels are pure functions of the spout: build each once. */
export function levelFor(id) {
  let L = levels.get(id);
  if (!L) {
    const def = spoutById(id);
    L = buildLevel(def.pieces, { name: def.name });
    levels.set(id, L);
  }
  return L;
}

export function weatherFor(id, seed, level = levelFor(id)) {
  const def = spoutById(id);
  return makeWeather({ top: level.H, rain: def.rain, debris: def.debris ?? null, seed, firstCalm: def.firstCalm ?? 5, maxT: 420 });
}

const hits = [];

/** Debris and the bird against one spider. Returns the kind of knock that took, or ''. */
export function applyHazards(sp, level, weather, t, seed, memo) {
  if (sp.mode !== 'surf' && sp.mode !== 'air' && sp.mode !== 'swing') return '';
  debrisIn(level, weather, sp.y - 30, sp.y + 30, t, hits);
  for (const h of hits) {
    if (Math.abs(h.x - sp.x) < DEBRIS_HIT && Math.abs(h.y - sp.y) < DEBRIS_HIT + 4) {
      if (memo.debris === h.d.id) continue;
      memo.debris = h.d.id;
      const away = h.d.lane === 'L' ? 1 : -1;
      if (knock(sp, away * 200, -260, 'debris')) return 'debris';
      return '';
    }
  }
  for (const seam of featuresIn(level, 'seam', sp.y - 50, sp.y + 50)) {
    if (memo.bird > t) continue;
    if (pecked(level, seam, seed, t, sp.x, sp.y)) {
      memo.bird = t + 0.6;
      const away = seam.side === 'L' ? 1 : -1;
      if (knock(sp, away * 380, -150, 'bird')) return 'bird';
    }
  }
  return '';
}
