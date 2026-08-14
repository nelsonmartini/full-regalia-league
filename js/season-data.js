/**
 * Live standings + history — computed from the real Supabase `picks` table
 * plus live/completed game data (js/live-scores.js) and the grading engine
 * (js/grading.js). Replaces the old workbook-snapshot files
 * (standings-data.js / history-data.js, retired 2026-08-14 — "start fresh
 * for the new season," per Neil. Old season's numbers weren't migrated;
 * this season is the first one tracked live in Supabase).
 *
 * Every page using this file must `await loadPlayers()` (js/players.js)
 * before calling findCouple()/renderStandingsRow(), and load js/pick-utils.js,
 * js/live-scores.js and js/grading.js first.
 */

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
      ${avatarHtml(player.name, 32)}
      <div class="standings-name">${titleCase(player.name)}${couple ? `<span class="couple">${couple}</span>` : ""}</div>
      <div class="standings-winpct">${player.winPct.toFixed(1)}%</div>
      <div class="standings-points">${player.points}</div>
    </a>`;
}

/** Every saved pick, across every player/week. */
async function loadSeasonPicks() {
  const { data, error } = await sb.from("picks").select("player_name, game_id, bet_type, pick, snapshot");
  if (error) {
    console.error("loadSeasonPicks failed:", error);
    return [];
  }
  return data;
}

/** Wide date window so every game any pick could reference (this season,
 * past or future) is covered — grading needs the FINAL score of past games,
 * not just the upcoming-games window the Picks page fetches. */
async function loadSeasonGames() {
  const [nfl, cfb] = await Promise.all([
    fetchScoreboard("nfl", { daysBack: 200, daysForward: 200 }),
    fetchScoreboard("cfb", { daysBack: 200, daysForward: 200 }),
  ]);
  return [...nfl, ...cfb];
}

/** Attach the matching game + grade to each saved pick. result is null if the
 * game can't be found (rolled out of the fetch window) or hasn't finished. */
function gradeSeasonPicks(picksRows, games) {
  return picksRows.map((row) => {
    const game = games.find((g) => g.id === row.game_id) || null;
    const result = game ? gradePick(row.pick, game) : null;
    return { ...row, game, result, points: result ? pointsForResult(result) : 0 };
  });
}

/** One row per current roster player — a player removed from the roster
 * (see js/admin.js) drops out of standings even if their old picks are still
 * sitting in the DB, since the roster (not a scan of distinct picks) is what
 * this iterates. */
function computeStandings(gradedPicks, players) {
  const byName = new Map(players.map((p) => [p.name, { name: p.name, points: 0, graded: 0, hits: 0 }]));
  for (const gp of gradedPicks) {
    const entry = byName.get(gp.player_name);
    if (!entry || !gp.result) continue;
    entry.graded++;
    entry.points += gp.points;
    if (gp.result === "hit") entry.hits++;
  }
  return [...byName.values()]
    .map((e) => ({ ...e, winPct: e.graded ? (e.hits / e.graded) * 100 : 0 }))
    .sort((a, b) => b.points - a.points);
}

/** One entry per (player, sport, week) — the unit History/Player pages
 * display, mirroring how picks.js's "My Picks" groups a single player's own
 * picks (same weekGroupLabel/weekBucketKeyFromSnapshot from pick-utils.js). */
function computeHistoryEntries(gradedPicks) {
  const groups = new Map();
  for (const gp of gradedPicks) {
    const snap = gp.snapshot;
    if (!snap) continue;
    const key = `${gp.player_name}__${snap.sport}__${weekBucketKeyFromSnapshot(snap)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        name: gp.player_name,
        sport: snap.sport,
        weekKey: weekBucketKeyFromSnapshot(snap),
        label: weekGroupLabel(snap),
        date: snap.date,
        picks: [],
      });
    }
    groups.get(key).picks.push(gp);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    points: g.picks.reduce((s, p) => s + (p.result ? p.points : 0), 0),
    graded: g.picks.some((p) => p.result != null),
  }));
}

function historyEntryRow(pick) {
  const catLabel = CATEGORY_LABEL[pickCategory(pick.pick)] || sportLabel(pick.snapshot?.sport);
  return `
    <div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;font-size:13px">
      <span style="color:var(--text-dim)">${catLabel}</span>
      <span style="text-align:right">${pick.snapshot?.matchup || "?"} — ${pickLabel(pick.pick)} ${statusBadge(pick.result)}</span>
    </div>`;
}

function renderHistoryEntry(entry) {
  const rows = entry.picks.map(historyEntryRow).join("");
  return `
    <div class="card">
      <div class="card-title">
        <span style="display:flex;align-items:center;gap:8px">${entry.label} —
          <a class="link" href="player.html?name=${encodeURIComponent(entry.name)}" style="display:inline-flex;align-items:center;gap:6px">
            ${avatarHtml(entry.name, 20)}${titleCase(entry.name)}
          </a>
        </span>
        <span>${entry.graded ? entry.points + " pts" : ""}</span>
      </div>
      ${rows || '<div style="color:var(--text-faint);font-size:13px">No picks recorded.</div>'}
    </div>`;
}
