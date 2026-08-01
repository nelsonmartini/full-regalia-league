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

async function fetchScoreboard(sport) {
  const url = ESPN_ENDPOINTS[sport];
  if (!url) return [];
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || []).map((e) => normalizeEvent(e, sport));
  } catch {
    return [];
  }
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

function renderGameCard(g) {
  const isLive = g.status.state === "in";
  const isFinal = g.status.state === "post";
  const statusHtml = isLive
    ? `<span class="badge live"><span class="dot"></span>${g.status.detail || "Live"}</span>`
    : isFinal
    ? `<span style="color:var(--text-faint);font-size:11.5px;font-weight:700">Final</span>`
    : `<span style="color:var(--text-faint);font-size:11.5px;font-weight:700">${formatKickoff(g.date)}</span>`;

  const scoreHtml =
    isLive || isFinal
      ? `<div style="display:flex;justify-content:space-between;font-weight:800;font-size:16px">
          <span>${g.away?.abbr || "?"} ${g.away?.score ?? ""}</span>
          <span>${g.home?.abbr || "?"} ${g.home?.score ?? ""}</span>
        </div>`
      : `<div style="font-weight:800;font-size:15px">${g.away?.abbr || g.away?.name} @ ${g.home?.abbr || g.home?.name}</div>`;

  const oddsHtml = g.odds
    ? `<div style="margin-top:6px;font-size:12px;color:var(--text-dim)">
        ${g.odds.spread ? `Spread: <strong style="color:var(--text)">${g.odds.spread}</strong>` : ""}
        ${g.odds.overUnder ? ` &nbsp;·&nbsp; O/U: <strong style="color:var(--text)">${g.odds.overUnder}</strong>` : ""}
      </div>`
    : "";

  return `
    <div class="pick-game">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:11px;color:var(--text-faint);font-weight:700;text-transform:uppercase">${g.sport === "nfl" ? "NFL" : "College"}</span>
        ${statusHtml}
      </div>
      ${scoreHtml}
      ${oddsHtml}
    </div>`;
}

async function loadAllGames() {
  const [nfl, cfb] = await Promise.all([fetchScoreboard("nfl"), fetchScoreboard("cfb")]);
  return [...nfl, ...cfb];
}
