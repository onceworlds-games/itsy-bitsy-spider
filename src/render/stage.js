// The 3D stage: renderer, camera, the light rig, reflections and the post chain (bloom, then one grading pass that tone
// maps, grades by the weather, vignettes and flashes). Quality follows the platform's Graphics setting.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  name: 'Grade',
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1 },
    lift: { value: new THREE.Vector3(0, 0, 0) },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    sat: { value: 1 },
    contrast: { value: 1 },
    vignette: { value: 0.35 },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color(1, 1, 1) },
    aberr: { value: 0 },
    grain: { value: 0.03 },
    time: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float exposure, sat, contrast, vignette, flash, aberr, grain, time, aspect;
    uniform vec3 lift, gain, flashColor;
    varying vec2 vUv;
    vec3 aces(vec3 x) {
      // ACES fitted (Stephen Hill)
      const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      vec3 v = m1 * x;
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return clamp(m2 * (a / b), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec3 c;
      if (aberr > 0.0) {
        vec2 o = d * aberr * 0.012;
        c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      } else c = texture2D(tDiffuse, vUv).rgb;
      c = aces(c * exposure);
      c = toSRGB(c);
      // grade in display space
      c = c * gain + lift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      vec2 vd = d * vec2(aspect, 1.0);
      c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(vd) * 1.25);
      c = mix(c, flashColor, flash);
      c += (hash(vUv * 917.0 + time) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/** quality: 'low' | 'medium' | 'high' */
export function createStage(host, opts = {}) {
  const preserve = !!opts.preserve;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve, stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x0e141b, 1);
  host.append(renderer.domElement);
  renderer.domElement.id = 'game';
  // A software renderer (SwiftShader, llvmpipe: a machine with no usable GPU, a headless test) draws every pixel and
  // compiles every shader on the CPU, and a page waiting on it answers nothing (not even its server). Played that way
  // (store pictures wait for their picture instead), the stage goes lite: low quality, no reflections, plain diffuse
  // surfaces (a handful of small shaders instead of dozens of large ones), compiled off the page before they draw.
  let software = false;
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    software = false;
  }
  const lite = software && !preserve;
  if (lite) renderer.debug.checkShaderErrors = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a3440, 2600, 9000);
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 40000);

  // Lights: the sky (hemisphere), the sun (key, shadows), a cool fill from the street, a rim from behind.
  const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x3a3226, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9fb8d8, 0.35);
  fill.position.set(900, 300, 1600);
  scene.add(fill, fill.target);
  const rim = new THREE.DirectionalLight(0xffffff, 0.0);
  scene.add(rim, rim.target);
  // lite: the sky and the sun only (every light is more code in every shader)
  if (lite) scene.remove(fill, rim);

  // Reflections: a soft outdoor environment made once from a sky-like gradient room.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = lite ? null : pmrem.fromScene(envScene(), 0.02).texture;
  scene.environmentIntensity = 0.8;
  if (lite) hemi.intensity = 1;

  let composer = null;
  let bloom = null;
  let grade = null;
  let quality = lite ? 'low' : (opts.quality ?? 'high');
  let W = 1;
  let Hh = 1;
  let pr = 1;

  function build() {
    composer?.dispose?.();
    composer = null;
    bloom = null;
    const rt = new THREE.WebGLRenderTarget(Math.max(1, W * pr), Math.max(1, Hh * pr), {
      type: THREE.HalfFloatType,
      samples: quality === 'high' ? 4 : quality === 'medium' ? 2 : 0,
    });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(W, Hh);
    composer.addPass(new RenderPass(scene, camera));
    if (quality !== 'low') {
      bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, Hh / 2), 0.45, 0.42, 1.15);
      composer.addPass(bloom);
    }
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    renderer.shadowMap.enabled = quality !== 'low';
    const size = quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose?.();
    sun.shadow.map = null;
  }

  function resize(w, h, pixelRatio) {
    W = Math.max(1, Math.round(w));
    Hh = Math.max(1, Math.round(h));
    pr = pixelRatio;
    renderer.setPixelRatio(pr);
    renderer.setSize(W, Hh);
    camera.aspect = W / Hh;
    camera.updateProjectionMatrix();
    build();
  }

  function setQuality(q) {
    if (lite || q === quality) return;
    quality = q;
    build();
  }

  /** Keeps the sun's shadow box on what the camera sees. */
  function aimSun(cx, cy, span, dir) {
    const d = dir ?? { x: -0.32, y: 0.78, z: 0.54 };
    const dist = 3000;
    sun.position.set(cx + d.x * dist, cy + d.y * dist, d.z * dist);
    sun.target.position.set(cx, cy, 0);
    const c = sun.shadow.camera;
    const half = span * 0.65;
    if (c.right !== half) {
      c.left = -half;
      c.right = half;
      c.top = half;
      c.bottom = -half;
      c.near = 100;
      c.far = 6500;
      c.updateProjectionMatrix();
    }
    rim.position.set(cx + 600, cy + 900, -1500);
    rim.target.position.set(cx, cy, 0);
    fill.position.set(cx + 900, cy + 300, 1600);
    fill.target.position.set(cx, cy, 0);
  }

  function render(dt, t) {
    grade.uniforms.time.value = t % 100;
    grade.uniforms.aspect.value = W / Hh;
    if (lite) renderLite(dt);
    else composer.render(dt);
  }

  // ---- lite drawing (software renderers)
  const twins = new WeakMap();
  const swapped = [];
  let presented = false;
  let compileTimer = 0;
  let nextCompile = 0;
  let held = null; // what the first shaders wait for (the page's server first: joining wants a page that answers)
  /** Compiles the shaders of one object (with its stand-ins), as a task of its own. */
  function compileNow(o) {
    const t0 = performance.now();
    const back = [];
    o.traverse((c) => {
      const src = c.material;
      if (!src || !c.isMesh) return;
      const dst = Array.isArray(src) ? src.map(twinOf) : twinOf(src);
      if (dst !== src) {
        back.push(c, src);
        c.material = dst;
      }
    });
    try {
      // (compiled for the picture it is drawn into, not the screen: the same shader the next frame asks for)
      renderer.setRenderTarget(composer.readBuffer);
      for (const m of renderer.compile(o, camera, scene)) renderer.properties.get(m).currentProgram?.getUniforms();
    } catch {
      /* drawn as it can be */
    } finally {
      renderer.setRenderTarget(null);
      for (let i = 0; i < back.length; i += 2) back[i].material = back[i + 1];
    }
    // a breath after each, so the page's messages (its server's among them) are answered in between
    const took = performance.now() - t0;
    nextCompile = performance.now() + Math.min(2000, Math.max(100, took * 0.5));
  }
  /** A Lambert stand-in for a PBR material, kept in step with what the game changes on the original. */
  function twinOf(m) {
    if (!m || !m.isMeshStandardMaterial) return m;
    let l = twins.get(m);
    if (!l) {
      l = new THREE.MeshLambertMaterial();
      l.userData.sig = '';
      twins.set(m, l);
    }
    l.color.copy(m.color);
    l.emissive.copy(m.emissive);
    l.emissiveIntensity = m.emissiveIntensity;
    l.map = m.map;
    l.emissiveMap = m.emissiveMap;
    l.alphaMap = m.alphaMap;
    l.opacity = m.opacity;
    l.transparent = m.transparent;
    l.alphaTest = m.alphaTest;
    l.side = m.side;
    l.vertexColors = m.vertexColors;
    l.depthWrite = m.depthWrite;
    l.depthTest = m.depthTest;
    l.blending = m.blending;
    l.fog = m.fog;
    l.visible = m.visible;
    l.flatShading = m.flatShading;
    l.polygonOffset = m.polygonOffset;
    l.polygonOffsetFactor = m.polygonOffsetFactor;
    l.polygonOffsetUnits = m.polygonOffsetUnits;
    const sig = `${!!l.map}${!!l.emissiveMap}${!!l.alphaMap}${l.vertexColors}${l.transparent}${l.alphaTest > 0}${l.flatShading}${l.fog}${l.side}`;
    if (sig !== l.userData.sig) {
      l.userData.sig = sig;
      l.needsUpdate = true;
    }
    return l;
  }
  function renderLite(dt) {
    let unready = null;
    scene.traverseVisible((o) => {
      const src = o.material;
      if (!src) return;
      const dst = !o.isMesh ? src : Array.isArray(src) ? src.map(twinOf) : twinOf(src);
      if (dst !== src) {
        swapped.push(o, src);
        o.material = dst;
      }
      if (!unready) for (const m of Array.isArray(dst) ? dst : [dst]) if (m && renderer.properties.get(m).currentProgram === undefined) unready = o;
    });
    try {
      if (unready) {
        // One new shader at a time, in a task of its own, the last picture shown again meanwhile: a software renderer
        // takes seconds over each, and the page answers nothing while it waits (all of them at once held it for minutes).
        if (!compileTimer && !held) {
          const o = unready;
          compileTimer = setTimeout(
            () => {
              compileTimer = 0;
              compileNow(o);
            },
            Math.max(0, nextCompile - performance.now()),
          );
        }
        renderer.setRenderTarget(null);
        if (presented) grade.render(renderer, null, composer.writeBuffer); // (the grade pass swapped: the scene is here)
        else renderer.clear();
      } else {
        composer.render(dt);
        presented = true;
      }
    } finally {
      for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
      swapped.length = 0;
    }
  }

  return {
    renderer,
    scene,
    camera,
    lights: { hemi, sun, fill, rim },
    get grade() {
      return grade.uniforms;
    },
    get bloom() {
      return bloom;
    },
    get quality() {
      return quality;
    },
    get size() {
      return { w: W, h: Hh, pr };
    },
    software,
    lite,
    /** Lite: shaders wait for this promise (settled or not, at most `ms`) before they start compiling. */
    holdShaders(promise, ms = 15000) {
      if (!lite) return;
      const h = Promise.race([Promise.resolve(promise).catch(() => {}), new Promise((r) => setTimeout(r, ms))]).then(() => {
        if (held === h) held = null;
      });
      held = h;
    },
    resize,
    setQuality,
    aimSun,
    render,
    pmrem,
  };
}

/** A small outdoor sky room for reflections: a bright overcast top, a darker street below, a warm window strip. */
function envScene() {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(100, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float y = vP.y;
        vec3 top = vec3(0.78, 0.86, 1.0) * 1.6;
        vec3 hor = vec3(0.85, 0.82, 0.78) * 1.1;
        vec3 low = vec3(0.16, 0.15, 0.14);
        vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor, low, pow(-y, 0.5));
        // a bright soft window of sky high on one side: gives the wet zinc a long highlight
        c += vec3(1.6, 1.5, 1.35) * smoothstep(0.75, 0.98, dot(vP, normalize(vec3(-0.5, 0.7, 0.5))));
        // warm street lamps low on the other
        c += vec3(1.2, 0.7, 0.3) * 0.6 * smoothstep(0.9, 0.99, dot(vP, normalize(vec3(0.8, 0.05, 0.6))));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  s.add(new THREE.Mesh(geo, mat));
  return s;
}
