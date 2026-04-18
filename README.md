# EvenPet · Posture Pet 🐢

A virtual pet for the [Even Realities G2](https://www.evenrealities.com/) smart glasses that **lives and dies by your posture**.

Slouch → your pet starts losing HP. Keep slouching → it faints. Straighten up → it recovers. The glasses you're wearing *are* the sensor: the G2's built-in IMU lets us measure your head tilt in real time without adding any hardware.

> Built for the Even Realities developer hackathon.

---

## What it does

- **A pet on your HUD** — a little outline creature lives in your glasses display.
- **Head-pitch monitoring** — the on-device accelerometer tracks how far forward you're leaning your head.
- **HP that mirrors your spine** — 10-segment HP bar drains while you slouch, recovers when you sit up.
- **Pet faints when HP hits 0** — the creature swaps to a skull until your posture recovers.
- **On-lens toast** — a `SIT UP!` reminder flashes directly on the glasses when it matters.
- **Daily dashboard** — the browser settings page shows a live X/Y/Z chart, slouch history, and HP timeline.

All the posture logic runs locally — no cloud, no account.

---

## How it works

```
 G2 eyewear IMU
   │  accelerometer x, y, z (g units, ~10 Hz)
   ▼
 WebView (your phone's Even App)
   │  @evenrealities/even_hub_sdk bridge
   ▼
 PostureEstimator        — adaptive neutral-gravity baseline + EMA smoothing → deviation angle
 PostureStateMachine     — healthy / alert / unwell / sick / asleep, with hysteresis
 Vitals (HP)             — drains while head is unwell, regenerates when healthy
 PetRenderer + Overlay   — draw pet, HP bar, and SIT UP! toast into G2 containers
```

Because the neutral baseline is captured live from the first seconds of wear, the detection is **axis-agnostic** — it works regardless of how the IMU is physically mounted in the frame.

---

## Running locally

```bash
npm install
npm run dev
```

- **Browser preview** — open http://localhost:5173 (pet, HP bar, chart, and posture log all work without hardware using simulated IMU)
- **G2 simulator** — `npm install -g @evenrealities/evenhub-simulator && evenhub-simulator http://127.0.0.1:5173`
- **Real glasses** — see [`DEVICE_DEBUGGING.md`](./DEVICE_DEBUGGING.md) for the cloudflared + QR sideload flow

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (browser preview + on-device) |
| `npm run build` | Production build → `dist/` |
| `npm run typecheck` | Strict TS type check |
| `npm run lint` / `format:check` | ESLint / Prettier |
| `npm test` | Vitest |

---

## Repository layout

```
src/
  main.ts                    App entry, SDK bridge wiring, IMU subscription
  imu-debug.ts / .css / .html  Standalone /imu-debug.html data-collection page
  posture/
    estimator.ts             Adaptive baseline + EMA + deviation angle
    state.ts                 5-state posture state machine
    mood.ts                  Pet HP / MP model driven by posture
    types.ts                 Shared types
  app/
    renderer.ts              Canvas-2D scene (pet, movement)
    pets/                    Draw functions (fish, jellyfish, turtle, butterfly, skull)
    overlay.ts               HP bar + on-lens toast renderer
    dashboard.ts             Browser-page stats + history chart
    logbus.ts                Simple event log bus shared between pages
    preview.ts               Browser settings page
    g2-ui.ts                 G2 container layout (3 image + 1 text input)
    input.ts                 Tap / double-tap event normalization
    bridge.ts                SDK bridge with graceful browser-only fallback
    petStorage.ts            localStorage for selected pet
    qr.ts                    On-page QR helper for device pairing
vite-imu-log-plugin.ts       Dev-only: prints LAN URL + /api/imu-log collector
```

## G2 display layout

The glasses screen is 576×288 monochrome. The scene uses three 180×100 image containers side-by-side plus one invisible text container for touch input capture.

---

## Tech

- [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) `0.0.10`
- Vite + TypeScript (strict) + Vitest
- Canvas 2D — no frameworks, no sprite sheets

## Design notes

- **x / y / z are accelerometer in g** (not gyro, not Euler). Verified empirically at ~10 Hz with `ImuReportPace.P100`. `ROADMAP.md` has the long-form spike analysis.
- **The neutral baseline is relearned every wear-on**, so the same code works whether the frame is tilted on your face, the IMU was mounted 90° off, or whatever.
- **HP model deliberately harsh** (10%/s drain at `unwell`) so the demo is legible in 10 seconds.

## License

MIT
