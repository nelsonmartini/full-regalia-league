/**
 * Picks entry — pulls REAL current games (with real live odds) from
 * js/live-scores.js, instead of the fake sample matchups from the first pass.
 * Selections still save to *this browser's* local storage only, not a shared
 * backend yet (see ROADMAP.md "Picks submission" decision) — but because the
 * games and lines are now real, saved picks can be auto-graded once a game
 * goes final (js/grading.js), which is the whole point.
 *
 * Each pick is stored as a structured object (not free text) so grading.js can
 * compare it against a final score without re-parsing strings:
 *   { type: "spread", team: "CAR", line: -1.5 }
 *   { type: "moneyline", team: "CAR" }
 *   { type: "total", direction: "over" | "under", line: 36.5 }
 */

const PLAYER_KEY = "fr_selected_player";
const MAX_GAMES = 8;

function picksKey(player) {
  return `fr_picks_v2::${player}`;
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

/** Build the pick "questions" (spread / moneyline / total) for one game. */
function buildPickGroups(game) {
  const groups = [];
  const away = game.away,
    home = game.home;
  if (!away || !home) return groups;

  if (game.odds && game.odds.homeSpread != null && game.odds.awaySpread != null) {
    groups.push({
      id: `${game.id}_spread`,
      label: `${away.abbr} @ ${home.abbr} — Spread`,
      choices: [
        { display: `${away.abbr} ${fmtLine(game.odds.awaySpread)}`, value: { type: "spread", team: away.abbr, line: game.odds.awaySpread } },
        { display: `${home.abbr} ${fmtLine(game.odds.homeSpread)}`, value: { type: "spread", team: home.abbr, line: game.odds.homeSpread } },
      ],
    });
  }

  groups.push({
    id: `${game.id}_ml`,
    label: `${away.abbr} @ ${home.abbr} — Moneyline`,
    choices: [
      { display: `${away.abbr} ML`, value: { type: "moneyline", team: away.abbr } },
      { display: `${home.abbr} ML`, value: { type: "moneyline", team: home.abbr } },
    ],
  });

  if (game.odds && game.odds.overUnder != null) {
    groups.push({
      id: `${game.id}_total`,
      label: `${away.abbr} @ ${home.abbr} — Total`,
      choices: [
        { display: `Over ${game.odds.overUnder}`, value: { type: "total", direction: "over", line: game.odds.overUnder } },
        { display: `Under ${game.odds.overUnder}`, value: { type: "total", direction: "under", line: game.odds.overUnder } },
      ],
    });
  }

  return groups;
}

function fmtLine(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

function renderGames(container, games, picks) {
  const groups = games.flatMap(buildPickGroups);
  if (groups.length === 0) {
    container.innerHTML = '<div class="empty-state">No games with odds available right now — check back closer to kickoff.</div>';
    return;
  }
  container.innerHTML = groups
    .map((g) => {
      const saved = picks[g.id];
      return `
        <div class="pick-game" data-group="${g.id}">
          <div class="pick-game-label">${g.label}</div>
          <div class="chip-row">
            ${g.choices
              .map(
                (c) => `
              <div class="chip${saved && JSON.stringify(saved) === JSON.stringify(c.value) ? " selected" : ""}"
                   data-value='${JSON.stringify(c.value)}'>${c.display}</div>
            `
              )
              .join("")}
          </div>
        </div>`;
    })
    .join("");
}

/** groupId is "<gameId>_spread" | "<gameId>_ml" | "<gameId>_total" — recover the game id. */
function gameIdFromGroup(groupId) {
  return groupId.replace(/_(spread|ml|total)$/, "");
}

function renderResults(container, picks, allGames) {
  const entries = Object.entries(picks);
  const graded = entries
    .map(([groupId, pick]) => {
      const game = allGames.find((g) => g.id === gameIdFromGroup(groupId));
      const result = game ? gradePick(pick, game) : null;
      return { groupId, pick, game, result };
    })
    .filter((e) => e.result !== null);

  if (graded.length === 0) {
    container.closest("#results-card").style.display = "none";
    return;
  }
  container.closest("#results-card").style.display = "block";

  const totalPts = graded.reduce((s, e) => s + pointsForResult(e.result), 0);
  container.innerHTML =
    graded
      .map((e) => {
        const label = e.pick.type === "total" ? `${e.pick.direction} ${e.pick.line}` : `${e.pick.team}${e.pick.line != null ? " " + fmtLine(e.pick.line) : " ML"}`;
        const color = e.result === "hit" ? "var(--positive)" : e.result === "miss" ? "var(--negative)" : "var(--text-faint)";
        return `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px">
          <span>${e.game.away.abbr} @ ${e.game.home.abbr} — ${label}</span>
          <span style="color:${color};font-weight:800;text-transform:capitalize">${e.result}</span>
        </div>`;
      })
      .join("") +
    `<div class="divider"></div><div style="display:flex;justify-content:space-between;font-weight:800"><span>Total</span><span>${totalPts} pts</span></div>`;
}

async function initPicksPage() {
  const select = document.getElementById("player-select");
  const container = document.getElementById("games-list");
  const status = document.getElementById("save-status");
  const saveBtn = document.getElementById("save-btn");
  const resultsList = document.getElementById("results-list");

  select.innerHTML = LEAGUE_PLAYERS.map((p) => `<option value="${p.name}">${titleCase(p.name)}</option>`).join("");
  const savedPlayer = localStorage.getItem(PLAYER_KEY) || LEAGUE_PLAYERS[0].name;
  select.value = savedPlayer;

  container.innerHTML = '<div class="empty-state">Loading this week\'s games…</div>';
  const allGames = await loadAllGames();
  // Only games that haven't kicked off yet, that have odds to pick against, soonest first.
  const pickable = allGames
    .filter((g) => g.status.state === "pre" && g.odds)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, MAX_GAMES);

  let currentPicks = loadPicks(select.value);
  renderGames(container, pickable, currentPicks);
  renderResults(resultsList, currentPicks, allGames);

  select.addEventListener("change", () => {
    currentPicks = loadPicks(select.value);
    renderGames(container, pickable, currentPicks);
    renderResults(resultsList, currentPicks, allGames);
    status.textContent = "";
  });

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const groupEl = chip.closest(".pick-game");
    const groupId = groupEl.getAttribute("data-group");
    currentPicks[groupId] = JSON.parse(chip.getAttribute("data-value"));
    groupEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    status.textContent = "";
  });

  saveBtn.addEventListener("click", () => {
    savePicks(select.value, currentPicks);
    renderResults(resultsList, currentPicks, allGames);
    const count = Object.keys(currentPicks).length;
    const total = pickable.flatMap(buildPickGroups).length;
    status.textContent = `Saved ${count} of ${total} picks for ${titleCase(select.value)} — on this device only.`;
  });
}

document.addEventListener("DOMContentLoaded", initPicksPage);
