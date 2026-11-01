// The spiders: procedural 3D jumping spiders. A fuzzy cephalothorax with big glossy eyes, an abdomen on a spring, waving
// pedipalps and eight legs on two-bone IK. Feet plant on the surface and step in an alternating tetrapod gait driven by
// the distance walked, so they never slide. Poses for every state: crouched and splayed flat while holding, stretched in
// a jump and squashed on landing, hanging off a silk thread, a tumbling ball of legs in the water, dazed, a victory dance.
// Looks (species, colour, pattern, hat) come from the wardrobe.

import * as THREE from 'three';
import { canvasTex } from './tex.js';
import { R } from '../sim/config.js';

export const VS = 1.3; // visual scale of the rig (rig units to world units)
const H0 = 6.2; // body height above the surface (rig units)

// species shapes: body radii, leg lengths and thickness
export const SPECIES = {
  jumper: { ceph: [7, 5, 5.8], abd: [8.5, 6.2, 6.6], femur: [10, 8.5, 8, 9.5], tibia: [9.5, 8.5, 8.5, 10], thick: [1.3, 1.0, 0.95, 1.0], eyes: 1, fuzz: 1 },
  peacock: { ceph: [6.4, 4.6, 5.4], abd: [7.6, 4.4, 7.4], femur: [9, 8, 9.5, 9], tibia: [9, 8, 10, 9.5], thick: [1.05, 0.95, 1.1, 0.95], eyes: 1, fuzz: 0.8, fan: true },
  orb: { ceph: [5.6, 4.2, 4.8], abd: [10.5, 9.5, 9.5], femur: [11, 10, 8, 10], tibia: [11, 10, 8.5, 10.5], thick: [0.85, 0.8, 0.75, 0.8], eyes: 0.6, fuzz: 0.3 },
  tarantula: { ceph: [7.8, 4.8, 6.6], abd: [9, 7, 7.4], femur: [10.5, 9.5, 9, 10.5], tibia: [10, 9, 9, 10.5], thick: [1.7, 1.6, 1.55, 1.6], eyes: 0.45, fuzz: 2 },
  longlegs: { ceph: [4.2, 3.4, 4], abd: [5.6, 4.6, 4.8], femur: [16, 15, 14, 16], tibia: [17, 16, 15, 17], thick: [0.55, 0.5, 0.5, 0.55], eyes: 0.6, fuzz: 0, tall: 1.7 },
};

const ROOTS = [
  [5.5, 0.4, 3.4],
  [3.4, 0.2, 4.3],
  [1.1, 0.2, 4.3],
  [-0.9, 0.4, 3.4],
];
const FEET = [
  [14.5, 10],
  [7.5, 14],
  [-4, 14],
  [-12.5, 10.5],
];
// tetrapod gait groups: L0 R1 L2 R3 | R0 L1 R2 L3
const GROUP = (i, side) => (i + (side > 0 ? 1 : 0)) % 2;
const STRIDE = 7.5;

const tmp = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  e: new THREE.Vector3(),
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  s: new THREE.Vector3(),
  y: new THREE.Vector3(0, 1, 0),
};

const legGeo = (() => {
  const g = new THREE.CylinderGeometry(0.72, 1, 1, 7, 1);
  g.translate(0, 0.5, 0);
  return g;
})();
const jointGeo = new THREE.SphereGeometry(1, 8, 6);

// ------------------------------------------------------------------------------------------- materials

function shade(hex, k) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * k)));
}

/** The abdomen's painted pattern. */
function patternTex(look) {
  const key = `abd:${look.color}:${look.mark}:${look.second ?? ''}`;
  return canvasTex(key, 256, 128, (ctx, w, h) => {
    const base = new THREE.Color(look.color);
    const dark = shade(look.color, 0.45);
    const light = new THREE.Color(look.second ?? '#F3EDE2');
    // u runs round the abdomen, v from back (tip) to front; the top is at u = 0.25 (sphere UVs)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `#${dark.getHexString()}`);
    g.addColorStop(0.5, `#${base.getHexString()}`);
    g.addColorStop(1, `#${dark.getHexString()}`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `#${light.getHexString()}`;
    ctx.strokeStyle = `#${light.getHexString()}`;
    const topU = w * 0.75;
    const mark = look.mark;
    if (mark === 'stripes') {
      for (let k = 0; k < 4; k++) ctx.fillRect(0, h * (0.22 + k * 0.17), w, h * 0.06);
    } else if (mark === 'dots') {
      for (let k = 0; k < 3; k++) {
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(topU + s * w * 0.07, h * (0.3 + k * 0.18), h * 0.07, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (mark === 'chevron') {
      ctx.lineWidth = h * 0.06;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const y = h * (0.28 + k * 0.18);
        ctx.moveTo(topU - w * 0.14, y + h * 0.08);
        ctx.lineTo(topU, y - h * 0.04);
        ctx.lineTo(topU + w * 0.14, y + h * 0.08);
        ctx.stroke();
      }
    } else if (mark === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(topU, h * 0.2);
      ctx.lineTo(topU + w * 0.09, h * 0.5);
      ctx.lineTo(topU, h * 0.82);
      ctx.lineTo(topU - w * 0.09, h * 0.5);
      ctx.fill();
    } else if (mark === 'star') {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const r = k % 2 ? h * 0.09 : h * 0.22;
        ctx.lineTo(topU + Math.sin(a) * r * 1.4, h * 0.5 + Math.cos(a) * r);
      }
      ctx.fill();
    } else if (mark === 'ring') {
      ctx.lineWidth = h * 0.06;
      ctx.beginPath();
      ctx.ellipse(topU, h * 0.5, w * 0.1, h * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (mark === 'band') {
      ctx.fillRect(topU - w * 0.05, 0, w * 0.1, h);
    } else if (mark === 'spots') {
      for (let k = 0; k < 18; k++) {
        ctx.beginPath();
        ctx.arc(((k * 53) % w) + 4, ((k * 37) % h) + 4, 4 + (k % 3) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // fuzz speckle
    for (let k = 0; k < 1400; k++) {
      ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  });
}

function fuzzMat(color, map, fuzz) {
  return new THREE.MeshPhysicalMaterial({
    color,
    map: map ?? null,
    roughness: 0.75,
    metalness: 0,
    sheen: 0.6 + 0.4 * Math.min(1, fuzz),
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55),
    clearcoat: 0.1,
    envMapIntensity: 0.9,
  });
}

const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4 });
const glintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) });

// ------------------------------------------------------------------------------------------- the rig

/**
 * look: { color, mark, second, species, hat, eyes } — opts: { ghost }
 */
export function createSpider(look, opts = {}) {
  const sp = SPECIES[look.species] ?? SPECIES.jumper;
  const root = new THREE.Group(); // world placement (contact frame)
  const body = new THREE.Group(); // body pose (bob, squash, pitch)
  root.add(body);
  const ghost = !!opts.ghost;
  const scale = VS * (opts.scale ?? 1);
  root.scale.setScalar(scale);

  const base = new THREE.Color(look.color);
  const legCol = shade(look.color, look.species === 'longlegs' ? 0.7 : 0.55);
  const cephMat = fuzzMat(shade(look.color, 0.8), null, sp.fuzz);
  const abdMat = fuzzMat(0xffffff, patternTex(look), sp.fuzz);
  const legMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.7, sheen: 0.7, sheenColor: legCol.clone().lerp(new THREE.Color(0xffffff), 0.5), sheenRoughness: 0.5 });
  if (ghost) {
    for (const m of [cephMat, abdMat, legMat]) {
      m.transparent = true;
      m.opacity = 0.42;
      m.depthWrite = false;
    }
  }

  // cephalothorax
  const ceph = new THREE.Group();
  ceph.position.set(2.5, 1.0, 0);
  body.add(ceph);
  const cephMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), cephMat);
  cephMesh.scale.set(...sp.ceph);
  ceph.add(cephMesh);
  // a darker cap on top where the eyes sit
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), fuzzMat(shade(look.color, 0.5), null, sp.fuzz));
  cap.scale.set(sp.ceph[0] * 0.98, sp.ceph[1] * 1.02, sp.ceph[2] * 0.98);
  cap.position.set(0.3, 0.2, 0);
  if (ghost) Object.assign(cap.material, { transparent: true, opacity: 0.42, depthWrite: false });
  ceph.add(cap);

  // eyes: the big front pair, the side pair, the small ones on top
  const ek = sp.eyes;
  const eyes = new THREE.Group();
  ceph.add(eyes);
  const fx = sp.ceph[0] * 0.92;
  const addEye = (x, y, z, r) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), ghost ? cephMat : eyeMat);
    e.position.set(x, y, z);
    eyes.add(e);
    if (!ghost && r > 1) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 8, 6), glintMat);
      g.position.set(x + r * 0.75, y + r * 0.45, z + r * 0.2);
      eyes.add(g);
    }
    return e;
  };
  const ame = 2.4 * ek;
  addEye(fx - 0.6, 1.0, 2.15 * ek, ame);
  addEye(fx - 0.6, 1.0, -2.15 * ek, ame);
  addEye(fx - 1.6, 2.4, 4.3, 1.25 * ek);
  addEye(fx - 1.6, 2.4, -4.3, 1.25 * ek);
  addEye(fx - 5, sp.ceph[1] * 0.9, 3.6, 0.8);
  addEye(fx - 5, sp.ceph[1] * 0.9, -3.6, 0.8);

  // chelicerae, iridescent
  const chelMat = new THREE.MeshPhysicalMaterial({ color: look.chel ?? 0x1c6a5a, metalness: 0.7, roughness: 0.25, iridescence: 1, iridescenceIOR: 1.6, envMapIntensity: 1.5 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), chelMat);
    c.scale.set(1.3, 1.9, 1.15);
    c.position.set(fx - 0.6, -2.4, s * 1.4);
    ceph.add(c);
  }

  // pedipalps: two short fuzzy arms with pale tips
  const palps = [];
  const palpMat = fuzzMat(0xf3ede2, null, 1.5);
  for (const s of [-1, 1]) {
    const pg = new THREE.Group();
    pg.position.set(fx - 1, -1.2, s * 2.6);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 3.4, 8), legMat);
    seg.position.y = -1.4;
    seg.rotation.z = 0.5;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), palpMat);
    tip.position.set(1.4, -3.3, 0);
    pg.add(seg, tip);
    ceph.add(pg);
    palps.push(pg);
  }

  // abdomen, on its pedicel
  const abd = new THREE.Group();
  abd.position.set(-4.2, 1.6, 0);
  body.add(abd);
  const abdMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), abdMat);
  abdMesh.scale.set(...sp.abd);
  abdMesh.position.set(-sp.abd[0] * 0.92, sp.abd[1] * 0.18, 0);
  abdMesh.rotation.set(Math.PI / 2, 0, 0); // UV seam underneath, the top at u = 0.75
  abd.add(abdMesh);
  // spinnerets
  const spin = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 8), cephMat);
  spin.rotation.z = Math.PI / 2;
  spin.position.set(-sp.abd[0] * 1.9, sp.abd[1] * 0.1, 0);
  abd.add(spin);
  // the peacock's fan
  let fan = null;
  if (sp.fan) {
    const ft = canvasTex(`fan:${look.color}`, 256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#c8402a';
      ctx.beginPath();
      ctx.ellipse(w / 2, h, w / 2, h, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#2a7ad8';
      ctx.beginPath();
      ctx.ellipse(w / 2, h, w * 0.36, h * 0.7, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f0c040';
      ctx.beginPath();
      ctx.ellipse(w / 2, h, w * 0.22, h * 0.42, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#20a070';
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k + 0.5) * (Math.PI / 7);
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(a) * w * 0.42, h + Math.sin(a) * h * 0.85, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    fan = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), new THREE.MeshStandardMaterial({ map: ft, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.4, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: 0.15 }));
    fan.geometry.translate(0, 4.5, 0);
    fan.position.set(-sp.abd[0] * 1.2, sp.abd[1] * 0.6, 0);
    fan.rotation.y = Math.PI / 2;
    fan.scale.set(0.2, 0.2, 0.2);
    abd.add(fan);
  }

  // legs
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      legs.push({
        i,
        side,
        root: new THREE.Vector3(ROOTS[i][0], ROOTS[i][1], ROOTS[i][2] * side),
        rest: new THREE.Vector3(FEET[i][0], 0, FEET[i][1] * side),
        a: sp.femur[i] * (sp.tall ?? 1),
        b: sp.tibia[i] * (sp.tall ?? 1),
        t: sp.thick[i],
        group: GROUP(i, side),
        foot: new THREE.Vector3(), // where the foot is now, in the root's (contact) frame
        knee: new THREE.Vector3(),
        ankle: new THREE.Vector3(),
        lift: 0,
      });
    }
  }
  const segs = new THREE.InstancedMesh(legGeo, legMat, legs.length * 3);
  const joints = new THREE.InstancedMesh(jointGeo, legMat, legs.length * 2);
  segs.frustumCulled = false;
  joints.frustumCulled = false;
  const c1 = legCol.clone();
  const c2 = legCol.clone().lerp(new THREE.Color(0xf3ede2), 0.55);
  for (let k = 0; k < legs.length; k++) {
    segs.setColorAt(k * 3, c1);
    segs.setColorAt(k * 3 + 1, c1);
    segs.setColorAt(k * 3 + 2, c2);
    joints.setColorAt(k * 2, c2);
    joints.setColorAt(k * 2 + 1, c1);
  }
  root.add(segs, joints);

  // hat
  let hat = null;
  if (look.hat) {
    hat = makeHat(look.hat, look);
    if (hat) {
      hat.position.set(0.4, sp.ceph[1] * 0.95, 0);
      ceph.add(hat);
    }
  }

  for (const o of [cephMesh, cap, abdMesh, segs, joints]) {
    o.castShadow = !ghost;
    o.receiveShadow = false;
  }

  // ---------------------------------------------------------------- animation state
  const A = {
    init: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fwd: new THREE.Vector3(0, 1, 0), // along the surface (world)
    up: new THREE.Vector3(1, 0, 0), // the surface normal (world)
    phase: 0,
    speed: 0,
    squash: 0, // + stretch, - squash
    squashV: 0,
    abdA: 0,
    abdV: 0,
    crouch: 0,
    spin: 0,
    look: 0,
    idle: 0,
    t: 0,
    mode: 'surf',
    splay: 0,
    tremble: 0,
    dance: 0,
    swingA: 0,
  };
  const qRoot = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const side3 = new THREE.Vector3();
  const camDir = new THREE.Vector3(0, 0, 1);

  /** A kick to the body: + stretches (a jump), - squashes (a landing). */
  function kick(v) {
    A.squashV += v;
  }

  /**
   * st: { x, y, m, h, a, f, k, nx, ny } — env: { dt, t, wet, cam (THREE.Vector3), anchor ({x,y}) }
   */
  function update(st, env) {
    const dt = Math.min(0.05, Math.max(1e-4, env.dt));
    A.t += dt;
    const mode = st.m;
    // velocity from motion (smoothed)
    if (!A.init) {
      A.x = st.x;
      A.y = st.y;
      A.init = true;
    }
    const vx = (st.x - A.x) / dt;
    const vy = (st.y - A.y) / dt;
    const jumpDist = Math.hypot(st.x - A.x, st.y - A.y);
    if (jumpDist > 160) {
      // teleported (a respawn, a network correction): no streak of motion
      A.vx = 0;
      A.vy = 0;
    } else {
      const k = 1 - Math.exp(-dt * 18);
      A.vx += (vx - A.vx) * k;
      A.vy += (vy - A.vy) * k;
    }
    A.x = st.x;
    A.y = st.y;
    if (mode !== A.mode) {
      if (mode === 'air' && A.mode === 'surf') kick(5.5);
      if ((mode === 'surf' || mode === 'done') && (A.mode === 'air' || A.mode === 'swing')) kick(-6.5);
      if (mode === 'swing') kick(3);
      A.mode = mode;
    }
    const onSurf = mode === 'surf' || mode === 'dazed' || mode === 'done';
    const nx = st.nx ?? 0;
    const ny = st.ny ?? 1;

    // ---- the frame: up and forward
    const up = tmp.a;
    const fwd = tmp.b;
    if (onSurf) {
      up.set(nx, ny, 0).normalize();
      // forward along the surface: the way it's moving, else the way it faced, else up the wall
      const tx = -ny;
      const ty = nx;
      const along = A.vx * tx + A.vy * ty;
      let sgn = Math.abs(along) > 12 ? Math.sign(along) : Math.sign(A.fwd.x * tx + A.fwd.y * ty) || 1;
      if (mode === 'done') sgn = Math.sign(A.fwd.x * tx + A.fwd.y * ty) || 1;
      fwd.set(tx * sgn, ty * sgn, 0);
      A.speed = Math.abs(along);
    } else if (mode === 'swing' && env.anchor) {
      up.set(env.anchor.x - st.x, env.anchor.y - st.y, 0).normalize();
      // facing the way it swings
      const tx = -up.y;
      const ty = up.x;
      const along = A.vx * tx + A.vy * ty;
      fwd.set(tx, ty, 0).multiplyScalar(Math.sign(along) || 1);
      A.speed = 0;
    } else {
      // in the air: head first along the velocity, belly down-ish
      const sp2 = Math.hypot(A.vx, A.vy);
      if (sp2 > 30) fwd.set(A.vx / sp2, A.vy / sp2, 0);
      else fwd.copy(A.fwd);
      up.set(-fwd.y, fwd.x, 0);
      if (up.y < 0) up.negate();
      A.speed = 0;
    }
    // smooth the frame so corners and landings turn rather than snap
    const rk = 1 - Math.exp(-dt * (onSurf ? 22 : 10));
    A.up.lerp(up, rk).normalize();
    A.fwd.lerp(fwd, rk);
    A.fwd.addScaledVector(A.up, -A.fwd.dot(A.up)).normalize();
    side3.crossVectors(A.fwd, A.up).normalize();

    // ---- body dynamics
    A.squashV += (-A.squash * 260 - A.squashV * 16) * dt;
    A.squash += A.squashV * dt;
    A.squash = Math.max(-0.45, Math.min(0.5, A.squash));
    const holding = !!st.h && onSurf;
    A.crouch += ((holding ? 1 : 0) - A.crouch) * (1 - Math.exp(-dt * 16));
    A.splay += ((holding ? 1 : mode === 'dazed' ? 0.4 : 0) - A.splay) * (1 - Math.exp(-dt * 14));
    A.tremble = holding && env.wet ? 1 : Math.max(0, A.tremble - dt * 4);
    const accel = (A.speed - (A.lastSpeed ?? 0)) / dt;
    A.lastSpeed = A.speed;
    A.abdV += (-A.abdA * 120 - A.abdV * 9 - accel * 0.0009) * dt;
    A.abdA += A.abdV * dt;
    A.abdA = Math.max(-0.5, Math.min(0.5, A.abdA));
    if (onSurf && mode !== 'done') A.phase += (A.speed * dt) / (STRIDE * 2 * VS);
    A.idle = onSurf && A.speed < 8 && !holding ? A.idle + dt : 0;
    A.dance = mode === 'done' ? A.dance + dt : 0;
    if (mode === 'tumble' || mode === 'washed' || mode === 'drowned') A.spin += dt * (mode === 'drowned' ? 2 : 13);
    else A.spin *= Math.exp(-dt * 10);

    // ---- place the root at the contact point, oriented to the frame
    const contactX = st.x - A.up.x * R;
    const contactY = st.y - A.up.y * R;
    basis.makeBasis(A.fwd, A.up, side3);
    qRoot.setFromRotationMatrix(basis);
    // the camera cheat: roll the back a little towards the viewer so both eyes and the pattern read
    const roll = onSurf ? 0.32 * Math.sign(side3.z || 1) : 0;
    tmp.q.setFromAxisAngle(tmp.e.set(1, 0, 0), roll);
    qRoot.multiply(tmp.q);
    if (A.spin) {
      tmp.q.setFromAxisAngle(tmp.e.set(0, 0, 1), A.spin);
      qRoot.multiply(tmp.q);
      tmp.q.setFromAxisAngle(tmp.e.set(1, 0, 0), A.spin * 0.6);
      qRoot.multiply(tmp.q);
    }
    root.quaternion.copy(qRoot);
    root.position.set(onSurf ? contactX : st.x, onSurf ? contactY : st.y, 0);
    if (!onSurf) root.position.addScaledVector(A.up, -H0 * scale * 0.7);

    // ---- the body's pose in the root frame
    const bob = onSurf ? -Math.abs(Math.sin(A.phase * Math.PI * 4)) * 0.7 * Math.min(1, A.speed / 120) : 0;
    const tr = A.tremble ? Math.sin(A.t * 70) * 0.35 * A.tremble : 0;
    const h = H0 * (1 - A.crouch * 0.42) + bob + tr;
    body.position.set(0, h, 0);
    const st2 = 1 + A.squash;
    body.scale.set(st2, 1 / Math.sqrt(Math.max(0.3, st2)), 1 / Math.sqrt(Math.max(0.3, st2)));
    body.rotation.set(0, 0, mode === 'air' ? 0.15 : 0);
    abd.rotation.set(0, 0, 0.16 + A.abdA - A.crouch * 0.12 + (mode === 'done' ? 0.45 + Math.sin(A.dance * 9) * 0.12 : 0));
    abd.rotation.x = mode === 'done' ? Math.sin(A.dance * 6) * 0.35 : 0;
    if (fan) {
      const open = mode === 'done' ? 1 : 0;
      const fs = 0.2 + open * 0.8;
      fan.scale.lerp(tmp.s.set(fs, fs, fs), 1 - Math.exp(-dt * 8));
    }
    // the head turns to look at the camera when idle (jumping spiders do)
    const wantLook = A.idle > 1.2 || mode === 'done' ? 1 : 0;
    A.look += (wantLook - A.look) * (1 - Math.exp(-dt * 5));
    // the camera direction in the body frame
    const cam = env.cam ?? camDir;
    tmp.c.set(cam.x - st.x, cam.y - st.y, cam.z).normalize();
    tmp.d.copy(tmp.c).applyQuaternion(tmp.q.copy(root.quaternion).invert());
    const yaw = Math.atan2(-tmp.d.z, tmp.d.x);
    ceph.rotation.set(0, A.look * Math.max(-1.1, Math.min(1.1, yaw)) * 0.7, A.look * 0.15);
    if (hat?.userData.spin) hat.userData.spin.rotation.y += dt * (12 + Math.hypot(A.vx, A.vy) * 0.1);
    // palps wave
    for (let k = 0; k < 2; k++) palps[k].rotation.z = Math.sin(A.t * (A.idle > 0 ? 5 : 9) + k * 1.7) * 0.35 + 0.2;

    // ---- legs
    const cephPos = ceph.position;
    for (const L of legs) {
      // the leg's root in the root frame (follows the body)
      tmp.c.copy(L.root).applyEuler(ceph.rotation).add(cephPos);
      tmp.c.multiply(body.scale).add(body.position);
      const foot = L.foot;
      if (onSurf) {
        const u = (A.phase + L.group * 0.5) % 1;
        const splay = 1 + A.splay * 0.35;
        let fxo = L.rest.x * splay;
        let lift = 0;
        if (mode === 'done') {
          // the dance: third legs up and waving, the rest planted wide
          if (L.i === 2) {
            fxo = 2;
            lift = 13 + Math.sin(A.dance * 10 + (L.side > 0 ? 0 : 1.5)) * 4;
          }
          if (L.i === 0 && sp.fan) lift = 4 + Math.sin(A.dance * 8) * 2;
        } else if (A.speed > 4) {
          if (u < 0.5) fxo += STRIDE * (0.5 - u * 2);
          else {
            const tt = (u - 0.5) * 2;
            fxo += STRIDE * (-0.5 + tt);
            lift = Math.sin(tt * Math.PI) * (3 + Math.min(3, A.speed / 60));
          }
        } else if (A.idle > 0 && L.i === 0) {
          // front legs tap now and then
          lift = Math.max(0, Math.sin(A.t * 3 + L.side)) ** 8 * 3;
        }
        foot.set(fxo, L.rest.y + lift, L.rest.z * splay);
      } else if (mode === 'swing') {
        if (L.i === 0) foot.set(4, 16, L.side * 2.5); // holding the thread overhead
        else foot.set(L.rest.x * 0.7, -6 - L.i * 1.5 + Math.sin(A.t * 6 + L.i) * 1.5, L.rest.z * 0.8);
      } else if (mode === 'air') {
        // front legs reach ahead, back legs trail
        const reach = L.i < 2 ? 1 : -1;
        foot.set(L.rest.x * 1.1 + reach * 4, -3 + (L.i < 2 ? 3 : -1), L.rest.z * 1.05);
      } else {
        // tumbling, washed, drowned: curled up
        const curl = mode === 'drowned' ? 0.75 : 0.45;
        foot.set(L.rest.x * curl, -2 + Math.sin(A.t * 20 + L.i) * 1.5, L.rest.z * curl);
      }
      // two-bone IK from root to ankle, ankle above the foot
      L.ankle.copy(foot).y += 3.2;
      ik(tmp.c, L.ankle, L.a, L.b, tmp.e.set(0, 1, 0).addScaledVector(tmp.d.set(0, 0, L.side), 0.6), L.knee);
      const k0 = legs.indexOf(L);
      setSeg(segs, k0 * 3, tmp.c, L.knee, L.t * 1.05);
      setSeg(segs, k0 * 3 + 1, L.knee, L.ankle, L.t * 0.85);
      setSeg(segs, k0 * 3 + 2, L.ankle, foot, L.t * 0.6);
      setJoint(joints, k0 * 2, L.knee, L.t * 1.1);
      setJoint(joints, k0 * 2 + 1, L.ankle, L.t * 0.8);
    }
    segs.instanceMatrix.needsUpdate = true;
    joints.instanceMatrix.needsUpdate = true;
  }

  function setVisible(v) {
    root.visible = v;
  }

  return { root, update, kick, setVisible, look };
}

function ik(R0, A, a, b, pole, outKnee) {
  const d = tmp.s.subVectors(A, R0);
  let len = d.length();
  if (len < 1e-4) {
    outKnee.copy(R0).add(pole.clone().multiplyScalar(a));
    return;
  }
  d.divideScalar(len);
  len = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.01, len));
  const cosA = (a * a + len * len - b * b) / (2 * a * len);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  // perpendicular towards the pole
  const px = pole.x - d.x * pole.dot(d);
  const py = pole.y - d.y * pole.dot(d);
  const pz = pole.z - d.z * pole.dot(d);
  const pl = Math.hypot(px, py, pz) || 1;
  outKnee.set(R0.x + d.x * a * cosA + (px / pl) * a * sinA, R0.y + d.y * a * cosA + (py / pl) * a * sinA, R0.z + d.z * a * cosA + (pz / pl) * a * sinA);
}

const segQ = new THREE.Quaternion();
const segDir = new THREE.Vector3();
const segS = new THREE.Vector3();
const segM = new THREE.Matrix4();
const UPV = new THREE.Vector3(0, 1, 0);
function setSeg(im, k, a, b, r) {
  segDir.subVectors(b, a);
  const len = segDir.length() || 1e-3;
  segDir.divideScalar(len);
  segQ.setFromUnitVectors(UPV, segDir);
  segS.set(r, len, r);
  segM.compose(a, segQ, segS);
  im.setMatrixAt(k, segM);
}
function setJoint(im, k, p, r) {
  segS.set(r, r, r);
  segM.compose(p, segQ.identity(), segS);
  im.setMatrixAt(k, segM);
}

// ------------------------------------------------------------------------------------------- hats

export const HATS = ['none', 'beanie', 'tophat', 'sou', 'crown', 'flower', 'propeller', 'party', 'cap', 'acorn', 'halo'];

function makeHat(kind, look) {
  const g = new THREE.Group();
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  switch (kind) {
    case 'beanie': {
      const b = new THREE.Mesh(new THREE.SphereGeometry(4.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc8302a));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.9, 6, 20), mat(0xf3ede2));
      rim.rotation.x = Math.PI / 2;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), mat(0xf3ede2));
      pom.position.y = 4.8;
      g.add(b, rim, pom);
      break;
    }
    case 'tophat': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.5, 20), mat(0x15161a));
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.4, 7, 20), mat(0x15161a));
      crown.position.y = 3.6;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.45, 1.2, 20), mat(0xb8322a));
      band.position.y = 1;
      g.add(brim, crown, band);
      g.rotation.z = -0.2;
      break;
    }
    case 'sou': {
      // a sou'wester: a yellow rain hat, of course
      const y = mat(0xf4c430, { roughness: 0.3 });
      const crown = new THREE.Mesh(new THREE.SphereGeometry(4.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), y);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 7.2, 1.6, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xf4c430, roughness: 0.3, side: THREE.DoubleSide }));
      brim.position.set(-0.8, -0.4, 0);
      brim.rotation.z = 0.15;
      g.add(crown, brim);
      break;
    }
    case 'crown': {
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc040, metalness: 1, roughness: 0.25 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 2.2, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffc040, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }));
      band.position.y = 1.1;
      g.add(band);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const pt = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 6), gold);
        pt.position.set(Math.cos(a) * 3.6, 3.4, Math.sin(a) * 3.6);
        g.add(pt);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshStandardMaterial({ color: [0xe02040, 0x2060e0, 0x20c060][k % 3], roughness: 0.1, emissive: [0xe02040, 0x2060e0, 0x20c060][k % 3], emissiveIntensity: 0.4 }));
        gem.position.set(Math.cos(a) * 3.75, 1.1, Math.sin(a) * 3.75);
        g.add(gem);
      }
      break;
    }
    case 'flower': {
      const petal = mat(0xff7aa0, { emissive: 0xff7aa0, emissiveIntensity: 0.1 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), petal);
        p.scale.set(1.3, 0.4, 0.8);
        p.position.set(Math.cos(a) * 2, 0.8, Math.sin(a) * 2);
        p.rotation.y = -a;
        g.add(p);
      }
      const c = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), mat(0xffd040));
      c.position.y = 1.1;
      g.add(c);
      g.position.z = 2;
      g.rotation.x = 0.4;
      break;
    }
    case 'propeller': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(4.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a6ae0));
      const stripes = new THREE.Mesh(new THREE.SphereGeometry(4.45, 4, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf4c430, { wireframe: true }));
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), mat(0x888888));
      stick.position.y = 5;
      const blades = new THREE.Group();
      blades.position.y = 6;
      for (const s of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 1.4), mat(s > 0 ? 0xe03030 : 0x30c050));
        b.position.x = s * 3;
        b.rotation.x = s * 0.3;
        blades.add(b);
      }
      g.add(cap, stripes, stick, blades);
      g.userData.spin = blades;
      break;
    }
    case 'party': {
      const tex = canvasTex('partyHat', 64, 64, (ctx, w, h) => {
        for (let y = 0; y < h; y += 16) {
          ctx.fillStyle = (y / 16) % 2 ? '#2ad0c0' : '#ff4fa0';
          ctx.fillRect(0, y, w, 16);
        }
        ctx.fillStyle = '#ffe040';
        for (let k = 0; k < 10; k++) ctx.fillRect((k * 23) % w, (k * 17) % h, 5, 5);
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
      cone.position.y = 4;
      const pom = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), mat(0xffe040));
      pom.position.y = 8.2;
      g.add(cone, pom);
      g.rotation.z = -0.25;
      break;
    }
    case 'cap': {
      const c = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a8a4a));
      const peak = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.5, 16, 1, false, -Math.PI / 2, Math.PI), mat(0x1f6a38));
      peak.position.set(3, 0.2, 0);
      peak.scale.set(1.2, 1, 1.25);
      g.add(c, peak);
      break;
    }
    case 'acorn': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(4.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7a5a32, { roughness: 0.95 }));
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.4, 6), mat(0x5a4022));
      stalk.position.y = 5.2;
      stalk.rotation.z = 0.4;
      g.add(cap, stalk);
      break;
    }
    case 'halo': {
      const r = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.6, 8, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 3, 1.4) }));
      r.rotation.x = Math.PI / 2;
      r.position.y = 4.5;
      g.add(r);
      break;
    }
    default:
      return null;
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
