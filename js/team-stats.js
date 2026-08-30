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

/** One team's ATS/O-U record, plus points scored/allowed, across its
 * finished games this season. minus/plus buckets are the team's cover
 * record while favored/underdog (mirrors a player's Minus/Plus Spread
 * pick); over/under are simple counts of how many of the team's games went
 * each way (there's no "hit" from a team's perspective on a total —
 * over/under is about the game, not one side — so it's reported as a
 * split, not a win rate).
 *
 * Points scored/allowed are tallied from EVERY finished game regardless of
 * whether a line was posted — unlike the ATS/O-U categories below, that
 * data doesn't depend on odds existing at all. */
function computeTeamRecord(games, teamAbbr) {
  const record = emptyTeamRecord();
  for (const g of games) {
    if (g.status?.state !== "post" || !g.status?.completed) continue;
    if (g.sport === "nfl" && g.seasonType === 1) continue;
    const isHome = g.home?.abbr === teamAbbr;
    const isAway = g.away?.abbr === teamAbbr;
    if (!isHome && !isAway) continue;
    record.gamesCounted++;

    const ownScore = Number(isHome ? g.home?.score : g.away?.score);
    const oppScore = Number(isHome ? g.away?.score : g.home?.score);
    if (!Number.isNaN(ownScore) && !Number.isNaN(oppScore)) {
      record.pointsFor += ownScore;
      record.pointsAgainst += oppScore;
      record.scoringGamesCounted++;
    }

    const line = isHome ? g.odds?.homeSpread : g.odds?.awaySpread;
    if (line != null) {
      const cat = line < 0 ? "minus" : "plus";
      const result = gradeSpread({ team: teamAbbr, line }, g);
      if (result) record[cat][result]++;
    }

    if (g.odds?.overUnder != null) {
      const home = Number(g.home?.score);
      const away = Number(g.away?.score);
      if (!Number.isNaN(home) && !Number.isNaN(away)) {
        const total = home + away;
        if (total === g.odds.overUnder) record.ouPush++;
        else if (total > g.odds.overUnder) record.over++;
        else record.under++;
      }
    }
  }
  return record;
}

/** Cover % for a minus/plus bucket, or null if there's nothing graded yet
 * (distinct from 0% — "no data" shouldn't render as "always misses"). */
function coverPct(bucket) {
  const total = bucket.hit + bucket.miss + bucket.push;
  return total ? Math.round((bucket.hit / total) * 100) : null;
}
