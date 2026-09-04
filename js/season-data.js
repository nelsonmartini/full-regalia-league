/**
 * Live standings + history — computed from the real Supabase `picks` table
 * plus live/completed game data (js/live-scores.js) and the grading engine
 * (js/grading.js). Replaces the old workbook-snapshot files
 * (standings-data.js / history-data.js, retired 2026-08-14 — "start fresh
 * for the new season," per Neil. Old season's numbers weren't migrated;
 * this season is the first one tracked live in Supabase).
 *
 * Every page using this file must `await loadPlayers()` (js/players.js)
 * before calling renderStandingsRow(), and load js/pick-utils.js,
 * js/live-scores.js and js/grading.js first.
 */

/** A small flame badge once a player's current hit streak is long enough to
 * mean something — 3+ in a row. Kept as a separate, reusable snippet since
 * it shows up in both standings rows and (eventually) player.html. */
function streakBadgeHtml(streak) {
  return streak >= 3 ? `<span class="streak-badge" title="${streak} hits in a row">🔥${streak}</span>` : "";
}

function renderStandingsRow(player, rank) {
  const rankClass = rank <= 3 ? ` rank-${rank}` : "";
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
  return `
    <a class="standings-row${rankClass}" href="player.html?name=${encodeURIComponent(player.name)}" style="cursor:pointer">
      <div class="standings-rank">${medal}</div>
      ${avatarHtml(player.name, 32)}
      <div class="standings-name">${titleCase(player.name)}${streakBadgeHtml(player.streak)}</div>
      <div class="standings-points">${player.points}</div>
      <div class="standings-winpct">${player.winPct.toFixed(1)}%</div>
    </a>`;
}

/** Home page's "Top of the standings" preview — same row, minus the win %
 * column (Neil: keep the mini preview to just points, full board still
 * shows both). Grid drops to 4 columns since there's one fewer cell. Rank
 * shows as a plain numeral in the same cursive font as the brand quote/
 * topbar (Neil: "1,2,3 font is the cursive") instead of medal emoji — this
 * preview is always exactly the top 3, so a medal for every single row
 * added nothing a numeral doesn't already say, once it's styled to feel
 * like part of the brand rather than plain body text. */
function renderStandingsRowCompact(player, rank) {
  const rankClass = rank <= 3 ? ` rank-${rank}` : "";
  return `
    <a class="standings-row standings-row-compact${rankClass}" href="player.html?name=${encodeURIComponent(player.name)}" style="cursor:pointer">
      <div class="standings-rank standings-rank-cursive">${rank}</div>
      ${avatarHtml(player.name, 24)}
      <div class="standings-name">${titleCase(player.name)}${streakBadgeHtml(player.streak)}</div>
      <div class="standings-points">${player.points}</div>
    </a>`;
}

/** Every saved pick, across every player/week. */
async function loadSeasonPicks() {
  const { data, error } = await sb.from("picks").select("player_name, game_id, bet_type, pick, snapshot, updated_at");
  if (error) {
    console.error("loadSeasonPicks failed:", error);
    return [];
  }
  return data;
}

/** Wide date window so every game any pick could reference (this season,
 * past or future) is covered — grading needs the FINAL score of past games,
 * not just the upcoming-games window the Picks page fetches.
 *
 * daysBack/daysForward of 200+200 (400 days total) used to silently make
 * ESPN's scoreboard endpoint reject the request outright — confirmed
 * directly (2026-08-30): a request spanning ~360 days succeeds, one
 * spanning 400 does not (HTTP 400, "Failed to get events endpoint").
 * ESPN enforces an undocumented max total date-range width. This is what
 * caused every player to show 0 points on Standings/History/Player —
 * NOT a bug in this app's own grading logic (verified separately, several
 * times), and not specific to any one device/network — every fetch this
 * function ever made was rejected before a single game came back. The
 * Picks page never hit this because it only requests ~210 days
 * (daysForward: 200, default daysBack: 10), comfortably under the limit —
 * which is exactly why Picks kept working the whole time this was broken.
 * 150+150 (300 days total) keeps a solid safety margin under the ~360-400
 * boundary while still covering nearly a full season's history either
 * direction from "today." */
async function loadSeasonGames() {
  const [nfl, cfb] = await Promise.all([
    fetchScoreboard("nfl", { daysBack: 150, daysForward: 150 }),
    fetchScoreboard("cfb", { daysBack: 150, daysForward: 150 }),
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
  const byName = new Map(players.map((p) => [p.name, { name: p.name, points: 0, graded: 0, hits: 0, picks: [] }]));
  for (const gp of gradedPicks) {
    const entry = byName.get(gp.player_name);
    if (!entry || !gp.result) continue;
    entry.graded++;
    entry.points += gp.points;
    if (gp.result === "hit") entry.hits++;
    entry.picks.push(gp);
  }
  return [...byName.values()]
    .map((e) => ({ ...e, winPct: e.graded ? (e.hits / e.graded) * 100 : 0, streak: computeCurrentStreak(e.picks) }))
    .sort((a, b) => b.points - a.points);
}

/** Current consecutive-hit streak, walking backwards from the most recently
 * graded pick (by kickoff date) — shown as a small flame badge once it's
 * long enough to mean something. A push or a miss both end it the moment
 * they show up; only real, un-hedged hits keep it alive. */
function computeCurrentStreak(picks) {
  const sorted = [...picks].filter((p) => p.snapshot?.date).sort((a, b) => new Date(b.snapshot.date) - new Date(a.snapshot.date));
  let streak = 0;
  for (const p of sorted) {
    if (p.result !== "hit") break;
    streak++;
  }
  return streak;
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
    hits: g.picks.filter((p) => p.result === "hit").length,
    total: g.picks.length,
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

/** Plain-text recap for sharing — kept separate from the HTML card so the
 * share text stays clean (no markup) regardless of how the card itself
 * renders. */
function historyEntryShareText(entry) {
  return `${titleCase(entry.name)} — ${entry.label}\n${entry.hits}/${entry.total} picks hit · ${entry.points} pts\nFull Regalia League`;
}

/** Shared by every "share this week" button (history.html and
 * player.html both use renderHistoryEntry). Prefers the native share sheet
 * (works great on mobile Safari/PWA — Messages, etc.); falls back to
 * clipboard + a quick "Copied!" swap on the button itself for browsers
 * without navigator.share (mainly desktop). A user backing out of the
 * share sheet rejects the promise — not a real error, so it's swallowed
 * rather than surfaced. */
async function shareHistoryEntry(btn, encodedText) {
  const text = decodeURIComponent(encodedText);
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch {
      // cancelled — nothing to do
    }
    return;
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1500);
  }
}

function renderHistoryEntry(entry) {
  const rows = entry.picks.map(historyEntryRow).join("");
  const statsText = entry.graded ? `${entry.hits}/${entry.total} · ${entry.points} pts` : "";
  const shareBtn = entry.graded
    ? `<button class="share-week-btn" onclick="shareHistoryEntry(this, '${encodeURIComponent(historyEntryShareText(entry))}')" title="Share this week">📤</button>`
    : "";
  return `
    <div class="card">
      <div class="card-title">
        <span style="display:flex;align-items:center;gap:8px">${entry.label} —
          <a class="link" href="player.html?name=${encodeURIComponent(entry.name)}" style="display:inline-flex;align-items:center;gap:6px">
            ${avatarHtml(entry.name, 20)}${titleCase(entry.name)}
          </a>
        </span>
        <span style="display:flex;align-items:center;gap:6px">${statsText}${shareBtn}</span>
      </div>
      ${rows || '<div style="color:var(--text-faint);font-size:13px">No picks recorded.</div>'}
    </div>`;
}
