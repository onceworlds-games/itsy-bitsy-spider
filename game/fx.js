// Particles (spray, drips, puffs, sparks, gold confetti) from a fixed pool, camera shake as trauma², hit-stop and a flash.

const KINDS = {
  spray: { g: -900, drag: 1.5, color: '#EEF9FF' },
  drip: { g: -1400, drag: 0, color: '#86D2F0' },
  puff: { g: 40, drag: 5, color: 'rgba(211,222,227,0.55)' },
  spark: { g: -700, drag: 1, color: '#FFD27A' },
  confetti: { g: -260, drag: 2.2, color: '#FFB648' },
  silk: { g: -60, drag: 3, color: '#F3EDE2' },
};

export function createFx(max = 420) {
  const pool = [];
  for (let i = 0; i < max; i++) pool.push({ on: false, kind: 'spray', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '', spin: 0 });
  return { pool, next: 0, trauma: 0, sx: 0, sy: 0, stop: 0, flash: 0, reduced: false, density: 1, t: 0 };
}

export function spawn(fx, kind, x, y, vx, vy, life, size, color) {
  const p = fx.pool[fx.next];
  fx.next = (fx.next + 1) % fx.pool.length;
  p.on = true;
  p.kind = kind;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.max = life;
  p.size = size;
  p.color = color ?? KINDS[kind].color;
  p.spin = Math.random() * 6;
  return p;
}

const rnd = (a, b) => a + Math.random() * (b - a);

/** Water spraying off something: n droplets fanning around `dir` (radians). */
export function spray(fx, x, y, n, dir = Math.PI / 2, spreadA = 1.2, speed = 260) {
  n = Math.ceil(n * fx.density);
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(-spreadA, spreadA);
    const v = speed * rnd(0.4, 1.2);
    spawn(fx, 'spray', x + rnd(-4, 4), y + rnd(-4, 4), Math.cos(a) * v, Math.sin(a) * v, rnd(0.25, 0.6), rnd(1.2, 3));
  }
}

export function puff(fx, x, y, n = 6) {
  n = Math.ceil(n * fx.density);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    spawn(fx, 'puff', x, y, Math.cos(a) * rnd(20, 70), Math.sin(a) * rnd(10, 50), rnd(0.3, 0.55), rnd(3, 6));
  }
}

export function sparks(fx, x, y, n = 8) {
  n = Math.ceil(n * fx.density);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    spawn(fx, 'spark', x, y, Math.cos(a) * rnd(90, 260), Math.sin(a) * rnd(90, 260), rnd(0.2, 0.45), rnd(1.2, 2.2));
  }
}

export function confetti(fx, x, y, n = 40, colors = ['#FFB648', '#FFD27A', '#F3EDE2', '#86D2F0']) {
  n = Math.ceil(n * fx.density);
  for (let i = 0; i < n; i++) {
    const a = rnd(Math.PI * 0.15, Math.PI * 0.85);
    const v = rnd(200, 520);
    spawn(fx, 'confetti', x + rnd(-20, 20), y, Math.cos(a) * v, Math.sin(a) * v, rnd(1.2, 2.2), rnd(2.5, 4.5), colors[i % colors.length]);
  }
}

export function drip(fx, x, y) {
  spawn(fx, 'drip', x, y, 0, -rnd(80, 200), rnd(0.5, 0.9), rnd(1.4, 2.4));
}

export function addTrauma(fx, k) {
  if (fx.reduced) return;
  fx.trauma = Math.min(1, fx.trauma + k);
}

export function hitStop(fx, s) {
  fx.stop = Math.max(fx.stop, s);
}

export function flash(fx, k) {
  if (fx.reduced) return;
  fx.flash = Math.max(fx.flash, k);
}

export function updateFx(fx, dt) {
  fx.t += dt;
  for (const p of fx.pool) {
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.on = false;
      continue;
    }
    const K = KINDS[p.kind];
    p.vy += K.g * dt;
    if (K.drag) {
      const d = Math.exp(-K.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.spin += dt * 9;
  }
  fx.trauma = Math.max(0, fx.trauma - dt * 1.4);
  const s = fx.trauma * fx.trauma;
  fx.sx = s * 14 * (Math.sin(fx.t * 61) + Math.sin(fx.t * 37) * 0.5);
  fx.sy = s * 14 * (Math.cos(fx.t * 53) + Math.sin(fx.t * 29) * 0.5);
  fx.flash = Math.max(0, fx.flash - dt * 3);
}

/** Draws the particles (world transform set). */
export function drawFx(ctx, fx, view) {
  for (const p of fx.pool) {
    if (!p.on || p.y < view.y0 - 40 || p.y > view.y1 + 40) continue;
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, k * 2.2);
    ctx.fillStyle = p.color;
    if (p.kind === 'drip' || p.kind === 'spray') {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 120) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / sp) * Math.min(14, sp * 0.02), p.y - (p.vy / sp) * Math.min(14, sp * 0.02));
        ctx.stroke();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'confetti') {
      const w = p.size * 1.6;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.scale(1, Math.cos(p.spin * 1.3));
      ctx.fillRect(-w / 2, -p.size / 2, w, p.size);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'puff' ? 1 + (1 - k) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
