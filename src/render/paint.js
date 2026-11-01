// Painted canvases for the world: the rooms behind the windows, stained glass, rain on glass, ivy leaves, curtains and
// the town's skyline. Drawn once at load (seeded, so the same every time).

import { canvasTex, rand } from './tex.js';
import { makeNoise } from './geo.js';

const S = 512;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx, x, y, r, col, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function vignette(ctx, w, h, a = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.2, w / 2, h / 2, w * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function grain(ctx, w, h, r, n = 3000, a = 0.05) {
  ctx.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.5 ? '#000' : '#fff';
    ctx.fillRect(r() * w, r() * h, 2, 2);
  }
  ctx.globalAlpha = 1;
}

const ROOMS = {
  living(ctx, w, h, r) {
    // wallpaper, a picture, a lamp, a sofa, a bookshelf
    ctx.fillStyle = '#7a5a4a';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 28) {
      ctx.fillStyle = x % 56 ? '#8a6a56' : '#6e4f40';
      ctx.fillRect(x, 0, 14, h * 0.72);
    }
    ctx.fillStyle = '#4a3226';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(0, h * 0.7, w, 10);
    // picture
    ctx.fillStyle = '#c9a25a';
    ctx.fillRect(w * 0.18, h * 0.18, w * 0.3, h * 0.22);
    const g = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.38);
    g.addColorStop(0, '#8fb6d8');
    g.addColorStop(1, '#6f8f4a');
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.2, h * 0.2, w * 0.26, h * 0.18);
    // bookshelf
    ctx.fillStyle = '#3b2618';
    ctx.fillRect(w * 0.68, h * 0.12, w * 0.26, h * 0.6);
    const books = ['#a33', '#2a5a8a', '#d9a441', '#3a6a3a', '#ddd', '#7a3a7a', '#b5602a'];
    for (let row = 0; row < 4; row++) {
      let x = w * 0.69;
      const y = h * 0.14 + row * h * 0.145;
      while (x < w * 0.93) {
        const bw = 8 + r() * 10;
        ctx.fillStyle = books[Math.floor(r() * books.length)];
        ctx.fillRect(x, y + r() * 10, bw, h * 0.12 - r() * 10);
        x += bw + 1;
      }
    }
    // sofa back
    ctx.fillStyle = '#7a2a28';
    rr(ctx, w * 0.06, h * 0.62, w * 0.56, h * 0.24, 30);
    ctx.fill();
    ctx.fillStyle = '#5a1c1a';
    rr(ctx, w * 0.1, h * 0.66, w * 0.22, h * 0.14, 20);
    ctx.fill();
    rr(ctx, w * 0.36, h * 0.66, w * 0.22, h * 0.14, 20);
    ctx.fill();
    // lamp
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(w * 0.6, h * 0.36, 5, h * 0.4);
    ctx.fillStyle = '#ffe2a8';
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.36);
    ctx.lineTo(w * 0.67, h * 0.36);
    ctx.lineTo(w * 0.64, h * 0.26);
    ctx.lineTo(w * 0.58, h * 0.26);
    ctx.fill();
    glow(ctx, w * 0.61, h * 0.33, w * 0.42, 'rgba(255,190,110,0.85)');
    glow(ctx, w * 0.61, h * 0.33, w * 0.08, 'rgba(255,250,220,1)');
  },
  kitchen(ctx, w, h, r) {
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b8b09a';
    ctx.lineWidth = 2;
    for (let y = h * 0.35; y < h * 0.7; y += 26) for (let x = 0; x < w; x += 26) ctx.strokeRect(x, y, 26, 26);
    ctx.fillStyle = '#6a4a2e';
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(0, h * 0.68, w, 12);
    for (const y of [h * 0.14, h * 0.28]) {
      ctx.fillStyle = '#7a5530';
      ctx.fillRect(w * 0.08, y, w * 0.6, 8);
      let x = w * 0.1;
      while (x < w * 0.62) {
        const jw = 20 + r() * 18;
        const jh = 30 + r() * 26;
        ctx.fillStyle = ['#c84', '#a33', '#e8d07a', '#6a8a4a', '#ddd'][Math.floor(r() * 5)];
        rr(ctx, x, y - jh, jw, jh, 5);
        ctx.fill();
        x += jw + 6;
      }
    }
    // a pan hanging, a pendant lamp
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.42, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.82 - 3, h * 0.2, 6, h * 0.18);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(w * 0.45, 0, 3, h * 0.2);
    glow(ctx, w * 0.46, h * 0.24, w * 0.5, 'rgba(255,200,120,0.7)');
    glow(ctx, w * 0.46, h * 0.22, w * 0.07, 'rgba(255,248,220,1)');
  },
  bakery(ctx, w, h, r) {
    ctx.fillStyle = '#6a4228';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      const y = h * 0.16 + row * h * 0.17;
      ctx.fillStyle = '#3a2416';
      ctx.fillRect(0, y + h * 0.1, w, 10);
      let x = 12 + r() * 20;
      while (x < w - 40) {
        const lw = 46 + r() * 30;
        const lh = 26 + r() * 14;
        const g = ctx.createRadialGradient(x + lw / 2, y + h * 0.1 - lh * 0.7, 2, x + lw / 2, y + h * 0.1 - lh / 2, lw * 0.7);
        g.addColorStop(0, '#f2c46b');
        g.addColorStop(1, '#a0582a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + lw / 2, y + h * 0.1 - lh / 2, lw / 2, lh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,200,0.7)';
        ctx.lineWidth = 2;
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(x + (lw * k) / 4 - 4, y + h * 0.1 - lh * 0.85);
          ctx.lineTo(x + (lw * k) / 4 + 4, y + h * 0.1 - lh * 0.2);
          ctx.stroke();
        }
        x += lw + 8 + r() * 10;
      }
    }
    // the counter and a cake
    ctx.fillStyle = '#efe3cf';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = '#f4c4c8';
    ctx.fillRect(w * 0.38, h * 0.72, w * 0.24, h * 0.1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(w * 0.38, h * 0.71, w * 0.24, 8);
    ctx.fillStyle = '#d33';
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(w * 0.4 + k * w * 0.05, h * 0.705, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    glow(ctx, w * 0.5, h * 0.05, w * 0.6, 'rgba(255,190,100,0.75)');
    glow(ctx, w * 0.5, h * 0.03, w * 0.08, 'rgba(255,250,225,1)');
  },
  class(ctx, w, h, r) {
    ctx.fillStyle = '#c9c0a4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a6448';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    // chalkboard
    ctx.fillStyle = '#2f4a3a';
    ctx.fillRect(w * 0.08, h * 0.2, w * 0.84, h * 0.42);
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 10;
    ctx.strokeRect(w * 0.08, h * 0.2, w * 0.84, h * 0.42);
    ctx.strokeStyle = 'rgba(240,240,230,0.85)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 44px serif';
    ctx.fillStyle = 'rgba(240,240,230,0.85)';
    ctx.fillText('A B C', w * 0.14, h * 0.32);
    ctx.fillText('2 + 2 = 4', w * 0.14, h * 0.42);
    // a chalk spider climbing a chalk spout
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.58);
    ctx.lineTo(w * 0.72, h * 0.26);
    ctx.moveTo(w * 0.8, h * 0.58);
    ctx.lineTo(w * 0.8, h * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.76, h * 0.4, 9, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.76 - 8, h * 0.4 - 6 + k * 4);
      ctx.lineTo(w * 0.76 - 22, h * 0.4 - 14 + k * 9);
      ctx.moveTo(w * 0.76 + 8, h * 0.4 - 6 + k * 4);
      ctx.lineTo(w * 0.76 + 22, h * 0.4 - 14 + k * 9);
      ctx.stroke();
    }
    // the alphabet strip and a clock
    ctx.fillStyle = '#f3ede2';
    ctx.fillRect(0, h * 0.06, w, h * 0.08);
    ctx.font = 'bold 26px sans-serif';
    const cols = ['#c33', '#36c', '#2a2', '#c80', '#93c'];
    'ABCDEFGHIJ'.split('').forEach((c, i) => {
      ctx.fillStyle = cols[i % 5];
      ctx.fillText(c, 10 + i * (w / 10), h * 0.12);
    });
    // desks
    ctx.fillStyle = '#9a7448';
    for (let k = 0; k < 3; k++) ctx.fillRect(w * 0.05 + k * w * 0.33, h * 0.72, w * 0.26, 14);
    glow(ctx, w * 0.5, 0, w * 0.7, 'rgba(255,245,215,0.55)');
  },
  hall(ctx, w, h, r) {
    ctx.fillStyle = '#5a3a24';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      ctx.fillStyle = '#4a2e1c';
      ctx.fillRect(x + 6, h * 0.5, 52, h * 0.45);
    }
    ctx.fillStyle = '#c9a25a';
    ctx.fillRect(w * 0.3, h * 0.12, w * 0.4, h * 0.3);
    ctx.fillStyle = '#4a3a30';
    ctx.fillRect(w * 0.33, h * 0.15, w * 0.34, h * 0.24);
    ctx.fillStyle = '#d8b090';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.25, w * 0.06, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a1a20';
    ctx.fillRect(0, 0, w * 0.12, h);
    ctx.fillRect(w * 0.88, 0, w * 0.12, h);
    glow(ctx, w * 0.5, h * 0.02, w * 0.55, 'rgba(255,215,140,0.8)');
    for (let k = 0; k < 7; k++) glow(ctx, w * (0.32 + k * 0.06), h * 0.05, 14, 'rgba(255,250,230,1)');
  },
  shed(ctx, w, h, r) {
    ctx.fillStyle = '#3a2c20';
    ctx.fillRect(0, 0, w, h);
    // pegboard with tools
    ctx.fillStyle = '#7a6448';
    ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.5);
    ctx.fillStyle = '#5a4a36';
    for (let y = h * 0.12; y < h * 0.6; y += 18) for (let x = w * 0.12; x < w * 0.9; x += 18) ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(w * 0.2, h * 0.15, 8, h * 0.35);
    ctx.fillRect(w * 0.16, h * 0.15, 36, 10);
    ctx.fillStyle = '#c33';
    ctx.fillRect(w * 0.42, h * 0.2, 10, h * 0.28);
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c20';
    ctx.beginPath();
    ctx.arc(w * 0.66, h * 0.32, 18, 0, Math.PI * 2);
    ctx.fill();
    // paint tins on a shelf
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(0, h * 0.74, w, 12);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = ['#8a8a8a', '#3a6aa0', '#c8a040', '#a03a3a'][k % 4];
      ctx.fillRect(w * 0.06 + k * w * 0.15, h * 0.62, w * 0.11, h * 0.12);
    }
    glow(ctx, w * 0.8, h * 0.2, w * 0.5, 'rgba(255,220,160,0.35)');
  },
  hay(ctx, w, h, r) {
    ctx.fillStyle = '#3a2618';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, h * 0.1, w, 20);
    ctx.fillRect(w * 0.3, 0, 22, h);
    for (let k = 0; k < 7; k++) {
      const x = (k % 4) * w * 0.26 - 20;
      const y = h * 0.55 + Math.floor(k / 4) * h * 0.2 - (k > 3 ? h * 0.38 : 0);
      ctx.fillStyle = '#c9a248';
      ctx.fillRect(x, y, w * 0.25, h * 0.19);
      ctx.strokeStyle = '#8a6a24';
      ctx.lineWidth = 2;
      for (let s = 0; s < 30; s++) {
        ctx.beginPath();
        const sx = x + r() * w * 0.25;
        const sy = y + r() * h * 0.19;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (r() - 0.5) * 20, sy + (r() - 0.5) * 12);
        ctx.stroke();
      }
    }
    glow(ctx, w * 0.72, h * 0.3, w * 0.5, 'rgba(255,170,80,0.8)');
    glow(ctx, w * 0.72, h * 0.3, 18, 'rgba(255,240,200,1)');
  },
  plants(ctx, w, h, r) {
    ctx.fillStyle = '#20402a';
    ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      const x = r() * w;
      const y = r() * h;
      const s = 40 + r() * 70;
      ctx.fillStyle = ['#3f7a34', '#5a9a40', '#2f6a2a', '#7aaa4a'][k % 4];
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.45, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = k % 3 ? '#d8402a' : '#f0a020';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 9 + r() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    glow(ctx, w * 0.5, 0, w * 0.8, 'rgba(255,255,220,0.35)');
  },
  porthole(ctx, w, h, r) {
    ctx.fillStyle = '#2a3440';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 8;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.9 - k * h * 0.14);
      ctx.lineTo(w, h * 0.8 - k * h * 0.14);
      ctx.stroke();
    }
    glow(ctx, w * 0.6, h * 0.3, w * 0.6, 'rgba(255,200,120,0.85)');
    glow(ctx, w * 0.6, h * 0.3, 20, 'rgba(255,250,230,1)');
  },
  flat(ctx, w, h, r, v = 0) {
    const walls = ['#5a6a7a', '#7a5a4a', '#4a5a4a', '#6a5a6a'];
    ctx.fillStyle = walls[v % 4];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    if (v % 2 === 0) {
      // the telly's blue light and someone on the sofa
      glow(ctx, w * 0.25, h * 0.6, w * 0.5, 'rgba(110,170,255,0.8)');
      ctx.fillStyle = '#1a1a22';
      rr(ctx, w * 0.4, h * 0.6, w * 0.5, h * 0.22, 26);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.62, h * 0.52, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.56, h * 0.55, 70, 60);
    } else {
      // a lamp, a plant, a picture
      glow(ctx, w * 0.75, h * 0.4, w * 0.55, 'rgba(255,190,110,0.85)');
      glow(ctx, w * 0.75, h * 0.38, 14, 'rgba(255,250,230,1)');
      ctx.fillStyle = '#2f5a2a';
      for (let k = 0; k < 8; k++) {
        ctx.beginPath();
        ctx.ellipse(w * 0.2 + (r() - 0.5) * 60, h * 0.55 - r() * 90, 40, 14, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#9a5a3a';
      ctx.fillRect(w * 0.14, h * 0.6, 70, 60);
      ctx.fillStyle = '#d8c8a8';
      ctx.fillRect(w * 0.4, h * 0.18, 110, 80);
    }
  },
  office(ctx, w, h, r, v = 0) {
    ctx.fillStyle = '#7a8a9a';
    ctx.fillRect(0, 0, w, h);
    for (let x = 20; x < w; x += 130) {
      ctx.fillStyle = 'rgba(240,250,255,0.95)';
      ctx.fillRect(x, 12, 90, 16);
      glow(ctx, x + 45, 22, 110, 'rgba(220,240,255,0.5)');
    }
    for (let k = 0; k < 4; k++) {
      const x = 20 + k * 125;
      ctx.fillStyle = '#4a4e54';
      ctx.fillRect(x, h * 0.66, 110, 12);
      ctx.fillStyle = '#1a1e24';
      ctx.fillRect(x + 25, h * 0.5, 60, 42);
      ctx.fillStyle = (k + v) % 3 ? '#6ab0ff' : '#9fe0a0';
      ctx.fillRect(x + 29, h * 0.51, 52, 34);
      glow(ctx, x + 55, h * 0.55, 50, 'rgba(120,180,255,0.6)');
      ctx.fillStyle = '#22262c';
      ctx.fillRect(x + 40, h * 0.7, 30, 60);
    }
  },
};

/** The room behind a window: style and variant. */
export function roomTex(style, v = 0) {
  return canvasTex(`room:${style}:${v}`, S, S, (ctx, w, h) => {
    const r = rand(style.length * 97 + v * 13 + 5);
    (ROOMS[style] ?? ROOMS.living)(ctx, w, h, r, v);
    grain(ctx, w, h, r, 2500, 0.04);
    vignette(ctx, w, h, 0.5);
  });
}

/** Stained glass: jewel colours in lead cames, a sun and rays up top. */
export function stainedTex(v = 0) {
  return canvasTex(`stained:${v}`, 256, 768, (ctx, w, h) => {
    const r = rand(77 + v);
    const cols = ['#c8202a', '#1a4ab8', '#f0b020', '#20884a', '#7a2a9a', '#e86020', '#2a9ab8'];
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    const cell = 48;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const jx = (r() - 0.5) * 16;
        const jy = (r() - 0.5) * 16;
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.beginPath();
        ctx.moveTo(x + 3 + jx * 0.2, y + 3);
        ctx.lineTo(x + cell - 3, y + 3 + jy * 0.2);
        ctx.lineTo(x + cell - 3 + jx * 0.2, y + cell - 3);
        ctx.lineTo(x + 3, y + cell - 3 + jy * 0.2);
        ctx.fill();
        if (r() < 0.5) {
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cell, y + cell);
          ctx.stroke();
        }
      }
    }
    // a big sun near the top
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.16, w * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * w * 0.28, h * 0.16 + Math.sin(a) * w * 0.28);
      ctx.lineTo(w / 2 + Math.cos(a) * w * 0.5, h * 0.16 + Math.sin(a) * w * 0.5);
      ctx.stroke();
    }
    // light through it: brighter in the middle
    const g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.5, h * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Raindrops and runs on glass, as a normal map (linear). */
export function rainGlassNormal() {
  return canvasTex(
    'rainGlass',
    512,
    512,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 128;
        d[i + 1] = 128;
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
      const r = rand(4242);
      const drop = (cx, cy, rad, sy = 1) => {
        for (let y = Math.max(0, Math.floor(cy - rad * sy)); y < Math.min(h, cy + rad * sy); y++) {
          for (let x = Math.max(0, Math.floor(cx - rad)); x < Math.min(w, cx + rad); x++) {
            const dx = (x - cx) / rad;
            const dy = (y - cy) / (rad * sy);
            const q = dx * dx + dy * dy;
            if (q >= 1) continue;
            const k = (y * w + x) * 4;
            d[k] = 128 + dx * 110;
            d[k + 1] = 128 - dy * 110;
            d[k + 2] = 255 - q * 60;
          }
        }
      };
      for (let i = 0; i < 260; i++) drop(r() * w, r() * h, 2 + r() * 7);
      for (let i = 0; i < 14; i++) {
        // runs: a line of small drops trailing up from a big one
        const x = r() * w;
        let y = r() * h;
        drop(x, y, 7 + r() * 4, 1.2);
        for (let k = 0; k < 18; k++) {
          y -= 6 + r() * 4;
          drop(x + (r() - 0.5) * 3, (y + h) % h, 2.2 + r() * 1.5);
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { linear: true, repeat: true },
  );
}

/** Ivy leaf with alpha. */
export function ivyLeafTex() {
  return canvasTex('ivyLeaf', 128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    // a three-lobed ivy leaf, stem at the bottom
    ctx.moveTo(w * 0.5, h * 0.98);
    ctx.bezierCurveTo(w * 0.1, h * 0.85, w * 0.0, h * 0.55, w * 0.12, h * 0.42);
    ctx.bezierCurveTo(w * 0.2, h * 0.3, w * 0.35, h * 0.35, w * 0.38, h * 0.3);
    ctx.bezierCurveTo(w * 0.36, h * 0.12, w * 0.46, h * 0.02, w * 0.5, h * 0.02);
    ctx.bezierCurveTo(w * 0.54, h * 0.02, w * 0.64, h * 0.12, w * 0.62, h * 0.3);
    ctx.bezierCurveTo(w * 0.65, h * 0.35, w * 0.8, h * 0.3, w * 0.88, h * 0.42);
    ctx.bezierCurveTo(w * 1.0, h * 0.55, w * 0.9, h * 0.85, w * 0.5, h * 0.98);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(40,60,20,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.95);
    ctx.lineTo(w * 0.5, h * 0.15);
    ctx.moveTo(w * 0.5, h * 0.6);
    ctx.lineTo(w * 0.18, h * 0.45);
    ctx.moveTo(w * 0.5, h * 0.6);
    ctx.lineTo(w * 0.82, h * 0.45);
    ctx.stroke();
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** A curtain's folds (alpha at the bottom hem only). */
export function curtainTex(color = '#9a3a3a') {
  return canvasTex(`curtain:${color}`, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 9);
      ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - k)})`;
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = `rgba(255,255,255,${0.12 * k * k})`;
      ctx.fillRect(x, 0, 1, h);
    }
  });
}

/** A water stain running down a wall (alpha). */
export function stainTex() {
  return canvasTex('stain', 128, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = rand(99);
    for (let k = 0; k < 16; k++) {
      const x = w * 0.2 + r() * w * 0.6;
      const len = h * (0.3 + r() * 0.7);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 3 + r() * 10, len);
    }
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.3, 'rgba(0,0,0,1)');
    g.addColorStop(0.7, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Rooftops, chimneys and trees against the sky, far away (alpha). */
export function skylineTex(kind = 'town') {
  return canvasTex(`skyline:${kind}`, 2048, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = rand(kind.length * 31 + 3);
    const n = makeNoise(7);
    // far layer: hills and trees
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.55 - n.fbm(x / 300, 0.5, 3) * h * 0.35 - (r() < 0.3 ? r() * 10 : 0));
    ctx.lineTo(w, h);
    ctx.fill();
    // near layer: roofs with chimneys
    ctx.fillStyle = 'rgba(255,255,255,1)';
    let x = -40;
    while (x < w) {
      const bw = 90 + r() * 160;
      const top = h * (0.5 + r() * 0.25);
      const ridge = top - 20 - r() * 50;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, top);
      ctx.lineTo(x + bw / 2, ridge);
      ctx.lineTo(x + bw, top);
      ctx.lineTo(x + bw, h);
      ctx.fill();
      if (r() < 0.6) ctx.fillRect(x + bw * (0.2 + r() * 0.5), ridge - 26, 14, 40);
      if (r() < 0.2) {
        // a tree
        const tx = x + bw + 10;
        ctx.beginPath();
        ctx.arc(tx, top - 30, 40 + r() * 20, 0, Math.PI * 2);
        ctx.fill();
      }
      x += bw + r() * 30;
    }
  });
}
