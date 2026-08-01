/**
 * Picks entry — pulls REAL current/upcoming games (with real live odds) from
 * js/live-scores.js. Selections still save to *this browser's* local storage
 * only, not a shared backend yet (see ROADMAP.md/BACKLOG.md — that's now a
 * deliberate "real backend" project, not just a Sheet-read).
 *
 * Each saved pick stores both the structured value (for grading) and a
 * self-contained snapshot (matchup/date/week/sport) so "My Picks" can still
 * display old picks even after that game rolls out of the live fetch window:
 *   { value: {type:"spread", team:"CAR", line:-1.5}, snapshot: {...} }
 */

const PLAYER_KEY = "fr_selected_player";
const MAX_GAMES = 10;

function picksKey(player) {
  return `fr_picks_v3::${player}`;
}

function loadPicks(player) {
  try {
    return JSON.parse(localStorage.getItem(picksKey(player))) || {};
  } catch {
    return {};
  }
}

function savePicks(player, picks) {
  localStorage.setItem(picksKey(player), JSON.stringify(picks));
  localStorage.setItem(PLAYER_KEY, player);
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

function renderGames(container, games, picks) {
  const withGroups = games.map((g) => ({ game: g, groups: buildBetGroups(g) })).filter((x) => x.groups.length > 0);

  if (withGroups.length === 0) {
    container.innerHTML = '<div class="empty-state">No games with odds available right now — check back closer to kickoff.</div>';
    return;
  }

  container.innerHTML = withGroups
    .map(({ game, groups }) => {
      const when = typeof formatFullDate === "function" ? formatFullDate(game.date) : game.date;
      const weekBadge = game.week ? ` · ${sportLabel(game.sport)} Week ${game.week}` : ` · ${sportLabel(game.sport)}`;
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
                  <div class="chip${saved && JSON.stringify(saved.value) === JSON.stringify(c.value) ? " selected" : ""}"
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
  if (snapshot.week) return `${sportLabel(snapshot.sport)} · Week ${snapshot.week}`;
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
  const container = document.getElementById("games-list");
  const statusTop = document.getElementById("save-status-top");
  const statusBottom = document.getElementById("save-status-bottom");
  const saveBtnTop = document.getElementById("save-btn-top");
  const saveBtnBottom = document.getElementById("save-btn-bottom");
  const myPicksList = document.getElementById("my-picks-list");

  select.innerHTML = LEAGUE_PLAYERS.map((p) => `<option value="${p.name}">${titleCase(p.name)}</option>`).join("");
  const savedPlayer = localStorage.getItem(PLAYER_KEY) || LEAGUE_PLAYERS[0].name;
  select.value = savedPlayer;

  container.innerHTML = '<div class="empty-state">Loading games…</div>';
  const allGames = await loadAllGames();
  const pickable = allGames
    .filter((g) => g.status.state === "pre" && g.odds)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, MAX_GAMES);

  let currentPicks = loadPicks(select.value);
  renderGames(container, pickable, currentPicks);
  renderMyPicks(myPicksList, currentPicks, allGames);

  function refresh() {
    currentPicks = loadPicks(select.value);
    renderGames(container, pickable, currentPicks);
    renderMyPicks(myPicksList, currentPicks, allGames);
    statusTop.textContent = "";
    statusBottom.textContent = "";
  }

  select.addEventListener("change", refresh);

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

  function doSave() {
    savePicks(select.value, currentPicks);
    renderMyPicks(myPicksList, currentPicks, allGames);
    const count = Object.keys(currentPicks).length;
    const total = pickable.flatMap(buildBetGroups).length;
    const msg = `Saved ${count} of ${total} picks for ${titleCase(select.value)} — on this device only.`;
    statusTop.textContent = msg;
    statusBottom.textContent = msg;
  }

  saveBtnTop.addEventListener("click", doSave);
  saveBtnBottom.addEventListener("click", doSave);
}

document.addEventListener("DOMContentLoaded", initPicksPage);
