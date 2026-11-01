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

## The first minute

| Time | What happens | Hint (2-5 words, once) |
|---|---|---|
| 0 s | **Title.** Night rain on a brick house; the cutaway spout fills the screen; four spiders race up it (attract mode, real bots). A flush thunders down: three plant their legs, one tumbles down to the ring below. "Itsy Bitsy Spider" is stamped on a zinc sign hanging on two silk threads from the gutter; a big zinc **Play** tag hangs under it, swaying. | none |
| 2 s | Tap Play (or Space/Enter): sound starts, the sign is pulled up on its threads. **First visit ever:** straight into Spout 1, Garden Shed, alone. Returning players: the lobby. | |
| 2-4 s | Camera starts at the sun breaking over the gutter, sweeps down the spout to your spider on the bottom ring. | |
| 4 s | Your control. | "Up to climb" (phone: "Push up to climb" with an arrow to the stick) |
| 7 s | Sun beams through the seams, legs pattering. First warning: the sky darkens, drips streak down, a rumble, the drop in the corner swells (3 s this first time). | "Rain coming" |
| 9 s | 0.7 s before the water reaches you: | "Hold J" (keys) / "Hold!" with an arrow to the Hold button (touch) |
| 10 s | **The flush** (1.2 s this first time). Holding: legs splay flat, water sheets over you, a "thwip" and a little spray. Not holding: washed down 250 to the ring below, with a clang. | after a wash-out: "Hold when it hits" |
| 11 s | The water passes, gold light floods back, birdsong. If still holding 0.6 s after: | "Let go to climb" |
| 16 s | A bend in the pipe with a dry pocket under it; second warning. | "Dry spot" with an arrow to the pocket |
| 24 s | A bracket across the pipe: walking around it is long, a jump past it is short. | "Space to jump" / "Tap Jump" with an arrow |
| 30-40 s | Third wave, then out over the gutter lip into the sun: the spider pops onto the roof edge in gold light, fanfare, the time, stars pop in. Buttons: **Race** (main), Again. | |
| 45 s | **Lobby**: your spider and five bots sit on the bottom ring, names on tags. Cup: Drizzle. | "Ready to race" pointing at the platform's lobby bar |
| 48 s | Ready: the race starts at once with bots (a lone player in a public server). The spout's flyover (sun to start), 3, 2, 1, GO. | |
| 55 s+ | Racing five spiders up the Garden Shed, the first flush washes two of them past you. | |

A player who skips everything still reads the goal from the flyover (the sun at the top) and the danger from the first
flush (water + tumbling spiders).

**Hints follow the device in hand** (the last input decides): keyboard hints name the key, touch hints name the on-screen
button and point at it. Each shows once (Hold up to six times, and only again after a wash-out) and is remembered in the
`hints` save.

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
**The drain is blocked: the pipe floods from below.** The flood rises after 3 s, starting 3 m below the start, at
70 units/s + 0.6 per metre of flood height (capped at 160, reached at 150 m). Waves quicken with height (calm 6-7 s at
0 m down to 2.2-3 s at 200 m, flushes 1.4-1.7 s up to 2.3-2.5 s; vents from 10 m, moss from 20 m, debris and doubles from
30 m, long drops from 40 m, surges from 60 m, the bird from 80 m). The flood catching you ends the run; a wash-out near the flood is
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
- `rounds: 3`, `introSeconds: 5` (2 s at the sun, the sweep down, then our own 3-2-1, so `countdown: 0`: one countdown on
  screen), `roundSeconds: 240` (a hard cap that should never matter), `roundEndSeconds: 6`, `resultsSeconds: 20` (a private
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
| Your spider (move, jump, hold, wash, catch) | your page | presence, 20 Hz: `{ v, r, x, y, a, m, g, h, f, d }` (version, round id, position, angle, mode, grip×10, holding, facing, finish ms), < 100 bytes |
| Rain, debris, the bird | nobody: a pure function of (spout, `match.seed` + round, round time on the match clock) | computed on every page |
| Water hitting a spider | that spider's page (bots: the host) | the resulting state shows in presence |
| Bot spiders | the host's page, same simulation | `host:bots` state at 10 Hz: `{ r, t, b: [[id, x, y, a, mode, grip×10, holding, facing, finish ms], ...] }`, interpolated 150 ms behind on other pages |
| A bump (a jump into a rival) | the jumper's page detects it on its view of the rival; the **bumped** page applies it to itself (bots: the host) after checking the bumper is near it and not rate-limited | `room.send({ t: 'bump', ... }, { to })` |
| Finishing | your page calls `host.rpc('finish', { r, ms })`; the host orders finishes by the room's `matchTime`, refuses times faster than the spout allows or from far below the top | the round's `match.data.fin` |
| Places, points, round end | the host: all present racers finished, or 20 s after the first finish, or the cap; unfinished racers ranked by height | match record |

Other spiders are drawn with `room.presenceAt(id, { angles: ['a'], snap: 300 })`. A bump message is applied only when the
bumper is within 90 units of the bumped spider as that page sees it, once per 0.9 s per pair. Tested through a fake room
(`test/net.test.mjs`): pages see each other, bots on a guest's page stay within 150 units of the host's, finishing goes
through the host once per round, a new host adopts the bots from the last snapshot and keeps them climbing, a latecomer
watches with no spider and no presence, a leaver ranks last, the sun-set rule ends the round, and forged or far bumps,
presence and snapshots are dropped. Your own spider is never corrected by the
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
| Double wave | flush 1.2 s, gap 1.0 s, flush 1.2 s (holding through both runs grip low; let go in the gap) |
| Surge | flush 3.4 s with a 3 s warning: longer than grip, so you need a dry spot or you lose height |
| First two flushes of every race (and of Monsoon) | gentle: 3 s warning, 1.2 s of water |

Rain per spout (calm / flush; each race starts with 5 s of sun):

| Spouts | Calm | Flush | Period | Extras |
|---|---|---|---|---|
| 1-3 (Drizzle) | 6-7.5 s | 1.4-1.8 s | 9.5-11 s | |
| 4-6 (Shower) | 4.5-6 s | 1.8-2.0 s | 8.5-10 s | doubles from 5 (1 in 4 waves); debris on 4 and 5 |
| 7-9 (Downpour) | 3.5-5 s | 2.0-2.2 s | 7.5-9 s | surges 1 in 5 (Church 1 in 4), doubles 1 in 10 |
| 10-12 (Storm) | 2.5-4 s | 2.2-2.5 s | 6.5-8.5 s | surges 1 in 5, doubles 1 in 7, never two surges in a row; lightning on 10 |

**Race lengths:** Garden Shed ~20 s for an expert, ~40 s for a beginner; Skyscraper ~70 s / ~130 s.

**Bots:** skill 0-1 drives every parameter (one brain for all): reaction to the warning (holds lerp(1.2, 0.05) s early),
chance to miss a hold lerp(18%, 2%), let-go delay lerp(0.6, 0.05) s, jump chains only above 0.5 (jump-angle error
lerp(15°, 3°)), dry-spot use above 0.4. Five personalities on top: **Hopper** (jumps even when it's risky), **Mabel**
(holds early, rarely washed), **Dash** (never holds early, often washed), **Velvet** (loves dry spots), **Inch** (slow and
steady). A race's bots spread evenly across a range by cup (the first seat gets the strongest): Drizzle 0-0.55,
Shower 0.15-0.65, Downpour 0.3-0.8, Storm 0.4-0.9. A beginner beats at least one bot in the first race (tested: a 0.2
climber beats the weakest Drizzle bot); the 0.9 bot is beaten only with good routes (dry spots, jump chains).

**Stars** (finish = one star; then silver, then gold; seconds, set from simulated bot runs near the 0.5 and 0.9 bots' times):

| Spout | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Silver | 24 | 29 | 33 | 40 | 47 | 44 | 59 | 56 | 70 | 97 | 99 | 117 |
| Gold | 21 | 25 | 28 | 34 | 36 | 35 | 53 | 47 | 56 | 73 | 78 | 86 |

**How it's checked (node tests, 46):** every spout's path is clean (no zero or backwards segments, normals into the
pipe) and its dry pockets lie on it; Up alone climbs every spout to the sun on a dry day; the stick direction is latched
round corners and never flips mid-press; Up + Jump from a wall lands on the opposite wall, higher; every wave gives ≥ 2 s of warning and the first
two are gentle; a flush (not a surge) is survivable by holding from impact with full grip; dry pockets stay dry; in full cup
races across seeds ≥ 90% of bots finish and winners take 12-150 s with no NaN; skill orders finishing times; the 0.9 bot
reaches gold and the 0.5 bot silver in ≥ 2 of 8 seeds; a 0.2 beginner beats the weakest Drizzle bot; over 14 simulated
cups the leader after two races loses at least twice (no runaway); Monsoon builds valid spouts for 25 seeds, its flood
catches bots and a 0.9 bot climbs 50 m higher than a 0.15 one; and the race layer through a fake room (below).

## Every screen

The UI is made of one thing: **zinc tags hanging on silk threads**. A riveted, stamped metal plate on two silk strands that
swings in on a spring when it appears and sways in the wind. Buttons, the title, places and results are all tags.

- **Title:** the attract race (four real bots on a random early spout) fills the screen; the name sign hangs on silk at the
  top (to the left of the spout on wide screens, so the race stays in view); the gold Play tag (56 px) at the bottom; Space
  or Enter also plays. The platform's lobby bar is hidden here. Nothing else.
- **Lobby:** the foot of the cup's first spout: the players and the bots that will fill the seats stand on the drain
  (facing each other), names above them (yours gold, bots dimmed). Top (clear of the menu): the cup tag (cup name and its
  three buildings; the host has ‹ › beside it) and the Bots tag (Fill/Off, the host's). Bottom, above the platform's
  lobby bar (which shows who is ready): **Spouts ★ 14/36**, **Monsoon 212 m** and **+ Invite** (`ow.ui.showInvite()`).
- **Round intro (5 s):** camera from the sun down to the start ring; the spout's tag swings in ("Church", with the cup's
  three buildings, this one lit); 3, 2, 1 as huge stamped numerals with three drips; GO with a flare of the sun. The
  platform's helper writes the round's data only when play begins, so during the intro every page works out the same
  spout and seed itself (cup, round, round id: what the host's `startRound` will return) and shows the real start.
- **Play HUD:** top-right: the **weather drop** (sun disk in calm; a swelling teardrop with the seconds inside during a
  warning; a jagged burst for a surge; draining while the flush passes over you) and beside it the **place tag** ("2ND",
  huge numerals) or, solo, the clock. The **climb line** down the right edge: a silk thread from the sun to the ground with
  every spider as a bead (seat colour + pattern symbol; you bigger, outlined; the ghost in solo; the flood in Monsoon).
  Grip on the spider (legs + a thin arc while not full). A bone-white chevron over your spider; small outlined names over
  the others. After the first finish, the sun on the climb line turns orange and "0:20" counts down by the place tag.
  **Out came the sun:** at the top the camera lifts to the sky over the roofs and the sky clears for you (gold light, the
  drop turns to the sun, no more warnings); 2.5 s later in a race it goes down to watch the best spider still climbing.
  Nothing in the lower corners while touch controls are on; everything laid out from `ow.ui.reserved`.
- **Between spouts (6 s):** this race's places as tags swinging in on silk one after another (place, seat mark, name,
  "+10"), yours outlined in gold.
- **Cup results (20 s):** gold confetti on the winner's spider; three podium tags (place, seat mark, name, points)
  hanging at three heights, the winner's gold; your line ("4th · 19 pts"). Private host: a Continue tag.
- **Spouts menu:** a grid of twelve small tags (number, name, three star slots, best time); locked ones dimmed and marked
  Locked; a Back tag.
- **Solo finish:** the time, huge; the stars pop in one by one with a note each; the old best; **Next** (main), Again,
  Back (after the first climb: **Race** and Again). The ghost of your best run climbs beside you next time.
- **Monsoon end:** the flood swallows the spider in a splash; "212 m" huge; best and today's best; **Again** (main), Back.
- **Pause (solo):** Resume (main), Restart, Back. Opens from the II tag at the top left, `ow.on('pause')` (and closes
  on `resume` when the menu opened it), `visibilitychange`, Esc/P.
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

**Fonts** (self-hosted woff2, latin, OFL next to them): **Alfa Slab One** for the name, numerals (places, times, metres,
the 3-2-1) and the main buttons, like stamped markings on the pipe; **Sofia Sans Condensed ExtraBold** for words.

**The signature:** the **flush**, a heavy glossy sheet of water with a white foam front, streaks rushing down, spray where
it hits ledges and spiders, and the dry pockets it leaves under the bends. In the UI, the **zinc tags on silk**.

**Light and camera:** side view. Cool blue ambient, warm window light on the pipe's outside, and in calm windows gold sun
shafts slanting in through the seams (they fade as the clouds roll in). Lightning in storms: one frame lit cold white,
silhouettes, a quick decay (not with reduced motion). The camera keeps the pipe centred and leads upward: your spider sits
10% of the view below the middle in portrait and 20% in landscape, so a short landscape phone (844×390) still sees what's
coming. It shows at least 360 units across and 640 tall in portrait (560 in landscape: zoomed out), so landscape shows more
house, never less pipe. The translation snaps to whole device pixels so the cached art and the live layers line up.

**The rain warning reads anywhere:** besides the drop, a gutter strip along the very top edge of the screen fills from both
sides as the water comes and pours white under the flush, with the warning's rumble and ticks; lightning in storms.

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

All made by the game itself (`?poster=<name>`, `game/poster.js`): a seeded bot race is simulated, every 1/30 s scored for
the picture, and the best moment replayed with the spiders' animation and particles settled.
- **Cover** (1280×720): the Bakery's bend at dusk, the flush front breaking at the jog in foam and spray, spiders planted
  and tumbling around it; the name on a zinc sign at the left ("Itsy Bitsy" over "SPIDER").
- **Action:** the Farmhouse, close in on a spider washed down the shaft in spray.
- **Win:** the Barn's gutter in full sun: the winner on the edge, front legs up, a gold sunburst and confetti behind.
- **Multi:** the Greenhouse, the first water of a race arriving over all six spiders: who holds, who doesn't.
- **Icon** (512): a spider gripping a zinc ledge, big eyes, water sheeting past, gold light top right.
- **Badges:** a bold symbol on a coloured disc: a spider under a sun (first climb), a drop over eight feet (hold on), waves
  and a falling arrow (washed out), the sun, a U-turn arrow (up the spout again), a cup, a crossed-out drop (no washouts),
  a pipe with 12, three stars, a lightning bolt over 100.
- **Trailer** (`store/trailer.mp4`, 23.7 s, 1280×720, the game's own sound): captured from autoplay races on private
  servers at 2× pixels (no hints), six hard cuts: the flush front crashing onto three bracing spiders (a closer frame);
  the pack of six climbing the Barn; neck and neck, then a flush washes the leader down a bend; a surge on the
  Lighthouse and a dive into a dry pocket; the last stretch, rivals bursting into confetti and the sun coming out over
  the roofs; the name sign over the title's attract race.

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
- **Phone performance** (water, rain, six spiders with legs). The static house and pipe are painted once into 256-device-px
  bands (offscreen canvases, a small LRU), so a frame draws a handful of images plus the live layers; rain and particles
  scale with `ow.settings.quality`; draw at `pixelRatio(2)`, capped at 3.6 M device pixels; fixed particle pool.
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
- **Plain Canvas 2D** with cached static layers instead of a WebGL stack: the look is carried by the flush (gloss runs that
  follow the bends, scrolling streaks, a foam front, spray), three layers of rain at different parallax, lightning frames
  and warm windows.

From the design review (built): hints by device (last input decides; touch points at the button); the surface mapping is
latched while a direction is held, so left/right on a ceiling or inside an elbow never flips mid-press; the top-edge
warning strip with sound and gentle first two flushes; landscape zoomed out with a stronger upward lead; static layers
cached for phones; bot ranges set so a beginner beats one bot and the best needs good routes.

## Tech

- Plain ES modules + Canvas 2D in `game/` (`"dir": "game"`, no build). Fonts as woff2 in `game/fonts/` with `@font-face`,
  `font-display: swap` and OFL.txt; canvas text waits for `document.fonts.load` with a timeout.
- Pure modules (no `window`, `document`, `onceworlds`): `rng.js`, `pieces.js` (the piece library: geometry, rings, dry
  pockets, the bot route), `spouts.js` (the twelve spouts and cups as piece lists + rain settings), `level.js` (pieces →
  left/right wall polylines, islands, catches, pockets, per-edge up direction), `weather.js` (waves, debris, the bird),
  `spider.js` (the fixed-step spider: surface walking, jumps, hold/grip, wash, catches, bumps), `bot.js` (the bot brain:
  inputs from skill and personality), `monsoon.js` (the endless generator and the flood), `race.js` (finish order, places,
  points), `ghost.js` (pack/unpack).
- `run.js` (one climb on screen: a level, its weather and its spiders, stepped at 120 Hz; used by the title, the lobby,
  solo, Monsoon and races) is pure too.
- Page modules: `main.js` (boot, join, screens, input, camera, hints, saves), `net.js` (match rules, host state and rpc,
  presence, snapshots, bumps; a stand-in SDK, room and local match for standalone and posters), `draw.js` (one frame in
  order), `scene.js` (cached bands, sky, rain, ivy, hazards, mood), `water.js`, `spiderart.js` (the puppet: IK legs, gait),
  `fx.js` (particles, shake as trauma², hit-stop), `hud.js`, `ui.js` (the tags on silk, DOM buttons), `audio.js` (synth
  sounds and the music sequencer), `view.js`, `paint.js`, `poster.js`.
- Tests (`node --test`): level, physics, weather, race scoring and ghosts, balance (cup simulations), Monsoon, and the race
  layer through a fake room (host change, a leaver, a latecomer, bumps, validation).
