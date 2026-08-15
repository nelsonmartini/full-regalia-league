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
    return { name, hits, misses, biggestDog, buzzer };
  });

  const top = (key) => [...stats].sort((a, b) => b[key] - a[key])[0];

  const withDog = stats.filter((s) => s.biggestDog);
  const highRoller = withDog.length ? withDog.sort((a, b) => b.biggestDog.pick.line - a.biggestDog.pick.line)[0] : null;

  const withBuzzer = stats.filter((s) => s.buzzer);
  const buzzerBeater = withBuzzer.length ? withBuzzer.sort((a, b) => a.buzzer.gapMs - b.buzzer.gapMs)[0] : null;

  return {
    weekLabel: calendarWeekLabel(latestWeek),
    dumbass: top("misses"),
    nostradamus: top("hits"),
    highRoller,
    buzzerBeater,
  };
}

function formatBuzzerGap(gapMs) {
  const mins = Math.round(gapMs / 60000);
  if (mins < 60) return `${mins} min before kickoff`;
  const hours = Math.round(mins / 60);
  return `${hours} hr before kickoff`;
}

function renderWeeklyAwards(awards) {
  if (!awards) return '<div class="empty-state">No graded picks yet this season — check back once games finish.</div>';

  const rows = [
    awards.dumbass && awards.dumbass.misses > 0
      ? ["🤡", "Dumbass of the Week", awards.dumbass.name, `${awards.dumbass.misses} miss${awards.dumbass.misses === 1 ? "" : "es"}`]
      : null,
    awards.nostradamus && awards.nostradamus.hits > 0
      ? ["🔮", "Nostradamus", awards.nostradamus.name, `${awards.nostradamus.hits} hit${awards.nostradamus.hits === 1 ? "" : "s"}`]
      : null,
    awards.highRoller
      ? ["🎰", "High Roller", awards.highRoller.name, `took ${awards.highRoller.biggestDog.pick.team} +${awards.highRoller.biggestDog.pick.line}`]
      : null,
    awards.buzzerBeater
      ? ["⏰", "Buzzer Beater", awards.buzzerBeater.name, formatBuzzerGap(awards.buzzerBeater.buzzer.gapMs)]
      : null,
  ].filter(Boolean);

  if (rows.length === 0) return '<div class="empty-state">Not enough graded picks yet to hand out awards.</div>';

  return rows
    .map(
      ([icon, label, name, detail]) => `
    <div style="display:flex;align-items:center;gap:10px;padding:7px 0">
      <span style="font-size:20px">${icon}</span>
      <span style="flex:1;font-size:13px;color:var(--text-dim)">${label}</span>
      <span style="text-align:right">
        <div style="font-weight:800">${titleCase(name)}</div>
        <div style="font-size:11px;color:var(--text-faint)">${detail}</div>
      </span>
    </div>`
    )
    .join("");
}
