/**
 * Auto-grading engine — the headline feature. Given a structured pick and a
 * finished game (from live-scores.js), determines hit/miss/push automatically.
 * This is what replaces the manual "look at the score, decide who covered,
 * type Yes/No into the sheet" work every week.
 *
 * Pick shape (see js/picks.js for how these get created from live odds):
 *   { type: "spread", team: "CAR", line: -1.5 }
 *   { type: "moneyline", team: "CAR" }
 *   { type: "total", direction: "over" | "under", line: 36.5 }
 *
 * Game shape: the normalized object from js/live-scores.js (home/away
 * {abbr, score}, status.state/completed).
 *
 * Returns "hit" | "miss" | "push" | null (null = game not final yet, can't grade).
 */

function teamScores(pick, game) {
  const teamIsHome = game.home?.abbr === pick.team;
  const teamIsAway = game.away?.abbr === pick.team;
  if (!teamIsHome && !teamIsAway) return null;
  const teamScore = Number(teamIsHome ? game.home.score : game.away.score);
  const oppScore = Number(teamIsHome ? game.away.score : game.home.score);
  if (Number.isNaN(teamScore) || Number.isNaN(oppScore)) return null;
  return { teamScore, oppScore };
}

function gradeSpread(pick, game) {
  const scores = teamScores(pick, game);
  if (!scores) return null;
  const margin = scores.teamScore - scores.oppScore + pick.line;
  if (margin > 0) return "hit";
  if (margin < 0) return "miss";
  return "push";
}

function gradeMoneyline(pick, game) {
  const scores = teamScores(pick, game);
  if (!scores) return null;
  if (scores.teamScore > scores.oppScore) return "hit";
  if (scores.teamScore < scores.oppScore) return "miss";
  return "push"; // rare, but ties happen
}

function gradeTotal(pick, game) {
  const home = Number(game.home?.score);
  const away = Number(game.away?.score);
  if (Number.isNaN(home) || Number.isNaN(away)) return null;
  const total = home + away;
  if (total === pick.line) return "push";
  const wentOver = total > pick.line;
  if (pick.direction === "over") return wentOver ? "hit" : "miss";
  if (pick.direction === "under") return wentOver ? "miss" : "hit";
  return null;
}

function gradePick(pick, game) {
  if (!game || game.status?.state !== "post" || !game.status?.completed) return null;
  if (pick.type === "spread") return gradeSpread(pick, game);
  if (pick.type === "moneyline") return gradeMoneyline(pick, game);
  if (pick.type === "total") return gradeTotal(pick, game);
  return null;
}

/** 1 point per hit, 0.5 per push, 0 per miss — matches the workbook's scoring pattern. */
function pointsForResult(result) {
  if (result === "hit") return 1;
  if (result === "push") return 0.5;
  return 0;
}
