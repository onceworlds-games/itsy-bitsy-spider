// Materials: the CC0 PBR sets in public/tex (colour, normal, and AO/roughness/metal packed as R/G/B), loaded once and shared,
// scaled in world units (geometry carries UVs in units; a material divides by its tile size). Plus small canvas textures.

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const sets = new Map();
const mats = new Map();
let maxAniso = 4;

export function setAnisotropy(n) {
  maxAniso = Math.max(1, Math.min(8, n | 0));
}

const base = () => new URL('tex/', document.baseURI).href;

// Clones made before their image arrives wait (version 0 draws nothing yet) and are marked for upload when it does.
const waiting = new Map();
function load(name, srgb) {
  const t = loader.load(base() + name, () => {
    for (const c of waiting.get(t) ?? []) c.needsUpdate = true;
    waiting.delete(t);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  waiting.set(t, []);
  return t;
}

/** The three textures of a set, shared (clone() for another tiling). */
export function texSet(id) {
  let s = sets.get(id);
  if (!s) {
    s = { map: load(`${id}_c.webp`, true), normalMap: load(`${id}_n.webp`, false), orm: load(`${id}_orm.webp`, false) };
    sets.set(id, s);
  }
  return s;
}

function tiled(t, tile, rot = 0) {
  const c = t.clone();
  c.repeat.set(1 / tile[0], 1 / tile[1]);
  c.rotation = rot;
  const w = waiting.get(t);
  if (w) {
    c.version = 0;
    w.push(c);
  }
  return c;
}

/**
 * A standard material from a set. o: { tile: units per repeat (number or [u, v]), color (tint), rough (scale), metal,
 * normal (scale), env (envMapIntensity), ao, emissive, side, key }
 */
export function pbr(id, o = {}) {
  const tile = Array.isArray(o.tile) ? o.tile : [o.tile ?? 400, o.tile ?? 400];
  const key = o.key ?? `${id}|${tile}|${o.color ?? ''}|${o.rough ?? ''}|${o.metal ?? ''}|${o.normal ?? ''}|${o.env ?? ''}|${o.physical ? 1 : 0}`;
  let m = mats.get(key);
  if (m) return m;
  const s = texSet(id);
  const orm = tiled(s.orm, tile, o.rot);
  const Ctor = o.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  m = new Ctor({
    map: tiled(s.map, tile, o.rot),
    normalMap: tiled(s.normalMap, tile, o.rot),
    normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    roughnessMap: orm,
    metalnessMap: o.metal != null && o.metal > 0 ? orm : null,
    aoMap: orm,
    aoMapIntensity: o.ao ?? 1,
    roughness: o.rough ?? 1,
    metalness: o.metal ?? 0,
    color: new THREE.Color(o.color ?? 0xffffff),
    envMapIntensity: o.env ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
  if (o.physical && o.clearcoat) {
    m.clearcoat = o.clearcoat;
    m.clearcoatRoughness = o.clearcoatRough ?? 0.15;
  }
  mats.set(key, m);
  return m;
}

/** A plain standard material, shared by key. */
export function plain(key, o) {
  let m = mats.get(`plain|${key}`);
  if (!m) {
    m = o.physical ? new THREE.MeshPhysicalMaterial(o.props) : new THREE.MeshStandardMaterial(o.props ?? o);
    mats.set(`plain|${key}`, m);
  }
  return m;
}

/** A canvas texture drawn once by `draw(ctx, w, h)`, shared by key. */
const canvases = new Map();
export function canvasTex(key, w, h, draw, o = {}) {
  let t = canvases.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = o.mips !== false;
  if (o.mips === false) t.minFilter = THREE.LinearFilter;
  canvases.set(key, t);
  return t;
}

/** Waits until every texture loaded so far has an image (for posters and the first frame). */
export async function texturesReady(timeout = 8000) {
  const all = [];
  for (const s of sets.values()) for (const t of [s.map, s.normalMap, s.orm]) all.push(t);
  const t0 = performance.now();
  while (performance.now() - t0 < timeout) {
    if (all.every((t) => t.image && (t.image.complete ?? true) && (t.image.width ?? 1) > 0)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

/** Simple seeded random for the dressing (the same building every time). */
export function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
