// The renderer's director: shows one run (its spout's world, water, rain, flies, debris, birds, silk and a rig per
// spider), moves the camera, sets the light by the weather and the hour, and spawns the effects of what the spiders do.

import * as THREE from 'three';
import { createStage } from './stage.js';
import { worldFor } from './world.js';
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createRain } from './rain.js';
import { createFx, createJuice } from './fx.js';
import { createSpider } from './spider.js';
import { createFlies, createDebris, createBirds, createSilk } from './actors.js';
import { setAnisotropy } from './tex.js';
import { DEPTH } from '../sim/config.js';

const D2 = DEPTH / 2;

const HOUR = {
  day: { sun: [1.0, 0.94, 0.84], sunI: 3.1, dir: [-0.32, 0.78, 0.54], sky: [0.75, 0.85, 1.0], ground: [0.32, 0.28, 0.22], hemiI: 1.0, env: 0.75, exposure: 1.0, warm: 0.04, night: 0, fog: [0.7, 0.76, 0.82] },
  dawn: { sun: [1.0, 0.72, 0.52], sunI: 3.0, dir: [0.62, 0.42, 0.66], sky: [0.78, 0.74, 0.92], ground: [0.3, 0.22, 0.2], hemiI: 0.75, env: 0.55, exposure: 1.04, warm: 0.08, night: 0.05, fog: [0.78, 0.7, 0.74] },
  dusk: { sun: [1.0, 0.56, 0.3], sunI: 3.2, dir: [-0.66, 0.36, 0.66], sky: [0.5, 0.52, 0.8], ground: [0.26, 0.17, 0.14], hemiI: 0.6, env: 0.42, exposure: 1.06, warm: 0.1, night: 0.2, fog: [0.55, 0.46, 0.52] },
  night: { sun: [0.5, 0.62, 1.0], sunI: 0.75, dir: [0.42, 0.72, 0.56], sky: [0.16, 0.2, 0.36], ground: [0.06, 0.05, 0.06], hemiI: 0.42, env: 0.12, exposure: 1.12, warm: -0.02, night: 1, fog: [0.08, 0.1, 0.16] },
  storm: { sun: [0.75, 0.8, 0.95], sunI: 1.4, dir: [-0.2, 0.85, 0.5], sky: [0.4, 0.46, 0.56], ground: [0.16, 0.15, 0.14], hemiI: 0.7, env: 0.38, exposure: 1.12, warm: -0.03, night: 0.3, fog: [0.36, 0.4, 0.46] },
};

export function createView(host, opts = {}) {
  const stage = createStage(host, { quality: opts.quality ?? 'high', preserve: opts.preserve });
  setAnisotropy(stage.renderer.capabilities.getMaxAnisotropy());
  const { scene, camera } = stage;
  const sky = createSky();
  scene.add(sky.dome, sky.skyline);
  const fx = createFx();
  scene.add(fx.mesh);
  const juice = createJuice();
  let rain = createRain(stage.quality === 'low' ? 1200 : stage.quality === 'medium' ? 2200 : 3400);
  scene.add(rain.mesh);
  const silk = createSilk();
  scene.add(silk.group);
  // a pool of two warm lights that go to the nearest wall lamps
  const lampLights = [0, 1].map(() => {
    const l = new THREE.PointLight(0xffb060, 0, 1100, 2);
    scene.add(l);
    return l;
  });

  let cur = null; // { run, world, water, flies, debris, birds, rigs: Map }
  const tmpV = new THREE.Vector3();
  const sunDir = new THREE.Vector3(-0.32, 0.78, 0.54).normalize();
  const mood = { calm: 1, gloom: 0, drizzle: 0, flash: 0, sunny: 0, storm: 0 };
  const camState = { x: 0, y: 0, viewH: 560, lean: 0 };

  function show(run) {
    if (cur?.run === run) return;
    if (cur) {
      scene.remove(cur.world.group, cur.water.mesh, cur.flies.group, cur.debris.group, cur.birds.group);
      for (const rig of cur.rigs.values()) scene.remove(rig.root);
    }
    const world = worldFor(run.level, run.def);
    const water = cur?.run.level === run.level ? cur.water : createWater(run.level, world.pipe.outline);
    const flies = createFlies(run.level);
    const debris = createDebris();
    const birds = createBirds(run.level, run.seed);
    scene.add(world.group, water.mesh, flies.group, debris.group, birds.group);
    sky.setTheme(world.theme);
    cur = { run, world, water, flies, debris, birds, rigs: new Map(), hour: HOUR[world.theme.time] ?? HOUR.day };
    sunDir.set(...cur.hour.dir).normalize();
    fx.clear();
    silk.hideAll();
  }

  function rigFor(r) {
    let rig = cur.rigs.get(r.id);
    if (!rig || rig.lookKey !== lookKey(r)) {
      if (rig) scene.remove(rig.root);
      rig = createSpider(r.look, { ghost: r.ghost });
      rig.lookKey = lookKey(r);
      scene.add(rig.root);
      cur.rigs.set(r.id, rig);
    }
    return rig;
  }
  const lookKey = (r) => `${r.look.color}|${r.look.mark}|${r.look.species ?? ''}|${r.look.hat ?? ''}|${r.ghost ? 1 : 0}`;

  function wallXAt(side, y) {
    const pts = side === 'L' ? cur.run.level.left : cur.run.level.right;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a[1] <= y && b[1] >= y && b[1] > a[1]) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
    }
    return side === 'L' ? -100 : 100;
  }

  /**
   * One frame. s: { t (run time), dt (real), cam: { x, y, viewH, lean }, weather: { gloom, calm, drizzle, sunny },
   *   racers: [{ id, look, st, ghost, wet, hidden }], me (racer or null), ate (Uint8Array or null), flood (y or null) }
   */
  function frame(s) {
    if (!cur) return;
    const dt = s.dt;
    juice.update(dt);
    const run = cur.run;
    const level = run.level;
    const hr = cur.hour;
    // ---- mood
    const k = 1 - Math.exp(-dt * 2.5);
    mood.gloom += ((s.weather?.gloom ?? 0) - mood.gloom) * k;
    mood.sunny += ((s.weather?.sunny ?? 0) - mood.sunny) * k;
    mood.drizzle += ((s.weather?.drizzle ?? 0) - mood.drizzle) * (1 - Math.exp(-dt * 4));
    const g = Math.max(0, mood.gloom - mood.sunny);
    const flash = juice.flash;
    const L = stage.lights;
    const sunI = hr.sunI * (1 - g * 0.78) * (1 + mood.sunny * 0.25);
    L.sun.color.setRGB(hr.sun[0], hr.sun[1], hr.sun[2]).lerp(tmpColor.setRGB(0.7, 0.8, 1.0), g * 0.6);
    L.sun.intensity = sunI + flash * 6;
    L.hemi.color.setRGB(hr.sky[0], hr.sky[1], hr.sky[2]).lerp(tmpColor.setRGB(0.42, 0.5, 0.62), g * 0.7);
    L.hemi.groundColor.setRGB(hr.ground[0], hr.ground[1], hr.ground[2]);
    L.hemi.intensity = hr.hemiI * (1 - g * 0.25) + flash * 3;
    L.fill.intensity = 0.35 + g * 0.2;
    stage.scene.environmentIntensity = hr.env * (1 - g * 0.35) + flash;
    const gu = stage.grade;
    gu.exposure.value = hr.exposure * (1 + mood.sunny * 0.08) * (1 - g * 0.06);
    const warm = hr.warm * (1 - g) + mood.sunny * 0.05 - g * 0.05;
    gu.gain.value.set(1 + warm, 1, 1 - warm * 1.2);
    gu.lift.value.set(0.01, 0.015, 0.03 + g * 0.02);
    gu.sat.value = 1.08 - g * 0.3 + mood.sunny * 0.1;
    gu.contrast.value = 1.04 + g * 0.05;
    gu.vignette.value = 0.32 + g * 0.18;
    gu.flash.value = juice.flash * 0.35;
    gu.flashColor.value.copy(juice.flashColor);
    gu.aberr.value = juice.trauma * 1.5;
    scene.fog.color.setRGB(hr.fog[0], hr.fog[1], hr.fog[2]).lerp(tmpColor.setRGB(0.4, 0.46, 0.54).multiplyScalar(hr.night ? 0.4 : 1), g * 0.7);
    sky.uniforms.storm.value = Math.min(1, g * 1.1 + (run.def.lightning ? 0.15 : 0));
    sky.uniforms.night.value = hr.night;
    sky.uniforms.flash.value = flash;
    sky.uniforms.time.value = s.real;
    if (stage.bloom) stage.bloom.strength = 0.42 + mood.sunny * 0.25 + flash * 0.4;

    // ---- camera
    const c = s.cam;
    const punch = juice.punch;
    const viewH = c.viewH * (1 - punch * 0.12);
    const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const cx = c.x + juice.sx * (viewH / 700);
    const cy = c.y + juice.sy * (viewH / 700);
    const yawX = 70 + (c.lean ?? 0);
    camera.position.set(cx + yawX, cy + 95, dist);
    camera.lookAt(cx, cy, 0);
    camera.rotateZ(juice.rot);
    camera.far = dist + 40000;
    camera.updateProjectionMatrix();
    stage.aimSun(cx, cy, viewH * 2.6, sunDir);
    sky.place(camera, level.H);
    camState.x = cx;
    camState.y = cy;
    camState.viewH = viewH;
    const y0 = cy - viewH * 0.75;
    const y1 = cy + viewH * 0.75;

    // ---- world
    cur.world.update(s.real, { storm: g });
    const bands = cur.water.update(run.weather, s.t, mood.drizzle, flash);
    cur.water.setLight(sunDir, L.sun.color);
    rain.update(s.real, camera.position, Math.min(1, 0.06 + g * 0.85 + mood.drizzle * 0.3 + (run.def.lightning ? 0.1 : 0)) * (1 - mood.sunny), 0.12 + g * 0.25, flash);
    cur.flies.update(s.real, dt, s.ate ?? null, fx);
    cur.debris.update(level, run.weather, y0, y1, s.t);
    cur.birds.update(s.t, wallXAt);
    // the lamps nearest the camera get the two lights
    const lamps = cur.world.facade.lamps;
    const near = lamps.length ? lamps.map((l) => [Math.abs(l.y - cy), l]).sort((a, b) => a[0] - b[0]) : [];
    lampLights.forEach((l, i) => {
      const n = near[i]?.[1];
      if (n) {
        l.position.set(n.x, n.y - 10, n.z);
        l.intensity = (hr.night ? 2.2e5 : 1.2e5) * (0.85 + Math.sin(s.real * 13 + i) * 0.03);
      } else l.intensity = 0;
    });
    // spray where the water's front is in view
    for (const b of bands) {
      if (b.front > y0 && b.front < y1 + 100 && b.front < b.tail) {
        const n = Math.min(4, Math.ceil(dt * 160 * b.heavy));
        for (let i = 0; i < n; i++) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const x = centerXAt(level, b.front) + side * (80 + Math.random() * 18);
          fx.spray(b.front > 0 ? x : x, b.front + 6, 1, Math.PI / 2 + side * 0.5, 1.2, 220, D2 * (Math.random() * 1.6 - 0.8));
        }
      }
    }

    // ---- spiders
    const seen = new Set();
    for (const r of s.racers) {
      if (!r.st || r.hidden) continue;
      seen.add(r.id);
      const rig = rigFor(r);
      rig.setVisible(true);
      const anchor = r.st.k >= 0 && r.st.m === 'swing' ? level.snags[r.st.k] : null;
      rig.update(r.st, { dt, t: s.t, cam: camera.position, anchor, wet: r.wet });
      if (anchor) {
        tmpV.set(r.st.x, r.st.y, 2);
        silk.set(r.id, tmpV, anchor, 1);
      } else silk.set(r.id, null);
    }
    for (const [id, rig] of cur.rigs) if (!seen.has(id)) rig.setVisible(false);

    fx.update(dt);
    stage.render(dt, s.real);
  }

  function project(x, y, z = 0, out = {}) {
    tmpV.set(x, y, z).project(camera);
    const { w, h } = stage.size;
    out.x = (tmpV.x * 0.5 + 0.5) * w;
    out.y = (-tmpV.y * 0.5 + 0.5) * h;
    out.on = tmpV.z < 1 && tmpV.x > -1.2 && tmpV.x < 1.2 && tmpV.y > -1.2 && tmpV.y < 1.2;
    return out;
  }

  return {
    stage,
    fx,
    juice,
    show,
    frame,
    project,
    rigFor: (r) => (cur ? rigFor(r) : null),
    get run() {
      return cur?.run ?? null;
    },
    get cam() {
      return camState;
    },
    resize(w, h, pr) {
      stage.resize(w, h, pr);
    },
    setQuality(q) {
      stage.setQuality(q);
      scene.remove(rain.mesh);
      rain = createRain(q === 'low' ? 1200 : q === 'medium' ? 2200 : 3400);
      scene.add(rain.mesh);
      fx.density = q === 'low' ? 0.5 : 1;
    },
  };
}

const tmpColor = new THREE.Color();

/** The pipe's centre x at height y. */
export function centerXAt(level, y) {
  const c = level.center;
  if (!c.length) return 0;
  let lo = 0;
  let hi = c.length - 1;
  if (y <= c[0][1]) return c[0][0];
  if (y >= c[hi][1]) return c[hi][0];
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (c[m][1] <= y) lo = m;
    else hi = m;
  }
  const a = c[lo];
  const b = c[hi];
  if (b[1] === a[1]) return a[0];
  return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
}
