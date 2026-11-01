// The flush: a thick glossy sheet of water pouring down the back of the pipe and hugging both walls, flowing fast (its
// streaks travel at the front's speed), a foaming front, a thinning tail and a wet film left behind that dries off. The
// dry spots stay dry. Before a flush, drips run down the back. One shader on two meshes, driven by the weather.

import * as THREE from 'three';
import { Geo, offsetLine } from './geo.js';
import { arrival } from '../sim/weather.js';
import { FRONT_SPEED, DEPTH } from '../sim/config.js';

const D2 = DEPTH / 2;
const MAX_BANDS = 4;
const MAX_DRY = 24;

const vert = /* glsl */ `
  varying vec3 vW;
  varying vec3 vN;
  varying float vSide;
  attribute float side;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vSide = side;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform vec4 uBands[${MAX_BANDS}];
  uniform int uBandCount;
  uniform vec4 uDry[${MAX_DRY}];
  uniform int uDryCount;
  uniform float uDrizzle;
  uniform vec3 uLight;
  uniform vec3 uLightColor;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform float uFlash;
  uniform float uFlood;
  varying vec3 vW;
  varying vec3 vN;
  varying float vSide;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float dryAt(vec2 p) {
    float d = 0.0;
    for (int i = 0; i < ${MAX_DRY}; i++) {
      if (i >= uDryCount) break;
      vec4 b = uDry[i];
      vec2 q = min(p - b.xy, b.zw - p);
      float inside = smoothstep(-2.0, 6.0, min(q.x, q.y));
      d = max(d, inside);
    }
    return d;
  }
  void main() {
    float y = vW.y;
    float wet = 0.0;
    float foam = 0.0;
    float film = 0.0;
    float strength = 0.0;
    for (int i = 0; i < ${MAX_BANDS}; i++) {
      if (i >= uBandCount) break;
      vec4 b = uBands[i];
      // b.x: the front (lowest wet point), b.y: the tail (top of the water), b.z: how heavy
      float edgeN = noise(vec2(vW.x * 0.05 + vW.z * 0.03, uTime * 3.0)) * 26.0;
      float inBand = smoothstep(b.x - 6.0 + edgeN, b.x + 18.0 + edgeN, y) * (1.0 - smoothstep(b.y - 80.0, b.y + 10.0, y));
      wet = max(wet, inBand);
      strength = max(strength, inBand * b.z);
      foam = max(foam, exp(-max(0.0, y - b.x - edgeN) / 34.0) * step(b.x - 8.0 + edgeN, y) * step(y, b.y));
      // the film left above the tail, drying over about a second of fall
      film = max(film, (1.0 - smoothstep(0.0, 900.0, y - b.y)) * step(b.y, y) * 0.55);
    }
    float dry = dryAt(vW.xy);
    // Monsoon's flood: the pipe full of churning water below its surface, foam along the top of it
    float floodD = uFlood - y;
    float flooded = smoothstep(-6.0, 4.0, floodD + (noise(vec2(vW.x * 0.04, uTime * 2.0)) - 0.5) * 14.0);
    dry *= 1.0 - flooded;
    wet = max(wet, flooded);
    foam = max(foam, flooded * exp(-max(0.0, floodD) / 22.0));
    strength = max(strength, flooded);
    wet *= 1.0 - dry;
    foam *= 1.0 - dry;
    film *= 1.0 - dry;
    // drips before a flush: thin runs down the back
    float drip = 0.0;
    if (uDrizzle > 0.0 && vSide < 0.5) {
      float col = floor(vW.x / 9.0);
      float has = step(0.86, hash(vec2(col, 3.0)));
      float sp = 160.0 + hash(vec2(col, 7.0)) * 220.0;
      float seg = fract((y + uTime * sp) / (300.0 + hash(vec2(col, 9.0)) * 400.0));
      float line = 1.0 - smoothstep(0.0, 2.2, abs(fract(vW.x / 9.0) - 0.5) * 9.0);
      drip = has * line * smoothstep(0.55, 0.62, seg) * (1.0 - smoothstep(0.9, 1.0, seg)) * uDrizzle * (1.0 - dry);
    }
    float a = max(max(wet * (0.78 + 0.2 * strength), film * 0.35), drip * 0.8);
    if (a < 0.003) discard;
    // flowing streaks: stretched noise moving down fast
    float sp = ${FRONT_SPEED.toFixed(1)};
    vec2 fuv = vec2(vW.x * 0.045 + vW.z * 0.03, (y + uTime * sp) * 0.0045);
    float n1 = noise(fuv * vec2(1.0, 1.0));
    float n2 = noise(fuv * vec2(2.3, 3.1) + 7.0);
    float streak = smoothstep(0.55, 0.95, n1 * 0.7 + n2 * 0.5);
    // a fake normal from the streaks for the highlight
    vec3 n = normalize(vN + vec3((n1 - 0.5) * 0.8, 0.0, (n2 - 0.5) * 0.5));
    vec3 v = normalize(cameraPosition - vW);
    vec3 h = normalize(uLight + v);
    float spec = pow(max(dot(n, h), 0.0), 60.0) * 3.0 + pow(max(dot(n, h), 0.0), 8.0) * 0.25;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 col = mix(uDeep, uSky, 0.25 + 0.5 * fres + 0.3 * streak);
    col += uLightColor * spec;
    col = mix(col, vec3(1.15, 1.2, 1.25), clamp(foam * 0.9 + streak * 0.25 * wet, 0.0, 1.0));
    col += vec3(0.8, 0.85, 1.0) * uFlash * 1.5;
    // the film and drips are darker, glossy
    float wa = max(wet, foam);
    col = mix(uDeep * 0.6 + uLightColor * spec * 0.5, col, clamp(wa * 1.5, 0.0, 1.0));
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

export function createWater(level, outline) {
  const uniforms = {
    uTime: { value: 0 },
    uBands: { value: Array.from({ length: MAX_BANDS }, () => new THREE.Vector4()) },
    uBandCount: { value: 0 },
    uDry: { value: Array.from({ length: MAX_DRY }, () => new THREE.Vector4()) },
    uDryCount: { value: 0 },
    uDrizzle: { value: 0 },
    uLight: { value: new THREE.Vector3(-0.32, 0.78, 0.54).normalize() },
    uLightColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
    uDeep: { value: new THREE.Color(0.12, 0.32, 0.42) },
    uSky: { value: new THREE.Color(0.55, 0.78, 0.92) },
    uFlash: { value: 0 },
    uFlood: { value: -1e6 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  // dry spots: their boxes
  const dry = level.pocketBoxes.slice(0, MAX_DRY);
  dry.forEach((b, i) => uniforms.uDry.value[i].set(b.x0, b.y0, b.x1, b.y1));
  uniforms.uDryCount.value = dry.length;

  const g = new Geo();
  const sides = [];
  // the sheet down the back
  const poly = [...outline.leftIn, ...outline.rightIn.slice().reverse()];
  const before = g.count;
  g.poly(poly, -D2 + 1.2, 1);
  for (let i = before; i < g.count; i++) sides.push(0);
  // the film on each wall, seen in section at the cut: a band hugging the wall
  const band = (inn, inward) => {
    const T = 9;
    const off = offsetLine(inn, inward * T);
    for (let i = 0; i < inn.length - 1; i++) {
      const a = inn[i];
      const b = inn[i + 1];
      const c = off[i + 1];
      const d = off[i];
      const k0 = g.count;
      g.faceAuto([[a[0], a[1], D2 - 0.6], [b[0], b[1], D2 - 0.6], [c[0], c[1], D2 - 0.6], [d[0], d[1], D2 - 0.6]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // and the face of the film along the wall, into the pipe
      g.faceAuto([[d[0], d[1], -D2], [c[0], c[1], -D2], [c[0], c[1], D2 - 0.6], [d[0], d[1], D2 - 0.6]], [-inward * (b[1] - a[1]), inward * (b[0] - a[0]), 0].map((v) => v / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1)), [[0, 0], [1, 0], [1, 1], [0, 1]]);
      for (let k = k0; k < g.count; k++) sides.push(1);
    }
  };
  band(outline.leftIn, -1);
  band(outline.rightIn, 1);
  const geo = g.build(1);
  geo.setAttribute('side', new THREE.Float32BufferAttribute(sides, 1));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;

  return {
    mesh,
    uniforms,
    /** Sets the water for time t from the weather; drizzle 0..1 before a flush. Returns the bands (for effects). */
    update(weather, t, drizzle, flash, flood = null) {
      uniforms.uTime.value = t;
      uniforms.uFlood.value = flood ?? -1e6;
      uniforms.uDrizzle.value = drizzle;
      uniforms.uFlash.value = flash ?? 0;
      let n = 0;
      const bands = [];
      for (const w of weather.waves) {
        if (w.t0 > t + 0.1) break;
        const lastEnd = arrival(w, -200) + w.end;
        if (lastEnd + 1.2 < t) continue;
        for (const [p0, p1] of w.parts) {
          if (n >= MAX_BANDS) break;
          const front = w.top - FRONT_SPEED * (t - w.t0 - p0);
          const tail = w.top - FRONT_SPEED * (t - w.t0 - p1);
          if (front > w.top + 5) continue;
          if (tail < -1200) continue;
          const heavy = w.kind === 'surge' ? 1 : w.kind === 'double' ? 0.7 : 0.5;
          uniforms.uBands.value[n].set(Math.max(-50, front), Math.min(w.top + 40, tail), heavy, 0);
          bands.push({ front, tail: Math.min(w.top + 40, tail), heavy, wave: w });
          n++;
        }
      }
      uniforms.uBandCount.value = n;
      return bands;
    },
    setLight(dir, color) {
      uniforms.uLight.value.copy(dir).normalize();
      uniforms.uLightColor.value.copy(color);
    },
  };
}
