# CLAUDE.md

## Project

**R-TYPELIKE — Neon Drift**: a retro R-Type-style horizontal shoot-'em-up built in
**vanilla HTML5 Canvas + JavaScript with zero dependencies**. No build step, no npm,
no bundler. All sprites and sound effects are generated procedurally in JS (no binary
assets). UI text is in French.

## Running locally

The game must be served over HTTP (Chrome/Edge block `file://` script loading).

```bash
./lancer.sh          # macOS/Linux: starts serve.py on :8765 + opens browser
# or directly:
python3 serve.py 8765   # then open http://localhost:8765
```

`serve.py` is a tiny no-cache static server for local dev. On Windows, run
`python serve.py 8765` and open the URL. There is no lint and no build step —
edit a `.js` file and reload the browser.

## Deploying

The repo auto-deploys to GitHub Pages on every push to `main` (no CI workflow;
Pages builds the branch directly). GitHub Pages can't set custom cache headers,
so **run `./cache-bust.sh` before committing a deploy**. It stamps each
`js/*.js` and `style.css` reference in `index.html` with a `?v=<content-hash>`
query string, forcing browsers to re-fetch only the modules that changed. The
script is idempotent — re-running with no source changes leaves `index.html`
untouched. (Caveat: Pages also caches `index.html` itself for a few minutes,
which no client-side technique can shorten.)

## Testing

```bash
make test           # node --test tests/*.test.js  (Node's built-in runner, zero deps)
```

`tests/helpers/harness.js` loads every IIFE module into a Node `vm` sandbox with
stubbed Canvas / WebAudio / DOM, reproducing the browser's shared classic-script
scope. Tests can drive the loop (`step()`), advance the clock, and dispatch events.

**Always run `make test` before and after changes; keep it green** ("first run the
tests" — establish a passing baseline, then work red→green). When adding a gameplay
system, add a test asserting its global loads and its `update`/`draw` don't throw.

Tests cover logic only — they can't see pixels. For visual/UX changes, also do a
manual browser pass: `make dev`, then play through `title → play → boss → win`
(score ≥ 60000 reaches rank SS), checking the HUD, the secondary weapon, and that
nothing throws in the console.

## Architecture

`index.html` is the entry point. It defines the `<canvas id="game" width="800"
height="450">` plus overlay screens (title / game over / win / pause), then loads each
JS module via `<script>` tags **in dependency order** (`js/main.js` last).

Each file in `js/` is an **IIFE module** assigned to a global (e.g.
`const Game = (() => { ... return {...} })()`). Modules communicate through these
globals — there is no module system. Load order in `index.html` matters; a module may
reference globals defined by earlier scripts.

Globals and their roles:

| Global | File | Role |
|---|---|---|
| `FX` | `fx.js` | Screen shake, slow-motion `timescale`, pre/post draw passes |
| `Particles` | `particles.js` | Particle pool + rendering |
| `Audio` | `audio.js` | WebAudio music + `Audio.SFX.*` procedural sound effects |
| `Input` | `input.js` | Keyboard + Gamepad API; `Input.isDown`/`wasPressed`/`axis()`, `Input.poll()`, `Input.hasGamepad()`, `Input.endFrame()`; DS4 standard + raw profiles; debug via `?gpdebug` or `Input.debugGamepad()` |
| `Bullets` | `bullets.js` | Player + enemy bullet pools, `Bullets.update(dt, Player.state)` |
| `Background` | `background.js` | Parallax starfield / scrolling backdrop |
| `Player` | `player.js` | Ship, beam charge, Force Pod, bombs; `Player.state` holds score/lives/combo/bombs |
| `Enemies` | `enemies.js` | Enemy spawning, AI, rendering |
| `Boss` | `boss.js` | 3-phase final boss (BYDO PRIME); calls `Game.win()` |
| `Level1` | `level1.js` | Level script/timeline; `Level1.getTime()`, progress banner |
| `Game` | `main.js` | Game loop + state machine; boots everything |

### Game loop (`main.js`)

- State machine: `TITLE → PLAY → (GAMEOVER \| WIN \| PAUSE)`.
- `requestAnimationFrame` loop with `dt` clamped to `0.05` s.
- `FX.timescale()` scales the simulation `dt` for slow-motion (e.g. grazing bullets),
  while music ticks in **real** time.
- `startGame()` resets every module in order, then sets state to `PLAY`.
- Update order each frame: `Background → Level1 → Player → Enemies → Boss → Bullets →
  Particles → Player.checkBulletCollisions → FX`.
- Render order (back to front): `FX.preDraw → Background → Enemies → Boss → Bullets →
  Particles → Player → FX.postDraw → HUD → Level1 banner`.

## Conventions

- Internal resolution is fixed at **800×450** (`W`, `H` constants in `main.js`).
- New gameplay systems should follow the IIFE-module-as-global pattern, expose a
  `reset()` called from `Game.startGame()`, and an `update(dt)` / `draw(ctx)` pair
  wired into the loop in `main.js`. Add the `<script>` tag to `index.html` in the
  correct dependency position.
- Score thresholds drive end-of-game ranks (D / C / B / A / S / SS) in `main.js`.

## Notes

- `R-TYPELIKE/` (empty) and `R-TYPELIKE.zip` are leftover packaging artifacts, not
  source. The live source is the top-level `index.html`, `style.css`, and `js/`.
- This is a git repository (default branch `main`); commits follow Conventional
  Commits (`feat:`, `docs:`, `chore:`).
