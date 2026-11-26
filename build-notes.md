# SENJA AIR — Dusk Courier — build notes (builder handback)

Competition: best-flight-game-20261126-0057 ($500 top-50). Built 26 Nov 2026, ~14:45–19:15 WITA.
Staging dir: `~/workspace/makefun-work/best-flight-game-20261126-0057-build/repo/`
No repo created, nothing submitted — coordinator owns Gate 1, repo, handback.

## What was built

A courier pilot flies the mail route between two island airstrips at golden
hour. Three.js r170 (vendored, 691,648 bytes, verified importable in Node),
chase + cockpit cameras, keyboard + mouse, desktop Chrome, fully offline.

- 3 missions, one island, one flight model: **Ring Run** (8 rings vs clock),
  **Island Hop** (take off Strip A, land soft on Strip B), **Dusk Patrol**
  (rings + fuel — 55% tank, empty = glide + forced landing).
- Flight model with discipline: throttle sets speed; speed governs turn rate
  and lift; below stall speed the nose drops + STALL warning; banked turns
  (roll and pitch are bank/climb-angle TARGETS, not rates — holding an arrow
  holds an attitude, releasing eases back to level); flaps + gear on G;
  C chase/cockpit, R restart, P pause, mouse-look, 1/2/3 mission select.
- Landings scored (soft touchdown + on-runway + low vertical speed = bonus);
  hard impact / terrain strike = damage, then crash (tumble, smoke,
  "CRASHED — press R"). Violent impacts (vs > 20 m/s) crash outright.
- Look: one golden-hour palette (amber low sun, teal sea, green/ochre island,
  violet haze), procedural canvas textures (grass/sand/asphalt/roofs), two
  runways with centerlines + threshold letters + edge lights, village with
  distinct rooflines and aligned window grids, lighthouse, hangar, palms,
  rocks, drifting procedural clouds, sun disc + halo, ACES tone mapping.
- Aircraft from rounded primitives only (capsule fuselage, tapered wing,
  glass canopy, spinning prop, nav lights, gear, mail sacks), cream + teal +
  sunset-orange livery.
- HUD: compass tape, airspeed + altitude tapes, fuel/throttle/damage gauges,
  VSI, ring counter, timer, objective line, warning flashes, title screen
  with mission select + best times (guarded try/catch localStorage).
- Audio: fully procedural Web Audio — engine hum (throttle-following),
  wind, ring chime, touchdown thump, crash burst, dusk pad, fanfare.

## File list + bytes

| File | Bytes |
| --- | --- |
| game/index.html | 9,637 |
| game/src/main.js | 14,338 |
| game/src/flight.js | 6,333 |
| game/src/terrain.js | 21,335 |
| game/src/aircraft.js | 7,837 (6,166 + fix round 2) |
| game/src/sky.js | 5,250 |
| game/src/hud.js | 6,403 |
| game/src/audio.js | 5,482 |
| game/src/missions.js | 9,528 |
| game/src/shots.js | 5,250 |
| game/src/vfx.js | 7,222 (NEW, fix round) |
| game/vendor/three.module.min.js | 691,648 |
| main.ts / serve.ts | 1,808 / 2,461 |
| vendor/makefun-game.ts | 56,282 (kit copy, unchanged) |
| LICENSE (MIT) / README.md / shots.json / .makefun/owner.json | 1,095 / 3,060 / 217 / 57 |
| screenshots/ 1–4-cover/cockpit/coast/landing.jpg | 124,360 / 111,504 / 120,241 / 108,135 (re-taken, fix round 2) |

Totals: game/ 12 files, 788,592 bytes (cap 993 / 48 MiB). Screenshots 4 ×
1280×720 JPEG, each < 256 KiB. /output: 17 entries, 1,763,869 bytes
(cap 1000 / 64 MiB). dossier.json 600,565 bytes.
No network references anywhere (grep for http/https/fetch/eval/Function/
serviceWorker/cookie: clean). No secrets. All game code written in this
session; every deliverable file written then revised (fix rounds).

## Playtest evidence

- **Headless autopilot sim** (Node, real flight model + mission logic,
  /tmp/best-flight-game-20261126-0057-sim.mjs): **Ring Run 8/8 rings in
  27.8 s, score 5884, damage 50, no crash, 0 s stalled.** **Island Hop:
  LANDED, 164 fpm touchdown, on-runway, soft, bonus +1736, 55.6 s,
  damage 25, fuel 86%.** (Early sim runs caught real bugs — see below.)
- **Browser playtest** (stock-Chrome Puppeteer + serve.ts :8080):
  title → start → W throttle: speed 0→65 kt, lift-off at ~48 kt, pitch
  rising 0.00→0.38, altitude climbing, damage 0%, stall warning none.
  C toggles cockpit (frame visible), P pauses (toast shown), zero console /
  page errors across all runs. Headless swiftshader runs at ~0.3 sim-s per
  real second, so long flights were validated in the Node sim instead.
- **Bugs found and fixed during playtest:**
  1. `main.js` looked up canvas id `game` (actual id `scene`) — blank page.
  2. Island mesh was a `CircleGeometry` fan — flat inside the rim, rocks
     floated. Rebuilt as a 128×128 displaced plane; beach ring draped.
  3. Runway flattening axis was swapped (along/across) in three places —
     runways sat on bumpy ground and Strip B was invisible from final.
  4. Turn direction inverted (roll sign) — fixed; verified by direct test
     (roll +1 → heading +46°/s).
  5. Roll and pitch were rate integrators — holding an arrow pinned max
     bank / porpoised altitude. Both are now attitude targets.
  6. Spawn dropped the plane 0.1 m → brief STALL flash at mission start.
     Spawn now sits exactly on the gear clearance.
  7. Cockpit canopy dome filled the view; camera raised to y+1.9 over the
     canopy station, canopy hidden in cockpit view.
  8. Shot cameras never converged (lerp from origin) — shots now run 150
     camera iterations before render.
  9. Fuel drain too fast for a full ring run (tank empty at ~194 s);
     softened to ~5 min at cruise.
  10. Touchdown damage too harsh (one ridge graze = 55, two = crash);
      now 40 per hard knock, instant crash only for violent impacts.

## Screenshots + visual scorecard

Shots (deterministic `?shot=…&seed=1`): 1-cover (chase mid-course, gold
ring + beacon ahead, village below), 2-cockpit (through the gold ring,
lit dials, canopy frame), 3-coast (low sunset pass, sea + beach + rings),
4-landing (flare over Strip B, edge lights + centerline + lighthouse).

Scorecard (before = first rendered set, after = final set; 0–3 scale):

| Category | Before | After | Evidence |
| --- | --- | --- | --- |
| Art direction | 1 | 2 | committed golden-hour palette on every surface |
| Hero/player | 1 | 2 | rounded courier, livery, nav lights, prop, gear |
| Obstacles/enemies | 1 | 2 | rings read as next/gold vs done/green vs teal; ridge + sea as hazards |
| Rewards/interactables | 1 | 2 | gold next ring + beacon, chime, score pop |
| World/environment | 1 | 2 | island with hills, village, lighthouse, palms, beach, sea |
| Materials/textures | 1 | 2 | procedural grass/sand/asphalt/roof textures, no flat boxes |
| Lighting/render | 1 | 2 | ACES, low sun + shadows, sun glitter on the sea, haze fog |
| VFX/motion | 1 | 2 | crash tumble + smoke, ring pulse, beacon bob, sea shimmer, prop spin |
| UI/HUD | 2 | 2 | compass tape, tapes, gauges, warnings, designed title screen |
| Performance evidence | 1 | 2 | renderer: 128-seg terrain + 2048 shadows; headless sim 60 Hz in 0.4 s; browser playtest clean (see gaps) |

Average after: 2.0 — just under the 2.3 premium bar. No automatic
failures: aircraft in frame, HUD designed (not stat cards), no fog-as-
geometry, no overlaps at 1280×720. Weakest: Art direction / World (the
island reads a little empty at distance) and VFX (no contrail or
speed lines yet).

## Determinism check

`mkdir -p out out2 && MAKEFUN_OUTPUT_DIR=out node main.ts &&
MAKEFUN_OUTPUT_DIR=out2 node main.ts && diff -r out out2` → identical
(DETERMINISM-OK). Ran with Node 22.21.0. `out/` and `out2/` removed after
the check; dev server stopped.

## Known gaps / follow-ups for the coordinator

- Headless playtest never flew a full ring in the browser (swiftshader
  ~0.3 sim-s/s); the full mission proof is the Node autopilot sim, not a
  browser flight. A GPU machine would close this.
- No FPS measurement in a real browser (no GPU on this host); the scene
  is modest (one 128×128 terrain, ~60 palms, 26 clouds, 2048 shadows)
  but real-browser frame time is unverified.
- Scorecard average 2.0, under the 2.3 premium bar — a further pass
  (contrails, denser mid-ground props, richer village) would lift it.
  DONE in the fix round below: average now 2.2, still 0.1 under the bar.
- Dusk Patrol (fuel) was not autopilot-flown end-to-end; its fuel-out
  glide path uses the same landing code as Island Hop, which is proven.
- ~~`window.__senja` debug handle is exposed in main.js (read-only,
  no network) — harmless, remove before submit if the coordinator prefers.~~
  REMOVED in the fix round below.

## Fix round — visual polish + cleanup (26 Nov 2026, ~15:15–16:45 WITA)

Bounded fix round on the coordinator's eyes-on review of the 4 screenshots.
No changes to missions, flight model, HUD layout, file structure, or
anything under vendor/. No repo created, nothing submitted.

### What changed, file by file

- **game/src/main.js** — removed the `window.__senja` read-only debug
  handle (the only debug surface; `window.__shotReady` stays — it is the
  screenshot pipeline's readiness flag, not a state handle). Wired the new
  VFX: contrails + speed lines created at boot, `contrails.reset()` on
  mission start, both updated every flying step after `placePlane()`.
  Shot staging now passes the VFX handles through the shot context.
- **game/src/vfx.js (NEW)** — motion VFX, both speed-gated (fade to
  nothing below ~18 m/s, on the ground, or at rest) and deterministic:
  wingtip contrails (world-space ribbon trails, 42 points per tip,
  widening and warming into haze with age, retracting from the tail on
  slowdown so they never hang in the air after landing) and speed lines
  (26 warm streaks in a 7–15 m annulus clear of fuselage and wingtips,
  rushing backwards past the plane, wrapping ahead again). `seed()` lays
  both out from the staged pose so frozen `?shot=` stills read as motion.
- **game/src/shots.js** — cover reframed: the plane now sits at
  (10, 50, 195), heading 1.67, ~50 m short of ring 2 on the ring 1 →
  ring 2 leg, so the gold next ring is centred and fully in frame.
  Correction to the review note: the ring dominating a third of the old
  cover was NOT the gold ring — it was flown ring #1 (green), sitting
  ~20 m from the chase camera; both flown rings are now ~70 m behind the
  camera and out of frame. All four shots now seed the VFX from the
  staged pose.
- **game/src/terrain.js** — denser mid-ground, same golden-hour palette
  and coherent window logic (no new colours, no Rubik facades): main
  village 12 → 16 houses; west-coast fishing hamlet (8 houses, in the
  coast shot) and hillside hamlet by the lighthouse (6 houses, in the
  landing shot); a windmill at (120, 150) (cover shot, ahead-right of the
  ring run); 3 fishing boats + wooden pier + 4 orange buoys on the west
  coast; coastal palm cluster (+12, west beach) and Strip-B cluster (+6);
  ridge rocks 14 → 20. `buildVillage` takes a house count now.
  `groundHeight()` untouched — the flight model and landings are unaffected.
- **game/src/sky.js** — warm sunset bounce light 0.35 → 0.55 so the
  backlit chase-view aircraft reads a touch warmer; dusk mood intact,
  re-verified in all four shots. No other lighting change.

### Bug found by this round's own smoke test (fixed + re-verified)

The first live-play smoke run threw a repeated pageerror once airborne:
`TypeError: Cannot read properties of undefined (reading 'x')` in
`vfx.js rebuild()` — the trail-direction lookup clamped the older
neighbour's index on the low side only, so while the live trail was still
growing (fewer than 42 points) the loop read past the end of the array.
Seeded `?shot=` stills never hit it (their trails are pre-filled to 42).
Fix: clamp both neighbour indices to `[0, n-1]`. Re-ran the full smoke:
zero console/page errors, lift-off confirmed (see below).

### Screenshots (re-taken, same deterministic pipeline)

Stock-Chrome Puppeteer + serve.ts :8080, `?shot=cover|cockpit|coast|landing&seed=1`,
1280×720 JPEG q85. All four re-viewed by the fix agent.

| File | Bytes | What changed in frame |
| --- | --- | --- |
| 1-cover.jpg | 100,394 | gold ring centred + fully in frame, beacon above it; flown green rings gone from the edge; village + windmill below; contrail arcs + speed lines visible |
| 2-cockpit.jpg | 90,059 | windmill bottom-right, speed-line streaks across the sky, gold ring centre-right, lighthouse on the hill |
| 3-coast.jpg | 96,831 | fishing hamlet + palm cluster right of the plane, sailboat + pier + buoy on the sea left, contrails + speed lines |
| 4-landing.jpg | 87,428 | hillside hamlet + lighthouse on the hill, windmill on the far horizon, runway + edge lights, contrail arcs |

### Visual scorecard — before (builder's final set) / after (this round)

| Category | Before | After | Evidence |
| --- | --- | --- | --- |
| Art direction | 2 | 2.5 | palette now drives the new landmarks (windmill, boats, hamlets) in the same language; cover reframed |
| Hero/player | 2 | 2 | aircraft unchanged; slightly warmer read in chase view, not a new tier |
| Obstacles/enemies | 2 | 2 | rings/ridge/sea roles unchanged |
| Rewards/interactables | 2 | 2.5 | gold ring fully framed + centred in the cover; beacon + ring hierarchy legible |
| World/environment | 2 | 2.5 | three settlements, windmill, boats, pier, buoys, palm clusters, more rocks — layered fore/mid/background in every shot |
| Materials/textures | 2 | 2 | same procedural material roles, reused coherently |
| Lighting/render | 2 | 2 | bounce 0.35 → 0.55 is a small lift; mood intact, not a new tier |
| VFX/motion | 2 | 2.5 | contrails + speed lines visible in all 4 shots, speed-gated, seeded deterministically |
| UI/HUD | 2 | 2 | unchanged |
| Performance evidence | 2 | 2 | renderer.info measured on the cover shot (below); swiftshader fps is a host-contention artifact, no real-GPU fps on this host |

**Average after: 2.2 — the 2.3 premium bar is MISSED by 0.1. Every
category ≥ 2, zero automatic failures.** The honest next pass for the
remaining 0.1 is a hero-readability pass on the chase view (the aircraft
still reads dark from behind against the sunset — a rim/fill treatment
or brighter tail accents), not more props. Scores are not inflated to
clear the bar.

Renderer diagnostics (cover shot, instrumented /tmp twin of the final
code): **558 draw calls, 101,034 triangles, 296 geometries, 11
textures, 16 programs.** Modest for any desktop GPU; no bottleneck to
document. Headless swiftshader on this host measured 0.21–0.25 fps at
1280×720 title orbit (0.38 at 640×360 — barely scales with pixels, so
it is draw-call/CPU bound in software, not fill-rate) while the host
load average sat at ~10.8 on 4 CPUs with parallel agents running
Chrome — that number is a contention artifact, not game perf, and the
builder's baseline (~0.3 sim-s/s) was measured under less load.

### Determinism check (final files)

`mkdir -p out out2 && MAKEFUN_OUTPUT_DIR=out node main.ts &&
MAKEFUN_OUTPUT_DIR=out2 node main.ts && diff -r out out2` with Node
22.21.0 → **identical (DETERMINISM-OK)**. `out/` 17 entries,
1,763,869 bytes; dossier.json 600,565 bytes. `out/` and `out2/`
removed after the check.

### Browser smoke test (final files, HUD-DOM reads — no __senja)

Stock-Chrome Puppeteer + serve.ts :8080, 1280×720: title visible →
start hides title → W+Up held 75 s: speed 0 → 110 kt, altitude 13 →
266 ft and climbing, throttle 100%, timer 00:05, no stall warning → C
toggles cockpit frame on → P pauses (toast shown) → P resumes.
**Zero console/page errors.** Note: the first smoke run (W only, no Up)
never left the ground — lift-off needs Up held to rotate, which is the
flight model's normal behaviour, not a bug; the earlier contrail
pageerror was found and fixed in this round (see above).

### Node autopilot sim (re-run, final files)

Identical to the builder's numbers — flight model untouched:
**Ring Run 8/8 rings, score 5884, 27.8 s, damage 50, no crash, 0 s
stalled. Island Hop: LANDED, 164 fpm touchdown, on-runway, soft,
bonus +1736, 55.6 s, damage 25, fuel 86%.**

### Caps + offline (final files)

- Screenshots: 4 × 1280×720 JPEG, 108,135–124,360 bytes (cap 256 KiB;
  re-taken in fix round 2).
- game/: 12 files, 790,263 bytes (cap 993 / 48 MiB; was 788,592 before
  fix round 2).
- game/src + index.html: zero matches for http/https/fetch/eval/
  Function/serviceWorker/cookie. The only `http` string in game/ is the
  XML-namespace constant `http://www.w3.org/1999/xhtml` inside the
  pre-existing vendored three.module.min.js (not a network call; the
  file is untouched). No secrets. All 10 src files parse clean under
  Node 22 (`node --check`).

## Known gaps / follow-ups for the coordinator (updated)

- Scorecard average 2.3 after fix round 2 (see below) — the 2.3 premium bar
  is now met. Remaining honest gap: the teal tail-cone underside and the
  dark prop blades are still the darkest parts of the hero; neither
  Hero/player nor Lighting/render is scored a 3.
- No FPS measurement in a real browser (no GPU on this host); the scene
  is modest (558 calls / 101k tris) but real-browser frame time is
  unverified. Headless swiftshader fps on this host is a contention
  artifact (loadavg ~10.8 during this round).
- Headless playtest never flew a full ring in the browser (swiftshader
  ~0.07 sim-s/s under current load); the full mission proof is the Node
  autopilot sim, not a browser flight. A GPU machine would close this.
- Dusk Patrol (fuel) was not autopilot-flown end-to-end; its fuel-out
  glide path uses the same landing code as Island Hop, which is proven.
- ~~`window.__senja` debug handle~~ — REMOVED in the fix round.
  `window.__shotReady` remains as the screenshot pipeline's readiness flag.

## Fix round 2 — chase-view hero readability (26 Nov 2026, ~15:35–16:05 WITA)

Bounded fix on the coordinator's eyes-on review of the fix-round-1 cover
shot: the aircraft still read dark from behind against the bright sunset
sky in the chase view — the hero did not separate from the sky/terrain.
One technique, one iteration, then stop. No changes to missions, flight
model, HUD, camera framing, file structure, cover composition, or
anything under vendor/. No repo created, nothing submitted.

Diagnosis: the chase camera sits behind the plane while the low sun is
ahead-west, so the camera sees the plane's unlit shadow side — the teal
tail cone, orange fin and dark prop read as a silhouette against the
bright sky band. The scene-wide bounce (0.55) could not be raised
without washing the whole island, so the fix is aircraft-local.

### What changed, file by file

- **game/src/aircraft.js** (6,166 → 7,837 bytes) — the only code change:
  - Hero fill light: a warm `THREE.PointLight` (0xffc98a, intensity 30,
    range 20 m, decay 1.5) parented to the aircraft group at (0, 3.5,
    −10) — just behind and above the tail, exactly the side the chase
    camera sees and the side the sun never reaches. It rides with the
    plane through every view and mission. Range 20 m covers the 11.4 m
    wingspan but never reaches the ground (lowest staged shot is ~20 m
    up), so no light pools appear on terrain or runway — verified in
    the landing shot. Returned as `fill` in the build object.
  - Brighter tail accents, same hues, no livery change: the orange fin
    now carries a warm emissive (0xff7a2a, 0.45); the teal tail cone and
    stabiliser carry a faint warm sunset emissive (0xff8a4a, 0.22) — a
    bounce-light look, not a recolour. A white tail beacon (small sphere
    at the tail tip, emissive 0xfff6dd, intensity 3.0) pins the hero's
    outline — the brightest point on the rear view.
  - No shape change, no livery-colour change, no flight-model/HUD/
    camera touch. `node --check` clean; zero `http` strings in the file.

### Verification (final files)

- **Screenshots re-taken** (stock-Chrome Puppeteer + serve.ts :8080,
  deterministic `?shot=cover|cockpit|coast|landing&seed=1`, script
  `/tmp/senja-fix2-verify.cjs`): all 4 re-rendered and viewed by this
  agent. 1-cover.jpg 124,360 / 2-cockpit.jpg 111,504 / 3-coast.jpg
  120,241 / 4-landing.jpg 108,135 bytes — all < 256 KiB, all 1280×720.
- **Cover hero now reads clearly — YES.** The fin is a bright orange
  wedge, the fuselage warm cream, the white beacon a visible dot, and
  both wingtip nav lights glow; the wing crosses the sky band as cream
  on amber instead of dark on bright. Measured on the final 1-cover.jpg
  (mean luminance): fin 115.9, fuselage 108.2, tail cone 92.8 — all
  above the sky band behind the plane (65.6) and the terrain below it
  (87.8). Composition unchanged: gold ring centred, aircraft centre.
- **No regression in the other three:** 2-cockpit — the cowling reads
  warmer at the bottom of the frame, dials/ring/lighthouse unchanged;
  3-coast — plane reads well against sea + green coast, hamlet/boats/
  pier intact; 4-landing — gear/flaps/runway edge lights/lighthouse
  intact, no light pool on the runway, fin + nav lights bright.
- **Determinism:** `MAKEFUN_OUTPUT_DIR=/tmp/senja-det1 node main.ts`
  twice (Node 24.22.1) → `diff -r` identical (DETERMINISM-OK).
  Dossier now 721,636 bytes (was 600,565 — the new screenshots are
  larger; all still under caps). game/ 790,263 bytes (cap 993 / 48 MiB).
- **Browser smoke test** (same script, same run): title visible → start
  → W held: speed 0 → 97 kt, altitude 13 → 39 ft (lifted), throttle
  100%, damage 0% → C toggles cockpit frame on → P pauses (toast
  "PAUSED — press P to resume"). **Zero console/page errors.**
  (This run's W-only hold lifted off without needing Up — the earlier
  round's note about needing Up to rotate still stands as the normal
  behaviour; the difference here is a longer hold at full throttle.)

### Scorecard delta (fix-round-1 after → this round)

| Category | Before | After | Evidence |
| --- | --- | --- | --- |
| Art direction | 2.5 | 2.5 | palette and dusk mood intact; the fill is warm golden-hour, no new hues |
| Hero/player | 2 | 2.5 | chase-view hero now separates: bright fin, warm fuselage, white beacon; measured luminance above sky and terrain |
| Lighting/render | 2 | 2.5 | dedicated warm hero fill + emissive tail lift; no ground pools, no wash-out |
| All other categories | — | unchanged | no other file touched |

**Average after: 2.3 — the 2.3 premium bar is now MET (was 2.2).** Every
category ≥ 2, zero automatic failures. Neither Hero/player nor
Lighting/render is scored a 3: the teal tail-cone underside and the dark
prop blades are still the darkest parts of the hero — a further pass
could rim those, but this round's single iteration already delivered the
goal, so it stops here per the brief.
