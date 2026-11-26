# SENJA AIR — Dusk Courier

[![competition](https://img.shields.io/badge/make.fun-best--flight--game--20261126--0057-orange)](https://make.fun)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![offline](https://img.shields.io/badge/plays-offline-green)]()

A courier pilot flies the mail route between island airstrips at golden hour.
Three.js 3D, chase view + cockpit toggle, keyboard + mouse, desktop Chrome,
fully offline — every file the game loads lives under `game/`.

## The game

You are the mail pilot of the Senja islands. The sun is low, the sea is teal,
and the mail still has to fly. Three missions, one island, one flight model:

1. **Ring Run** — thread 8 glowing rings in order against the clock.
2. **Island Hop** — take off from Strip A and land soft on Strip B.
3. **Dusk Patrol** — rings plus fuel: an empty tank means gliding home.

Flying rewards discipline: throttle sets speed, speed governs turn rate and
lift, and below stall speed the nose drops and the wing stops answering.
Landings are scored — soft touchdown, on the runway, low vertical speed —
while a hard impact or terrain strike means damage, then a crash that reads
as a crash: tumble, smoke, "CRASHED — press R".

## Controls

| Key | Action |
| --- | --- |
| W / S | Throttle up / down |
| ↑ / ↓ | Pitch |
| ← / → | Roll (bank to turn) |
| A / D | Rudder |
| G | Flaps + gear (landing config) |
| C | Chase / cockpit camera |
| Mouse (hold + drag) | Look around |
| P | Pause |
| R | Restart |
| 1 / 2 / 3 | Pick a mission on the title screen |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/index.html` plus its ES modules and the
vendored Three.js build under `game/vendor/`. Screenshots are staged
deterministically with `?shot=cover|cockpit|coast|landing&seed=1`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` with the vendored make.fun
library. Run it twice and the two outputs are byte-identical.

## Files

- `game/index.html` — page, import map, HUD layout, title screen
- `game/src/main.js` — bootstrap, fixed-step loop, input, cameras, crash
- `game/src/flight.js` — arcade flight model (throttle, lift, stall, bank)
- `game/src/terrain.js` — island, runways, village, lighthouse, palms, rings
- `game/src/aircraft.js` — the courier plane (rounded primitives, livery)
- `game/src/sky.js` — golden-hour sky, sun, clouds, light rig
- `game/src/hud.js` — compass, tapes, gauges, warnings, title/end screens
- `game/src/audio.js` — procedural Web Audio (engine, wind, chimes)
- `game/src/missions.js` — three missions, ring course, landing scoring
- `game/src/shots.js` — deterministic `?shot=` screenshot staging
- `game/vendor/three.module.min.js` — Three.js r170, vendored
- `main.ts` / `serve.ts` / `vendor/makefun-game.ts` — hand-in + dev server

## License

MIT — see [LICENSE](LICENSE).
