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

/**
 * NCAA conference groupings, for browsability/filtering within a sport —
 * unlike NFL (which has a live ESPN endpoint with the full conference/division
 * hierarchy, fetched dynamically, see fetchNflDivisions() in live-scores.js),
 * college football has no equivalently clean single source, so this is
 * hardcoded: Power 4 conferences explicitly (covers the vast majority of games
 * people will actually pick), everyone else falls into "Other". Verified
 * against ESPN's team list where possible (2026 season, post-2024
 * realignment); a few entries are best-known-convention rather than
 * individually confirmed — if a team ever shows up in "Other" when it
 * shouldn't, that's just this map needing a one-line fix, not a deeper bug.
 * Shared by js/picks.js (category chip grouping) and live.html (game filter).
 */
const NCAA_CONFERENCES = {
  SEC: ["ALA", "ARK", "AUB", "FLA", "UGA", "UK", "LSU", "MSST", "MIZ", "MISS", "OU", "SC", "TENN", "TEX", "TA&M", "VAN"],
  "Big Ten": ["ILL", "IU", "IOWA", "MD", "MICH", "MSU", "MINN", "NEB", "NU", "OSU", "ORE", "PSU", "PUR", "RUTG", "UCLA", "USC", "WASH", "WIS"],
  ACC: ["BC", "CAL", "CLEM", "DUKE", "FSU", "GT", "LOU", "MIA", "NCSU", "UNC", "PITT", "SMU", "STAN", "SYR", "UVA", "VT", "WAKE"],
  "Big 12": ["ARIZ", "ASU", "BAY", "BYU", "CIN", "COLO", "HOU", "ISU", "KU", "KSU", "OKST", "TCU", "TTU", "UCF", "UTAH", "WVU"],
};
const NCAA_TEAM_TO_CONF = new Map();
for (const [conf, teams] of Object.entries(NCAA_CONFERENCES)) {
  for (const abbr of teams) NCAA_TEAM_TO_CONF.set(abbr, conf);
}

/** Sub-group label for a team — "AFC"/"NFC" for NFL (live data, conference
 * only, not division), a Power 4 conference or "Other" for NCAA (hardcoded
 * above). Used both for category chip grouping (picks.js) and the
 * conference filter chips (picks.js + live.html). */
function teamGroupLabel(sport, teamAbbr, nflDivisions) {
  if (sport === "nfl") return nflDivisions.get(teamAbbr)?.split(" ")[0] || "Other";
  return NCAA_TEAM_TO_CONF.get(teamAbbr) || "Other";
}

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
  return sport === "nfl" ? "NFL" : "NCAA";
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

/** One entry per "Regalia Season Week" — NFL's own week numbering is the
 * backbone (clean, complete coverage all season; NFL's also the site's
 * default/primary sport everywhere else), paired with whichever NCAA week's
 * games START closest in time (within 10 days). Confirmed real confusion
 * (Neil): NFL Week 4 and NCAA Week 4 don't refer to the same calendar dates,
 * so picking one Regalia Week now sets the correct underlying week for BOTH
 * sports at once instead of two independently-drifting selectors.
 * cfbWeekKey/cfbWeekNumber are null when there's no NCAA week within that
 * window yet — normal, college odds post later than the NFL's, not a bug.
 *
 * Moved here (from js/picks.js) so index.html and standings.html can show
 * the exact same week number/range as the Picks page, instead of each page
 * computing "the current week" a different way — confirmed real confusion
 * (Neil, 2026-08-30): Home showed an NFL-only week number/range while Picks
 * showed this Regalia one, so "Week 1" meant two different date ranges
 * depending which page you were on. */
function buildRegaliaWeeks(allGamesBySport) {
  // Date range comes from EVERY game sharing that week key, not just the
  // still-pickable ones — a "week" can include games already played (e.g.
  // CFB's Week 1 covers late-August season-openers days before the bulk of
  // that week's games kick off; confirmed live 2026-08-30: ESPN tags both
  // under the same week=1). Computing the range from pickable-only games
  // understated this — it showed only the not-yet-started remainder,
  // reading as "Week 1 hasn't started" when part of it already had.
  function weekInfo(games, key) {
    const weekGames = games.filter((g) => weekBucketKey(g) === key);
    const dates = weekGames.map((g) => new Date(g.date));
    const hasPickable = filterPickableGames(weekGames).length > 0;
    return {
      key,
      weekNumber: weekGames[0]?.week ?? null,
      seasonType: weekGames[0]?.seasonType ?? null,
      startDate: new Date(Math.min(...dates)),
      endDate: new Date(Math.max(...dates)),
      hasPickable,
    };
  }

  function sortedWeeks(games) {
    return [...new Set(games.map(weekBucketKey))]
      .map((key) => weekInfo(games, key))
      // Only weeks with at least one game still left to pick belong in this
      // list (a fully-finished week is done, not "current" or "upcoming")
      // — same effective behavior as before, just computed after building
      // the full-week date range above instead of by pre-filtering games.
      .filter((w) => w.hasPickable)
      .sort((a, b) => a.startDate - b.startDate);
  }

  const nflWeeks = sortedWeeks(allGamesBySport.nfl);
  const cfbWeeks = sortedWeeks(allGamesBySport.cfb);
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

  // One-to-one nearest-match pairing (greedy on smallest date gap first), not
  // "each NFL week independently grabs whichever CFB week is closest" — the
  // latter let two different NFL weeks both claim the same CFB week whenever
  // only one or two college weeks had odds posted so far (a real, likely
  // scenario early in a week — college odds lag the NFL's). Confirmed via
  // test: with only one posted CFB week, both an NFL week 8 days away and one
  // 1 day away were independently matching to it. Greedy-pairing by smallest
  // gap first, removing both sides once matched, guarantees each CFB week
  // links to at most one NFL week — whichever is genuinely closest.
  const candidatePairs = [];
  for (const nfl of nflWeeks) {
    for (const cfb of cfbWeeks) {
      const diff = Math.abs(cfb.startDate - nfl.startDate);
      if (diff <= TEN_DAYS_MS) candidatePairs.push({ nfl, cfb, diff });
    }
  }
  candidatePairs.sort((a, b) => a.diff - b.diff);
  const linkedCfbByNflKey = new Map();
  const usedCfbKeys = new Set();
  for (const pair of candidatePairs) {
    if (linkedCfbByNflKey.has(pair.nfl.key) || usedCfbKeys.has(pair.cfb.key)) continue;
    linkedCfbByNflKey.set(pair.nfl.key, pair.cfb);
    usedCfbKeys.add(pair.cfb.key);
  }

  const nflEntries = nflWeeks.map((nfl) => {
    const cfbMatch = linkedCfbByNflKey.get(nfl.key) ?? null;
    return {
      nflWeekKey: nfl.key,
      nflWeekNumber: nfl.weekNumber,
      nflSeasonType: nfl.seasonType,
      cfbWeekKey: cfbMatch?.key ?? null,
      cfbWeekNumber: cfbMatch?.weekNumber ?? null,
      startDate: nfl.startDate,
      endDate: nfl.endDate,
    };
  });

  // College football's season starts ~2 weeks before the NFL's, so its
  // season-opening week (or two) has no NFL week close enough to pair with
  // (real case, confirmed 2026-08-19: NFL's only pickable week was Week 1
  // starting Sep 10, which paired with CFB Week 2 — the nearer of the two —
  // leaving CFB Week 1 (98 games, nearly full odds coverage) completely
  // unlinked and therefore invisible in this list, even though it's the
  // most complete, most pickable week available). Surface those orphaned
  // CFB weeks as their own NCAA-only Regalia Week entries instead of
  // silently dropping them.
  const cfbOnlyEntries = cfbWeeks
    .filter((cfb) => !usedCfbKeys.has(cfb.key))
    .map((cfb) => ({
      nflWeekKey: null,
      nflWeekNumber: null,
      nflSeasonType: null,
      cfbWeekKey: cfb.key,
      cfbWeekNumber: cfb.weekNumber,
      startDate: cfb.startDate,
      endDate: cfb.endDate,
    }));

  // "Crown Week" numbering is purely positional (1, 2, 3, ... in chronological
  // order) — deliberately NOT either sport's own week number. Before this,
  // an NFL-paired week showed the NFL's number and a CFB-only week showed
  // the NCAA's, which could both land on "Week 1" independently and read as
  // a duplicate/typo (confirmed confusing, per Neil). One continuous
  // sequence sidesteps that entirely — the NFL/NCAA-specific numbers still
  // show in the row's subline (see renderWeekPickerList), just not in the
  // headline number.
  return [...nflEntries, ...cfbOnlyEntries]
    .sort((a, b) => a.startDate - b.startDate)
    .map((week, i) => ({ ...week, regaliaWeekNumber: i + 1 }));
}

function regaliaWeekDateRange(week) {
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return fmt(week.startDate) === fmt(week.endDate) ? fmt(week.startDate) : `${fmt(week.startDate)}–${fmt(week.endDate)}`;
}

/** "👑 Week N" — the crown emoji itself IS the "Crown Week" branding
 * (spelling out the word too read as redundant, per Neil — one or the
 * other, not both). Date range is appended separately by callers in a
 * smaller font rather than baked in here, so it stays on the same line
 * without dominating it. The number itself is OUR unified sequence, not
 * either sport's own native week number (which can, and often does, differ
 * from this one — see buildRegaliaWeeks above, where the NFL/NCAA-specific
 * numbers still show in the row subline). */
function regaliaWeekTitle(week) {
  return `👑 Week ${week.regaliaWeekNumber}`;
}

/** The current Regalia Week (same unified numbering as the Picks page) from
 * an already-fetched, mixed-sport games list — used wherever a single page
 * needs "the current week" as one answer (index.html's CTA/freshness line,
 * standings.html's freshness line), as opposed to js/picks.js's full week
 * *selector*, which needs every upcoming week, not just the first one.
 * Returns null if there's nothing pickable in either sport yet. */
function currentRegaliaWeek(games) {
  const bySport = { nfl: games.filter((g) => g.sport === "nfl"), cfb: games.filter((g) => g.sport === "cfb") };
  const weeks = buildRegaliaWeeks(bySport);
  return weeks[0] ?? null;
}

function fmtShortDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Week 2 · Sep 3–7" for the Picks CTA subline — or an explicit "nothing
 * posted yet" message rather than silently rendering blank (real gap found
 * 2026-08-14: this is genuinely null between NFL preseason ending and
 * regular season's odds being posted, e.g. mid-August). Uses the same
 * Regalia Week number/range as the Picks page (see buildRegaliaWeeks) —
 * previously computed an NFL-only week here, which could show a completely
 * different range than what Picks called "Week 1" whenever CFB's week
 * started first (confirmed confusing, Neil, 2026-08-30). */
function pickableWeekText(games) {
  const week = currentRegaliaWeek(games);
  if (!week) return "No games posted yet — check back soon";
  return `Week ${week.regaliaWeekNumber} · ${regaliaWeekDateRange(week)}`;
}

/** "Standings as of Aug 14 (Week 2)" — falls back to just the date if there's
 * no current pickable week (same gap as above). Shared by index.html and
 * standings.html so both show the exact same freshness line, using the same
 * Regalia Week number as the Picks page and the CTA subline above. */
function standingsFreshnessText(games) {
  const today = fmtShortDate(new Date());
  const week = currentRegaliaWeek(games);
  return week ? `Standings as of ${today} (Week ${week.regaliaWeekNumber})` : `Standings as of ${today}`;
}
