// One frame of the world: the cached scene, the water, hazards, spiders, particles, rain and mood, in that order.

import { drawStatic, drawShafts, drawRain, drawIvy, drawMood, drawVents, drawDebris, drawBird } from './scene.js';
import { drawWater, drawFlood } from './water.js';
import { drawSpider, createPuppet, updatePuppet } from './spiderart.js';
import { drawFx } from './fx.js';
import { worldTransform } from './view.js';
import { debrisIn, birdAt } from './weather.js';
import { featuresIn } from './level.js';
import { SEAT_LOOKS } from './config.js';

const GHOST_LOOK = SEAT_LOOKS[5];
const debrisList = [];
const bird = {};

/** Keeps a puppet per racer id and moves it to the racer's state. */
export function updatePuppets(puppets, run, dt, extra = []) {
  for (const r of run.racers) {
    let p = puppets.get(r.id);
    if (!p) puppets.set(r.id, (p = createPuppet()));
    updatePuppet(p, r.st, dt);
  }
  for (const e of extra) {
    let p = puppets.get(e.id);
    if (!p) puppets.set(e.id, (p = createPuppet()));
    updatePuppet(p, e.st, dt);
  }
}

/**
 * rs: { t (weather time), puppets, fx, rain, water, calm, gloom, flash, heavy, ghost: { id, st } | null, flood, meId,
 *       hideIds: Set }
 */
export function renderWorld(ctx, view, scene, run, rs) {
  drawStatic(ctx, scene, view, { calm: rs.calm, t: rs.real ?? rs.t });
  worldTransform(ctx, view);
  drawVents(ctx, scene, view, rs.real ?? rs.t);
  if (run) {
    drawWater(ctx, scene, view, run.weather, rs.t, rs.water);
    if (rs.flood != null) drawFlood(ctx, scene, view, rs.flood, rs.real ?? rs.t);
    for (const d of debrisIn(run.level, run.weather, view.y0, view.y1, rs.t, debrisList)) drawDebris(ctx, d.d.kind, d.x, d.y, rs.t, d.d.id);
    for (const seam of featuresIn(run.level, 'seam', view.y0 - 100, view.y1 + 100)) drawBird(ctx, run.level, seam, birdAt(seam, run.seed, rs.t, bird), rs.t);
    // Spiders: the ghost, everyone else, then you on top.
    if (rs.ghost) {
      const p = rs.puppets.get(rs.ghost.id);
      if (p) drawSpider(ctx, p, GHOST_LOOK, { ghost: true, alpha: 0.5 });
    }
    let me = null;
    for (const r of run.racers) {
      if (rs.hideIds?.has(r.id)) continue;
      if (r.me) {
        me = r;
        continue;
      }
      const p = rs.puppets.get(r.id);
      if (!p || r.st.y < view.y0 - 60 || r.st.y > view.y1 + 60) continue;
      drawSpider(ctx, p, r.look, { alpha: r.left ? 0.35 : r.away ? 0.55 : 1 });
    }
    if (me && !(me.sp && me.sp.mode === 'drowned' && rs.flood != null && me.sp.y < rs.flood - 60)) {
      const p = rs.puppets.get(me.id);
      if (p) drawSpider(ctx, p, me.look, {});
    }
  }
  drawFx(ctx, rs.fx, view);
  drawShafts(ctx, view, rs.calm, rs.real ?? rs.t);
  if (rs.rain) drawRain(ctx, view, rs.rain, rs.heavy, rs.real ?? rs.t);
  drawIvy(ctx, scene, view);
  drawMood(ctx, view, rs.gloom, rs.flash);
}
