// The numbers the game runs on (DESIGN.md, "Balance and timing"). World units: y points up; 100 units = 1 m.

export const PIPE_W = 170; // free width between the walls
export const WALL_T = 22; // how thick the cut zinc wall is drawn
export const HALF = PIPE_W / 2;
export const RING_IN = 14; // how far a joint collar sticks into the pipe
export const RING_H = 16;

export const R = 12; // the spider's collision radius (body drawn at ~13)
export const WALK = 140;
export const ACCEL = 1750; // full speed in 0.08 s
export const JUMP = 520;
export const GRAVITY = 820;
export const MAX_FALL = 700;
export const JUMP_BUFFER = 0.1;
export const DEPART_IGNORE = 0.06;

export const GRIP_MAX = 3;
export const GRIP_MIN_START = 0.2;
export const GRIP_REFILL_DELAY = 0.3;

export const FRONT_SPEED = 1800; // the flush's front and tail travel down the pipe
export const WARN = 2;
export const WARN_LONG = 3;
export const WASH_SPEED = 600;
export const WASH_DRIFT = 220;
export const DAZE_AFTER = 0.35;
export const CATCH_NY = 0.55;

export const BUMP_PUSH = 260;
export const BUMP_DOWN = 120;
export const TUMBLE_SLIDE = 0.25;
export const IMMUNE = 1;

export const DEBRIS_SPEED = 520;
export const DEBRIS_HIT = 21;
export const BIRD_CYCLE = 3.2;
export const BIRD_REACH = 70;
export const MOSS_SLIDE = 40;
export const VENT_H = 400;
export const VENT_ACCEL = 1400;
export const VENT_MAX = 300;

export const STEP = 1 / 120;
export const POINTS = [10, 7, 5, 3, 2, 1];
export const CLOSE_AFTER = 20; // seconds the rest have once the first spider reaches the sun
export const ROUND_CAP = 240;
export const SEATS = 6;
export const M = 100; // units per metre

// Seat colours, each with a pattern symbol on the abdomen and on the climb line (colour-blind players).
export const SEAT_LOOKS = [
  { color: '#FFB648', dark: '#B87516', mark: 'ring', name: 'gold' },
  { color: '#FF6F59', dark: '#B3392A', mark: 'stripes', name: 'coral' },
  { color: '#9BD35A', dark: '#5C8E27', mark: 'dots', name: 'leaf' },
  { color: '#5CC8FF', dark: '#2A7FB3', mark: 'chevron', name: 'sky' },
  { color: '#FF8FB1', dark: '#B8506F', mark: 'diamond', name: 'rose' },
  { color: '#F3EDE2', dark: '#9A9184', mark: 'star', name: 'bone' },
];

export const PALETTE = {
  slate: '#16202C',
  ink: '#0E141B',
  zinc: '#7F949E',
  zincHi: '#D3DEE3',
  water: '#86D2F0',
  foam: '#EEF9FF',
  gold: '#FFB648',
  brick: '#9E4A31',
  moss: '#6F8F3C',
  bone: '#F3EDE2',
};
