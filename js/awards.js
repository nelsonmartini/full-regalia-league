/**
 * Weekly Awards — fun, lightweight callouts computed from the same graded
 * picks Standings/History already use (js/season-data.js). Home-page only.
 *
 * Grouped by REGALIA WEEK (js/pick-utils.js's buildRegaliaWeeks) — the same
 * unified week concept the Picks page, Standings freshness line, and Home
 * CTA already use, which pairs NFL's week with whichever NCAA week starts
 * closest in time. This used to group by plain calendar week (Monday-start)
 * instead, from before Regalia Week existed — that was its own fix for the
 * same underlying problem (NFL and NCAA's own week numbers don't share a
 * calendar), but it meant Awards answered "which week" differently than
 * every other page, and a player's picks near a Sunday/Monday boundary
 * could get split across two different calendar weeks even though they
 * were all part of the same pick'em week everywhere else on the site.
 * Confirmed real confusion (Neil, 2026-09-05): a player's season-leading hit
 * count didn't match their Nostradamus eligibility because one of their
 * hits had landed in the "wrong" calendar week by this old definition.
 *
 * computeAllWeeklyAwards computes EVERY week's results (not just the most
 * recent), so the current week's winner can show a career count ("Sean
 * (x4)") and each award can expand to show its full season history —
 * Neil: "if someone is getting ice cold for the 4th time, the league
 * would know it's their fourth time."
 */

/** Award results for ONE already-filtered set of a single week's graded
 * picks. Pulled out of computeAllWeeklyAwards so it can run once per week
 * instead of duplicating this logic for "just the latest." */
function computeAwardsForWeek(weekPicks, regaliaWeek) {
  const byPlayer = new Map();
  for (const gp of weekPicks) {
    if (!byPlayer.has(gp.player_name)) byPlayer.set(gp.player_name, []);
    byPlayer.get(gp.player_name).push(gp);
  }

  const stats = [...byPlayer.entries()].map(([name, picks]) => {
    const hits = picks.filter((p) => p.result === "hit").length;
    const misses = picks.filter((p) => p.result === "miss").length;
    // Biggest underdog taken: the largest positive spread line among this
    // player's Plus Spread picks that week.
    const biggestDog = picks
      .filter((p) => p.pick.type === "spread" && p.pick.line > 0)
      .reduce((best, p) => (!best || p.pick.line > best.pick.line ? p : best), null);
    // Closest save to kickoff: smallest positive gap between when the pick
    // was saved (updated_at) and the game's kickoff (snapshot.date).
    const buzzer = picks
      .filter((p) => p.updated_at)
      .reduce((best, p) => {
        const gapMs = new Date(p.snapshot.date) - new Date(p.updated_at);
        if (gapMs < 0) return best; // saved after kickoff shouldn't happen (DB blocks it), skip defensively
        return !best || gapMs < best.gapMs ? { pick: p, gapMs } : best;
      }, null);
    // Longest run of consecutive misses that week, in kickoff order — a
    // separate stat from raw miss COUNT (Dumbass of the Week): 4 misses
    // spread across the week reads differently than 4 in a row.
    const byKickoff = [...picks].sort((a, b) => new Date(a.snapshot.date) - new Date(b.snapshot.date));
    let longestMissStreak = 0;
    let run = 0;
    for (const p of byKickoff) {
      run = p.result === "miss" ? run + 1 : 0;
      longestMissStreak = Math.max(longestMissStreak, run);
    }
    return { name, hits, misses, biggestDog, buzzer, longestMissStreak };
  });

  // Every award returns an ARRAY of tied winners, not a single pick — a
  // small weekly sample size makes ties genuinely common (e.g. two players
  // both landing exactly 1 hit), and silently picking whoever happened to
  // come first in an unordered list (the previous behavior) meant the
  // "winner" shown could be arbitrary and wrong, with no sign it was even a
  // tie. Confirmed real case (Neil): Sean, Emma, and Michaela tied at 1 hit
  // each for Nostradamus, but only one name ever showed.
  function topTied(key, minValue = 1) {
    const max = Math.max(0, ...stats.map((s) => s[key]));
    if (max < minValue) return [];
    return stats.filter((s) => s[key] === max);
  }

  const withDog = stats.filter((s) => s.biggestDog);
  const maxDogLine = withDog.length ? Math.max(...withDog.map((s) => s.biggestDog.pick.line)) : null;
  const bigDawg = maxDogLine != null ? withDog.filter((s) => s.biggestDog.pick.line === maxDogLine) : [];

  const withBuzzer = stats.filter((s) => s.buzzer);
  const minBuzzerGap = withBuzzer.length ? Math.min(...withBuzzer.map((s) => s.buzzer.gapMs)) : null;
  const buzzerBeater = minBuzzerGap != null ? withBuzzer.filter((s) => s.buzzer.gapMs === minBuzzerGap) : [];

  // A single miss isn't a "streak" — require at least 2 in a row.
  const iceCold = topTied("longestMissStreak", 2);

  return {
    regaliaWeekNumber: regaliaWeek.regaliaWeekNumber,
    // "Week 3 · Aug 25–31" — same numbering as the Picks page's own week
    // picker, so this week can be cross-checked against it directly.
    weekLabel: `Week ${regaliaWeek.regaliaWeekNumber} · ${regaliaWeekDateRange(regaliaWeek)}`,
    dumbass: topTied("misses"),
    nostradamus: topTied("hits"),
    bigDawg,
    buzzerBeater,
    iceCold,
  };
}

/** Award results for EVERY Regalia Week that has at least one graded pick,
 * sorted ascending — the current week is always the last entry. `games` is
 * the same combined NFL+CFB list loadSeasonGames() already fetches for
 * Standings — reused here (via buildRegaliaWeeks) rather than fetched
 * again. Returns [] if nothing's graded yet (e.g. very start of the
 * season). */
function computeAllWeeklyAwards(gradedPicks, games) {
  const graded = gradedPicks.filter((gp) => gp.result && gp.snapshot?.date);
  if (graded.length === 0) return [];

  // NFL preseason (seasonType 1) excluded up front, same as the Picks page —
  // otherwise includeCompleted below would let 4 preseason weeks count as
  // real Regalia Weeks here (Picks never offers them as pickable, so they
  // never appear over there), shifting this page's "Week N" numbering out
  // of sync with the Picks page's for the exact same real week.
  const bySport = { nfl: games.filter((g) => g.sport === "nfl" && g.seasonType !== 1), cfb: games.filter((g) => g.sport === "cfb") };
  // includeCompleted: true — unlike the Picks page's own use of this
  // function, Awards specifically wants every FINISHED week too, which the
  // default (pickable-only) mode would filter out entirely.
  const regaliaWeeks = buildRegaliaWeeks(bySport, { includeCompleted: true });

  // A pick's own sport+week+seasonType maps to whichever Regalia Week claims
  // that bucket on either side (NFL or CFB) — mirrors how the Picks page
  // links the two sports' weeks together, so e.g. a Thursday NFL game and
  // that same week's Saturday CFB games both land in the same Regalia Week
  // here too, not two different ones.
  function regaliaWeekForPick(gp) {
    const key = weekBucketKeyFromSnapshot(gp.snapshot);
    return regaliaWeeks.find((w) => w.nflWeekKey === key || w.cfbWeekKey === key) ?? null;
  }

  const gradedWithWeek = graded.map((gp) => ({ ...gp, regaliaWeek: regaliaWeekForPick(gp) })).filter((gp) => gp.regaliaWeek);
  if (gradedWithWeek.length === 0) return [];

  const weekNumbers = [...new Set(gradedWithWeek.map((gp) => gp.regaliaWeek.regaliaWeekNumber))].sort((a, b) => a - b);
  return weekNumbers.map((weekNum) => {
    const weekPicks = gradedWithWeek.filter((gp) => gp.regaliaWeek.regaliaWeekNumber === weekNum);
    return computeAwardsForWeek(weekPicks, weekPicks[0].regaliaWeek);
  });
}

const AWARD_CATEGORIES = ["dumbass", "nostradamus", "bigDawg", "buzzerBeater", "iceCold"];

/** How many times has each player won each award, across every week in
 * `allWeeklyAwards`? Every tied winner in a week counts toward their own
 * tally (confirmed with Neil) — a 3-way tie credits all 3 players, not
 * just one arbitrary pick. */
function computeAwardCareerCounts(allWeeklyAwards) {
  const counts = {};
  for (const week of allWeeklyAwards) {
    for (const cat of AWARD_CATEGORIES) {
      for (const winner of week[cat]) {
        if (!counts[winner.name]) counts[winner.name] = { dumbass: 0, nostradamus: 0, bigDawg: 0, buzzerBeater: 0, iceCold: 0 };
        counts[winner.name][cat]++;
      }
    }
  }
  return counts;
}

function formatBuzzerGap(gapMs) {
  const mins = Math.round(gapMs / 60000);
  if (mins < 60) return `${mins} min before kickoff`;
  const hours = Math.round(mins / 60);
  return `${hours} hr before kickoff`;
}

/** "Sean", "Sean & Emma", or "Sean, Emma & Michaela" — used wherever an
 * award has more than one tied winner. */
function joinNames(names) {
  const titled = names.map(titleCase);
  if (titled.length === 1) return titled[0];
  if (titled.length === 2) return `${titled[0]} & ${titled[1]}`;
  return `${titled.slice(0, -1).join(", ")} & ${titled[titled.length - 1]}`;
}

/** "Sean (x4)" — only shown once a player has won an award 2+ times, same
 * minimal-badge philosophy as the streak flame (js/season-data.js) only
 * appearing at 3+ hits: a first-time win doesn't need decoration. */
function nameWithCareerCount(name, count) {
  return count >= 2 ? `${titleCase(name)} <span class="award-count">(x${count})</span>` : titleCase(name);
}

/** Every past week (older than the current/last one) where `category` had
 * at least one winner, formatted as one line per week. `detailFor(winner)`
 * mirrors the per-winner detail functions already used for the live row. */
function awardHistoryLines(allWeeklyAwards, category, detailFor) {
  return allWeeklyAwards
    .slice(0, -1) // exclude the current week -- that's already shown live above
    .filter((week) => week[category].length > 0)
    .reverse() // most recent past week first
    .map((week) => {
      const names = joinNames(week[category].map((w) => w.name));
      const detail = detailFor(week, week[category]);
      return `<div class="award-history-line">${week.weekLabel.split(" · ")[0]} — ${names} — ${detail}</div>`;
    })
    .join("");
}

/** Shared tap-to-expand wrapper — one row per award, whether it's a
 * "simple" (shared detail) or "per-winner" (different detail each) award.
 * `historyHtml` is pre-rendered by the caller since the two award kinds
 * build their detail text differently. */
function awardToggleWrapper(category, headerHtml, historyHtml) {
  const toggleHtml = historyHtml ? `<span class="award-chevron" data-award-toggle="${category}">▼</span>` : "";
  const header = headerHtml.replace("<!--TOGGLE-->", toggleHtml);
  // Always wraps (even with no history to expand into yet) so the border
  // separating one award from the next lives in one consistent place
  // regardless of whether that particular award has a chevron this week.
  return `
    <div class="award-toggle-wrap">
      ${header}
      ${historyHtml ? `<div class="award-history-list" id="award-history-${category}" style="display:none">${historyHtml}</div>` : ""}
    </div>`;
}

/** Awards where every tied winner shares the exact same number by definition
 * (miss count, hit count, streak length) — one shared detail line covers
 * all of them, so names just join together under it. `compact` (Home's
 * side-by-side split-screen row, see css/style.css .home-split-row) swaps
 * the roomy side-by-side layout for a dense 2-line block — same
 * information, no blurb line, since there isn't room for one at that width. */
function simpleAwardRow(icon, label, category, winners, detail, careerCounts, allWeeklyAwards, statKey, compact = false) {
  if (winners.length === 0) return null;
  // joinNames() titleCases and joins plain strings -- nameWithCareerCount()
  // does the titleCasing itself and returns an HTML fragment (name + an
  // optional "(xN)" badge), so the actual joining logic is duplicated here
  // rather than reused, since joinNames alone can't wrap each name in HTML.
  const names = winners.map((w) => nameWithCareerCount(w.name, careerCounts[w.name]?.[category] ?? 0));
  const joined = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} & ${names[1]}` : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

  const history = awardHistoryLines(allWeeklyAwards, category, (week) => {
    const w = week[category][0];
    return statKey === "misses" ? `${w.misses} miss${w.misses === 1 ? "" : "es"}` : statKey === "hits" ? `${w.hits} hit${w.hits === 1 ? "" : "s"}` : `${w.longestMissStreak} in a row`;
  });

  if (compact) {
    const headerHtml = `
      <div class="award-row-compact">
        <div class="award-row-label">${icon} ${label} <!--TOGGLE--></div>
        <div class="award-row-winner">${joined}</div>
        <div class="award-row-detail">${detail}</div>
      </div>`;
    return awardToggleWrapper(category, headerHtml, history);
  }
  const headerHtml = `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="font-size:20px">${icon}</span>
      <span style="flex:1">
        <div style="font-size:13px;color:var(--text-dim);font-weight:700">${label} <!--TOGGLE--></div>
      </span>
      <span style="text-align:right">
        <div class="award-row-winner">${joined}</div>
        <div style="font-size:11px;color:var(--text-faint)">${detail}</div>
      </span>
    </div>`;
  return awardToggleWrapper(category, headerHtml, history);
}

/** Awards where tied winners can each have a DIFFERENT specific detail (two
 * players both taking the biggest underdog line, but different teams) — one
 * row per winner instead of a single shared detail line, so nothing tied
 * gets flattened into a misleading combined caption. */
function perWinnerAwardRow(icon, label, category, winners, detailFor, careerCounts, allWeeklyAwards, compact = false) {
  if (winners.length === 0) return null;

  const history = awardHistoryLines(allWeeklyAwards, category, (week, catWinners) => catWinners.map((w) => `${titleCase(w.name)} (${detailFor(w)})`).join(", "));

  if (compact) {
    const lines = winners.map((w) => `${nameWithCareerCount(w.name, careerCounts[w.name]?.[category] ?? 0)} — ${detailFor(w)}`).join("<br />");
    const headerHtml = `
      <div class="award-row-compact">
        <div class="award-row-label">${icon} ${label} <!--TOGGLE--></div>
        <div class="award-row-winner">${lines}</div>
      </div>`;
    return awardToggleWrapper(category, headerHtml, history);
  }
  const names = winners
    .map((w) => `<div class="award-row-winner">${nameWithCareerCount(w.name, careerCounts[w.name]?.[category] ?? 0)}</div><div style="font-size:11px;color:var(--text-faint);margin-bottom:2px">${detailFor(w)}</div>`)
    .join("");
  const headerHtml = `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="font-size:20px">${icon}</span>
      <span style="flex:1">
        <div style="font-size:13px;color:var(--text-dim);font-weight:700">${label} <!--TOGGLE--></div>
      </span>
      <span style="text-align:right">${names}</span>
    </div>`;
  return awardToggleWrapper(category, headerHtml, history);
}

/** `compact: true` — Home's side-by-side split-screen row (see
 * css/style.css .home-split-row) needs a much denser format than the
 * roomy default, since it's sharing half the page width with Standings.
 * Same underlying data either way, just fewer pixels per award. Takes the
 * FULL season's weekly results (see computeAllWeeklyAwards) — the last
 * entry is "this week," everything before it feeds the career counts and
 * the tap-to-expand history. */
function renderWeeklyAwards(allWeeklyAwards, { compact = false } = {}) {
  if (allWeeklyAwards.length === 0) return '<div class="empty-state">No graded picks yet this season — check back once games finish.</div>';

  const current = allWeeklyAwards[allWeeklyAwards.length - 1];
  const careerCounts = computeAwardCareerCounts(allWeeklyAwards);

  const dumbassMisses = current.dumbass[0]?.misses ?? 0;
  const nostradamusHits = current.nostradamus[0]?.hits ?? 0;
  const iceColdStreak = current.iceCold[0]?.longestMissStreak ?? 0;

  const rows = [
    simpleAwardRow("🤡", "Dumbass of the Week", "dumbass", current.dumbass, `${dumbassMisses} miss${dumbassMisses === 1 ? "" : "es"}`, careerCounts, allWeeklyAwards, "misses", compact),
    simpleAwardRow("🔮", "Nostradamus", "nostradamus", current.nostradamus, `${nostradamusHits} hit${nostradamusHits === 1 ? "" : "s"}`, careerCounts, allWeeklyAwards, "hits", compact),
    perWinnerAwardRow("🎰", "Big Dawg", "bigDawg", current.bigDawg, (w) => `took ${w.biggestDog.pick.team} +${w.biggestDog.pick.line}`, careerCounts, allWeeklyAwards, compact),
    perWinnerAwardRow("⏰", "Buzzer Beater", "buzzerBeater", current.buzzerBeater, (w) => formatBuzzerGap(w.buzzer.gapMs), careerCounts, allWeeklyAwards, compact),
    simpleAwardRow("🥶", "Ice Cold", "iceCold", current.iceCold, `${iceColdStreak} in a row`, careerCounts, allWeeklyAwards, "longestMissStreak", compact),
  ].filter(Boolean);

  if (rows.length === 0) return '<div class="empty-state">Not enough graded picks yet to hand out awards.</div>';

  return rows.join("");
}

/** Delegated click handler for every award's tap-to-expand history —
 * mirrors wireBetToggleDelegation (js/pick-utils.js) so this reads as the
 * same interaction pattern already established for bet details. */
function wireAwardToggleDelegation(container) {
  container.addEventListener("click", (e) => {
    const chevron = e.target.closest("[data-award-toggle]");
    if (!chevron) return;
    const list = document.getElementById(`award-history-${chevron.getAttribute("data-award-toggle")}`);
    if (!list) return;
    const opening = list.style.display === "none";
    list.style.display = opening ? "block" : "none";
    chevron.classList.toggle("expanded", opening);
  });
}
