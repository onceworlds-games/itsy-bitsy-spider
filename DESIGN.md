# Itsy Bitsy Spider: design

## The pitch

**Race up the waterspout. Grip tight when the flush comes down, swing on silk, snap up golden flies, and be first to the
sun.**

**The goal in one look:** a galvanised downpipe cut open down its front, against a real house at spider scale (brick,
boards, lit windows, ivy, a garden at the foot). Five spiders scurry and swing up the inside. At the top, the gutter and
the sun; above you, a glossy sheet of water coming down. Get to the sun first.

Genre: Obby. Up to six players, bots in empty seats.

## The rules on one screen

- **Climb.** Your spider walks on every surface of the pipe: walls, ledges, twigs wedged across, the undersides of bends.
  Up always climbs. Running the same way builds a **scurry** (150 to 215 u/s in half a second).
- **Jump.** Tap for a hop, hold for a full leap; the running speed carries into it. You stick to whatever you touch.
- **Silk.** In the air near a bolt, Jump again: a thread fires to the bolt, you swing and reel up, and letting go flings
  you on. Bolts chain. A thread in the water snaps.
- **The rain comes in waves.** The sky darkens, drips run down the back of the pipe, a drop swells in the HUD (2 s), then
  the **flush**: a sheet of water rushes down from the gutter at 900 u/s and passes over every spot for 1.4-2.5 s.
- **Grip** (hold the button) plants all eight legs: you can't move and the water only sprays over you. Grip lasts 3 s,
  shown on the spider. **Perfect grip:** plant in the last quarter-second before the water reaches you (a ring closes on
  your spider and turns gold) and the flush costs no grip, a surge becomes survivable, and when it passes your legs
  **spring** you on (1.35x speed for 1.2 s).
- **Not gripping when the water reaches you:** you're washed down until a collar or a ledge catches you, and you sit there
  dazed until the water has passed.
- **Dry spots** under bends, brackets, rain-head shoulders and alcoves: the water passes them by.
- **Flies** give a half-second burst of speed. One **golden fly** per spout, somewhere that costs a little nerve.
- **The sun at the top** is the finish. In a race, once the first spider reaches it the rest have 20 s.

Everything else (moss, falling caps, the sparrow, warm-air vents, doubles, surges, lightning) arrives one spout at a time.

## The first minute

| Time | What happens |
|---|---|
| 0 s | **Title:** a live bot race on an early spout fills the screen; the name sign hangs on silk beside the pipe; one gold Play tag. |
| 2 s | Play. First visit ever: straight into Spout 1, Garden Shed, alone. The camera starts at the sun and sweeps down to your spider on the drain grate. |
| 4 s | Control. "Up to climb" (phone: "Push up to climb", pointing at the stick). Flies in a line show the way up. |
| 6 s | Running on: "Keep running: faster". A bracket ahead: "Space to jump · hold for higher". |
| 8 s | First warning: drips, rumble, "Rain coming". The ring closes on your spider: "Hold J when the ring is gold". |
| 10 s | The flush (gentle: 1.2 s). Gripped: legs splay flat, spray, "Perfect!" and a spring if timed. Not gripped: washed to the collar below with a clang, "Hold J as it hits". |
| 11 s | The water passes, gold light floods back; "Let go to climb" if still gripping. |
| 15-30 s | A dry nook ("Dry spot", with an arrow), a twig to land on, the golden fly above it, two more waves. |
| ~30 s | Out over the gutter into the sun: slow motion, confetti, the dance; the time, stars, silk lines and the level bar. **Race** (main), Again. |
| ~40 s | **Lobby**: your spider and the bots on the drain grate; "Ready to race". |

Hints follow the device in hand (the last input decides), show once (a few up to four times) and are remembered in the
save.

## Controls

| | Keyboard | Phone |
|---|---|---|
| Move along the surface (Up = climb) | Arrows / WASD | Platform stick |
| Jump (hold for higher); in the air near a bolt: silk | Space / K | **Jump** button |
| Grip (keep it down) | J / Shift | **Hold** button (first, biggest) |
| Pause (solo) | Esc / P | the platform menu |
| Menus | Enter / Space, Tab, click | tap |

- The stick is projected on the surface you stand on; where that is weak (Up on a ceiling), Up/Down follow the way that
  leads up/down the spout. The direction is latched round corners while the stick is held, so it never flips mid-press.
- Coyote time, a 0.12 s jump buffer, a variable jump (letting go early cuts the rise), 60% of the running speed carried.
- Grip held in the air plants the instant you land; Jump while gripping releases and jumps in the same step.

## Mastery

| A beginner | An expert |
|---|---|
| Walks, stops when the drop appears, grips early and runs dry mid-flush | Keeps scurrying through the warning, plants on the gold ring, springs out of every flush |
| Walks every wall | Chains full leaps across the pipe and silk swings from bolt to bolt, carrying speed |
| Grips anywhere | Times the climb so the wave hits in a dry spot: never stops at all |
| Ignores the flies | Takes the risky fly lines for the bursts, and the golden fly without losing time |
| Gets washed on moss, under the sparrow, by a cap | Knows each spout: the cap lanes, the bird's 3.2 s rhythm, which wall has the moss |
| Holds through a double, loses the second half | Lets go in the gap, takes a step, plants again perfectly |
| Breaks the combo on the first flush | Keeps a ×20 combo up the whole spout (flies, perfect grips, swings, flushes survived) |

**Combo:** every fly (+1), golden fly (+3), perfect grip (+2), flush survived (+1) and silk swing (+1) adds to it; it
lasts 3 s between links (frozen while gripping) and breaks on a wash-out, a knock or a snapped thread. The HUD disc
beside your spider drains as it runs out and turns gold at ×10; ×10 and ×20 punch the camera in. The best combo of a climb
earns silk and is a goal kind.

## Solo

### Twelve spouts

Handmade, one building each, four cups of three. Each is a time trial with **3 stars** (finish, silver, gold), every fly
counted, a golden fly and your best run's **ghost**. Finishing one opens the next.

| # | Spout | Cup | Height | New thing |
|---|---|---|---|---|
| 1 | Garden Shed | Drizzle | 3,070 | climbing, gripping, a hop across, a dry nook, the first twig |
| 2 | Greenhouse | Drizzle | 3,700 | twig ladders: land, run off the end, jump to the next |
| 3 | Cottage | Drizzle | 4,010 | **silk**: moss you can't grip, bolts over it to swing from |
| 4 | Barn | Shower | 4,180 | the **rain-head** (a wide box with dry shoulders), **falling caps** |
| 5 | Bakery | Shower | 4,900 | **bolt chains**, leaves to land on, **double waves** |
| 6 | Schoolhouse | Shower | 5,460 | **warm-air vents** lift jumps; the golden fly at the top of the column |
| 7 | Farmhouse | Downpour | 6,030 | everything so far, harder: moss shafts, hoppers, caps |
| 8 | Town Hall | Downpour | 6,090 | **the sparrow** pecking in at a split seam |
| 9 | Church | Downpour | 7,140 | **surges** (longer than grip): perfect grip or shelter; long drops between collars |
| 10 | Lighthouse | Storm | 7,260 | storm: lightning, caps, short calms, hoppers and bolt chains back to back |
| 11 | Apartments | Storm | 8,080 | a long climb: hopper stack, twig maze, bolt lines, the bird, vents |
| 12 | Skyscraper | Storm | 8,180 | everything, the shortest calms |

Heights in units (100 = 1 m). Flies per spout: 9-21; bolts 0-7; islands (twigs, leaves, hoppers) 1-8.

**Stars** (seconds; gold is the sharpest bot's median time, silver a middling bot's, from `test/balance.test.mjs`):

| Spout | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Silver | 20 | 24 | 27 | 33 | 37 | 36 | 55 | 46 | 57 | 90 | 85 | 110 |
| Gold | 13 | 15 | 18 | 22 | 23 | 24 | 39 | 26 | 40 | 48 | 55 | 52 |

### Monsoon: today's spout

One endless spout a day, the same for everyone (seeded by the UTC date), built from the same piece library. **The drain is
blocked: the pipe floods from below.** The flood starts 3 m under you after 3 s and rises at 70 u/s + 0.6 per metre
(capped at 160). Rain quickens with height; vents, moss, caps, doubles, long drops, surges and the bird come in as you
climb. The flood catching you ends the run. Score: metres. Boards: `monsoon` (best ever) and **today's board** (the
`monsoon-today` list, top 5 and your place, on the Monsoon results card).

## Multiplayer

**Public game.** `ow.rooms.join({ maxPlayers: 6, minPlayers: 1, lobby: 'bar', countdown: 0, settings })` once on load.
The host picks `cup` (Drizzle / Shower / Downpour / Storm) and `bots` (Fill / Off); everyone readies again after a change.
Joining never starts anything; private rooms start when the host does.

**A match is a cup: three spouts, one race each.** Points by place 10, 7, 5, 3, 2, 1; most points wins the cup (a tie goes
to the better place in the last race). `createMatch` with `rounds: 3`, `introSeconds: 5` (flyover from the sun, our own
3-2-1), `roundSeconds: 240`, `roundEndSeconds: 6`, `resultsSeconds: 20`, `admit: 'round'`. Bots fill empty seats
(`createBots`), simulated on the host's page with the same physics and inputs a player has. Latecomers watch, then join
at the next spout in a bot's seat. Leavers keep their place, ranked below everyone still racing. A new host adopts the bots
from the last snapshot.

### Netcode

| What | Who decides | How it travels |
|---|---|---|
| Your spider (move, jump, silk, grip, wash) | your page | presence, 20 Hz, packed small (position, angle, mode, grip, gripping, facing, finish ms, silk anchor, look) |
| Rain, debris, the bird | nobody: a pure function of spout, seed and the match clock | computed on every page |
| Bot spiders | the host's page | `host:bots` at 10 Hz, drawn 150 ms behind elsewhere |
| A bump (a jump into a rival) | the bumped page applies it after checking the bumper is near, once a second per pair | `room.send` |
| Finishing | `host.rpc('finish')`; the host orders by the room clock and refuses impossible times | the round's match data |
| Places, points, round end | the host | match record |

Everything read from the room is checked (types, ranges, round id, wardrobe ids, rate); a bad message is dropped. Your own
spider is never corrected by the network.

## Reasons to come back

- **Silk and spider level.** Every climb pays silk on the results card, line by line: reaching the sun (30 + 4 per spout
  number), race place (40/25/15/10/8/6), new stars (10 each), flies (2), the golden fly (25), perfect grips (3), swings
  (1, up to 15), best combo (2 per step from ×3, up to 40), Monsoon metres (0.2 per metre). Levels 1-50, level n costs
  80 + 30(n-1) silk. Every level unlocks something, shown with a stamp and a sound; the last, at 50, is **your own
  little raincloud** drizzling on your head.
- **Wardrobe** (earned, never bought): 5 species (Jumper, Peacock 5, Orb Weaver 10, Tarantula 16, Longlegs 22), 25
  colours, 12 patterns (up to Zigzag 33, Eyespots 41, Flame 45), 13 hats (Beanie 2 … Top Hat 25, Bowler 36, Chef 40,
  Wizard 44, Viking 49, Raincloud 50) plus the Crown (win a cup) and the Halo (every star), 7 silk trails (Sparkle 8 …
  Neon 48) plus Golden (every golden fly), 7 win dances (Wave, Hop 6, Spin 11, Drum 18, Flip 30, Ripple 34, Shimmy 46).
  Others see your look in races.
- **Per spout:** three stars, every fly, the golden fly, a ghost, a board (`spout-1`…`spout-12`, seconds, lower is better).
- **Every day:** three goals, the same for everyone (perfect grips, flies, swings, climbs, flushes held, bone-dry climbs,
  races, Monsoon metres, the golden fly, a combo), 60 silk each, and a **chest** when all three are done (150 silk, +10% per
  streak day up to a week). A **day streak** counts days with a goal done. Today's Monsoon board, and in the lobby the
  flushes everyone held today (`held-today`, a daily counter).
- **Every week:** one big goal for everyone, Monday to Sunday UTC (100-160 flies, 30-50 perfect grips, a ×16-24 combo...),
  worth 500 silk.
- **Boards:** `spout-1`…`spout-12`, `monsoon`, `races-won`.
- **Badges (12):**

| id | Name | Earned by |
|---|---|---|
| `first-climb` | First Climb | Reach the sun on any spout. |
| `hold-on` | Hold On | Grip through 10 flushes. |
| `perfect-hold` | Perfect Grip | Grip just as the flush hits, 25 times. |
| `washed-out` | Washed Out | Get washed down 10 m in one go. |
| `out-came-the-sun` | Out Came the Sun | Win a race. |
| `up-the-spout-again` | Up the Spout Again | Win a race after being washed down in it. |
| `cup-winner` | Cup Winner | Win a cup. |
| `no-washouts` | Bone Dry | Climb a spout without being washed down once. |
| `twelve-spouts` | Twelve Spouts | Climb all twelve spouts. |
| `all-stars` | Thirty-Six Stars | Earn every star. |
| `golden-flies` | Golden Flies | Catch the golden fly on every spout. |
| `monsoon-100` | Monsoon 100 | Reach 100 m in Monsoon. |

- **Saves** (`ow.save`): `progress` (silk, spouts, records, counters, look, day and week goals, streak, hints), cleaned on
  load (unknown fields dropped, numbers bounded, v1 saves carried over); `ghost-1`…`ghost-12`.

## Balance and timing

World units: y up, 100 units = 1 m, the pipe's free width 200. Fixed step 120 Hz; the picture interpolates between steps.

| Thing | Number |
|---|---|
| Spider | collision radius 12 |
| Walk / scurry | 150 → 215 u/s after 0.55 s the same way; accel 1,900, turning back 3,200 |
| Jump | 600 u/s, gravity 1,000, ×2.4 gravity while rising with Jump let go, 60% of the running speed carried, max fall 820 |
| Silk | reaches 250, reels to 34 at 190 u/s, the stick pumps 520 u/s², fling ×1.12 up to 880, 0.25 s between threads |
| Grip | 3 s, needs 0.2 to start, refills after 0.3 s; perfect window 0.25 s before the water (+0.07 s late grace) |
| Spring / fly burst | ×1.35 for 1.2 s / ×1.2 for 0.5 s |
| Water front | 900 u/s down the pipe; warning 2 s (3 s for a race's first two waves and every surge) |
| Wash-out | 600 u/s down, drifting 220 to the nearer wall, caught by a collar or ledge; dazed until the flush passes + 0.35 s |
| Bump | 260 away + 120 down, 1 s immunity |
| Caps | fall 520 u/s in a wall lane, marked at the top edge; a hit knocks you loose unless you grip |
| Sparrow | 3.2 s cycle, the beak reaches 70 into the pipe |
| Moss / vents | no grip, slide 40 u/s / a 400-tall column lifting airborne spiders at 1,500 u/s² to 320 u/s |

Rain by cup (calm / flush): Drizzle 6-7.5 s / 1.4-1.8 s; Shower 4.5-6 / 1.8-2.0 (doubles 1 in 4 from the Bakery);
Downpour 3.5-5 / 2.0-2.2 (doubles 1 in 10, surges 1 in 5, the Church 3 in 10); Storm 2.5-4 / 2.2-2.5 (doubles 1 in 7,
surges 1 in 5). The first two waves of every race are gentle.

**Bots** use the same stick and buttons: in the sun each imagines a handful of moves (walk on, a short or full leap, a
silk swing) on a copy of its spider through the real physics and rain and takes the one that climbs fastest without
ending up in the water; when the drop swells it grips, runs for shelter or keeps going like a player. Skill (0-1) decides
how many moves it imagines, how cleanly it carries them out, how it times its grips and how long it dawdles. Personalities
tilt it: Hopper (jumpy), Mabel (grips early), Dash (never early, often washed), Velvet (loves shelter), Inch (steady
walker). Cup ranges: Drizzle 0-0.55, Shower 0.15-0.65, Downpour 0.3-0.8, Storm 0.4-0.9, the first seat strongest.

**Checked by `npm test` (61 tests):** every cup bot finishes every spout of its cup and races end in time with no NaN;
skill orders finishing times; star times are fair (sharp bots reach gold often, middling bots silver); a beginner beats
the weakest bot of the first race; no runaway leader over many cups; every path is clean and every dry pocket lies on it;
Up alone climbs every spout on a dry day; Up + Jump crosses the pipe higher; perfect grip, early grip, moss, knocks, silk,
flies and catches behave as specified; every wave is warned ≥ 2 s and fits a full grip; Monsoon builds valid spouts for
many seeds and its flood catches everyone, better climbers higher; the race layer through a fake room (host change,
leavers, latecomers, bumps, validation); progression (levels, unlocks, rewards, records, combo, daily and weekly goals,
chest, streak, cleaned saves).

## Every screen

The UI is one thing: **riveted zinc tags hanging on silk threads**, swinging in on a spring.

- **Title:** the live bot race; the name sign on silk; Play.
- **Lobby:** the foot of the cup's first spout, everyone on the drain grate. Top: the cup tag (host: ‹ ›) and Bots. Side:
  your level tag (level, silk bar, streak; opens the wardrobe) and the goals card (today's three, the chest, this week's
  goal). Bottom, above the platform's lobby bar: Spouts ★ n/36, Monsoon (best), + Invite.
- **Wardrobe:** six slots (Spider, Colour, Pattern, Hat, Trail, Dance) worn by your spider in the lobby as you pick;
  locked items show the level or feat that opens them.
- **Spouts:** twelve tags with stars, flies and the golden fly, best time; locked ones dimmed.
- **Round intro (5 s):** flyover from the sun down to the start, the spout's tag, 3-2-1 stamped, GO.
- **Play HUD:** the weather drop and your place (or the clock solo), the flies tag, the gutter strip filling along the top
  edge as the rain comes, the climb line (a silk thread from the ground to the sun with a bead per spider, the ghost and the
  flood), grip and the closing ring round your spider (gold in the perfect window), the combo disc, the bolt your silk
  would catch, names, words popping off the spider (Perfect!, Spring!, ×12).
- **At the sun:** slow motion, the sky clears, a rainbow, confetti, your dance. Solo: the time huge, stars popping in, silk
  lines, the level bar filling and any unlocks. Race: places swing in; cup results with a podium.
- **Monsoon end:** the flood swallows you; metres huge; best, silk, and today's board.
- **Pause (solo), room closed:** one tag each.

## Art direction

**A rainy evening at street level, at a spider's size** (1 unit ≈ 1.25 mm: a spider is three centimetres, a window 800
units). Each spout is its own building: a plank shed, a greenhouse, a plastered cottage with shutters and a gnome, a barn
at dusk, a bakery at dawn with an awning and sign, a schoolhouse with chalk drawings, a farmhouse, a town hall with a
clock, a church with stained glass, a lighthouse in a sea storm, apartments, a skyscraper at night.

- **The pipe** is extruded from the 2D level, so what you see is exactly what you stand on: painted galvanised zinc
  (spangle, streaks, white rust under the joints, crimped seams with rivets), collars, clips, straps, branch stubs, the
  rain-head, twigs and leaves wedged across, bolts, moss, vents, the bird's split seam, old cobwebs in every dry spot, an
  iron drain grate on a concrete kerb over a dark pit at the foot, and the gutter at the top.
- **The building:** CC0 PBR walls (brick, boards, plaster, stone, concrete) with plinths and stripes, deep window reveals,
  frames, sills, rain on the glass and lit rooms behind (painted interiors, curtains, shutters, flower boxes), ivy moving in
  the wind, stains, lamps, the theme's signature pieces, props at the foot (pots, a watering can, tools, crates, hay, a
  buoy), the roof above the gutter, the sky and the town's skyline.
- **Light follows the weather:** a key light with soft shadows, an environment map for reflections, warm window lights;
  in the sun gold light rakes across the wet zinc; on a warning the sky darkens; under the flush everything goes cold
  blue; lightning lights the clouds from inside. ACES tone mapping, bloom, a grade, vignette and grain that follow the mood.
- **The flush** is a thick glossy sheet down the back plate hugging both walls, its streaks travelling at the front's speed,
  a foaming front, a thinning tail and a wet film that dries off; drips run down before it; spray and mist where it hits
  ledges and spiders.
- **Spiders** are characters: procedural 3D jumping spiders with a fuzzy body, big glossy eyes with catchlights, waving
  pedipalps, an abdomen on a spring, tapered banded legs with spines on two-bone IK whose feet plant and step in a tetrapod
  gait (they never slide). Grip splays every leg flat; a jump crouches, stretches and squashes on landing; silk hangs from
  the front legs; a wash-out is a tumbling ball of legs; dazed stars; a win dance.
- **Juice:** hit-stop on knocks and wash-outs, trauma shake, a camera with look-ahead that leans into swings and punches in
  on a perfect grip and big combos, slow motion at the sun, spray, dust, sparks, confetti, silk glints and trails.
- **Fonts:** Alfa Slab One (the name, numerals, main buttons), Sofia Sans Condensed (words), self-hosted woff2 with OFL.

## Sound

All synthesized Web Audio: rain on zinc, the warning's rumble and the flush's roar, eight little feet, the sticky grip
"thwip" and legs plucking off as grip drains, silk shooting and singing, flies gulped (the golden one a chime), a combo
pip climbing the scale (and a sag when it breaks), splashes, clangs, bonks, caps clattering, the sparrow. **Music:** the
rhyme's tune re-harmonised in C minor on a small sequencer that builds as you climb (drums and bass at the foot, chords,
the tune, a high counter-line near the top), drops to drums when rain is coming, ducks under the flush and bursts out at
the sun.

## Store art and the trailer

Rendered by the game itself (`?poster=<name>`): a seeded bot race is simulated to a chosen moment, the last seconds played
at a fixed 60 steps a second without drawing, then one frame drawn once every texture of that spout has loaded.
- **Cover:** the Town Hall's stone wall, the pack mid-climb, two on silk, the name sign hanging at the left.
- **Action:** the Garden Shed, the flush front breaking over a gripping spider beside the golden fly.
- **Win:** the gutter in full sun under a rainbow, the pack bursting into confetti.
- **Multi:** the Schoolhouse, five spiders climbing, swinging and dodging between brick and classroom windows.
- **Icon:** a coral spider in a yellow sou'wester, face on, on a blue sunburst.
- **Badges:** enamel pins (coloured field, gold or steel ring, one bold symbol), drawn on a canvas by `src/poster.js`.
- **Trailer** (`store/trailer.mp4`): real autoplay races with the game's own sound, ending on the name.

## Tech

- Vite + three.js, built to `dist` (`"dir": "dist"`). Fonts in `public/fonts`, textures in `public/tex` (WebP).
- `src/sim/` is pure and tested (no `window`, `document` or SDK): `config.js`, `rng.js`, `pieces.js` (the piece library),
  `spouts.js`, `level.js` (walls, islands, pockets, snags, flies, per-edge up direction), `course.js`, `weather.js`,
  `spider.js` (the 120 Hz spider), `bot.js`, `monsoon.js`, `race.js`, `ghost.js`, `run.js` (one climb: level, weather,
  spiders, used by the title, lobby, solo, Monsoon and races). `src/progress.js` is pure too.
- `src/render/`: `stage.js` (renderer, lights, post), `world.js`, `pipe.js`, `zinc.js`, `facade.js`, `themes.js`,
  `props.js`, `paint.js`, `tex.js`, `geo.js`, `sky.js`, `rain.js`, `water.js`, `spider.js`, `actors.js`, `fx.js`, `view.js`.
- Page: `main.js` (boot, join, screens, camera, combo, hints, saves, store shots), `net.js`, `hud.js`, `ui.js`, `input.js`,
  `audio.js`, `poster.js`, `paint2d.js`.
- Quality follows the platform's Graphics setting (MSAA, shadow map size, pixel ratio, particle and rain counts).
- `?debug` outside Onceworlds prints errors on screen; `?poster=screen-<lobby|spouts|solo|monsoon|race|results>[.WxH]`
  stages a screen in a box of that size to check phone layouts.

## Originality

It borrows Celeste's stamina and jump feel, Webbed's silk swing, Only Up's long climb and a Spelunky-style daily seed. What
none of them has: a shared rain rhythm that freezes the whole race at once, water you watch rushing down a cutaway pipe
toward you, one button that plants eight legs with a perfect window that springs you on, and a race of six where the rain
is the referee and the leader is hit first.
