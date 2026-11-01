// The twelve spouts, four cups of three. Each is a stack of pieces (pieces.js), a rain rhythm, a facade and its star times.

const st = (h, gap, extra = {}) => ({ k: 'straight', h, gap, ...extra });
const ring = (h, rings, extra = {}) => ({ k: 'straight', h, rings, ...extra });
const jog = (d, a = 120, b = 120, ringA = false) => ({ k: 'jog', d, a, b, ring: ringA });
const br = (side, len = 78, h = 260) => ({ k: 'bracket', side, len, h });
const al = (side, h = 240) => ({ k: 'alcove', side, h });
const moss = (side, y0, y1) => ({ side, y0, y1 });
const START = { k: 'start' };
const TOP = { k: 'top' };

// Facades: what the house is made of behind the pipe.
const FACADE = {
  shed: { kind: 'boards', base: '#5B4636', line: '#3A2B21', window: { w: 70, h: 90, every: 900, light: '#FFB648' }, trim: '#2E241C' },
  greenhouse: { kind: 'glass', base: '#2C4A44', line: '#C9D9D2', window: { w: 0, h: 0, every: 0, light: '#9BD35A' }, trim: '#E7EFEA' },
  cottage: { kind: 'render', base: '#B8AE9C', line: '#8F8574', window: { w: 80, h: 110, every: 700, light: '#FFC46B' }, trim: '#3F4D3A' },
  barn: { kind: 'boards', base: '#7E2E22', line: '#4E1A13', window: { w: 90, h: 90, every: 1100, light: '#FFB648' }, trim: '#E9E1D2' },
  bakery: { kind: 'brick', base: '#C9A27A', line: '#E8D8C0', window: { w: 100, h: 140, every: 650, light: '#FFC36B' }, trim: '#6B2F2A' },
  school: { kind: 'brick', base: '#8C3B2A', line: '#C9B8A6', window: { w: 90, h: 170, every: 600, light: '#FFD27A' }, trim: '#E9E1D2' },
  farm: { kind: 'stone', base: '#7C7568', line: '#4F4A42', window: { w: 80, h: 110, every: 750, light: '#FFB24E' }, trim: '#2F3A2E' },
  townhall: { kind: 'stone', base: '#B9A27E', line: '#8A7556', window: { w: 100, h: 190, every: 560, light: '#FFD38A' }, trim: '#5A4A33' },
  church: { kind: 'stone', base: '#6F6E6A', line: '#4A4946', window: { w: 70, h: 200, every: 620, light: '#E58B5A', stained: true }, trim: '#3C3B39' },
  lighthouse: { kind: 'stripes', base: '#E9E4DA', line: '#B23A2E', window: { w: 50, h: 70, every: 900, light: '#FFE4A0' }, trim: '#2B2F33' },
  apartments: { kind: 'concrete', base: '#77808A', line: '#5E666E', window: { w: 120, h: 120, every: 420, light: '#FFC97A' }, trim: '#3A4047' },
  skyscraper: { kind: 'glass', base: '#1F3346', line: '#5C7F9C', window: { w: 0, h: 0, every: 0, light: '#FFD98A' }, trim: '#8FA8BC' },
};

const DRIZZLE = { calm: [6, 7.5], flush: [1.4, 1.8], doubles: 0, surges: 0 };
const SHOWER = { calm: [4.5, 6], flush: [1.8, 2.0], doubles: 0, surges: 0 };
const SHOWER2 = { ...SHOWER, doubles: 0.25 };
const DOWNPOUR = { calm: [3.5, 5], flush: [2.0, 2.2], doubles: 0.1, surges: 0.2 };
const STORM = { calm: [2.5, 4], flush: [2.2, 2.5], doubles: 0.15, surges: 0.2 };

export const SPOUTS = [
  {
    id: 1,
    name: 'Garden Shed',
    cup: 1,
    facade: FACADE.shed,
    rain: DRIZZLE,
    pieces: [START, st(700, 300), st(560, 280), jog(110, 120, 160), st(420, 210), br('L', 82), st(500, 250), TOP],
  },
  {
    id: 2,
    name: 'Greenhouse',
    cup: 1,
    facade: FACADE.greenhouse,
    rain: DRIZZLE,
    pieces: [START, st(440, 220), jog(-100, 100, 140), st(300, 150), br('R', 80), jog(120, 140, 120, true), st(420, 210), al('L'), jog(-90, 120, 120), st(600, 300), TOP],
  },
  {
    id: 3,
    name: 'Cottage',
    cup: 1,
    facade: FACADE.cottage,
    rain: DRIZZLE,
    pieces: [
      START,
      st(560, 280, { moss: [moss('L', 200, 420)] }),
      jog(100, 120, 140),
      st(500, 250, { moss: [moss('R', 80, 300)] }),
      ring(760, [], { moss: [moss('L', 120, 460)] }),
      br('R', 80),
      st(420, 210),
      jog(-110, 140, 120, true),
      st(560, 280, { moss: [moss('R', 250, 500)] }),
      al('L'),
      TOP,
    ],
  },
  {
    id: 4,
    name: 'Barn',
    cup: 2,
    facade: FACADE.barn,
    rain: SHOWER,
    debris: { every: [4, 6] },
    pieces: [START, st(600, 300), jog(-120, 120, 140), st(560, 280), br('L', 80), jog(110, 140, 120, true), ring(700, []), al('R'), st(520, 260), jog(-90, 120, 120), st(320, 320), TOP],
  },
  {
    id: 5,
    name: 'Bakery',
    cup: 2,
    facade: FACADE.bakery,
    rain: SHOWER2,
    debris: { every: [6, 9] },
    pieces: [START, st(560, 280), br('R', 80), st(480, 240), jog(120, 120, 160, true), st(600, 300, { moss: [moss('R', 160, 400)] }), al('L'), ring(720, []), jog(-110, 140, 120), st(480, 240), br('L', 84), st(420, 210), TOP],
  },
  {
    id: 6,
    name: 'Schoolhouse',
    cup: 2,
    facade: FACADE.school,
    rain: SHOWER2,
    pieces: [START, st(520, 260, { vent: { side: 'L', y: 80 } }), jog(110, 120, 140), st(640, 320), br('R', 80), st(600, 300, { vent: { side: 'R', y: 100 } }), jog(-120, 140, 120, true), ring(760, []), al('L'), st(480, 240, { vent: { side: 'L', y: 60 } }), jog(90, 120, 120), st(540, 270), TOP],
  },
  {
    id: 7,
    name: 'Farmhouse',
    cup: 3,
    facade: FACADE.farm,
    rain: DOWNPOUR,
    debris: { every: [5, 8] },
    pieces: [START, st(600, 300), jog(-110, 120, 140), st(520, 260, { moss: [moss('L', 100, 360)] }), br('R', 82), ring(800, []), al('L'), st(560, 280), jog(120, 140, 120, true), st(480, 240, { moss: [moss('R', 60, 300)] }), br('L', 80), ring(810, [400]), al('R'), TOP],
  },
  {
    id: 8,
    name: 'Town Hall',
    cup: 3,
    facade: FACADE.townhall,
    rain: DOWNPOUR,
    pieces: [START, st(560, 280, { seam: { side: 'R', y: 360 } }), jog(110, 120, 140), st(600, 300, { vent: { side: 'L', y: 80 } }), br('R', 80), ring(800, [], { seam: { side: 'L', y: 420 } }), al('R'), st(460, 230), st(560, 280), jog(-120, 140, 120, true), st(600, 300, { seam: { side: 'R', y: 220 }, vent: { side: 'L', y: 300 } }), br('L', 84), st(410, 205), st(420, 210), TOP],
  },
  {
    id: 9,
    name: 'Church',
    cup: 3,
    facade: FACADE.church,
    rain: { ...DOWNPOUR, surges: 0.25 },
    pieces: [START, st(600, 300), jog(-100, 120, 140), ring(900, [], { seam: { side: 'L', y: 500 } }), al('R'), st(780, 260), br('L', 82), ring(1000, [500], { moss: [moss('R', 150, 450)] }), jog(120, 140, 120, true), al('L'), st(600, 300, { seam: { side: 'R', y: 300 } }), ring(900, []), br('R', 80), TOP],
  },
  {
    id: 10,
    name: 'Lighthouse',
    cup: 4,
    facade: FACADE.lighthouse,
    rain: STORM,
    debris: { every: [3.5, 5.5] },
    lightning: true,
    pieces: [START, st(640, 320), br('R', 80), jog(-110, 120, 140, true), ring(800, [], { moss: [moss('L', 200, 500)] }), al('R'), st(560, 280), jog(120, 120, 140), st(600, 300, { vent: { side: 'R', y: 100 } }), br('L', 84), ring(900, [450]), al('L'), st(520, 260), jog(-100, 120, 120), st(610, 305), TOP],
  },
  {
    id: 11,
    name: 'Apartments',
    cup: 4,
    facade: FACADE.apartments,
    rain: STORM,
    debris: { every: [5, 8] },
    pieces: [START, st(560, 280, { vent: { side: 'L', y: 60 } }), jog(120, 120, 140), al('L'), st(600, 300, { moss: [moss('R', 80, 360)] }), jog(-120, 140, 120, true), br('R', 82), ring(860, [], { seam: { side: 'L', y: 400 } }), al('R'), st(640, 320, { vent: { side: 'R', y: 120 } }), jog(100, 120, 140), ring(800, [400], { moss: [moss('L', 450, 760)] }), br('L', 80), st(600, 300, { seam: { side: 'R', y: 300 } }), jog(-110, 140, 140), br('R', 80), st(490, 245), TOP],
  },
  {
    id: 12,
    name: 'Skyscraper',
    cup: 4,
    facade: FACADE.skyscraper,
    rain: { ...STORM, calm: [2.5, 3.5] },
    debris: { every: [4, 6] },
    lightning: true,
    pieces: [
      START,
      st(600, 300, { vent: { side: 'R', y: 80 } }),
      jog(-120, 120, 140),
      ring(860, [], { seam: { side: 'R', y: 430 } }),
      al('L'),
      st(560, 280, { moss: [moss('L', 120, 400)] }),
      br('R', 84),
      jog(130, 140, 120, true),
      ring(1000, [500], { seam: { side: 'L', y: 260 } }),
      al('R'),
      st(600, 300, { vent: { side: 'L', y: 100 } }),
      jog(-100, 120, 140),
      ring(900, [], { moss: [moss('R', 300, 700)] }),
      br('L', 80),
      st(390, 195),
      br('R', 82),
      st(420, 210),
      TOP,
    ],
  },
];

export const CUPS = [
  { id: 1, name: 'Drizzle', spouts: [1, 2, 3], bots: [0, 0.55] },
  { id: 2, name: 'Shower', spouts: [4, 5, 6], bots: [0.15, 0.65] },
  { id: 3, name: 'Downpour', spouts: [7, 8, 9], bots: [0.3, 0.8] },
  { id: 4, name: 'Storm', spouts: [10, 11, 12], bots: [0.4, 0.9] },
];

export const spoutById = (id) => SPOUTS.find((s) => s.id === id) ?? SPOUTS[0];
export const cupById = (id) => CUPS.find((c) => c.id === id) ?? CUPS[0];

// Star times [silver, gold] in seconds: gold is the sharpest bot's median time, silver a middling bot's (test/balance.test.mjs).
export const STAR_TIMES = {
  1: [24, 21],
  2: [29, 25],
  3: [33, 28],
  4: [40, 34],
  5: [47, 36],
  6: [44, 35],
  7: [59, 53],
  8: [56, 47],
  9: [70, 56],
  10: [97, 73],
  11: [99, 78],
  12: [117, 86],
};

/** Stars for a time: 1 for finishing, 2 under silver, 3 under gold. */
export function starsFor(id, seconds) {
  const [silver, gold] = STAR_TIMES[id] ?? [Infinity, Infinity];
  if (!(seconds > 0)) return 0;
  return seconds <= gold ? 3 : seconds <= silver ? 2 : 1;
}
