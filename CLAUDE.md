# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, client-side web app for running pace math over any race distance
(defaults to 26.2 mi). There is no backend and no build step — nginx serves the
files in `web/` as-is. All computation happens in the browser; Chart.js is
vendored at `web/vendor/chart.umd.min.js` (no runtime CDN).

## Commands

```bash
# Run the app (http://localhost:8080). web/ is mounted read-only, so HTML/CSS/JS
# edits show on browser refresh with no rebuild. Override the host port with PORT
# (e.g. PORT=9000 docker compose up) or a .env file; container always listens on 80.
docker compose up --build

# Stop
docker compose down

# Run the unit tests (pure math only)
node test/calc.test.js
# or without local Node:
docker run --rm -v "$PWD":/app -w /app node:20-alpine node test/calc.test.js
```

There is no lint step and the test runner is hand-rolled (a `test()` helper in
`test/calc.test.js`, not a framework). To run a single test, comment out the
others or temporarily edit the file — there is no test filter.

## Architecture

The deliberate split is **pure math vs. DOM wiring**, so the math can be shared
between the shipped app and Node tests:

- `web/calc.js` — all pace/time math, **no DOM**. Uses a UMD wrapper so the same
  file exports via `module.exports` in Node *and* attaches to `window.Calc` in
  the browser. This is the single source of truth tested by `test/calc.test.js`.
- `web/app.js` — all DOM wiring, the Chart.js chart, tab switching, and the theme
  toggle. Imports the math from the global `Calc`. **Distance lives here**:
  `calc.js` takes `distance` as a parameter on every function, while `app.js`
  holds the mutable `raceDistance` and wraps `paceToFinish`/`finishToPace` to
  bind it. When changing math signatures, keep both the `Calc.*` calls in
  `app.js` and the tests in sync.

Key conventions and non-obvious details:

- **Time parsing is overloaded.** `parseToMinutes` accepts `mm:ss`, `hh:mm:ss`,
  and decimal minutes (`8.5`), always returning minutes. `fmtPace` formats as
  `m:ss` (per mile); `fmtDuration` formats as `h:mm:ss`. Invalid/empty inputs
  return `NaN` from parsers and `"—"` from formatters — UI code relies on this.
- **Two-way input sync** (Tab 1) uses a module-level `syncing` flag in `app.js`
  to prevent the pace↔time `input` listeners from re-triggering each other.
- **Configurable race distance** defaults to 26.2 but is user-editable (courses
  run long, e.g. 26.4). Changing it must re-fire the active Tab-1 input and call
  `computeRest()` so both tabs and the chart stay live — see the `distInput`
  handler.
- **Chart** plots pace (x, 5–13 min/mi at 1-second resolution) vs. finish time
  (y, stored in *hours*, formatted back to h:mm:ss on the axis). A custom
  `crosshairPlugin` draws the cursor crosshair. `watchDevicePixelRatio()` works
  around browser zoom not firing a resize, which would otherwise offset the
  crosshair.
- **Theming** is CSS-variable driven and selected via the **Theme** dropdown
  (top-right `#themeSelect`, populated from the `THEMES` map in `app.js`). To add
  a theme, add an entry to `THEMES` (`label`, `bodyClass`, `title`, `subtitle`)
  and a matching `body.<bodyClass>` block in `style.css` — the dropdown and
  `applyTheme()` pick it up automatically. `applyTheme()` swaps the body class,
  persists to `localStorage` (`mp-theme`), and calls `applyChartTheme()`, which
  re-reads the active theme's CSS vars (`--accent`, `--muted`, `--border`) into
  the chart. Any new chart styling should pull from `cssVar()` rather than
  hardcoding colors so every theme works.
