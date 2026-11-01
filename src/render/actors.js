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

function makeFly(gold) {
  const g = new THREE.Group();
  const s = gold ? 1.5 : 1;
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
  if (gold) {
    const halo = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), flyMats.glow);
    halo.scale.setScalar(1);
    g.add(halo);
    g.userData.halo = halo;
  }
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
        if (it.m.userData.halo) {
          it.m.userData.halo.scale.setScalar(0.8 + Math.sin(t * 5) * 0.15);
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

function sparrow() {
  const g = new THREE.Group();
  const brown = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.8 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.8 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.1, clearcoat: 1 });
  const beakM = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), brown);
  body.scale.set(60, 44, 40);
  body.position.set(-70, -30, 0);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), cream);
  belly.scale.set(50, 34, 32);
  belly.position.set(-60, -44, 10);
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(30, 18, 12), grey);
  const cheek = new THREE.Mesh(new THREE.SphereGeometry(24, 14, 10), cream);
  cheek.position.set(8, -8, 14);
  const bib = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 8), black);
  bib.position.set(10, -22, 6);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(31, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), brown);
  cap.rotation.z = -0.4;
  const beak = new THREE.Mesh(new THREE.ConeGeometry(9, 30, 10), beakM);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(38, -4, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), black);
  eye.position.set(18, 6, 22);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }));
  glint.position.set(21, 9, 27);
  head.add(skull, cheek, bib, cap, beak, eye, glint);
  g.add(body, belly, head);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  g.userData.head = head;
  return g;
}

export function createBirds(level, seed) {
  const group = new THREE.Group();
  const seams = level.features.filter((f) => f.kind === 'seam');
  const birds = seams.map((seam) => {
    const b = sparrow();
    const s = seam.side === 'L' ? -1 : 1;
    // outside the wall, looking in: the head points towards the pipe
    b.scale.set(-s * 0.55, 0.55, 0.55);
    group.add(b);
    return { seam, b, s };
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
        const head = b.userData.head;
        head.rotation.z = st.phase === 'look' ? Math.sin(t * 7) * 0.25 : st.phase === 'windup' ? 0.35 : -0.15;
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
