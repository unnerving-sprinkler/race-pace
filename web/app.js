"use strict";

const DEFAULT_DISTANCE = 26.2;
let raceDistance = DEFAULT_DISTANCE;

// Pure math comes from calc.js (also unit-tested in Node).
const { parseToMinutes, fmtPace, fmtDuration, paceToMph, planRest } = Calc;
const paceToFinish = (paceMin) => Calc.paceToFinish(paceMin, raceDistance);
const finishToPace = (finishMin) => Calc.finishToPace(finishMin, raceDistance);

// Read a CSS custom property off <body> (so it respects the active theme).
function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/* ----------------------- time-input auto-colon ----------------------- */
// Mobile numeric keypads have no ":" key, so on the time fields we let users
// type digits and insert the colons for them, grouping from the right:
//   "330" -> "3:30"  (maxGroups 2, pace)   "33000" -> "3:30:00" (maxGroups 3).
// A "." means the user is entering decimal minutes (e.g. "8.5"), which
// parseToMinutes still accepts — leave those untouched. Already-colon'd values
// reformat to themselves (idempotent), so programmatic syncs are unaffected.
function groupClock(value, maxGroups) {
  if (value.includes(".")) return value;
  let digits = value.replace(/\D/g, "");
  if (digits === "") return "";
  digits = digits.slice(0, maxGroups * 2); // ignore overflow digits
  const groups = [];
  let i = digits.length;
  while (i > 0 && groups.length < maxGroups - 1) {
    groups.unshift(digits.slice(Math.max(0, i - 2), i));
    i -= 2;
  }
  if (i > 0) groups.unshift(digits.slice(0, i)); // leftmost holds the remainder
  return groups.join(":");
}

// Registered BEFORE each field's value-reading listener so they see the colons.
function attachClock(el, maxGroups) {
  el.addEventListener("input", () => {
    const formatted = groupClock(el.value, maxGroups);
    if (formatted !== el.value) {
      el.value = formatted;
      // Caret to end: these fields are short and typed left-to-right.
      el.setSelectionRange(formatted.length, formatted.length);
    }
  });
}

/* ----------------------------- tabs ----------------------------- */

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (chart) chart.resize();
  });
});

/* ----------------------- shared: race distance ----------------------- */

const distInput = document.getElementById("distInput");

function readDistance() {
  const d = Number(distInput.value);
  return isFinite(d) && d > 0 ? d : NaN;
}

distInput.addEventListener("input", () => {
  const d = readDistance();
  const valid = isFinite(d);
  distInput.classList.toggle("invalid", distInput.value.trim() !== "" && !valid);
  if (!valid) return;
  raceDistance = d;
  refreshChart();
  // Keep pace fixed, recompute finish time off the new distance.
  if (paceInput.value.trim() !== "") {
    paceInput.dispatchEvent(new Event("input"));
  } else if (timeInput.value.trim() !== "") {
    timeInput.dispatchEvent(new Event("input"));
  }
  computeRest();
});

/* ----------------------- Tab 1: converter ----------------------- */

const paceInput = document.getElementById("paceInput");
const timeInput = document.getElementById("timeInput");
const readPace = document.getElementById("readPace");
const readTime = document.getElementById("readTime");
const readSpeed = document.getElementById("readSpeed");

function updateReadout(paceMin) {
  if (isFinite(paceMin) && paceMin > 0) {
    readPace.textContent = `${fmtPace(paceMin)} /mi`;
    readTime.textContent = fmtDuration(paceToFinish(paceMin));
    readSpeed.textContent = `${paceToMph(paceMin).toFixed(2)} mph`;
  } else {
    readPace.textContent = "—";
    readTime.textContent = "—";
    readSpeed.textContent = "—";
  }
}

let syncing = false;

// Auto-insert colons as digits are typed (must run before the readers below).
attachClock(paceInput, 2); // m:ss
attachClock(timeInput, 3); // h:mm:ss

paceInput.addEventListener("input", () => {
  if (syncing) return;
  const paceMin = parseToMinutes(paceInput.value);
  const valid = isFinite(paceMin) && paceMin > 0;
  paceInput.classList.toggle("invalid", paceInput.value.trim() !== "" && !valid);
  if (valid) {
    syncing = true;
    timeInput.value = fmtDuration(paceToFinish(paceMin));
    timeInput.classList.remove("invalid");
    syncing = false;
  }
  updateReadout(paceMin);
});

timeInput.addEventListener("input", () => {
  if (syncing) return;
  const finishMin = parseToMinutes(timeInput.value);
  const valid = isFinite(finishMin) && finishMin > 0;
  timeInput.classList.toggle("invalid", timeInput.value.trim() !== "" && !valid);
  if (valid) {
    const paceMin = finishToPace(finishMin);
    syncing = true;
    paceInput.value = fmtPace(paceMin);
    paceInput.classList.remove("invalid");
    syncing = false;
    updateReadout(paceMin);
  } else {
    updateReadout(NaN);
  }
});

/* ----------------------- Tab 1: chart ----------------------- */

// Pace range to plot (min/mile).
const PACE_MIN = 5;
const PACE_MAX = 13;
const STEP = 1 / 60; // 1 second per step

function buildPoints() {
  const pts = [];
  for (let p = PACE_MIN; p <= PACE_MAX + 1e-9; p += STEP) {
    pts.push({ x: +p.toFixed(4), y: +(paceToFinish(p) / 60).toFixed(6) }); // y in hours
  }
  return pts;
}
let points = buildPoints();

const hoverReadout = document.getElementById("hoverReadout");

// Plugin: draw a crosshair at the hovered position.
const crosshairPlugin = {
  id: "crosshair",
  afterDraw(c) {
    const active = c.tooltip?.getActiveElements?.();
    if (!active || active.length === 0) return;
    const { ctx, chartArea } = c;
    const pt = active[0].element;
    ctx.save();
    ctx.strokeStyle = cssVar("--accent") || "rgba(76, 201, 240, 0.5)";
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); // vertical
    ctx.moveTo(pt.x, chartArea.top);
    ctx.lineTo(pt.x, chartArea.bottom);
    ctx.stroke();
    ctx.beginPath(); // horizontal
    ctx.moveTo(chartArea.left, pt.y);
    ctx.lineTo(chartArea.right, pt.y);
    ctx.stroke();
    ctx.restore();
  },
};

let chart;
const ctx = document.getElementById("paceChart");

chart = new Chart(ctx, {
  type: "line",
  data: {
    datasets: [
      {
        label: "Finish time",
        data: points,
        borderColor: cssVar("--accent") || "#4cc9f0",
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0,
        fill: false,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    interaction: { mode: "index", intersect: false },
    onHover: (e, elements) => {
      if (elements.length) {
        const d = points[elements[0].index];
        hoverReadout.textContent = `${fmtPace(d.x)} /mi  →  ${fmtDuration(d.y * 60)}`;
      }
    },
    scales: {
      x: {
        type: "linear",
        min: PACE_MIN,
        max: PACE_MAX,
        title: { display: true, text: "Pace (min / mile)" },
        ticks: { callback: (v) => fmtPace(v), stepSize: 1 },
      },
      y: {
        title: { display: true, text: "Finish time (h:mm:ss)" },
        ticks: { callback: (v) => fmtDuration(v * 60) },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) => `Pace ${fmtPace(items[0].parsed.x)} /mi`,
          label: (item) => `Finish ${fmtDuration(item.parsed.y * 60)}`,
        },
      },
    },
  },
  plugins: [crosshairPlugin],
});

function refreshChart() {
  points = buildPoints();
  chart.data.datasets[0].data = points;
  chart.update("none");
}

// Recolor chart elements from the active theme's CSS variables.
function applyChartTheme() {
  if (!chart) return;
  const muted = cssVar("--muted");
  const border = cssVar("--border");
  chart.data.datasets[0].borderColor = cssVar("--accent");
  for (const axis of ["x", "y"]) {
    chart.options.scales[axis].title.color = muted;
    chart.options.scales[axis].ticks.color = muted;
    chart.options.scales[axis].grid = { color: border };
  }
  chart.update("none");
}
applyChartTheme();

// Fix: browser zoom changes devicePixelRatio without firing a normal resize,
// leaving the cursor/crosshair offset. Re-resize whenever the DPR changes.
function watchDevicePixelRatio() {
  const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener(
    "change",
    () => {
      if (chart) chart.resize();
      watchDevicePixelRatio(); // re-arm; the old query is now stale
    },
    { once: true }
  );
}
watchDevicePixelRatio();

/* ----------------------- Tab 2: planner ----------------------- */

const doneDist = document.getElementById("doneDist");
const donePace = document.getElementById("donePace");
const doneElapsed = document.getElementById("doneElapsed");
const goalTime = document.getElementById("goalTime");
const paceField = document.getElementById("paceField");
const elapsedField = document.getElementById("elapsedField");

const restResult = document.getElementById("restResult");
const restTable = document.getElementById("restTable");

document.querySelectorAll('input[name="mode"]').forEach((r) => {
  r.addEventListener("change", () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    paceField.classList.toggle("hidden", mode !== "pace");
    elapsedField.classList.toggle("hidden", mode !== "elapsed");
    computeRest();
  });
});

// Auto-insert colons on the time fields (doneDist is a real decimal, so skip it).
attachClock(donePace, 2); // m:ss
attachClock(doneElapsed, 3); // h:mm:ss
attachClock(goalTime, 3); // h:mm:ss

[doneDist, donePace, doneElapsed, goalTime].forEach((el) =>
  el.addEventListener("input", computeRest)
);

function setResult(text, cls) {
  restResult.textContent = text;
  restResult.className = "big-result" + (cls ? " " + cls : "");
}

function computeRest() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const dDone = Number(doneDist.value);
  const goalMin = parseToMinutes(goalTime.value);

  // Validate distance against the (configurable) race distance.
  if (!(dDone >= 0) || dDone >= raceDistance) {
    restTable.hidden = true;
    setResult(
      doneDist.value.trim() === ""
        ? "Fill in the fields to see your required pace."
        : `Distance must be between 0 and ${raceDistance} miles.`,
      doneDist.value.trim() === "" ? "muted" : "bad"
    );
    return;
  }

  // Elapsed time so far.
  let usedMin;
  if (mode === "pace") {
    const pace = parseToMinutes(donePace.value);
    if (!isFinite(pace) || pace <= 0) {
      restTable.hidden = true;
      setResult("Enter your current average pace.", "muted");
      return;
    }
    usedMin = pace * dDone;
  } else {
    usedMin = parseToMinutes(doneElapsed.value);
    if (!isFinite(usedMin) || usedMin < 0) {
      restTable.hidden = true;
      setResult("Enter your elapsed time so far.", "muted");
      return;
    }
  }

  if (!isFinite(goalMin) || goalMin <= 0) {
    restTable.hidden = true;
    setResult("Enter your goal finish time.", "muted");
    return;
  }

  const { remainDist, leftMin, paceSoFar, projFinish, reqPace } = planRest({
    distance: raceDistance,
    doneDist: dDone,
    usedMin,
    goalMin,
  });

  // Fill table.
  document.getElementById("rDone").textContent = `${dDone.toFixed(2)} mi`;
  document.getElementById("rRemain").textContent = `${remainDist.toFixed(2)} mi`;
  document.getElementById("rUsed").textContent = fmtDuration(usedMin);
  document.getElementById("rLeft").textContent = fmtDuration(leftMin);
  document.getElementById("rSoFar").textContent = isFinite(paceSoFar)
    ? `${fmtPace(paceSoFar)} /mi`
    : "—";
  document.getElementById("rProj").textContent = isFinite(projFinish)
    ? fmtDuration(projFinish)
    : "—";
  restTable.hidden = false;

  if (leftMin <= 0) {
    document.getElementById("rPace").textContent = "—";
    setResult("Goal time already passed — not reachable.", "bad");
    return;
  }

  document.getElementById("rPace").textContent = `${fmtPace(reqPace)} /mi`;
  const easier = reqPace >= paceSoFar;
  setResult(
    `${fmtPace(reqPace)} /mi for the last ${remainDist.toFixed(2)} mi`,
    easier ? "good" : "bad"
  );
}

/* ----------------------- theme toggle ----------------------- */

const themeSelect = document.getElementById("themeSelect");
const appTitle = document.getElementById("appTitle");
const appSubtitle = document.getElementById("appSubtitle");

// Add a theme by appending an entry here — the dropdown and styling pick it up
// automatically. `bodyClass` is the CSS class toggled on <body> (empty = none).
const THEMES = {
  dark: {
    label: "🌙 Dark",
    bodyClass: "",
    title: "🏃 Race Pace Calculator",
    subtitle: "Any distance &middot; pace in minutes / mile",
  },
  light: {
    label: "☀️ Light",
    bodyClass: "theme-light",
    title: "🏃 Race Pace Calculator",
    subtitle: "Any distance &middot; pace in minutes / mile",
  },
};

// Legacy localStorage values from older builds.
const THEME_ALIASES = { default: "dark", grandmas: "dark", pasta: "dark" };

function applyTheme(name) {
  name = THEME_ALIASES[name] || name;
  if (!THEMES[name]) name = "dark";

  // Clear every theme's body class, then apply the chosen one.
  for (const key in THEMES) {
    if (THEMES[key].bodyClass) document.body.classList.remove(THEMES[key].bodyClass);
  }
  const t = THEMES[name];
  if (t.bodyClass) document.body.classList.add(t.bodyClass);

  appTitle.textContent = t.title;
  appSubtitle.innerHTML = t.subtitle;
  themeSelect.value = name;
  try {
    localStorage.setItem("mp-theme", name);
  } catch (e) {
    /* ignore */
  }
  applyChartTheme();
}

// Populate the dropdown from THEMES.
for (const [key, t] of Object.entries(THEMES)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = t.label;
  themeSelect.appendChild(opt);
}
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));

// Saved choice wins; otherwise follow the OS color-scheme preference.
let savedTheme = null;
try {
  savedTheme = localStorage.getItem("mp-theme");
} catch (e) {
  /* ignore */
}
if (!savedTheme) {
  savedTheme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
applyTheme(savedTheme);

/* ----------------------- defaults ----------------------- */
// Seed tab 1 with a common goal so the page isn't empty on load.
timeInput.value = "3:30:00";
timeInput.dispatchEvent(new Event("input"));
