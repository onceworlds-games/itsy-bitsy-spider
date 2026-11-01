// The small things that move: flies buzzing over their spot (one golden fly per spout), debris falling down the pipe
// (acorns, bottle caps, leaves), the sparrow pecking in at a split seam, and silk threads from spiders to bolts.

import * as THREE from 'three';
import { birdAt, debrisIn } from '../sim/weather.js';
import { DEPTH, WALL_T, BIRD_REACH } from '../sim/config.js';

const D2 = DEPTH / 2;

// ------------------------------------------------------------------------------------------- flies

const flyGeo = {
  body: new THREE.SphereGeometry(1, 12, 8),
  wing: (() => {
    const g = new THREE.CircleGeometry(1, 12);
    g.scale(1, 0.42, 1);
    g.translate(0.9, 0, 0);
    return g;
  })(),
};
const flyMats = {
  body: new THREE.MeshPhysicalMaterial({ color: 0x1a3a30, metalness: 0.6, roughness: 0.3, iridescence: 1, iridescenceIOR: 1.5, envMapIntensity: 1.6 }),
  gold: new THREE.MeshPhysicalMaterial({ color: 0xffc040, metalness: 1, roughness: 0.18, emissive: 0xffa020, emissiveIntensity: 0.6, envMapIntensity: 1.8 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x8a1a10, roughness: 0.3 }),
  wing: new THREE.MeshBasicMaterial({ color: 0xd8e8f0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.2), transparent: true, opacity: 0.6, depthWrite: false }),
};
const haloTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
flyMats.halo = new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(1.1, 1.3, 1.1), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
flyMats.haloGold = new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(3, 2.2, 0.7), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });

function makeFly(gold) {
  const g = new THREE.Group();
  const s = gold ? 2.1 : 1.45;
  const body = new THREE.Mesh(flyGeo.body, gold ? flyMats.gold : flyMats.body);
  body.scale.set(4.5 * s, 2.6 * s, 2.6 * s);
  const head = new THREE.Mesh(flyGeo.body, gold ? flyMats.gold : flyMats.body);
  head.scale.setScalar(2.2 * s);
  head.position.x = 4.6 * s;
  const eyeL = new THREE.Mesh(flyGeo.body, flyMats.eye);
  eyeL.scale.setScalar(1.3 * s);
  eyeL.position.set(5.4 * s, 0.8 * s, 1.4 * s);
  const eyeR = eyeL.clone();
  eyeR.position.z = -1.4 * s;
  const wl = new THREE.Mesh(flyGeo.wing, flyMats.wing);
  wl.scale.setScalar(5 * s);
  wl.position.set(0.5 * s, 2 * s, 0.6 * s);
  const wr = wl.clone();
  wr.position.z = -0.6 * s;
  g.add(body, head, eyeL, eyeR, wl, wr);
  // a soft glow behind it, so a fly reads against the zinc from across the pipe (a big warm one for the golden fly)
  const halo = new THREE.Sprite(gold ? flyMats.haloGold : flyMats.halo);
  halo.scale.setScalar(gold ? 54 : 30);
  halo.position.z = -2;
  g.add(halo);
  g.userData.halo = halo;
  g.userData.gold = gold;
  body.castShadow = true;
  g.userData.wings = [wl, wr];
  return g;
}

export function createFlies(level) {
  const group = new THREE.Group();
  const items = level.flies.map((f) => {
    const m = makeFly(f.gold);
    m.position.set(f.x, f.y, 6);
    group.add(m);
    return { f, m, gone: 0 };
  });
  return {
    group,
    /** ate: the local racer's eaten flags (or null to show all). */
    update(t, dt, ate, fx) {
      for (const it of items) {
        const eaten = ate ? ate[it.f.id] : 0;
        if (eaten && !it.gone) {
          it.gone = 1;
          if (fx) {
            fx.ring(it.f.x, it.f.y, it.f.gold ? 46 : 26, it.f.gold ? [3, 2.4, 0.8] : [1.6, 2, 1.6]);
            for (let k = 0; k < (it.f.gold ? 10 : 4); k++) fx.glint(it.f.x + (Math.random() - 0.5) * 30, it.f.y + (Math.random() - 0.5) * 30, 10, it.f.gold ? 9 : 5, it.f.gold ? [3, 2.4, 0.8] : [2, 2.4, 2]);
          }
        }
        if (!eaten) it.gone = 0;
        it.m.visible = !eaten;
        if (!it.m.visible) continue;
        const ph = it.f.id * 1.7;
        it.m.position.set(it.f.x + Math.sin(t * 2.3 + ph) * 7, it.f.y + Math.sin(t * 3.1 + ph) * 5, 6 + Math.cos(t * 1.7 + ph) * 8);
        it.m.rotation.y = Math.sin(t * 1.3 + ph) * 0.8 + (Math.cos(t * 2.3 + ph) > 0 ? 0 : Math.PI);
        const w = Math.sin(t * 90 + ph) * 0.9;
        it.m.userData.wings[0].rotation.x = -0.4 + w;
        it.m.userData.wings[1].rotation.x = 0.4 - w;
        const hs = it.m.userData.gold ? 54 : 30;
        it.m.userData.halo.scale.setScalar(hs * (0.85 + Math.sin(t * 5 + ph) * 0.15));
        if (it.m.userData.gold) {
          if (fx && Math.random() < dt * 6) fx.glint(it.m.position.x + (Math.random() - 0.5) * 18, it.m.position.y + (Math.random() - 0.5) * 18, 12, 5, [3, 2.4, 0.8]);
        }
      }
    },
  };
}

// ------------------------------------------------------------------------------------------- debris

function acorn() {
  const g = new THREE.Group();
  const nut = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xa8702a, roughness: 0.45 }));
  nut.scale.set(9, 12, 9);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(10.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a4024, roughness: 1 }));
  cap.position.y = 5;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 6, 6), cap.material);
  stalk.position.y = 14;
  g.add(nut, cap, stalk);
  return g;
}
function bottleCap() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(13, 14, 5, 21, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 + 0.07 * Math.sign(Math.sin(a * 21));
    if (Math.abs(p.getY(i)) > 1) {
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
  }
  geo.computeVertexNormals();
  const col = [0xc8202a, 0xd8d8d8, 0x2050c0, 0xe0b020][Math.floor(Math.random() * 4)];
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, metalness: 0.9, roughness: 0.3 }));
  g.add(m);
  return g;
}
function fallLeaf() {
  const geo = new THREE.PlaneGeometry(26, 34, 2, 3);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 34 + 0.5;
    p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.max(0.05, y)));
    p.setZ(i, Math.abs(p.getX(i)) * 0.3);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: [0xc8742a, 0xa83a20, 0xd8a03a][Math.floor(Math.random() * 3)], roughness: 0.6, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function createDebris() {
  const group = new THREE.Group();
  const pool = new Map(); // debris id -> mesh
  const list = [];
  return {
    group,
    update(level, weather, y0, y1, t) {
      debrisIn(level, weather, y0, y1, t, list);
      const seen = new Set();
      for (const h of list) {
        const id = h.d.id;
        seen.add(id);
        let m = pool.get(id);
        if (!m) {
          m = h.d.kind === 'acorn' ? acorn() : h.d.kind === 'leaf' ? fallLeaf() : bottleCap();
          m.traverse((o) => o.isMesh && (o.castShadow = true));
          group.add(m);
          pool.set(id, m);
        }
        m.position.set(h.x, h.y, (id % 3) * 20 - 20);
        m.rotation.set(t * 7 + id, t * 5 + id * 2, t * 3);
      }
      for (const [id, m] of pool) {
        if (!seen.has(id)) {
          group.remove(m);
          pool.delete(id);
        }
      }
    },
    clear() {
      for (const m of pool.values()) group.remove(m);
      pool.clear();
    },
  };
}

// ------------------------------------------------------------------------------------------- the bird

// A house sparrow, sculpted: each part is a sphere pushed into shape, coloured per vertex (chestnut crown, grey cheek,
// black bib, streaked brown back, barred wings), so it shades smoothly with no textures. Head at the origin, facing +x.
const tmpC = new THREE.Color();
function shaped(seg, shape, paint) {
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.66));
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u = { x: v.x, y: v.y, z: v.z };
    paint(u, tmpC);
    shape(v);
    pos.setXYZ(i, v.x, v.y, v.z);
    col[i * 3] = tmpC.r;
    col[i * 3 + 1] = tmpC.g;
    col[i * 3 + 2] = tmpC.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
const hashN = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const SP = {
  chestnut: new THREE.Color(0x8a4e26),
  brown: new THREE.Color(0x6e4a2e),
  dark: new THREE.Color(0x2e2018),
  buff: new THREE.Color(0xc9a77c),
  grey: new THREE.Color(0x8d8d88),
  cream: new THREE.Color(0xe6dccb),
  white: new THREE.Color(0xf4f0e6),
  black: new THREE.Color(0x141210),
};

function sparrow() {
  const g = new THREE.Group();
  const feathers = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.08, clearcoat: 1 });
  const beakM = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.45 });
  const legM = new THREE.MeshStandardMaterial({ color: 0xb58a72, roughness: 0.6 });
  // the body: a plump chest tapering to the tail, grey-buff below, streaked brown on the back
  const body = new THREE.Mesh(
    shaped(
      28,
      (v) => {
        const back = v.x < 0;
        const k = back ? 1 + v.x * 0.42 : 1 - v.x * v.x * 0.12;
        v.set(v.x * (back ? 1.3 : 0.9) * 62, v.y * k * (v.y < 0 ? 46 : 40), v.z * k * 40);
      },
      (u, c) => {
        if (u.y < -0.15 + u.x * 0.2) c.copy(SP.cream).lerp(SP.grey, Math.max(0, -u.x) * 0.6);
        else {
          c.copy(SP.brown);
          const streak = hashN(Math.floor(u.x * 9), Math.floor(u.z * 4)) > 0.55;
          if (streak) c.lerp(SP.dark, 0.7);
          else if (hashN(Math.floor(u.x * 7) + 3, Math.floor(u.z * 5)) > 0.6) c.lerp(SP.buff, 0.6);
        }
      },
    ),
    feathers,
  );
  body.position.set(-66, -30, 0);
  body.rotation.z = 0.22;
  // the wings, folded along the back: chestnut with a white bar and dark tips
  const wingGeo = shaped(
    20,
    (v) => v.set(v.x * 50, v.y * 22, v.z * 9),
    (u, c) => {
      if (u.x < -0.55) c.copy(SP.dark);
      else if (Math.abs(u.x + 0.05) < 0.1 && u.y < 0.3) c.copy(SP.white);
      else c.copy(hashN(Math.floor(u.x * 8), 1) > 0.5 ? SP.chestnut : SP.brown).lerp(SP.dark, u.y < -0.3 ? 0.5 : 0);
    },
  );
  const wings = [1, -1].map((s) => {
    const w = new THREE.Mesh(wingGeo, feathers);
    w.position.set(-78, -16, s * 34);
    w.rotation.set(s * -0.18, s * 0.12, 0.3);
    return w;
  });
  // the tail: a fan of dark feathers, cocked up
  const tail = new THREE.Group();
  const featherGeo = shaped(
    10,
    (v) => v.set(v.x * 34 - 30, v.y * 4, v.z * 9),
    (u, c) => c.copy(SP.dark).lerp(SP.brown, 0.35 + u.x * 0.2),
  );
  for (let i = -2; i <= 2; i++) {
    const f = new THREE.Mesh(featherGeo, feathers);
    f.rotation.set(i * 0.12, i * 0.16, 0);
    f.position.z = i * 4;
    tail.add(f);
  }
  tail.position.set(-136, -18, 0);
  tail.rotation.z = 0.32;
  // the head: chestnut crown, grey cap, white cheek, black bib under the beak
  const head = new THREE.Group();
  const skull = new THREE.Mesh(
    shaped(
      26,
      (v) => v.set(v.x * 31, v.y * 29, v.z * 28),
      (u, c) => {
        if (u.y < -0.35 && u.x > -0.1) c.copy(SP.black);
        else if (u.y > 0.62 && u.x > -0.2) c.copy(SP.grey);
        else if (Math.abs(u.z) > 0.55 && u.y < 0.35 && u.x > -0.35) c.copy(SP.white);
        else if (u.y > 0.05 || u.x < -0.25) c.copy(SP.chestnut);
        else c.copy(SP.cream);
        if (u.x > 0.55 && Math.abs(u.y) < 0.25 && Math.abs(u.z) < 0.6) c.copy(SP.black); // the lores
      },
    ),
    feathers,
  );
  const beak = new THREE.Mesh(new THREE.ConeGeometry(8.5, 24, 12), beakM);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(36, -5, 0);
  const eyes = [1, -1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(5.2, 12, 8), gloss);
    e.position.set(17, 5, s * 23);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }));
    glint.position.set(2, 2, s * 4);
    e.add(glint);
    return e;
  });
  head.add(skull, beak, ...eyes);
  // the legs, gripping
  const legs = [1, -1].map((s) => {
    const l = new THREE.Group();
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 30, 6), legM);
    shin.position.y = -15;
    l.add(shin);
    for (const a of [-0.6, 0, 0.6, Math.PI]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 16, 5), legM);
      toe.rotation.set(0, a, Math.PI / 2);
      toe.position.set(Math.cos(a) * 7, -30, -Math.sin(a) * 7);
      l.add(toe);
    }
    l.position.set(-56, -66, s * 16);
    return l;
  });
  g.add(body, ...wings, tail, head, ...legs);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  g.userData.head = head;
  g.userData.tail = tail;
  g.userData.wings = wings;
  g.userData.body = body;
  return g;
}

export function createBirds(level, seed) {
  const group = new THREE.Group();
  const seams = level.features.filter((f) => f.kind === 'seam');
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 0.85 });
  const pegGeo = new THREE.CylinderGeometry(4.2, 5.5, 130, 8);
  pegGeo.rotateZ(Math.PI / 2);
  const birds = seams.map((seam) => {
    const b = sparrow();
    const s = seam.side === 'L' ? -1 : 1;
    // outside the wall, looking in: the head points towards the pipe
    b.scale.set(-s * 0.55, 0.55, 0.55);
    group.add(b);
    // its perch: an old peg driven into the wall beside the pipe
    const peg = new THREE.Mesh(pegGeo, pegMat);
    peg.castShadow = true;
    group.add(peg);
    return { seam, b, s, peg, placed: false };
  });
  const st = {};
  return {
    group,
    update(t, wallXAt) {
      for (const it of birds) {
        const { seam, b, s } = it;
        birdAt(seam, seed, t, st);
        const wx = wallXAt(seam.side, seam.y);
        // resting just outside the wall's outer face
        const outer = wx + s * (WALL_T + 46);
        let reach = 0;
        let bob = 0;
        if (st.phase === 'look') bob = Math.sin(st.k * Math.PI * 4) * 4;
        else if (st.phase === 'windup') reach = -0.25 * st.k;
        else if (st.phase === 'peck') reach = st.reach;
        b.position.set(outer - s * reach * (BIRD_REACH + 26), seam.y - 6 + bob, -D2 * 0.2);
        if (!it.placed) {
          it.placed = true;
          it.peg.position.set(outer + s * 40, seam.y - 6 - 54, -D2 * 0.2);
        }
        const { head, tail, wings, body } = b.userData;
        // a sparrow never keeps still: quick head turns, a tail that flicks, wings that shiver before it strikes
        const flick = Math.max(0, Math.sin(t * 3.1 + it.s)) ** 12;
        head.rotation.z = st.phase === 'look' ? Math.sin(t * 7) * 0.25 : st.phase === 'windup' ? 0.35 + st.k * 0.15 : st.phase === 'peck' ? -0.35 : -0.15;
        head.rotation.y = st.phase === 'look' ? (Math.floor(t * 2.3) % 2 ? 0.35 : -0.2) : 0;
        tail.rotation.z = 0.32 + flick * 0.5 + (st.phase === 'peck' ? 0.3 : 0);
        const shiver = st.phase === 'windup' ? Math.sin(t * 60) * 0.12 * st.k : 0;
        wings[0].rotation.x = -0.18 - shiver - (st.phase === 'peck' ? 0.5 : 0);
        wings[1].rotation.x = 0.18 + shiver + (st.phase === 'peck' ? 0.5 : 0);
        body.scale.y = 1 + Math.sin(t * 9) * 0.02;
      }
    },
  };
}

// ------------------------------------------------------------------------------------------- silk

const silkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3), transparent: true, opacity: 0.9 });
const silkGeo = (() => {
  const g = new THREE.CylinderGeometry(0.55, 0.55, 1, 5, 1, true);
  g.translate(0, 0.5, 0);
  return g;
})();

export function createSilk() {
  const group = new THREE.Group();
  const lines = new Map();
  const up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3();
  return {
    group,
    /** Draws a thread for racer id from (x, y) to the bolt (or hides it with null). k: 0..1 how far it has shot out. */
    set(id, from, to, k = 1) {
      let m = lines.get(id);
      if (!to) {
        if (m) m.visible = false;
        return;
      }
      if (!m) {
        m = new THREE.Mesh(silkGeo, silkMat);
        m.frustumCulled = false;
        group.add(m);
        lines.set(id, m);
      }
      m.visible = true;
      const tz = -D2 + 7;
      d.set(to.x - from.x, to.y - from.y, tz - from.z);
      const len = d.length() * k;
      d.normalize();
      m.position.set(from.x, from.y, from.z);
      m.quaternion.setFromUnitVectors(up, d);
      m.scale.set(1, len, 1);
    },
    hideAll() {
      for (const m of lines.values()) m.visible = false;
    },
  };
}
