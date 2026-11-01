# Revamp: teardown and plan

Played the `main` build headless (a Shower cup race, autoplay, 16 s at 1280×720) and read every frame at full size, plus
the store art, the old trailer and the staged screens. This is everything that is wrong with it, then the rebuild.

## Teardown

### Looks cheap
- **The pipe is a grey rectangle.** Two flat light strips for walls, one flat gradient inside, rivets as dots. No material,
  no wetness, no depth, nothing responds to light. It is the whole screen and it looks like a UI placeholder.
- **The spiders are smudges.** ~35 px at play zoom: black line legs and a coloured disc. Eyes, pattern and personality are
  invisible. They read as dirt on the screen, not as characters anyone would want to be.
- **The signature moment is a colour swap.** The flush is a flat blue fill with faint stripes; the foam is a white band.
  No body, no gloss, no spray mass, no mist, no light through it.
- **Dry spots are flat dark-grey boxes** that look like a rendering bug, not shelter.
- **70% of a landscape screen is empty wall**: one plank or brick pattern repeated, a window now and then. No garden, no
  sky, no street, no life in the windows, no plants worth the name, no depth beyond one parallax layer.
- **No lighting.** The sun is a yellow disc; "out came the sun" is faint diagonal bands. The rain-sun rhythm, the heart of
  the game, doesn't change the look of the world.
- **All twelve spouts look the same**: the same tube in front of a recoloured wall.
- Rain is thin grey lines; names float as small text and pile on top of each other when spiders bunch up.

### Moves stiffly
- Legs shuffle on a sine; feet slide on the wall; no weight shift, no body bob, no abdomen follow-through.
- Jumps have no anticipation, no stretch, no landing squash you can see at this size.
- Washed out: a straight slide down with a puff, then a dead stop on a ring.
- The camera is bolted to the pipe: no lean, no look-ahead, no punch-in, no reaction to the flush.
- The simulation runs at 120 Hz but the picture isn't interpolated, so motion steps at uneven frame rates.

### Feels floaty, slow or unclear
- Climbing is 140 u/s on a 700-unit screen: a crawl. No acceleration reward, no sprint, no momentum carried into a jump.
- A jump across a 170-wide tube is a short hop with nothing to aim at.
- Hold is binary: press it before the water, wait. There is no way to do it *well*.
- The flush front crosses the screen in 0.35 s: you never see it coming, only the strip at the top edge.
- The dry pockets, the debris lanes and the bird read only once you've been hit by them.

### Boring after one round
- The whole action is "hold Up; when the drop swells, hold J". A straight tube has no routes, no platforming, nothing to
  find, nothing to collect, no risk worth taking.
- Spouts differ by one feature or one number, so spout 9 plays like spout 2.
- Races are decided by who happens to get washed: everyone climbs the same line at the same speed.

### No reason to come back
- Progress is stars on twelve spouts and a Monsoon height. Nothing to unlock, nothing to wear, no levels.
- No daily goals, no streak, and "today's spout" has no board for today.
- Nothing new appears from one session to the next.

### What the best of the genre do that this doesn't
- **Celeste**: a variable jump with coyote time and buffering, movement tech that rewards practice, strawberries in risky
  spots, a golden one per level, every screen a small puzzle with a clean line through it.
- **Webbed / Spider: Secret of Bryce Manor**: silk that swings with real momentum; the joy of flinging yourself.
- **Jump King / Only Up**: the tension of a long fall, a vertical world worth looking at on the way up.
- **Fall Guys**: big readable hazards that wipe out the pack at once (stories, laughs), cosmetics people want, earned.
- **Trials / time-trial platformers**: a ghost, instant retry, medal times you can just about beat.
- **Spelunky / Downwell dailies**: one seed for everyone today, one board, come back tomorrow.

## The rebuild

### Tech: a real 3D world around 2D play
three.js through Vite (`dir: dist`). Play stays 2D in pure, tested modules; the picture becomes a 2.5D side view of a real
scene: a **square zinc downpipe cut open down its front**, extruded from the 2D level so what you see is exactly what you
stand on, seen by a perspective camera turned a few degrees so its depth reads. PBR materials from CC0 textures (zinc,
brick, planks, stone, moss), an HDRI for reflections, a key light with soft shadows, warm practical lights in windows, rim
light on the spiders, fog and depth, ACES tone mapping, bloom and a colour grade that follows the weather.

### Art and animation
- **A rainy evening at street level, seen at a spider's size.** Each spout is its own building with its own materials,
  windows with people and lamps in them, plants, sills, signs, a street or garden at the foot, rooftops and sky at the top.
- **The weather drives the light**: in the sun, gold light slants through the seams and the wet zinc gleams; on a warning
  the sky darkens and drips run down the back of the pipe; under the flush everything goes cold blue; lightning lights the
  whole scene for a frame in storms.
- **Spiders become characters**: procedural 3D jumping spiders with fuzzy bodies, big glossy eyes with catchlights,
  waving pedipalps and eight three-part legs on IK whose feet really plant on the surface and step in a proper gait. The
  body bobs, the abdomen lags on a spring, jumps crouch and stretch, landings squash, Hold splays every leg flat, the silk
  swing hangs from the front legs, a wash-out is a tumbling ball of legs, a win is a dance.
- **The flush is a thick glossy sheet** (a flowing shader with foam at the front), with spray where it hits ledges and
  holders, mist, droplets running off spiders afterwards. The front travels at 900 u/s so you see it coming.
- **Juice**: hit-stop on knocks and wash-outs, trauma shake, a camera with look-ahead that leans into swings and punches in
  on a perfect hold, slow motion at the sun, dust, sparks, splashes, confetti, a silk trail.

### Depth: movement worth mastering
- **Scurry**: running builds speed (150 → 215 u/s over half a second); stopping or turning back loses it.
- **Variable jump** with coyote time, buffering and the surface speed carried into the leap.
- **Silk swing** (the same Jump button, in the air near a snag): a thread fires to the bolt, you swing and reel up, and
  letting go flings you. Snags chain. Fast, skilful, risky: a thread in the water snaps.
- **Perfect hold**: Hold in the last quarter-second before the water reaches you and the flush costs no grip, the legs
  spring you forward when it passes, and a surge (longer than your grip) becomes survivable. Holding early still works.
- **Flies** to snatch on the way (a short burst of speed), many in risky places, and **one golden fly** per spout.
- **Levels with routes**: wide rain-heads and hoppers, crossbars and stuck leaves to land on, snag lines, shelters, moss,
  vents, debris, the bird. Each spout introduces one thing and combines the earlier ones.

### Reasons to come back
- **Spider level** from silk earned by everything you do, with an unlock at every level.
- **Wardrobe**: species, colours, patterns, hats, silk trails and win dances, all earned.
- **Per spout**: three time stars, every fly, the golden fly, your ghost and a board.
- **Daily**: three goals a day (silk and a chest when all three are done), a day streak, and today's Monsoon spout with
  a board for today as well as the all-time one.
- Badges for real milestones.

### Order of work
1. Vite + three.js, the pure modules moved under `src/sim`, tests kept green.
2. The sim: multi-surface levels (islands), new pieces, scurry, variable jump, silk swing, perfect hold, flies; bots that
   use them; balance tests.
3. The renderer: pipe and building from the level, materials and light, the weather mood, rain, the flush, the spider rig.
4. Feel: interpolation, camera, hit-stop, particles, sound (CC0 layers plus synth), music.
5. Spouts re-authored for the new verbs; Monsoon updated.
6. Progression, wardrobe, daily goals, boards; the screens for them.
7. Races with the new state over the network.
8. Posters, trailer, DESIGN.md, README, onceworlds.json.
