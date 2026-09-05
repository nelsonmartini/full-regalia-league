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
 */

/** Picks the most recent Regalia Week with at least one graded pick, and
 * computes each award within it. `games` is the same combined NFL+CFB list
 * loadSeasonGames() already fetches for Standings — reused here (via
 * buildRegaliaWeeks) rather than fetched again. Returns null if nothing's
 * graded yet (e.g. very start of the season). */
function computeWeeklyAwards(gradedPicks, games) {
  const graded = gradedPicks.filter((gp) => gp.result && gp.snapshot?.date);
  if (graded.length === 0) return null;

  // NFL preseason (seasonType 1) excluded up front, same as the Picks page —
  // otherwise includeCompleted below would let 4 preseason weeks count as
  // real Regalia Weeks here (Picks never offers them as pickable, so they
  // never appear over there), shifting this page's "Week N" numbering out
  // of sync with the Picks page's for the exact same real week.
  const bySport = { nfl: games.filter((g) => g.sport === "nfl" && g.seasonType !== 1), cfb: games.filter((g) => g.sport === "cfb") };
  // includeCompleted: true — unlike the Picks page's own use of this
  // function, Awards specifically wants the most recently FINISHED week,
  // which the default (pickable-only) mode would filter out entirely.
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
  if (gradedWithWeek.length === 0) return null;

  const latestWeekNumber = Math.max(...gradedWithWeek.map((gp) => gp.regaliaWeek.regaliaWeekNumber));
  const weekPicks = gradedWithWeek.filter((gp) => gp.regaliaWeek.regaliaWeekNumber === latestWeekNumber);
  const latestRegaliaWeek = weekPicks[0].regaliaWeek;

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
    // "Week 3 · Aug 25–31" — same numbering as the Picks page's own week
    // picker, so this week can be cross-checked against it directly.
    weekLabel: `Week ${latestRegaliaWeek.regaliaWeekNumber} · ${regaliaWeekDateRange(latestRegaliaWeek)}`,
    dumbass: topTied("misses"),
    nostradamus: topTied("hits"),
    bigDawg,
    buzzerBeater,
    iceCold,
  };
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

/** Awards where every tied winner shares the exact same number by definition
 * (miss count, hit count, streak length) — one shared detail line covers
 * all of them, so names just join together under it. */
function simpleAwardRow(icon, label, blurb, winners, detail) {
  if (winners.length === 0) return null;
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="font-size:20px">${icon}</span>
      <span style="flex:1">
        <div style="font-size:13px;color:var(--text-dim);font-weight:700">${label}</div>
        <div style="font-size:10.5px;color:var(--text-faint)">${blurb}</div>
      </span>
      <span style="text-align:right">
        <div style="font-weight:800">${joinNames(winners.map((w) => w.name))}</div>
        <div style="font-size:11px;color:var(--text-faint)">${detail}</div>
      </span>
    </div>`;
}

/** Awards where tied winners can each have a DIFFERENT specific detail (two
 * players both taking the biggest underdog line, but different teams) — one
 * row per winner instead of a single shared detail line, so nothing tied
 * gets flattened into a misleading combined caption. */
function perWinnerAwardRow(icon, label, blurb, winners, detailFor) {
  if (winners.length === 0) return null;
  const names = winners
    .map((w) => `<div style="font-weight:800">${titleCase(w.name)}</div><div style="font-size:11px;color:var(--text-faint);margin-bottom:2px">${detailFor(w)}</div>`)
    .join("");
  return `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="font-size:20px">${icon}</span>
      <span style="flex:1">
        <div style="font-size:13px;color:var(--text-dim);font-weight:700">${label}</div>
        <div style="font-size:10.5px;color:var(--text-faint)">${blurb}</div>
      </span>
      <span style="text-align:right">${names}</span>
    </div>`;
}

function renderWeeklyAwards(awards) {
  if (!awards) return '<div class="empty-state">No graded picks yet this season — check back once games finish.</div>';

  const dumbassMisses = awards.dumbass[0]?.misses ?? 0;
  const nostradamusHits = awards.nostradamus[0]?.hits ?? 0;
  const iceColdStreak = awards.iceCold[0]?.longestMissStreak ?? 0;

  const rows = [
    simpleAwardRow("🤡", "Dumbass of the Week", "Most misses this week", awards.dumbass, `${dumbassMisses} miss${dumbassMisses === 1 ? "" : "es"}`),
    simpleAwardRow("🔮", "Nostradamus", "Most hits this week", awards.nostradamus, `${nostradamusHits} hit${nostradamusHits === 1 ? "" : "s"}`),
    perWinnerAwardRow("🎰", "Big Dawg", "Biggest underdog taken", awards.bigDawg, (w) => `took ${w.biggestDog.pick.team} +${w.biggestDog.pick.line}`),
    perWinnerAwardRow("⏰", "Buzzer Beater", "Picked closest to kickoff", awards.buzzerBeater, (w) => formatBuzzerGap(w.buzzer.gapMs)),
    simpleAwardRow("🥶", "Ice Cold", "Longest miss streak this week", awards.iceCold, `${iceColdStreak} in a row`),
  ].filter(Boolean);

  if (rows.length === 0) return '<div class="empty-state">Not enough graded picks yet to hand out awards.</div>';

  return rows
    .join("");
}
