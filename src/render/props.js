// What stands at the foot of the wall: grass that moves in the wind, flowerpots, a watering can, tools leaning on the
// wall, a bucket, crates, a gnome, hay, bins, a buoy. All giants at a spider's size. Plus the shared wind.

import * as THREE from 'three';
import { pbr, plain, canvasTex } from './tex.js';
import { WALL_T, DEPTH } from '../sim/config.js';

const D2 = DEPTH / 2;

export const wind = { uniforms: { time: { value: 0 }, strength: { value: 0.6 } } };

/** Makes a material sway with the wind: vertices move by their height in the model (uv.y), instance by instance. */
export function windMaterial(mat, amount = 1) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.wTime = wind.uniforms.time;
    sh.uniforms.wStrength = wind.uniforms.strength;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float wTime; uniform float wStrength;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = ip.x * 0.013 + ip.y * 0.007 + ip.z * 0.011;
          float k = uv.y * uv.y * ${amount.toFixed(2)};
          float s = sin(wTime * 1.7 + ph) * 0.6 + sin(wTime * 3.1 + ph * 1.7) * 0.25;
          transformed.x += s * k * 0.16 * wStrength;
          transformed.z += cos(wTime * 1.3 + ph) * k * 0.08 * wStrength;
        }`,
      );
  };
  mat.customProgramCacheKey = () => `wind${amount}`;
  return mat;
}

export function buildProps(level, theme, rnd, ZW) {
  const group = new THREE.Group();
  const updates = [];
  const pipeLo = level.spans[0].cx - level.spans[0].half - WALL_T - 60;
  const pipeHi = level.spans[0].cx + level.spans[0].half + WALL_T + 60;
  const free = (x, w) => x + w < pipeLo || x - w > pipeHi;

  if (theme.ground.kind === 'grass') group.add(grass(rnd, ZW, pipeLo, pipeHi, theme));
  else group.add(pebbles(rnd, ZW, pipeLo, pipeHi, theme.ground.kind === 'rocks'));
  group.add(puddle(rnd, ZW, pipeLo, pipeHi));

  // the theme's things, placed either side of the drain, nearest first
  const spots = [-1, 1].flatMap((s) => [s * (400 + rnd() * 90), s * (900 + rnd() * 200), s * (1500 + rnd() * 300)]);
  spots.sort((a, b) => Math.abs(a) - Math.abs(b));
  let si = 0;
  for (const kind of theme.props ?? []) {
    let x = spots[si++ % spots.length];
    if (!free(x, 260)) x += x < 0 ? -300 : 300;
    const p = makeProp(kind, rnd);
    if (!p) continue;
    p.scale.multiplyScalar(0.62);
    p.userData.depth = (p.userData.depth ?? 160) * 0.62;
    p.position.x += x;
    p.position.z += ZW + (p.userData.depth ?? 160) + rnd() * 80;
    p.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(p);
    if (p.userData.update) updates.push(p.userData.update);
  }
  return {
    group,
    update(t, mood) {
      for (const u of updates) u(t, mood);
    },
  };
}

// --------------------------------------------------------------------------------------------- grass, pebbles, puddles

function grass(rnd, ZW, lo, hi, theme) {
  const blade = new THREE.PlaneGeometry(1, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const p = blade.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) * (1 - y * 0.92));
    p.setZ(i, y * y * 0.35);
  }
  blade.computeVertexNormals();
  const mat = windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }), 1.4);
  const n = 1800;
  const im = new THREE.InstancedMesh(blade, mat, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const base = new THREE.Color(theme.ground.color).multiply(new THREE.Color(0x7aa04a));
  const c = new THREE.Color();
  let k = 0;
  while (k < n) {
    const x = (rnd() - 0.5) * 5200;
    // a strip along the foot of the wall: anything nearer the camera would stand in front of the climb
    const z = ZW + 10 + Math.pow(rnd(), 1.4) * 300;
    // keep the drain and the pipe's foot clear
    if (x > lo - 80 && x < hi + 80) continue;
    const near = Math.min(1, Math.max(0, (Math.abs(x - (lo + hi) / 2) - (hi - lo) / 2) / 400));
    const h = (30 + rnd() * 80) * (0.55 + 0.45 * near);
    e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(5 + rnd() * 5, h, 5));
    im.setMatrixAt(k, m4);
    c.copy(base).offsetHSL((rnd() - 0.5) * 0.06, 0, (rnd() - 0.5) * 0.12);
    im.setColorAt(k, c);
    k++;
  }
  im.receiveShadow = true;
  im.castShadow = false;
  return im;
}

function pebbles(rnd, ZW, lo, hi, big) {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + Math.sin(v.x * 5.1 + v.y * 3.3) * 0.12 + Math.cos(v.z * 4.7) * 0.1;
    p.setXYZ(i, v.x * k, v.y * k * 0.6, v.z * k);
  }
  geo.computeVertexNormals();
  const mat = plain('pebble', { color: 0x9a948a, roughness: 0.85 });
  const n = big ? 160 : 90;
  const im = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    let x = (rnd() - 0.5) * 4400;
    const z = ZW + 30 + rnd() * 1300;
    if (x > lo - 40 && x < hi + 40 && z < D2 + 100) x += x < 0 ? -400 : 400;
    const s = (big ? 30 : 10) + rnd() * (big ? 120 : 26);
    q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
    m4.compose(new THREE.Vector3(x, s * 0.25, z), q, new THREE.Vector3(s, s, s * (0.7 + rnd() * 0.5)));
    im.setMatrixAt(k, m4);
    c.setHSL(0.08 + rnd() * 0.05, 0.08 + rnd() * 0.1, 0.35 + rnd() * 0.3);
    im.setColorAt(k, c);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

function puddle(rnd, ZW, lo, hi) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x0c1418, roughness: 0.02, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), mat);
    m.rotation.x = -Math.PI / 2;
    const s = 160 + rnd() * 300;
    m.scale.set(s, s * (0.35 + rnd() * 0.3), 1);
    let x = (rnd() - 0.5) * 2600;
    if (x > lo - s && x < hi + s) x = x < 0 ? lo - s - 40 : hi + s + 40;
    m.position.set(x, 0.4, ZW + 260 + rnd() * 600);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

// --------------------------------------------------------------------------------------------- props

function lathe(profile, segs, mat) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat);
}

function terracotta() {
  return pbr('Bricks059', { tile: 300, color: 0xd88a60, rough: 0.9, key: 'terracotta' });
}

function pot(rnd, size = 1) {
  const g = new THREE.Group();
  const s = size * (220 + rnd() * 120);
  const body = lathe([[0, 0], [s * 0.36, 0], [s * 0.48, s * 0.82], [s * 0.56, s * 0.84], [s * 0.56, s], [s * 0.48, s], [s * 0.46, s * 0.86], [0, s * 0.86]], 28, terracotta());
  g.add(body);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(s * 0.46, 24), plain('soil', { color: 0x2a1c14, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = s * 0.9;
  g.add(soil);
  // a plant: a fan of leaves, sometimes flowers
  const leafMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0x4f8a34, roughness: 0.6, side: THREE.DoubleSide }), 0.8);
  const n = 7 + Math.floor(rnd() * 6);
  for (let k = 0; k < n; k++) {
    const lg = new THREE.PlaneGeometry(s * 0.22, s * (0.6 + rnd() * 0.5), 1, 4);
    lg.translate(0, lg.parameters.height / 2, 0);
    const lp = lg.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const y = lp.getY(i) / lg.parameters.height;
      lp.setX(i, lp.getX(i) * Math.sin(Math.PI * Math.min(1, y * 1.1 + 0.05)));
      lp.setZ(i, y * y * s * 0.25);
    }
    lg.computeVertexNormals();
    const leaf = new THREE.Mesh(lg, leafMat);
    leaf.position.y = s * 0.88;
    leaf.rotation.set(0, (k / n) * Math.PI * 2 + rnd() * 0.4, 0);
    leaf.rotateX(-0.25 - rnd() * 0.5);
    g.add(leaf);
  }
  if (rnd() < 0.6) {
    const fc = [0xe84a5f, 0xffc93c, 0xf6f1e9, 0x9b5de5][Math.floor(rnd() * 4)];
    const fm = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.5, emissive: new THREE.Color(fc), emissiveIntensity: 0.06 });
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.09, 1), fm);
      const a = rnd() * Math.PI * 2;
      f.position.set(Math.cos(a) * s * 0.25, s * (1.3 + rnd() * 0.35), Math.sin(a) * s * 0.25);
      f.scale.y = 0.6;
      g.add(f);
    }
  }
  g.userData.depth = s * 0.6;
  return g;
}

function wateringCan(rnd) {
  const g = new THREE.Group();
  const zinc = pbr('Metal021', { tile: [0.5, 1], metal: 1, rough: 0.6, color: 0x9fb0a0, key: 'canZinc' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(150, 165, 330, 28), zinc);
  body.position.y = 165;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(14, 26, 420, 12), zinc);
  spout.position.set(210, 300, 0);
  spout.rotation.z = -0.9;
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(42, 24, 40, 16), zinc);
  rose.position.set(370, 420, 0);
  rose.rotation.z = -0.9;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(120, 14, 8, 24, Math.PI), zinc);
  handle.position.set(0, 330, 0);
  g.add(body, spout, rose, handle);
  g.rotation.y = rnd() * 0.6 - 0.3;
  g.userData.depth = 220;
  return g;
}

function tools(rnd) {
  // a rake and a spade leaning on the wall
  const g = new THREE.Group();
  const wood = pbr('WoodSiding008', { tile: [80, 600], color: 0xc89a6a, key: 'handle' });
  const steel = plain('steel', { color: 0x9aa0a6, metalness: 1, roughness: 0.4 });
  const mk = (x, lean, head) => {
    const t = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 2600, 10), wood);
    h.position.y = 1300;
    t.add(h);
    if (head === 'rake') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(420, 30, 30), steel);
      t.add(bar);
      for (let k = 0; k < 12; k++) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(5, 3, 90, 6), steel);
        tine.position.set(-200 + k * 36, -50, 10);
        t.add(tine);
      }
      t.position.y = 90;
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(220, 300, 12), steel);
      blade.position.y = -150;
      t.add(blade);
      t.position.y = 300;
    }
    t.position.x = x;
    t.rotation.z = lean;
    t.rotation.x = -0.12;
    return t;
  };
  g.add(mk(0, 0.12, 'rake'), mk(330, -0.08, 'spade'));
  g.userData.depth = 120;
  return g;
}

function bucket(rnd) {
  const g = new THREE.Group();
  const m = pbr('Metal062C', { tile: [0.5, 1], metal: 1, rough: 0.6, color: 0xc0c8cc, key: 'bucket' });
  const body = lathe([[0, 0], [150, 0], [190, 330], [196, 340], [0, 340]], 28, m);
  const water = new THREE.Mesh(new THREE.CircleGeometry(182, 28), new THREE.MeshPhysicalMaterial({ color: 0x1a2a34, roughness: 0.02, clearcoat: 1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 300;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(190, 6, 6, 24, Math.PI), plain('steel', {}));
  handle.position.y = 340;
  handle.rotation.x = -0.6;
  g.add(body, water, handle);
  g.userData.depth = 260;
  return g;
}

function crates(rnd) {
  const g = new THREE.Group();
  const wood = pbr('WoodSiding005', { tile: 1, color: 0xd8b088, key: 'crate' });
  for (let k = 0; k < 2; k++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(520, 340, 380), wood);
    c.position.set(k * 80 - 40, 170 + k * 340, 0);
    c.rotation.y = (rnd() - 0.5) * 0.3;
    g.add(c);
  }
  // loaves peeking out of the top one
  const bread = new THREE.MeshStandardMaterial({ color: 0xc88440, roughness: 0.7 });
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 10), bread);
    b.scale.set(1.5, 0.8, 0.9);
    b.position.set(-170 + k * 110, 700, (rnd() - 0.5) * 120);
    g.add(b);
  }
  g.userData.depth = 260;
  return g;
}

function gnome(rnd) {
  const g = new THREE.Group();
  const red = plain('gnomeRed', { color: 0xc8302a, roughness: 0.5 });
  const blue = plain('gnomeBlue', { color: 0x2a5aa8, roughness: 0.5 });
  const skin = plain('gnomeSkin', { color: 0xf0c8a0, roughness: 0.6 });
  const white = plain('gnomeWhite', { color: 0xf4f0e8, roughness: 0.8 });
  const body = lathe([[0, 0], [150, 0], [160, 60], [130, 380], [0, 400]], 20, blue);
  const head = new THREE.Mesh(new THREE.SphereGeometry(95, 20, 14), skin);
  head.position.y = 470;
  const beard = new THREE.Mesh(new THREE.ConeGeometry(110, 260, 18), white);
  beard.position.set(0, 360, 50);
  beard.rotation.x = Math.PI;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(110, 360, 20), red);
  hat.position.y = 680;
  hat.rotation.z = 0.15;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(30, 12, 8), skin);
  nose.position.set(0, 470, 95);
  g.add(body, head, beard, hat, nose);
  g.rotation.y = rnd() * 0.8 - 0.2;
  g.userData.depth = 220;
  return g;
}

function hay(rnd) {
  const tex = canvasTex('hay', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9a248';
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) {
      ctx.strokeStyle = ['#e0c060', '#a07a2a', '#d8b450'][k % 3];
      ctx.lineWidth = 1 + (k % 2);
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 10);
      ctx.stroke();
    }
  });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1100, 520, 560), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  b.position.y = 260;
  b.rotation.y = (rnd() - 0.5) * 0.3;
  const g = new THREE.Group();
  g.add(b);
  g.userData.depth = 320;
  return g;
}

function lantern(rnd) {
  const g = new THREE.Group();
  const iron = plain('lampIron', { color: 0x1c1d20, metalness: 0.8, roughness: 0.45 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(90, 100, 30, 12), iron);
  base.position.y = 15;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 170, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.8, 0.8), side: THREE.DoubleSide }));
  glass.position.y = 115;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(100, 70, 12), iron);
  cap.position.y = 235;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 8, 6, 16), iron);
  ring.position.y = 290;
  g.add(base, glass, cap, ring);
  g.userData.depth = 200;
  return g;
}

function bins(rnd) {
  const g = new THREE.Group();
  const col = [0x2a5a3a, 0x2a3a5a, 0x5a5a5a][Math.floor(rnd() * 3)];
  const plastic = plain(`bin${col}`, { color: col, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(700, 1300, 720), plastic);
  body.position.y = 650;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(740, 60, 780), plastic);
  lid.position.y = 1330;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 60, 20), plain('rubber', { color: 0x111111, roughness: 0.9 }));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(-330, 120, -260);
  const w2 = wheel.clone();
  w2.position.x = 330;
  g.add(body, lid, wheel, w2);
  g.userData.depth = 420;
  return g;
}

function buoy(rnd) {
  const g = new THREE.Group();
  const tex = canvasTex('buoy', 256, 64, (ctx, w, h) => {
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = (x / 32) % 2 ? '#f4f0e8' : '#d8302a';
      ctx.fillRect(x, 0, 32, h);
    }
  });
  const t = new THREE.Mesh(new THREE.TorusGeometry(240, 80, 16, 40), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  t.rotation.x = -0.25;
  t.position.y = 330;
  g.add(t);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(180, 24, 8, 30), plain('rope', { color: 0xb8a070, roughness: 1 }));
  rope.rotation.x = -Math.PI / 2;
  rope.position.set(500, 24, 100);
  g.add(rope);
  g.userData.depth = 180;
  return g;
}

function milk(rnd) {
  const m = pbr('Metal062C', { tile: [0.5, 1], metal: 1, rough: 0.5, color: 0xd0d6da, key: 'churn' });
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [200, 0], [210, 30], [200, 620], [120, 760], [110, 860], [140, 880], [140, 920], [0, 930]], 28, m));
  g.userData.depth = 260;
  return g;
}

function ball(rnd) {
  const tex = canvasTex('ball', 256, 128, (ctx, w, h) => {
    const cols = ['#e83a3a', '#f4f0e8', '#2a6ae8', '#f4c83a'];
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = cols[(x / 32) % 4];
      ctx.fillRect(x, 0, 32, h);
    }
  });
  const b = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 20), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.6 }));
  b.position.y = 260;
  const g = new THREE.Group();
  g.add(b);
  g.userData.depth = 380;
  return g;
}

function makeProp(kind, rnd) {
  switch (kind) {
    case 'pots':
      return pot(rnd);
    case 'can':
      return wateringCan(rnd);
    case 'tools':
      return tools(rnd);
    case 'bucket':
      return bucket(rnd);
    case 'crates':
      return crates(rnd);
    case 'gnome':
      return gnome(rnd);
    case 'hay':
      return hay(rnd);
    case 'lantern':
    case 'candles':
      return lantern(rnd);
    case 'bins':
      return bins(rnd);
    case 'buoy':
    case 'rope':
      return buoy(rnd);
    case 'milk':
      return milk(rnd);
    case 'ball':
      return ball(rnd);
    case 'bench':
    case 'stone':
    case 'bike':
      return pot(rnd, 1.3);
    default:
      return null;
  }
}
