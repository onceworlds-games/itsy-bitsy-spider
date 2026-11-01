// Badge art (?poster=badge-<id>): enamel pins, a bold symbol on a coloured field inside a metal ring. Drawn flat on a
// canvas at any size (the store shows them as small circles, so every symbol is one big shape with a thick ink line).
// The other store pictures are rendered by the game itself (main.js).

import { FONT_DISPLAY, shade, rgba } from './paint2d.js';

const INK = '#141B24';
const BONE = '#FBF4E6';
const CORAL = '#FF6F59';
const GOLD = '#FFC53D';
const WATER = '#8FD8FF';

const BADGES = {
  'first-climb': { field: '#3E9BE8', ring: 'gold', draw: firstClimb },
  'hold-on': { field: '#245E9C', ring: 'steel', draw: holdOn },
  'washed-out': { field: '#16677A', ring: 'steel', draw: washedOut },
  'out-came-the-sun': { field: '#4AB2F2', ring: 'gold', draw: outCameTheSun },
  'up-the-spout-again': { field: '#D2563B', ring: 'gold', draw: upAgain },
  'cup-winner': { field: '#2C3A63', ring: 'gold', draw: cupWinner },
  'no-washouts': { field: '#E9B949', ring: 'steel', draw: boneDry },
  'twelve-spouts': { field: '#4F8A3A', ring: 'steel', draw: twelveSpouts },
  'all-stars': { field: '#3B2F86', ring: 'gold', draw: allStars },
  'golden-flies': { field: '#1F4A3A', ring: 'gold', draw: goldenFly },
  'monsoon-100': { field: '#4A2F78', ring: 'steel', draw: monsoon },
  'perfect-hold': { field: '#0F7F86', ring: 'gold', draw: perfectHold },
};

export async function runPoster(name) {
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`400 80px ${FONT_DISPLAY}`), document.fonts.ready]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    // the system serif will do
  }
  const W = innerWidth || 256;
  const H = innerHeight || 256;
  for (const id of ['stage', 'hudc', 'ui']) document.getElementById(id)?.remove();
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  document.body.append(c);
  const ctx = c.getContext('2d');
  const b = name.startsWith('badge-') ? BADGES[name.slice(6)] : null;
  if (b) badge(ctx, W, H, b);
  document.body.dataset.ready = '1';
}

// ------------------------------------------------------------------------------------------------ the pin

const RINGS = {
  gold: ['#FFF3BF', '#F2C450', '#B07A1E', '#6E4510'],
  steel: ['#FFFFFF', '#D2DCE3', '#8496A3', '#46525C'],
};

function badge(ctx, W, H, b) {
  const s = Math.min(W, H) / 256;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  const ring = RINGS[b.ring];
  // the field (full bleed, so it reads cropped to a circle or not)
  const fg = ctx.createRadialGradient(-50, -70, 10, 0, 0, 200);
  fg.addColorStop(0, shade(b.field, 1.28));
  fg.addColorStop(0.55, b.field);
  fg.addColorStop(1, shade(b.field, 0.62));
  ctx.fillStyle = fg;
  ctx.fillRect(-128, -128, 256, 256);
  // rain on the enamel
  ctx.save();
  circle(ctx, 0, 0, 112);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = -140 + ((i * 53) % 280);
    const y = -130 + ((i * 97) % 260);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 9, y + 26);
    ctx.stroke();
  }
  // a soft shadow under the symbol
  const sh = ctx.createRadialGradient(0, 30, 10, 0, 30, 110);
  sh.addColorStop(0, 'rgba(0,0,0,0.22)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  // the symbol, inside the enamel (anything that runs off it passes under the ring)
  ctx.save();
  circle(ctx, 0, 0, 113);
  ctx.clip();
  b.draw(ctx);
  ctx.restore();
  // the metal ring, with a little shadow on the enamel
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 126, 0, Math.PI * 2);
  ctx.arc(0, 0, 112, 0, Math.PI * 2, true);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  const rg = ctx.createLinearGradient(-90, -120, 90, 120);
  rg.addColorStop(0, ring[0]);
  rg.addColorStop(0.35, ring[1]);
  rg.addColorStop(0.75, ring[2]);
  rg.addColorStop(1, ring[3]);
  ctx.beginPath();
  ctx.arc(0, 0, 126, 0, Math.PI * 2);
  ctx.arc(0, 0, 112, 0, Math.PI * 2, true);
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = rgba(ring[3], 0.9);
  circle(ctx, 0, 0, 112);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 123, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  // gloss across the top
  ctx.save();
  circle(ctx, 0, 0, 112);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, -112, 0, 0);
  gl.addColorStop(0, 'rgba(255,255,255,0.26)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.ellipse(-8, -70, 118, 62, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ drawing helpers

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Fill the current path with an ink outline (the outline is drawn first, half hidden by the fill). */
function inked(ctx, fill, w = 9) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A shaded fill: lighter at the top-left. */
function lit(ctx, col, x0 = -40, y0 = -60, x1 = 40, y1 = 60) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(col, 1.3));
  g.addColorStop(0.5, col);
  g.addColorStop(1, shade(col, 0.72));
  return g;
}

/** A thick line drawn as ink then colour (legs, arrows, streams). */
function stroke2(ctx, col, w, ink = 9) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + ink;
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
}

function shine(ctx, x, y, rx, ry, a = 0.7, rot = -0.5) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function drop(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.7);
  ctx.bezierCurveTo(x + r * 0.5, y - r * 0.9, x + r, y - r * 0.4, x + r, y + r * 0.15);
  ctx.arc(x, y + r * 0.15, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.4, x - r * 0.5, y - r * 0.9, x, y - r * 1.7);
  ctx.closePath();
}

function star(ctx, x, y, r, inner = 0.47, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

/**
 * The spider, face on: abdomen behind, head in front with two big glossy eyes, eight bent legs. s scales it (1 = about
 * 170 across). o: { color, wave (raises the front right leg) }
 */
function spider(ctx, x, y, s, o = {}) {
  const col = o.color ?? CORAL;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // legs: four a side, knee up, foot out
  const legs = [
    [-24, -6, -62, -40, -78, -8],
    [-26, 4, -70, -10, -86, 26],
    [-24, 14, -62, 22, -74, 56],
    [-18, 22, -44, 46, -50, 74],
  ];
  const legCol = shade(col, 0.72);
  for (const side of [-1, 1]) {
    legs.forEach((L, i) => {
      let [ax, ay, kx, ky, fx, fy] = L;
      if (o.wave && side === 1 && i === 0) {
        kx = -58;
        ky = -64;
        fx = -70;
        fy = -98;
      }
      ctx.beginPath();
      ctx.moveTo(ax * side, ay);
      ctx.lineTo(kx * side, ky);
      ctx.lineTo(fx * side, fy);
      stroke2(ctx, legCol, 11, 9);
      // a pale band before each foot
      ctx.beginPath();
      ctx.moveTo((kx + (fx - kx) * 0.78) * side, ky + (fy - ky) * 0.78);
      ctx.lineTo((kx + (fx - kx) * 0.88) * side, ky + (fy - ky) * 0.88);
      ctx.strokeStyle = shade(col, 1.45);
      ctx.lineWidth = 11;
      ctx.lineCap = 'butt';
      ctx.stroke();
    });
  }
  // abdomen, peeking above the head
  ctx.beginPath();
  ctx.ellipse(0, -30, 40, 34, 0, 0, Math.PI * 2);
  inked(ctx, lit(ctx, shade(col, 0.92), -30, -60, 30, 0), 9);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba('#FFFFFF', 0.85);
  for (const yy of [-52, -38]) {
    ctx.beginPath();
    ctx.ellipse(0, yy, 44, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // head
  ctx.beginPath();
  ctx.ellipse(0, 12, 42, 36, 0, 0, Math.PI * 2);
  inked(ctx, lit(ctx, col, -30, -20, 30, 50), 9);
  // eyes
  for (const ex of [-17, 17]) {
    circle(ctx, ex, 10, 15);
    inked(ctx, '#0E1218', 5);
    shine(ctx, ex - 5, 4, 5.5, 4, 0.95, -0.6);
    circle(ctx, ex + 6, 16, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }
  // little side eyes and a smile
  for (const ex of [-33, 33]) {
    circle(ctx, ex, -2, 4.5);
    ctx.fillStyle = '#0E1218';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 30, 8, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function sunDisc(ctx, x, y, r, rays) {
  for (let i = 0; i < rays; i++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i / rays) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, -r * 1.12);
    ctx.lineTo(0, -r * 1.65);
    ctx.lineTo(r * 0.24, -r * 1.12);
    ctx.closePath();
    inked(ctx, '#FFD84D', 6);
    ctx.restore();
  }
  circle(ctx, x, y, r);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  g.addColorStop(0, '#FFF6C4');
  g.addColorStop(1, '#FFC12E');
  inked(ctx, g, 8);
}

// ------------------------------------------------------------------------------------------------ the symbols

function firstClimb(ctx) {
  // the spider at the top of the spout, waving, the sun behind it
  sunDisc(ctx, 48, -46, 26, 10);
  ctx.beginPath();
  ctx.rect(-26, 46, 52, 90);
  inked(ctx, lit(ctx, '#C9D6DE', -26, 0, 26, 0), 8);
  ctx.beginPath();
  ctx.rect(-36, 40, 72, 16);
  inked(ctx, lit(ctx, '#E3EBF0', -36, 0, 36, 0), 8);
  spider(ctx, -6, 12, 0.74, { wave: true });
}

function holdOn(ctx) {
  // water splitting round a spider that won't let go
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 10, -112);
    ctx.bezierCurveTo(side * 30, -60, side * 92, -40, side * 88, 30);
    ctx.lineTo(side * 84, 112);
    stroke2(ctx, WATER, 22, 9);
    ctx.beginPath();
    ctx.moveTo(side * 14, -100);
    ctx.bezierCurveTo(side * 30, -64, side * 82, -44, side * 80, 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  for (const [x, y] of [[-44, -70], [50, -64], [-60, 64], [62, 70]]) {
    drop(ctx, x, y, 7);
    inked(ctx, WATER, 5);
  }
  spider(ctx, 0, 20, 0.86);
}

function washedOut(ctx) {
  // a curling wave with a spider tumbling in it
  ctx.beginPath();
  ctx.moveTo(-104, 60);
  ctx.bezierCurveTo(-96, -30, -40, -88, 30, -84);
  ctx.bezierCurveTo(88, -80, 104, -24, 74, 4);
  ctx.bezierCurveTo(54, 22, 26, 6, 34, -16);
  ctx.bezierCurveTo(40, -34, 62, -30, 60, -20);
  ctx.bezierCurveTo(40, -54, -14, -40, -26, 6);
  ctx.bezierCurveTo(-36, 44, -10, 76, 40, 82);
  ctx.lineTo(100, 82);
  ctx.lineTo(100, 120);
  ctx.lineTo(-104, 120);
  ctx.closePath();
  inked(ctx, lit(ctx, '#5CC6F2', -60, -80, 60, 80), 9);
  // foam on the crest
  ctx.beginPath();
  ctx.moveTo(-60, -40);
  ctx.bezierCurveTo(-30, -78, 40, -92, 80, -54);
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.stroke();
  for (const [x, y, r] of [[-70, -44, 8], [86, -46, 7], [94, -24, 5]]) {
    circle(ctx, x, y, r);
    inked(ctx, BONE, 5);
  }
  ctx.save();
  ctx.translate(-34, 46);
  ctx.rotate(2.4);
  spider(ctx, 0, 0, 0.5);
  ctx.restore();
}

function outCameTheSun(ctx) {
  // a rainbow and the sun up over it
  const bands = ['#FF5E5B', '#FFA23A', '#FFE14D', '#58D27A', '#3FA7FF', '#8C6BFF'];
  const R0 = 100;
  const BW = 7;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(0, 70, R0 - (BW * bands.length) / 2 + BW / 2, Math.PI, 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = BW * bands.length + 10;
  ctx.stroke();
  bands.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(0, 70, R0 - i * BW, Math.PI, 0);
    ctx.strokeStyle = c;
    ctx.lineWidth = BW + 0.6;
    ctx.stroke();
  });
  // the rainbow's feet in clouds
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 82, 80, 22, 0, Math.PI * 2);
    ctx.moveTo(side * 64 + 16, 90);
    ctx.arc(side * 62, 90, 16, 0, Math.PI * 2);
    ctx.moveTo(side * 102 + 15, 92);
    ctx.arc(side * 102, 92, 15, 0, Math.PI * 2);
    inked(ctx, BONE, 7);
  }
  sunDisc(ctx, 0, 6, 36, 12);
  // a face on the sun
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const ex of [-12, 12]) {
    ctx.beginPath();
    ctx.arc(ex, 4, 5, Math.PI, 0);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 12, 11, 0.25, Math.PI - 0.25);
  ctx.stroke();
}

function upAgain(ctx) {
  // down, round and up again
  ctx.beginPath();
  ctx.moveTo(-48, -60);
  ctx.lineTo(-48, 22);
  ctx.arc(0, 22, 48, Math.PI, 0, true);
  ctx.lineTo(48, -30);
  stroke2(ctx, BONE, 30, 10);
  ctx.beginPath();
  ctx.moveTo(48, -96);
  ctx.lineTo(88, -36);
  ctx.lineTo(8, -36);
  ctx.closePath();
  inked(ctx, BONE, 10);
  // drops falling off the bottom of the loop
  for (const [x, y] of [[-14, 96], [16, 102]]) {
    drop(ctx, x, y, 7);
    inked(ctx, WATER, 5);
  }
  spider(ctx, -46, -66, 0.34);
}

function cupWinner(ctx) {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 60, -44, 22, side < 0 ? Math.PI * 0.5 : Math.PI * 1.5, side < 0 ? Math.PI * 1.5 : Math.PI * 0.5);
    stroke2(ctx, GOLD, 9, 9);
  }
  ctx.beginPath();
  ctx.moveTo(-58, -76);
  ctx.lineTo(58, -76);
  ctx.bezierCurveTo(58, -6, 30, 14, 0, 14);
  ctx.bezierCurveTo(-30, 14, -58, -6, -58, -76);
  ctx.closePath();
  inked(ctx, lit(ctx, GOLD, -58, -76, 58, 14), 10);
  ctx.beginPath();
  ctx.rect(-12, 12, 24, 30);
  inked(ctx, lit(ctx, GOLD, -12, 0, 12, 0), 8);
  ctx.beginPath();
  ctx.rect(-46, 40, 92, 26);
  inked(ctx, lit(ctx, '#7A4A2A', -46, 40, 46, 66), 8);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-30, 47, 60, 12);
  shine(ctx, -34, -50, 9, 20, 0.5, 0.15);
  star(ctx, 0, -40, 20);
  inked(ctx, '#FFF2B0', 6);
}

function boneDry(ctx) {
  // an umbrella with the rain bouncing off
  ctx.beginPath();
  ctx.moveTo(-92, -4);
  ctx.bezierCurveTo(-88, -74, 88, -74, 92, -4);
  for (let i = 3; i >= 0; i--) {
    const x0 = -92 + ((i + 1) * 184) / 4;
    const x1 = -92 + (i * 184) / 4;
    ctx.quadraticCurveTo((x0 + x1) / 2, -22, x1, -4);
  }
  ctx.closePath();
  inked(ctx, lit(ctx, '#E5463B', -90, -70, 90, 0), 9);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  for (const x of [-46, 0, 46]) {
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.quadraticCurveTo(x * 0.7, -40, x, -10);
    ctx.stroke();
  }
  shine(ctx, -40, -44, 18, 7, 0.45, -0.35);
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(0, -80);
  stroke2(ctx, '#6B3E26', 7, 7);
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 64);
  ctx.arc(-16, 64, 16, 0, Math.PI);
  stroke2(ctx, '#6B3E26', 9, 8);
  for (const [x, y, r] of [[-100, -60, 8], [-62, -96, 7], [68, -98, 7], [104, -56, 8], [-24, -106, 6]]) {
    drop(ctx, x, y, r);
    inked(ctx, WATER, 5);
  }
  spider(ctx, 36, 56, 0.4);
}

function twelveSpouts(ctx) {
  // a downpipe with the count stamped on it
  ctx.beginPath();
  ctx.rect(-40, -110, 80, 230);
  inked(ctx, lit(ctx, '#BFD0DA', -40, 0, 40, 0), 9);
  for (const y of [-80, 64]) {
    ctx.beginPath();
    ctx.rect(-50, y, 100, 18);
    inked(ctx, lit(ctx, '#DDE7EE', -50, 0, 50, 0), 8);
  }
  ctx.font = `400 92px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = INK;
  ctx.strokeText('12', 0, -4);
  ctx.fillStyle = GOLD;
  ctx.fillText('12', 0, -4);
}

function allStars(ctx) {
  star(ctx, -58, 22, 36, 0.48, -0.2);
  inked(ctx, lit(ctx, GOLD, -90, -10, -20, 60), 9);
  star(ctx, 58, 22, 36, 0.48, 0.2);
  inked(ctx, lit(ctx, GOLD, 20, -10, 90, 60), 9);
  star(ctx, 0, -18, 58, 0.48);
  inked(ctx, lit(ctx, GOLD, -50, -70, 50, 40), 10);
  shine(ctx, -14, -38, 9, 5, 0.6, -0.5);
  sparkle(ctx, 66, -66, 14);
  sparkle(ctx, -74, -54, 9);
}

function goldenFly(ctx) {
  // a golden fly in its glow
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 100);
  glow.addColorStop(0, 'rgba(255,220,90,0.55)');
  glow.addColorStop(1, 'rgba(255,220,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-112, -112, 224, 224);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 40, -34, 44, 22, side * -0.55, 0, Math.PI * 2);
    inked(ctx, 'rgba(225,245,255,0.92)', 7);
    ctx.strokeStyle = 'rgba(20,27,36,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(side * 12, -22);
    ctx.lineTo(side * 70, -50);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 18, 34, 46, 0, 0, Math.PI * 2);
  inked(ctx, lit(ctx, GOLD, -30, -20, 30, 60), 9);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#C98A12';
  for (const y of [14, 34, 54]) ctx.fillRect(-40, y, 80, 8);
  ctx.restore();
  circle(ctx, 0, -32, 24);
  inked(ctx, lit(ctx, GOLD, -20, -50, 20, -10), 8);
  for (const ex of [-12, 12]) {
    circle(ctx, ex, -36, 10);
    inked(ctx, '#A3201C', 4);
    shine(ctx, ex - 3, -40, 3.5, 2.5, 0.85);
  }
  shine(ctx, -12, 0, 8, 14, 0.5, 0.2);
  sparkle(ctx, 64, 40, 13);
  sparkle(ctx, -70, 30, 10);
  sparkle(ctx, 54, -84, 9);
}

function monsoon(ctx) {
  // a storm cloud, a bolt and the hundred
  ctx.beginPath();
  ctx.arc(-40, -48, 30, Math.PI * 0.6, Math.PI * 1.6);
  ctx.arc(0, -66, 38, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(44, -46, 30, Math.PI * 1.45, Math.PI * 0.45);
  ctx.lineTo(-48, -20);
  ctx.closePath();
  inked(ctx, lit(ctx, '#C9C6E0', -60, -90, 60, -20), 9);
  ctx.beginPath();
  ctx.moveTo(16, -30);
  ctx.lineTo(-28, 30);
  ctx.lineTo(0, 30);
  ctx.lineTo(-16, 70);
  ctx.lineTo(36, 10);
  ctx.lineTo(8, 10);
  ctx.lineTo(28, -30);
  ctx.closePath();
  inked(ctx, lit(ctx, '#FFE14D', -20, -30, 30, 70), 9);
  for (const [x, y] of [[-70, 4], [-54, 40], [62, 20], [76, -6]]) {
    drop(ctx, x, y, 7);
    inked(ctx, WATER, 5);
  }
  ctx.font = `400 44px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 11;
  ctx.strokeStyle = INK;
  ctx.strokeText('100', 0, 86);
  ctx.fillStyle = BONE;
  ctx.fillText('100', 0, 86);
}

function perfectHold(ctx) {
  // the perfect ring closing on a spider
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.arc(0, 0, 68, 0, Math.PI * 2, true);
  inked(ctx, lit(ctx, GOLD, -80, -80, 80, 80), 8);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2 + Math.PI / 8);
    ctx.beginPath();
    ctx.moveTo(-7, -92);
    ctx.lineTo(0, -106);
    ctx.lineTo(7, -92);
    ctx.closePath();
    inked(ctx, '#FFF2B0', 5);
    ctx.restore();
  }
  spider(ctx, 0, 10, 0.6);
  sparkle(ctx, 62, -62, 16);
  sparkle(ctx, -64, 56, 10);
}
