/**
 * SAMPLE DATA — pulled from the existing workbook's Standings tab as a snapshot.
 * This is a placeholder so the page has something real to show tonight.
 * Next step (see BACKLOG.md): replace this file's contents with a fetch() against
 * the Google Sheet's published CSV, so it updates itself instead of being edited by hand.
 */
const STANDINGS = [
  { name: "CONNOR", points: 70.5, winPct: 55.51, paid: false },
  { name: "DREW", points: 65, winPct: 50.78, paid: false },
  { name: "JACOB", points: 65, winPct: 50.78, paid: true },
  { name: "JACK", points: 62, winPct: 56.36, paid: true },
  { name: "NICK", points: 61.5, winPct: 48.05, paid: true },
  { name: "ALEX", points: 61, winPct: 47.66, paid: true },
  { name: "CALLI", points: 59.5, winPct: 47.22, paid: true },
  { name: "EMILY", points: 58, winPct: 46.77, paid: true },
  { name: "JOSIE", points: 54.5, winPct: 49.55, paid: true },
  { name: "CARLIE", points: 54.5, winPct: 46.58, paid: true },
  { name: "MICHAELA", points: 40.5, winPct: 44.02, paid: false },
  { name: "EMMA", points: 36.5, winPct: 51.41, paid: true },
  { name: "LOUIE", points: 27.5, winPct: 38.73, paid: true },
  { name: "SEAN", points: 27, winPct: 52.94, paid: false },
  { name: "PHIL", points: 17, winPct: 47.22, paid: true },
].sort((a, b) => b.points - a.points);

function findCouple(name) {
  const p = LEAGUE_PLAYERS.find((x) => x.name === name);
  return p ? p.couple : null;
}

function renderStandingsRow(player, rank) {
  const couple = findCouple(player.name);
  const rankClass = rank <= 3 ? ` rank-${rank}` : "";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
  return `
    <a class="standings-row${rankClass}" href="player.html?name=${encodeURIComponent(player.name)}" style="cursor:pointer">
      <div class="standings-rank">${medal}</div>
      <div class="standings-name">${titleCase(player.name)}${couple ? `<span class="couple">${couple}</span>` : ""}</div>
      <div class="standings-winpct">${player.winPct.toFixed(1)}%</div>
      <div class="standings-points">${player.points}</div>
    </a>`;
}
