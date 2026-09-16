/**
 * Live scores + odds, pulled client-side from ESPN's public scoreboard API.
 * No API key, no signup — but it's an unofficial/undocumented endpoint, so treat
 * it as best-effort: if ESPN changes the response shape, this fails soft (empty
 * state), it doesn't break the rest of the site. See ROADMAP.md for the tradeoffs.
 *
 * Odds come embedded in the same scoreboard response for free (confirmed via
 * CORS-open `Access-Control-Allow-Origin: *`) — no separate odds API needed
 * for a game that's still upcoming. BUT confirmed directly against real data
 * (2026-09-05, Neil: Analytics showing "No data" for finished games):
 * **ESPN drops the `odds` field entirely once a game leaves "pre" status** —
 * 78 of 124 real upcoming CFB games had odds, 0 of 53 live/finished ones did.
 * Player pick grading is unaffected (a pick stores its own line at the time
 * it was made), but anything that needs a game's odds AFTER it's live/final
 * (team ATS/O-U trends, the odds row on a live or finished game card) needs
 * backfillMissingOdds() below instead.
 */

const ESPN_ENDPOINTS = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
};

const ESPN_SUMMARY_ENDPOINTS = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary",
  cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary",
};

/** Real outage (confirmed directly, 2026-09-15): ESPN's scoreboard endpoint
 * used to accept a `dates=YYYYMMDD-YYYYMMDD` RANGE, letting one request cover
 * an entire season. That now returns HTTP 400 ("Failed to get events
 * endpoint") for ANY range at all — even 2 days — for both sports. A single
 * date with no range still works, and so does a week-based query
 * (`week=N&seasontype=N&year=YYYY`), confirmed against real ESPN responses.
 * fetchScoreboard is rebuilt around the week-based query: it fetches every
 * real week of the ENTIRE season in parallel, always — `daysBack`/
 * `daysForward` are accepted for backward compatibility (existing callers
 * still pass them) but no longer narrow anything, since a per-week fetch has
 * no server-side date window to ask for in the first place. Every existing
 * caller already only wanted "the whole season, or close to it" anyway
 * (confirmed by checking every call site), so returning the full season
 * unconditionally is a superset of what any of them asked for, not a
 * behavior change in practice. (An earlier version of this fix DID
 * re-filter the combined result down to that window client-side — dropped
 * it because it was stricter than the old behavior ever actually was: the
 * window was previously just a server-side query hint that was never
 * enforced client-side, so anything relying on a game landing outside a
 * "realistic" near-term date — several existing tests deliberately use
 * far-future placeholder dates for "always upcoming" fixtures — broke
 * against a filter that used to not exist at all.)
 *
 * Season type numbering (ESPN's own): 1 = preseason (NFL only — CFB has no
 * real equivalent), 2 = regular season, 3 = postseason. Week caps below are
 * the real confirmed max for each (NFL: 4/18/5 — CFB: none/15/1, where CFB's
 * single postseason "week 1" holds every bowl/playoff game at once), each
 * with a small safety margin — ESPN returns an empty event list (not an
 * error) for a week past the real end, so overshooting the real count is
 * harmless, just an extra fast, cheap request. */
const SEASON_TYPE_WEEK_CAPS = {
  nfl: { 1: 5, 2: 19, 3: 6 },
  cfb: { 2: 17, 3: 3 },
};

/** A season "YYYY" runs roughly Aug YYYY through Feb (YYYY+1) — before July,
 * "now" is still inside the tail end of the PREVIOUS season (confirmed: the
 * real Super Bowl, played Feb 2027, is only returned under year=2026). */
function currentSeasonYear() {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

async function fetchScoreboard(sport) {
  const base = ESPN_ENDPOINTS[sport];
  const caps = SEASON_TYPE_WEEK_CAPS[sport];
  if (!base || !caps) return [];
  const year = currentSeasonYear();

  const requests = [];
  for (const [seasonType, maxWeek] of Object.entries(caps)) {
    for (let week = 1; week <= maxWeek; week++) requests.push({ seasonType, week });
  }

  const perWeekResults = await Promise.all(
    requests.map(async ({ seasonType, week }) => {
      const url = `${base}?seasontype=${seasonType}&week=${week}&year=${year}`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json();
        // One malformed event anywhere in a response (a bye week, a TBD
        // matchup, a postponed game — anything shaped slightly differently
        // than normalizeEvent expects) used to throw inside this .map(),
        // which the try/catch above would catch and turn into an empty
        // array for the ENTIRE sport — not just the one bad event. Real,
        // confirmed-plausible cause of "every player stuck at 0 points"
        // (2026-08-30): a single bad game silently wiping out every other
        // game that week, so nothing could be graded at all. Normalizing
        // per-event now means one bad game gets dropped, not the whole slate.
        return (data.events || [])
          .map((e) => {
            try {
              return normalizeEvent(e, sport);
            } catch (err) {
              console.error("normalizeEvent failed for one event, skipping it:", e?.id, err);
              return null;
            }
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    })
  );

  // De-dupe by id — harmless safety net in case a game ever gets returned
  // under more than one week/seasontype combo.
  const byId = new Map();
  for (const g of perWeekResults.flat()) byId.set(g.id, g);
  return [...byId.values()];
}

// gameId -> normalized odds, or null for a game confirmed to have never had
// a posted line. A closing line never changes once a game is final, so a
// given game is never re-fetched twice in one page visit — caching `null`
// too means a genuinely odds-less game doesn't get silently retried on
// every render (live.html re-runs this on a 30s poll).
const _oddsBackfillCache = new Map();

/** Restores `.odds` on games ESPN's live scoreboard feed dropped it from
 * (anything no longer "pre" — see the file header). ESPN's separate
 * per-game summary endpoint retains the closing line even after a game
 * ends; its odds shape (`homeTeamOdds`/`awayTeamOdds` + `.spread`, no
 * `pointSpread.close.line`) is exactly what normalizeOdds()'s existing
 * deriveSpread() fallback already parses, so no new parsing was needed —
 * just fetching from the right place.
 *
 * MUTATES the given games in place (sets `.odds` directly) rather than
 * returning a new array, so a caller can pass any subset — e.g. just the
 * games relevant to one team — and the same underlying objects update
 * wherever else the full games list is held (no separate arrays to
 * reconcile). Fails soft per-game, same philosophy as fetchScoreboard: one
 * bad fetch shouldn't block the rest. */
async function backfillMissingOdds(games) {
  const needsFetch = games.filter((g) => !g.odds && g.status?.state !== "pre" && !_oddsBackfillCache.has(g.id));
  await Promise.all(
    needsFetch.map(async (g) => {
      const base = ESPN_SUMMARY_ENDPOINTS[g.sport];
      if (!base) return;
      try {
        const res = await fetch(`${base}?event=${g.id}`, { cache: "no-store" });
        if (!res.ok) {
          _oddsBackfillCache.set(g.id, null);
          return;
        }
        const data = await res.json();
        const rawOdds = data.odds?.[0] || data.pickcenter?.[0] || null;
        _oddsBackfillCache.set(g.id, rawOdds ? normalizeOdds(rawOdds) : null);
      } catch {
        _oddsBackfillCache.set(g.id, null);
      }
    })
  );
  for (const g of games) {
    if (!g.odds && _oddsBackfillCache.has(g.id)) {
      const cached = _oddsBackfillCache.get(g.id);
      if (cached) g.odds = cached;
    }
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
      location: home.team?.location || null,
      score: home.score,
      logo: home.team?.logo || null,
      // AP/Coaches poll rank — ESPN uses 99 as the "unranked" sentinel, not
      // null, so anything above 25 doesn't count as a real ranking.
      rank: home.curatedRank?.current && home.curatedRank.current <= 25 ? home.curatedRank.current : null,
    },
    away: away && {
      abbr: away.team?.abbreviation,
      name: away.team?.shortDisplayName || away.team?.displayName,
      location: away.team?.location || null,
      score: away.score,
      logo: away.team?.logo || null,
      rank: away.curatedRank?.current && away.curatedRank.current <= 25 ? away.curatedRank.current : null,
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

/** "Locks in 2h 15m" — a live countdown to kickoff, shown alongside the
 * plain day/time on still-upcoming picks (Neil: a countdown reads more
 * urgently than a static clock time, especially close to lock). Rounds
 * down to the coarsest 2 units (days+hours, or hours+minutes, or just
 * minutes) rather than showing seconds — this re-renders on a timer, not
 * a true per-second tick, so seconds would look broken/frozen between
 * refreshes. Returns null once the deadline's passed (caller decides what
 * to show instead — usually nothing, since the category locks by then). */
function formatCountdown(iso) {
  const ms = new Date(iso) - new Date();
  if (!(ms > 0)) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;
  return `Locks in ${minutes}m`;
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

/** One team row within a game card — logo, name, and score (right-aligned,
 * only shown once the game has actually started). The winning side (once
 * final) is brought up to full text color so the result reads at a glance
 * without needing to compare two numbers.
 *
 * NFL: abbreviation+mascot-name stack (KC / Chiefs). NCAA: just the
 * school's own name (Alabama, not ALA) — tried showing the mascot too, but
 * landed back on school-name-only per Neil. Both sports mark the home team
 * with a leading "@" — standard sports shorthand ("@" marks the site of the
 * game, i.e. the home team's place) — NFL used a house emoji for this
 * instead until Neil asked for the same "@" treatment on both sports
 * (2026-09-13), for one consistent convention across the whole app instead
 * of two different home-team markers depending on sport. A #N prefix shows
 * up for either sport when that team is currently AP/Coaches top-25 ranked. */
function gameCardTeamRow(team, opponentAbbr, sport, showScore, isWinner, isHome) {
  const classes = `game-card-team${isWinner ? " is-winner" : ""}`;
  // Loading="lazy" + onerror hide — a missing/broken logo (some smaller
  // schools, mid-season roster of teams ESPN hasn't backfilled art for)
  // shouldn't leave a broken-image icon sitting in the row; it just quietly
  // collapses back to text-only, same as before logos existed.
  const logoHtml = team?.logo
    ? `<img class="game-card-team-logo" src="${team.logo}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    : `<span class="game-card-team-logo"></span>`;
  // AP/Coaches Top 25 is a college-only concept — NFL's `rank` is always
  // null (ESPN doesn't return curatedRank for pro games), so this only
  // ever shows up on the NCAA branch below.
  const rankHtml = team?.rank ? `<span class="game-card-team-rank">#${team.rank}</span>` : "";
  const nameHtml =
    sport === "cfb"
      ? `<span class="game-card-team-fullname">${isHome ? "@ " : ""}${rankHtml}${team?.location || team?.abbr || "?"}</span>`
      : `<span class="game-card-team-stack">
          <span class="game-card-team-abbr">${team?.abbr || "?"}</span>
          <span class="game-card-team-name">${isHome ? "@ " : ""}${team?.name || ""}</span>
        </span>`;
  const inner = `
    ${logoHtml}
    ${nameHtml}
    ${showScore ? `<span class="game-card-team-score">${team?.score ?? "-"}</span>` : ""}`;
  if (!team?.abbr) return `<div class="${classes}">${inner}</div>`;
  const oppParam = opponentAbbr ? `&opp=${encodeURIComponent(opponentAbbr)}` : "";
  return `<a class="${classes}" href="analytics.html?team=${encodeURIComponent(team.abbr)}${oppParam}&sport=${sport}">${inner}</a>`;
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
        ${gameCardTeamRow(g.away, g.home?.abbr, g.sport, showScore, awayWins, false)}
        ${gameCardTeamRow(g.home, g.away?.abbr, g.sport, showScore, homeWins, true)}
      </div>
      ${oddsHtml}
    </div>`;
}

async function loadAllGames() {
  const [nfl, cfb] = await Promise.all([fetchScoreboard("nfl"), fetchScoreboard("cfb")]);
  return [...nfl, ...cfb];
}
