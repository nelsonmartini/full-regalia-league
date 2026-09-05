/**
 * Weekly Awards — fun, lightweight callouts computed from the same graded
 * picks Standings/History already use (js/season-data.js). Home-page only.
 *
 * Deliberately grouped by CALENDAR week (Monday-start, from each pick's
 * actual kickoff date), not by NFL's or NCAA's own week numbering — those
 * two are independently selected per sport (see js/picks.js) and don't line
 * up on the calendar, which caused real confusion when the Picks page's
 * progress counter blended them together (fixed earlier this project). A
 * calendar week sidesteps that entirely: every pick, from either sport,
 * naturally falls into exactly one real-world week.
 */

/** Monday (UTC) of the week containing `dateStr`, as "YYYY-MM-DD" — used as
 * a sortable/groupable key. */
function calendarWeekKey(dateStr) {
  const d = new Date(dateStr);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  return monday.toISOString().slice(0, 10);
}

function calendarWeekLabel(weekKey) {
  const d = new Date(`${weekKey}T00:00:00Z`);
  return `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

/** Picks the most recent calendar week with at least one graded pick, and
 * computes each award within it. Returns null if nothing's graded yet
 * (e.g. very start of the season). */
function computeWeeklyAwards(gradedPicks) {
  const graded = gradedPicks.filter((gp) => gp.result && gp.snapshot?.date);
  if (graded.length === 0) return null;

  const weekKeys = [...new Set(graded.map((gp) => calendarWeekKey(gp.snapshot.date)))].sort();
  const latestWeek = weekKeys[weekKeys.length - 1];
  const weekPicks = graded.filter((gp) => calendarWeekKey(gp.snapshot.date) === latestWeek);

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
    weekLabel: calendarWeekLabel(latestWeek),
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
