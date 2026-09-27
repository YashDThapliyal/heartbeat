<img width="600" height="600" alt="heartbeat-explode-600" src="https://github.com/user-attachments/assets/d8ecd6ec-9386-423d-a134-244860b8e1d6" />

# Heartbeat — Inside a mechanical watch

A real-time 3D exhibit that explains how a hand-wound mechanical watch keeps time. One persistent React Three Fiber scene is scrubbed by scroll: the watch opens, the movement explodes, energy is followed from the mainspring through the gear train, the escapement is shown in slow motion, and everything reassembles.

Every part is generated procedurally. There are no model files, image assets, HDRs or network requests at runtime.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve the production bundle
npm test           # mechanics, timeline and layout invariants
```

With the dev server running, these browser checks use your installed Google Chrome through Playwright:

```sh
npm run smoke      # intro, tour, winding, ticking, scroll both ways, Explore, mobile
npm run shots      # screenshots along the story → ./shots
```

## Navigating

- The site opens on the watch alone. Drag it to turn it; scroll to begin.
- Press **Play the tour** (or **Space**) and the story plays itself in about 45 seconds, pausing at two hands-on moments. The bar at the bottom shows when it will move on; **Next** skips ahead. Scrolling, swiping or an arrow key hands control back to you.
- **Wind it yourself:** in the Store chapter, drag across the watch or hold *Hold to wind*.
- **Tick it yourself:** in the escapement close-up, tap the watch, press *Tick* or press **Space** to let exactly one beat through.
- **← / →** jump between chapters. The address bar follows along (`/#escapement`), so you can link to any chapter.
- **Explore** (top right): orbit, zoom, explode, and click a part or its label to fly to it.
- Sound (a synthesized tick) turns on with your first tap or the tour, unless you have switched it off.

## Sharing

`public/og.png` is the link-preview image (regenerate with `node tests/og.mjs` while the dev server runs). Set `VITE_SITE_URL` in `.env` to the deployed address before building so previews use an absolute image URL.

## The movement

An original, educational hand-wound Swiss-lever calibre (no commercial calibre is copied):

| Arbor | Wheel | Driven pinion | One turn every |
|---|---|---|---|
| Barrel | 80 | — | 8 h |
| Centre (minute hand) | 64 | 10 | 1 h |
| Third | 75 | 8 | 7½ min |
| Fourth (seconds hand) | 80 | 10 | 1 min |
| Escape | 15 club teeth | 8 | 6 s |

- The balance runs at 2.5 Hz: 5 beats per second, 18,000 per hour.
- Every wheel sits exactly one pitch distance from the pinion it drives. Meshing arbors counter-rotate at matching pitch-line speed, and tooth phases keep a tooth opposite a gap on every line of centres.
- The escapement is kinematic, driven by one phase: θ = A·cos(ωt). The impulse pin drives the fork only inside the lift angle, and the fork ratio equals roller radius ÷ fork length. Stone travel sets when the wheel unlocks. The wheel then slides along the impulse face, drops, and locks, advancing exactly half a tooth per beat. It is stationary whenever the fork is banked.
- The hands ride the train: minutes on the centre arbor, small seconds on the fourth arbor, hours through 12:1 motion works. They start at your local time.
- There are 17 jewels: 2 each for the centre, third, fourth, escape and pallet arbors, 2 hole and 2 cap jewels for the balance, 2 pallet stones and the impulse jewel.
- A full wind is 6 barrel turns (21 crown turns), about 48 h of power reserve.

The springs are deterministic visual models, not elastic simulations. Two educational liberties are shown on screen. In the gear-train chapter, time runs faster (×1200 → ×1) so each wheel turns at a readable speed. In the escapement close-up, time runs at about ×0.07 and slows further at each release. When beats are far too fast to see during a time-lapse, the escape wheel is drawn with its average motion and the balance with a capped swing, so they don't alias.

## Structure

```
src/
  movement/    config (tooth counts, derived layout), simulation (pure mechanics),
               layout (bridges, jewels), catalog (part descriptions), materials, textures
  geometry/    wheels & escape wheel, SDF outline tracer, springs, turned parts, case
  animation/   chapters & copy, keyframe tracks, story timeline, emphasis rules, store
  components/  Scene, Watch, Movement, Part, Mechanics, Escapement, Barrel, Structure,
               Exterior, MechanismGuide, labels, story overlay, readouts, Explore controls
  hooks/       scroll progress, reduced motion, animation loop, tick sound
tests/         node:test suites (+ Playwright scripts for visual/interaction checks)
```

The two kinds of state are kept separate. **Story state** (camera, explosion, focus, labels, time scale) is a pure function of scroll progress, so scrolling backward replays everything exactly. **Mechanical state** is a pure function of simulation time. The story only decides how fast that time runs.

## Accessibility and fallbacks

- `prefers-reduced-motion` removes idle drift, shortens smoothing and reduces explosion travel.
- If WebGL is unavailable, a text explanation of the whole mechanism is shown instead.
- The chapter rail, Explore controls and component index are keyboard accessible. **Escape** leaves Explore.
- Sound (a synthesized tick at each lock) is off until you turn it on.
- Quality adapts automatically: on slow devices, post-processing and shadows are dropped and the pixel ratio is capped.
