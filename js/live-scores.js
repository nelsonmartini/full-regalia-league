/**
 * Live scores + odds, pulled client-side from ESPN's public scoreboard API.
 * No API key, no signup — but it's an unofficial/undocumented endpoint, so treat
 * it as best-effort: if ESPN changes the response shape, this fails soft (empty
 * state), it doesn't break the rest of the site. See ROADMAP.md for the tradeoffs.
 *
 * Odds come embedded in the same response for free (confirmed via CORS-open
 * `Access-Control-Allow-Origin: *`) — no separate odds API needed. Coverage is
 * ~100% for NFL, roughly half for college football (smaller games often lack a
 * posted line yet) — that's ESPN's data, not a bug here.
 */

const ESPN_ENDPOINTS = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
};

/** "YYYYMMDD-YYYYMMDD" covering `daysBack` days ago through `daysForward` days ahead —
 * lets recently-finished games (for grading) and next couple weeks (for picking) both
 * stay in view, instead of only whatever ESPN considers "today". */
function dateRangeParam(daysBack, daysForward) {
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const end = new Date();
  end.setDate(end.getDate() + daysForward);
  return `${fmt(start)}-${fmt(end)}`;
}

async function fetchScoreboard(sport, { daysBack = 10, daysForward = 35 } = {}) {
  const base = ESPN_ENDPOINTS[sport];
  if (!base) return [];
  const url = `${base}?dates=${dateRangeParam(daysBack, daysForward)}&limit=300`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map((e) => normalizeEvent(e, sport));
  } catch {
    return [];
  }
}

let _nflGroupsCache = null;

/** Team abbreviation -> "AFC East" style label, sourced live from ESPN's own
 * conference/division hierarchy endpoint (not hardcoded) — so it's always
 * correct and needs no maintenance. Cached in memory for the page session
 * since it's static seasonal data (fine to refetch on a full page reload). */
async function fetchNflDivisions() {
  if (_nflGroupsCache) return _nflGroupsCache;
  const map = new Map();
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/groups", { cache: "no-store" });
    if (!res.ok) return map;
    const data = await res.json();
    for (const conf of data.groups || []) {
      for (const div of conf.children || []) {
        const label = `${conf.abbreviation} ${div.abbreviation}`;
        for (const team of div.teams || []) {
          map.set(team.abbreviation, label);
        }
      }
    }
  } catch {
    // fails soft — callers should treat a missing entry as "ungrouped"
  }
  _nflGroupsCache = map;
  return map;
}

function normalizeEvent(e, sport) {
  const comp = e.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const odds = comp?.odds?.[0];

  return {
    id: e.id,
    sport,
    shortName: e.shortName || e.name,
    date: e.date,
    week: e.week?.number ?? null,
    // ESPN resets week numbers per season phase (preseason week 1, regular season
    // week 1, postseason week 1 are all "week 1") — seasonType disambiguates them.
    // 1 = preseason, 2 = regular season, 3 = postseason.
    seasonType: e.season?.type ?? null,
    status: {
      state: e.status?.type?.state, // "pre" | "in" | "post"
      completed: !!e.status?.type?.completed,
      detail: e.status?.type?.shortDetail || e.status?.type?.detail || "",
      clock: e.status?.displayClock,
      period: e.status?.period,
    },
    home: home && {
      abbr: home.team?.abbreviation,
      name: home.team?.shortDisplayName || home.team?.displayName,
      score: home.score,
    },
    away: away && {
      abbr: away.team?.abbreviation,
      name: away.team?.shortDisplayName || away.team?.displayName,
      score: away.score,
    },
    odds: odds ? normalizeOdds(odds) : null,
  };
}

function normalizeOdds(odds) {
  const homeLineStr = odds.pointSpread?.home?.close?.line;
  const awayLineStr = odds.pointSpread?.away?.close?.line;
  return {
    spread: odds.details || null, // display text, e.g. "TCU -6.5"
    overUnder: odds.overUnder ?? null,
    // Per-team signed spread lines, needed to build a pick a person can actually
    // take on either side (e.g. home +1.5 / away -1.5). Falls back to deriving
    // from the favorite flag + magnitude if the precise line string is missing.
    homeSpread: homeLineStr != null ? Number(homeLineStr) : deriveSpread(odds, "home"),
    awaySpread: awayLineStr != null ? Number(awayLineStr) : deriveSpread(odds, "away"),
  };
}

function deriveSpread(odds, side) {
  const info = side === "home" ? odds.homeTeamOdds : odds.awayTeamOdds;
  if (!info || odds.spread == null) return null;
  return info.favorite ? -Math.abs(odds.spread) : Math.abs(odds.spread);
}

function formatKickoff(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Fuller "Thu, Aug 6 · 8:00 PM" form — used where the date alone (not just the
 * weekday) matters, e.g. picks made now for a game next week. */
function formatFullDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** One team row within a game card — abbreviation (bold), full name (muted,
 * truncates rather than wraps), and score (right-aligned, only shown once
 * the game has actually started). The winning side (once final) is brought
 * up to full text color so the result reads at a glance without needing to
 * compare two numbers. */
function gameCardTeamRow(team, showScore, isWinner, isHome) {
  const homeMark = isHome ? `<span class="game-card-home-icon" title="Home team">🏠</span>` : "";
  return `
    <div class="game-card-team${isWinner ? " is-winner" : ""}">
      <span class="game-card-team-abbr">${team?.abbr || "?"}</span>
      <span class="game-card-team-name">${homeMark}${team?.name || ""}</span>
      ${showScore ? `<span class="game-card-team-score">${team?.score ?? "-"}</span>` : ""}
    </div>`;
}

function renderGameCard(g) {
  const isLive = g.status.state === "in";
  const isFinal = g.status.state === "post";
  const showScore = isLive || isFinal;

  const statusHtml = isLive
    ? `<span class="badge live"><span class="dot"></span>${g.status.detail || "Live"}</span>`
    : isFinal
    ? `<span class="game-card-final">Final</span>`
    : `<span class="game-card-kickoff">${formatKickoff(g.date)}</span>`;

  const awayScore = g.away?.score != null ? Number(g.away.score) : null;
  const homeScore = g.home?.score != null ? Number(g.home.score) : null;
  const awayWins = isFinal && awayScore != null && homeScore != null && awayScore > homeScore;
  const homeWins = isFinal && awayScore != null && homeScore != null && homeScore > awayScore;

  const oddsHtml = g.odds
    ? `<div class="game-card-odds">
        ${g.odds.spread ? `<span>Spread <strong>${g.odds.spread}</strong></span>` : ""}
        ${g.odds.overUnder ? `<span>O/U <strong>${g.odds.overUnder}</strong></span>` : ""}
      </div>`
    : "";

  return `
    <div class="game-card${isLive ? " game-card--live" : ""}${isFinal ? " game-card--final" : ""}">
      <div class="game-card-top">
        <span class="game-card-sport">${g.sport === "nfl" ? "NFL" : "NCAA"}</span>
        ${statusHtml}
      </div>
      <div class="game-card-teams">
        ${gameCardTeamRow(g.away, showScore, awayWins, false)}
        ${gameCardTeamRow(g.home, showScore, homeWins, true)}
      </div>
      ${oddsHtml}
    </div>`;
}

async function loadAllGames() {
  const [nfl, cfb] = await Promise.all([fetchScoreboard("nfl"), fetchScoreboard("cfb")]);
  return [...nfl, ...cfb];
}
