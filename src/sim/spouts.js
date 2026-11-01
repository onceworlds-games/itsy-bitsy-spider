// The twelve spouts, four cups of three. Each is a stack of pieces (pieces.js) with things in it: twigs and leaves to land
// on, bolts to swing from on silk, flies to snatch (one golden fly each, somewhere that costs a little nerve), a rain
// rhythm, a facade and its star times. Every spout brings in one new thing and mixes it with what came before.
// Piece coordinates: x from the pipe's centre (walls at ±100), y from the piece's bottom.

const st = (h, extra = {}) => ({ k: 'straight', h, gap: 0, ...extra });
const rg = (h, gap, extra = {}) => ({ k: 'straight', h, gap, ...extra });
const jog = (d, a = 120, b = 120, ringA = false, extra = {}) => ({ k: 'jog', d, a, b, ring: ringA, ...extra });
const br = (side, len = 80, extra = {}) => ({ k: 'bracket', side, len, h: 260, ...extra });
const al = (side, extra = {}) => ({ k: 'alcove', side, h: 240, ...extra });
const hop = (w, h, extra = {}) => ({ k: 'hopper', w, h, ...extra });
const moss = (side, y0, y1) => ({ side, y0, y1 });
const f = (x, y) => ({ x, y });
const gold = (x, y) => ({ x, y, gold: true });
const sn = (x, y) => ({ x, y });
const tw = (x, y, len = 100, tilt = 0) => ({ x, y, len, tilt, kind: 'twig' });
const lf = (x, y, len = 104, tilt = 0) => ({ x, y, len, tilt, kind: 'leaf' });
/** n flies in a line from (x0, y0) to (x1, y1). */
const line = (x0, y0, x1, y1, n) => Array.from({ length: n }, (_, i) => f(Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n - 1)), Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n - 1))));
/** The alcove's dry hollow (its middle), for a fly inside it. */
const nook = (side) => ({ x: side === 'L' ? -132 : 132, y: 120 });
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
    // Climb, hold, hop across. Flies show the way; the first twig; a dry nook.
    id: 1,
    name: 'Garden Shed',
    cup: 1,
    facade: FACADE.shed,
    rain: DRIZZLE,
    pieces: [
      START,
      st(520, { flies: line(-88, 150, -88, 390, 3) }),
      br('R', 82, { flies: [f(88, 60)] }),
      st(480, { flies: line(0, 140, 0, 340, 3) }),
      jog(110, 120, 160),
      st(460, { bars: [tw(-30, 200, 100, 6)], flies: [f(-30, 262), gold(-30, 400)] }),
      al('L', { flies: [nook('L')] }),
      rg(440, 220, { flies: [f(70, 140), f(-70, 300)] }),
      TOP,
    ],
  },
  {
    // Twig ladders: land on them, run off the end, jump to the next.
    id: 2,
    name: 'Greenhouse',
    cup: 1,
    facade: FACADE.greenhouse,
    rain: DRIZZLE,
    pieces: [
      START,
      st(360, { flies: line(88, 120, 88, 300, 3) }),
      st(660, { bars: [tw(-32, 150, 100, 5), tw(34, 315, 100, -5), tw(-32, 480, 100, 5)], flies: [f(-32, 215), f(34, 380), f(-32, 545)] }),
      jog(-100, 100, 140),
      br('R', 80),
      st(560, { bars: [lf(32, 150, 112, -12), lf(-32, 320, 112, 12)], flies: line(0, 230, 0, 430, 3) }),
      jog(120, 140, 120, true),
      al('L', { flies: [nook('L')] }),
      st(620, { bars: [tw(0, 330, 90)], flies: [f(70, 160), gold(0, 495)] }),
      TOP,
    ],
  },
  {
    // Silk: moss you can't hold on, bolts over it to swing from. Jump, then Jump again near a bolt.
    id: 3,
    name: 'Cottage',
    cup: 1,
    facade: FACADE.cottage,
    rain: DRIZZLE,
    pieces: [
      START,
      rg(480, 240, { moss: [moss('L', 160, 420)], flies: [f(88, 200), f(88, 320)] }),
      jog(100, 120, 140),
      st(260, { bars: [tw(-30, 150, 110, 4)], flies: [f(-30, 210)] }),
      st(720, { moss: [moss('L', 40, 680), moss('R', 40, 680)], snags: [sn(0, 230), sn(0, 500)], flies: [f(-50, 300), f(50, 570)] }),
      br('R', 80),
      jog(-110, 140, 120, true),
      st(620, { moss: [moss('R', 100, 560)], snags: [sn(-20, 360)], bars: [tw(30, 190, 100, -6)], flies: [f(30, 250), gold(-110 + 40, 520)] }),
      al('L', { flies: [nook('L')] }),
      rg(420, 210, { flies: [f(-60, 200)] }),
      TOP,
    ],
  },
  {
    // The rain-head: a wide box to cross, twigs inside, dry shoulders under its lid. Caps falling.
    id: 4,
    name: 'Barn',
    cup: 2,
    facade: FACADE.barn,
    rain: SHOWER,
    debris: { every: [4, 6] },
    pieces: [
      START,
      rg(520, 260, { flies: line(-88, 140, -88, 380, 3) }),
      jog(-110, 120, 140),
      hop(230, 420, { bars: [tw(-90, 300, 120, 6), tw(90, 470, 120, -6)], snags: [sn(0, 560)], flies: [f(-150, 360), f(150, 530), gold(-200, 640)] }),
      st(480, { bars: [tw(25, 240, 100, -4)], flies: [f(25, 300)] }),
      br('L', 82),
      jog(110, 140, 120, true),
      rg(560, 280, { flies: line(0, 160, 0, 400, 3) }),
      al('R', { flies: [nook('R')] }),
      st(420, { snags: [sn(0, 280)], flies: [f(-70, 330)] }),
      TOP,
    ],
  },
  {
    // Bolt chains: swing from one to the next. Leaves to land on. Doubles: the water comes twice.
    id: 5,
    name: 'Bakery',
    cup: 2,
    facade: FACADE.bakery,
    rain: SHOWER2,
    debris: { every: [6, 9] },
    pieces: [
      START,
      rg(480, 240, { flies: [f(88, 180), f(-88, 330)] }),
      br('R', 80),
      st(900, { moss: [moss('L', 80, 860), moss('R', 80, 860)], snags: [sn(-40, 220), sn(40, 450), sn(-40, 680)], flies: [f(0, 330), f(0, 560), f(0, 790), gold(85, 860)] }),
      jog(120, 120, 160, true),
      st(560, { bars: [lf(-30, 160, 112, 14), lf(30, 330, 112, -14)], flies: [f(-30, 230), f(30, 400)] }),
      al('L', { flies: [nook('L')] }),
      hop(220, 380, { snags: [sn(-110, 420), sn(110, 420)], flies: [f(-170, 300), f(170, 300)] }),
      rg(480, 240, { moss: [moss('R', 120, 380)], flies: [f(-88, 260)] }),
      br('L', 84),
      st(420, { snags: [sn(0, 260)], flies: [f(0, 340)] }),
      TOP,
    ],
  },
  {
    // Warm air: vents lift a jump high. Twigs up the vent column; the golden fly at its top.
    id: 6,
    name: 'Schoolhouse',
    cup: 2,
    facade: FACADE.school,
    rain: SHOWER2,
    pieces: [
      START,
      st(560, { vent: { side: 'L', y: 60 }, bars: [tw(30, 330, 100, -5)], flies: line(-40, 200, -40, 480, 4) }),
      jog(110, 120, 140),
      rg(640, 320, { snags: [sn(0, 420)], flies: [f(70, 220), f(-70, 480)] }),
      br('R', 80),
      st(720, { vent: { side: 'R', y: 80 }, bars: [tw(-35, 220, 100, 6), tw(35, 420, 100, -6)], flies: [f(40, 320), f(40, 520), gold(40, 700)] }),
      jog(-120, 140, 120, true),
      hop(230, 400, { vent: { side: 'L', y: 40 }, bars: [tw(0, 330, 110)], snags: [sn(-150, 520)], flies: [f(-170, 260), f(170, 420)] }),
      al('L', { flies: [nook('L')] }),
      st(520, { vent: { side: 'L', y: 60 }, flies: line(-40, 240, -40, 440, 3) }),
      jog(90, 120, 120),
      rg(500, 250, { flies: [f(88, 300)] }),
      TOP,
    ],
  },
  {
    // Everything so far, harder: moss shafts, hoppers, falling caps, a downpour.
    id: 7,
    name: 'Farmhouse',
    cup: 3,
    facade: FACADE.farm,
    rain: DOWNPOUR,
    debris: { every: [5, 8] },
    pieces: [
      START,
      rg(600, 300, { flies: line(88, 160, 88, 460, 3) }),
      jog(-110, 120, 140),
      st(800, { moss: [moss('L', 60, 760), moss('R', 300, 760)], snags: [sn(30, 260), sn(-30, 520)], bars: [tw(-30, 160, 100, 6)], flies: [f(0, 380), f(0, 640), gold(-85, 720)] }),
      br('R', 82),
      hop(240, 460, { bars: [tw(-100, 260, 120, 8), tw(100, 440, 120, -8)], snags: [sn(0, 600)], flies: [f(-180, 380), f(180, 560)] }),
      al('L', { flies: [nook('L')] }),
      rg(560, 280, { moss: [moss('R', 60, 300)], flies: [f(-60, 200), f(60, 420)] }),
      jog(120, 140, 120, true),
      st(700, { bars: [lf(-30, 170, 112, 12), lf(30, 350, 112, -12), lf(-30, 530, 112, 12)], flies: [f(-30, 240), f(30, 420), f(-30, 600)] }),
      br('L', 80),
      rg(600, 300, { moss: [moss('L', 100, 400)], snags: [sn(0, 320)], flies: [f(0, 420)] }),
      al('R', { flies: [nook('R')] }),
      TOP,
    ],
  },
  {
    // The bird: a seam it pecks out of. Time your pass, or swing past it on silk.
    id: 8,
    name: 'Town Hall',
    cup: 3,
    facade: FACADE.townhall,
    rain: DOWNPOUR,
    pieces: [
      START,
      rg(560, 280, { seam: { side: 'R', y: 360 }, flies: [f(-88, 300), f(-88, 420)] }),
      jog(110, 120, 140),
      st(700, { vent: { side: 'L', y: 80 }, bars: [tw(30, 300, 100, -5)], snags: [sn(-20, 520)], flies: [f(-40, 380), f(30, 600)] }),
      br('R', 80),
      st(820, { seam: { side: 'L', y: 300 }, moss: [moss('R', 200, 760)], snags: [sn(10, 330), sn(-30, 600)], flies: [f(60, 300), f(0, 470), gold(-88, 560)] }),
      al('R', { flies: [nook('R')] }),
      hop(230, 420, { bars: [tw(90, 300, 120, -6)], snags: [sn(-120, 500)], flies: [f(-170, 360), f(160, 520)] }),
      jog(-120, 140, 120, true),
      st(640, { seam: { side: 'R', y: 220 }, vent: { side: 'L', y: 300 }, flies: line(-40, 380, -40, 600, 3) }),
      br('L', 84),
      st(480, { bars: [tw(-30, 160, 100, 4), tw(30, 330, 100, -4)], flies: [f(-30, 220), f(30, 390)] }),
      rg(420, 210, { seam: { side: 'L', y: 200 } }),
      TOP,
    ],
  },
  {
    // Surges: water longer than any grip lasts. Hold perfectly or find somewhere dry. Long drops between collars.
    id: 9,
    name: 'Church',
    cup: 3,
    facade: FACADE.church,
    rain: { ...DOWNPOUR, surges: 0.3 },
    pieces: [
      START,
      rg(600, 300, { flies: line(-88, 160, -88, 460, 3) }),
      jog(-100, 120, 140),
      st(900, { seam: { side: 'L', y: 500 }, snags: [sn(20, 300), sn(-20, 620)], bars: [tw(30, 150, 100, -6)], flies: [f(-30, 420), f(20, 740)] }),
      al('R', { flies: [nook('R')] }),
      rg(780, 260, { flies: [f(88, 300), f(-88, 560)] }),
      br('L', 82),
      st(1000, { moss: [moss('L', 100, 900), moss('R', 100, 900)], snags: [sn(-35, 280), sn(35, 520), sn(-35, 760)], bars: [tw(30, 400, 90, -4)], flies: [f(0, 400), f(0, 640), gold(-35, 900)] }),
      jog(120, 140, 120, true),
      al('L', { flies: [nook('L')] }),
      hop(240, 440, { bars: [tw(-100, 280, 120, 6), tw(100, 440, 120, -6)], flies: [f(-190, 380), f(190, 540)] }),
      st(600, { seam: { side: 'R', y: 300 }, snags: [sn(0, 420)], flies: [f(-60, 260)] }),
      br('R', 80),
      rg(520, 260, { flies: [f(0, 300)] }),
      TOP,
    ],
  },
  {
    // Storm: lightning, caps, short calms. Hoppers and bolt chains back to back.
    id: 10,
    name: 'Lighthouse',
    cup: 4,
    facade: FACADE.lighthouse,
    rain: STORM,
    debris: { every: [3.5, 5.5] },
    lightning: true,
    pieces: [
      START,
      rg(640, 320, { flies: line(88, 160, 88, 480, 3) }),
      br('R', 80),
      jog(-110, 120, 140, true),
      st(820, { moss: [moss('L', 100, 760), moss('R', 100, 500)], snags: [sn(-30, 260), sn(30, 520)], bars: [tw(-30, 640, 100, 5)], flies: [f(0, 380), f(-30, 700), gold(88, 620)] }),
      al('R', { flies: [nook('R')] }),
      hop(240, 420, { vent: { side: 'R', y: 40 }, bars: [tw(-90, 300, 120, 6)], snags: [sn(110, 520)], flies: [f(-170, 360), f(170, 460)] }),
      jog(120, 120, 140),
      st(700, { vent: { side: 'R', y: 100 }, bars: [tw(-35, 260, 100, 6), tw(35, 460, 100, -6)], flies: [f(40, 340), f(-35, 540)] }),
      br('L', 84),
      st(900, { moss: [moss('L', 60, 400), moss('R', 60, 400), moss('L', 540, 840), moss('R', 540, 840)], snags: [sn(-40, 220), sn(40, 640)], bars: [tw(-25, 470, 90, 4)], flies: [f(0, 320), f(-25, 530), f(0, 760)] }),
      al('L', { flies: [nook('L')] }),
      rg(520, 260, { seam: { side: 'R', y: 300 }, flies: [f(-60, 200)] }),
      jog(-100, 120, 120),
      st(610, { bars: [tw(0, 300, 100)], flies: [f(0, 360)] }),
      TOP,
    ],
  },
  {
    // A long climb past every floor: a hopper stack, a twig maze, bolt lines, the bird, vents.
    id: 11,
    name: 'Apartments',
    cup: 4,
    facade: FACADE.apartments,
    rain: STORM,
    debris: { every: [5, 8] },
    pieces: [
      START,
      st(560, { vent: { side: 'L', y: 60 }, bars: [tw(30, 320, 100, -5)], flies: line(-40, 200, -40, 440, 3) }),
      jog(120, 120, 140),
      al('L', { flies: [nook('L')] }),
      hop(230, 400, { bars: [tw(-90, 280, 120, 8), tw(90, 420, 120, -8)], flies: [f(-170, 340), f(170, 480)] }),
      hop(230, 400, { snags: [sn(-110, 300), sn(110, 500)], moss: [moss('L', 100, 500), moss('R', 100, 500)], flies: [f(0, 400), gold(200, 560)] }),
      jog(-120, 140, 120, true),
      br('R', 82),
      st(860, { seam: { side: 'L', y: 400 }, bars: [tw(-35, 180, 100, 6), tw(35, 360, 100, -6), tw(-35, 540, 100, 6), tw(35, 720, 100, -6)], flies: [f(-35, 250), f(35, 430), f(-35, 610), f(35, 790)] }),
      al('R', { flies: [nook('R')] }),
      st(640, { vent: { side: 'R', y: 120 }, snags: [sn(0, 460)], flies: [f(60, 300), f(0, 560)] }),
      jog(100, 120, 140),
      st(800, { moss: [moss('L', 450, 760), moss('R', 100, 400)], snags: [sn(30, 280), sn(-30, 560)], flies: [f(-60, 360), f(40, 640)] }),
      br('L', 80),
      rg(520, 260, { seam: { side: 'R', y: 280 }, flies: [f(-88, 380)] }),
      jog(-110, 140, 140),
      br('R', 80),
      st(330, { bars: [tw(-30, 170, 100, 4)], flies: [f(-30, 230)] }),
      TOP,
    ],
  },
  {
    // The tallest: everything, in a storm, with the shortest calms.
    id: 12,
    name: 'Skyscraper',
    cup: 4,
    facade: FACADE.skyscraper,
    rain: { ...STORM, calm: [2.8, 4] },
    debris: { every: [4, 6] },
    lightning: true,
    pieces: [
      START,
      st(600, { vent: { side: 'R', y: 80 }, bars: [tw(-30, 330, 100, 5)], flies: line(40, 200, 40, 480, 3) }),
      jog(-120, 120, 140),
      st(860, { seam: { side: 'R', y: 430 }, moss: [moss('L', 80, 800)], snags: [sn(-20, 300), sn(20, 600)], flies: [f(40, 380), f(0, 680)] }),
      al('L', { flies: [nook('L')] }),
      hop(250, 440, { bars: [tw(-110, 280, 120, 8), tw(110, 450, 120, -8)], snags: [sn(0, 620)], flies: [f(-200, 380), f(200, 560), gold(0, 700)] }),
      br('R', 84),
      jog(130, 140, 120, true),
      st(1000, { moss: [moss('L', 100, 440), moss('R', 100, 440), moss('L', 580, 940), moss('R', 580, 940)], seam: { side: 'L', y: 500 }, snags: [sn(-40, 260), sn(40, 700)], bars: [tw(25, 510, 90, -4)], flies: [f(0, 380), f(25, 570), f(0, 860)] }),
      al('R', { flies: [nook('R')] }),
      st(600, { vent: { side: 'L', y: 100 }, bars: [tw(35, 300, 100, -5)], flies: line(-40, 260, -40, 520, 3) }),
      jog(-100, 120, 140),
      st(900, { moss: [moss('R', 300, 700)], bars: [lf(-30, 170, 112, 12), lf(30, 350, 112, -12), lf(-30, 530, 112, 12)], snags: [sn(0, 760)], flies: [f(-30, 240), f(30, 420), f(-30, 600)] }),
      br('L', 80),
      rg(390, 195, { flies: [f(88, 200)] }),
      br('R', 82),
      st(420, { snags: [sn(0, 260)], flies: [f(0, 340)] }),
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
  1: [20, 13],
  2: [24, 15],
  3: [27, 18],
  4: [33, 22],
  5: [37, 23],
  6: [36, 24],
  7: [55, 39],
  8: [46, 26],
  9: [57, 40],
  10: [90, 48],
  11: [85, 55],
  12: [110, 52],
};

/** Stars for a time: 1 for finishing, 2 under silver, 3 under gold. */
export function starsFor(id, seconds) {
  const [silver, gold] = STAR_TIMES[id] ?? [Infinity, Infinity];
  if (!(seconds > 0)) return 0;
  return seconds <= gold ? 3 : seconds <= silver ? 2 : 1;
}
