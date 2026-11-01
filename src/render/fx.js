// Particles: water spray and droplets, dust, sparks, confetti, stars, splash rings, silk glints. One pool, simulated on
// the CPU, drawn as camera-facing quads in one call (premultiplied, so glowing and plain particles mix). Plus the camera's
// shake (trauma), hit-stop, flash and slow motion.

import * as THREE from 'three';
import { canvasTex } from './tex.js';

const MAX = 2400;
const SHAPES = { disc: 0, drop: 1, star: 2, square: 3, ring: 4, spark: 5 };

function atlas() {
  return canvasTex(
    'fxAtlas',
    384,
    256,
    (ctx) => {
      ctx.clearRect(0, 0, 384, 256);
      const cell = (i, f) => {
        const x = (i % 3) * 128;
        const y = Math.floor(i / 3) * 128;
        ctx.save();
        ctx.translate(x + 64, y + 64);
        f();
        ctx.restore();
      };
      // soft disc
      cell(0, () => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-64, -64, 128, 128);
      });
      // droplet: a bright round head, a tail
      cell(1, () => {
        const g = ctx.createLinearGradient(0, -60, 0, 60);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.75, 'rgba(255,255,255,0.7)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 60, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.beginPath();
        ctx.arc(0, 40, 18, 0, Math.PI * 2);
        ctx.fill();
      });
      // star
      cell(2, () => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const r = k % 2 ? 22 : 58;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
      });
      // square (confetti)
      cell(3, () => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-40, -56, 80, 112);
      });
      // ring
      cell(4, () => {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
      });
      // spark streak
      cell(5, () => {
        const g = ctx.createLinearGradient(0, -60, 0, 60);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.fillRect(-6, -60, 12, 120);
      });
    },
    { mips: true },
  );
}

export function createFx() {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const aPos = new Float32Array(MAX * 3);
  const aVel = new Float32Array(MAX * 3);
  const aCol = new Float32Array(MAX * 4);
  const aExt = new Float32Array(MAX * 4); // size, rotation, shape, stretch
  const bPos = new THREE.InstancedBufferAttribute(aPos, 3).setUsage(THREE.DynamicDrawUsage);
  const bVel = new THREE.InstancedBufferAttribute(aVel, 3).setUsage(THREE.DynamicDrawUsage);
  const bCol = new THREE.InstancedBufferAttribute(aCol, 4).setUsage(THREE.DynamicDrawUsage);
  const bExt = new THREE.InstancedBufferAttribute(aExt, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('pPos', bPos);
  geo.setAttribute('pVel', bVel);
  geo.setAttribute('pCol', bCol);
  geo.setAttribute('pExt', bExt);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlas() } },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute vec3 pPos, pVel;
      attribute vec4 pCol, pExt;
      varying vec4 vCol;
      varying vec2 vUv;
      void main() {
        vCol = pCol;
        float shape = pExt.z;
        vec2 cell = vec2(mod(shape, 3.0), floor(shape / 3.0));
        vUv = vec2((uv.x + cell.x) / 3.0, (uv.y + 1.0 - cell.y) / 2.0);
        vec4 c = viewMatrix * vec4(pPos, 1.0);
        vec2 q = position.xy * pExt.x;
        if (pExt.w > 0.0) {
          // stretched along the velocity on screen
          vec3 v = (viewMatrix * vec4(pVel, 0.0)).xyz;
          vec2 d = length(v.xy) > 1e-3 ? normalize(v.xy) : vec2(0.0, 1.0);
          vec2 n = vec2(-d.y, d.x);
          float len = 1.0 + length(v.xy) * pExt.w;
          q = n * position.x * pExt.x + d * position.y * pExt.x * len;
        } else {
          float s = sin(pExt.y), co = cos(pExt.y);
          q = vec2(q.x * co - q.y * s, q.x * s + q.y * co);
        }
        c.xy += q;
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec4 vCol;
      varying vec2 vUv;
      void main() {
        float m = texture2D(uMap, vUv).a;
        // vCol.a < 0: glowing (additive), else normal alpha; premultiplied either way
        float a = abs(vCol.a) * m;
        gl_FragColor = vec4(vCol.rgb * a, vCol.a < 0.0 ? 0.0 : a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;

  const P = [];
  const free = [];
  for (let i = 0; i < MAX; i++) {
    P.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 1, r: 1, g: 1, b: 1, a: 1, glow: false, shape: 0, drag: 0, grav: 0, rot: 0, spin: 0, stretch: 0, fade: 1, flutter: 0 });
    free.push(MAX - 1 - i);
  }
  let density = 1;

  function spawn(o) {
    if (density < 1 && Math.random() > density) return null;
    const i = free.pop();
    if (i == null) return null;
    const p = P[i];
    p.on = true;
    p.x = o.x;
    p.y = o.y;
    p.z = o.z ?? 0;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.age = 0;
    p.life = o.life ?? 1;
    p.s0 = o.size ?? 4;
    p.s1 = o.size1 ?? p.s0;
    const c = o.color ?? [1, 1, 1];
    p.r = c[0];
    p.g = c[1];
    p.b = c[2];
    p.a = o.alpha ?? 1;
    p.glow = !!o.glow;
    p.shape = SHAPES[o.shape ?? 'disc'] ?? 0;
    p.drag = o.drag ?? 0;
    p.grav = o.grav ?? 0;
    p.rot = o.rot ?? Math.random() * 6.28;
    p.spin = o.spin ?? 0;
    p.stretch = o.stretch ?? 0;
    p.fade = o.fade ?? 1;
    p.flutter = o.flutter ?? 0;
    return p;
  }

  function update(dt) {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const p = P[i];
      if (!p.on) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.on = false;
        free.push(i);
        continue;
      }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy *= dr;
      p.vz *= dr;
      p.vy -= p.grav * dt;
      if (p.flutter) {
        p.vx += Math.sin(p.age * 9 + i) * p.flutter * dt;
        p.vy = Math.max(p.vy, -140);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
      const k = p.age / p.life;
      const size = p.s0 + (p.s1 - p.s0) * k;
      const alpha = p.a * (p.fade ? Math.min(1, (1 - k) * 2.5) * Math.min(1, p.age * 30) : 1);
      aPos[n * 3] = p.x;
      aPos[n * 3 + 1] = p.y;
      aPos[n * 3 + 2] = p.z;
      aVel[n * 3] = p.vx;
      aVel[n * 3 + 1] = p.vy;
      aVel[n * 3 + 2] = p.vz;
      aCol[n * 4] = p.r;
      aCol[n * 4 + 1] = p.g;
      aCol[n * 4 + 2] = p.b;
      aCol[n * 4 + 3] = p.glow ? -alpha : alpha;
      aExt[n * 4] = size;
      aExt[n * 4 + 1] = p.shape === 3 ? p.rot : p.rot;
      aExt[n * 4 + 2] = p.shape;
      aExt[n * 4 + 3] = p.stretch;
      n++;
    }
    geo.instanceCount = n;
    bPos.needsUpdate = bVel.needsUpdate = bCol.needsUpdate = bExt.needsUpdate = true;
    bPos.addUpdateRange?.(0, n * 3);
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const WATER = [0.75, 0.88, 1.0];

  return {
    mesh,
    spawn,
    update,
    clear() {
      for (let i = 0; i < MAX; i++) {
        if (P[i].on) {
          P[i].on = false;
          free.push(i);
        }
      }
    },
    set density(v) {
      density = v;
    },
    // ---- recipes
    /** Water spray thrown at angle `ang` (radians, 0 = right) with spread. */
    spray(x, y, n, ang = Math.PI / 2, spread = 1, speed = 260, z = 0) {
      for (let i = 0; i < n; i++) {
        const a = ang + (Math.random() - 0.5) * spread;
        const s = speed * rnd(0.4, 1.1);
        spawn({ x, y, z: z + rnd(-30, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(-40, 80), life: rnd(0.35, 0.7), size: rnd(1.6, 3.4), color: WATER, alpha: 0.9, grav: 900, drag: 1.5, shape: 'drop', stretch: 0.012, glow: Math.random() < 0.3 });
      }
      for (let i = 0; i < n / 3; i++) spawn({ x, y, z, vx: rnd(-40, 40), vy: rnd(-20, 60), vz: rnd(0, 40), life: rnd(0.5, 1.0), size: rnd(10, 18), size1: rnd(24, 40), color: [0.85, 0.92, 1], alpha: 0.18, drag: 3, shape: 'disc' });
    },
    /** A puff of dust (landing, scrabbling). */
    puff(x, y, n, z = 0, color = [0.8, 0.78, 0.72]) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rnd(20, 70);
        spawn({ x, y, z: z + rnd(-10, 10), vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s * 0.6, vz: rnd(-20, 20), life: rnd(0.35, 0.6), size: rnd(3, 6), size1: rnd(9, 14), color, alpha: 0.4, drag: 5, shape: 'disc' });
      }
    },
    sparks(x, y, n, z = 0) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rnd(120, 380);
        spawn({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(-60, 60), life: rnd(0.2, 0.45), size: rnd(1.2, 2.2), color: [3, 2.2, 1.0], alpha: 1, glow: true, grav: 500, drag: 2, shape: 'spark', stretch: 0.02 });
      }
    },
    stars(x, y, n, z = 10) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        spawn({ x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 6, z, vx: -Math.sin(a) * 50, vy: Math.cos(a) * 25, life: 0.9, size: 5, size1: 2, color: [2.4, 2.0, 0.6], alpha: 1, glow: true, shape: 'star', spin: 6 });
      }
    },
    confetti(x, y, n, colors, z = 20) {
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const s = rnd(200, 520);
        const c = new THREE.Color(colors[i % colors.length]);
        spawn({ x, y, z: z + rnd(-30, 60), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(-60, 120), life: rnd(1.4, 2.4), size: rnd(3.5, 6), color: [c.r * 1.4, c.g * 1.4, c.b * 1.4], alpha: 1, grav: 420, drag: 2.2, shape: 'square', spin: rnd(-14, 14), flutter: 220 });
      }
    },
    ring(x, y, size = 30, color = [1, 1, 1], z = 5, glow = true) {
      spawn({ x, y, z, life: 0.45, size: size * 0.3, size1: size, color, alpha: 0.9, glow, shape: 'ring', fade: 1 });
    },
    glint(x, y, z = 6, size = 7, color = [3, 3, 3]) {
      spawn({ x, y, z, life: 0.35, size, size1: 0.5, color, alpha: 1, glow: true, shape: 'star', spin: 3 });
    },
    trail(x, y, z, color, size = 2.4) {
      spawn({ x, y, z, life: 0.45, size, size1: 0.3, color, alpha: 0.85, glow: true, shape: 'disc' });
    },
    drip(x, y, z = 0) {
      spawn({ x, y, z, vx: rnd(-10, 10), vy: rnd(-40, 0), life: 0.6, size: 1.6, color: WATER, alpha: 0.9, grav: 900, shape: 'drop', stretch: 0.015, glow: true });
    },
  };
}

/** Camera juice: trauma shake, hit-stop and flashes. */
export function createJuice() {
  return {
    trauma: 0,
    stop: 0,
    flash: 0,
    flashColor: new THREE.Color(1, 1, 1),
    slow: 1,
    slowFor: 0,
    punch: 0,
    sx: 0,
    sy: 0,
    rot: 0,
    reduced: false,
    t: 0,
    add(v) {
      if (!this.reduced) this.trauma = Math.min(1, this.trauma + v);
    },
    hit(s) {
      this.stop = Math.max(this.stop, s);
    },
    flashIt(v, color) {
      if (this.reduced) v *= 0.3;
      this.flash = Math.max(this.flash, v);
      if (color) this.flashColor.set(color);
      else this.flashColor.setRGB(1, 1, 1);
    },
    slowMo(k, s) {
      if (this.reduced) return;
      this.slow = k;
      this.slowFor = s;
    },
    punchIn(v) {
      if (!this.reduced) this.punch = Math.max(this.punch, v);
    },
    update(dt) {
      this.t += dt;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
      const s = this.trauma * this.trauma;
      this.sx = s * 14 * (Math.sin(this.t * 41) + Math.sin(this.t * 23.7) * 0.5);
      this.sy = s * 14 * (Math.cos(this.t * 37) + Math.sin(this.t * 19.3) * 0.5);
      this.rot = s * 0.02 * Math.sin(this.t * 29);
      this.flash = Math.max(0, this.flash - dt * 3.5);
      this.punch = Math.max(0, this.punch - dt * 1.6);
      if (this.slowFor > 0) {
        this.slowFor -= dt;
        if (this.slowFor <= 0) this.slow = 1;
      }
    },
  };
}
