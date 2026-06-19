"use strict";

// Unit tests for the pure pace/time math (web/calc.js).
// Run: node test/calc.test.js
const assert = require("assert");
const Calc = require("../web/calc.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}
// Compare floats within tolerance.
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

console.log("parseToMinutes");
test("mm:ss", () => close(Calc.parseToMinutes("8:00"), 8));
test("mm:ss with seconds", () => close(Calc.parseToMinutes("7:30"), 7.5));
test("hh:mm:ss", () => close(Calc.parseToMinutes("3:30:00"), 210));
test("hh:mm:ss with seconds", () => close(Calc.parseToMinutes("1:48:30"), 108.5));
test("decimal minutes", () => close(Calc.parseToMinutes("8.5"), 8.5));
test("blank is NaN", () => assert.ok(Number.isNaN(Calc.parseToMinutes(""))));
test("garbage is NaN", () => assert.ok(Number.isNaN(Calc.parseToMinutes("abc"))));
test("bad segment is NaN", () => assert.ok(Number.isNaN(Calc.parseToMinutes("8:xx"))));

console.log("fmtPace / fmtDuration");
test("fmtPace rounds to seconds", () => assert.strictEqual(Calc.fmtPace(8.5), "8:30"));
test("fmtPace pads seconds", () => assert.strictEqual(Calc.fmtPace(8 + 5 / 60), "8:05"));
test("fmtPace invalid", () => assert.strictEqual(Calc.fmtPace(0), "—"));
test("fmtDuration h:mm:ss", () => assert.strictEqual(Calc.fmtDuration(210), "3:30:00"));
test("fmtDuration pads", () => assert.strictEqual(Calc.fmtDuration(65), "1:05:00"));
test("fmtDuration negative", () => assert.strictEqual(Calc.fmtDuration(-5), "—"));

console.log("paceToFinish / finishToPace (configurable distance)");
test("8:00 over 26.2 = 3:29:36", () =>
  assert.strictEqual(Calc.fmtDuration(Calc.paceToFinish(8, 26.2)), "3:29:36"));
test("long course 26.4 is slower finish", () => {
  const f262 = Calc.paceToFinish(8, 26.2);
  const f264 = Calc.paceToFinish(8, 26.4);
  assert.ok(f264 > f262, "26.4 should take longer than 26.2 at same pace");
  close(f264, 8 * 26.4);
});
test("round trip pace->finish->pace", () => {
  const dist = 26.4;
  const finish = Calc.paceToFinish(8.2, dist);
  close(Calc.finishToPace(finish, dist), 8.2);
});
test("finishToPace 3:30 over 26.2", () =>
  assert.strictEqual(Calc.fmtPace(Calc.finishToPace(210, 26.2)), "8:01"));
test("finishToPace adjusts for long course", () => {
  // Same goal time, longer course => faster required pace.
  const p262 = Calc.finishToPace(210, 26.2);
  const p264 = Calc.finishToPace(210, 26.4);
  assert.ok(p264 < p262, "longer course needs faster pace for same time");
});

console.log("paceToMph");
test("6:00/mi = 10 mph", () => close(Calc.paceToMph(6), 10));

console.log("planRest (negative-split planner)");
test("half done, on pace", () => {
  // 13.1 done at 8:00, goal 3:30:00 over 26.2.
  const r = Calc.planRest({ distance: 26.2, doneDist: 13.1, usedMin: 8 * 13.1, goalMin: 210 });
  close(r.remainDist, 13.1);
  close(r.leftMin, 210 - 8 * 13.1);
  close(r.paceSoFar, 8);
  assert.strictEqual(Calc.fmtPace(r.reqPace), "8:02"); // need slightly slower to hit 3:30
});
test("uses configurable distance", () => {
  const r = Calc.planRest({ distance: 26.4, doneDist: 13.1, usedMin: 8 * 13.1, goalMin: 210 });
  close(r.remainDist, 26.4 - 13.1);
});
test("goal already passed => reqPace NaN", () => {
  const r = Calc.planRest({ distance: 26.2, doneDist: 20, usedMin: 200, goalMin: 180 });
  assert.ok(r.leftMin < 0);
  assert.ok(Number.isNaN(r.reqPace));
});
test("nothing run yet => paceSoFar NaN, reqPace finite", () => {
  const r = Calc.planRest({ distance: 26.2, doneDist: 0, usedMin: 0, goalMin: 210 });
  assert.ok(Number.isNaN(r.paceSoFar));
  close(r.reqPace, 210 / 26.2);
});

console.log(`\nAll ${passed} tests passed ✅`);
