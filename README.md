# Race Pace Calculator

A small web app for working with running paces (minutes / mile) over any race
distance. Defaults to 26.2 mi, but works for a 5K, 10K, half, ultra, or a course
that runs long.

## Features

**Configurable distance** — the race distance defaults to 26.2 mi but is
editable (set it to your race, or bump it up if your course runs long, e.g.
26.4). Changing it updates both tabs and the graph live.

**Tab 1 — Pace ↔ Finish Time**
- Type a pace (`8:00`, `8.5`, etc.) or a finish time (`3:30:00`) and the other
  value updates instantly.
- Interactive graph of pace vs. finish time, granular to 1 second of pace. Move
  the cursor over the chart to read off any pace / finish-time pair with a
  crosshair (correct even when the browser is zoomed).

**Themes** — a **Theme** dropdown in the top right reskins the whole app (and the
chart). Includes 🍝 Grandma's Pasta, a red-checkered-tablecloth trattoria look.
Choice is remembered, and more themes can be added later.

**Tab 2 — Negative Split Planner**
- Enter how far you've run, your current pace *or* elapsed time, and a goal
  finish time.
- Get the pace you'd need to run the remaining distance to hit your goal, plus
  your projected finish if you hold your current pace.

All math runs in the browser; nginx just serves the static files.

## Run it

Requires Docker + Docker Compose.

```bash
docker compose up --build
```

Then open <http://localhost:8080>.

To serve on a different port, set `PORT` (the container always listens on 80):

```bash
PORT=9000 docker compose up --build      # then open http://localhost:9000
```

Or copy `.env.example` to `.env` and set `PORT` there.

Stop with `Ctrl-C`, or `docker compose down`.

> The `web/` directory is mounted into the container, so you can edit the
> HTML/CSS/JS and just refresh the browser — no rebuild needed.

## Tests

The pace/time math lives in `web/calc.js` (no DOM) and is unit-tested:

```bash
# with Node installed locally:
node test/calc.test.js

# or via Docker (no local Node needed):
docker run --rm -v "$PWD":/app -w /app node:20-alpine node test/calc.test.js
```

## Layout

```
.
├── docker-compose.yml
├── Dockerfile
├── nginx.conf
├── test/
│   └── calc.test.js             # unit tests for the math
└── web/
    ├── index.html
    ├── style.css
    ├── calc.js                  # pure math, shared by app + tests
    ├── app.js                   # DOM wiring, chart, theme
    └── vendor/chart.umd.min.js  # Chart.js (vendored, no CDN at runtime)
```
