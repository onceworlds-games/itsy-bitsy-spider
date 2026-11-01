# Itsy Bitsy Spider

Race up the waterspout. Grip tight when the flush comes down, swing on silk, snap up golden flies, and be first to the
sun. Race up to five others through a cup of three spouts, climb twelve spouts solo for stars, flies and your ghost, or
see how high you get in today's Monsoon before the flood catches you.

Play: https://onceworlds.com/play/itsy-bitsy-spider

Vite + three.js. `npm install`, then `npm run dev` (port 5304) to play locally and `npm run build` to build `dist`, which
is what the platform serves. The climbing, the rain, the bots, the races and the progression are pure modules
(`src/sim`, `src/progress.js`) covered by `npm test` (Node 20+). How it all works: `DESIGN.md`.

MIT licensed. Textures are CC0 from ambientCG; fonts are Alfa Slab One and Sofia Sans Condensed (SIL Open Font License,
in `public/fonts`). See `CREDITS.md`.
