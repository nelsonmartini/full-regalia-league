/**
 * Picks entry — pulls REAL current/upcoming games (with real live odds) from
 * js/live-scores.js, and now saves to a real shared backend (Supabase) instead
 * of localStorage — see BACKLOG.md for the schema/RLS decisions. Picks are
 * honor-system (no login, just a name picker) but auto-lock at the database
 * level once a game's kickoff time passes — nobody, including this code, can
 * write to a locked pick.
 *
 * Each saved pick stores both the structured value (for grading) and a
 * self-contained snapshot (matchup/date/week/sport) so "My Picks" can still
 * display old picks even after that game rolls out of the live fetch window:
 *   { value: {type:"spread", team:"CAR", line:-1.5}, snapshot: {...} }
 */

const PLAYER_KEY = "fr_selected_player";
const MAX_GAMES_PER_WEEK = 40;

/** groupId is "<gameId>_spread" | "<gameId>_ml" | "<gameId>_total" — the DB
 * stores game_id and bet_type as separate columns, so convert both ways. */
function groupIdToParts(groupId) {
  const m = groupId.match(/^(.+)_(spread|ml|total)$/);
  if (!m) return null;
  return { gameId: m[1], betType: m[2] === "ml" ? "moneyline" : m[2] };
}

function partsToGroupId(gameId, betType) {
  return `${gameId}_${betType === "moneyline" ? "ml" : betType}`;
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

/** Only upserts the groupIds listed in `groupIds` (not the player's whole pick
 * history) — otherwise re-saving would try to re-write old picks whose games
 * have already kicked off, and the database would correctly reject the WHOLE
 * batch for touching a locked row, blocking even the new valid picks. */
async function savePicks(player, picks, groupIds) {
  const rows = groupIds
    .filter((id) => picks[id])
    .map((id) => {
      const parts = groupIdToParts(id);
      const entry = picks[id];
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
  if (rows.length === 0) return { error: null, count: 0 };
  const { error } = await sb.from("picks").upsert(rows, { onConflict: "player_name,game_id,bet_type" });
  return { error, count: rows.length };
}

function fmtLine(n) {
  return n > 0 ? `+${n}` : `${n}`;
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

/** The 3 bet-type sub-groups (spread / moneyline / total) for one game. */
function buildBetGroups(game) {
  const groups = [];
  const away = game.away,
    home = game.home;
  if (!away || !home) return groups;

  if (game.odds && game.odds.homeSpread != null && game.odds.awaySpread != null) {
    groups.push({
      id: `${game.id}_spread`,
      label: "Spread",
      choices: [
        { display: `${away.abbr} ${fmtLine(game.odds.awaySpread)}`, value: { type: "spread", team: away.abbr, line: game.odds.awaySpread } },
        { display: `${home.abbr} ${fmtLine(game.odds.homeSpread)}`, value: { type: "spread", team: home.abbr, line: game.odds.homeSpread } },
      ],
    });
  }

  groups.push({
    id: `${game.id}_ml`,
    label: "Moneyline",
    choices: [
      { display: `${away.abbr} ML`, value: { type: "moneyline", team: away.abbr } },
      { display: `${home.abbr} ML`, value: { type: "moneyline", team: home.abbr } },
    ],
  });

  if (game.odds && game.odds.overUnder != null) {
    groups.push({
      id: `${game.id}_total`,
      label: "Total",
      choices: [
        { display: `Over ${game.odds.overUnder}`, value: { type: "total", direction: "over", line: game.odds.overUnder } },
        { display: `Under ${game.odds.overUnder}`, value: { type: "total", direction: "under", line: game.odds.overUnder } },
      ],
    });
  }

  return groups;
}

function sportLabel(sport) {
  return sport === "nfl" ? "NFL" : "College";
}

const SEASON_PHASE_PREFIX = { 1: "Preseason ", 2: "", 3: "Postseason " };

/** Groups pickable games into "weeks" a person can jump between, scoped to
 * whichever sport is toggled — ESPN resets its week number every season phase
 * (preseason week 1, regular season week 1, and postseason week 1 all exist),
 * so the bucket key must include seasonType or those get merged together
 * incorrectly (confirmed bug: this silently combined preseason/regular-season
 * "Week 1" into one option, sorted by whichever game happened to survive
 * filtering). Falls back to a date-based bucket only if week is ever missing. */
function weekBucketKey(game) {
  return game.week != null ? `w${game.seasonType ?? "x"}-${game.week}` : `d${game.date?.slice(0, 10)}`;
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

/** Order-independent equality for the small plain objects used as pick values.
 * Needed because Postgres/PostgREST returns jsonb object keys alphabetically
 * sorted, while freshly-built in-memory values keep insertion order — plain
 * JSON.stringify comparison silently breaks "is this already picked?" once a
 * value has round-tripped through Supabase (confirmed bug, fixed here). */
function sameValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a),
    keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
}

function renderGames(container, games, picks) {
  const withGroups = games.map((g) => ({ game: g, groups: buildBetGroups(g) })).filter((x) => x.groups.length > 0);

  if (withGroups.length === 0) {
    container.innerHTML = '<div class="empty-state">No games with odds available right now — check back closer to kickoff.</div>';
    return;
  }

  container.innerHTML = withGroups
    .map(({ game, groups }) => {
      const when = typeof formatFullDate === "function" ? formatFullDate(game.date) : game.date;
      const phasePrefix = SEASON_PHASE_PREFIX[game.seasonType] ?? "";
      const weekBadge = game.week ? ` · ${sportLabel(game.sport)} ${phasePrefix}Week ${game.week}` : ` · ${sportLabel(game.sport)}`;
      const subgroups = groups
        .map((g) => {
          const saved = picks[g.id];
          return `
            <div class="pick-game" data-group="${g.id}">
              <div class="pick-game-label">${g.label}</div>
              <div class="chip-row">
                ${g.choices
                  .map(
                    (c) => `
                  <div class="chip${saved && sameValue(saved.value, c.value) ? " selected" : ""}"
                       data-value='${JSON.stringify(c.value)}'>${c.display}</div>
                `
                  )
                  .join("")}
              </div>
            </div>`;
        })
        .join("");

      return `
        <div class="card" data-game-card="${game.id}">
          <div class="card-title" style="text-transform:none;letter-spacing:0">
            <span style="color:var(--text);font-weight:800;font-size:15px">${game.away?.abbr} @ ${game.home?.abbr}</span>
            <span style="font-weight:600;color:var(--text-faint);font-size:11.5px">${when}${weekBadge}</span>
          </div>
          ${subgroups}
        </div>`;
    })
    .join("");
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
  const statusTop = document.getElementById("save-status-top");
  const statusBottom = document.getElementById("save-status-bottom");
  const saveBtnTop = document.getElementById("save-btn-top");
  const saveBtnBottom = document.getElementById("save-btn-bottom");
  const myPicksList = document.getElementById("my-picks-list");

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
  const [nfl, cfb] = await Promise.all([fetchScoreboard("nfl", { daysForward: 200 }), fetchScoreboard("cfb", { daysForward: 200 })]);
  const allGames = [...nfl, ...cfb];

  const pickableAll = allGames.filter((g) => g.status.state === "pre" && g.odds).sort((a, b) => new Date(a.date) - new Date(b.date));

  let selectedSport = "nfl";

  function gamesForSport() {
    return pickableAll.filter((g) => g.sport === selectedSport);
  }

  // Build the week picker from whatever weeks actually have pickable games, for the
  // currently toggled sport.
  function rebuildWeekOptions() {
    const games = gamesForSport();
    const weekKeys = [...new Set(games.map(weekBucketKey))];
    weekKeys.sort((a, b) => {
      const gA = games.find((g) => weekBucketKey(g) === a);
      const gB = games.find((g) => weekBucketKey(g) === b);
      return new Date(gA.date) - new Date(gB.date);
    });
    if (weekKeys.length === 0) {
      weekSelect.innerHTML = `<option value="">No upcoming games</option>`;
    } else {
      weekSelect.innerHTML = weekKeys.map((k) => `<option value="${k}">${weekBucketLabel(k, games)}</option>`).join("");
    }
    weekSelect.value = weekKeys[0] || "";
  }

  rebuildWeekOptions();

  function pickableForSelectedWeek() {
    return gamesForSport()
      .filter((g) => weekBucketKey(g) === weekSelect.value)
      .slice(0, MAX_GAMES_PER_WEEK);
  }

  let pickable = pickableForSelectedWeek();
  let currentPicks = await loadPicks(select.value);
  renderGames(container, pickable, currentPicks);
  renderMyPicks(myPicksList, currentPicks, allGames);

  async function refresh() {
    currentPicks = await loadPicks(select.value);
    avatarPreview.innerHTML = avatarHtml(select.value, 32);
    renderGames(container, pickable, currentPicks);
    renderMyPicks(myPicksList, currentPicks, allGames);
    statusTop.textContent = "";
    statusBottom.textContent = "";
  }

  select.addEventListener("change", refresh);

  document.querySelectorAll("[data-sport]").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll("[data-sport]").forEach((c) => c.classList.remove("selected"));
      el.classList.add("selected");
      selectedSport = el.getAttribute("data-sport");
      rebuildWeekOptions();
      pickable = pickableForSelectedWeek();
      renderGames(container, pickable, currentPicks);
      statusTop.textContent = "";
      statusBottom.textContent = "";
    });
  });

  weekSelect.addEventListener("change", () => {
    pickable = pickableForSelectedWeek();
    renderGames(container, pickable, currentPicks);
    statusTop.textContent = "";
    statusBottom.textContent = "";
  });

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const groupEl = chip.closest(".pick-game");
    const cardEl = chip.closest("[data-game-card]");
    const groupId = groupEl.getAttribute("data-group");
    const gameId = cardEl.getAttribute("data-game-card");
    const game = pickable.find((g) => g.id === gameId);

    currentPicks[groupId] = {
      value: JSON.parse(chip.getAttribute("data-value")),
      snapshot: game ? gameSnapshot(game) : null,
    };
    groupEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    statusTop.textContent = "";
    statusBottom.textContent = "";
  });

  async function doSave() {
    saveBtnTop.disabled = true;
    saveBtnBottom.disabled = true;
    statusTop.textContent = "Saving…";
    statusBottom.textContent = "Saving…";

    // Only the groups for games currently on screen — not the player's whole
    // pick history — so re-saving never touches an already-locked old pick.
    const visibleGroupIds = pickable.flatMap(buildBetGroups).map((g) => g.id);
    const { error, count } = await savePicks(select.value, currentPicks, visibleGroupIds);

    saveBtnTop.disabled = false;
    saveBtnBottom.disabled = false;

    if (error) {
      const msg = "Couldn't save — one of these games may have already kicked off. Refresh and try again.";
      statusTop.textContent = msg;
      statusBottom.textContent = msg;
      console.error("savePicks failed:", error);
      return;
    }

    renderMyPicks(myPicksList, currentPicks, allGames);
    const total = pickable.flatMap(buildBetGroups).length;
    const msg = `Saved ${count} of ${total} picks for ${titleCase(select.value)}.`;
    statusTop.textContent = msg;
    statusBottom.textContent = msg;
  }

  saveBtnTop.addEventListener("click", doSave);
  saveBtnBottom.addEventListener("click", doSave);
}

document.addEventListener("DOMContentLoaded", initPicksPage);
