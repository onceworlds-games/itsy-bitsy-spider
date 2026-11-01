import { createView, centerXAt } from './render/view.js';
import { createRun, advance } from './sim/run.js';
import { rainAt } from './sim/weather.js';
import { texturesReady } from './render/tex.js';

const params = new URLSearchParams(location.search);
const view = createView(document.getElementById('stage'), { quality: params.get('q') ?? 'high' });
const id = Number(params.get('view') ?? 1);
const seats = ['Hopper', 'Mabel', 'Dash', 'Velvet'].map((name, i) => ({ id: `a${i}`, name, bot: true, skill: [0.45, 0.62, 0.78, 0.92][i], index: i + 1 }));
const run = createRun({ kind: 'attract', spout: id, seed: 5, seats });
const looks = [
  { color: '#FFB648', mark: 'ring', species: 'jumper', hat: 'sou' },
  { color: '#FF7A5C', mark: 'stripes', species: 'peacock' },
  { color: '#8BC34A', mark: 'dots', species: 'jumper', hat: 'beanie' },
  { color: '#5FB7F0', mark: 'chevron', species: 'orb' },
];
run.racers.forEach((r, i) => (r.look = looks[i % 4]));
view.show(run);
function resize() {
  view.resize(innerWidth, innerHeight, Math.min(devicePixelRatio, 2));
}
addEventListener('resize', resize);
resize();
const skip = Number(params.get('t') ?? 0);
if (skip) advance(run, skip, null);
let last = performance.now();
const cam = { x: 0, y: 300, viewH: Number(params.get('vh') ?? 560) };
const ri = {};
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  advance(run, run.t + dt, null);
  const best = run.racers[Number(params.get('follow') ?? 3)];
  cam.y += (best.st.y + cam.viewH * 0.12 - cam.y) * (1 - Math.exp(-dt * 5));
  cam.x += (centerXAt(run.level, cam.y) - cam.x) * (1 - Math.exp(-dt * 3));
  rainAt(run.weather, best.st.y, run.t, ri);
  const warnK = ri.warn ? Math.max(0, Math.min(1, 1 - ri.next / ri.warn.warn)) : 0;
  const gloom = ri.wet ? 1 : warnK;
  view.frame({ t: run.t, dt, real: now / 1000, cam, weather: { gloom, drizzle: warnK, sunny: 0 }, racers: run.racers, ate: best.ate });
}
texturesReady().then(() => requestAnimationFrame(frame));
