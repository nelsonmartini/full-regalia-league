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

// CATEGORIES/CATEGORY_LABEL/SPORTS/SEASON_PHASE_PREFIX/fmtLine/sportLabel/
// pickCategory/pickLabel/weekBucketKeyFromSnapshot/weekGroupLabel/statusBadge/
// NCAA_CONFERENCES/teamGroupLabel now live in js/pick-utils.js (loaded before
// this file), shared with the Standings/History/Player pages and live.html.
const PLAYER_KEY = "fr_selected_player";
const CATEGORY_ICON = { minus: "−", plus: "+", over: "▲", under: "▼" };

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

function renderWeekStatus(container, statusList, sportWeeks) {
  const expectedTotal = expectedPickTotal(sportWeeks);
  container.innerHTML = statusList
    .map((s) => {
      const badge =
        expectedTotal > 0 && s.total === expectedTotal
          ? `<span style="color:var(--positive);font-weight:800;font-size:12.5px">✅ All set</span>`
          : s.total === 0
          ? `<span style="color:var(--text-faint);font-weight:700;font-size:12.5px">Not started</span>`
          : `<span style="color:var(--accent);font-weight:700;font-size:12.5px">In progress</span>`;
      // Only show a sport's x/4 count when that sport actually has games to
      // pick this week — showing "NFL 0/4" when NFL has nothing posted yet
      // reads like a player forgot, not like there's nothing to pick.
      const parts = [];
      if (sportWeeks.nfl != null) parts.push(`NFL ${s.nfl}/4`);
      if (sportWeeks.cfb != null) parts.push(`NCAA ${s.cfb}/4`);
      return `
        <a class="standings-row" href="player.html?name=${encodeURIComponent(s.name)}" style="grid-template-columns:32px 1fr auto;cursor:pointer">
          ${avatarHtml(s.name, 28)}
          <div class="standings-name">${titleCase(s.name)}<span class="couple">${parts.join(" · ")}</span></div>
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

// weekBucketKey/filterPickableGames/earliestPickableWeek live in
// js/pick-utils.js — shared with index.html, which needs the same "what's
// pickable" and "current week" logic for its CTA/standings freshness text.

// weekBucketKeyFromSnapshot lives in js/pick-utils.js — same logic, built from
// a saved pick's snapshot instead of a live game object, so slot-fill works
// even after a game rolls out of the live fetch window.

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
        { team: away, opp: home, line: game.odds.awaySpread, atHome: false },
        { team: home, opp: away, line: game.odds.homeSpread, atHome: true },
      ];
      for (const side of sides) {
        const cat = side.line < 0 ? "minus" : "plus";
        if (cat === "minus" && game.id === plusGameId) continue; // already used as Plus, don't offer as Minus
        if (cat === "plus" && game.id === minusGameId) continue;
        pools[cat].push({
          gameId: game.id,
          display: `${side.team.abbr} ${fmtLine(side.line)}`,
          sub: `${side.atHome ? "vs" : "@"} ${side.opp.abbr}`,
          when,
          logo: side.team.logo,
          group: teamGroupLabel(sport, side.team.abbr, nflDivisions),
          search: searchText(side.team, side.opp),
          value: { type: "spread", team: side.team.abbr, line: side.line },
        });
      }
    }

    if (game.odds?.overUnder != null) {
      const totalSearch = searchText(away, home);
      if (game.id !== underGameId) {
        pools.over.push({ gameId: game.id, display: `Over ${game.odds.overUnder}`, sub: matchup, when, group: homeGroup, search: totalSearch, value: { type: "total", direction: "over", line: game.odds.overUnder } });
      }
      if (game.id !== overGameId) {
        pools.under.push({ gameId: game.id, display: `Under ${game.odds.overUnder}`, sub: matchup, when, group: homeGroup, search: totalSearch, value: { type: "total", direction: "under", line: game.odds.overUnder } });
      }
    }
  }
  return pools;
}

/** Lowercased searchable text for a chip — team abbreviation AND full name for
 * both sides, so typing either "SEA" or "Seahawks" finds a game (abbreviations
 * alone aren't how most people think of a team). */
function searchText(teamA, teamB) {
  return [teamA?.abbr, teamA?.name, teamB?.abbr, teamB?.name].filter(Boolean).join(" ").toLowerCase();
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

/** Progress for each sport's OWN currently-selected week — kept separate
 * rather than summed into one blended "X of 8" figure, because NFL and NCAA
 * weeks are independent (see sportWeeks) and a combined total doesn't
 * actually correspond to any single week filter on screen; showing "5 of 8"
 * while NFL is on Week 3 and NCAA is on Week 5 was confirmed confusing —
 * looked like it counted picks for a week you weren't even looking at. Each
 * entry's `filled` count is guaranteed to match exactly what's shown for
 * that sport's currently-selected week, nothing else. `sportWeeks[sport]`
 * can be null now that weeks are Regalia-Week-linked (js/picks.js's
 * buildRegaliaWeeks) — happens when that sport's odds for the linked week
 * haven't posted yet, not an error state. */
function computeProgress(picks, sportWeeks, gamesBySport) {
  const perSport = {};
  let total = 0;
  for (const sport of SPORTS) {
    const slots = slotsForSportWeek(picks, sport, sportWeeks[sport]);
    const filled = CATEGORIES.filter((c) => slots[c]).length;
    const weekLabel = sportWeeks[sport] ? weekBucketLabel(sportWeeks[sport], gamesBySport[sport]) : "Not posted yet";
    perSport[sport] = { filled, weekLabel };
    total += filled;
  }
  return { perSport, total };
}

function renderProgress(el, picks, sportWeeks, gamesBySport) {
  const { perSport } = computeProgress(picks, sportWeeks, gamesBySport);
  el.innerHTML = SPORTS.map((sport) => {
    const { filled, weekLabel } = perSport[sport];
    const complete = filled === 4;
    const pct = Math.round((filled / 4) * 100);
    return `
    <div class="progress-row">
      <div class="progress-row-top">
        <span class="progress-row-label">${sportLabel(sport)} · ${weekLabel}</span>
        <span class="progress-row-count${complete ? " complete" : ""}">${complete ? "✅ All set" : `${filled}/4 picks`}</span>
      </div>
      <div class="progress-bar"><div class="progress-bar-fill${complete ? " complete" : ""}" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
}

const NCAA_GROUP_ORDER = ["ACC", "Big 12", "Big Ten", "SEC", "Other"];

/** Sort a category's sub-group labels for display — NFL sorts naturally
 * alphabetically (gives AFC before NFC; games within each conference are
 * already chronological, see buildCategoryPools); NCAA uses an explicit
 * Power-4 order with "Other" always last. */
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

/** The 4 category cards for ONE sport — nested inside that sport's
 * collapsible section by renderSportSections below (not its own top-level
 * render anymore, now that NFL and NCAA are both shown together instead of
 * toggled between). Each category/chip element carries data-sport so the
 * click handler in initPicksPage can tell which sport a click belongs to
 * without a single global "selected sport" to fall back on. */
/** How many of the WHOLE group (every player, not just the current one)
 * picked the same side of this bet as the pick being shown — e.g. "4 of 6
 * picked ALA -3" once a spread game locks. Compares against every pick for
 * this exact game+bet-type, spanning both categories a spread can land in
 * (minus/plus are just the two sides of the same line, not independent
 * bets) so the count reflects the whole group's read on the game, not just
 * whichever category happens to be rendering. */
function computeConsensusForPick(allPicksRows, gameId, betType, chosenValue) {
  const relevant = allPicksRows.filter((r) => r.snapshot?.gameId === gameId && r.pick?.type === betType);
  if (relevant.length === 0) return null;
  const matches = (r) => (betType === "spread" ? r.pick.team === chosenValue.team : r.pick.direction === chosenValue.direction);
  const same = relevant.filter(matches).length;
  return { same, total: relevant.length };
}

function categoriesHtmlForSport(sport, games, slots, nflDivisions, categoryExpanded, query, conferenceFilter, allGames, groupExpanded, allPicksRows) {
  if (games.length === 0) {
    return { html: '<div class="empty-state">No games with odds available for this week yet — check back closer to kickoff.</div>', anyMatched: true };
  }

  const pools = buildCategoryPools(sport, games, slots, nflDivisions);
  let anyMatched = false;

  const categoriesHtml = CATEGORIES.map((cat) => {
    let options = pools[cat];
    if (conferenceFilter) {
      options = options.filter((o) => o.group === conferenceFilter);
      if (options.length === 0) return ""; // hide the whole category — nothing in this conference for it
    }
    if (query) {
      options = options.filter((o) => o.search.includes(query));
      if (options.length === 0) return ""; // hide the whole category rather than show an empty one while searching
    }
    anyMatched = true;
    // Identify the selected chip by which GAME it's for, not by matching its
    // odds value — two different games can easily share the same total line
    // (e.g. two games both set at "Over 44.5"), and comparing by value alone
    // was marking every game with that line as selected (confirmed bug).
    const slot = slots[cat];
    const currentGameId = slot?.entry.snapshot?.gameId ?? null;
    // A pick is locked once its OWN game's kickoff has passed — checked
    // against the snapshot's stored date (always accurate, unlike
    // gamesBySport which is only fetched once at page load and can go
    // stale if the tab's left open across a kickoff). The database already
    // rejects any actual write past kickoff (verified directly, including
    // the exact upsert/delete calls this page uses) — this is what makes
    // that enforcement visible: no chips are rendered at all for a locked
    // category, so there's nothing left to tap, not just a warning label.
    const isLocked = !!(slot && slot.entry.snapshot?.date && new Date(slot.entry.snapshot.date) <= new Date());
    // Once locked, check whether the game's actually finished yet — if so,
    // grade it right here using the same pure gradePick() History/player.html
    // already use, so the result shows up the moment ESPN reports the game
    // final, without waiting for a separate page. allGames (unlike `games`,
    // which only holds still-pickable games) is the unfiltered fetch, so a
    // finished game can still be found in it.
    const lockedGame = isLocked ? allGames.find((g) => g.id === currentGameId) : null;
    const result = lockedGame ? gradePick(slot.entry.value, lockedGame) : null;
    // While a search is active, force every matching category open so results
    // are visible without also having to tap through the collapse state.
    const expanded = isLocked ? false : query ? true : !!categoryExpanded[cat];
    // Collapsed-state summary: show what's already picked (so the pick is
    // visible without expanding), or a prompt to pick one, so scanning the
    // 4 collapsed headers alone tells you what's left to do this week.
    // Still-upcoming picks get a tiny day/time line underneath — once
    // locked, the game card below already shows richer live/final status,
    // so the plain kickoff-time readout would just be redundant there.
    const summaryMainHtml = currentGameId ? `${isLocked ? "🔒 " : ""}${pickLabel(slot.entry.value)}${slot.entry.snapshot?.matchup ? " · " + slot.entry.snapshot.matchup : ""}` : "";
    // Countdown alongside the plain day/time — reads more urgent than a
    // static clock time, especially once lock is close (Neil). Recomputed
    // on every render, including the periodic re-render this page now runs
    // purely to keep this ticking down (see the setInterval near the
    // bottom of initPicksPage) — not a true per-second clock, coarse enough
    // that a render every 30s doesn't look stale.
    const countdown = currentGameId && !isLocked && slot.entry.snapshot?.date ? formatCountdown(slot.entry.snapshot.date) : null;
    const summaryDateHtml =
      currentGameId && !isLocked && slot.entry.snapshot?.date
        ? `<span class="pick-game-summary-date">${formatKickoff(slot.entry.snapshot.date)}${countdown ? ` · ${countdown}` : ""}</span>`
        : "";
    const summaryHtml = currentGameId
      ? `<span class="pick-game-summary is-set"><span class="pick-game-summary-main">${summaryMainHtml}</span>${summaryDateHtml}</span>`
      : `<span class="pick-game-summary">Tap to pick a game</span>`;
    const chevronHtml = !isLocked
      ? `<span class="pick-game-chevron">${expanded ? "▲" : "▼"}</span>`
      : result
      ? statusBadge(result)
      : `<span class="pick-game-lock" title="Locked — the game already started">🔒 Locked</span>`;
    const headerHtml = `
      <div class="pick-game-header${isLocked ? " is-locked" : ""}" data-category-header="${cat}" data-sport="${sport}"${isLocked ? ' data-locked="true"' : ""}>
        <span class="pick-game-icon">${CATEGORY_ICON[cat]}</span>
        <span class="pick-game-label">${CATEGORY_LABEL[cat]}</span>
        ${summaryHtml}
        ${chevronHtml}
      </div>`;

    // Locked categories render the header plus a read-only game card — no
    // chips, nothing to tap (that's still the fix from before: no
    // interactive options survive once a game's started). The card itself
    // is the exact same renderGameCard() component the Games page uses
    // (js/live-scores.js, already loaded here) — same team names, scores,
    // home marker, and colored Live/Final border — so a locked pick shows
    // the real game, not just its own line score, and updates live while
    // the game's still in progress.
    if (isLocked) {
      const gameCardHtml = lockedGame ? renderGameCard(lockedGame) : "";
      const consensus = computeConsensusForPick(allPicksRows, currentGameId, slot.entry.value.type, slot.entry.value);
      const consensusHtml = consensus
        ? `<div class="pick-consensus">👥 ${consensus.same} of ${consensus.total} in the group picked this side</div>`
        : "";
      return `
        <div class="pick-game is-locked" data-category="${cat}" data-sport="${sport}">
          ${headerHtml}
          ${gameCardHtml ? `<div class="pick-game-body">${gameCardHtml}${consensusHtml}</div>` : ""}
        </div>`;
    }

    if (options.length === 0) {
      return `
        <div class="pick-game" data-category="${cat}" data-sport="${sport}">
          ${headerHtml}
          <div class="pick-game-body" style="display:${expanded ? "block" : "none"}">
            <div class="empty-state" style="padding:10px 0">No eligible games left for this category.</div>
          </div>
        </div>`;
    }

    const byGroup = new Map();
    for (const o of options) {
      if (!byGroup.has(o.group)) byGroup.set(o.group, []);
      byGroup.get(o.group).push(o);
    }
    // Each conference/division is its own collapsible block, collapsed by
    // default — a category with every conference already expanded meant a
    // lot of scrolling just to reach the one you actually wanted (Neil).
    // Force-expanded while filtering/searching, same as categories above,
    // so results aren't hidden behind a second collapsed layer. A group
    // containing the CURRENTLY PICKED game also force-expands, so opening a
    // category you've already picked in shows your pick instead of a
    // collapsed conference list you'd have to guess through.
    const subgroupsHtml = sortGroupKeys(sport, [...byGroup.keys()])
      .map((group) => {
        const groupKey = `${cat}:${group}`;
        const groupHasCurrentPick = currentGameId && byGroup.get(group).some((o) => o.gameId === currentGameId);
        const groupExpandedState = query || conferenceFilter ? true : groupHasCurrentPick ? true : !!groupExpanded?.[groupKey];
        return `
        <div class="pick-group-header" data-group-header="${escapeHtml(group)}" data-sport="${sport}" data-category="${cat}">
          <span>${group}</span>
          <span class="pick-group-chevron">${groupExpandedState ? "▲" : "▼"}</span>
        </div>
        <div class="chip-row" style="display:${groupExpandedState ? "grid" : "none"};grid-template-columns:repeat(auto-fill,minmax(96px,140px))">
          ${byGroup
            .get(group)
            .map(
              (o) => `
            <div class="chip${o.gameId === currentGameId ? " selected" : ""}"
                 data-game-id="${o.gameId}" data-value='${JSON.stringify(o.value)}'>${o.logo ? `<img class="chip-team-logo" src="${o.logo}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ""}${o.display}${o.sub ? `<div style="font-size:10px;font-weight:600;opacity:0.7;margin-top:2px">${o.sub}</div>` : ""}${o.when ? `<div style="font-size:9.5px;font-weight:600;opacity:0.55;margin-top:1px">${o.when}</div>` : ""}</div>
          `
            )
            .join("")}
        </div>`;
      })
      .join("");

    return `
      <div class="pick-game" data-category="${cat}" data-sport="${sport}">
        ${headerHtml}
        <div class="pick-game-body" style="display:${expanded ? "block" : "none"}">
          ${subgroupsHtml}
        </div>
      </div>`;
  }).join("");

  return { html: categoriesHtml, anyMatched };
}

/** Renders BOTH sports at once, each nested under its own collapsible
 * "🏈 NFL" / "🎓 NCAA" section — replaces the old NFL/NCAA toggle chips
 * entirely (Neil: with weeks now linked via the Regalia Week picker, there's
 * no reason picking one sport's games should hide the other's). Collapsed by
 * default, same reasoning as the category cards inside: 8 categories'
 * worth of content at once would be too much scroll if it were all
 * expanded up front. Search now spans both sports — a sport section
 * auto-expands (or hides entirely if nothing in it matches) the same way
 * categories already did within one sport. */
/** How many of this sport's 4 picks are graded (game finished) and how many
 * of those hit — lets the collapsed header show a result at a glance
 * without expanding into the categories (Neil: "4/4 picks made" already
 * shows completion, but not whether they won once games are over). Only
 * counts a slot once its game is actually final, same gradePick() every
 * other page uses. */
function sportGradedSummary(slots, allGames) {
  let hits = 0;
  let graded = 0;
  for (const cat of CATEGORIES) {
    const slot = slots[cat];
    const gameId = slot?.entry.snapshot?.gameId;
    const game = gameId ? allGames.find((g) => g.id === gameId) : null;
    if (!game || game.status.state !== "post" || !game.status.completed) continue;
    const result = gradePick(slot.entry.value, game);
    if (result == null) continue;
    graded++;
    if (result === "hit") hits++;
  }
  return { hits, graded };
}

function renderSportSections(container, gamesBySport, picks, sportWeeks, nflDivisions, categoryExpanded, sportExpanded, searchQuery, conferenceFilter, allGames, groupExpanded, allPicksRows) {
  const query = searchQuery.trim().toLowerCase();
  const filtering = !!query || !!conferenceFilter;
  let anySportMatched = false;

  const sectionsHtml = SPORTS.map((sport) => {
    const weekKey = sportWeeks[sport];
    const games = gamesBySport[sport].filter((g) => weekBucketKey(g) === weekKey);
    const slots = slotsForSportWeek(picks, sport, weekKey);
    const { html: categoriesHtml, anyMatched } = categoriesHtmlForSport(sport, games, slots, nflDivisions, categoryExpanded[sport], query, conferenceFilter, allGames, groupExpanded[sport], allPicksRows);

    if (filtering && !anyMatched) return ""; // hide the whole sport section if nothing in it matches

    anySportMatched = true;
    const filled = CATEGORIES.filter((c) => slots[c]).length;
    const expanded = filtering ? true : !!sportExpanded[sport];
    const icon = sport === "nfl" ? "🏈" : "🎓";
    const { hits, graded } = sportGradedSummary(slots, allGames);
    const resultBadge = graded > 0 ? `<span class="sport-section-result${hits === graded ? " all-hit" : ""}">${hits}/${graded} hit</span>` : "";

    return `
      <div class="sport-section" data-sport-section="${sport}">
        <div class="sport-section-header" data-sport-header="${sport}">
          <span class="sport-section-icon">${icon}</span>
          <span class="sport-section-label">${sportLabel(sport)}</span>
          <span class="sport-section-summary">${filled}/4 picks made</span>
          ${resultBadge}
          <span class="sport-section-chevron">${expanded ? "▲" : "▼"}</span>
        </div>
        <div class="sport-section-body" style="display:${expanded ? "block" : "none"}">
          ${categoriesHtml}
        </div>
      </div>`;
  }).join("");

  if (anySportMatched) {
    container.innerHTML = sectionsHtml;
    return;
  }
  const parts = [];
  if (conferenceFilter) parts.push(conferenceFilter);
  if (searchQuery.trim()) parts.push(`"${escapeHtml(searchQuery.trim())}"`);
  container.innerHTML = `<div class="empty-state">No games match ${parts.join(" + ")} this week.</div>`;
}

// statusBadge/pickLabel/weekGroupLabel live in js/pick-utils.js.
// The full-season "every pick I've ever made" view used to live on this page
// as a second tab (renderMyPicks) — removed per Neil: it was confusing next
// to the new "My picks this week" card, and it fully duplicates what
// player.html already shows (linked from the picker card instead).

/** currentIndex is always 0 in practice — regaliaWeeks only ever contains
 * upcoming pickable weeks (see filterPickableGames), sorted chronologically,
 * so the first entry IS "current." Kept as a parameter rather than hardcoded
 * so this doesn't silently break if that invariant ever changes. No "Past"
 * badge for the same reason — a past week can't appear in this list at all. */
function renderWeekPickerList(container, regaliaWeeks, selectedIndex, currentIndex) {
  container.innerHTML = regaliaWeeks
    .map((week, i) => {
      const badge = i === currentIndex ? `<span class="badge live">Current</span>` : i === currentIndex + 1 ? `<span class="badge next">Next</span>` : "";
      const nflText = week.nflWeekNumber != null ? `NFL: Week ${week.nflWeekNumber}` : `NFL: not posted yet`;
      const cfbText = week.cfbWeekNumber != null ? `NCAA: Week ${week.cfbWeekNumber}` : `NCAA: not posted yet`;
      return `
        <div class="week-picker-row${i === selectedIndex ? " selected" : ""}" data-week-index="${i}">
          <div class="week-picker-row-title">${regaliaWeekTitle(week)} ${badge}</div>
          <div class="week-picker-row-sub">${regaliaWeekDateRange(week)} &nbsp;·&nbsp; ${nflText} &nbsp;·&nbsp; ${cfbText}</div>
        </div>`;
    })
    .join("");
}

/** In-app replacement for the native browser confirm() — Neil wanted the
 * "change this pick?" prompt to look like part of the site (branded, same
 * cursive title, rounded card) rather than a generic OS dialog box. Single
 * shared overlay in picks.html (#confirm-modal-overlay); resolves true/false
 * once the user picks a button, same calling convention as confirm() so the
 * one call site just adds an `await`. */
function showConfirmModal(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirm-modal-overlay");
    const confirmBtn = document.getElementById("confirm-modal-confirm");
    const cancelBtn = document.getElementById("confirm-modal-cancel");
    document.getElementById("confirm-modal-message").textContent = message;
    overlay.style.display = "flex";

    function cleanup(result) {
      overlay.style.display = "none";
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      resolve(result);
    }
    function onConfirm() { cleanup(true); }
    function onCancel() { cleanup(false); }
    // Tapping the dark scrim outside the card cancels, same as tapping
    // "Cancel" — matches how the OS-level confirm() this replaces worked
    // (dismissing it any way defaults to "no").
    function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
  });
}

async function initPicksPage() {
  const select = document.getElementById("player-select");
  const weekPickerHeader = document.getElementById("week-picker-header");
  const weekPickerCurrent = document.getElementById("week-picker-current");
  const weekPickerChevron = document.getElementById("week-picker-chevron");
  const weekPickerList = document.getElementById("week-picker-list");
  const container = document.getElementById("games-list");
  const progressEl = document.getElementById("picks-progress");
  const saveStatus = document.getElementById("save-status");
  const saveBtn = document.getElementById("save-btn");
  const weekStatusList = document.getElementById("week-status-list");
  const statusSummary = document.getElementById("status-summary");
  const teamSearch = document.getElementById("team-search");
  const fullHistoryLink = document.getElementById("full-history-link");
  const pickerCard = document.querySelector(".picker-card");
  const pickerBadge = document.getElementById("picker-badge");
  const pickerBadgeAvatar = document.getElementById("picker-badge-avatar");
  const pickerBadgeName = document.getElementById("picker-badge-name");
  const picksHeading = document.getElementById("picks-heading");

  const avatarPreview = document.getElementById("player-avatar-preview");
  select.innerHTML = '<option value="">Loading roster…</option>';
  await loadPlayers();
  select.innerHTML = LEAGUE_PLAYERS.map((p) => `<option value="${p.name}">${titleCase(p.name)}</option>`).join("");
  const savedPlayer = localStorage.getItem(PLAYER_KEY) || LEAGUE_PLAYERS[0]?.name;
  select.value = savedPlayer;
  avatarPreview.innerHTML = avatarHtml(select.value, 48);

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
  const pickableAll = filterPickableGames(allGames);

  const gamesBySport = { nfl: pickableAll.filter((g) => g.sport === "nfl"), cfb: pickableAll.filter((g) => g.sport === "cfb") };

  // "Regalia Week" links an NFL week to whichever NCAA week starts closest in
  // time (see buildRegaliaWeeks, js/pick-utils.js) — picking one sets
  // sportWeeks.nfl AND sportWeeks.cfb together, so switching the sport toggle
  // below never lands on two unrelated weeks. Sorted chronologically, so
  // index 0 is always "current". buildRegaliaWeeks takes ALL games (not just
  // pickable ones, unlike gamesBySport above) so it can compute each week's
  // TRUE date range, including any already-played games sharing that week —
  // it filters down to still-pickable weeks internally.
  const allGamesBySport = { nfl: allGames.filter((g) => g.sport === "nfl"), cfb: allGames.filter((g) => g.sport === "cfb") };
  const regaliaWeeks = buildRegaliaWeeks(allGamesBySport);
  const currentRegaliaIndex = 0;
  let selectedRegaliaIndex = currentRegaliaIndex;
  const sportWeeks = {
    nfl: regaliaWeeks[0]?.nflWeekKey ?? null,
    cfb: regaliaWeeks[0]?.cfbWeekKey ?? null,
  };

  let currentPicks = await loadPicks(select.value);

  // originalPicks = what's actually saved server-side right now (a snapshot at
  // load time). Used to tell whether a category-swap needs an actual DELETE
  // (the old value was really in the DB) or just a local no-op (it was only a
  // pending, never-saved change within this session).
  let originalPicks = { ...currentPicks };
  const pendingUpserts = new Set();
  const pendingDeletes = new Set();
  // Both sport sections AND each of their 4 categories start collapsed to cut
  // down on scroll — this state lives here (not inside render) so it
  // survives re-renders triggered by week switches and chip picks.
  const sportExpanded = { nfl: false, cfb: false };
  const categoryExpanded = {
    nfl: { minus: false, plus: false, over: false, under: false },
    cfb: { minus: false, plus: false, over: false, under: false },
  };
  // Conference/division subgroups inside a category (e.g. "SEC" under NCAA
  // Plus Spread) also start collapsed, one layer deeper than categories —
  // keyed by "${category}:${group}" per sport so the same conference can be
  // open under one category and closed under another (Neil: too much
  // scrolling with every conference expanded at once).
  const groupExpanded = { nfl: {}, cfb: {} };
  let searchQuery = "";
  let conferenceFilter = "";
  // Every player's picks, for the group-consensus line on locked categories
  // ("4 of 6 picked this side") — populated by loadAndRenderStatus() below
  // (which already fetches this for the "Who's picked" card) and re-used
  // here rather than fetching it twice.
  let allPicksRows = [];

  function renderWeekPicker() {
    if (regaliaWeeks.length === 0) {
      weekPickerCurrent.textContent = "No games posted yet — check back soon";
    } else {
      // Current/Next badge shown even while collapsed — this is the single
      // most important indicator on the page for "what do I need to pick
      // right now," so it shouldn't require opening the list to see.
      const badge =
        selectedRegaliaIndex === currentRegaliaIndex
          ? `<span class="badge live">Current</span>`
          : selectedRegaliaIndex === currentRegaliaIndex + 1
          ? `<span class="badge next">Next</span>`
          : "";
      const selectedWeek = regaliaWeeks[selectedRegaliaIndex];
      // One line: crown + week number, then the date range in a smaller
      // font (not the same size as the week number — that's what was
      // overflowing narrow phones before), then the badge.
      weekPickerCurrent.innerHTML = `
        ${regaliaWeekTitle(selectedWeek)}
        <span class="week-picker-current-date">${regaliaWeekDateRange(selectedWeek)}</span>
        ${badge}`;
    }
    renderWeekPickerList(weekPickerList, regaliaWeeks, selectedRegaliaIndex, currentRegaliaIndex);
  }

  function renderAll() {
    renderSportSections(container, gamesBySport, currentPicks, sportWeeks, nflDivisions, categoryExpanded, sportExpanded, searchQuery, conferenceFilter, allGames, groupExpanded, allPicksRows);
    renderProgress(progressEl, currentPicks, sportWeeks, gamesBySport);
  }

  teamSearch.addEventListener("input", () => {
    searchQuery = teamSearch.value;
    renderAll();
  });

  const conferenceFilterRow = document.getElementById("conference-filter");
  if (conferenceFilterRow) {
    conferenceFilterRow.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-conference]");
      if (!chip) return;
      conferenceFilterRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      conferenceFilter = chip.getAttribute("data-conference");
      renderAll();
    });
  }

  function updateHistoryLink() {
    fullHistoryLink.href = `player.html?name=${encodeURIComponent(select.value)}`;
  }

  // Wayfinding: color the picker card + the sticky badge to the selected
  // player's own avatar color, and put their name in the page heading, so
  // it's unmistakable (at a glance, and while scrolled down among the
  // categories) whose picks you're making — not just whatever the dropdown
  // says at the top of the page.
  function updatePersonalization() {
    const name = select.value;
    const color = avatarColor(name);
    pickerCard.style.setProperty("--picker-color", color);
    pickerBadge.style.setProperty("--picker-color", color);
    pickerBadgeAvatar.innerHTML = avatarHtml(name, 24);
    pickerBadgeName.textContent = titleCase(name);
    picksHeading.textContent = `${titleCase(name)}'s Picks`;
  }

  renderWeekPicker();
  renderAll();
  avatarPreview.innerHTML = avatarHtml(select.value, 48);
  updateHistoryLink();
  updatePersonalization();

  async function switchPlayer() {
    localStorage.setItem(PLAYER_KEY, select.value); // remember for next visit — was read but never written (confirmed bug)
    currentPicks = await loadPicks(select.value);
    originalPicks = { ...currentPicks };
    pendingUpserts.clear();
    pendingDeletes.clear();
    avatarPreview.innerHTML = avatarHtml(select.value, 48);
    updateHistoryLink();
    updatePersonalization();
    renderAll();
    saveStatus.textContent = "";
  }

  select.addEventListener("change", switchPlayer);

  // Collapsed by default, same pattern as the pick categories and League
  // status — click the header to expand the full list of Regalia Weeks.
  let weekPickerExpanded = false;
  weekPickerHeader.addEventListener("click", () => {
    if (regaliaWeeks.length === 0) return; // nothing to pick from (offseason gap)
    weekPickerExpanded = !weekPickerExpanded;
    weekPickerList.style.display = weekPickerExpanded ? "block" : "none";
    weekPickerChevron.textContent = weekPickerExpanded ? "▲" : "▼";
  });

  weekPickerList.addEventListener("click", (e) => {
    const row = e.target.closest("[data-week-index]");
    if (!row) return;
    selectedRegaliaIndex = Number(row.getAttribute("data-week-index"));
    const week = regaliaWeeks[selectedRegaliaIndex];
    // The whole point: one click sets BOTH sports' weeks together, correctly
    // linked — no more manually figuring out which NCAA week matches.
    sportWeeks.nfl = week.nflWeekKey;
    sportWeeks.cfb = week.cfbWeekKey;
    weekPickerExpanded = false;
    weekPickerList.style.display = "none";
    weekPickerChevron.textContent = "▼";
    renderWeekPicker();
    renderAll();
    loadAndRenderStatus();
  });

  container.addEventListener("click", async (e) => {
    // Sport section headers (🏈 NFL / 🎓 NCAA) toggle collapse/expand for
    // that whole sport. Checked before category headers since a sport
    // header click could otherwise also match a category selector if they
    // were ever nested carelessly — they're siblings here, not nested, but
    // keeping the order defensive costs nothing.
    const sportHeader = e.target.closest("[data-sport-header]");
    if (sportHeader) {
      const sport = sportHeader.getAttribute("data-sport-header");
      sportExpanded[sport] = !sportExpanded[sport];
      renderAll();
      return;
    }

    // Category headers toggle collapse/expand. The header is a sibling of the
    // chip body (not a wrapper around it), so this never fires for chip clicks
    // and the chip logic below never fires for header clicks — no bubbling
    // conflict, unlike the earlier "Who's Picked" row-click bug.
    const header = e.target.closest("[data-category-header]");
    if (header) {
      if (header.getAttribute("data-locked") === "true") return; // locked — nothing to expand into
      const sport = header.getAttribute("data-sport");
      const cat = header.getAttribute("data-category-header");
      categoryExpanded[sport][cat] = !categoryExpanded[sport][cat];
      renderAll();
      return;
    }

    // Conference/division subgroup headers, one layer deeper than category
    // headers — same sibling-not-wrapper relationship to the chip row below
    // them, so this doesn't interfere with chip clicks either.
    const groupHeader = e.target.closest("[data-group-header]");
    if (groupHeader) {
      const sport = groupHeader.getAttribute("data-sport");
      const cat = groupHeader.getAttribute("data-category");
      const group = groupHeader.getAttribute("data-group-header");
      const key = `${cat}:${group}`;
      groupExpanded[sport][key] = !groupExpanded[sport][key];
      renderAll();
      return;
    }

    const chip = e.target.closest(".chip");
    if (!chip) return;
    // Sport now comes from the clicked chip's own category container, not a
    // single "currently selected sport" — both sports are visible/editable
    // at once (no more NFL/NCAA toggle).
    const catEl = chip.closest("[data-category]");
    const sport = catEl.getAttribute("data-sport");
    const category = catEl.getAttribute("data-category");
    const gameId = chip.getAttribute("data-game-id");
    const value = JSON.parse(chip.getAttribute("data-value"));
    const betType = value.type; // "spread" | "total"
    const newGroupId = partsToGroupId(gameId, betType);

    const weekKey = sportWeeks[sport];
    const games = gamesBySport[sport].filter((g) => weekBucketKey(g) === weekKey);
    const game = games.find((g) => g.id === gameId);

    // Replace whatever was previously filling this (sport, week, category) slot.
    const slots = slotsForSportWeek(currentPicks, sport, weekKey);
    const old = slots[category];
    const isChange = old && old.groupId !== newGroupId;
    // Confirm before overwriting an EXISTING pick — a first-time pick into
    // an empty slot needs no confirmation, only replacing one that was
    // already set (Neil: easy to bump a different chip by accident once a
    // category's expanded; a first pick has no prior choice to lose, so
    // there's nothing to confirm away from).
    if (isChange) {
      const confirmed = await showConfirmModal(`Change your ${CATEGORY_LABEL[category]} pick from "${pickLabel(old.entry.value)}" to "${pickLabel(value)}"?`);
      if (!confirmed) return;
    }
    if (isChange) {
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
    saveStatus.textContent = "";
  });

  async function doSave() {
    if (pendingUpserts.size === 0 && pendingDeletes.size === 0) {
      saveStatus.textContent = "Nothing new to save.";
      return;
    }

    saveBtn.disabled = true;
    saveStatus.textContent = "Saving…";

    const player = select.value;

    for (const groupId of pendingDeletes) {
      const parts = groupIdToParts(groupId);
      const err = await deletePick(player, parts.gameId, parts.betType);
      if (err) {
        saveBtn.disabled = false;
        saveStatus.textContent = "Couldn't save — a removed pick's game may have already kicked off. Refresh and try again.";
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

    saveBtn.disabled = false;

    if (error) {
      saveStatus.textContent = "Couldn't save — one of these games may have already kicked off. Refresh and try again.";
      console.error("savePicks failed:", error);
      return;
    }

    originalPicks = { ...currentPicks };
    pendingUpserts.clear();
    pendingDeletes.clear();

    loadAndRenderStatus();
    renderProgress(progressEl, currentPicks, sportWeeks, gamesBySport);
    // Both sports shown per-line, same as the persistent progress card —
    // there's no single "the sport being edited" anymore now that both are
    // visible/editable together (no more NFL/NCAA toggle).
    const { perSport } = computeProgress(currentPicks, sportWeeks, gamesBySport);
    const weekTag = regaliaWeeks[selectedRegaliaIndex] ? `, ${regaliaWeekTitle(regaliaWeeks[selectedRegaliaIndex]).replace(/^👑 /, "").replace(/ Picks ·.*$/, "")}` : "";
    saveStatus.textContent = `Saved for ${titleCase(player)}${weekTag} — NFL ${perSport.nfl.filled}/4 · NCAA ${perSport.cfb.filled}/4.`;
  }

  saveBtn.addEventListener("click", doSave);

  // "Who's picked" lives as its own collapsible card, not a separate tab —
  // stays visible where people already are, without permanently pushing the
  // actual picking UI down the page.
  let statusExpanded = false;

  async function loadAndRenderStatus() {
    statusSummary.innerHTML = "<span>Loading who's picked…</span>";
    allPicksRows = await loadAllPicks();
    const statusList = computeWeekStatus(allPicksRows, sportWeeks);
    const submittedCount = statusList.filter((s) => s.total === expectedPickTotal(sportWeeks)).length;
    statusSummary.innerHTML = `<span>${submittedCount} of ${statusList.length} submitted this week</span><span style="color:var(--accent)">${statusExpanded ? "▲ Hide" : "▼ Who's in?"}</span>`;
    renderWeekStatus(weekStatusList, statusList, sportWeeks);
    // Consensus lines on locked categories ("4 of 6 picked this side") need
    // this same data — re-render once it's in so they don't stay blank
    // until something else happens to trigger a redraw.
    renderAll();
  }

  // Bound to the summary header only, not the whole card — otherwise a click on a
  // player row inside the expanded list (an <a> to player.html) bubbles up and
  // toggles the card shut at the same moment it navigates away (confirmed bug).
  statusSummary.addEventListener("click", () => {
    statusExpanded = !statusExpanded;
    weekStatusList.style.display = statusExpanded ? "block" : "none";
    loadAndRenderStatus(); // refresh on every expand — other players may have saved since load
  });

  loadAndRenderStatus();

  // Re-render (no re-fetch) purely to keep the "Locks in Xh Ym" countdowns
  // ticking down while this tab stays open — doesn't touch any saved/
  // pending pick state, just recomputes the same HTML from data already in
  // memory. 60s cadence matches the coarsest unit the countdown ever shows
  // (minutes), so it never visibly skips.
  setInterval(renderAll, 60000);
}

document.addEventListener("DOMContentLoaded", initPicksPage);
