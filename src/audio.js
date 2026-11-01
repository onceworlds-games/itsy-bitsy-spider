// All sound is synthesized: rain on zinc, the warning's rumble and the flush's roar, eight little feet, the sticky hold,
// silk shooting and singing, flies gulped, plucks, splashes and clangs, and the rhyme's tune re-harmonised in C minor on a
// small sequencer. The music builds as you climb (drums and bass at the foot, chords, then the tune, then a high
// counter-line near the top), drops to drums when the rain is coming, ducks under the flush and bursts out at the sun.

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let musicDuck = null;
let noiseBuf = null;
let rainSrc = null;
let rainGain = null;
let rainFilter = null;
let started = false;

export function audioReady() {
  return !!ac && ac.state === 'running';
}

/** Starts sound from a tap or key in the game (iPhones need one). Safe to call repeatedly. */
export function startAudio() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.9;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ac.destination);
      sfxBus = ac.createGain();
      sfxBus.connect(master);
      musicBus = ac.createGain();
      musicBus.gain.value = 0.5;
      musicDuck = ac.createGain();
      musicBus.connect(musicDuck).connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== 'running') ac.resume().catch(() => {});
    if (!started) {
      started = true;
      startRain();
      setInterval(schedule, 25);
    }
  } catch {
    ac = null;
  }
}

export function suspendAudio(on) {
  if (!ac) return;
  try {
    if (on) ac.suspend();
    else ac.resume();
  } catch {
    /* ignore */
  }
}

const now = () => ac.currentTime;

function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function tone(type, f0, f1, dur, vol, t = now(), dest = sfxBus, attack = 0.004) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, attack, vol, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function noise(dur, vol, type, f0, f1 = f0, q = 1, t = now(), dest = sfxBus, attack = 0.003) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain();
  env(g, t, attack, vol, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 1.5);
  s.stop(t + attack + dur + 0.05);
}

function metal(base, dur, vol, t = now()) {
  for (const [m, v] of [
    [1, 1],
    [2.76, 0.5],
    [5.4, 0.25],
    [8.93, 0.12],
  ]) {
    tone('sine', base * m, base * m * 0.995, dur / Math.sqrt(m), vol * v, t);
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);
let lastStep = 0;

/** A sound effect by name. */
export function sfx(name, arg = 0) {
  if (!ac || ac.state !== 'running') return;
  const t = now();
  switch (name) {
    case 'step':
      if (t - lastStep < 0.045) return;
      lastStep = t;
      noise(0.018, 0.05, 'bandpass', rnd(2500, 4200), rnd(2500, 4200), 3);
      break;
    case 'hold':
      noise(0.09, 0.28, 'bandpass', 4200, 900, 2);
      tone('sine', 380, 240, 0.08, 0.18);
      break;
    case 'release':
      tone('sine', 300, 520, 0.06, 0.1);
      break;
    case 'leg':
      tone('triangle', 1100 - arg * 70, 900 - arg * 70, 0.05, 0.08);
      break;
    case 'outOfGrip':
      noise(0.22, 0.25, 'bandpass', 3000, 400, 1.5);
      tone('sawtooth', 300, 90, 0.2, 0.06);
      break;
    case 'jump':
      tone('sine', 320, 640, 0.11, 0.2);
      tone('triangle', 640, 900, 0.07, 0.07);
      break;
    case 'land':
      noise(0.05, 0.15, 'lowpass', 900, 300, 1);
      tone('sine', 170, 90, 0.07, 0.18);
      break;
    case 'splashOver':
      noise(0.35, 0.16, 'highpass', 3000, 5000, 0.7);
      break;
    case 'washed':
      noise(0.45, 0.4, 'bandpass', 1400, 500, 0.8);
      tone('sine', 900, 180, 0.7, 0.16, t + 0.05);
      break;
    case 'caught':
      metal(520, 0.7, 0.22);
      break;
    case 'recover':
      tone('sine', 700, 1200, 0.1, 0.1);
      break;
    case 'bump':
      tone('sine', 240, 110, 0.09, 0.3);
      tone('sine', 1400, 1900, 0.06, 0.08, t + 0.05);
      break;
    case 'shrug':
      tone('sine', 160, 120, 0.08, 0.22);
      noise(0.04, 0.1, 'lowpass', 600, 600, 1);
      break;
    case 'debris':
      for (let i = 0; i < 3; i++) metal(rnd(900, 1500), 0.15, 0.08, t + i * 0.06);
      break;
    case 'bird':
      tone('sine', 2600, 3600, 0.05, 0.08);
      tone('sine', 2800, 3900, 0.05, 0.07, t + 0.08);
      break;
    case 'peck':
      tone('sine', 950, 700, 0.04, 0.3);
      break;
    case 'warn':
      noise(1.8, 0.22, 'lowpass', 90, 180, 1, t, sfxBus, 1.2);
      for (let i = 0; i < 4; i++) tone('sine', 1500 - i * 220, 1400 - i * 220, 0.08, 0.06, t + 0.3 + i * 0.35);
      break;
    case 'tick':
      tone('triangle', 1800, 1700, 0.04, 0.1);
      break;
    case 'flush':
      noise(Math.max(0.6, arg), 0.5, 'bandpass', 500, 300, 0.6, t, sfxBus, 0.03);
      noise(Math.max(0.6, arg) + 0.5, 0.18, 'lowpass', 300, 120, 0.8, t + 0.1);
      break;
    case 'sun':
      for (let i = 0; i < 5; i++) {
        const f = rnd(2400, 3800);
        tone('sine', f, f * rnd(1.05, 1.3), 0.06, 0.04, t + 0.2 + i * rnd(0.12, 0.25));
      }
      break;
    case 'thunder':
      noise(2.4, 0.5, 'lowpass', 220, 60, 0.7, t + 0.05, sfxBus, 0.02);
      break;
    case 'count':
      metal(arg ? 880 : 660, 0.25, 0.18);
      break;
    case 'go':
      for (const f of [523.25, 659.25, 783.99]) tone('triangle', f, f, 0.5, 0.12);
      noise(0.2, 0.12, 'highpass', 4000, 8000, 0.5);
      break;
    case 'finish':
      [523.25, 622.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f, 0.6, 0.13, t + i * 0.07));
      break;
    case 'fanfare':
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('square', f, f, 0.45, 0.05, t + i * 0.11));
      [523.25, 659.25, 783.99].forEach((f) => tone('triangle', f, f, 1.6, 0.1, t + 0.6));
      break;
    case 'star':
      tone('triangle', 880 + arg * 220, 1320 + arg * 220, 0.18, 0.15);
      metal(1760 + arg * 200, 0.3, 0.05);
      break;
    case 'ui':
      tone('triangle', 900, 1100, 0.04, 0.08);
      break;
    case 'swing':
      noise(0.18, 0.06, 'bandpass', 600, 1400, 1);
      break;
    case 'flood':
      noise(1.2, 0.5, 'lowpass', 500, 120, 0.7);
      tone('sine', 300, 60, 0.9, 0.2);
      break;
    case 'perfect':
      // a bright clamp and a chime: timed it
      noise(0.06, 0.3, 'bandpass', 5200, 2400, 2);
      [1046.5, 1318.5, 1568].forEach((f, i) => tone('triangle', f, f, 0.22, 0.09, t + 0.02 + i * 0.045));
      metal(2093, 0.4, 0.04, t + 0.05);
      break;
    case 'spring':
      tone('sine', 260, 880, 0.16, 0.22);
      tone('triangle', 520, 1400, 0.12, 0.08, t + 0.03);
      noise(0.12, 0.08, 'highpass', 3000, 6000, 0.7);
      break;
    case 'silk':
      // the thread shoots out: a fast rising zip and a tick when it catches
      noise(0.1, 0.18, 'bandpass', 1800, 6200, 4);
      tone('sine', 900, 2400, 0.09, 0.06);
      metal(1900, 0.12, 0.06, t + 0.09);
      break;
    case 'swing':
      noise(0.22, 0.05 + Math.min(0.12, arg * 0.0002), 'bandpass', 500, 1600, 1.2);
      break;
    case 'fling':
      noise(0.25, 0.14, 'bandpass', 900, 3200, 1.5);
      tone('sine', 400, 1200, 0.18, 0.12);
      break;
    case 'snap':
      tone('square', 1800, 300, 0.06, 0.08);
      noise(0.08, 0.2, 'highpass', 2500, 1200, 1);
      break;
    case 'fly':
      // a gulp and a little rising pip, pitched up the more you chain
      tone('sine', 220, 140, 0.06, 0.25);
      tone('triangle', 900 + Math.min(8, arg) * 90, 1500 + Math.min(8, arg) * 90, 0.09, 0.09, t + 0.04);
      break;
    case 'combo': {
      // a bright pip that climbs a scale as the combo grows
      const SC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const f = 660 * 2 ** (SC[Math.min(SC.length - 1, Math.max(0, arg - 2))] / 12);
      tone('triangle', f, f * 1.01, 0.12, 0.07, t + 0.05);
      if (arg >= 10) tone('sine', f * 2, f * 2, 0.18, 0.04, t + 0.08);
      break;
    }
    case 'comboLost':
      tone('triangle', 520, 260, 0.22, 0.08);
      tone('triangle', 390, 196, 0.26, 0.06, t + 0.07);
      break;
    case 'gold':
      [783.99, 987.77, 1174.66, 1567.98, 1975.53].forEach((f, i) => tone('triangle', f, f, 0.5, 0.08, t + i * 0.06));
      metal(2349, 0.9, 0.06, t + 0.3);
      noise(0.5, 0.06, 'highpass', 6000, 9000, 0.5, t + 0.1);
      break;
    case 'scrabble':
      for (let i = 0; i < 4; i++) noise(0.02, 0.06, 'bandpass', rnd(2000, 4000), rnd(2000, 4000), 3, t + i * 0.035);
      break;
    case 'levelup':
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone('triangle', f, f * 1.002, 0.5, 0.1, t + i * 0.08));
      [523.25, 783.99, 1046.5].forEach((f) => tone('sine', f, f, 1.4, 0.07, t + 0.42));
      break;
    case 'goal':
      [659.25, 987.77].forEach((f, i) => tone('triangle', f, f, 0.3, 0.1, t + i * 0.1));
      break;
    case 'chest':
      metal(330, 0.5, 0.2);
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone('triangle', f, f, 0.4, 0.07, t + 0.25 + i * 0.05));
      noise(0.8, 0.08, 'highpass', 5000, 9000, 0.5, t + 0.25);
      break;
    case 'silkTick':
      tone('triangle', 1200 + Math.min(20, arg) * 40, 1300 + Math.min(20, arg) * 40, 0.04, 0.05);
      break;
    case 'unlock':
      tone('triangle', 784, 1568, 0.25, 0.1);
      metal(1568, 0.5, 0.05, t + 0.1);
      break;
    case 'drip':
      tone('sine', rnd(1400, 2200), rnd(500, 800), 0.06, 0.05);
      break;
    case 'bigland':
      noise(0.12, 0.3, 'lowpass', 700, 200, 1);
      tone('sine', 140, 60, 0.16, 0.3);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- rain on zinc

function startRain() {
  rainSrc = ac.createBufferSource();
  rainSrc.buffer = noiseBuf;
  rainSrc.loop = true;
  rainFilter = ac.createBiquadFilter();
  rainFilter.type = 'bandpass';
  rainFilter.frequency.value = 2600;
  rainFilter.Q.value = 0.4;
  rainGain = ac.createGain();
  rainGain.gain.value = 0.0001;
  rainSrc.connect(rainFilter).connect(rainGain).connect(master);
  rainSrc.start();
}

let rainLevel = 0;
let tickAt = 0;
/** The rain's loudness 0..1 (a drizzle in the sun, a downpour under the flush). */
export function setRain(level) {
  if (!ac || !rainGain) return;
  rainLevel = Math.max(0, Math.min(1, level));
  const t = now();
  rainGain.gain.setTargetAtTime(0.012 + rainLevel * 0.09, t, 0.25);
  rainFilter.frequency.setTargetAtTime(2200 + rainLevel * 1400, t, 0.3);
  if (t > tickAt && ac.state === 'running') {
    tickAt = t + rnd(0.05, 0.3) / (0.3 + rainLevel);
    tone('sine', rnd(3500, 6500), rnd(3000, 6000), 0.02, 0.01 + rainLevel * 0.02);
  }
}

// ---------------------------------------------------------------- music

// The rhyme in 6/8, in eighth notes: [midi, eighths] (0 = rest), with E, A and B flattened (C minor).
const TUNE = [
  [60, 2], [60, 1], [60, 2], [62, 1], [63, 3], [63, 2], [63, 1], [62, 2], [60, 1], [62, 2], [63, 1], [60, 5], [0, 1],
  [63, 3], [63, 2], [65, 1], [67, 5], [0, 1], [65, 2], [63, 1], [65, 2], [67, 1], [63, 5], [0, 1],
  [60, 3], [60, 2], [62, 1], [63, 5], [0, 1], [62, 2], [60, 1], [62, 2], [63, 1], [60, 5], [55, 1],
  [60, 2], [60, 1], [60, 2], [62, 1], [63, 3], [63, 2], [63, 1], [62, 2], [60, 1], [62, 2], [63, 1], [60, 5], [55, 1],
];
// One chord per bar (16 bars): root and the chord tones.
const CHORDS = [
  [48, 51, 55], [44, 48, 51], [41, 44, 48], [43, 47, 50],
  [48, 51, 55], [51, 55, 58], [41, 44, 48], [43, 47, 50],
  [44, 48, 51], [51, 55, 58], [41, 44, 48], [43, 47, 50],
  [48, 51, 55], [44, 48, 51], [43, 47, 50], [48, 51, 55],
];
const TUNE_STEPS = [];
{
  let at = 0;
  for (const [m, d] of TUNE) {
    TUNE_STEPS.push({ at, m, d });
    at += d;
  }
}
const LOOP = 96;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

const music = { on: false, mode: 'menu', weather: 'sun', step: 0, nextT: 0, build: 0, height: 0, sunUntil: 0 };

/** How far up the climb is (0..1): the music adds its layers as you go. */
export function setMusicHeight(k) {
  music.height = Math.max(0, Math.min(1, k || 0));
}

/** Out came the sun: everything plays, an octave up, for a few bars. */
export function musicSun() {
  if (!ac) return;
  music.sunUntil = now() + 6;
}

/** 'menu' (slower, softer), 'race', or 'off'. */
export function setMusic(mode) {
  if (mode === 'off') {
    music.on = false;
    return;
  }
  if (!music.on && ac) {
    music.step = 0;
    music.nextT = now() + 0.1;
  }
  music.on = true;
  music.mode = mode;
  if (musicBus && ac) musicBus.gain.setTargetAtTime(mode === 'menu' ? 0.32 : 0.5, now(), 0.4);
}

/** 'sun', 'warn' (the tune drops out, drums build) or 'flush' (ducked). */
export function setMusicWeather(w) {
  if (music.weather === w || !ac) return;
  music.weather = w;
  music.build = 0;
  musicDuck.gain.setTargetAtTime(w === 'flush' ? 0.35 : 1, now(), w === 'flush' ? 0.05 : 0.4);
}

function schedule() {
  if (!ac || !music.on || ac.state !== 'running') return;
  const eighth = 60 / (3 * (music.mode === 'menu' ? 70 : 88));
  if (music.nextT < now() - 0.5) music.nextT = now() + 0.05;
  while (music.nextT < now() + 0.12) {
    playStep(music.step, music.nextT, eighth);
    music.step = (music.step + 1) % LOOP;
    music.nextT += eighth;
  }
}

function pluck(f, t, dur, vol, type = 'triangle', bright = 2400) {
  const o = ac.createOscillator();
  const flt = ac.createBiquadFilter();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = f;
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(bright, t);
  flt.frequency.exponentialRampToValueAtTime(400, t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(flt).connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hat(t, vol) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ac.createGain();
  env(g, t, 0.002, vol, 0.04);
  s.connect(f).connect(g).connect(musicBus);
  s.start(t, Math.random());
  s.stop(t + 0.08);
}

function kick(t, vol) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  env(g, t, 0.003, vol, 0.2);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + 0.3);
}

function playStep(step, t, eighth) {
  const bar = Math.floor(step / 6);
  const beat = step % 6;
  const chord = CHORDS[bar % 16];
  const warn = music.weather === 'warn';
  const flush = music.weather === 'flush';
  const menu = music.mode === 'menu';
  const sun = now() < music.sunUntil;
  const hgt = menu ? 0.55 : sun ? 1 : music.height;
  if (beat === 0) kick(t, flush ? 0.5 : 0.38);
  if (beat === 3 && !menu) kick(t, 0.16);
  if (!flush) {
    hat(t, beat === 0 || beat === 3 ? 0.05 : 0.025);
    if (warn) {
      hat(t + eighth / 2, 0.02 + music.build * 0.002);
      music.build = Math.min(20, music.build + 1);
      if (beat === 5) pluck(mtof(36 + (music.build % 3) * 7), t, 0.12, 0.12, 'sine', 600);
    }
  }
  // Bass on the dotted beats.
  if (beat === 0 || beat === 3) pluck(mtof(chord[0] - 12), t, eighth * 2.6, flush ? 0.1 : 0.16, 'triangle', 700);
  // A soft chord at the bar (from a third of the way up).
  if (beat === 0 && !flush && hgt > 0.28) for (const m of chord) pluck(mtof(m + 12), t, eighth * 5, 0.022, 'sine', 1200);
  // Arpeggio eighths over the chord, two thirds up.
  if (!flush && !warn && hgt > 0.62 && !menu) pluck(mtof(chord[(beat * 2) % 3] + 24), t, eighth * 0.8, 0.018 + (sun ? 0.01 : 0), 'triangle', 3200);
  // The tune, unless the rain is coming (from the first ring up; always at the sun).
  if (!warn && !flush && (hgt > 0.12 || menu)) {
    for (const n of TUNE_STEPS) {
      if (n.at === step && n.m) {
        pluck(mtof(n.m + 12), t, Math.min(0.5, n.d * eighth * 0.9), menu ? 0.06 : 0.08, 'square', 2600);
        // near the top a bell an octave up joins it
        if (hgt > 0.85 || sun) pluck(mtof(n.m + 24), t, Math.min(0.6, n.d * eighth), 0.035, 'sine', 5000);
      }
    }
  }
}
