/**
 * BETA — picks-entry UI only. Selections save to *this browser's* local storage,
 * not to any shared backend yet. That's the intentional scope for tonight (see
 * ROADMAP.md "Picks submission" decision) — the point right now is proving out an
 * entry experience people actually enjoy using, before wiring up a real write-back.
 *
 * Game matchups below are SAMPLE data, not live odds — live games get wired in via
 * the scores/odds integration described in BACKLOG.md.
 */
const GAMES = [
  {
    id: "nfl_spread",
    label: "NFL Wild Card — Spread",
    sub: "Sample matchup: Chiefs -6.5 @ Broncos +6.5",
    options: ["Chiefs -6.5", "Broncos +6.5"],
  },
  {
    id: "nfl_underdog_ml",
    label: "NFL Wild Card — Underdog Moneyline",
    sub: "Will the Broncos win outright?",
    options: ["Broncos ML", "No"],
  },
  {
    id: "nfl_total",
    label: "NFL Wild Card — Over/Under 44.5",
    sub: "",
    options: ["Over 44.5", "Under 44.5"],
  },
  {
    id: "college_1",
    label: "College Game 1 — Spread",
    sub: "Sample matchup: Georgia -7 vs Ole Miss +7",
    options: ["Georgia -7", "Ole Miss +7"],
  },
  {
    id: "college_2",
    label: "College Game 2 — Spread",
    sub: "Sample matchup: Oregon -3.5 vs Indiana +3.5",
    options: ["Oregon -3.5", "Indiana +3.5"],
  },
];

const PLAYER_KEY = "fr_selected_player";
function picksKey(player) {
  return `fr_picks::${player}`;
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

function renderGames(container, picks) {
  container.innerHTML = GAMES.map((game) => `
    <div class="pick-game" data-game="${game.id}">
      <div class="pick-game-label">${game.label}${game.sub ? `<br><span style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--text-dim)">${game.sub}</span>` : ""}</div>
      <div class="chip-row">
        ${game.options.map((opt) => `
          <div class="chip${picks[game.id] === opt ? " selected" : ""}" data-value="${opt}">${opt}</div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function initPicksPage() {
  const select = document.getElementById("player-select");
  const container = document.getElementById("games-list");
  const status = document.getElementById("save-status");
  const saveBtn = document.getElementById("save-btn");

  select.innerHTML = LEAGUE_PLAYERS
    .map((p) => `<option value="${p.name}">${titleCase(p.name)}</option>`)
    .join("");

  const savedPlayer = localStorage.getItem(PLAYER_KEY) || LEAGUE_PLAYERS[0].name;
  select.value = savedPlayer;

  let currentPicks = loadPicks(select.value);
  renderGames(container, currentPicks);

  select.addEventListener("change", () => {
    currentPicks = loadPicks(select.value);
    renderGames(container, currentPicks);
    status.textContent = "";
  });

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const gameEl = chip.closest(".pick-game");
    const gameId = gameEl.getAttribute("data-game");
    currentPicks[gameId] = chip.getAttribute("data-value");
    gameEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    status.textContent = "";
  });

  saveBtn.addEventListener("click", () => {
    savePicks(select.value, currentPicks);
    const count = Object.keys(currentPicks).length;
    status.textContent = `Saved ${count} of ${GAMES.length} picks for ${titleCase(select.value)} — on this device only.`;
  });
}

document.addEventListener("DOMContentLoaded", initPicksPage);
