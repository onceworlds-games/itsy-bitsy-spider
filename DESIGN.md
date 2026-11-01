# Itsy Bitsy Spider: design

## The pitch

**Climb the waterspout. When the rain comes down, hold on, or it washes you out.**

**The goal in one look:** a drainpipe cut open down the side of a house at night, spiders climbing inside it, gold sunlight
breaking at the top, and a glossy sheet of water roaring down toward them. Get to the sun first.

Store line: "Climb the waterspout. Hold on when the rain comes down. First to the sun wins." Genre: Obby.

## The rules on one screen

- **Climb.** Your spider walks on every surface of the pipe: walls, ledges, the undersides of bends. Up always climbs.
- **Jump.** Leap off the surface you're on; you stick to whatever you touch. A jump across the pipe gains height faster than
  walking, but **you can't hold on in the air**.
- **The rain comes in waves.** Clouds darken, drips fall, a drop swells in the corner of the screen (2 s), then the **flush**:
  a sheet of water rushes down the pipe from the gutter and passes over every spot for 1.4-2.5 s.
- **Hold** (one button, held down) plants all eight legs: you can't move, and the water only sprays over you. Grip lasts
  **3 seconds**, drawn on the spider itself: legs let go one by one as it drains. It refills while you don't hold.
- **Not holding when the water reaches you** (or in the air, or out of grip): you're **washed down** the pipe until a ring
  (a joint collar) or a ledge catches you, and you sit there, soaked, until the water has passed.
- **Dry spots:** under a bend, under a bracket, inside a side branch. The water passes them by: no grip needed.
- **The sun at the top** is the finish. In a race, once the first spider reaches it the sun starts setting: 20 s for the rest.

That is the whole game. Everything else (moss, debris, a bird, warm-air vents, storm surges) is a spout feature that arrives
one at a time, each obvious on sight.

## The first 60 seconds

| Time | What happens | Hint (2-5 words, once) |
|---|---|---|
| 0 s | **Title.** Night rain on a brick house; the cutaway spout fills the screen; four spiders race up it (attract mode, real bots). A flush thunders down: three plant their legs, one tumbles down to the ring below. "Itsy Bitsy Spider" is stamped on a zinc sign hanging on two silk threads from the gutter; a big zinc **Play** tag hangs under it, swaying. | none |
| 2 s | Tap Play (or Space/Enter): sound starts, the sign is pulled up on its threads. **First visit ever:** straight into Spout 1, Garden Shed, alone. Returning players: the lobby. | |
| 2-4 s | Camera starts at the sun breaking over the gutter, sweeps down the spout to your spider on the bottom ring. | |
| 4 s | Your control. | "Climb ↑" (phone: an arrow on the stick) until you've climbed 100 |
| 7 s | Sun beams through the seams, legs pattering. First warning: the sky darkens, drips streak down, a rumble, the drop in the corner swells (3 s this first time). | "Rain coming" |
| 9 s | 0.7 s before the water reaches you: | "Hold J" / "Hold!" (Hold button pulses) |
| 10 s | **The flush** (1.2 s this first time). Holding: legs splay flat, water sheets over you, a "thwip" and a little spray. Not holding: washed down 250 to the ring below, with a clang. | after a wash-out: "Hold when it hits" |
| 11 s | The water passes, gold light floods back, birdsong. If still holding 0.6 s after: | "Let go to climb" |
| 16 s | A bend in the pipe with a dry pocket under it; second warning. | "Dry spot" with an arrow to the pocket |
| 24 s | A bracket across the pipe: walking around it is long, a jump past it is short. | "Space: jump" / "Jump" |
| 30-40 s | Third wave, then out over the gutter lip into the sun: the spider pops onto the roof edge in gold light, fanfare, the time, stars pop in. Buttons: **Race** (main), Again. | |
| 45 s | **Lobby**: your spider and five bots sit on the bottom ring, names on tags. Cup: Drizzle. | "Ready to race" pointing at the platform's Ready strip |
| 48 s | Ready: the race starts at once with bots (a lone player in a public server). The spout's flyover (sun to start), 3, 2, 1, GO. | |
| 55 s+ | Racing five spiders up the Garden Shed, the first flush washes two of them past you. | |

A player who skips everything still reads the goal from the flyover (the sun at the top) and the danger from the first
flush (water + tumbling spiders).

## Controls

| | Keyboard | Phone |
|---|---|---|
| Move along the surface (Up = climb) | Arrows / WASD | Platform stick (`stick: 'wasd'`) |
| Jump (toward the stick) | Space (also K) | **Jump** button (second) |
| Hold (keep it down) | J or Shift | **Hold** button (first, biggest) |
| Pause (solo only) | Esc / P | the platform menu pauses; a pause tag on screen |
| Menus | Enter / Space, Tab, click | tap |

- **Up always climbs.** The stick is projected on the surface you're on. When that projection is weak (Up on a ceiling or a
  floor), Up/Down choose the way along the surface that leads up/down the spout (precomputed per edge). The spider keeps its
  direction round a corner while the stick is held the same way (hysteresis), so corners never stutter.
- **Jump direction** = normalize(stick + 0.5 × surface normal); with no stick, straight off the surface with an upward lean.
  On a wall, Up + Jump is a ~63° leap across the pipe: the efficient zig-zag.
- Hold held during a jump plants you the instant you land. Jump while holding releases and jumps in the same frame.
- Coyote time 80 ms (jump just after walking off an edge), jump buffer 100 ms.

## Core loop and where mastery comes from

The rain is a shared metronome: **move in the sun, hold in the rain.** Each wave is a 2-second decision: how far can I get
before it hits, and where will I be when it does?

| A beginner | An expert |
|---|---|
| Walks, stops when the drop appears, holds early and runs out of grip mid-flush | Keeps moving through the warning and plants on the last 0.2 s, letting go the instant the tail passes |
| Holds anywhere | Times the climb so the wave hits while they're in a dry spot: never spends grip, never stops |
| Walks every wall | Chains cross-pipe jumps in the sun (~1.35× walking speed), stops jumping 0.7 s before impact |
| Gets washed on moss, under the bird, by a falling cap | Knows each spout: the lane the caps fall in, the bird's rhythm, which wall has the moss |
| Holds through a double, loses the second half | Lets go in the gap, takes a step, plants again |
| Races alone | Passes rivals while they hold, bumps a jumper off the wall, saves grip for the surge |

## Solo

Everything solo is reached from the lobby, runs while the room is in its lobby (`room.hideLobby()` while it plays), and ends
if this player is admitted into a race.

### Twelve spouts

Handmade levels, one building each, in four cups. Each is a time trial with **3 stars** (finish; beat silver; beat gold) and
**your best run's ghost** (a translucent silk-white spider). Finishing a spout opens the next. About 25-40 minutes to finish
all twelve once; three-starring them is the long game.

| # | Spout | Cup | Height | New thing |
|---|---|---|---|---|
| 1 | Garden Shed | Drizzle | 3,000 | climbing, holding, a dry spot, a jump |
| 2 | Greenhouse | Drizzle | 3,600 | bends and brackets: dry spots as routes |
| 3 | Cottage | Drizzle | 4,200 | **moss** (no grip), a long drop with no rings |
| 4 | Barn | Shower | 4,600 | **falling debris** (acorns, bottle caps) |
| 5 | Bakery | Shower | 5,000 | **double waves** |
| 6 | Schoolhouse | Shower | 5,400 | **warm-air vents** (lift) |
| 7 | Farmhouse | Downpour | 5,800 | **storm surges** (longer than grip) |
| 8 | Town Hall | Downpour | 6,200 | **the bird** at an open seam |
| 9 | Church | Downpour | 6,800 | long drops + surges + the bird |
| 10 | Lighthouse | Storm | 7,000 | sea storm: lightning, debris, short calms |
| 11 | Apartments | Storm | 7,600 | branching routes, vents, moss |
| 12 | Skyscraper | Storm | 8,000 | everything, fastest rhythm |

### Monsoon (endless, today's spout)

One endless spout per day, the same for everyone (seeded by the UTC date), built from the same piece library as the twelve.
**The drain is blocked: the pipe floods from below.** The flood rises after 3 s, starting 300 below you, at
60 + 0.5 per metre of flood height units/s (capped at 150). Waves quicken with height (period 10 s at 0 m to 6 s at 200 m;
debris from 30 m, surges from 60 m, the bird from 80 m). The flood catching you ends the run; a wash-out near the flood is
how most runs end. Score: **height in metres** (100 units = 1 m). Leaderboard `monsoon` (best ever), today's best on the
lobby tag. A beginner run lasts about a minute (~40 m), a good one four (~150 m), an expert one ten (~350 m+).

## Multiplayer

**Public game.** `ow.rooms.join({ maxPlayers: 6, minPlayers: 1, lobby: 'bar', countdown: 0, settings })`, once, on load.
Settings (the host picks them in the game's lobby with `room.setSetting`, everyone readies again after a change):
- `cup`: Drizzle / Shower / Downpour / Storm (default Drizzle).
- `bots`: Fill / Off (default Fill).

**A match is a cup: three spouts, one race each.** Points by place: 10, 7, 5, 3, 2, 1. Most points wins the cup (a tie goes
to the better place in the last race). A cup takes 3-6 minutes.

Built on `createMatch` / `createHost` / `createBots`:
- `rounds: 3`, `introSeconds: 4` (the flyover and our own 3-2-1, so `countdown: 0`: one countdown on screen),
  `roundSeconds: 240` (a hard cap that should never matter), `roundEndSeconds: 5`, `resultsSeconds: 20` (a private
  server's host can continue sooner), `points: [10, 7, 5, 3, 2, 1]`, `admit: 'round'`.
- **Lobby and ready-up:** the game draws the lobby; the platform's bar does Ready/Start. Public: everyone readies, the room
  starts. Private: the host starts when `room.canStart`. Joining never starts anything.
- **Bots in empty seats** (`createBots(match, { fill: 6 or 0 })`): spiders with names, colours, patterns and a climbing
  style of their own. They don't use rpcs for movement: the host's page simulates them with the same physics and inputs a
  player has (see netcode). Players always take seats first.
- **Latecomers** watch (the camera follows the leader, the platform's Watching note) and join at the next spout in a bot's
  seat (`admit: 'round'`). Meanwhile they can climb a solo spout.
- **Leavers** keep their place in the standings; their spider is drawn faded where it stopped. A reload is away → back:
  the page restores its spider from `room.me.presence` (position, state) and carries on.
- **Host change:** the helper carries the match record; the new host adopts the bots from the last `host:bots` snapshot
  and keeps simulating them from there (`resume`).

### Netcode

| What | Who decides | How it travels |
|---|---|---|
| Your spider (move, jump, hold, wash, catch) | your page | presence, 20 Hz: `{ v, r, x, y, a, s, g, f }` (round id, position, angle, state, grip, finish ms), < 100 bytes |
| Rain, debris, the bird | nobody: a pure function of (spout, `match.seed` + round, round time on the match clock) | computed on every page |
| Water hitting a spider | that spider's page (bots: the host) | the resulting state shows in presence |
| Bot spiders | the host's page, same simulation | `host:bots` state at 10 Hz: `{ r, t, b: [[id, x, y, a, s, g], ...] }`, interpolated 150 ms behind on other pages |
| A bump (a jump into a rival) | the jumper's page detects it on its view of the rival; the **bumped** page applies it to itself (bots: the host) after checking the bumper is near it and not rate-limited | `room.send({ t: 'bump', ... }, { to })` |
| Finishing | your page calls `host.rpc('finish', { r, ms })`; the host orders finishes by the room's `matchTime`, refuses times faster than the spout allows or from far below the top | the round's `match.data.fin` |
| Places, points, round end | the host: all present racers finished, or 20 s after the first finish, or the cap; unfinished racers ranked by height | match record |

Other spiders are drawn with `room.presenceAt(id, { angles: ['a'], snap: 400 })`. Your own spider is never corrected by the
network. Everything read from the room is checked (types, ranges, round id, rate): a bad message is dropped.

## Progression and reasons to come back

- **Saves** (`ow.save`): `progress` = { tutorial done, spouts unlocked, stars ×12, best times ×12, Monsoon best and today's
  best, counters (flushes held, wash-outs, races, wins, cups) }; `ghost-1`…`ghost-12` (the best run sampled at 10 Hz,
  packed, < 20 KB each); `hints` (which hints were seen). Written on events (a finish, a run's end), never per frame.
- **Personal bests** on the lobby's solo tags, the spouts menu and every results card.
- **Leaderboards** (14): `spout-1`…`spout-12` (seconds, lower is better), `monsoon` (metres), `races-won` (count).
- **Badges** (10):

| id | Name | Earned by |
|---|---|---|
| `first-climb` | First Climb | Reach the sun on any spout. |
| `hold-on` | Hold On | Hold through 10 flushes. |
| `washed-out` | Washed Out | Get washed down 10 m in one go. |
| `out-came-the-sun` | Out Came the Sun | Win a race. |
| `up-the-spout-again` | Up the Spout Again | Win a race after being washed out in it. |
| `cup-winner` | Cup Winner | Win a cup. |
| `no-washouts` | Bone Dry | Climb a spout without being washed down once. |
| `twelve-spouts` | Twelve Spouts | Climb all twelve spouts. |
| `all-stars` | Thirty-Six Stars | Earn every star. |
| `monsoon-100` | Monsoon 100 | Reach 100 m in Monsoon. |

## Balance and timing

World units: the pipe's free width is 170; 100 units = 1 m. Fixed step 120 Hz.

| Thing | Number |
|---|---|
| Spider | body radius 13 (collision 12), leg span ~60 |
| Walk / climb | 140 u/s on any surface, 0.08 s to full speed |
| Jump | 520 u/s, gravity 820 u/s² in the air, max fall 700 u/s; Up + Jump across the pipe: ~125 height in 0.62 s (~1.35× walking) |
| Grip | 3.0 s, drains 1/s while holding, refills 1/s after 0.3 s; Hold needs at least 0.2 s of grip |
| Water front | travels down the pipe at 1,800 u/s (crosses a phone screen in ~0.35 s); every spot gets the same warning and flush, the top first |
| Warning | 2.0 s (a race's first wave and every surge: 3.0 s) |
| Wash-out | 600 u/s down, drifting to the nearer wall; stopped by a ring or a ledge (upward surface ≥ 12 long); then held there until the flush has passed + 0.35 s |
| Rings | every 350-500 in early spouts, gaps of 700-1,000 in "long drops" |
| Bump | 260 u/s away + 120 down, 0.3 s tumble, then you stick to what you touch; 1 s immunity |
| Debris | falls 520 u/s in a wall lane; marker at the screen's top edge 1.2 s before it arrives; a hit knocks you loose like a big bump; bounces off a holder |
| Bird | 3.2 s cycle (look 1.2, wind-up 0.5, peck 0.25, back 1.25); the beak reaches 70 into the pipe, so the far wall is safe; a peck flicks you down and across |
| Moss | no grip (Hold scrabbles), you slide down 40 u/s when standing still |
| Warm-air vent | a 400-tall column: airborne spiders accelerate up 1,400 u/s² to 300 u/s; the flush still washes you out of it |
| Double wave | flush 1.4 s, gap 0.9 s, flush 1.4 s (holding through it runs out of grip) |
| Surge | flush 3.6 s: longer than grip, so you need a dry spot or you lose height |

Rain per spout (calm / flush; each race starts with 5 s of sun):

| Spouts | Calm | Flush | Period | Extras |
|---|---|---|---|---|
| 1-3 (Drizzle) | 6-7.5 s | 1.4-1.8 s | 9.5-11 s | |
| 4-6 (Shower) | 4.5-6 s | 1.8-2.0 s | 8.5-10 s | doubles from 5 (1 in 4 waves) |
| 7-9 (Downpour) | 3.5-5 s | 2.0-2.2 s | 7.5-9 s | surges 1 in 4 |
| 10-12 (Storm) | 2.5-4 s | 2.2-2.5 s | 6.5-8.5 s | surges and doubles, never two surges in a row |

**Race lengths:** Garden Shed ~20 s for an expert, ~40 s for a beginner; Skyscraper ~70 s / ~130 s.

**Bots:** skill 0-1 drives every parameter (one brain for all): reaction to the warning (holds lerp(1.2, 0.05) s early),
chance to miss a hold lerp(18%, 2%), let-go delay lerp(0.6, 0.05) s, jump chains only above 0.5 (jump-angle error
lerp(15°, 3°)), dry-spot use above 0.4. Five personalities on top: **Hopper** (jumps even when it's risky), **Mabel**
(holds early, rarely washed), **Dash** (never holds early, often washed), **Velvet** (loves dry spots), **Inch** (slow and
steady). A race's five bots spread across a range by cup: Drizzle 0.15-0.60, Shower 0.25-0.70, Downpour 0.35-0.80,
Storm 0.45-0.90. A first-time player beats two or three; a good player has to work for first.

**Stars:** gold = the 0.9 bot's median time, silver = the 0.5 bot's, finish = one star.

**How it's checked (node tests):** every bot skill finishes every spout under the cap across 200 seeds; times land in the
table's ranges; skill orders finishing times; gold is reachable by the best bot in ≥ 30% of seeds; no grip value goes
negative and no NaN over full races; every wave gives ≥ 2 s of warning; a flush (not a surge) is always survivable by
holding from impact with full grip; cup simulations show the leader after two races loses the cup ≥ 20% of the time (no
runaway); Monsoon bots reach ~40 / ~120 / ~300 m at skill 0.3 / 0.6 / 0.9.

## Every screen

The UI is made of one thing: **zinc tags hanging on silk threads**. A riveted, stamped metal plate on two silk strands that
swings in on a spring when it appears and sways in the wind. Buttons, the title, places and results are all tags.

- **Title:** the attract race fills the screen; the name sign hangs from the gutter at the top third; the Play tag under it
  (≥ 64 px tall, the key shown: "Play ⏎"). The platform's Ready strip is hidden here. Nothing else.
- **Lobby:** the foot of the house in the garden, the spout's bottom ring as a bench. Up to six spiders sit on it, each with
  a tag above: avatar head, name, a ✓ when ready, a small star for the host. Empty seats show the bot that will take them,
  dimmed, with a "+" that opens `ow.ui.showInvite()`. Top (clear of the menu): the cup tag (cup name and its three
  buildings; the host has ‹ › on it) and the Bots tag. Side (portrait: below the bench): two solo tags,
  **Spouts ★ 14/36** and **Monsoon 212 m**. Bottom 88 px: the platform's Ready/Start strip. After a cup, the results
  tags stay hanging behind until the next match starts.
- **Round intro (4 s):** camera from the sun down to the start ring; the spout's tag swings in ("Church", with the cup's
  three buildings, this one lit); 3, 2, 1 as huge stamped numerals with three drips; GO with a flare of the sun.
- **Play HUD:** top-right: the **weather drop** (sun disk in calm; a swelling teardrop with the seconds inside during a
  warning; a jagged burst for a surge; draining while the flush passes over you) and beside it the **place tag** ("2ND",
  huge numerals) or, solo, the clock. The **climb line** down the right edge: a silk thread from the sun to the ground with
  every spider as a bead (seat colour + pattern symbol; you bigger, outlined; the ghost in solo; the flood in Monsoon).
  Grip on the spider (legs + a thin arc while not full). A bone-white chevron over your spider; small outlined names over
  the others. After the first finish, the sun on the climb line turns orange and "0:20" counts down by the place tag.
  Nothing in the lower corners while touch controls are on; everything laid out from `ow.ui.reserved`.
- **Between spouts (5 s):** this race's places as tags dropping on silk to heights by place, "+10 +7 +5" flying into the
  totals, the cup's three buildings with the next one lit.
- **Cup results (20 s):** the winner's spider dances on the gutter in a sunbeam, raindrops turned to gold confetti; three
  podium tags (avatar head, name, points) hanging at three heights; your line ("4th · 19 pts · held 9"). Private host: a
  Continue tag.
- **Spouts menu:** four rows (cups) of three building tags (silhouette, name, three star slots, best time); locked ones dark
  with a padlock stamp; a Back tag. Portrait 3 × 4, landscape 6 × 2.
- **Solo finish:** the time, huge; three stars stamp in one by one; best and board rank; **Next** (main), Again, Back.
- **Monsoon end:** the flood swallows the spider in a splash; "212 m" huge; best and today's best; **Again** (main), Back.
- **Pause (solo):** Resume (main), Restart, Back. Opens on `ow.on('pause')`, `visibilitychange`, Esc/P.
- **Room closed:** one tag, one button: kicked "You were removed" + Play; disconnected "Connection lost" + Rejoin; replaced
  "Playing in another tab" + Play here.

## Art direction

**The world:** a rainy night at an old brick house, seen from the garden; the galvanized downpipe cut away down its length
so you see inside. Wet zinc with real highlights, rivets, seams, rust streaks and moss; behind it warm-lit windows, ivy, the
garden. Everything is drawn in Canvas 2D in layers: sky and clouds, far rooftops, the house wall (parallax 0.6), the pipe
(1.0), foreground rain streaks (1.4).

**Palette:**

| | Hex |
|---|---|
| Night slate (sky, ink) | `#16202C` |
| Wet zinc (pipe) / highlight | `#7F949E` / `#D3DEE3` |
| Rainwater / foam | `#86D2F0` / `#EEF9FF` |
| Lamp gold (sun, goal, you, the accent) | `#FFB648` |
| Brick rust (house, danger) | `#9E4A31` |
| Moss | `#6F8F3C` |
| Bone (text, with a `#0E141B` outline) | `#F3EDE2` |

**Fonts** (self-hosted woff2, latin, OFL next to them): **Bricolage Grotesque ExtraBold** for words (the name, tags);
**Big Shoulders Display Black** for numerals (places, times, metres), like the stamped markings on the pipe.

**The signature:** the **flush**, a heavy glossy sheet of water with a white foam front, streaks rushing down, spray where
it hits ledges and spiders, and the dry pockets it leaves under the bends. In the UI, the **zinc tags on silk**.

**Light and camera:** side view. Cool blue ambient, warm window light on the pipe's outside, and in calm windows gold sun
shafts slanting in through the seams (they fade as the clouds roll in). Lightning in storms: one frame lit cold white,
silhouettes, a quick decay (not with reduced motion). The camera keeps the pipe centred and your spider 60% down the
screen (more to see above); it shows at least 360 units across and 640 tall in portrait (520 in landscape), so landscape
shows more house, never less pipe.

**Spiders:** stylish jumping spiders, not creepy: a chunky fuzzy body, two big glossy front eyes with catchlights, a round
abdomen with a seat colour and a pattern (gold ring, coral stripes, leaf dots, sky chevron, rose diamond, bone star), eight
long two-segment legs with a real alternating gait. Holding: legs splay flat, body squashes to the wall, a silk dot at each
foot. Jumping: squash, stretch, legs tucked, a puff on landing. Washed: a tumbling ball of flailing legs. Bots have their own
names and patterns; players' names and avatar heads sit on their tags.

**HUD in the world's language:** the weather is a drop, the race is a silk thread with beads, places are stamped tags, the
sun setting is the round's clock.

## Sound

All synthesized Web Audio.
- Rain on zinc: filtered noise plus random metallic ticks, louder with the weather and in storms.
- Warning: a low rumble swelling, drips plinking down in pitch, the drop's tick on each second.
- Flush: a roar (band-passed noise, fast attack) with a gurgle tail; spray hiss when it passes over a holder.
- Eight little footsteps: soft ticks at each leg plant, randomly pitched.
- Hold: a sticky "thwip"; each leg letting go a tiny pluck, descending; out of grip, a rip.
- Jump: a short pluck-boing; landing: a tap and a squish.
- Washed: a splash and a comic falling glide; caught by a ring: a clang.
- Bump: a bonk and a squeak. Debris: a cap clattering down, louder as it nears. Bird: a chirp, then a "tok".
- Sun: birdsong and a warm swell. Finish: a bright chord; cup win: a fanfare.
- **Music:** a small sequencer plays the rhyme's tune as tight plucked notes over a soft kick and brushed hats, in a minor
  re-harmonisation so it's stylish rather than a nursery tune. When a warning starts the melody drops out and only drums
  build; under the flush it ducks; in the sun it comes back. Quieter and slower in menus.

## Store art and the trailer

- **Cover** (1280×720): a bend where the pipe crosses the frame diagonally; three spiders, one planted as the flush front hits
  in a burst of spray, one tumbling, one leaping; gold shafts breaking at the top right; "Itsy Bitsy Spider" big on the
  brick at the left.
- **Action:** close-up of a spider washed down in spray, legs flailing, droplets frozen.
- **Win:** a spider on the gutter's edge in full gold sun, front legs raised, the rainy garden far below.
- **Multi:** six spiders across a section as the water arrives: who holds, who doesn't.
- **Icon** (512): a jumping spider's face and front legs gripping zinc, big eyes catching gold light, water spraying past.
- **Badges:** a bold symbol (a sun, a drop, a ring, a leaf, a cup, a star) on a coloured disc.
- **Trailer (~30 s):** 0-3 s the flyover from the sun down to three climbing spiders (goal + racers); 3-8 s the flush hits,
  holders vs the washed; 8-14 s a sunny window, gold beams, chained jumps, an overtake and a bump; 14-20 s the bird flicks a
  rival, a cap bonks off a holder, a surge sends everyone diving for a dry spot; 20-27 s the race to the top and the burst
  into the sun; 27-30 s the name over the attract race.

## Originality check

It resembles **Spider: The Secret of Bryce Manor** (a spider walking on every surface), **Jump King / Only Up** (a vertical
climb where falling costs height), Celeste's climbing stamina (the grip meter) and red-light-green-light (move, then freeze).
What a player notices in the first minute that none of them has: **a shared rain rhythm that freezes the whole race at
once**, water you see rushing down a cutaway pipe toward you, one button that plants eight legs, and a race of six where
the rain is the referee and the leader is hit first.

## Risks

- **Surface walking confusing at corners.** "Up always climbs", direction hysteresis, the camera centred on the pipe; a test
  walks every corner of every piece both ways and checks the spider never sticks or jitters.
- **Holding too early and running out.** The hint appears at the moment to press, and the legs popping off show the meter;
  the first flush ever is 1.2 s.
- **Dry spots hard to read.** They're visibly dry (darker metal, no drips during the warning, the sheet splashing past their
  edge), and the first one gets an arrow.
- **Jumps feeling floaty or random in a narrow shaft.** Tuned so Up + Jump always lands on the opposite wall higher; a test
  checks the jump table from every wall angle.
- **Phone performance** (water, rain, six spiders with legs). Static pipe art pre-rendered into chunks; rain and particles
  scale with `ow.settings.quality`; draw at `pixelRatio(2)`; no allocations per frame.
- **Clock and fairness.** The rain comes from match time on every page (±50 ms is invisible). Each page trusts its own
  spider, so cheating is possible: rewards stay cosmetic and the host rejects impossible finish times.
- **Too much stuff.** The Drizzle cup is the core alone; each later spout adds one thing; there are four features in all.

## Spec changes, and why

- **No webs.** Rings catch a washed spider instead: the same safety net with nothing to explain.
- **Debris falls between flushes in a wall lane** (telegraphed at the screen's top edge), not inside the flush, where it
  would hit only spiders already being washed. Hold blocks it, or you step to the other wall.
- **The fan is a helper:** warm air from a vent lifts jumpers, a reason to jump in the sun.
- **A match is a cup of three spouts the host picks** (the twelve spouts make four cups), not a single spout.
- **Latecomers join at the next spout** in a bot's seat instead of waiting out the whole cup.
- **Monsoon is today's spout** (one daily seed) with a rising flood to end runs; its board is best height ever.
- **Jump 520 with gravity 820** (not 420) so a cross-pipe jump is clearly faster than walking.
- **First Play ever goes straight into Spout 1**, the gentle teaching climb, then the lobby.
- **Our own 3-2-1 per spout** after a flyover (`countdown: 0`), so there is one countdown on screen.

## Tech

- Plain ES modules + Canvas 2D in `game/` (`"dir": "game"`, no build). Fonts as woff2 in `game/fonts/` with `@font-face`,
  `font-display: swap` and OFL.txt; canvas text waits for `document.fonts.load` with a timeout.
- Pure modules (no `window`, `document`, `onceworlds`): `rng.js`, `pieces.js` (the piece library: geometry, rings, dry
  pockets, the bot route), `spouts.js` (the twelve spouts and cups as piece lists + rain settings), `level.js` (pieces →
  left/right wall polylines, islands, catches, pockets, per-edge up direction), `weather.js` (waves, debris, the bird),
  `spider.js` (the fixed-step spider: surface walking, jumps, hold/grip, wash, catches, bumps), `bot.js` (the bot brain:
  inputs from skill and personality), `monsoon.js` (the endless generator and the flood), `race.js` (finish order, places,
  points), `ghost.js` (pack/unpack).
- Page modules: `main.js` (boot, join, screens), `net.js` (match, host, bots, presence, snapshots, bumps, stub room for
  standalone/poster), `render.js` (layers, chunk cache, camera), `draw-spider.js`, `water.js`, `fx.js` (particles, shake
  as trauma², hit-stop), `hud.js`, `ui.js` (the tags on silk, DOM buttons), `audio.js`, `music.js`, `poster.js`.
- Tests (`node --test`): physics, weather, level validity for every spout and 200 Monsoon seeds, bots and balance, race
  scoring, ghost packing, and the room flow through a fake room (host reload, a leaver, a latecomer).
