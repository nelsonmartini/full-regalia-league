/**
 * Picks entry — category-pool model (2026-08-10 redesign, per Neil):
 *   4 categories per sport: Minus Spread, Plus Spread, Over, Under.
 *   Exactly 1 pick per category per sport per week = 4 NFL + 4 NCAA = 8 total.
 *   A Minus/Plus Spread pick, or an Over/Under pick, can be on ANY game that
 *   week — they don't have to be the two sides of the same game (confirmed
 *   with Neil). The one constraint enforced here: a single game can't be used
 *   for BOTH sides of the same bet family (e.g. picked as your Minus Spread AND
 *   your Plus Spread) — that's both logically contradictory (betting both sides
 *   of one line) and a real technical conflict (the DB's uniqueness is per
 *   player+game+bet_type, so both would collide). Handled by excluding a game
 *   from the opposite category's pool once it's used in one.
 *
 * Reads/writes a real shared Supabase database (see BACKLOG.md for schema/RLS).
 * Picks are honor-system (no login) but the database itself enforces the
 * kickoff auto-lock and now also requires DELETE access (for swapping a
 * category pick to a different game) — see the SQL grant in BACKLOG.md.
 *
 * Each saved pick stores the structured value (for grading) plus a
 * self-contained snapshot (matchup/date/week/sport/seasonType) so "My Picks"
 * can still display it even after that game rolls out of the live fetch window:
 *   { value: {type:"spread", team:"CAR", line:-1.5}, snapshot: {...} }
 */

const PLAYER_KEY = "fr_selected_player";
const CATEGORIES = ["minus", "plus", "over", "under"];
const CATEGORY_LABEL = { minus: "Minus Spread", plus: "Plus Spread", over: "Over", under: "Under" };
const SPORTS = ["nfl", "cfb"];
const SEASON_PHASE_PREFIX = { 1: "Preseason ", 2: "", 3: "Postseason " };

/**
 * NCAA conference groupings, for browsability within each pick category —
 * unlike NFL (which has a live ESPN endpoint with the full conference/division
 * hierarchy, fetched dynamically, see fetchNflDivisions() in live-scores.js),
 * college football has no equivalently clean single source, so this is
 * hardcoded: Power 4 conferences explicitly (covers the vast majority of games
 * people will actually pick), everyone else falls into "Other". Verified
 * against ESPN's team list where possible (2026 season, post-2024
 * realignment); a few entries are best-known-convention rather than
 * individually confirmed — if a team ever shows up in "Other" when it
 * shouldn't, that's just this map needing a one-line fix, not a deeper bug.
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

/** Sub-group label for a team within a category's chip list — "AFC East" for
 * NFL (live data), a Power 4 conference or "Other" for NCAA (hardcoded above). */
function teamGroupLabel(sport, teamAbbr, nflDivisions) {
  if (sport === "nfl") return nflDivisions.get(teamAbbr) || "Other";
  return NCAA_TEAM_TO_CONF.get(teamAbbr) || "Other";
}

/** groupId is "<gameId>_spread" | "<gameId>_ml" | "<gameId>_total" — the DB
 * stores game_id and bet_type as separate columns, so convert both ways.
 * ("_ml"/"moneyline" kept only so any legacy rows from before this redesign
 * still round-trip without erroring — moneyline is no longer offered.) */
function groupIdToParts(groupId) {
  const m = groupId.match(/^(.+)_(spread|ml|total)$/);
  if (!m) return null;
  return { gameId: m[1], betType: m[2] === "ml" ? "moneyline" : m[2] };
}

function partsToGroupId(gameId, betType) {
  return `${gameId}_${betType === "moneyline" ? "ml" : betType}`;
}

function fmtLine(n) {
  return n > 0 ? `+${n}` : `${n}`;
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

async function loadPicks(player) {
  const { data, error } = await sb.from("picks").select("*").eq("player_name", player);
  if (error) {
    console.error("loadPicks failed:", error);
    return {};
  }
  const picks = {};
  for (const row of data) {
    picks[partsToGroupId(row.game_id, row.bet_type)] = { value: row.pick, snapshot: row.snapshot };
  }
  return picks;
}

/** Everyone's picks, for the "who's submitted" tracker — not scoped to one
 * player. Public/no-login site, so this is just an open SELECT like the rest. */
async function loadAllPicks() {
  const { data, error } = await sb.from("picks").select("player_name, pick, snapshot");
  if (error) {
    console.error("loadAllPicks failed:", error);
    return [];
  }
  return data;
}

/** Per-player completion (0-4 per sport) for the currently selected NFL/NCAA
 * weeks, sorted least-complete first so stragglers surface at the top. */
function computeWeekStatus(allPicksRows, sportWeeks) {
  const catsSeen = {};
  for (const p of LEAGUE_PLAYERS) catsSeen[p.name] = { nfl: new Set(), cfb: new Set() };

  for (const row of allPicksRows) {
    const sport = row.snapshot?.sport;
    if (!SPORTS.includes(sport)) continue;
    if (weekBucketKeyFromSnapshot(row.snapshot) !== sportWeeks[sport]) continue;
    const cat = pickCategory(row.pick);
    if (!cat) continue;
    if (!catsSeen[row.player_name]) catsSeen[row.player_name] = { nfl: new Set(), cfb: new Set() };
    catsSeen[row.player_name][sport].add(cat);
  }

  return LEAGUE_PLAYERS.map((p) => {
    const nfl = catsSeen[p.name].nfl.size;
    const cfb = catsSeen[p.name].cfb.size;
    return { name: p.name, nfl, cfb, total: nfl + cfb };
  }).sort((a, b) => a.total - b.total || a.name.localeCompare(b.name));
}

function renderWeekStatus(container, statusList) {
  container.innerHTML = statusList
    .map((s) => {
      const badge =
        s.total === 8
          ? `<span style="color:var(--positive);font-weight:800;font-size:12.5px">✓ Submitted</span>`
          : s.total === 0
          ? `<span style="color:var(--text-faint);font-weight:700;font-size:12.5px">Not started</span>`
          : `<span style="color:var(--accent);font-weight:700;font-size:12.5px">In progress</span>`;
      return `
        <a class="standings-row" href="player.html?name=${encodeURIComponent(s.name)}" style="grid-template-columns:32px 1fr auto;cursor:pointer">
          ${avatarHtml(s.name, 28)}
          <div class="standings-name">${titleCase(s.name)}<span class="couple">NFL ${s.nfl}/4 · NCAA ${s.cfb}/4</span></div>
          <div>${badge}</div>
        </a>`;
    })
    .join("");
}

async function deletePick(player, gameId, betType) {
  const { error } = await sb.from("picks").delete().eq("player_name", player).eq("game_id", gameId).eq("bet_type", betType);
  return error;
}

async function upsertPicks(player, rows) {
  if (rows.length === 0) return { error: null };
  const { error } = await sb.from("picks").upsert(rows, { onConflict: "player_name,game_id,bet_type" });
  return { error };
}

function gameSnapshot(game) {
  return {
    gameId: game.id,
    sport: game.sport,
    matchup: `${game.away?.abbr || "?"} @ ${game.home?.abbr || "?"}`,
    date: game.date,
    week: game.week,
    seasonType: game.seasonType,
  };
}

function weekBucketKey(game) {
  return game.week != null ? `w${game.seasonType ?? "x"}-${game.week}` : `d${game.date?.slice(0, 10)}`;
}

/** Same as weekBucketKey but built from a saved pick's snapshot instead of a
 * live game object, so slot-fill can be derived without needing the game to
 * still be in the live fetch window. */
function weekBucketKeyFromSnapshot(snapshot) {
  if (!snapshot) return null;
  return snapshot.week != null ? `w${snapshot.seasonType ?? "x"}-${snapshot.week}` : `d${snapshot.date?.slice(0, 10)}`;
}

function weekBucketLabel(key, games) {
  const game = games.find((g) => weekBucketKey(g) === key);
  if (game?.week != null) {
    const prefix = SEASON_PHASE_PREFIX[game.seasonType] ?? "";
    return `${prefix}Week ${game.week}`;
  }
  try {
    return `Week of ${new Date(game.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return key;
  }
}

/** Build the 4 category pools (one option per eligible game) for a set of
 * games, excluding whichever game is already the OTHER side of the same bet
 * family (a game used for Minus Spread can't also appear in Plus Spread, etc.)
 * — both because betting both sides of one line is contradictory and because
 * the database can only hold one spread pick and one total pick per game.
 * Each option is tagged with a `group` (conference/division) for sub-grouping
 * in the UI — spread options group by the specific team picked; total options
 * (which aren't about one team) group by the home team, as a simple anchor. */
function buildCategoryPools(sport, games, slots, nflDivisions) {
  const pools = { minus: [], plus: [], over: [], under: [] };
  const minusGameId = slots.minus?.entry.snapshot?.gameId ?? null;
  const plusGameId = slots.plus?.entry.snapshot?.gameId ?? null;
  const overGameId = slots.over?.entry.snapshot?.gameId ?? null;
  const underGameId = slots.under?.entry.snapshot?.gameId ?? null;

  for (const game of games) {
    const away = game.away,
      home = game.home;
    if (!away || !home) continue;
    const matchup = `${away.abbr} @ ${home.abbr}`;
    const homeGroup = teamGroupLabel(sport, home.abbr, nflDivisions);
    const when = typeof formatKickoff === "function" ? formatKickoff(game.date) : "";

    if (game.odds?.homeSpread != null && game.odds?.awaySpread != null) {
      const sides = [
        { team: away, opp: home, line: game.odds.awaySpread },
        { team: home, opp: away, line: game.odds.homeSpread },
      ];
      for (const side of sides) {
        const cat = side.line < 0 ? "minus" : "plus";
        if (cat === "minus" && game.id === plusGameId) continue; // already used as Plus, don't offer as Minus
        if (cat === "plus" && game.id === minusGameId) continue;
        pools[cat].push({
          gameId: game.id,
          display: `${side.team.abbr} ${fmtLine(side.line)}`,
          sub: `vs ${side.opp.abbr}`,
          when,
          group: teamGroupLabel(sport, side.team.abbr, nflDivisions),
          value: { type: "spread", team: side.team.abbr, line: side.line },
        });
      }
    }

    if (game.odds?.overUnder != null) {
      if (game.id !== underGameId) {
        pools.over.push({ gameId: game.id, display: `Over ${game.odds.overUnder}`, sub: matchup, when, group: homeGroup, value: { type: "total", direction: "over", line: game.odds.overUnder } });
      }
      if (game.id !== overGameId) {
        pools.under.push({ gameId: game.id, display: `Under ${game.odds.overUnder}`, sub: matchup, when, group: homeGroup, value: { type: "total", direction: "under", line: game.odds.overUnder } });
      }
    }
  }
  return pools;
}

/** Derive the 4 category slots currently filled for one sport+week from the
 * player's full pick set. */
function slotsForSportWeek(picks, sport, weekKey) {
  const slots = { minus: null, plus: null, over: null, under: null };
  for (const [groupId, entry] of Object.entries(picks)) {
    if (entry.snapshot?.sport !== sport) continue;
    if (weekBucketKeyFromSnapshot(entry.snapshot) !== weekKey) continue;
    const cat = pickCategory(entry.value);
    if (cat) slots[cat] = { groupId, entry };
  }
  return slots;
}

/** Overall progress across BOTH sports' currently-selected weeks (not the
 * whole season) — the 8-pick cap is per week, so that's the meaningful count. */
function computeProgress(picks, sportWeeks) {
  const perSport = {};
  let total = 0;
  for (const sport of SPORTS) {
    const slots = slotsForSportWeek(picks, sport, sportWeeks[sport]);
    const filled = CATEGORIES.filter((c) => slots[c]).length;
    perSport[sport] = filled;
    total += filled;
  }
  return { perSport, total };
}

function renderProgress(el, picks, sportWeeks) {
  const { perSport, total } = computeProgress(picks, sportWeeks);
  el.textContent = `${total} of 8 picks made this week · NFL ${perSport.nfl}/4 · NCAA ${perSport.cfb}/4`;
}

const NCAA_GROUP_ORDER = ["ACC", "Big 12", "Big Ten", "SEC", "Other"];

/** Sort a category's sub-group labels for display — NFL sorts naturally
 * alphabetically (gives AFC before NFC, divisions East/North/South/West in
 * order); NCAA uses an explicit Power-4 order with "Other" always last. */
function sortGroupKeys(sport, keys) {
  if (sport === "cfb") {
    return [...keys].sort((a, b) => {
      const ia = NCAA_GROUP_ORDER.indexOf(a);
      const ib = NCAA_GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  return [...keys].sort((a, b) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)));
}

function renderCategoryPools(container, sport, games, slots, nflDivisions) {
  const pools = buildCategoryPools(sport, games, slots, nflDivisions);

  if (games.length === 0) {
    container.innerHTML = '<div class="empty-state">No games with odds available for this week yet — check back closer to kickoff.</div>';
    return;
  }

  container.innerHTML = CATEGORIES.map((cat) => {
    const options = pools[cat];
    // Identify the selected chip by which GAME it's for, not by matching its
    // odds value — two different games can easily share the same total line
    // (e.g. two games both set at "Over 44.5"), and comparing by value alone
    // was marking every game with that line as selected (confirmed bug).
    const currentGameId = slots[cat]?.entry.snapshot?.gameId ?? null;
    if (options.length === 0) {
      return `
        <div class="pick-game" data-category="${cat}">
          <div class="pick-game-label">${CATEGORY_LABEL[cat]}</div>
          <div class="empty-state" style="padding:10px 0">No eligible games left for this category.</div>
        </div>`;
    }

    const byGroup = new Map();
    for (const o of options) {
      if (!byGroup.has(o.group)) byGroup.set(o.group, []);
      byGroup.get(o.group).push(o);
    }
    const subgroupsHtml = sortGroupKeys(sport, [...byGroup.keys()])
      .map(
        (group) => `
        <div style="font-size:10.5px;font-weight:800;color:var(--text-faint);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 4px">${group}</div>
        <div class="chip-row" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">
          ${byGroup
            .get(group)
            .map(
              (o) => `
            <div class="chip${o.gameId === currentGameId ? " selected" : ""}"
                 data-game-id="${o.gameId}" data-value='${JSON.stringify(o.value)}'>${o.display}${o.sub ? `<div style="font-size:10px;font-weight:600;opacity:0.7;margin-top:2px">${o.sub}</div>` : ""}${o.when ? `<div style="font-size:9.5px;font-weight:600;opacity:0.55;margin-top:1px">${o.when}</div>` : ""}</div>
          `
            )
            .join("")}
        </div>`
      )
      .join("");

    return `
      <div class="pick-game" data-category="${cat}">
        <div class="pick-game-label">${CATEGORY_LABEL[cat]}</div>
        ${subgroupsHtml}
      </div>`;
  }).join("");
}

function statusBadge(result) {
  if (result === "hit") return `<span style="color:var(--positive);font-weight:800">Hit</span>`;
  if (result === "miss") return `<span style="color:var(--negative);font-weight:800">Miss</span>`;
  if (result === "push") return `<span style="color:var(--text-faint);font-weight:800">Push</span>`;
  return `<span style="color:var(--text-faint);font-weight:700">Pending</span>`;
}

function pickLabel(pick) {
  if (pick.type === "total") return `${pick.direction === "over" ? "Over" : "Under"} ${pick.line}`;
  return `${pick.team}${pick.line != null ? " " + fmtLine(pick.line) : " ML"}`;
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

/** Full season view: every pick this player has ever saved, grouped by week,
 * newest first, graded where the game data is still available. */
function renderMyPicks(container, picks, allGames) {
  const entries = Object.entries(picks).map(([groupId, entry]) => {
    const game = allGames.find((g) => g.id === (entry.snapshot?.gameId || groupId.replace(/_(spread|ml|total)$/, "")));
    const result = game ? gradePick(entry.value, game) : null;
    return { groupId, entry, game, result };
  });

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">No picks saved yet this season.</div>';
    return;
  }

  const groups = new Map();
  for (const e of entries) {
    const label = weekGroupLabel(e.entry.snapshot);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(e);
  }

  const sortedLabels = [...groups.keys()].sort((a, b) => {
    const da = groups.get(a)[0]?.entry.snapshot?.date || "";
    const db = groups.get(b)[0]?.entry.snapshot?.date || "";
    return new Date(db) - new Date(da);
  });

  container.innerHTML = sortedLabels
    .map((label) => {
      const rows = groups
        .get(label)
        .map(
          (e) => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px">
          <span>${e.entry.snapshot?.matchup || "?"} — ${pickLabel(e.entry.value)}</span>
          ${statusBadge(e.result)}
        </div>`
        )
        .join("");
      const pts = groups
        .get(label)
        .reduce((s, e) => s + (e.result ? pointsForResult(e.result) : 0), 0);
      return `
        <div class="card">
          <div class="card-title"><span>${label}</span><span>${pts} pts</span></div>
          ${rows}
        </div>`;
    })
    .join("");
}

async function initPicksPage() {
  const select = document.getElementById("player-select");
  const weekSelect = document.getElementById("week-select");
  const container = document.getElementById("games-list");
  const progressEl = document.getElementById("picks-progress");
  const statusTop = document.getElementById("save-status-top");
  const statusBottom = document.getElementById("save-status-bottom");
  const saveBtnTop = document.getElementById("save-btn-top");
  const saveBtnBottom = document.getElementById("save-btn-bottom");
  const myPicksList = document.getElementById("my-picks-list");
  const weekStatusList = document.getElementById("week-status-list");
  const statusSummary = document.getElementById("status-summary");

  const avatarPreview = document.getElementById("player-avatar-preview");
  select.innerHTML = LEAGUE_PLAYERS.map((p) => `<option value="${p.name}">${titleCase(p.name)}</option>`).join("");
  const savedPlayer = localStorage.getItem(PLAYER_KEY) || LEAGUE_PLAYERS[0].name;
  select.value = savedPlayer;
  avatarPreview.innerHTML = avatarHtml(select.value, 32);

  container.innerHTML = '<div class="empty-state">Loading the season\'s games…</div>';
  // NFL odds are posted for essentially the whole season in advance; college odds lag
  // (only appear close to kickoff), but fetch the same wide window anyway — future
  // college weeks just won't have pickable games yet until books actually post lines,
  // which is correct/expected, not a bug.
  const [nfl, cfb, nflDivisions] = await Promise.all([
    fetchScoreboard("nfl", { daysForward: 200 }),
    fetchScoreboard("cfb", { daysForward: 200 }),
    fetchNflDivisions(),
  ]);
  const allGames = [...nfl, ...cfb];
  // NFL preseason (seasonType 1) is exhibition football — backups and roster
  // battles, nothing that should count for a real pick'em league — excluded
  // from what's pickable. (Confirmed this was confusing: it showed up as its
  // own "Preseason Week N" option right alongside real "Week 1".)
  const pickableAll = allGames
    .filter((g) => g.status.state === "pre" && g.odds)
    .filter((g) => !(g.sport === "nfl" && g.seasonType === 1))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const gamesBySport = { nfl: pickableAll.filter((g) => g.sport === "nfl"), cfb: pickableAll.filter((g) => g.sport === "cfb") };

  function weeksFor(sport) {
    const games = gamesBySport[sport];
    const keys = [...new Set(games.map(weekBucketKey))];
    keys.sort((a, b) => {
      const gA = games.find((g) => weekBucketKey(g) === a);
      const gB = games.find((g) => weekBucketKey(g) === b);
      return new Date(gA.date) - new Date(gB.date);
    });
    return keys;
  }

  const weeksBySport = { nfl: weeksFor("nfl"), cfb: weeksFor("cfb") };
  // Each sport remembers its own selected week independently, since NFL/NCAA
  // weeks don't line up on the calendar and both need picks every week.
  const sportWeeks = { nfl: weeksBySport.nfl[0] || null, cfb: weeksBySport.cfb[0] || null };

  let selectedSport = "nfl";
  let currentPicks = await loadPicks(select.value);

  // originalPicks = what's actually saved server-side right now (a snapshot at
  // load time). Used to tell whether a category-swap needs an actual DELETE
  // (the old value was really in the DB) or just a local no-op (it was only a
  // pending, never-saved change within this session).
  let originalPicks = { ...currentPicks };
  const pendingUpserts = new Set();
  const pendingDeletes = new Set();

  function currentWeekKey() {
    return sportWeeks[selectedSport];
  }

  function renderAll() {
    weekSelect.innerHTML =
      weeksBySport[selectedSport].length === 0
        ? `<option value="">No upcoming games</option>`
        : weeksBySport[selectedSport].map((k) => `<option value="${k}">${weekBucketLabel(k, gamesBySport[selectedSport])}</option>`).join("");
    weekSelect.value = currentWeekKey() || "";
    document.getElementById("ncaa-week-note").style.display = selectedSport === "cfb" ? "block" : "none";

    const games = gamesBySport[selectedSport].filter((g) => weekBucketKey(g) === currentWeekKey());
    const slots = slotsForSportWeek(currentPicks, selectedSport, currentWeekKey());
    renderCategoryPools(container, selectedSport, games, slots, nflDivisions);
    renderProgress(progressEl, currentPicks, sportWeeks);
  }

  renderAll();
  renderMyPicks(myPicksList, currentPicks, allGames);
  avatarPreview.innerHTML = avatarHtml(select.value, 32);

  async function switchPlayer() {
    currentPicks = await loadPicks(select.value);
    originalPicks = { ...currentPicks };
    pendingUpserts.clear();
    pendingDeletes.clear();
    avatarPreview.innerHTML = avatarHtml(select.value, 32);
    renderAll();
    renderMyPicks(myPicksList, currentPicks, allGames);
    statusTop.textContent = "";
    statusBottom.textContent = "";
  }

  select.addEventListener("change", switchPlayer);

  document.querySelectorAll("[data-sport]").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll("[data-sport]").forEach((c) => c.classList.remove("selected"));
      el.classList.add("selected");
      selectedSport = el.getAttribute("data-sport");
      renderAll();
      loadAndRenderStatus(); // counts are week-specific, keep them in sync with the toggle
    });
  });

  weekSelect.addEventListener("change", () => {
    sportWeeks[selectedSport] = weekSelect.value;
    renderAll();
    loadAndRenderStatus();
  });

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const catEl = chip.closest("[data-category]");
    const category = catEl.getAttribute("data-category");
    const gameId = chip.getAttribute("data-game-id");
    const value = JSON.parse(chip.getAttribute("data-value"));
    const betType = value.type; // "spread" | "total"
    const newGroupId = partsToGroupId(gameId, betType);

    const games = gamesBySport[selectedSport].filter((g) => weekBucketKey(g) === currentWeekKey());
    const game = games.find((g) => g.id === gameId);

    // Replace whatever was previously filling this (sport, week, category) slot.
    const slots = slotsForSportWeek(currentPicks, selectedSport, currentWeekKey());
    const old = slots[category];
    if (old && old.groupId !== newGroupId) {
      delete currentPicks[old.groupId];
      pendingUpserts.delete(old.groupId);
      if (originalPicks[old.groupId]) {
        pendingDeletes.add(old.groupId);
      }
    }

    currentPicks[newGroupId] = { value, snapshot: game ? gameSnapshot(game) : null };
    pendingUpserts.add(newGroupId);
    pendingDeletes.delete(newGroupId);

    renderAll();
    statusTop.textContent = "";
    statusBottom.textContent = "";
  });

  async function doSave() {
    if (pendingUpserts.size === 0 && pendingDeletes.size === 0) {
      const msg = "Nothing new to save.";
      statusTop.textContent = msg;
      statusBottom.textContent = msg;
      return;
    }

    saveBtnTop.disabled = true;
    saveBtnBottom.disabled = true;
    statusTop.textContent = "Saving…";
    statusBottom.textContent = "Saving…";

    const player = select.value;

    for (const groupId of pendingDeletes) {
      const parts = groupIdToParts(groupId);
      const err = await deletePick(player, parts.gameId, parts.betType);
      if (err) {
        saveBtnTop.disabled = false;
        saveBtnBottom.disabled = false;
        const msg = "Couldn't save — a removed pick's game may have already kicked off. Refresh and try again.";
        statusTop.textContent = msg;
        statusBottom.textContent = msg;
        console.error("deletePick failed:", err);
        return;
      }
    }

    const rows = [...pendingUpserts]
      .filter((id) => currentPicks[id])
      .map((id) => {
        const parts = groupIdToParts(id);
        const entry = currentPicks[id];
        return {
          player_name: player,
          game_id: parts.gameId,
          bet_type: parts.betType,
          pick: entry.value,
          snapshot: entry.snapshot,
          kickoff_at: entry.snapshot?.date,
          updated_at: new Date().toISOString(),
        };
      });
    const { error } = await upsertPicks(player, rows);

    saveBtnTop.disabled = false;
    saveBtnBottom.disabled = false;

    if (error) {
      const msg = "Couldn't save — one of these games may have already kicked off. Refresh and try again.";
      statusTop.textContent = msg;
      statusBottom.textContent = msg;
      console.error("savePicks failed:", error);
      return;
    }

    originalPicks = { ...currentPicks };
    pendingUpserts.clear();
    pendingDeletes.clear();

    renderMyPicks(myPicksList, currentPicks, allGames);
    loadAndRenderStatus();
    const { total } = computeProgress(currentPicks, sportWeeks);
    const msg = `Saved — ${total} of 8 picks made this week for ${titleCase(player)}.`;
    statusTop.textContent = msg;
    statusBottom.textContent = msg;
  }

  saveBtnTop.addEventListener("click", doSave);
  saveBtnBottom.addEventListener("click", doSave);

  // "Who's picked" lives as a collapsible card at the top of Make Picks (not a
  // separate tab, per Neil — more visible where people already are, without
  // permanently pushing the actual picking UI down the page).
  let statusExpanded = false;

  async function loadAndRenderStatus() {
    statusSummary.innerHTML = "<span>Loading who's picked…</span>";
    const allPicksRows = await loadAllPicks();
    const statusList = computeWeekStatus(allPicksRows, sportWeeks);
    const submittedCount = statusList.filter((s) => s.total === 8).length;
    statusSummary.innerHTML = `<span>${submittedCount} of ${statusList.length} submitted this week</span><span style="color:var(--accent)">${statusExpanded ? "▲ Hide" : "▼ Who's in?"}</span>`;
    renderWeekStatus(weekStatusList, statusList);
  }

  // Bound to the summary header only, not the whole card — otherwise a click on a
  // player row inside the expanded list (an <a> to player.html) bubbles up and
  // toggles the card shut at the same moment it navigates away (confirmed bug).
  statusSummary.addEventListener("click", () => {
    statusExpanded = !statusExpanded;
    weekStatusList.style.display = statusExpanded ? "block" : "none";
    loadAndRenderStatus(); // refresh on every expand — other players may have saved since load
  });

  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll("[data-tab]").forEach((c) => c.classList.remove("selected"));
      el.classList.add("selected");
      const tab = el.getAttribute("data-tab");
      document.getElementById("view-week").style.display = tab === "week" ? "block" : "none";
      document.getElementById("view-mine").style.display = tab === "mine" ? "block" : "none";
    });
  });

  loadAndRenderStatus();
}

document.addEventListener("DOMContentLoaded", initPicksPage);
