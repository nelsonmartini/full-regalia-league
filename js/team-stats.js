/**
 * Team ATS/O-U trends — how a team has performed against the same 4 betting
 * categories used for picks (Minus Spread, Plus Spread, Over, Under),
 * derived entirely from data js/live-scores.js already fetches for every
 * game (final score + closing lines come back in the same ESPN response
 * used to grade picks — see js/grading.js). No external data source, no
 * scraping: a team "covering" the spread is exactly the same computation as
 * a player's spread pick hitting (gradeSpread), just run against the team's
 * own closing line for that game instead of a saved pick.
 *
 * Preseason (NFL seasonType 1) is excluded, same as everywhere else in the
 * app — exhibition football shouldn't count toward a team's real trend.
 */

/** Every team abbreviation that's appeared in at least one finished,
 * real-season game — used to populate the team list without hardcoding a
 * roster (so it's automatically correct for both sports and however many
 * teams have actually played so far).
 *
 * Does NOT require a posted line — points scored/allowed (see
 * computeTeamRecord) doesn't need one, only the ATS/O-U categories do, and
 * those already show "No data yet" per-category when a team has no
 * odds-having games. Requiring odds here meant a team whose only finished
 * game had no posted line (confirmed real, 2026-08-30: Hawaii @ Stanford —
 * ESPN returned a final score with no `odds` at all) was invisible in the
 * picker entirely, even though its final score was perfectly good data. */
function teamsWithFinishedGames(games) {
  const seen = new Map();
  for (const g of games) {
    if (g.status?.state !== "post" || !g.status?.completed) continue;
    if (g.sport === "nfl" && g.seasonType === 1) continue;
    for (const side of [g.home, g.away]) {
      if (side?.abbr && !seen.has(side.abbr)) seen.set(side.abbr, { abbr: side.abbr, name: side.name, sport: g.sport });
    }
  }
  return [...seen.values()].sort((a, b) => a.abbr.localeCompare(b.abbr));
}

function emptyTeamRecord() {
  return {
    minus: { hit: 0, miss: 0, push: 0 },
    plus: { hit: 0, miss: 0, push: 0 },
    over: 0,
    under: 0,
    ouPush: 0,
    gamesCounted: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    scoringGamesCounted: 0,
  };
}

/** Every finished, real-season game for one team, each enriched with its
 * own cover result and O/U result — the shared raw material behind the
 * season-aggregate record, the home/away split, and the week-by-week game
 * log (all in this file / analytics.html), so the three always agree with
 * each other instead of three separate hand-rolled loops drifting apart.
 * Sorted chronologically (oldest first) — callers reverse for a
 * newest-first display where that reads better. */
function computeTeamGameLog(games, teamAbbr) {
  const entries = [];
  for (const g of games) {
    if (g.status?.state !== "post" || !g.status?.completed) continue;
    if (g.sport === "nfl" && g.seasonType === 1) continue;
    const isHome = g.home?.abbr === teamAbbr;
    const isAway = g.away?.abbr === teamAbbr;
    if (!isHome && !isAway) continue;

    const rawOwnScore = Number(isHome ? g.home?.score : g.away?.score);
    const rawOppScore = Number(isHome ? g.away?.score : g.home?.score);
    const ownScore = Number.isNaN(rawOwnScore) ? null : rawOwnScore;
    const oppScore = Number.isNaN(rawOppScore) ? null : rawOppScore;
    const opponent = isHome ? g.away : g.home;

    const line = isHome ? g.odds?.homeSpread : g.odds?.awaySpread;
    const category = line != null ? (line < 0 ? "minus" : "plus") : null;
    const spreadResult = line != null ? gradeSpread({ team: teamAbbr, line }, g) : null;

    let ouResult = null;
    if (g.odds?.overUnder != null && ownScore != null && oppScore != null) {
      const total = ownScore + oppScore;
      ouResult = total === g.odds.overUnder ? "push" : total > g.odds.overUnder ? "over" : "under";
    }

    entries.push({
      game: g,
      date: g.date,
      week: g.week,
      seasonType: g.seasonType,
      sport: g.sport,
      isHome,
      opponent,
      ownScore,
      oppScore,
      line,
      category,
      spreadResult,
      overUnderLine: g.odds?.overUnder ?? null,
      ouResult,
    });
  }
  return entries.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** Rolls a computeTeamGameLog() entry list up into the same shape
 * computeTeamRecord() has always returned — used both for the real season
 * total AND for a home-only/away-only subset (see homeAwaySplitHtml,
 * analytics.html), so both read the exact same way. minus/plus buckets are
 * the team's cover record while favored/underdog (mirrors a player's
 * Minus/Plus Spread pick); over/under are simple counts of how many games
 * went each way (there's no "hit" from a team's perspective on a total —
 * it's about the game, not one side — so it's a split, not a win rate). */
function aggregateTeamGameLog(entries) {
  const record = emptyTeamRecord();
  for (const e of entries) {
    record.gamesCounted++;
    if (e.ownScore != null && e.oppScore != null) {
      record.pointsFor += e.ownScore;
      record.pointsAgainst += e.oppScore;
      record.scoringGamesCounted++;
    }
    if (e.category && e.spreadResult) record[e.category][e.spreadResult]++;
    if (e.ouResult === "push") record.ouPush++;
    else if (e.ouResult === "over") record.over++;
    else if (e.ouResult === "under") record.under++;
  }
  return record;
}

/** One team's ATS/O-U record, plus points scored/allowed, across its
 * finished games this season. Points scored/allowed are tallied from
 * EVERY finished game regardless of whether a line was posted — unlike the
 * ATS/O-U categories, that data doesn't depend on odds existing at all. */
function computeTeamRecord(games, teamAbbr) {
  return aggregateTeamGameLog(computeTeamGameLog(games, teamAbbr));
}

/** Current ATS cover/miss streak, most-recent-game-backward. A push is a
 * neutral no-decision — it's skipped rather than breaking or extending a
 * streak, same reasoning teamOuSplitHtml uses for why a total isn't a
 * hit/miss. A game with no posted line is skipped too (nothing to have
 * covered or missed). Returns null if there's no decided game yet. */
function computeTeamStreak(gameLog) {
  const decided = [...gameLog].reverse().map((e) => e.spreadResult).filter((r) => r === "hit" || r === "miss");
  if (decided.length === 0) return null;
  const type = decided[0];
  let count = 0;
  for (const r of decided) {
    if (r !== type) break;
    count++;
  }
  return { type, count };
}

/** Cover % for a minus/plus bucket, or null if there's nothing graded yet
 * (distinct from 0% — "no data" shouldn't render as "always misses"). */
function coverPct(bucket) {
  const total = bucket.hit + bucket.miss + bucket.push;
  return total ? Math.round((bucket.hit / total) * 100) : null;
}
