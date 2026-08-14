/**
 * Pure pick-formatting helpers shared between the Picks page (js/picks.js) and
 * the Standings/History/Player pages (js/season-data.js) — split out so those
 * pages can format/label picks without pulling in picks.js's DOM-binding code
 * (which assumes picks.html's elements exist and runs on DOMContentLoaded).
 */

const CATEGORIES = ["minus", "plus", "over", "under"];
const CATEGORY_LABEL = { minus: "Minus Spread", plus: "Plus Spread", over: "Over", under: "Under" };
const SPORTS = ["nfl", "cfb"];
const SEASON_PHASE_PREFIX = { 1: "Preseason ", 2: "", 3: "Postseason " };

function fmtLine(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

/** Escape text before interpolating it into innerHTML — needed anywhere
 * user-typed input (e.g. the Picks page team search box) gets echoed back
 * into the page. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function sportLabel(sport) {
  return sport === "nfl" ? "NFL" : "College";
}

/** Which of the 4 categories a pick belongs to. */
function pickCategory(pick) {
  if (pick.type === "spread") return pick.line < 0 ? "minus" : "plus";
  if (pick.type === "total") return pick.direction === "over" ? "over" : "under";
  return null;
}

function pickLabel(pick) {
  if (pick.type === "total") return `${pick.direction === "over" ? "Over" : "Under"} ${pick.line}`;
  return `${pick.team}${pick.line != null ? " " + fmtLine(pick.line) : " ML"}`;
}

/** Same as picks.js's weekBucketKey but built from a saved pick's snapshot
 * instead of a live game object, so it works even after a game rolls out of
 * the live fetch window. */
function weekBucketKeyFromSnapshot(snapshot) {
  if (!snapshot) return null;
  return snapshot.week != null ? `w${snapshot.seasonType ?? "x"}-${snapshot.week}` : `d${snapshot.date?.slice(0, 10)}`;
}

function weekGroupLabel(snapshot) {
  if (!snapshot) return "Unknown week";
  if (snapshot.week) {
    const prefix = SEASON_PHASE_PREFIX[snapshot.seasonType] ?? "";
    return `${sportLabel(snapshot.sport)} · ${prefix}Week ${snapshot.week}`;
  }
  try {
    const d = new Date(snapshot.date);
    return `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "Unknown week";
  }
}

function statusBadge(result) {
  if (result === "hit") return `<span style="color:var(--positive);font-weight:800">Hit</span>`;
  if (result === "miss") return `<span style="color:var(--negative);font-weight:800">Miss</span>`;
  if (result === "push") return `<span style="color:var(--text-faint);font-weight:800">Push</span>`;
  return `<span style="color:var(--text-faint);font-weight:700">Pending</span>`;
}
