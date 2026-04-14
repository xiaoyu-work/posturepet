# EvenPet

A virtual pet app for [Even Realities G2](https://www.evenrealities.com/) smart glasses. An outline-art creature swims, floats, or flutters across the glasses display — no menus, no stats, just a little companion living in your lens.

## Pets

| Pet | Style | Movement |
|-----|-------|----------|
| 🐟 Fish | Outline body + forked tail + dorsal fin | Smooth Lissajous curves, bubbles trail behind |
| 🪼 Jellyfish | Dome bell + wavy tentacles | Gentle vertical drift |
| 🐢 Turtle | Oval shell + paddling flippers | Slow horizontal cruise |
| 🦋 Butterfly | Flapping wing pairs + antennae | Fluttery, erratic path |

All pets share the same line-art style — thin outlines on a pure black background, rendered as greyscale so the G2's green micro-LED display shows them as glowing green silhouettes.

## Controls

| Input | Action |
|-------|--------|
| Single tap (temple / ring) | Toggle pet visibility (wake / hide) |
| Double tap | Exit app (G2 shutdown dialogue) |
| Browser settings page | Select pet type |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (includes `npm`)

### Install the Even Hub Simulator

The simulator is a standalone desktop app that emulates the G2 glasses display. Install it globally via npm:

```bash
npm install -g @evenrealities/evenhub-simulator
```

Verify it installed:

```bash
evenhub-simulator --version   # should print 0.7.1 or later
```

No other tools are needed — the SDK (`@evenrealities/even_hub_sdk`) is a project dependency and gets installed automatically with `npm install`.

## Running locally

1. Install project dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. In a **second terminal**, launch the simulator pointing at the dev server:

```bash
evenhub-simulator http://127.0.0.1:5173
```

The simulator opens two windows (one per lens — the G2 has dual displays). You should see the pet swimming on both.

> **Tip:** You can also just open `http://localhost:5173` in a regular browser for the preview UI — no glasses or simulator required. The browser page includes a pet picker and toggle button for testing.

## Building

```bash
npm run build
```

Output goes to `dist/`.

## Project structure

```
src/
  main.ts              App shell, event loop, bridge init
  styles.css           Browser preview styles
  app/
    pixel-cat.ts       Pet renderer (all 4 animals + scene segmentation)
    g2-ui.ts           G2 glasses container layout (3 image + 1 input)
    input.ts           Event normalization (click / double-click)
    preview.ts         Browser settings page (pet picker + canvas preview)
    bridge.ts          SDK bridge initialization with timeout fallback
    types.ts           Shared types (PetType, PreviewRenderModel)
```

## G2 display layout

The glasses screen is 576×288 pixels. Due to simulator constraints (max 4 containers, image containers ≤ 200×100), the scene is rendered as three 180×100 image strips centered vertically, plus one invisible text container for touch input capture.

```
┌──────────────────────────────────────────┐
│                                          │  ← empty (above image band)
│  ┌──────────┬──────────┬──────────┐      │
│  │ image 1  │ image 2  │ image 3  │      │  ← 540×100 scene area
│  │ 180×100  │ 180×100  │ 180×100  │      │
│  └──────────┴──────────┴──────────┘      │
│                                          │  ← empty (below image band)
└──────────────────────────────────────────┘
  576×288 G2 display
```

## Tech

- [Even Hub SDK](https://www.npmjs.com/package/@evenrealities/even_hub_sdk) `0.0.10`
- [Vite](https://vite.dev/) + TypeScript
- Canvas 2D for all rendering (no sprite sheets, no frameworks)

## License

MIT
