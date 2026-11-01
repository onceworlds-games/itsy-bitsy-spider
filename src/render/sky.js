// The sky: a dome that follows the camera, its colour, sun and clouds driven by the weather (sun 1 is clear, storm 1 is a
// black squall), with lightning lighting the clouds from inside. And the town's skyline far behind the roofs.

import * as THREE from 'three';
import { skylineTex } from './paint.js';

export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color(0x5f9fe0) },
    hor: { value: new THREE.Color(0xcfe3f2) },
    stormTop: { value: new THREE.Color(0x1a222c) },
    stormHor: { value: new THREE.Color(0x4a5560) },
    sunDir: { value: new THREE.Vector3(-0.45, 0.55, -0.7).normalize() },
    sunColor: { value: new THREE.Color(1.0, 0.92, 0.75) },
    storm: { value: 0 },
    night: { value: 0 },
    flash: { value: 0 },
    time: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, hor, stormTop, stormHor, sunDir, sunColor;
      uniform float storm, night, flash, time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float y = max(d.y, -0.2);
        vec3 clear = mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.55));
        vec3 dark = mix(stormHor, stormTop, pow(clamp(y, 0.0, 1.0), 0.7));
        // clouds on a plane above
        vec2 uv = d.xz / max(0.08, d.y + 0.12) * 0.9 + vec2(time * 0.01, time * 0.004);
        float c = fbm(uv * 1.3);
        float cover = mix(0.62, 0.18, storm);
        float cl = smoothstep(cover, cover + 0.25, c);
        vec3 cloudLit = mix(vec3(1.02, 1.0, 0.97), vec3(0.5, 0.55, 0.62), storm);
        vec3 cloudShade = mix(vec3(0.72, 0.76, 0.84), vec3(0.16, 0.19, 0.24), storm);
        float sh = smoothstep(0.3, 0.9, fbm(uv * 1.3 + vec2(0.08, 0.05)));
        vec3 cloud = mix(cloudLit, cloudShade, sh);
        vec3 col = mix(clear, dark, storm);
        col = mix(col, cloud * mix(1.0, 0.6, night), cl * smoothstep(-0.05, 0.08, d.y));
        // the sun, its glow and a silver lining when it's out
        float s = max(dot(d, sunDir), 0.0);
        float sunVis = (1.0 - storm) * (1.0 - night * 0.9);
        col += sunColor * (pow(s, 900.0) * 30.0 + pow(s, 24.0) * 0.6 + pow(s, 4.0) * 0.18) * sunVis * (1.0 - cl * 0.85);
        col += sunColor * pow(s, 10.0) * cl * 0.6 * sunVis;
        // night: stars
        if (night > 0.0) {
          vec2 sp = d.xz / max(0.1, d.y) * 60.0;
          float st = step(0.997, hash(floor(sp))) * smoothstep(0.1, 0.3, d.y) * (1.0 - cl);
          col += vec3(st) * night * 1.5;
        }
        // lightning inside the clouds
        col += vec3(0.75, 0.8, 1.0) * flash * (0.6 + 1.6 * cl) * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;

  // the skyline: rooftops and trees far beyond the roof, tinted by the fog of the hour
  const skyMat = new THREE.MeshBasicMaterial({ map: skylineTex('town'), transparent: true, color: 0x5a6878, fog: false, depthWrite: false });
  const skyline = new THREE.Mesh(new THREE.PlaneGeometry(60000, 15000), skyMat);
  skyline.renderOrder = -9;

  return {
    dome,
    skyline,
    uniforms,
    /** Puts the dome round the camera and the skyline above the roof. */
    place(camera, roofY) {
      dome.position.copy(camera.position);
      skyline.position.set(camera.position.x, roofY + 3200, -16000);
    },
    setTheme(theme) {
      uniforms.top.value.set(theme.sky?.top ?? 0x5f9fe0);
      uniforms.hor.value.set(theme.sky?.hor ?? 0xcfe3f2);
    },
    tint(color) {
      skyMat.color.copy(color);
    },
  };
}
