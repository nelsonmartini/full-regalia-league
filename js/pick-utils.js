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

function weekBucketKey(game) {
  return game.week != null ? `w${game.seasonType ?? "x"}-${game.week}` : `d${game.date?.slice(0, 10)}`;
}

/** Games actually offerable as picks: not yet kicked off, odds posted, and
 * — for NFL specifically — not preseason (exhibition football, excluded
 * from the real pick'em league). Shared by js/picks.js (the full week
 * picker) and index.html (just needs "the current week"). */
function filterPickableGames(games) {
  return games
    .filter((g) => g.status.state === "pre" && g.odds)
    .filter((g) => !(g.sport === "nfl" && g.seasonType === 1))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** The soonest upcoming pickable week for one sport, from an already-fetched
 * games list — used wherever "the current week" needs a single answer (e.g.
 * index.html's picks CTA and standings freshness line), as opposed to
 * js/picks.js's full week *selector*, which needs every upcoming week, not
 * just the first one. Returns null if there's nothing pickable yet. */
function earliestPickableWeek(games, sport) {
  const pickable = filterPickableGames(games).filter((g) => g.sport === sport);
  if (pickable.length === 0) return null;
  const key = weekBucketKey(pickable[0]);
  const weekGames = pickable.filter((g) => weekBucketKey(g) === key);
  const dates = weekGames.map((g) => new Date(g.date));
  return {
    weekKey: key,
    weekNumber: pickable[0].week ?? null,
    seasonType: pickable[0].seasonType ?? null,
    startDate: new Date(Math.min(...dates)),
    endDate: new Date(Math.max(...dates)),
  };
}
