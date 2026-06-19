// Pure pace/time math — no DOM. Usable in the browser (window.Calc) and in
// Node (module.exports) so the same code is unit-tested and shipped.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Calc = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Parse a time-ish string into total minutes.
  // Accepts: "8:00" (mm:ss), "1:30:00" (hh:mm:ss), "8.5" (decimal minutes), "90".
  function parseToMinutes(str) {
    if (str == null) return NaN;
    str = String(str).trim();
    if (str === "") return NaN;

    if (str.includes(":")) {
      const parts = str.split(":").map((p) => p.trim());
      if (parts.some((p) => p === "" || isNaN(Number(p)))) return NaN;
      const nums = parts.map(Number);
      if (nums.length === 2) return nums[0] + nums[1] / 60; // mm:ss
      if (nums.length === 3) return nums[0] * 60 + nums[1] + nums[2] / 60; // hh:mm:ss
      return NaN;
    }

    const v = Number(str);
    return isNaN(v) ? NaN : v; // decimal minutes
  }

  // Format minutes as pace "m:ss" (per mile).
  function fmtPace(minutes) {
    if (!isFinite(minutes) || minutes <= 0) return "—";
    const totalSec = Math.round(minutes * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // Format minutes as duration "h:mm:ss".
  function fmtDuration(minutes) {
    if (!isFinite(minutes) || minutes < 0) return "—";
    const totalSec = Math.round(minutes * 60);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // distance is in miles (configurable — courses sometimes run long).
  function paceToFinish(paceMin, distance) {
    return paceMin * distance;
  }
  function finishToPace(finishMin, distance) {
    return finishMin / distance;
  }
  function paceToMph(paceMin) {
    return 60 / paceMin;
  }

  // Negative-split core: given how far/long you've gone and a goal, what's left.
  function planRest({ distance, doneDist, usedMin, goalMin }) {
    const remainDist = distance - doneDist;
    const leftMin = goalMin - usedMin;
    const paceSoFar = doneDist > 0 ? usedMin / doneDist : NaN;
    const projFinish = usedMin + paceSoFar * remainDist;
    const reqPace = leftMin > 0 && remainDist > 0 ? leftMin / remainDist : NaN;
    return { remainDist, leftMin, paceSoFar, projFinish, reqPace };
  }

  return {
    parseToMinutes,
    fmtPace,
    fmtDuration,
    paceToFinish,
    finishToPace,
    paceToMph,
    planRest,
  };
});
