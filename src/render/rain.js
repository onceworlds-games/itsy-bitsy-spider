// Rain: thousands of streaks falling in a box around the camera, computed on the GPU. Heavier and slanted by the wind in a
// storm, a few big near drops for depth, lit by lightning.

import * as THREE from 'three';

export function createRain(count = 3200) {
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, -0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off[i * 4] = Math.random(); // x across the box
    off[i * 4 + 1] = Math.random(); // depth (0 near the wall .. 1 near the camera)
    off[i * 4 + 2] = Math.random(); // phase
    off[i * 4 + 3] = Math.random(); // per-drop variety
  }
  geo.setAttribute('drop', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = count;
  const uniforms = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(1800, 1600, 1) },
    uAmount: { value: 0.3 },
    uWind: { value: 0.1 },
    uColor: { value: new THREE.Color(0.75, 0.82, 0.92) },
    uFlash: { value: 0 },
    uZ0: { value: -60 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 drop;
      uniform float uTime, uAmount, uWind, uZ0;
      uniform vec3 uCam, uBox;
      varying float vA;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float keep = step(drop.w, uAmount);
        float z = mix(uZ0, uCam.z * 0.62, pow(drop.y, 1.3));
        // nearer drops fall across a narrower box (perspective), farther across a wider one
        float span = uBox.x * mix(1.0, 0.25, drop.y);
        float speed = 1900.0 + drop.w * 900.0;
        float range = uBox.y * mix(1.0, 0.35, drop.y);
        float y = uCam.y + range * 0.5 - mod(drop.z * range + uTime * speed, range);
        float x = uCam.x + (drop.x - 0.5) * span + (uCam.y + range - y) * uWind * 0.0;
        float len = mix(26.0, 70.0, drop.y) * (0.6 + uAmount * 0.6);
        float w = mix(0.9, 2.6, drop.y);
        vec3 p = vec3(x, y, z);
        // a vertical streak, slanted by the wind, facing the camera
        vec3 dir = normalize(vec3(uWind, -1.0, 0.0));
        vec3 side = normalize(cross(dir, normalize(uCam - p)));
        p += dir * (-position.y) * len + side * position.x * w;
        vA = keep * mix(0.35, 0.8, drop.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        if (keep < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uFlash;
      varying float vA;
      varying vec2 vUv;
      void main() {
        float a = vA * smoothstep(0.0, 0.5, vUv.y) * (1.0 - abs(vUv.x - 0.5) * 2.0);
        gl_FragColor = vec4(uColor * (0.35 + uFlash * 2.5) * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return {
    mesh,
    uniforms,
    update(t, camPos, amount, wind, flash) {
      uniforms.uTime.value = t;
      uniforms.uCam.value.copy(camPos);
      uniforms.uAmount.value = amount;
      uniforms.uWind.value = wind;
      uniforms.uFlash.value = flash;
      mesh.visible = amount > 0.01;
    },
  };
}
