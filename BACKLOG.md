# Full Regalia League — Backlog

**Open this file first each session.** Full reasoning/architecture lives in `ROADMAP.md`.

## Status

- **SHIPPED (2026-09-05): Home layout follow-up — Standings/Awards to the very top, dead-space fix, compact game cards, icon cleanup.** Neil's immediate feedback after the first reorg shipped: Standings/Awards should be above Most Active Games (not below it), there was a "huge gap" wasting space in the Standings card, and the game cards themselves were still too big.
  - **Reordered again**: Standings + Awards split row now sits at the very top (right after the header quote), Most Active Games moved below it.
  - **Fixed the dead-space bug**: the gap was CSS Grid's default `align-items: stretch` forcing the shorter Standings card to match the taller Awards card's height, leaving empty space below its 3 rows. Added `align-items: start` to `.home-split-row` so each card sizes to its own content — and, per Neil's preference, moved the "Enter Your Picks" CTA button *into* that reclaimed space inside the Standings card (resized/shortened to "Enter Picks →" to fit the half-width column) instead of leaving it as its own full-width element above.
  - **Compact game cards**: new `.game-card-compact` CSS modifier (Home only, `#home-games`) shrinks padding, logos, and text, and drops the odds row entirely (still visible one tap away via "See all →") — cut each card's height roughly in half without touching `renderGameCard()` itself, so the Games tab's own cards are unaffected.
  - **Icon cleanup**: swapped the "🎯" emoji for the same scoreboard SVG icon used in the bottom nav's Games tab (visual consistency with the tab this card links to), and removed the separate ✏️ Picks-shortcut icon that sat next to "See all →" per Neil's request.
  - Verified via Playwright (6/6): correct section order, CTA confirmed living inside the Standings card, `align-items: start` in effect, compact class applied with odds hidden, zero console errors.
  - Bumped service worker cache to `full-regalia-shell-v91`.

- **SHIPPED (2026-09-05): Home layout reorg — Most Active Games moved up, Standings + Awards compacted side by side (3 of 3 — betting-activity feature).** Neil: users aren't scrolling far, so the highest-value content should sit as close to the top as possible.
  - **Most Active Games moved** to right after the "Enter Your Picks" CTA — previously it sat below both Standings and Awards.
  - **Standings + Awards go side by side** in a new two-column `.home-split-row`, each using new denser row formats: `renderStandingsRowCompact()` (`js/season-data.js`) gained `extraClass`/`avatarSize` options for an even tighter variant than its existing "compact" mode; `renderWeeklyAwards()` (`js/awards.js`) gained a `{ compact: true }` mode producing 2-line-per-award blocks (icon+label, then winner+detail) instead of the roomy side-by-side default — same underlying data either way, nothing dropped, just denser. The per-award "Week N" caption was removed from the compact Awards card specifically, since the shared "Standings as of..." line directly above the split row already states the week for both cards — was redundant, not lost.
  - Shortened a few labels to fit the narrower columns: "Top of the standings" → "Standings", "Season Total" → "PTS", "Full board →" → "Full →".
  - Verified via Playwright (10/10): correct section order, Standings/Awards genuinely share one row (same top, side-by-side left offset) rather than stacking, and every original piece of information (all 3 possible awards, both players' points) still renders correctly in the compact form.
  - Bumped service worker cache to `full-regalia-shell-v90`.

- **SHIPPED (2026-09-05): Home's game preview repurposed into "Most Active Games" (2 of 3 stages — betting-activity feature).** Same card slot as the old "Live scores & odds" (still 3 games, same position for now — reorder comes in stage 3), but the 3 shown are now whichever games have the most total bets across everyone, not whichever are live/soonest. Falls back to filling remaining slots by the old live-status order when fewer than 3 games have any bets yet (early in a week), so the card never looks sparse.
  - Merged the page's two separate data-loading IIFEs into one — Standings, Awards, the week-freshness text, and Most Active Games all need the same `picksRows`/`games`, no reason to fetch twice (previously "Live scores" used a narrower separate ESPN fetch that Most Active Games doesn't actually need, since bet counts alone already keep it scoped to whatever week people are actively picking).
  - Each shown game reuses the exact same `gameBetsSummaryHtml()` component shipped for the Games tab, so tapping a game's bet count here behaves identically.
  - Added a small ✏️ shortcut icon next to the card header, linking straight to `picks.html`.
  - Verified via Playwright (9/9): title changed, Picks shortcut present, the 3 shown games are genuinely top-3-by-bet-count (a game with only 1 bet correctly beat out a live game with 0 bets, and lost to games with more), and the shared expand/detail component works identically here.
  - Bumped service worker cache to `full-regalia-shell-v89`.

- **SHIPPED (2026-09-05): Games tab shows bet activity per game (1 of 3 stages — betting-activity feature).** Neil wants to see how many people (and what) have bet on a game, both on the Games tab and — in a follow-up stage — as the signal for a "Most Active Games" section on Home. This is the first stage: the Games tab itself.
  - New shared `gameBetsSummaryHtml(game, picksRows)` (`js/pick-utils.js`) — a small "🎯 N bets" toggle under each game card, hidden entirely when nobody's bet on that game. Tapping expands a list of who bet what (avatar, name, `pickLabel()`, and a Hit/Miss/Pending badge graded directly against that game) — same visual pattern `analytics.html`'s existing "Who's picked [team]" list already uses, just scoped to one specific game instead of one team's whole season.
  - `live.html` now loads `js/supabase-client.js` + `js/grading.js` + `js/season-data.js` (for `loadSeasonPicks()`) alongside its existing ESPN fetch, and wraps every rendered game card with this new component. `renderGameCard()` itself is untouched — the bet strip is a separate sibling element attached via CSS (`.game-card-group`), so `analytics.html`'s own use of `renderGameCard()` isn't affected.
  - Verified via Playwright (12/12): correct bet count per game, singular/plural wording, zero-bet games show no strip at all, expand/collapse works, and the expanded list shows the right names/picks/results.
  - Bumped service worker cache to `full-regalia-shell-v88`.

- **SHIPPED (2026-09-05): Picks page heading now uses the site's cursive brand font.** Neil's original ask ("the name is in the white font format like the rest of the site") wasn't clear enough to act on safely — I checked and the heading/badge were already rendering in the correct bright text color, so color wasn't the issue. He later clarified he meant the *cursive* Pacifico font used elsewhere (wordmark, home page quote, standings rank numbers) — applied that to `#picks-heading` ("Picks" / "{Name}'s Picks") via a new `.picks-heading-cursive` class in `css/style.css`.
  - Bumped service worker cache to `full-regalia-shell-v87`.

- **SHIPPED (2026-09-05): Weekly Awards now group by Regalia Week, not calendar week.** Immediate follow-up to the tie-handling fix below — Neil asked "shouldn't awards be tied to the pick'em week?" and he's right: calendar week was the ORIGINAL fix for NFL/NCAA week-number mismatch, invented before Regalia Week existed to solve that exact same problem in a way that's now used everywhere else (Picks page, Standings freshness line, Home CTA). Awards was the one place still using a different, older definition of "week."
  - `buildRegaliaWeeks` (`js/pick-utils.js`) gained an `includeCompleted` option (default `false`, every existing caller unaffected) — Awards needs the most recently *finished* week, which the Picks-page-oriented default (pickable weeks only) would filter out entirely.
  - `computeWeeklyAwards` (`js/awards.js`) now takes the same combined games list `loadSeasonGames()` already fetches for Standings, builds Regalia Weeks from it, maps each graded pick to whichever week claims its sport+week+seasonType bucket, and finds the latest week with any graded pick — same linking logic the Picks page uses to treat an NFL game and that week's CFB games as one unit.
  - Had to explicitly exclude NFL preseason (seasonType 1) from this, same as everywhere else pickable-ness is checked — otherwise `includeCompleted` would count 4 preseason weeks as real Regalia Weeks here (which Picks never does, since preseason is never offered as pickable), pushing this page's "Week N" numbering out of sync with the Picks page's for the same real week.
  - Result on real data: Sean's 2 season hits (previously split across two different calendar weeks) now both land in the same Week 1, and he wins Nostradamus outright with no tie — matching his #1 Standings spot. Verified against real production Supabase + real ESPN data, and re-ran the tie-handling test (below) to confirm ties still work correctly under the new grouping.
  - Bumped service worker cache to `full-regalia-shell-v86`.

- **SHIPPED (2026-09-05): Fixed Josie's "locked NCAA picks" bug + Weekly Awards now handle ties honestly.**
  - **Josie's locked picks**: root cause was 8 leftover test-seed rows in the `picks` table from early development (created in one batch on 2026-08-13, using placeholder game IDs `401001`/`401002`/`501001`/`501002` instead of real ESPN IDs, tagged `week: 1, seasonType: 2`). The app matches a player's picks to "the current week" purely by week number + season type (necessary so picks still display after their game rolls out of the live fetch window) — so these fake picks collided with the REAL season's actual Week 1 once it went live, and since the fake picks' embedded date was mid-August (long past), they showed as locked even though the real Week 1 games hadn't started. Confirmed by pulling Josie's real Supabase data and replaying it through the exact live grading/lock logic with both synthetic and real ESPN data. Only Josie had this leftover data — no other player affected. Fix was a straight SQL delete of those 8 rows (RLS correctly blocks deleting/updating any pick post-kickoff even via the anon key, including these erroneous ones, so this had to be run directly in Supabase's SQL Editor under Neil's own account rather than through the app).
  - **Weekly Awards ties**: Neil noticed Sean was #1 in Standings with 2 season hits but wasn't shown as Nostradamus. Two real findings: (1) Awards group by literal calendar week (Mon–Sun), not the NFL/NCAA pick'em week — Sean's 2 hits landed in two different calendar weeks, so the most-recent-week award only ever saw 1 of them (by design, documented in `js/awards.js`, not a bug). (2) Real bug: within that calendar week, Sean was tied with Emma and Michaela at 1 hit each, and the code silently picked whichever one happened to come first in an unordered list — no tie was ever detected or shown. Fixed by having every award (`js/awards.js`) return ALL tied winners instead of a single arbitrary one: `topTied()` for stat-based awards (most hits/misses/streak) joins tied names under one shared detail line ("Sean, Emma & Michaela — 1 hit"); Big Dawg/Buzzer Beater (where tied winners could have different specific details, e.g. two different underdogs at the same line) get one row per tied winner instead. Verified via Playwright with a synthetic 3-way tie matching the real Sean/Emma/Michaela case.
  - Bumped service worker cache to `full-regalia-shell-v85`.

- **SHIPPED (2026-09-04): Games tab — today-default dates, dropped Live/Results, two-tier NFL/NCAA + conference filters.** Third round of Neil's Games tab feedback.
  - **Date defaults to today, and actually keeps up as days pass.** Previously the date row defaulted to "All." Now it auto-selects today's date chip on load — and, since Neil specifically asked "will it progress as time moves on?", it keeps tracking today live: every 30s refresh re-checks the real date and moves the selection forward on its own, as long as the user hasn't manually tapped a chip themselves. The moment someone taps any chip (including "All"), that becomes a deliberate choice and stops auto-tracking — refreshing the page (which most people do each new visit anyway) resets it back to auto mode. Verified this specifically with Playwright's fake clock: fast-forwarded a full simulated day and confirmed the view moved from "today's game" to "tomorrow's game" with zero taps.
  - **Subtle "today" marker**: a small dot under whichever chip is today's date, independent of which chip is actually selected — so if you've tapped over to a different day, you can still see where "today" is at a glance.
  - **Removed the All/Live now/Results status filter.** Neil: "simply have the games tied to dates, default to all" — with date-based browsing as the primary way to narrow the list, a separate live/upcoming/final tab added a second, mostly-redundant axis. The full slate for whatever date is selected now always shows together, sorted live-first/rank-first same as before. Kept the "All" *date* chip, though — recommended keeping it since it's the only way to see the full multi-week slate (e.g. checking a spread line for a game 3 weeks out), and it costs nothing to leave in.
  - **Two-tier NFL/NCAA + conference filters** (Neil chose this over grouping games into collapsible conference sections in the list): a new All/NFL/NCAA row sits above the conference chips. Selecting NFL or NCAA both filters the game list AND swaps which conference chips are offered (AFC/NFC for NFL; ACC/Big 12/Big Ten/SEC/Other for NCAA) instead of one flat 7-option list mixing both leagues. "All" sports keeps the original combined list.
  - Verified via Playwright (14/14 + 4/4 for the day-progression test specifically): today auto-selected by default, exactly one today-marker present, old status chips gone, conference row correctly re-scopes per sport, and each sport/conference combination filters the visible games correctly.
  - Bumped service worker cache to `full-regalia-shell-v84`.

- **SHIPPED (2026-09-04): Games tab layout pass — scoreboard nav icon, dates
  moved to top, title removed, filters reordered, date row fits on one line.**
  Neil's follow-up round after the date chips shipped:
  - **Nav icon**: the Games tab used a wifi-signal-style icon left over from
    an earlier design; replaced with a scoreboard shape (divided rectangle
    with two score blocks) plus a small dot in the corner reading as a
    live/on-air indicator. Same SVG swapped into the bottom nav on all 8
    pages that have one (index, picks, standings, live, history, analytics,
    betting-guide, player).
  - **Layout, top to bottom is now**: date chips → All/Live now/Results →
    conference filter (NFL's AFC/NFC + NCAA's ACC/Big 12/Big Ten/SEC/Other)
    → game list. Removed the `<h1>`"Scores, Odds & Results" title and its
    ESPN-attribution subtitle entirely — that attribution still lives in the
    footer note at the bottom of the page, so the disclosure isn't lost,
    just no longer duplicated at the top.
  - **Date row wrapping**: Neil reported the date chips didn't fit on one
    row ("All" plus 5 real dates was 6 chips total). Fixed two ways: (1)
    switched the row from the grid layout other chip-rows use to flexbox,
    with "All" set to shrink to just its own text width instead of an equal
    share of the row, and (2) capped the number of real date chips from 5
    to 4 (5 chips total) — the safer, Neil-endorsed fallback ("if we can't
    [fit 5], let's just have 4") rather than risking it still wrapping on a
    narrower phone. Verified via Playwright at both 375px (iPhone SE) and
    390px (modern phone) viewports — 5 chips sit on one line at both widths
    with zero wrap.
  - Verified via Playwright (16/16 across two viewport widths): date row
    renders before the status row before the conference row, title/subtitle
    are gone, all date chips share one visual row, and the new nav icon is
    live everywhere.
  - Bumped service worker cache to `full-regalia-shell-v83`.

- **SHIPPED (2026-09-04): Replaced the Games tab's date slider with tappable date chips.** Neil, immediately after the slider shipped: "very confusing" — with the ~45-day ESPN window, a drag slider could have 15+ stops with only one floating text label showing which day you'd landed on, no visual reference for the rest.
  - New design: same idea (narrow the game list to one day), but as a row of chips — "All" plus up to 5 real dates, each labeled directly on the chip (e.g. "Sat, Sep 5"), same tap-to-select pattern as the conference filter right above it. Capped at 5 real dates so a long ESPN window doesn't turn into a wall of chips; when there are more than 5 distinct days, keeps the 5 *closest to today* (not just the first 5 chronologically) so the visible set tracks whatever's actually relevant right now, then displays them in ascending order. "All" still means every game regardless of date — the 5-day cap only limits which quick-filter chips are offered, not what "All" includes.
  - Removed the now-unused range-input CSS (`.date-filter-slider` and its custom thumb/track rules); the chip row reuses the site's existing `.chip`/`.chip-row` styles, no new CSS needed.
  - Verified via Playwright (8/8): chip row appears with >1 day, caps at 5 dates + All when 9 distinct days exist in the mock data, chips render in ascending order, clicking a specific date filters correctly, and clicking All restores every game (not just the 5 shown as chips).
  - Bumped service worker cache to `full-regalia-shell-v82`.

- **SHIPPED (2026-09-04): Games tab gets a date scrubber + ranked-teams-first
  sorting.** Neil asked for "some sort of slider" to filter by date, plus
  "highest ranking teams always appear first."
  - Date filter: a native range slider under the conference chips walks
    through every distinct calendar day that currently has a game (left end
    = "All Dates"), built fresh from `allGames` on every load/refresh so it
    always reflects what's actually in the current ~45-day ESPN window.
    Scrubbing it re-filters the list to just that day; if the previously
    selected day rolls out of range on a refresh, it resets to "All Dates"
    instead of silently showing an empty list. Hidden entirely when there's
    only one day of games in view (nothing to scrub between).
  - Ranking sort: games with a ranked team (AP/Coaches Top 25 — college
    only, ESPN doesn't publish this for NFL) now sort to the top *within*
    each existing status group (live, then upcoming, then final for the
    "All"/"Live"/"Results" tabs; most-recent-first for Results specifically)
    rather than overriding status entirely — a #1-vs-#5 matchup floats above
    an unranked game kicking off around the same time, but a live unranked
    game still shows before a ranked game that's already final. Used the
    existing `team.rank` field (already wired up for the game-card rank
    badges) via a new `bestRank(g)` helper — no new ESPN calls needed.
  - Verified via Playwright (10/10): slider count matches distinct days,
    scrubbing to a specific day filters correctly, resetting to "All Dates"
    restores the full list, and a mixed ranked/unranked slate sorts ranked-
    highest-first with the unranked game last.
  - Bumped service worker cache to `full-regalia-shell-v81`.

- **SHIPPED (2026-09-04): Analytics page's NFL/NCAA filter was there all
  along, just buried — plus a new "Add to Home Screen" install banner.**
  Neil reported "still not seeing a filter in the analytics tab for NFL
  and NCAA." Root cause: the only sport toggle on the page (`#team-sport-toggle`)
  lived *inside* the "Team Trends" section, which is collapsed by default —
  so unless you opened that section first, there was nothing to click.
  Worse, "Player Comparison" had no sport filter at all; it silently
  combined NFL and NCAA picks into one table.
  - Fix: added one page-level toggle (`#page-sport-toggle`) right under the
    page description, outside both collapsible sections, so it's visible
    immediately on load. It now drives both Player Comparison (added a
    `sport` param to `computePlayerCategoryRecord`) and Team Trends (kept
    working as before, just re-wired to the shared `pageSport` variable
    instead of its own local one). Verified via Playwright (7/7): toggle
    visible without expanding anything, Player Comparison correctly shows
    "–" for categories with no picks in the selected sport, Team Trends'
    team dropdown repopulates with only that sport's teams.
  - Also shipped, per Neil's "sure we can try it" on the earlier install-
    prompt idea: a dismissible "Add to Home Screen" banner (`js/app.js` +
    `css/style.css`), shown once per device via a `localStorage` flag.
    Never shows if the site's already running as the installed app
    (`display-mode: standalone` / `navigator.standalone`). iOS gets
    Share → Add to Home Screen instructions (no `beforeinstallprompt`
    event exists there); Android/Chrome gets a real one-tap "Install"
    button wired to the browser's own install prompt. Verified via
    Playwright (7/7): banner shows on a fresh iOS visit, dismissing it
    hides it immediately and it stays hidden across a reload, and it
    never appears at all when already running standalone.
  - Bumped service worker cache to `full-regalia-shell-v80`.

- **ROOT CAUSE FOUND AND FIXED (2026-08-30): Standings/History/Player showed
  everyone at 0 points / "Pending" forever — ESPN's scoreboard endpoint
  silently rejects date ranges over roughly 360 days, and `loadSeasonGames()`
  was requesting 400.** This is what the whole day's investigation was
  chasing (the malformed-event theory earlier today was a false lead and
  was already retracted).
  - Confirmed directly against the live endpoint: a request spanning ~360
    days returns 200 OK; the same request spanning 400 days returns HTTP
    400 `{"code":400,"message":"Failed to get events endpoint."}`. Every
    single call `loadSeasonGames()` (`js/season-data.js`) ever made used
    `daysBack: 200, daysForward: 200` — a 400-day span — so it was rejected
    outright, every time, for every visitor. `fetchScoreboard()`'s own
    try/catch (existing, unrelated to today's other changes) turned that
    rejection into a silently-empty game list, which is why this produced
    "0 points for everyone" instead of a visible error — until today's
    earlier fix added the "couldn't load" warning, which is what finally
    made this diagnosable at all.
  - **This explains a detail that had been confusing all day**: the Picks
    page never showed this problem, because it calls `fetchScoreboard`
    with only `daysForward: 200` (default `daysBack: 10` → ~210 days
    total) — comfortably under ESPN's limit. Only pages using
    `loadSeasonGames()` (Standings, History, Player) were ever affected.
  - **Not a device or network issue** — Neil's phone doing everything right
    (full Safari data clear, testing both WiFi and cellular) never could
    have fixed this, because the request was being rejected by ESPN's
    server itself before it reached this app's own logic at all. That's
    also why my own earlier "confirmed working" tests were misleading —
    they fed pre-captured JSON through mocked routes and never actually
    exercised the real 400-day URL, so they couldn't have caught this.
  - Fix: reduced to `daysBack: 150, daysForward: 150` (300 days total) —
    verified directly against the live endpoint using today's actual date,
    with a solid safety margin under the ~360-400 boundary. Still covers
    nearly a full season's history either direction. **Known tradeoff,
    not urgent**: deep into a season (roughly 150+ days after a very early
    week), that week's own games could roll back out of this window and
    stop being gradable from "today" — worth revisiting if that's ever
    actually hit, but not a concern this early in the season.
  - **Not an ESPN-dependency problem** — Neil asked whether to drop ESPN
    entirely; explained this was one misconfigured parameter, not a
    reason to rearchitect. The site's core design (fetch ESPN + Supabase
    directly from the browser) isn't what broke here.
  - Verified via Playwright: full 9-page smoke suite + History grouping
    (6/6) + NFL/CFB split (5/5) all still pass with the corrected range.
    Directly confirmed (via curl, not just Playwright mocks) that the new
    300-day range succeeds against the real live endpoint using today's
    real date.
  - The temporary diagnostics panel on Standings (added earlier today)
    should be removed now that the actual cause is found and fixed —
    tracked as a follow-up cleanup, not done in this entry.

- **CORRECTION (2026-08-30): retracted the "malformed ESPN event" fix as
  the confirmed cause of the 0-points bug.** Re-verified more carefully:
  my first verification script didn't accurately replicate the real old
  `normalizeEvent`'s optional chaining, giving a false "confirmed" result.
  Redone properly against the real old code and real current ESPN data:
  zero events actually throw. The defensive per-event try/catch in
  `fetchScoreboard()` is still in place (harmless, good practice
  regardless), but it was never proven to be *the* cause — noting this
  so the record's accurate rather than overclaiming a fix that wasn't
  verified.
- **IN PROGRESS (2026-08-30): live-data loading failure on one specific
  device, still unresolved.** Neil confirmed: full Safari data clear on
  iPhone (removes all cached code/service workers — rules out staleness
  entirely), still fails; fails identically on WiFi and cellular (rules
  out one specific network blocking it); the app **does** show the new
  "⚠️ Couldn't load live game data" warning, confirming today's code has
  reached the device and a real fetch failure is happening — just not
  yet clear which source (ESPN NFL, ESPN college, or Supabase) or why.
  Added a temporary on-page diagnostics panel to `standings.html`
  (`#diagnostics-card`) that independently fetches all three sources with
  raw, unwrapped error reporting — shows per-source success/failure, HTTP
  status, timing, `navigator.onLine`, and user agent directly on screen,
  so this can be read off a phone with no dev tools. **Remove this panel
  once the root cause is found** — it's diagnostic scaffolding, not a
  permanent feature. Verified via Playwright (5/5) that it correctly
  distinguishes per-source success/failure and surfaces real HTTP/network
  error details.

- **DONE (2026-08-30): fixed uneven chip sizing/alignment within the 4 pick
  categories** — Neil's ask ("text is bouncing left and right... doesn't
  look professional"). Root cause: the pick-option chip grid used
  `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))` — the `1fr`
  max meant a conference sub-group with only ONE eligible team (common;
  Power-4 conferences often have just one team playable in a given
  category some weeks) stretched that single chip to fill the entire row
  width, while a sub-group with 2+ teams kept normal-sized chips. Since
  chip text is centered, a lone wide chip's text visually landed somewhere
  in the middle of the full row, while denser rows' text sat much further
  left — different rows' text appeared to jump left/right scrolling down
  the list, even though each chip's own alignment was technically correct.
  Fixed by capping the max chip width (`minmax(96px, 140px)`) so chips stay
  a consistent size regardless of how many share a row — confirmed via
  screenshot, no more stretch-to-fill. Scoped to just this one chip grid
  (`js/picks.js`); verified it was the only occurrence of this pattern.

- **FIXED (2026-08-30): real production bug — every player stuck at 0
  points, confirmed happening on a fresh (non-cached, non-PWA) load, not a
  device-staleness issue.** Root cause: `fetchScoreboard()`
  (`js/live-scores.js`) ran `.map(normalizeEvent)` for an entire ~300-game
  ESPN response *inside* one try/catch. If even a single event anywhere in
  that response was shaped unexpectedly — a bye week, a TBD/placeholder
  matchup, anything `normalizeEvent` didn't expect — it threw, the catch
  caught it, and the function returned an **empty array for the whole
  sport**, not just the one bad event. Over a ~400-day fetch window that's
  a real, non-theoretical risk. Every downstream page (Standings, History,
  Player, Picks) depends on this data to grade anything, so one bad event
  silently zeroed out every player's points at once — with no visible
  error anywhere, which is exactly what made this so hard to pin down over
  several rounds of back-and-forth today.
  - Fix: each event is now normalized individually inside its own
    try/catch; a failure drops just that one event (logged to console)
    instead of the entire response.
  - **Also fixed the silence itself**: `standings.html` and `history.html`
    now show a visible "⚠️ Couldn't load live game data" message when the
    games fetch comes back completely empty (realistically always a fetch
    failure, never a real "no games" state) — previously this failed
    completely silently as "everyone stuck at 0" / "everything Pending
    forever," indistinguishable from a real data or logic bug.
  - **Separately hardened `sw.js`** during the same investigation (ruled
    out as the cause here, but a real latent risk found along the way):
    the service worker previously served this site's own JS/CSS
    *cache-first*, meaning a device whose service worker hadn't yet
    noticed a new deploy (iOS home-screen PWAs are particularly unreliable
    about checking) could keep running old cached code indefinitely
    despite having a perfectly good connection. Now network-first for all
    same-origin requests (cache is purely an offline fallback, refreshed
    on every successful fetch); cross-origin (ESPN/Supabase) requests were
    already never cached and remain untouched by the service worker
    entirely.
  - Verified via Playwright: a mix of malformed + valid events still grades
    the valid ones correctly (3/3, confirms the actual fix); a total fetch
    outage now shows the warning instead of silently rendering zeros (2/2);
    the new network-first service worker still works fully online and
    still falls back to cache offline (4/4). Plus full 9-page smoke +
    pick-lock/result/history-grouping/visibility-refresh regression
    (33/33 total across this investigation).

- **DONE (2026-08-30): refresh immediately when returning to a backgrounded
  tab, not just on the 30s timer** — real gap surfaced by Neil testing on
  his phone, where the previous day's polling fix wasn't visibly helping.
  Mobile browsers (and installed PWAs especially) aggressively pause
  JS timers while a tab isn't in the foreground — screen locked, app
  switched away from — so `setInterval(load, 30000)` alone can silently
  stall for minutes and only resume on its next scheduled tick once the
  phone comes back. Added a `visibilitychange` listener on `live.html`,
  `standings.html`, `history.html`, and `player.html` that calls `load()`
  immediately the moment the page becomes visible again, so reopening the
  app (unlocking the phone, switching back from another app) triggers an
  instant refresh instead of waiting on the timer. Verified via Playwright
  (4/4) — confirmed a dispatched `visibilitychange` event triggers an
  immediate re-fetch on all four pages, not just at the next 30s mark.

- **New backlog (2026-08-29): quick "how many did I get right" tally on the
  Picks page** — Neil's ask, not built yet. The "My picks this week" card
  (`renderProgress` in `js/picks.js`) currently only shows *completion*
  ("NFL · Week 3 — 4/4 picks made" / "✅ All set") — it never shows the
  *result* tally once those picks start getting graded partway through the
  week. Idea: once at least one of the week's picks is locked and graded,
  show something like "2/3 correct so far" above the individual category
  list, same spot the completion count lives today — reusing the same
  `gradePick()`/category-lookup plumbing the locked-category-card feature
  (shipped 2026-08-29) already added to this exact page, not a new
  calculation.
- **New backlog (2026-08-29): further integrate Picks / History /
  Standings** — Neil's ask, open-ended, not scoped yet. These three pages
  already share the same underlying data and grading functions (confirmed
  repeatedly this session — that's *why* Picks/History/Standings can never
  actually disagree with each other), but they still feel like three
  separate destinations rather than one connected story. Worth a real
  design pass at some point on questions like: should a graded pick on
  Picks link straight into its History entry (and vice versa)? Should
  Standings surface anything at the individual-pick level, or stay
  leaderboard-only? Does the new tally idea above become the connective
  thread between all three (same "X/Y correct" language everywhere)? No
  decisions made yet — flagging the direction, not a plan.
- **Reminder: live `picks` table test-data cleanup still pending** (see
  entry above from earlier today) — Neil said "can do next time." Includes
  fake players (`TEST`, `TESTDEL`, `CLAUDE_UPDATE_TEST`) and junk game IDs
  causing "Week of Invalid Date" garbage entries in History. Ask for the
  cleanup SQL when ready.

- **DONE (2026-08-29): Standings/History/Player pages now auto-refresh every
  30s, same cadence as the Games page.** Root cause of "results aren't
  updating in real time": these three pages only ever fetched/computed once,
  on initial load — no polling, unlike the Games page. If a tab was open
  from before a game finished, it would show stale numbers indefinitely,
  not because anything was wrong, just because nothing prompted a re-check.
  `standings.html`, `history.html`, and `player.html` now each wrap their
  render logic in a `load()` function, called once then on a
  `setInterval(load, 30000)` — identical pattern to `live.html`. History
  additionally preserves whatever the visitor has selected in the
  player/week filters across each background refresh (`populateFilters()`
  rebuilds the dropdown options but restores the prior selection), so a
  poll firing mid-browse doesn't silently reset "just Neil's picks" back to
  "All players." Verified live: a test confirmed Standings actually
  re-fetches on its own after 30s with zero interaction (before=1 fetch,
  after=2).

- **FIXED (2026-08-29): real bug — NFL Week 1 and NCAA Week 1 shared the
  same internal week key, found while verifying the above against real
  production data.** `weekBucketKeyFromSnapshot()`/`weekBucketKey()`
  (`js/pick-utils.js`) encode only season-type + week number, not sport —
  fine everywhere else in the app because callers already operate on one
  sport's games at a time, but `history.html`'s new week-grouping (see
  entry below) grouped by that bare key directly, which would have merged
  NFL Week 1 and NCAA Week 1's entries into one incorrectly-labeled
  section. Fixed by grouping/filtering on `entry.label` instead (e.g. "NFL
  · Week 1" vs "NCAA · Week 1" — already unique per sport+week, computed by
  the existing `weekGroupLabel()`). Did **not** change the shared
  `weekBucketKey` functions themselves, to avoid an unaudited ripple
  through every other caller — this was a narrowly-scoped fix to
  `history.html`'s own (new, not-yet-shipped) grouping logic.
  - Caught this by feeding real, live-pulled production data (actual
    `picks`/`players` rows and real ESPN scoreboard responses, not
    synthetic mocks) through the actual unmodified page code — confirmed
    both the bug and the fix against ground truth, not assumptions. Also
    re-confirmed via this process that Alex's and Sean's real picks
    (reported as a Picks-vs-History mismatch earlier) grade identically
    and correctly on both pages — Alex: Miss, Sean: Hit — matching what
    Picks already showed.
  - Also added a clean synthetic regression test (`test-history-nfl-cfb-
    split.js`, 5/5) so this stays covered without depending on live data.
  - **Flagged separately, not fixed**: the live `picks` table has
    accumulated real test-data pollution across multiple sessions —
    player names like `TEST`, `TESTDEL`, `CLAUDE_UPDATE_TEST`, and several
    fake game IDs (`test123`, `9990001`, `nfl-g1`, `501001`, etc.) that
    show up in History as garbage entries (some rendering as "Week of
    Invalid Date"). Includes at least one row I (Claude) left behind this
    session (`CLAUDE_UPDATE_TEST` / `update-test-9999`) that never got
    cleaned up. **Needs a cleanup pass in the Supabase SQL Editor.**

- **RESOLVED (2026-08-29): "Alex shows Miss on Picks but Pending on
  History" — not a data or logic bug.** Traced it all the way to ESPN
  directly: fetched the real game (SJSU @ USC, 401864494) via both the
  per-event summary endpoint and the same scoreboard endpoint
  `loadSeasonGames()` uses — both agree it's `STATUS_FINAL`/`completed`,
  final score 42–26 (total 68, over Alex's Under 59.5 → a genuine Miss,
  matching what Picks showed). Both pages call the exact same `gradePick()`
  against the exact same live-fetched data — there's no second calculation
  that could disagree. The service worker doesn't cache ESPN responses
  either (only the local shell files, and it never writes cross-origin
  responses into its cache — checked `sw.js` directly). Most likely
  explanation: History computes once per page load and doesn't auto-poll
  like the Games page does (30s interval) — if that tab was open before
  the game finished, it'll show stale "Pending" until reloaded. Not fixed
  in code since there's nothing to fix; noted here in case the same report
  recurs and a "History doesn't stay fresh" pattern becomes worth solving
  properly (e.g. adding the same polling Games already has, or an explicit
  "as of [time] — refresh" note).

- **DONE (2026-08-29): History grouped by week, with a combined hit-rate/
  points summary atop each week** — Neil asked for this directly after the
  above investigation ("group History results by week... show what hit,
  what miss, how many of the 4... how many points won").
  - `computeHistoryEntries()` (`js/season-data.js`) now also returns
    `hits`/`total` per entry (previously only `points`/`graded`).
  - `renderHistoryEntry()` shows "`hits/total · points pts`" next to each
    player's own card (also benefits `player.html`, which shares this
    function — no changes needed there, just a bonus).
  - `history.html`'s `render()` now groups filtered entries by week (same
    label the week filter dropdown already uses), sorted most-recent-first,
    with a `.section-label` header per group showing the **combined**
    hit-rate and points across everyone who picked that week — separate
    from, and in addition to, each individual player's own card underneath
    it. The existing player-name link into `player.html` is unchanged.
  - Verified via Playwright (6/6, hand-checked math: 2 players, one 1-hit-
    1-miss and one 1-hit, correctly rolling up to a 2/3 · 2.0 pts group
    total) + confirmed `player.html` still renders correctly with the
    shared function change + the 9-page smoke suite.

- **DONE (2026-08-29): small day/time line under an upcoming (not-yet-
  locked) pick's summary**, per Neil's ask.
  - Only shown for picks whose game hasn't started yet — once locked, the
    full game card (added just above) already shows richer live/final
    status, so a static kickoff-time readout there would be redundant.
  - **Caught and fixed a real bug while building this**: the first version
    unconditionally read the pick's stored value while computing the
    summary line, even for categories with *no* pick at all — crashed the
    entire category render (an uncaught exception, not just a display
    glitch) for any sport section containing an empty category, which is
    the normal case for basically every category until all 4 are filled.
    Would have broken the Picks page for real users. Caught immediately by
    a new test that (unlike the previous two, which happened to only
    exercise already-filled categories) specifically checked a category
    with no pick — worth remembering: test the *empty* state, not just the
    happy path, especially right after touching code that runs inside a
    `.map()` over all 4 categories.
  - Verified via Playwright (5/5 new + full 9/9 lock + 6/6 result + 9-page
    smoke, all re-run after the fix) — upcoming picks show the date line,
    locked ones don't (game card covers it instead), zero console errors
    anywhere.

- **DONE (2026-08-29): locked picks now show the full game card (real
  score, team names, live/final state), not just the pick's own line —
  Neil asked to see "the full game... with the icons."**
  - Reused `renderGameCard()` as-is (`js/live-scores.js`, the exact
    component the Games page already uses) rather than building a second
    one — same team abbr/name, home marker, colored Live/Final left border,
    and the Spread/O-U line, now also inserted directly into a locked
    category's body on the Picks page. Updates live while the game's still
    in progress (same 🏠/team-name treatment, not a static snapshot).
  - Confirmed (in response to Neil's question) that this required no
    changes to how points/results reach Standings or History — the new
    Picks-page display calls the same `gradePick()` everything else
    already uses; it's an additional view, not a second calculation that
    could drift out of sync.
  - Verified via Playwright (9/9 lock + 6/6 result, both updated for the
    new body content) + the 9-page smoke suite.

- **DONE (2026-08-29): Picks page now shows Hit/Miss/Push directly on a
  locked category, instead of just "Locked" — closes the loop Neil asked
  about ("how does a player know if they won?").**
  - Previously the only place to see a graded result was History or a
    player's own page — the Picks page itself just said "🔒 Locked" forever,
    even after the game finished. Now, once a locked category's game is
    actually final, that same header slot shows the real result instead —
    same `gradePick()`/`statusBadge()` History and player.html already use,
    just computed inline where the pick lives.
  - Needed `js/grading.js` added to `picks.html` (wasn't loaded there
    before) and the page's already-fetched-but-previously-discarded
    unfiltered game list (`allGames` — includes recently-finished games
    within the existing ~10-day lookback, not just still-pickable ones)
    threaded through `renderSportSections` → `categoriesHtmlForSport` so a
    locked pick's game can actually be looked up and graded.
  - A locked-but-not-yet-finished game still shows "🔒 Locked" exactly as
    before — this only replaces that text once ESPN reports the game
    final, automatically, no extra step.
  - Verified via Playwright (6/6 new + 8/8 lock regression, hand-checked
    math): a covered spread pick shows "Hit," a total pick shows "Hit,"
    zero chips remain (still can't be changed once graded), and an
    in-progress-but-unfinished game still correctly shows "Locked" rather
    than a premature result. Plus the 9-page smoke suite.
  - **Note**: this session's test scratchpad got cleared between sessions
    (not a code issue) — rebuilt a `test-smoke.js` covering console errors
    across all 9 pages as the new baseline regression check; the fuller
    `test-batch2.js` suite from earlier sessions no longer exists and would
    need rebuilding if deeper Picks/Live regression coverage is wanted
    again.

- **URGENT FIX (2026-08-29): players reported being able to "change picks
  after the game started" — root cause found, was a client-side UX gap,
  not an actual data-integrity hole.**
  - Re-tested the database lock directly, both write paths the app actually
    uses: a raw insert with a past kickoff (blocked, as before) AND the
    exact `upsert`-with-`merge-duplicates` call `js/picks.js` uses for
    saving (also correctly blocked — confirmed via a live test against
    production). **No pick has ever actually been changed in the database
    after its game started** — the writes were always rejected.
  - The real problem: once a picked game starts, it silently drops out of
    the live-fetched pickable pool (correct), but the category's collapsed
    summary still showed the OLD pick with no lock indicator, and expanding
    it showed a chip grid of *other* games with nothing marked "selected" —
    reading as "nothing picked yet, go ahead," not "this is locked." A
    player could tap a different chip (a real, allowed pick for a *different*
    still-open game) and reasonably believe they'd "changed" their original
    pick, when saving that swap would actually fail cleanly server-side
    (checked `doSave()`'s delete-then-upsert sequence — a failed delete
    correctly aborts before the upsert runs, so no partial/orphaned state
    is possible either).
  - **Fix**: `categoriesHtmlForSport` (`js/picks.js`) now checks whether a
    category's existing pick's own game has already kicked off (compared
    against the *stored snapshot's* date, not the live-fetched game list —
    accurate even if the tab's been open across a kickoff, unlike
    `gamesBySport` which is only fetched once at page load). A locked
    category renders **only its header** — "🔒 [your pick] · 🔒 Locked"
    replacing the chevron, zero chips, no body at all — nothing left to
    tap, not just a warning. Clicking a locked header is a no-op (checked
    via a new `data-locked` attribute in the click handler). Unrelated
    categories on still-open games are completely unaffected.
  - Verified via Playwright (8/8): a pick on an already-finished game shows
    the lock + original value with zero chips rendered, clicking the locked
    header produces no chips, and a different category with no existing
    pick on a still-open game remains fully editable. Plus a 9-page
    console-error smoke check (full regression suite needed rebuilding —
    the scratchpad session that held it was cleared between sessions).

- **New backlog (2026-08-21): odds movement tracking / alerting**, Neil's
  idea — not scoped for a build yet, splits into two genuinely different
  pieces:
  - **Trend tracking (feasible within the current architecture).** ESPN's
    scoreboard response is only ever a snapshot of the *current* line — no
    history is available from them. Would need a new Supabase table (e.g.
    `odds_history`: game_id, captured_at, spread, over_under) written to
    opportunistically whenever the app is already fetching odds (Games/
    Picks pages already poll ESPN every 30s while open) — no new scheduled
    infra needed, just record-on-change instead of only reading. Coverage
    would be imperfect (only captures movement while someone happens to
    have a tab open), but cheap and fits the existing all-client,
    no-backend design. Display idea: a small "↓3 since Tue" indicator next
    to a line on Analytics' team detail or the Games page.
  - **Real alerting (push notification the moment a line moves) — a much
    bigger lift, genuinely new infrastructure.** This is a static site with
    no server of its own, so reliable polling (not dependent on someone
    having the app open) needs a scheduled job — e.g. a GitHub Action on a
    cron, hitting ESPN and writing to Supabase on a fixed interval — plus
    Web Push subscription handling (VAPID keys, per-device subscriptions,
    a way to actually trigger delivery), none of which exists today.
  - **Recommendation discussed with Neil:** build trend tracking first
    (cheap, fits what exists) and treat push alerting as a separate,
    larger project to reconsider only if the trend data turns out to be
    something people want surfaced faster than "check the app."

- **DONE (2026-08-21): "Who's in" badge relabeled "✅ All set"** (was
  "✓ Submitted"), matching the wording already used by the "My picks this
  week" per-sport progress card (`renderProgress`) — same green checkmark
  treatment, now consistent across both places on the page that say
  "you're done." Confirmed (re-verified, not just re-asserted) that the
  underlying Week 1 fix from the entry above is doing exactly what Neil
  described: the badge and the NFL/NCAA breakdown only count the sport(s)
  actually linked that week, so Week 1 (NCAA-only) correctly shows "NCAA
  4/4" with no NFL figure at all, not "NFL 0/4." Verified via Playwright
  (8/8) + full 31/31 site regression suite.
- **RESOLVED (2026-08-21): `anon` DELETE grant applied, stray test row
  cleaned up** — Neil ran the SQL from the entry above in the Supabase SQL
  Editor. Category-pick swapping (changing a pick to a *different* game,
  not just filling an empty category) should now actually work — worth a
  real end-to-end test next time picks are being made, since this path was
  never empirically confirmed working before today.

- **NEEDS ACTION FROM NEIL: `anon` role still can't DELETE from `picks` —
  confirmed broken via a live test today (2026-08-21), and it left a stray
  test row in the production table that I can't remove myself.** This is
  the same gap flagged (but never confirmed either way) back when the
  category-swap feature was built — now definitively confirmed still
  missing. Practical impact: swapping a category pick to a *different*
  game doesn't work (picking a fresh, empty category is unaffected — that's
  a plain insert). Run this in the Supabase SQL Editor (bypasses `anon`'s
  RLS, so it'll work regardless of the grant status):
  ```sql
  grant delete on public.picks to anon;
  create policy "Anyone can delete picks before kickoff"
    on picks for delete using (kickoff_at > now());
  delete from picks where player_name = 'CLAUDE_LOCK_TEST';
  ```
  The last line removes the stray test row (`game_id`
  `lock-test-future-9999`, harmless fake data, kickoff year 2099 so it'll
  never surface as a real pick — but should still be cleaned up).

- **VERIFIED (2026-08-21): kickoff auto-lock is real and working today —
  tested live, not just re-read from old notes.** Neil asked directly
  whether picks actually lock once a game starts. Tested against the live
  Supabase table: a raw insert with a kickoff time in the past was rejected
  with a genuine RLS policy violation (HTTP 401, `new row violates
  row-level security policy`); the identical insert with a future kickoff
  succeeded (HTTP 201). Confirms `js/supabase-client.js`'s documented claim
  — enforced at the database level, not just hidden in the UI — is
  currently true in production, not just true as of whenever it was last
  checked.

- **DONE (2026-08-21): "Submitted" status now uses the actual pick count
  for the week, not a hardcoded 8.** Neil caught that Week 1 (NCAA-only,
  see the "Crown Week" entries above) could never show a player as
  "Submitted" even after they'd completed all 4 available NCAA picks —
  `renderWeekStatus`/`loadAndRenderStatus` required `total === 8` no matter
  what, and with no NFL week linked yet, 8 was structurally impossible.
  New `expectedPickTotal(sportWeeks)` returns 4 per sport that's actually
  linked this week (4 for an NCAA-only week, 8 once both are linked) — used
  for both the "✓ Submitted" badge and the "X of Y submitted this week"
  summary count. Also stopped showing "NFL 0/4" on a week where NFL has
  nothing posted yet (looked like someone forgot, not like there was
  nothing to pick) — the per-player row now only lists the sport(s)
  actually in play that week.

- **DONE (2026-08-21): removed the "couple" label from every player
  display**, per Neil ("just the user name is fine") — Standings rows,
  `player.html`'s subtitle (now always "Season history"), and the admin
  roster list. `findCouple()` removed as dead code once both its callers
  were gone. Left the `players` table's `couple` column and admin.html's
  optional "Couple label" input alone — not displayed anywhere now, but
  not deleted either, in case it's wanted again later.
  - Verified via Playwright (8/8): a fully-picked NCAA-only week correctly
    shows "Submitted" (not stuck on "In progress"), the row omits the NFL
    count entirely, and the couple label is confirmed absent from Picks,
    Standings, and `player.html`. Plus the full 31/31 site regression
    suite.

- **CORRECTED (2026-08-20): reverted "Crown Week N" wording, restored
  single-line header.** Neil's earlier ask ("should just be Crown Week 1")
  meant the crown *emoji* — spelling out the word "Crown" too, alongside the
  emoji, read as redundant ("can't have both"). Title text is back to
  "👑 Week N" (emoji only). Also reverted the two-line collapsed-header
  split from the same session — the actual fix for the original overflow
  complaint was making the date range visually smaller
  (`.week-picker-current-date`, 12px/faint vs. the week number's larger
  bold), not moving it to its own line; it's back on the same line as the
  week number + Current/Next badge, sized down so it fits. The sequential
  positional numbering (1, 2, 3... instead of either sport's own week
  number) is unchanged — that part wasn't what Neil was objecting to.
  Verified via Playwright (12/12, updated assertions) + full 31/31 site
  regression suite; confirmed header renders as a single ~23px-tall line.

- **DONE (2026-08-19): "Crown Week" sequential numbering + week-picker
  header layout cleanup, per Neil.**
  - Regalia Week numbering is now purely positional (1, 2, 3, ... in
    chronological order across the merged NFL+NCAA-only list), not derived
    from either sport's own week number. Previously an NFL-paired week
    showed the NFL's number and an NCAA-only week (see the fix just above)
    showed the NCAA's — both could independently read "Week 1" and looked
    like a duplicate/typo. Title text simplified to just "👑 Crown Week N"
    (dropped the "NCAA Week N" special-case and the "Picks" suffix).
  - **Header layout fixed**: the date range used to be baked into the same
    title string as "Crown Week N" + the Current/Next badge, all one line —
    overflowing/wrapping badly on narrow phones. Now a separate smaller
    line beneath the title, both in the collapsed header
    (`.week-picker-current-title` / `.week-picker-current-sub`, new CSS)
    and in each expanded row (date range moved into the existing
    `.week-picker-row-sub` line alongside the NFL/NCAA breakdown).
  - Verified via Playwright (12/12): sequential numbering across a CFB-only
    week + an NFL-paired week, title/date genuinely on separate DOM
    elements (not just visually wrapped), plus the full 31/31 site
    regression suite.

- **FIXED (2026-08-19): most of NCAA's Week 1 games were invisible on the
  Picks page (real bug, reported by Neil, confirmed against live ESPN
  data).**
  - Root cause: college football's season starts about 2 weeks before the
    NFL's. Checked live data the same day — CFB Week 1 (Aug 29–Sep 7) had
    98/99 games with odds already posted (essentially complete coverage);
    CFB Week 2 (Sep 11–13) had only 7/86. But the NFL's only pickable week
    right then was Week 1, starting Sep 10 — and `buildRegaliaWeeks()`'s
    nearest-date pairing correctly matched that to CFB Week 2 (Sep 12, the
    closer of the two), not CFB Week 1 (Aug 29, ~12 days off). Since the old
    code only ever iterated `nflWeeks.map(...)`, any CFB week that lost its
    pairing — here, the one with the *most* pickable games — was silently
    dropped from `regaliaWeeks` entirely, not just deprioritized. The
    "current" week ended up pointing at the 7-game CFB week while the
    98-game week was completely unreachable through the UI. This is what
    Neil saw as "a very large amount of the [NCAA] games are missing."
  - Fix: `buildRegaliaWeeks()` (`js/picks.js`) now also surfaces any CFB
    week that didn't win an NFL pairing as its own NCAA-only Regalia Week
    entry (`nflWeekKey: null`), merged into the same chronologically-sorted
    list instead of being dropped. `regaliaWeekTitle()` labels these "NCAA
    Week N" (not "Week N", which would collide with a later NFL-numbered
    week sharing the same number) and the week-picker row's subline now
    shows "NFL: not posted yet" — mirroring the fallback text that already
    existed for the reverse case (NFL week with no CFB match yet).
  - Verified against live ESPN data reproduced in a Playwright test (9/9):
    the CFB-only week now appears as "Current" with all 3 (of the real 98)
    sample games reachable as pick options, the NFL-Week-1/CFB-Week-2
    pairing still appears correctly as "Next," and the NFL section for the
    CFB-only week shows its own honest "no games posted yet" rather than
    crashing or bleeding in the wrong week's games. Plus the full 31/31 site
    regression suite.

- **New backlog (2026-08-19): Analytics discoverability follow-ups**, not
  built yet:
  - `player.html` has no link back into the Analytics comparison table —
    currently the link only goes one direction (Analytics' player rows link
    to `player.html`, nothing links back). Cheap, obviously-good fix: a
    small "See how everyone compares →" link on `player.html` pointing to
    `analytics.html`.
  - Analytics is still only reachable via the Home hub card and the Games
    page's team links — it's not in the bottom nav on any page, and isn't
    even in its *own* nav bar (visiting `analytics.html` shows the standard
    6 tabs with nothing highlighted active, since it's not in any page's
    `data-page` list). Whether it deserves its own bottom-nav tab now that
    it actually does something is a real layout decision (7th tab vs.
    swapping one out) — **genuinely Neil's call, not decided**. Related to
    the older "replace Live tab with Analytics" idea below, which was
    explicitly deferred until the season's underway; worth revisiting
    together rather than as two separate decisions.

- **FIXED (2026-08-19): "Save my picks" button hidden behind the bottom nav
  on notched/gesture-nav phones (real bug, reported by Neil).**
  - Root cause: `.bottom-nav` pads itself by `env(safe-area-inset-bottom)`
    (the iPhone home-indicator / Android gesture-bar inset), so its true
    on-screen height is `--nav-height` (64px) **plus** that inset — often
    ~34px more on a modern iPhone. But `.sticky-save-bar` and
    `.picker-badge` were positioned using only `var(--nav-height)`, with no
    idea that inset existed. On any phone with a nonzero inset, both fixed
    elements sat exactly that amount too low, so the nav bar (higher
    z-index) visually covered the bottom of the Save button. Invisible on
    desktop/non-notched testing, which is why it shipped unnoticed.
  - Fix: new `--safe-bottom: env(safe-area-inset-bottom, 0px)` custom
    property in `:root`, threaded into every calc that previously assumed
    the nav was exactly `--nav-height` tall — `.sticky-save-bar`'s `bottom`,
    `.picker-badge`'s `bottom`, and both `body`/`body.has-sticky-save`'s
    scroll-clearance `padding-bottom`. `.bottom-nav`'s own padding now
    reads from the same variable instead of repeating `env()` inline.
  - Verified via Playwright: since headless Chromium doesn't get a real
    nonzero `env(safe-area-inset-bottom)` value, simulated a notched phone
    by overriding `--safe-bottom: 34px` directly (exercises the identical
    calc() chain a real device would) — confirmed the save bar's bottom
    edge meets the nav's top edge with no overlap, in both the 0px and 34px
    cases, and the Save button itself sits fully above the nav. Plus the
    full 31/31 site regression suite.

- **DONE (2026-08-19): New app icon (cursive "FR" monogram) + passphrase
  changed to "reg".**
  - Old icon was a generic crown clipart on a rounded-square badge sitting
    inside a navy border — wasted space on the actual 512/192/180px canvas
    and didn't reflect the site's own established brand voice (the Pacifico
    cursive + Anton bold-impact combo already used in the Home page's brand
    quote). Explored 4 directions with Neil (cursive "F", crown + cursive
    "Regalia" wordmark, crown full-bleed, cursive "FR") — landed on a bold
    Pacifico "FR" monogram, full-bleed diagonal gradient (`#4a90d9` →
    `#9cc4ec`, same colors/angle as `.picker-card`'s existing gradient),
    kept within a safe-zone margin for maskable-icon cropping. Checked
    legibility at real home-screen sizes (60/44/32px with rounded-corner
    masking simulated) before committing — held up fine.
    `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`
    overwritten in place (same filenames/dimensions — no HTML/manifest
    changes needed). **Note for Neil**: an icon already added to a phone's
    home screen won't auto-update — remove and re-add it to see the new one.
  - **Passphrase changed to "reg"** (was "regalia2026") — updated
    `GATE_PASSPHRASE_HASH` in `js/gate.js` per the file's own documented
    "how to change this" instructions. Case-insensitive, same as before.
    Verified via Playwright (5/5): wrong passphrase stays locked, correct
    passphrase (any case) unlocks and persists to localStorage.
  - `sw.js` bumped since `icon-192.png` is cached in `SHELL`.

- **DONE (2026-08-19): Analytics reworked into a real players-vs-players
  comparison table (was one card per player).**
  - Per Neil: Analytics should be "players against players against the 4
    categories, then teams against the betting categories" — a player's own
    history/points trend stays on `player.html` only ("their own card and
    scores"); Analytics is purely the cross-entity comparison view.
  - **Player comparison** is now a real `<table>` (new `.compare-table` CSS)
    — one row per roster player, one column per category (using the same
    −/+/▲/▼ icons as the Picks page's `CATEGORY_ICON`), so you can scan
    across and compare, e.g., who's actually good at Unders — the thing a
    stack of individual cards couldn't do at a glance. Missing data renders
    as "–", not "0%" (same care as elsewhere — no data isn't the same as
    "always misses"). Name cell links to `player.html?name=X`.
    Section reordered above Team trends to match "players... then teams."
  - Team trends section itself is unchanged (sport toggle → team select →
    detail card) — that was already "teams vs. the betting categories."
  - Verified via Playwright, 21/21 (updated from the prior 22 — the
    per-player-card assertions were replaced with table-row/cell
    assertions) + the full 31/31 site regression suite.

- **DONE (2026-08-19): "Live" renamed to "Games" + team names now link to
  Analytics + picker "Change" hint.**
  - **Nav rename**: the bottom-nav tab (all 8 pages), the Home hub-grid card,
    the "Home scores & odds" card copy on Home, and the betting-guide's
    per-tab explainer all now say "Games" instead of "Live" — filename/URL
    (`live.html`) and `data-page="live.html"` unchanged (active-nav
    highlighting keys off that, not the label — verified before renaming),
    so nothing else needed to change. `<title>` updated too.
  - **Team names on the Games page now link into Analytics** —
    `gameCardTeamRow()` (`js/live-scores.js`) wraps each team's abbr+name+
    score in an `<a href="analytics.html?team=ABBR&sport=nfl|cfb">` (whole
    row is one tap target, matching how `.standings-row` already works for
    players). New `css/style.css` rule (`a.game-card-team`) resets anchor
    defaults so it's visually identical to before, just tappable.
    **Deliberately not done on the Picks page's category chips** — a chip
    there is already the tap target for making a pick; a second meaning on
    the same tap would be confusing (Neil's call).
  - **Analytics deep-link handling made more robust**: previously a
    `?team=X` link only resolved if `allTeams` (teams with ANY finished game
    this season) was non-empty — meaning every team link would silently do
    nothing until the first game of the season finished. Refactored so
    `renderTeamDetail()` always resolves independently of the picker UI: a
    team with 0 finished games now shows "No finished games yet for X this
    season" by name, instead of just falling through to the generic
    "no completed games yet" card or doing nothing. Also removed the
    now-redundant static `#team-trends-empty` block — both the generic and
    per-team empty messages render dynamically into `#team-detail`.
  - **Picker "Change" hint** (Picks page): the player name/avatar picker
    didn't read as clickable. Wrapped the `<select>` in a
    `<label for="player-select">` alongside a small accent-colored
    "Change ▾" hint at the far right of the row — tapping the hint also
    opens the dropdown (native label-for-select behavior), no JS needed.
  - Verified via Playwright: 31/31 (full-site regression) + 22/22
    (Analytics-specific, including a hand-hit port-collision hang in the
    test harness itself — fixed by giving each scenario its own port and
    handling the server's `error` event instead of only `listen`'s
    callback, which had been silently deadlocking two sequential scenarios
    that reused one port).

- **DONE (2026-08-16): Team + player trends built into `analytics.html`**
  (was a "coming soon" stub; now a real page, still linked from the Home hub
  card, copy updated from "Coming soon"/"Preview →" to reflect that).
  - **New `js/team-stats.js`**: `computeTeamRecord(games, teamAbbr)` derives
    a team's Minus/Plus Spread cover record and Over/Under split purely from
    data `fetchScoreboard()` already returns for every game (final score +
    closing lines) — reuses `gradeSpread()`/`gradeTotal()` from
    `js/grading.js` against the team's own line instead of a saved pick.
    `teamsWithFinishedGames(games)` builds the team list dynamically (no
    hardcoded roster) from whichever teams have actually played a finished,
    real-season (non-preseason) game with a posted line.
  - **Team trends section**: NFL/NCAA sport toggle + a team `<select>`
    (populated only with teams that have finished games), then a detail card
    with 3 stat rows (Minus Spread, Plus Spread, Over/Under). Supports a
    `?team=ABBR&sport=nfl|cfb` deep link so team names elsewhere in the app
    can eventually link straight in (not wired up yet — see backlog note
    below).
  - **Player trends section**: one card per roster player (reusing
    `LEAGUE_PLAYERS`, `loadSeasonPicks()`/`gradeSeasonPicks()` from
    `js/season-data.js`), 4 stat rows (Minus/Plus/Over/Under), grouped via
    the same `pickCategory()` used everywhere else. Avatar/name links to
    `player.html?name=X`.
  - **Placeholder-safe by design**: since there's no season data yet, both
    sections show a single clean empty-state card ("No completed games yet…"
    / "No graded picks yet…") instead of rendering empty rows per team/
    player — verified this actually renders correctly, not just coded to.
  - New shared CSS: `.stat-row`/`.stat-row-bar`/`.stat-split-bar` (cover-%
    bars + the Over/Under split bar), alongside the existing `.progress-bar`
    pattern. `js/team-stats.js` added to `sw.js`'s `SHELL` cache list.
  - **Not done yet, left for a follow-up**: wiring actual `<a>` links from
    team names (Picks category chips, Live game cards, Standings) into
    `analytics.html?team=X&sport=Y` — the deep-link support is there, just
    not called from anywhere yet.
  - Verified via Playwright (16/16): empty-state math with 0 games/picks,
    then a populated scenario with hand-computed KC/ALA records and two
    players' category splits, cross-checked against the actual formula by
    hand (KC: favored-and-covered → Minus 1-0-0/100%; underdog-and-missed →
    Plus 0-1-0/0%; one game over its total, one under → 1O–1U split).

- **DONE (2026-08-16): Picks reorder + conference filter chips + Live page redesign.**
  - **Picks page reordered**: the week picker (`#week-picker`) now sits at the
    very top of `<main>`, right after "How this works." "League status" lost
    its own `.section-label`/`.card` and is now a small condensed blurb
    (new `.league-status-blurb` in `css/style.css`) directly beneath the week
    picker — still clickable/expandable (same `#status-summary`/
    `#week-status-list` IDs, just restyled), just no longer reads as its own
    competing section. "Who's picking?" now comes after both.
  - **Conference filter chips**, built as the lighter alternative floated (and
    declined at the time) in the previous entry below — Neil came back and
    asked for it. Chip row (All/AFC/NFC/ACC/Big 12/Big Ten/SEC/Other) added
    above `#games-list` on the Picks page, coexisting with — not replacing —
    the free-text search; both filters combine (AND logic). Extracted
    `NCAA_CONFERENCES`/`NCAA_TEAM_TO_CONF`/`teamGroupLabel()` out of
    `js/picks.js` into `js/pick-utils.js` so the same grouping logic could be
    shared with the Live page (previously Picks-only).
  - **Same conference filter added to `live.html`**, combining with the
    existing status filter (All/Live now/Results). Needed `js/pick-utils.js`
    and a `fetchNflDivisions()` call added to that page (wasn't previously
    loaded there).
  - **Live page game cards redesigned** for readability — new `.game-card`
    family in `css/style.css` (was reusing `.pick-game`, the Picks category
    chip styling, which didn't fit a read-only result display). Team
    abbreviation (bold) + full name (muted, truncates) + right-aligned score;
    a colored left border cues state at a glance (green = live, muted = final,
    default = upcoming); the winning team is brought to full text color once
    a game is final; a small 🏠 marks the home team; odds moved below a
    divider line instead of crammed into one small text row.
  - **Analytics team-click idea logged**, not built: see "New backlog —
    stats/trends pages" below — team names linking to ATS history depends on
    the still-unsolved data-sourcing problem there, so it's a note on that
    entry, not new work.
  - Verified via Playwright (31/31): DOM order, condensed status-card styling,
    conference filter narrowing correctly (including combined with the
    existing Live status filter), new game-card classes/winner-highlighting/
    home-icon, zero console errors across all 8 pages. `sw.js` bumped to v31.

- **DONE (2026-08-16): nav reorder + search bar sectioning.**
  - **Picks moved to the 2nd nav slot** (was 3rd) — bottom nav order across
    all 8 pages that have it (`index.html`, `picks.html`, `standings.html`,
    `history.html`, `player.html`, `live.html`, `betting-guide.html`,
    `analytics.html`; `admin.html` deliberately has no bottom nav, unchanged)
    is now Home → Picks → Standings → History → Live → Guide.
  - **Team search given its own section** on the Picks page — a
    `<hr class="divider">` plus a new "Find a team or a game" section-label
    now separates it from "Make picks"/`#games-list` above, instead of
    sitting directly underneath with no visual break.
  - **Considered and declined (for now): replacing free-text search with a
    structured Sport → Conference → Division → Team filter.** Neil raised
    it, we talked through the tradeoff — recommended keeping free-text
    search (faster for anyone who already knows the team, no extra taps)
    since the conference/division *browsing* need is already covered by the
    existing sub-group headers inside each expanded category. Floated a
    lighter alternative (tappable AFC/NFC/conference filter chips above the
    search box) if browsing still feels hard — not requested/built, revisit
    if it comes up again.

- **DONE (2026-08-16): batch of Home + Picks polish requests.**
  - **Home** (`index.html`): moved the 💰 emoji to after "Bags" in the brand
    quote ("We do the Bags 💰 right..."). Added a small instructional line
    below the quote ("👇 Tap below to make your picks for the week")
    pointing at the CTA button.
  - **Picks — top text collapsed, not deleted**: the old always-visible
    onboarding paragraph (below "{Name}'s Picks") is now a native
    `<details>/<summary>` "ℹ️ How this works" — collapsed by default, no JS
    needed, content unchanged for anyone who wants to read it.
  - **Week picker made more prominent**: bigger header (14px → 17px),
    accent-tinted background (new `.week-picker-prominent` modifier,
    matching `.picker-card`'s existing hero treatment), and — the
    functionally important part — the Current/Next badge now shows in the
    *collapsed* header text too (`renderWeekPicker()` in `js/picks.js`), not
    just inside the expanded list. Neil: this is the single most important
    indicator on the page for "what do I need to pick right now," so it
    shouldn't require opening the list to see.
  - **Reordered**: League status moved from the very top of the page to
    directly below the week picker (was: League status → Who's picking →
    week picker; now: Who's picking → week picker → League status).
  - **Progress visualized**: "My picks this week" now shows a small gradient
    progress bar per sport plus a "✅ All set" swap-in (replacing "4/4
    picks") once a sport's 4 categories are all filled — new
    `.progress-row`/`.progress-bar`/`.progress-bar-fill` classes.
  - **"College" renamed "NCAA" site-wide** — `sportLabel()` in
    `js/pick-utils.js` is the single source most pages read this from
    (Standings/History/Player/Picks progress/save messages all inherit the
    rename automatically); 2 more hardcoded literals fixed by hand in
    `js/picks.js` (week picker row text) and `js/live-scores.js` (Live page
    game-card sport badge).
  - **One sticky Save button, not two.** Removed `#save-btn-top` and
    `#save-btn-bottom` (and their separate status lines) entirely — replaced
    with a single `#save-btn` in a new fixed `.sticky-save-bar`, positioned
    directly above the bottom nav (same fixed-positioning technique already
    used for the picker-color badge, which now stacks above this bar via a
    new `--save-bar-height` CSS variable both elements share). `body` gets a
    `has-sticky-save` class on this page only, adding extra bottom padding
    so page content can scroll clear of both stacked fixed elements instead
    of hiding underneath them. `doSave()` in `js/picks.js` consolidated to
    reference one button/one status element instead of two of each.

- **DONE (2026-08-14): Picks page cleanup — dropped the week-linking
  explainer text, moved team search to the bottom.** Neil: the "NFL's week
  numbering is the anchor..." footer-note under the week picker was internal
  mechanics a player doesn't need to know — removed entirely, no
  replacement (the linked pair is already self-evident from each week
  picker row's "NFL: Week X · College: Week Y" text). `#team-search` moved
  from just above the top Save button to just above the bottom one, after
  `#games-list` — pure HTML reorder, no JS changes needed since the search
  input's `id` and event wiring are unchanged. **Open question, not
  resolved:** Neil is weighing whether the bottom "Save my picks" button is
  still worth keeping at all — left in place for now since he said he's
  still deciding, not asked to remove it yet.

- **DONE (2026-08-14): removed the NFL/NCAA toggle chips — both sports show
  together now.** Follow-up on the Regalia Week linking above. Neil: now
  that weeks are linked, the toggle felt like an unneeded extra step; wanted
  NFL and NCAA as collapsible sections instead, still avoiding excess scroll.
  - `js/picks.js`: `renderCategoryPools()` split into `categoriesHtmlForSport()`
    (the 4-category-card logic for one sport, basically unchanged internals)
    and a new outer `renderSportSections()` that renders BOTH sports, each
    under its own collapsible "🏈 NFL" / "🎓 NCAA" section — collapsed by
    default, same reasoning as the categories inside them: expanding all 8
    categories' worth of content at once would be too much scroll.
  - Removed `selectedSport`/`currentWeekKey()` entirely — there's no single
    "currently selected sport" anymore. `categoryExpanded` is now nested per
    sport (`{nfl:{...}, cfb:{...}}`); every category/chip element carries a
    `data-sport` attribute so the click handler (which used to just read the
    one global `selectedSport`) can tell which sport a click belongs to.
  - Team search now spans both sports at once — a sport section auto-expands
    (or hides entirely if nothing in it matches) the same way categories
    already did within one sport.
  - Save-confirmation message reworked to show both sports' progress
    together (`NFL 2/4 · College 3/4`) instead of just whichever sport was
    "selected," since both are now always visible/editable together.

- **DONE (2026-08-14): "Regalia Week" — links NFL and NCAA week selection
  on the Picks page.** Neil: it was genuinely confusing not knowing which
  NCAA week corresponds to whichever NFL week you're picking, since the two
  are independently numbered and don't share a calendar. Replaced the two
  separate week concerns with one linked selector:
  - **New `buildRegaliaWeeks()` in `js/picks.js`** — NFL's own week
    numbering is the backbone (complete, clean coverage all season, and
    NFL's already the site's default/primary sport everywhere else); each
    NFL week is paired with whichever NCAA week's games start closest in
    time (within a 10-day window). Picking one "Regalia Week" now sets
    `sportWeeks.nfl` AND `sportWeeks.cfb` together — switching the NFL/NCAA
    sport toggle afterward never lands on two unrelated weeks, since both
    are already synced from the same selection.
  - **Native `<select id="week-select">` replaced with a collapsible
    picker** (`.week-picker`, same collapsed-by-default pattern as the pick
    categories and League status card) — chosen over keeping a native
    `<select>` because Neil's spec called for a two-line rich layout (title
    + sub-detail) that `<option>` elements can't render (plain text only).
    Each row shows: **"👑 Week N Picks · [dates]"** as the title (the crown
    is the site's own existing mark — reused here specifically so "Week N"
    reads as *our* week, not either sport's native one, per Neil's ask to
    "stress that"), a Current/Next badge, and underneath: "NFL: Week X ·
    College: Week Y" (or "College: not posted yet" when there's no NCAA
    week within the matching window — normal, college odds lag the NFL's).
  - **No "Past" badge** — the week list only ever contains upcoming,
    not-yet-locked weeks (already filtered via `filterPickableGames`), so a
    past week literally can't appear here; only Current (always index 0,
    since the list is chronologically sorted) and Next are meaningful.
  - Progress card's "Not posted yet" wording (was "No week selected") — a
    sport can now legitimately have `sportWeeks[sport] === null` if that
    sport's linked week hasn't posted odds yet, which isn't an error state,
    so the message needed to say so plainly.
  - **Real bug caught by testing, fixed before shipping:** the first version
    matched each NFL week independently to "whichever CFB week is closest,"
    which let two different NFL weeks both claim the SAME CFB week whenever
    only one or two college weeks had odds posted yet — a likely early-week
    scenario given college odds lag the NFL's. Test built a fixture with one
    CFB week 1 day from NFL Week 2 and 8 days from NFL Week 3 (both inside
    the 10-day window) and caught both weeks linking to it. Fixed with
    proper greedy one-to-one nearest-match pairing (smallest date gap
    matched first, both sides then removed from the pool) so each CFB week
    links to at most one NFL week.

- **DONE (2026-08-14): real bug fix — Picks CTA subline was blank on the
  live site, plus Standings freshness line added.** Neil reported not
  seeing the "Week N · dates" text under "Enter your picks." Root cause,
  confirmed by querying ESPN's live NFL scoreboard directly: every upcoming
  NFL game right now is `seasonType 1` (preseason) — `filterPickableGames()`
  correctly excludes those, so `earliestPickableWeek()` correctly returns
  `null` (nothing's pickable yet, regular season odds aren't posted). The
  bug: `index.html`'s inline script only set `#picks-cta-week`'s text inside
  the "found a week" branch — the `null` case just left it empty instead of
  showing anything. This is a real, expected gap (mid-August, between
  preseason ending and regular season being pickable), not a data problem.
  - Fixed by moving the text-building logic into two new shared helpers in
    `js/pick-utils.js`: `pickableWeekText(games, sport)` (used by the CTA
    subline — falls back to "No games posted yet — check back soon" instead
    of blank) and `standingsFreshnessText(games, sport)` (falls back to just
    the date, no week number, when there's nothing pickable). Both are also
    now what `index.html` calls, replacing the inline duplicate logic from
    the previous pass.
  - **Also added, per Neil**: the same "Standings as of [date] (Week N)"
    line now appears atop `standings.html` too, not just the Home page —
    reuses `standingsFreshnessText()`, so both pages show identical text
    whenever both have data (and identical *empty-week* fallback text when
    they don't).

- **DONE (2026-08-14): Home page polish pass — branded quote, week-aware
  copy, reordering.** Follow-up on the Home redesign above, per Neil.
  - **Brand quote** below the header: "We do the 💰 Bags right, then we go
    **FULL REGALIA**" — two Google Fonts loaded for the first time on this
    site (previously system-font-only): Pacifico (cursive, the main phrase)
    and Anton (bold condensed impact font, just for "Full Regalia" so it
    visibly pops against the cursive). New `.brand-quote`/`.quote-cursive`/
    `.quote-pop` classes in `css/style.css`, scoped to this one quote block
    — not a site-wide rebrand of the wordmark elsewhere.
  - **Removed** the "Here's where the league stands right now" subtitle and
    the "This week at a glance" section-label (Neil asked what the latter
    was referring to and leaned toward cutting it — agreed: once Standings
    got its own freshness line and Awards got renamed, below, the wrapper
    label wasn't adding anything, especially once Live scores moved out of
    that group per the last bullet).
  - **"Enter your picks" CTA** now shows a subline with the specific week
    and date range it's for (e.g. "Week 3 · Sep 15–21"), and a new
    **"Standings as of [date] (Week N)"** line sits above the Standings
    card — both reuse the exact same computed "current week," so the page
    tells one consistent story rather than two different guesses at what
    week it is.
  - **New shared helper, `earliestPickableWeek(games, sport)`** in
    `js/pick-utils.js` — finds the soonest upcoming pickable week for a
    sport (same "pickable" definition — not kicked off, odds posted, NFL
    preseason excluded — that `js/picks.js` already used inline). Extracted
    a matching `filterPickableGames()` too, and `js/picks.js`'s own
    `pickableAll` now calls it instead of keeping a second copy of the same
    filter logic. `js/picks.js`'s existing `weekBucketKey()` moved into
    `js/pick-utils.js` as well, since both files need it now.
  - **"Weekly Awards" renamed "Last Week Awards"** (Neil's suggested name,
    semantically accurate — the awards already compute off the most
    recently *completed* calendar week, which is "last week" relative to
    "now"). Logic unchanged, just the card title.
  - **Live scores & odds card moved** to sit directly below the Analytics
    card (was previously up near the top, in the now-removed "at a glance"
    group).

- **DONE (2026-08-14): fourth Picks page pass — personalization "wayfinding"
  combo, per Neil ("how can we make sure players know absolutely they're
  picking their picks — color backgrounds? wayfinding?").** Landed all three
  ideas discussed, tied together:
  - **Colored picker card** — `.picker-card` now reads a `--picker-color`
    CSS custom property (defaults to the site accent), set in `js/picks.js`
    to `avatarColor(selectedPlayerName)` — the same deterministic
    per-name color already used for avatars everywhere else. Recolors
    instantly on player switch.
  - **Dynamic page heading** — `<h1 id="picks-heading">` now reads
    "{Name}'s Picks" instead of the static "Picks" — deliberately left OUT
    of the sport/week (Neil: not necessary to see every time, and putting a
    single "week" in the heading would've reintroduced the same
    NFL/NCAA-week-blending confusion just fixed in the prior pass).
  - **Sticky wayfinding badge** — new `.picker-badge` (`#picker-badge` in
    `picks.html`), a small pill fixed just above the bottom nav
    (`bottom: calc(var(--nav-height) + 10px)`), showing avatar + name,
    also tinted via `--picker-color`. Stays visible the whole time you're
    scrolled down among the pick categories — this is the piece that
    actually solves "make sure players are ABSOLUTELY sure," since the
    picker card itself scrolls out of view but this doesn't.
  - **Real bug found & fixed while wiring this up:** `PLAYER_KEY`
    (`fr_selected_player`) was being *read* from localStorage on page load
    but never *written* — so "remembers your last pick" never actually
    worked; the page always defaulted to the first roster player. Fixed:
    `switchPlayer()` in `js/picks.js` now calls `localStorage.setItem()`.
    This directly matters for the new personalization too — it's much less
    useful if the page doesn't actually reopen on the right person.

- **DONE (2026-08-14): moved "Add to your phone" off Home, onto a permanent
  Guide section.** Neil: the dismissible Home card should either actually
  go away for good on dismiss (it already did — `localStorage` flag,
  confirmed working), or move to a permanent reference instead. Went with
  moving it: deleted `#add-home-card` and the `addToHomeScreenPrompt()` IIFE
  from `index.html` entirely. Added a new "How to use the app" section at
  the top of `betting-guide.html` with static (not device-detected, since
  it's now a permanent reference anyone might view from any device)
  iOS + Android instructions, plus a one-line "where everything lives"
  rundown of each nav tab — doubles as a lightweight answer to "how is
  the app organized," ahead of a fuller Home page redesign (see below).

- **DONE (2026-08-14): Analytics placeholder page.** Neil: "prepare" an
  Analytics tab for the team/player betting-trend stats already in the
  backlog — explicitly do NOT build the actual charts/data yet. Added
  `analytics.html`: gated like every other page, "Not built yet" empty
  state, a "What's planned" card describing the two stats ideas. Linked
  from a new Home page card (`index.html`, styled like the Admin card, with
  a muted "Coming soon" badge) — **deliberately NOT added to the bottom
  nav**, same treatment as Admin, to avoid committing to the earlier-floated
  "replace Live with Analytics" nav change before that's actually decided.

- **DONE (2026-08-14): "Weekly Awards" — 4 of the ~7 pitched categories
  built and live on Home.** New `js/awards.js`: `computeWeeklyAwards()`
  groups graded picks by **calendar week** (Monday-start, from each pick's
  real kickoff date via `calendarWeekKey()`) rather than either sport's own
  week numbering — deliberate, to avoid reintroducing the NFL/NCAA
  week-blending confusion fixed earlier this project (the two are
  independently selected and don't line up on the calendar). Picks the most
  recent calendar week with any graded picks and computes:
  - 🤡 **Dumbass of the Week** — most misses that week
  - 🔮 **Nostradamus** — most hits that week
  - 🎰 **High Roller** — biggest underdog taken (largest `+line` among that
    week's Plus Spread picks)
  - ⏰ **Buzzer Beater** — closest save to kickoff (`updated_at` vs.
    `snapshot.date` gap) — needed adding `updated_at` to `loadSeasonPicks()`'s
    select in `js/season-data.js`, wasn't fetched before.
  - **Not built (kept in reserve, easy to add later — same data model):**
    🎢 Rollercoaster (point swing vs. own average), 🥶 Ice Cold (miss streak).
    Whole-list is in the Status entry below this one for reference if Neil
    wants to swap any of the live 4 out later.
  - Lives on Home only, in a card between Standings and Live scores.

- **DONE (2026-08-14): Home page redesign** — Neil declined a "Welcome
  back, Name" greeting (flagged: the site can't actually know who's
  visiting, no login, only `localStorage`'s last-picked-name-per-device —
  same honor-system caveat as everywhere else, would show the wrong name on
  a shared device) in favor of "a more sleek and stylish landing page on how
  information is structured in the app." `index.html` restructured:
  - "Enter your picks" promoted to the single primary CTA at the very top
    (was previously buried in a "This week" card further down).
  - **"This week at a glance"** section: Top standings, Weekly Awards (new,
    see above), Live scores — the site's actual live data, kept prominent
    rather than replaced by pure navigation.
  - **"Get around the app"** — new `.hub-grid`/`.hub-card` (2-col grid,
    `css/style.css`) of orientation cards for Standings/History/Live/Guide,
    each with a one-line "what's this for" description — the actual
    "how information is structured" piece Neil asked for. Picks isn't in
    the grid (it's the primary CTA above instead); Admin/Analytics stay as
    smaller cards near the bottom, unchanged from before.
  - Removed a redundant network fetch: Standings and Weekly Awards both
    grade off the same picks/games data, so `loadStandingsAndAwards()` now
    fetches once and derives both, instead of two separate fetches.

- **DONE (2026-08-14): third Picks page pass — removed the "My Picks" tab.**
  Neil's follow-up after the reorg above: the Make Picks / My Picks tab
  toggle felt confusing/redundant now that "My picks this week" already
  exists on the page. Removed entirely from `picks.html`/`js/picks.js`:
  - The tab chip row (`#tab-week`/`#tab-mine`) and the `#view-mine` block
    (full-season pick history for the selected player) are gone. `#view-week`
    is no longer a toggled view — its contents are just the page now.
  - Deleted `renderMyPicks()` from `js/picks.js` (the only thing that used
    it) and its 3 call sites. Since nothing on this page calls
    `gradePick()`/`pointsForResult()` anymore, also dropped
    `loadScoringConfig()` from the page's startup `Promise.all` and removed
    the now-unnecessary `<script src="js/grading.js">` from `picks.html`.
  - The underlying feature isn't gone, just relocated to where it already
    lived: added a small "Full season history →" link in the picker card
    that points to `player.html?name=<selected player>` (updates live as
    you switch players) — Neil confirmed the full-season reference should
    keep existing, just not duplicated as a second tab on this page when
    `player.html`/`history.html` already do it, with filters, dedicated
    space, and no redundancy.

- **DONE (2026-08-14): second Picks page pass — fixed a real progress-count
  bug and reorganized the flow, per Neil's follow-up feedback.**
  - **Real bug fixed:** the persistent "X of 8 picks made this week" figure
    summed NFL's and NCAA's picks into one blended number even though NFL
    and NCAA weeks are independently selected (`sportWeeks.nfl` /
    `sportWeeks.cfb` can point at totally different weeks). Neil confirmed
    this read as confusing — "should match the filter for the week
    selected." Fixed: `computeProgress()`/`renderProgress()` in
    `js/picks.js` now show two separate, clearly week-labeled lines (e.g.
    "NFL · Week 3 — 2/4 picks", "NCAA · Week 5 — 1/4 picks") instead of one
    combined total — each number now unambiguously matches a specific,
    visible week. Applied the same fix to the post-save confirmation
    message (was also blending sports into "X of 8").
  - **Reorganized page flow**, per Neil: "who's picking, then the week...
    based on the week it shows how many picks you've made (my picks
    section)... then the make picks section (NFL/NCAA toggle, then the 4
    categories)... league status at the top." New top-to-bottom order in
    `picks.html`:
    1. **League status** (moved from the bottom, where the *previous* pass
       had put it, back to the top — Neil's direct follow-up ask) — same
       collapsible card, same behavior, just repositioned.
    2. **Who's picking?** — given a distinct "hero" treatment
       (`.picker-card` in `css/style.css`: subtle accent-tinted gradient
       background + border) and a bigger avatar (32px → 48px) per "needs to
       be much more predominant and better looking."
    3. Sport toggle (NFL/NCAA) + week selector, grouped together — kept
       adjacent out of technical necessity (week options are inherently
       sport-scoped, so a "week" picker can't function without knowing which
       sport first; Neil's literal ordering had "week" before the "toggle
       NFL/NCAA" step, but the two are coupled).
    4. **My picks this week** — the fixed, per-sport-scoped progress card
       (see bug fix above), now its own clearly labeled section.
    5. **Make picks** — team search + the 4 collapsible categories, same as
       before.
  - The full-season "My Picks" tab (`#tab-mine`) is unchanged — Neil
    confirmed it should stay as the all-time reference; the new "My picks
    this week" card is a distinct, smaller, week-scoped concept, not a
    replacement.

- **DONE (2026-08-14): Picks page decluttered** — Neil said it felt clunky
  (player filter, who's-picked, sport/week filters, then all the options,
  all stacked with equal visual weight). Changes, all in `picks.html`:
  - Merged the separate "progress" card into the player-select card (one
    card instead of two — avatar+select on top, progress line below).
  - Removed the generic "Pick 1 game per category below" instructional note
    — redundant now that it's also explained in the Betting Guide's new
    "How picks are scored" section (see above), and the category headers
    are already self-explanatory ("Tap to pick a game").
  - **Moved "who's picked" league-wide status tracker to the END of the
    page** (after the picks and the bottom Save button), behind a `<hr
    class="divider">` and a new `.section-label` ("League status") — this is
    the "clear sectioned off" part of the ask: it no longer competes with
    the actual picking flow at the top, it's a distinct zone you scroll to
    on purpose. Same collapsible behavior as before, same element IDs, so
    no `js/picks.js` logic changed — this was a pure HTML restructure.
    Added a matching "Who's picking?" section-label above the player card
    for visual consistency between the two labeled sections.
  - New `.section-label` CSS class (`css/style.css`) — small uppercase
    muted label, reused for both sections above.

- **OPTIONAL, NO RUSH — run whenever (2026-08-14): SQL to make scoring
  admin-editable.** Not urgent: current scoring (1/hit, 0.5/push, 0/miss) is
  already verified correct and works fine as-is without this — this SQL just
  unlocks the *ability* to change those numbers from the admin page later, if
  ever needed. Creates the `scoring_config` table `js/grading.js`'s
  `loadScoringConfig()`/`saveScoringConfig()` read/write, seeded with the
  verified defaults:
  ```sql
  create table public.scoring_config (
    id smallint primary key default 1,
    hit_points numeric not null default 1,
    push_points numeric not null default 0.5,
    miss_points numeric not null default 0,
    updated_at timestamptz not null default now(),
    constraint scoring_config_single_row check (id = 1)
  );

  alter table public.scoring_config enable row level security;

  create policy "Anyone can read scoring config"
    on public.scoring_config for select using (true);
  create policy "Anyone can update scoring config"
    on public.scoring_config for update using (true);

  grant select, update on public.scoring_config to anon;

  insert into public.scoring_config (id, hit_points, push_points, miss_points)
  values (1, 1, 0.5, 0)
  on conflict (id) do nothing;
  ```
  Until this is run, every page falls back to the same hardcoded defaults
  (1/0.5/0) that were already correct — fails soft, nothing breaks, the
  Scoring card on `admin.html` just won't be able to save changes. Neil's
  call on timing (2026-08-14): "keep it in the backlog for me to run" —
  scoring itself is fine, this was about having the option available, not
  an active need to change it right now.

- **DONE (2026-08-14): admin can now edit scoring** — added a "Scoring" card
  to `admin.html` (3 number inputs: Hit/Push/Miss points, plus a Save button)
  wired to the new `scoring_config` table above. `pointsForResult()` in
  `js/grading.js` now reads a mutable `SCORING` object instead of hardcoded
  constants; every page that grades picks (Picks, Standings, History, Player,
  Home) now awaits `loadScoringConfig()` before rendering anything that calls
  it — same pattern as `loadPlayers()`. Changing the values on the admin page
  applies site-wide immediately (next page load), no code change needed.

- **DONE (2026-08-14): scoring math independently verified against the
  original workbook, plus two follow-up features.**
  - **Verification method:** rather than re-checking my own prior code
    comments, opened `C:\Users\neilm\Downloads\Full Regalia 2025 Pick'Em.xlsx`
    directly with a Python script (openpyxl) and pulled the real formulas out
    of the `Results`/`Standings`/`History` sheets. Confirmed algebraically
    that `gradeSpread()` in `js/grading.js` is mathematically identical to the
    original `IFS()` spread formula (favorite side and, by inversion, the
    underdog side). Found 6 real "Push" results in the actual season history
    and confirmed every one contributed exactly 0.5 points to that player's
    weekly total (hits=1, misses=0) — an exact match to `pointsForResult()`.
    Confirmed all categories are weighted equally (1 pt each) and that the
    original Standings sheet's win% denominator ("# of picks") counts pushes
    too, same as `computeStandings()`'s `graded` count today. **No bugs
    found** — the math has been correct since the grading engine was built.
  - **Gap found (not a bug, a documentation hole):** `betting-guide.html`
    explained what Spread/Moneyline/O-U bets *are* but never explained how
    points are scored. Added a "How picks are scored" section: 8 picks/week
    (4 categories × 2 sports), 1pt/hit, 0.5pt/push, 0pt/miss, every category
    weighted the same.
  - **New: team search on the Picks page** (`#team-search` input above
    `#games-list` in `picks.html`). Typing filters every category's chips to
    matches on team abbreviation OR full name (e.g. "SEA" and "Seahawks" both
    work — added a `search` field per chip option in `buildCategoryPools()`,
    `js/picks.js`), auto-expands any category with a match regardless of its
    collapsed state, and hides categories with zero matches entirely rather
    than showing them empty. Clearing the box restores normal
    collapsed/expanded state. Added `escapeHtml()` to `js/pick-utils.js`
    since the "no matches" empty-state message echoes the typed search text
    back into the page — this is the one path on the site where raw user
    input gets reflected into innerHTML, so it needed escaping.

- **DONE (2026-08-14): dropped "Beta" and internal-doc references from the
  live site.** Neil didn't want the product presenting as unfinished/beta
  anymore. Removed: the "Beta" badge on `index.html`'s "This week" card and
  `picks.html`'s page title (and deleted the now-unused `.badge.beta` CSS
  rule), the gate overlay's "Private beta preview" copy across all 8 pages
  (now "Private league site"), and two "See ROADMAP.md" mentions
  (`standings.html`, `admin.html`) — `ROADMAP.md` is an internal planning
  doc, not something a player should be pointed at. Shipped as `sw.js`
  shell-v17.
- **Backlogged, not started (2026-08-14):** replacing the "Live" tab in the
  bottom nav with an "Analytics" tab for the two stats/trends ideas below —
  see "New backlog" further down. Explicitly deferred until after the season
  starts.
- **players table SQL confirmed run (2026-08-14)** — verified live via direct
  Supabase REST calls: all 15 players read back correctly, and a throwaway
  insert+delete round-trip confirmed the RLS grants work. Admin page is fully
  functional.

- **RUN — kept for reference (2026-08-14): the `players` table SQL Neil ran**
  in the Supabase SQL Editor to unblock the new Admin page — creates the
  `players` table (replaces the hardcoded `LEAGUE_PLAYERS` list in
  `js/app.js`) and seeded it with the 15-person roster so nobody was lost in
  the migration. Confirmed live and working (see status entry just above):
  ```sql
  create table public.players (
    name text primary key,
    couple text,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
  );

  alter table public.players enable row level security;

  create policy "Anyone can read players"
    on public.players for select using (true);
  create policy "Anyone can add players"
    on public.players for insert with check (true);
  create policy "Anyone can delete players"
    on public.players for delete using (true);

  grant select, insert, delete on public.players to anon;

  insert into public.players (name, couple, sort_order) values
    ('ALEX', 'Alex & Calli', 1),
    ('CALLI', 'Alex & Calli', 2),
    ('DREW', 'Drew & Michaela', 3),
    ('MICHAELA', 'Drew & Michaela', 4),
    ('SEAN', 'Sean & Carlie', 5),
    ('CARLIE', 'Sean & Carlie', 6),
    ('JACOB', 'Jacob & Emma', 7),
    ('EMMA', 'Jacob & Emma', 8),
    ('NICK', 'Nick & Emily', 9),
    ('EMILY', 'Nick & Emily', 10),
    ('LOUIE', 'Louie & Josie', 11),
    ('JOSIE', 'Louie & Josie', 12),
    ('CONNOR', 'Connor & Jack', 13),
    ('JACK', 'Connor & Jack', 14),
    ('PHIL', null, 15)
  on conflict (name) do nothing;
  ```
  (Note: while unrun, `loadPlayers()` fails soft — empty roster everywhere,
  no crash — which is how this was safely shipped before Neil ran it.)

- **DONE (2026-08-14): four features from Neil's follow-up request.**
  1. **Admin page to add/remove players** (`admin.html`) — no more hardcoding
     a name in `js/app.js` and redeploying every time someone joins. Gated by
     a *second*, admin-only passphrase (separate from the site's
     `regalia2026`), checked client-side the same way `js/gate.js` already
     works — **this is a UI speed bump, not real auth**: the passphrase hash
     lives in `js/admin.js` and is readable by anyone who opens dev tools,
     and the underlying Supabase RLS on `players` is open to the anon key
     (same trust model the `picks` table already uses). Neil explicitly chose
     this lightweight approach over building real Supabase Auth login — this
     resolves the "admin auth strength" decision that was blocking the
     players-table work noted below in the item-3 planning notes.
     - Admin passphrase: **`commish`** (Neil's choice) — change it any time
       by following the same self-service steps documented at the top of
       `js/gate.js`/`js/admin.js` (hash a new phrase in the browser console,
       paste the hash in).
     - Removing a player doesn't delete their past `picks` rows (kept for
       data integrity) — it just drops them from the roster, so they stop
       appearing in the Picks player-picker and in Standings/History (which
       iterate the roster, not a distinct-name scan of `picks`).
     - Linked from a proper card on `index.html` (Neil said the original
       footer text link was too easy to miss) — still not in the main
       bottom-nav, so it's one tap from Home but not shoved in front of
       regular players on every page.
  2. **Live Standings + History, replacing the old workbook-snapshot data.**
     Per Neil: discard the old season's numbers entirely and start fresh —
     this season is the first one tracked live. Deleted `js/standings-data.js`
     (the old `STANDINGS` sample array) and `js/history-data.js` (the old
     344-pick `HISTORY` dump, incompatible anyway with the new 4-category
     pick model). New `js/season-data.js` computes both Standings and History
     on page load, straight from the real `picks` table + live/final scores
     (`js/live-scores.js`) + the grading engine (`js/grading.js`) — no more
     manual data entry or stale snapshots. `standings.html`, `history.html`,
     `player.html`, and `index.html`'s top-3 preview all rewired to this.
     Also fixed stale copy on `index.html` left over from before the Supabase
     migration ("your picks save on this device... not synced yet" — they
     have been synced since 2026-08-10).
  3. **NFL pick groups: conference-only, chronological within** (was
     conference *and* division). `teamGroupLabel()` in `js/picks.js` now
     takes just the first word of the live "AFC East"-style label from
     `fetchNflDivisions()`. Chip order within a conference was already
     chronological for free (the underlying game list is date-sorted before
     grouping) — only the grouping itself needed to change.
  4. **"@" for away, "vs" for home on spread picks** — matches what Over/Under
     picks already showed via their matchup subtext. `buildCategoryPools()`
     in `js/picks.js` now tags each spread side with `atHome`, so the away
     side reads "CAR @ TB" ... "CAR -3.5 · @ TB" and the home side reads
     "TB +3.5 · vs CAR".
  - Extracted `js/pick-utils.js` (new) out of `js/picks.js` — the pure
    pick-formatting helpers (`pickLabel`, `weekGroupLabel`,
    `weekBucketKeyFromSnapshot`, `statusBadge`, `CATEGORY_LABEL`, etc.) that
    both `js/picks.js` and the new `js/season-data.js` need, without pulling
    picks.js's DOM-binding code (which assumes picks.html's elements exist)
    into pages that don't have them.
  - Shipped as `sw.js` shell-v15. **Not yet tested — see "Test full change
    set via Playwright" below; do that before telling Neil this is live.**

- **DONE (2026-08-13): collapsible, color-coded pick categories** — Neil's
  request to cut down scroll length on the Picks page. Each of the 4 categories
  (Minus Spread, Plus Spread, Over, Under) now:
  - Starts **collapsed by default** (all 4 closed on page load), with a
    clickable header (icon + label + summary + ▼/▲ chevron) that expands/
    collapses just that one category. Reused the same click-scoping lesson
    from the "Who's Picked" tracker: the header is a *sibling* of the chip
    body, not a wrapper around it, so header clicks and chip-pick clicks can
    never bubble into each other (checked `data-category-header` before
    `.chip` in the delegated `#games-list` click handler).
  - Shows a **live summary in the collapsed header** — either the picked
    game/line (styled in the category's accent color) or "Tap to pick a game"
    — so you can see what's done and what's left across all 4 categories
    without expanding anything.
  - Got a **distinct accent color + icon per category** (minus = blue "−",
    plus = violet "+", over = cyan "▲", under = amber "▼") via a `--cat-color`
    CSS var keyed off `data-category`, plus a matching left border on each
    section, so the 4 are easy to tell apart at a glance.
  - Tested via Playwright (mocked ESPN scoreboard + Supabase REST calls,
    real gate bypass): all-collapsed-on-load, distinct per-category colors,
    single-category expand/collapse, chip-pick-doesn't-collapse-header, and
    collapsed-summary-updates-after-pick all confirmed working, zero console
    errors. Shipped as `sw.js` shell-v14.

- **Three fixes from Neil's follow-up questions (2026-08-13):**
  1. **Date/time restored on chips** — a real regression from the category-pool
     redesign: the old per-game-card design showed kickoff date/time in the
     card header, but that info got dropped when chips became the unit of
     display. Every chip now shows 3 lines: the pick, opponent/matchup, and
     kickoff time (e.g. "Thu 8:15 PM").
  2. **"Why does NCAA only go to Week 4?" — confirmed as expected, not a bug.**
     Checked live: as of today only NCAA Week 1 (98 games) through Week 4 (3
     games) have any posted odds — sportsbooks simply haven't priced later
     college weeks yet (matches the earlier finding that college odds lag,
     unlike NFL's full-season advance posting). Added an explanatory note
     under the week selector, visible only when NCAA is toggled, so this
     doesn't look broken to anyone else.
  3. **NFL preseason excluded from pickable weeks.** Was showing as its own
     "Preseason Week N" option right next to real "Week 1," which is exactly
     what confused Neil — preseason is exhibition football (backups, roster
     battles), meaningless for a real pick'em league. Filtered out entirely
     rather than just relabeled.
  - All 3 verified end to end (3-line chips confirmed, preseason confirmed
    absent from the dropdown, NCAA note confirmed hidden/shown correctly on
    toggle) — no console errors.

- **DONE (2026-08-13): conference/division sub-grouping within each pick
  category**, for browsability — before this, each category (Minus Spread,
  Plus Spread, Over, Under) was one long flat chip list, hard to scan once a
  full week's games were in it.
  - **NFL: sourced live**, not hardcoded. ESPN has a dedicated endpoint
    (`/apis/site/v2/sports/football/nfl/groups`) that returns the complete
    AFC/NFC → division → team hierarchy — fetched once per page load, cached
    in memory (`fetchNflDivisions()` in `js/live-scores.js`). Always accurate,
    zero maintenance.
  - **NCAA: hardcoded**, because no equivalent clean live source exists —
    checked ESPN's `/groups` endpoint (returns an incomplete ~25-team FBS
    list, not conference-organized) and the bulk `/teams?limit=300` endpoint
    (caps at 300 total teams across all divisions, missing several major
    programs alphabetically/by-ID past that cutoff). Went with Neil's choice:
    explicit Power 4 lists (SEC, Big Ten, ACC, Big 12) in `js/picks.js`
    (`NCAA_CONFERENCES`), everyone else falls into "Other". Abbreviations
    cross-checked against live ESPN data where possible; a few (Tennessee,
    Purdue, Miami, SMU, Cincinnati, Kansas, Kansas State, TCU, Texas Tech,
    UCF, South Carolina, Oregon) weren't confirmable via the API and rely on
    standard/well-known ESPN abbreviation convention instead — soft failure
    mode if wrong (team just lands in "Other", not a crash). **Spot-check
    once real games are live and flag anything landing in "Other" that
    shouldn't be**, since this list may need updating if conference
    realignment happens again (it's happened twice in the last few years).
  - Spread picks group by the specific team's own conference/division; total
    (Over/Under) picks — which aren't about one team — group by the home
    team, as a simple anchor. Tested end to end with fixture data mirroring
    real groupings (4/4 checks passed, including the "Other" fallback case).
- **Answered: odds refresh cadence.** Checked ESPN's own `Cache-Control`
  header directly — it regenerates roughly every ~10 seconds server-side.
  That's how often we *could* get freshly-checked data, not how often the
  actual odds change (that depends on real market activity — several times a
  day normally, more near kickoff). Current polling (Live page every 30s,
  Picks page on load/interaction) is well within what ESPN's cache supports.
- **Three-part request from Neil (2026-08-13) — 2 of 3 done, 1 still blocked:**
  1. ✅ **Confirmed:** picks stay enterable/viewable/editable pre-kickoff and
     locked after — already true, no change was needed.
  2. ✅ **DONE — "who's submitted picks" tracker.** Lives as a collapsible card
     at the TOP of the "Make Picks" view (moved there from a separate tab per
     Neil's follow-up — more visible where people already are, without
     permanently pushing the picking UI down the page for people who just want
     to pick quickly). Collapsed by default, shows "N of 15 submitted this week
     · ▼ Who's in?"; expands to show every player's NFL x/4 · NCAA y/4 with a
     Submitted/In progress/Not started badge, sorted least-complete-first so
     stragglers surface at the top. Defaulted to **visible to everyone** (not
     admin-only) since Neil didn't specify and it's a low-stakes, reversible
     choice — say the word if you'd rather it be admin-only. Refreshes on
     expand, on sport/week change, and right after a save. Tested end to end
     (15 players render correctly, sort order confirmed, badge states correct).
     One real bug found & fixed during testing: the click-to-expand handler was
     bound to the whole card, so clicking a player row (a link to their page)
     inside the expanded list both navigated away AND collapsed the card at the
     same time — fixed by scoping the click listener to just the header line.
  3. ✅ **DONE (2026-08-14) — Admin panel to add/delete players.** Neil
     answered the open "admin auth strength" question below by directly
     asking for the passphrase-gate approach (Option B) — see the
     2026-08-14 status entry above for what shipped (`admin.html`,
     `js/admin.js`, `js/players.js`, new `players` table).
     - **Scope note:** this shipped the simpler half of the architecture
       described below — `players.name` is the primary key (matches how
       `picks.player_name` already works, no migration needed), which
       supports add/delete but **not rename-without-losing-history** (that
       still needs the `player_id` foreign-key migration described just
       below, and wasn't asked for this round). Revisit if Neil wants
       renames later.
  - **If rename support is ever wanted:** player names currently live in the
    new `players` table but `picks.player_name` still stores the name as
    plain text, so renaming someone today would orphan their old picks (still
    tagged with the old name). The fix would be adding a stable
    `id uuid primary key` to `players`, adding `player_id uuid references
    players(id)` to `picks`, backfilling existing rows by matching
    `player_name` to the new table, and updating `picks` RLS to reference
    `player_id`. Not started — add/delete (what's live now) doesn't need it.
- **Backend decision made (2026-08-02): Supabase**, using Neil's existing account. Not
  building on a throwaway/personal setup he can't hand off — Supabase project
  transfers cleanly to another org later (verified via their docs): source must be
  org owner, target must already be an org member, then Settings → transfer. Keeps
  the DB, keys, URL, everything intact — no rebuild needed at handoff time.
  - **Auth model: honor system, no login** — same as today's name-picker, not
    individual accounts. Matches the current trusted-friend-group UX exactly.
  - **Commissioner override:** no special code needed — Neil already has full access
    to every row via the Supabase Table Editor, since he owns the project.
  - **Picks auto-lock at kickoff — enforced at the database level, not just hidden in
    the UI.** Row Level Security policies only allow insert/update while the game's
    stored `kickoff_at` is still in the future. This can't be bypassed from dev tools
    or a modified request — it's a real server-side rule, not a frontend courtesy.
  - **Supabase project is live and verified working** (2026-08-02): `picks` table
    created, RLS policies confirmed via direct API tests (read works, insert/update
    blocked for past kickoff, allowed for future kickoff). Project ref
    `wiubzguvdiudlijrgozo`, credentials saved in `js/supabase-client.js` (anon key —
    safe to be public, security is enforced by RLS, not by hiding this key).
  - **Wired, tested, and pushed (2026-08-10).** Picks page now reads/writes the real
    Supabase `picks` table instead of localStorage — confirmed via Playwright:
    save works, "My Picks — Season" reflects it, and (critically) picks still show
    as selected after a full page reload, proving they're actually being read back
    from the database, not just held in a JS variable.
  - **Real bug found & fixed during testing:** Postgres/PostgREST returns jsonb
    object keys alphabetically sorted, but freshly-built in-memory pick values keep
    insertion order — the old `JSON.stringify(a) === JSON.stringify(b)` comparison
    for "is this chip already picked" silently broke once a value round-tripped
    through Supabase (worked fine with localStorage, which preserves key order).
    Fixed with an order-independent `sameValue()` helper in `js/picks.js`. Worth
    remembering as a general lesson: never compare jsonb-sourced objects with raw
    JSON.stringify.
  - Key design point worth remembering: `doSave()` only upserts picks for games
    currently on screen (not the player's whole pick history) — otherwise
    re-saving would try to touch old, already-locked picks and the database would
    correctly reject the *entire* batch, blocking new valid picks too.
  - **Test data sitting in the live table** — clean up before real use: player
    `ALEX`, `game_id` 9990001 (spread) and 9990002 (moneyline), both fake IDs from
    testing. Run in SQL Editor: `delete from picks where game_id in ('9990001',
    '9990002');`
- **Real bug found & fixed (2026-08-10): week ordering.** ESPN resets its week
  number every season phase (preseason week 1, regular-season week 1, and
  postseason week 1 all separately exist as "week 1") — the week-selector was
  merging them into one bucket, which is why Neil saw "Week 2 before Week 1" (the
  merged "Week 1" bucket had silently become regular-season week 1, sorting after
  preseason week 2 once preseason week 1's single game had already been played and
  filtered out). Fixed by including season phase in the grouping key
  (`js/live-scores.js` now captures `seasonType`; `js/picks.js`'s week bucketing
  uses it) — dropdown now correctly shows "Preseason Week 2/3/4" then "Week 1"
  (regular season, no prefix) in true chronological order.
- **RESOLVED (2026-08-13) — the "too many picks" open question:** Picks page
  rebuilt around a fixed weekly quota instead of "every game with odds." **4
  categories: Minus Spread, Plus Spread, Over, Under. Moneyline dropped entirely.**
  8 picks/week total: 4 NFL (1 per category) + 4 NCAA (1 per category). A
  Minus/Plus Spread pick (or an Over/Under pick) can be on ANY game that week —
  they don't have to be the same game (confirmed with Neil) — but a single game
  can't fill BOTH sides of the same bet family (e.g. can't be both your Minus
  Spread AND Plus Spread pick) since that's both contradictory and a real DB
  conflict; enforced by excluding a game from the opposite pool once used.
  Cross-family reuse is fine (a game CAN be both your Over pick and your Minus
  Spread pick). NFL/NCAA toggle kept (not replaced with both-sports-on-one-page)
  per Neil's call — each sport remembers its own selected week independently. A
  persistent progress indicator ("N of 8 · NFL x/4 · NCAA y/4") stays visible
  regardless of which sport is toggled, so overall status is never hidden.
  - **New DB requirement:** swapping a category pick to a different game means
    deleting the old row (different `game_id`, so upsert's conflict target
    doesn't touch it) — needs `DELETE` granted to `anon` (wasn't before, only
    select/insert/update). SQL given to Neil:
    ```sql
    grant delete on public.picks to anon;
    create policy "Anyone can delete picks before kickoff"
      on picks for delete using (kickoff_at > now());
    ```
    **Status as of the redesign push: not yet confirmed run** (checked via direct
    API test — still returns permission denied). Not a blocker for shipping: if
    missing, a category-swap save just fails cleanly with a retry message
    (delete is attempted before upsert, returns early on failure) — doesn't
    corrupt anything, just means swaps silently won't work until the grant lands.
    **Verify this before considering the feature fully done**, and test an actual
    swap-to-a-different-game end to end once confirmed (only the "fresh pick, no
    prior save" path has been empirically tested so far — the swap/delete path
    was verified by code tracing, not by an actual successful delete call).
  - More test data in the live table from this round: player `MICHAELA`, games
    `nfl-g1`/`nfl-g2` (fixture IDs, obviously fake, safe to delete), one row for
    player `TESTDEL` (`game_id` 9990099, also fake), and one row for player
    `EMMA` (`game_id` 401000002, also fake, from the bug-fix testing below).
    Combined cleanup SQL: `delete from picks where player_name in
    ('MICHAELA','TESTDEL','EMMA') or game_id like 'nfl-g%' or game_id like
    'cfb-g%';` — **double check this doesn't accidentally match a real ESPN
    game_id before running** (ESPN's real IDs are long numeric strings, so this
    shouldn't collide, but eyeball the SELECT first: `select * from picks where
    player_name in ('MICHAELA','TESTDEL','EMMA') or game_id like 'nfl-g%' or
    game_id like 'cfb-g%';`).
  - **Two real bugs found & fixed right after the redesign shipped (2026-08-13),
    both reported live by Neil:**
    1. **Missing opponent context.** Chips only showed the pick itself (e.g.
       "CAR -1.5") with no indication of who they're playing. Fixed — every
       chip now shows a small second line: "vs [OPPONENT]" for spread picks,
       the full matchup ("CAR @ ARI") for total picks.
    2. **Selecting one chip highlighted every other chip with the same value.**
       Root cause: the "is this chip selected" check compared by odds VALUE
       (e.g. `{direction:"over", line:44.5}`), not by which specific game — so
       any two games sharing the same total line (very common; several NFL
       games often land on the same O/U number) all lit up together once one
       was picked. Fixed by comparing by `gameId` identity instead (the
       correct/simpler fix — removed the now-unused `sameValue()` helper from
       the previous jsonb-key-order fix, since identity comparison doesn't
       have that problem at all). Verified with a fixture forcing two
       different games to share an identical "Over 44.5" line — confirmed only
       the actually-clicked game's chip lights up, swapping correctly moves
       the highlight, and it survives a save+reload.
- **Current phase:** Core feature-complete beta as of 2026-08-01. Live at
  **https://nelsonmartini.github.io/full-regalia-league/** (passphrase `regalia2026`).
  7 pages: Home, Standings, Picks, History, Player detail, Live (now covers Results
  too, via a filter), Betting Guide.
- **Player avatars: done.** Generated initials-on-color, on Standings/History/
  Player/Picks, all clickable/linked.
- **Results: done, folded into the Live page** rather than a separate page — a third
  "Results" filter chip shows finished games, most-recent-first. Same data, no
  duplicate code/nav item.
- **Picks now cover the whole NFL season, not just the next few weeks.** Discovered
  DraftKings posts full-season lines for NFL well in advance (verified: a December
  game already had real odds in August) — added a week selector so people can plan
  picks ahead. Confirmed college odds genuinely aren't posted that far out yet
  (checked directly), so college weeks show fewer/no options until closer to kickoff
  — expected, not a bug.
- **NFL/NCAA sport toggle on Picks: done.** 🏈 NFL / 🎓 NCAA chips scope the week
  selector and games list to one sport at a time (fixed a real bug in the process:
  the week-bucket key didn't include sport, so "Week 3" briefly meant either league
  interchangeably — corrected to bucket by sport+week).
- **Real logo: done.** Replaced the plain "FR" text mark everywhere (header, gate
  screen, Home hero) with a designed crown icon (fits "Regalia" — royal
  insignia/crown theme) as inline SVG, white-on-the-existing-blue-gradient-square.
  App icons regenerated to match. Home page's "Welcome back 👋" heading replaced with
  a proper logo hero (crown + "Full Regalia" wordmark) per Neil's request.
- **What's real vs. sample data right now:**
  - Standings: still sample/snapshot data from the workbook (not live-wired to the Sheet).
  - History + Player pages: real, full season data (344 picks, 23 weeks, 16 players) —
    but it's a frozen snapshot parsed from the workbook, not live either.
  - Picks page: **fully real** — live current games + live odds from ESPN, saved to
    the shared Supabase database (as of 2026-08-10 — no longer per-device).
  - Live page + Home's live-games card: **fully real**, refetches every 30s.
  - Auto-grading ("Your results" on Picks): **fully real, functioning engine** —
    just has nothing to show yet because no picked game has finished. It'll populate
    itself automatically as games conclude, no code changes needed.
- **Xavier University blue recolor: done** (2026-08-01). Official brand blue #0C2340
  confirmed via web search + Xavier's own brand PDF, used for card surfaces; brighter
  blue tint (#4a90d9) for buttons/badges/highlights. Icons regenerated to match.
- **MAJOR DIRECTION CHANGE (2026-08-01):** Neil clarified the goal is not "display the
  Google Sheet on the site" — it's to **fully eliminate the spreadsheet.** The site
  should become the actual system of record: people pick on the site, results grade
  automatically (already built), standings compute automatically — no Excel/Sheets
  anywhere in the loop, ever. This supersedes the original ROADMAP.md decision to keep
  the Sheet as the backend. **The "wire Standings to the published Sheet CSV" plan is
  ON HOLD, not being pursued** — don't resume it without checking with Neil first,
  since he explicitly chose the real-backend path over it.
  - This requires a real shared backend (a hosted database the site can write picks to
    and read standings from) — Firebase or Supabase are the two realistic low-cost
    options for a group this size. **Neil deliberately deferred choosing between them
    until after talking to the site's eventual owner** (cost/ownership decision for
    whoever runs this long-term) — do not pick one and start building without that
    conversation happening first.
  - Nothing built tonight is wasted by this: the Picks page's UI, the grading engine,
    and the game/odds fetching are all backend-agnostic. Once a backend is chosen, the
    only rework is swapping `js/picks.js`'s `loadPicks`/`savePicks` (currently
    localStorage) for real API calls, and adding a live standings calculation that
    sums graded results per player — the hard logic (grading) already exists and is
    tested.
- **Passphrase gate is live on every page** — needed before sharing the link publicly,
  since GitHub Pages has no other access control. Passphrase: `regalia2026`. Not real
  security, just stops casual stumbling — see `js/gate.js`.

## Next 7 days

0. **Done 2026-08-01:** Picks page UX overhaul, per Neil's feedback — one card per
   game (was one card per bet type), a date + week/league label on every game, a
   second Save button at the top (was bottom-only), and a new "My Picks — Season"
   tab showing every pick ever saved, grouped by week, with Hit/Miss/Push/Pending
   status. ESPN fetch widened to a rolling 10-days-back/35-days-forward window so
   grading and week-labeling have enough data to work with. See session log.
1. **Done:** backend chosen (Supabase), Picks page wired to it, tested, pushed.
   Avatars, Championship Picks scoping question, and the Results-filter approach
   are all done too (see checklist below) — this list was stale, cleaned up
   2026-08-10.
2. **Still open: confirm the DELETE grant SQL was run and test a
   category-swap end to end** (the one path not yet empirically verified) —
   see the SQL near the top of Status. Been carried for a few sessions now.
3. **Done (2026-08-14):** live Standings + History computation — see Status
   above. Standings is no longer a frozen snapshot.
4. Championship/Bowl Picks page — still needs its own scoping for prop bets
   (First TD scorer, etc.) that the current category system doesn't cover.
   Lower urgency, months out.
5. **Done:** per-week "who's submitted picks" tracker, admin add/delete
   players panel — see Status above.
6. **NEEDS ACTION FROM NEIL:** run the `players` table SQL near the top of
   Status — the new Admin page and the roster picker on every page are
   non-functional until that's run.
7. **Done (2026-08-16):** stats/trends pages — see Status above ("Team +
   player trends built into `analytics.html`"). Both bullets that used to
   live here (team ATS trends, player category performance) are built; only
   the nav-placement idea below is still undecided.
   - **Nav idea from Neil (2026-08-14), not decided/built:** replace the
     "Live" tab in the bottom nav with an "Analytics" tab housing both stats
     features above, instead of adding a 7th nav item. Open questions to
     settle when this gets picked up (not now): where do live scores/odds
     move to if "Live" is removed as a standalone tab (folded into Home? kept
     as a page just not nav-linked, like Admin is now?), and does Analytics
     need its own sub-nav given it'd hold two fairly different things (team
     trends vs. player trends). **Explicitly deferred — do not start any of
     this (including the nav change) until Neil says go, expected after the
     season is underway and there's real data to show.**

## Living checklist

- [x] Read `Full Regalia 2025 Pick'Em.xlsx` and map all 7 tabs to a site structure
- [x] Confirm architecture decisions with Neil (picks UI vs. full backend; data source)
- [x] Write `ROADMAP.md`
- [x] Write `BACKLOG.md`
- [x] Site shell: shared CSS design system, nav (bottom tab bar on mobile)
- [x] PWA manifest + icons + basic service worker (Add to Home Screen)
- [x] Betting Guide page (static content from the workbook, ported as-is; dropped one
      slightly off-tone line from the original to keep it welcoming for the whole group)
- [x] Standings page — live-computed from real Supabase picks (2026-08-14; was
      sample/workbook data before)
- [x] Home dashboard page
- [x] Picks-entry UI — real chip selectors per game (5 sample games), saves to browser
      local storage as a placeholder (no permanent backend yet)
- [x] Browser-tested locally (Playwright) — zero console errors across all 5 pages;
      found & fixed 2 bugs (see session log below)
- [x] Test on an actual phone — Neil confirmed it "looks amazing on a phone" via LAN
- [x] Init local git repo
- [x] Create GitHub repo + enable Pages — live at
      https://nelsonmartini.github.io/full-regalia-league/
- [x] Passphrase gate for safe beta-sharing (`regalia2026`)
- [x] History page (season log, filterable by player/week) — 344 picks, 23 weeks
- [x] Player detail page (tap-a-name from Standings: summary stats, points trend,
      full week-by-week history)
- [x] Live scores via ESPN scoreboard API (NFL + college football, no key needed)
- [x] Live odds via ESPN (embedded in the same free response — turned out to make
      The Odds API unnecessary; NFL ~100% coverage, college ~50%)
- [x] Picks page rewired to real live games + real odds (was fake sample data)
- [x] **Auto-grading engine** (`js/grading.js`) — the core value prop. Unit-tested
      17/17. Wired into Picks page as a "Your results" card, auto-populates once a
      picked game goes final. Full pipeline (→ auto-updating Standings) needs the
      real backend below to be fully end-to-end for the group.
- [x] Xavier University blue recolor — official #0C2340 confirmed, palette + icons updated
- [x] Picks page UX overhaul — game-level grouping, date/week labels, top+bottom
      Save buttons, "My Picks — Season" tab (view all picks across the season)
- [ ] ~~Wire Standings/History to live Google Sheet CSV~~ — **ON HOLD, superseded.**
      Neil decided (2026-08-01) to skip this and go straight to a real backend that
      eliminates the spreadsheet entirely, instead of just displaying it live. Don't
      resume this without checking with him first.
- [x] Player avatars (generated initials-on-color) — Standings/Picks/History/Player,
      tap-through to that player's page
- [x] Results — folded into the Live page as a filter chip, not a separate page
- [x] Real logo/wordmark — crown mark (fits "Regalia"), replacing text "FR"
- [x] Backend chosen: **Supabase** (Neil's existing account, transfers cleanly later)
- [x] Picks page wired to Supabase (read + write + DB-enforced kickoff lock) —
      tested, pushed 2026-08-10
- [x] ~~Open question: how many games should be pickable per week~~ — **RESOLVED**,
      see the 4-category/8-picks redesign below
- [x] **Picks redesigned around a fixed weekly quota** (2026-08-13): 4 categories
      (Minus Spread, Plus Spread, Over, Under; moneyline dropped), 8 picks/week
      total (4 NFL + 4 NCAA, 1 per category each). NFL/NCAA toggle kept, with a
      persistent progress indicator visible regardless of which sport is shown.
- [x] Fixed: chips showing pick with no opponent context — every chip now shows
      "vs OPP" (spread) or the full matchup (total)
- [x] Fixed: selecting one chip highlighted every other chip sharing the same odds
      value (e.g. two games both at "Over 44.5") — now compares by game identity
- [ ] **Confirm the DELETE grant SQL was run**, then test an actual category-swap
      (changing an already-saved pick to a different game) end to end — the one
      path not yet empirically verified, see Status section for the SQL
- [x] **Live Standings + History computation** (2026-08-14) — `js/season-data.js`
      queries Supabase picks + grades them against live/final scores, no more
      frozen snapshot. Old workbook-season data deleted per Neil ("start fresh").
- [x] **Per-week "who's submitted picks" tracker** — collapsible card at the top
      of the Make Picks view, visible to everyone, sorted least-complete-first
- [x] **Admin panel to add/delete players** (2026-08-14, `admin.html`) — real
      `players` Supabase table replaces the hardcoded roster list. Passphrase-
      gated (Neil's explicit choice); doesn't yet support renaming without
      losing pick history (see the players-table-migration note in Status).
- [x] **NFL pick groups: conference-only, chronological within** (2026-08-14) —
      was conference + division
- [x] **"@"/"vs" on spread pick chips** (2026-08-14) — matches Over/Under's
      existing matchup format
- [x] **Scoring math independently verified against the original workbook**
      (2026-08-14) — no bugs found; see Status for the verification method
- [x] **"How picks are scored" section added to the Betting Guide** (2026-08-14)
      — was previously undocumented on the live site
- [x] **Team search/filter on the Picks page** (2026-08-14) — filters all 4
      categories by team abbreviation or full name
- [x] **Dropped "Beta" and internal-doc references from the live site**
      (2026-08-14)
- [ ] Championship/Bowl Picks page — needs its own scoping for prop bets, lower
      urgency (months out)
- [ ] **Stats/trends pages (new backlog, 2026-08-14; team-trends data
      question resolved 2026-08-16 — no external source needed, see Status →
      "corrected 2026-08-16"):** team ATS trends and per-player category
      performance history, possibly surfaced via a new "Analytics" tab
      replacing "Live" in the bottom nav. Deferred until after the season
      starts and there's real data — see Status → "New backlog" for detail.
- [x] **Picks page personalization/wayfinding** (2026-08-14) — colored
      picker card, dynamic "{Name}'s Picks" heading, sticky bottom badge, all
      tied to the player's existing avatar color; fixed a real bug where
      "remember last player" was never actually persisted to `localStorage`
- [x] **Analytics placeholder page** (2026-08-14) — not built, just a "coming
      soon" stub linked from Home, not yet in the bottom nav
- [x] **Weekly Awards** (2026-08-14) — 4 of ~7 pitched categories, live on Home
- [x] **Home page redesign** (2026-08-14) — orientation hub grid + promoted
      primary CTA, replacing the old live-data-only layout

## Session log

### 2026-07-29
- Located and read `Full Regalia 2025 Pick'Em.xlsx` (7 tabs: Picks, Championship Picks,
  Game Lines, Results, Standings, History, Betting Guide). 15 players, mostly couples.
- Confirmed with Neil: (1) picks beta = real entry UI now, backend write-back is a
  placeholder; (2) keep the Google Sheet as the data source, published as CSV.
- Neil clarified the actual point of "backend automation" is eliminating the manual
  weekly grind of looking up scores and retyping them into the sheet by hand — auto-
  grading picks against live results is the headline feature, not just displaying the
  sheet online. Updated `ROADMAP.md` to reflect this as the top-priority feature once
  live scores are wired up.
- Wrote `ROADMAP.md` and this `BACKLOG.md`.
- Built the full site: shared design system (`css/style.css`), PWA manifest + generated
  app icons + service worker, and 5 pages (Home, Standings, Picks, Live stub, Betting
  Guide) with a shared bottom-tab nav.
- Browser-tested every page locally at mobile viewport with Playwright. Found and fixed
  2 bugs: (1) `picks.html` crashed on load with `titleCase is not defined` because that
  helper only lived in `standings-data.js`, which the Picks page never loaded — moved
  `titleCase()` into the shared `app.js` instead. (2) Bottom-nav active-tab highlighting
  only worked on Home, because the local dev server strips `.html` from URLs and the
  matching code didn't account for that — fixed to normalize both sides before
  comparing, so it works whether the host serves `/page.html` (GitHub Pages) or
  `/page` (clean URLs). Re-tested after fixes: both confirmed working, no regressions.
- Not done tonight: GitHub repo/Pages deploy (needs a quick confirm from Neil first —
  makes the code public), Google Sheet publish-to-web, live scores/odds, auto-grading
  pipeline, Championship Picks/Results/History pages, real picks backend.
- Neil tested the site live on his phone over the home WiFi (local server bound to
  0.0.0.0, shared via LAN IP) — confirmed "looks amazing on a phone." Add to Home
  Screen not yet tested (session paused before getting to it).
- Neil asked about the History tab — realized it wasn't built yet ("I don't really see
  much history here"). Proposed and he approved: a History page (season log) plus
  tap-a-name drill-down from Standings into a per-player history/stats page. Started
  re-extracting the full 346-row History sheet from the workbook (the first dump only
  got ~60 rows / Week 4 due to a row cap) — **paused mid-extraction, nothing built yet.**
  This is the next session's first task (see item 0 above).
- Repo creation is blocked on Neil (no gh CLI/token available here) — waiting on him
  to create the empty repo at github.com/new before anything gets pushed/deployed.

### 2026-07-31 / 2026-08-01
- Neil tested the site live on his phone via the LAN link — loved it.
- Quick wins added: Add-to-Home-Screen instructional card (Home page, iOS/Android
  aware), favicon + Open Graph/Twitter share-preview tags on all pages, service worker
  reliability fixes (cache shell files individually; network-first for page
  navigations — this fixed a real bug a Playwright test caught where cross-page nav
  broke once the SW activated on hosts that redirect .html to clean URLs).
- Neil wants to show the beta to a "future owner" (context: pitching the concept, not
  yet a full league rollout). Discussed safe-sharing options; he chose to keep real
  friend names as-is but add a lightweight passphrase gate. Built `js/gate.js` — a
  client-side SHA-256 passphrase check on every page, clearly documented as a
  courtesy speed bump, not real security (no server, so determined viewers can bypass
  it via dev tools). Current passphrase: `regalia2026`. Verified end-to-end with
  Playwright (wrong-passphrase error, correct unlock, persists via localStorage
  across pages).
- **GitHub repo created:** https://github.com/nelsonmartini/full-regalia-league —
  code committed and pushed to `main`. **GitHub Pages not yet enabled** — needs Neil
  to flip it on in repo Settings (can't be done from this environment, no GitHub
  token/gh CLI available). Once enabled, live URL is
  https://nelsonmartini.github.io/full-regalia-league/.
- Session ended here (Neil had to leave) — History page work is still not started,
  remains the first thing to build next session (see below, unchanged from before).

### Design request — not yet done
- Neil wants the site's color palette shifted toward **Xavier University blue**
  (their brand blue, not the current coral/amber accent) — asked 2026-08-01, not
  implemented yet. Need to confirm exact hex/reference (Xavier's brand blue is
  roughly #0C2340 navy + a brighter blue accent — verify against their actual brand
  guide rather than guessing) before reworking `css/style.css`'s `--accent`/`--bg`
  variables. Should stay in the same "friendly, fresh, couples-inclusive" direction,
  just recolored — not a full redesign.

### 2026-08-01 (afternoon session — "let's knock out the big stuff")
- Set up a Claude Code permissions allowlist (`C:\Users\neilm\.claude\settings.json`)
  so routine read-only commands stop prompting Neil for approval every time.
- **Built the History page and per-player drill-down** (the item paused at the end of
  the last session): re-extracted the workbook's History tab in full this time (344
  rows, no row cap), parsed it into `js/history-data.js`, built `history.html`
  (filterable season log) and `player.html` (tap-a-name from Standings → season
  summary, points-by-week trend bars, full week-by-week pick history). Nav grew from
  5 to 6 tabs. Standings rows are now links into the player page.
- Neil asked whether GitHub Pages was live yet mid-session — it was (confirmed 200,
  he must have flipped the Settings toggle himself). Verified end-to-end on production.
- Neil asked for the site's color scheme to move toward Xavier University blue —
  logged above as a design request, not implemented yet (needs exact brand hex first).
- **Researched ESPN's public scoreboard API** and confirmed two important things:
  (1) it's CORS-open (`Access-Control-Allow-Origin: *`), so it can be called directly
  from the browser with no proxy/backend needed; (2) it includes betting odds
  (spread/moneyline/over-under via DraftKings) embedded in the same free response —
  NFL coverage is ~100%, college is ~50% (smaller games often lack a posted line).
  This meant **The Odds API is no longer needed** — ESPN alone covers both scores
  and odds, simplifying the plan from ROADMAP.md.
- **Built live scores/odds** (`js/live-scores.js`): Live page now shows real games
  with an All/Live-now filter, auto-refreshing every 30s; Home page's live-games
  card shows the top 3. Verified against real data (confirmed real NFL preseason +
  college games rendering, not placeholders).
- **Built the auto-grading engine** (`js/grading.js`) — the headline feature Neil
  called out as the actual point of "automatic backend numbers": pure functions that
  grade a structured pick (spread/moneyline/total) against a finished game's score,
  returning hit/miss/push and points. Unit-tested directly in Node (17/17 passing)
  before trusting it, since this is the logic that matters most.
- **Rewired the Picks page** to pull real current games + real live odds instead of
  last session's fake sample matchups, and to store picks as structured objects
  (`{type, team, line}`) instead of display strings, so they're gradable. Added a
  "Your results" card that auto-grades a player's saved picks as soon as the
  underlying game goes final — verified it correctly stays hidden when nothing's
  graded yet (expected, since people can only pick pre-kickoff games) and that picks
  persist correctly across reloads.
- Every change this session was Playwright-tested locally before pushing; found and
  fixed bugs pre-emptively rather than shipping broken. Three commits pushed to
  `main`, all deployed and verified live.
- **Not done:** Standings/History still aren't wired to the live Google Sheet (still
  waiting on Neil to publish it to web); Xavier blue recolor; Championship Picks and
  Results pages; the real multi-user picks backend.

### 2026-08-01 (evening) — Xavier recolor, direction pivot, Picks UX overhaul
- **Xavier University blue recolor shipped.** Searched for and confirmed the official
  brand blue (#0C2340, Pantone 289 C) via web search + Xavier's own brand PDF rather
  than guessing. Rebuilt the palette around it (navy for card surfaces, a brighter
  blue tint for buttons/badges), regenerated app icons, updated theme-color/manifest.
- Neil asked for a player-avatars feature (clickable, next to names, tap-through to
  results/money-won) — logged above, not built yet.
- **Major direction pivot.** Neil clarified — twice, it needed real correction the
  first time — that the goal is not "read the Google Sheet live," it's to eliminate
  the spreadsheet entirely. Reversed the ROADMAP.md decision to keep the Sheet as the
  backend. The real path is a hosted database (Firebase or Supabase) that the site
  both writes picks to and reads standings from. Neil deliberately deferred the
  Firebase-vs-Supabase choice until after talking to the site's eventual owner —
  **do not pick one and start building without that conversation happening.** Nothing
  built so far is wasted by this — the Picks UI, grading engine, and live-data fetch
  are all backend-agnostic; only the storage layer needs swapping later.
- Diagnosed and fixed a real bug: Neil reported the Xavier recolor "looks the same" —
  turned out the service worker was serving a stale cached copy of `style.css`
  because its cache-version constant hadn't been bumped. Lesson: **bump `sw.js`'s
  `CACHE` version on every deploy that changes a cached file**, not just when adding
  new files to the shell list. Fixed for this and the next deploy.
- **Picks page UX overhaul**, per detailed feedback from Neil: confirmed picks *were*
  already being saved (just per-device, not per-group — clarified this plainly).
  Rebuilt the page: one card per game (not one per bet type, which repeated the
  matchup 3x) with Spread/Moneyline/Total nested inside; added date + week/league
  label per game (needed ESPN's date-range query support, confirmed it works);
  duplicated the Save button at the top (was bottom-only, forcing a scroll-back);
  and added a new "My Picks — Season" tab showing every pick ever saved, grouped by
  week, with Hit/Miss/Push/Pending status — the "view across the season" ask. Picks
  now store a self-contained snapshot (matchup/date/week) alongside the structured
  value so old picks stay viewable even after their game ages out of the live fetch
  window. Playwright-tested end to end before pushing; all checks passed first try.

### 2026-08-01 (evening, continued) — avatars, Results, week-ahead Picks, NFL/NCAA toggle, real logo
- Built **player avatars** (generated initials-on-color, no photo dependency) on
  Standings, History, the Player page header, and a live preview next to the Picks
  player selector.
- Added a **Results filter** to the Live page (All / Live now / Results chips)
  instead of a separate Results page — same data already flowing through
  `live-scores.js`, avoided duplicating a nav slot/code path.
- **Widened Picks to cover the whole NFL season ahead**, after verifying directly
  against the ESPN API that DraftKings posts full-season NFL lines in advance (a
  December game already had real odds in August) — added a week selector so people
  aren't limited to only the next couple weeks.
- Neil asked (correctly) whether this should also cover NCAA with its own toggle —
  added 🏈 NFL / 🎓 NCAA chips that scope the week selector and games list per sport.
  Caught and fixed a real bug while building this: the week-bucket key didn't
  originally include sport, so "Week 3" could silently mean either league.
- Neil asked to drop "Welcome back 👋" and get a real logo. Designed a crown mark
  (fits "Regalia" — royal insignia) as inline SVG, replacing the plain "FR" text
  everywhere (header, gate screen); regenerated the PNG app icons to match; gave
  Home page a proper hero (crown + "Full Regalia" wordmark) instead of the old
  greeting text.
- All of the above was Playwright-tested locally and confirmed working — **but the
  session ended before it got committed/pushed.** First thing next session (or
  whenever this file is next opened) should be checking `git status` in the project
  folder for exactly this reason before assuming local state matches what's live.

### 2026-08-10 — Supabase wiring finished, week-ordering bug fixed
- Neil reported a live bug ("why is week 2 before week 1") and asked to push the
  pending Supabase code from last session. Both handled: diagnosed and fixed the
  week-ordering bug (season-phase collision, see note above), then finished wiring
  Picks to Supabase (added the missing script includes, tested with Playwright).
- Testing caught a second real bug: jsonb key-ordering broke the "already selected"
  chip comparison after a Supabase round-trip. Fixed (`sameValue()` helper).
- Neil flagged the "Saved 3 of 96" pick count as more than he expects a real week
  to have — logged as an open, unresolved question (see above), not acted on.
- Test data left in the live table from Playwright testing — cleanup SQL provided,
  not yet run (Neil to do, needs SQL Editor access which this environment doesn't have).
- Committed and pushed. Verify live before starting the next task, per the standing
  "always check git status / verify deploy" lesson from last session.

### Next session — resume here
- **Top priority:** build the live Standings computation (query Supabase picks +
  `js/grading.js` results, sum points per player) — this is the last piece needed
  to fully retire the frozen-snapshot Standings page.
- Confirm Neil ran the test-data cleanup SQL (see Status section above) before
  the group starts using Picks for real.
- Check whether Neil has decided the "how many picks per week" open question —
  if so, that may reshape the Picks page before Standings computation is finalized,
  so worth checking first rather than building on top of the current (possibly
  temporary) "show the whole week" behavior.
- Championship/Bowl Picks page still open, still low urgency.
- **Always check `git status` at the start of a session** before reporting on
  progress or assuming the last session's work made it live.
- Remember to bump `sw.js`'s `CACHE` constant on any deploy touching a cached file.

### 2026-08-30 — Root-cause fix confirmed live; cleanup pass
- Neil confirmed the ESPN date-range fix worked: "its showing 1 point for Sean and
  Jacob!" — the 0-points production bug (see above) is resolved and closed out.
- Removed the temporary `#diagnostics-card` / `runDiagnostics()` panel from
  `standings.html` now that the root cause is found and fixed — it was always meant
  to come out once resolved.
- Added a header row above the Standings leaderboard (`.standings-header-row` /
  `.standings-header-label` in `css/style.css`, reusing the same grid columns as
  `.standings-row` so "Win %" / "Points" line up exactly over their values) — there
  was previously no labeling at all for what the two numbers meant.
- Home page's "Top of the standings" preview now shows Points only, no Win % — new
  `renderStandingsRowCompact()` in `js/season-data.js` (4-column grid via
  `.standings-row-compact`), used only by `index.html`; the full Standings page
  keeps both columns.
- Fixed a real alignment inconsistency Neil flagged in the 4 pick categories
  (Minus Spread / Plus Spread / Over / Under): the picked-game summary text
  (`.pick-game-summary`) was left-aligned, so its starting X position shifted
  row-to-row depending on the category label's width ("Minus Spread" vs "Over" are
  very different lengths) — reads as "sometimes left, sometimes right" when
  scanning down the list. Set `text-align:right` (plus `align-items:flex-end` on
  the `.is-set` variant for the two-line picked state) so all 4 categories' game
  text lines up on the same right edge regardless of label width. Verified via
  Playwright: right edges match exactly (0px spread) across all 4 categories, for
  both NFL and NCAA. Shared CSS, so no sport-specific code path to duplicate.
- Bumped `sw.js` to `full-regalia-shell-v57`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd) — "Week N" unification, Standings/Player polish
- Neil reported real confusion: the Home page said "Week 1" was Sept 9-14ish, the
  Picks page said "Week 1" was Sept 3-7, and college football games tagged
  "Week 1" had already been played despite the date range implying it hadn't
  started. Investigated and found **four independent "week" concepts** coexisting:
  (1) Home/Standings' freshness line used an NFL-only native week number, (2) the
  Picks page's "Regalia/Crown Week" pairs NFL+NCAA by nearest date into one unified
  number (the "good" one, already built earlier this project), (3) Weekly Awards
  uses a plain Monday-anchored calendar week off each pick's game date, (4)
  History/Player label things by each sport's own native week number. None of
  these knew about each other, so "Week 1" meant a different date range depending
  which page you were on.
  - Confirmed via live ESPN data (2026-08-30): CFB's own "Week 1" spans Aug 29
    (season-opener games, already final) through Sep 7 (still upcoming) — a real
    ESPN data quirk, not an app bug. The app's date-range math only looked at
    still-open (`pre`-status) games, so it showed "Sep 3–7" and hid that part of
    the week had already happened.
  - Fix: moved `buildRegaliaWeeks`/`regaliaWeekDateRange`/`regaliaWeekTitle` out of
    `js/picks.js` into the shared `js/pick-utils.js`, added `currentRegaliaWeek()`,
    and rewrote `pickableWeekText()`/`standingsFreshnessText()` to use it instead
    of the old NFL-only `earliestPickableWeek()` (removed). Also fixed
    `buildRegaliaWeeks`'s date-range calc to use ALL games sharing a week key
    (any status), not just still-pickable ones, while still only listing weeks
    that have at least one pickable game left (`hasPickable` filter) — same
    "which week is current" behavior, accurate displayed range. `js/picks.js`
    now passes `allGamesBySport` (unfiltered) instead of the old pickable-only
    `gamesBySport` into this function; `gamesBySport` itself is untouched and
    still drives the actual pickable chip lists.
  - Did NOT change the underlying NFL+NCAA pairing rule itself (Neil confirmed
    this was already correct: earliest calendar week is NCAA-only, next one
    pairs NCAA+NFL) — only unified which pages use it and fixed the date range.
  - Verified via Playwright with data shaped exactly like the real live
    ESPN state (mixed final + pre games in the same CFB week): Home's CTA
    subline, Home's "Standings as of" line, and the Picks page's week picker
    all now show the identical "Week 1 · Aug 29–Sep 7."
- Standings leaderboard: reordered columns to Points-then-Win% (was Win%-then-
  Points), centered both value columns and their headers (was right-aligned),
  and relabeled the points header "Season Total" (was "Points") — all in
  `js/season-data.js` (`renderStandingsRow`) and `css/style.css`
  (`.standings-points`, `.standings-winpct`, `.standings-header-label`).
- Player page (`player.html`): "Best Week" stat no longer crams the week label
  into the big number as `"14 (NFL · Week 3)"` — now shows the number alone with
  the week label as its own small line underneath (`#stat-best-label`). Replaced
  the "Points by week" horizontal progress-bar list with a proper vertical bar
  chart (`.week-chart`/`.week-chart-bar` in `css/style.css`) — a left-to-right
  "build of the season" instead of a stack of bars that were really just
  comparing against a single number each.
- Answered Neil's question on Weekly Awards: they're **not** tied to any of the
  above week systems — `js/awards.js` uses its own plain calendar week (Monday-
  anchored, off each pick's game date) and recomputes live as more of that
  week's games go final, right up until the next calendar week produces its own
  first graded result. Not changed this session; flagged as a possible future
  follow-up if Neil wants Awards' week label to match the Regalia Week number
  too.
- Bumped `sw.js` to `full-regalia-shell-v58`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 2) — Home standings header, award blurbs, Analytics visuals
- Home page's "Top of the standings" preview: added the same "Season Total"
  column header as the full Standings page (`.standings-header-row-compact`,
  `css/style.css`), and moved the "Full board →" link out of the card title
  down to its own right-aligned line under the list, to make room.
- Weekly Awards: each award now shows a short one-line description of what it
  measures (e.g. "Most misses this week", "Biggest underdog taken"), separate
  from the winner's specific stat line — previously only the winner's number
  was shown, with no explanation of what the award itself was for.
  `js/awards.js`'s `renderWeeklyAwards()`. Confirmed for Neil what the 2
  reserve (not-yet-built) award ideas are, still sitting in the backlog from
  2026-08-14: 🎢 Rollercoaster (point swing vs. own average) and 🥶 Ice Cold
  (miss streak) — easy to add later, same data model as the 4 live ones.
- Player page: fixed the "C1"/"N1" bar-chart labels (my own abbreviation from
  the last session's redesign, confirmed confusing) to show the sport emoji
  instead — "🎓 W1" / "🏈 W1" — matching the 🏈/🎓 convention already used
  elsewhere in the app (e.g. Analytics' team-sport toggle), no legend needed.
- Analytics' Player Comparison table was a plain grid of percentages, no
  visual weight — Neil asked for "more visual and graphics." Added
  color-coded pills per cell (green the higher the cover %, red the lower,
  blended via `color-mix()` off the existing `--positive`/`--negative`
  palette — same colors already used for Hit/Miss badges elsewhere) plus a
  small legend caption. Team Trends already had bar-style stat rows from
  earlier work, left unchanged.
- Bumped `sw.js` to `full-regalia-shell-v59`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 3) — Ice Cold award, Big Dawg rename, game-click destination fix
- **Ice Cold award added** (`js/awards.js`) — the other reserve idea from
  2026-08-14 wasn't built yet: longest run of CONSECUTIVE misses within the
  week (kickoff order), separate from Dumbass of the Week's raw miss COUNT
  (4 misses spread across the week reads differently than 4 in a row).
  Requires a streak of 2+ to show (a single miss isn't a "streak"). 🥶.
- **High Roller renamed to Big Dawg** — same description ("Biggest underdog
  taken") and computation, just the display name changed everywhere
  (`computeWeeklyAwards`'s returned key renamed `highRoller` → `bigDawg` too).
- **Fixed what clicking a game on the Games page actually leads to.** Neil:
  "why when I click any game it takes to analytics tab... it should take us
  to the 2 teams history on the 4 bets, not the historical picks of the
  users." Two real problems, both fixed:
  1. Each team row only ever linked to ITS OWN team's Analytics trends
     (`?team=ABBR`) — you'd see one side of the matchup, never both.
     `gameCardTeamRow()` (`js/live-scores.js`) now also passes the
     opponent's abbr (`?team=X&opp=Y`), and `analytics.html`'s
     `renderTeamDetail()` renders both teams' full 4-category history
     stacked in one "X vs Y" card when `opp` is present.
  2. Even fixed, landing on `analytics.html` puts you above the **Player
     Comparison** table first (that's the "historical picks of the users"
     Neil meant) — the team/matchup card is further down the page, easy to
     miss. Added a `scrollIntoView()` on deep-link so the page jumps straight
     to the team/matchup card. Had to move this call to run AFTER Player
     Comparison finishes rendering (not right after the team card populates,
     which happens earlier in the script) — otherwise it scrolled to where
     the target used to be before that table grew underneath it and pushed
     the target further down; caught via Playwright with a realistic
     14-player roster, which a smaller test scenario didn't reproduce.
- **Fixed "Full board →" link styling on Home** (regression from the last
  session's change moving it out of the card-title row): `.link` has no
  styling of its own outside a `.card-title` context (only `.card-title
  .link` was ever defined), so the moved link rendered unstyled/muted
  instead of matching every other card's accent-colored trailing link. Added
  a scoped `.standings-preview-footer .link` rule matching that same look.
- Bumped `sw.js` to `full-regalia-shell-v60`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 4) — Teams with no posted odds now show points scored/allowed
- Neil reported Hawaii/Stanford's game was final but didn't show up in
  Analytics' Team Trends. Confirmed via live ESPN data: that specific game
  (HAW @ STAN, final 37-27) has NO `odds` field at all in ESPN's response —
  no sportsbook line was ever posted/returned for it. `teamsWithFinishedGames()`
  (`js/team-stats.js`) required a posted line just to appear in the team
  picker at all, so neither team showed up, even though their final score is
  perfectly good data on its own.
  - Removed that requirement — a team now appears after any finished
    real-season game, regardless of odds. The 4 betting categories still
    correctly show "No data yet" per-category when there's no line to grade
    against (unchanged, already handled).
  - Added what Neil asked for: **points scored/allowed per game**, tallied
    from every finished game (odds or not) — new `pointsFor`/`pointsAgainst`/
    `scoringGamesCounted` fields on the team record, rendered as two stat
    tiles (`pointsSummaryHtml()`, `analytics.html`) above the existing
    Minus/Plus Spread and Over/Under rows.
  - Verified via Playwright using the exact real event shape (final score,
    no `odds` key): both teams now appear in the picker and show their
    points-per-game tiles, while still correctly showing "No data yet" for
    all 3 odds-dependent categories.
- Bumped `sw.js` to `full-regalia-shell-v61`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 5) — Standings column alignment, cursive topbar
- Neil still not seeing Ice Cold — confirmed the live deployed `js/awards.js`
  does contain it (curled the production file directly). Not a deploy/cache
  issue — Ice Cold requires 2+ CONSECUTIVE misses by one player within the
  same calendar week, and with only a couple games graded so far this early
  in the season, nobody has hit that yet. Expected to start appearing
  naturally as more weeks get more graded picks; nothing to fix here.
- **Fixed real Standings column misalignment** (Home preview AND the full
  Standings page): `.standings-row`/`.standings-header-row` are separate
  grid containers, so an `auto`-width column sizes itself off THAT grid's
  own content only — with "Season Total"/"Win %" (wide header text) in one
  grid and a bare number (narrow) in the sibling grid, each auto-sized to a
  different width and never lined up. Confirmed visually. Switched both
  grids' value columns to explicit fixed widths (`64px`/`52px` full,
  `64px` compact) in `css/style.css` so header and value columns always
  agree, regardless of what the actual numbers look like.
- **Cursive topbar, site-wide**: same Pacifico font already used in the Home
  page's brand quote, now applied to "Full Regalia" in the topbar wordmark
  on all 9 pages (new `.wordmark-name` class) — Neil wanted the branding
  consistent everywhere, not just Home. Required adding the Google Fonts
  `<link>` tags (previously only on `index.html`) to the other 8 pages too,
  or the font would've silently fallen back to a generic cursive there.
  "LEAGUE" stays in the existing small-caps style for contrast/legibility
  next to the script text.
- Bumped `sw.js` to `full-regalia-shell-v62`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 6) — Home page cleanup: dedupe header, hub grid reorder
- Neil still saw "Top of the standings"/"Season Total" as visually
  disconnected even after the fixed-width column fix — turned out the real
  issue was structural, not a sizing bug: the header row had been split onto
  its own line below the card title (from an earlier request to "make room"
  for it), so the two read as unrelated floating elements instead of one
  unit. Folded "Season Total" back into the card-title row itself (`.card-
  title` is already a flex row with space-between — same pattern every other
  card's trailing label/link uses), removing the separate `.standings-
  header-row-compact` row and its now-dead CSS entirely.
- **Removed a duplicate "Full Regalia" heading on Home** — the topbar's
  wordmark (now cursive, see above) made the second bold "Full Regalia"
  h1 + icon block right below it pure repetition. Deleted that block; the
  brand quote now sits directly under the topbar.
- **Moved "Get around the app" to the bottom of Home**, directly above the
  Admin card (was between Weekly Awards and Analytics) — Analytics and Live
  Scores now come right after Standings/Awards, with the navigation hub
  grid last before Admin/footer.
- Bumped `sw.js` to `full-regalia-shell-v63`, committed, pushed, confirmed live.
- Neil weighed in on extending the cursive font further: asked whether it
  should go on section headers too, or the whole site. Recommended against
  extending it beyond the topbar/brand quote (script fonts hurt scannability
  on anything you need to read quickly — standings, picks, points) and
  suggested Anton (the bold condensed font already used for "FULL REGALIA")
  as a middle-ground option for section headers instead, if he wants a
  stronger unified feel without hurting legibility. Not implemented —
  awaiting Neil's call on that option.
- Asked which icons Neil meant by "make icons more in the same color and
  style, looks out of place" (bottom nav vs hub cards vs card-title icons) —
  answer: **bottom nav bar only**.
  - Replaced the 6 bottom-nav emoji (🏠📝🏆📜📡📘, full-color, platform-
    dependent glyphs that ignore CSS `color`) with minimal single-color SVG
    line icons (`stroke="currentColor"`) across all 8 pages that have the
    bottom nav (Admin deliberately has none, unchanged). Because they use
    `currentColor`, they now inherit `.nav-item`'s text color automatically
    — faint gray when inactive, `var(--accent)` blue when active — exactly
    matching how the text label next to each icon already behaves, instead
    of a fixed emoji color that never changed with tab state.
  - `.nav-item .icon` CSS switched from `font-size` (emoji sizing) to an
    explicit `svg { width/height: 21px }` rule.
  - Hub-card icons and card-title icons (📊 Analytics, ⚙️ Admin, 🏅 Awards,
    etc.) were NOT touched — Neil confirmed only the bottom nav looked out
    of place, not those.
- Bumped `sw.js` to `full-regalia-shell-v64`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 7) — Anton on section headers, site-wide
- Neil went with the recommended middle ground: Anton (the bold condensed
  font already used for "FULL REGALIA" in the brand quote) on `.card-title`
  and `.section-label` — every card's heading ("TOP OF THE STANDINGS",
  "LAST WEEK AWARDS", "FULL LEADERBOARD", "PLAYER COMPARISON", "SEASON
  SUMMARY", etc.) across all pages, plus every `.section-label`
  ("PLAYER COMPARISON", "TEAM TRENDS", "GET AROUND THE APP"). Not applied to
  `.page-title` (the big per-page h1 like "Standings"/"Analytics") — kept
  that as the existing bold sans for now, a smaller, more conservative first
  pass than reworking the whole heading hierarchy at once.
  - Nested small elements inside a `.card-title` — the trailing `.link`
    ("Full board →", "See all →") and the "Season Total" mini column label
    (`.standings-header-label`) — explicitly reset back to the normal sans
    stack, so only the actual heading text picks up Anton. Distinct from
    tabular fields and trailing actions, per Neil's own framing of what he
    wanted.
  - Verified visually across Home, Standings, Player, and Analytics — reads
    consistent everywhere without needing per-page changes, since both
    classes are shared/global in `css/style.css`.
- Bumped `sw.js` to `full-regalia-shell-v65`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 8) — Home page reorder, Analytics collapsible sections
- Darkened `.card-title`/`.section-label` from `--text-faint` to `--text-dim`
  — Neil found the new Anton headers hard to read; Anton's thinner strokes
  read lower-contrast than the bold sans they replaced at the same color.
- Answered Neil's Over/Under question directly: confirmed via live ESPN data
  that the games finished so far (season openers) never had ANY odds posted
  at all — not spread, not total. Not a parsing bug; later Week 1 games
  already have real posted lines and will populate once they finish.
- **Home page reorder**, per Neil's spec: Standings (top 3) → Picks status →
  Awards → Live scores → Analytics (shrunk) → hub grid → Admin.
  - Standings preview: rank medals (🥇🥈🥉) replaced with plain numerals in
    the same cursive Pacifico font as the topbar/brand quote (new
    `.standings-rank-cursive`) — "1, 2, 3" reads more like part of the brand
    now, not plain body text buried under emoji.
  - **New "Picks" card**: compact status line ("Week N · X of Y submitted
    this week") plus an "Enter picks →" link — surfaces the same submission
    count picks.html already computes (`computeWeekStatus`/
    `expectedPickTotal`/`loadAllPicks`), moved from `js/picks.js` into the
    shared `js/pick-utils.js` so Home can use it without pulling in picks.js's
    DOM-binding code.
  - **Analytics card shrunk** to a single compact line (icon + title + "View
    trends →"), dropping the paragraph + full-width button — matches Neil's
    "reduce its space" ask now that it's moved to the bottom of the page.
- **Analytics page sections now collapsible, collapsed by default** — Player
  Comparison and Team Trends can each get long (full roster / two-team
  matchup card), so landing with everything expanded meant scrolling past a
  lot before seeing anything else. New `.section-toggle`/`.section-chevron`
  pattern (click a section-label to expand/collapse). The game-click deep
  link (`?team=X&opp=Y`) explicitly force-expands Team Trends first — it's
  the whole reason someone lands there, so it can't stay collapsed under the
  new default, and the existing `scrollIntoView` fix would otherwise scroll
  to a hidden section.
- Bumped `sw.js` to `full-regalia-shell-v67`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 9) — Picks page: sharper picker card, hit badge on collapsed sections
- **"Who's picking?" card sharpened** — Neil: loved the color/icon theme but
  wanted it "crispier and sharper," and wasn't sure how to actually change
  names. Two fixes: (1) new `.picker-select` gives the dropdown its own
  solid `--bg-elev` fill with a border tinted to the player's color, instead
  of blending into the card via the default flat `.chip` gray; (2) the bare
  icon-only "⌄" change button is now a labeled pill reading "Switch ▾"
  (`.picker-change-btn`) — spells out the action instead of relying on a
  small circular glyph to communicate it.
- **Sport section headers (NFL/NCAA on the Make Picks list) now show a hit
  result inline, collapsed or not** — Neil: "4/4 picks made" already showed
  completion, but not whether they'd won once games were final, without
  opening the section. New `sportGradedSummary()` (`js/picks.js`) grades
  each of the sport's 4 slots against `allGames` the same way every other
  page does (`gradePick`), counts how many are graded/hit, and renders a
  small pill next to the picks-made count — e.g. "2/4 picks made · 1/2 hit"
  — green when every graded pick hit, neutral gray otherwise. Only appears
  once at least one pick in that sport is actually graded.
- Bumped `sw.js` to `full-regalia-shell-v68`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 10) — Fixed duplicate "Enter Picks" CTA on Home
- Adding the "Picks" status card two sessions ago created a real duplicate:
  the original top-of-page "Enter your picks →" button AND the new card's
  own "Enter picks →" link both did the same thing. Neil asked to collapse
  back to one. Removed the new "Picks" card entirely (including
  `loadPicksStatus()` and the "X of Y submitted this week" line it showed —
  that feature's gone from Home now, still lives on picks.html itself).
  - Original CTA button kept, but moved to sit right below the Standings
    preview instead of above it, and restyled in the same Pacifico cursive
    font as the brand quote/topbar (`.enter-picks-cursive`) — reads as part
    of the brand now rather than a generic button label. The Week N/date
    subline stays directly beneath it, unchanged.
  - Removed the "👇 Tap below to make your picks for the week" instruction
    line — redundant once the CTA sits directly under something you're
    already looking at, not several sections away.
- **Standings preview trimmed down further** ("reduce and optimize... much
  smaller real estate"): smaller rank/avatar grid columns, tighter padding,
  smaller name/points type (new sizing under `.standings-row-compact`),
  avatar dropped from 32px to 24px.
- **Rank numerals now render in `var(--text)`** instead of the gold/silver/
  bronze accent colors — reads white in dark mode (confirmed via computed
  style: `rgb(245, 246, 250)`) without vanishing in light mode, where
  `--text` is a dark navy instead. A literal `#fff` would've disappeared
  against light-mode's white cards.
- Bumped `sw.js` to `full-regalia-shell-v69`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 11) — Collapsible conferences, confirm-before-change on picks
- Neil: too much scrolling under a category once every conference/division
  subgroup (SEC, Big Ten, AFC, etc.) rendered fully expanded at once. Added
  a second collapse layer, one level deeper than the existing category
  collapse: each conference now starts collapsed, keyed per (sport,
  category, conference) so the same conference can be open under one
  category and closed under another. Force-expands while searching/
  filtering (same as categories), AND whichever conference contains the
  currently picked game — opening a category you've already picked in
  shows the pick, not a wall of collapsed conference headers to guess
  through. New `.pick-group-header`/`.pick-group-chevron` (`css/style.css`),
  `groupExpanded` state + click handler (`js/picks.js`), `groupExpanded`
  threaded through `categoriesHtmlForSport`/`renderSportSections`.
- Answered Neil's "Week 2 NCAA barely has anything to pick" question:
  confirmed via live ESPN data — 85 games exist for CFB Week 2, but only 7
  have a posted line so far. Not a bug; college odds post closer to
  kickoff than the NFL's (already documented elsewhere in this codebase).
  Will fill in as books post lines closer to that week.
- **Confirm dialog before changing an existing pick** — Neil wanted a gate
  before overwriting a pick that's already set, not for a first-time pick
  into an empty slot (nothing to lose there). Chip-click handler now shows
  a native `confirm()` — `Change your Minus Spread pick from "X" to "Y"?"`
  — only when the category already had a different game/value selected;
  canceling leaves the existing pick untouched. Verified: fires on real
  changes, silent on first-time picks.
- Bumped `sw.js` to `full-regalia-shell-v70`, committed, pushed, confirmed live.

### 2026-08-30 (cont'd 12) — Conference chevron polish, custom confirm popup
- **Conference header chevron made bigger and moved next to the name** —
  was spread to the far right via `justify-content: space-between`, reading
  as disconnected from the conference label; switched to a simple flex row
  with a small gap so the arrow sits right next to "SEC"/"BIG TEN", and
  bumped its size/color (13px, accent blue) so it reads as clearly tappable
  (Neil: "easier and more obvious").
- **Replaced the native browser `confirm()` with a custom in-app popup** —
  Neil wanted the "change this pick?" prompt to look like part of the site,
  not an OS dialog. New `#confirm-modal-overlay` (picks.html): a translucent
  scrim + centered card with a cursive Pacifico title ("Change this pick?",
  per Neil's suggestion), the same message text as before, and Cancel/
  Change pick buttons matching the site's existing button styles.
  `showConfirmModal(message)` (`js/picks.js`) returns a Promise resolved by
  whichever button is tapped (or by tapping the scrim, which cancels) —
  same true/false calling convention as `confirm()`, so the one call site
  just added an `await`. The chip-click handler is now `async` to support this.
- Bumped `sw.js` to `full-regalia-shell-v71`, committed, pushed, confirmed live.

### 2026-09-03 — UI enhancement round: logos, consensus, streaks
- Neil asked for "cool UI features" — proposed 6 ideas, he asked to add all
  except confetti (dropped after a design discussion about how it'd even
  know whose win to celebrate with no login — resolved conceptually as
  "scoped to whichever player's page/selection is on screen," but Neil
  opted to skip it anyway).
- **Team logos** — confirmed ESPN's scoreboard API returns a direct logo URL
  per team (`team.logo`) for both NFL and CFB. `normalizeEvent()`
  (`js/live-scores.js`) now carries it through on `home`/`away`. Wired up in
  3 places: game cards (`gameCardTeamRow`, new `.game-card-team-logo`
  column), Picks page spread chips (`buildCategoryPools`/chip render, new
  `.chip-team-logo`), and Analytics' team detail card (new `findTeamLogo()`
  helper scanning already-fetched games, no separate roster needed). Missing/
  broken logos fail silently (`onerror` hides the `<img>`) rather than
  showing a broken-image icon — some smaller schools' art isn't always
  backfilled.
- **Pick consensus** — once a category locks, shows "X of Y in the group
  picked this side" (`.pick-consensus`), comparing the current pick against
  every OTHER player's pick for that exact game+bet-type (spread's minus/
  plus are the same line's two sides, so both categories count together).
  New `computeConsensusForPick()` in `js/picks.js`; reuses the `allPicksRows`
  already fetched for the existing "Who's picked" card instead of a second
  query, threaded through `categoriesHtmlForSport`/`renderSportSections`.
- **Streak badges** — a 🔥N badge once a player's current CONSECUTIVE hit
  streak (walking backwards from their most recent graded pick) reaches 3+;
  a miss or push ends it immediately. New `computeCurrentStreak()` in
  `js/season-data.js`, `computeStandings()` now attaches `.streak` per
  player, shown in both standings rows and on `player.html`'s header.
  Caught and fixed a real bug while wiring this up: `player.html` was
  setting `#player-title`'s `textContent` (wiping out any child nodes) AFTER
  the streak badge would've been added as a child — moved the badge to a
  sibling `<span>` instead of nesting it inside the `<h1>`.
- Bumped `sw.js` to `full-regalia-shell-v72`, committed, pushed, confirmed live.

### 2026-09-03 (cont'd) — Countdown timers, shareable weekly recap
- **Countdown timers** — still-upcoming picks now show "Locks in 2h 15m"
  alongside the existing plain kickoff day/time. New `formatCountdown(iso)`
  (`js/live-scores.js`), coarse (days+hours, or hours+minutes, or just
  minutes — no seconds, since this isn't a true per-second tick). Added a
  `setInterval(renderAll, 60000)` to `initPicksPage()` purely to keep the
  countdown current while the tab's open — re-renders from data already in
  memory, no re-fetch, doesn't touch pending/saved pick state.
- **Shareable weekly recap** — a 📤 button on each graded week's card
  (`renderHistoryEntry`, shared by `history.html` and `player.html`) shares
  a plain-text recap ("Neil — NFL · Week 3\n3/4 picks hit · 4 pts\nFull
  Regalia League") via the native share sheet (`navigator.share`) where
  available, falling back to clipboard + a "Copied!" swap on the button
  itself for browsers without it (mainly desktop). New
  `historyEntryShareText()`/`shareHistoryEntry()` in `js/season-data.js`.
- This closes out the "cool UI features" round: team logos, pick consensus,
  streak badges, countdown timers, shareable recap — 5 of Neil's 6 picks
  (confetti dropped per his call after discussing how it'd need to be
  scoped to whichever player's page is on screen, not device identity,
  since there's no login).
- Bumped `sw.js` to `full-regalia-shell-v73`, committed, pushed, confirmed live.

### 2026-09-03 (cont'd 2) — Game card cleanup, Analytics team search
- Neil: with logos now in game cards, NCAA's abbreviation + mascot name
  (ALA / Crimson Tide) read as duplicated once the logo was already doing
  the "which team" work. Reworked `gameCardTeamRow()` (`js/live-scores.js`)
  sport-conditionally:
  - **NCAA**: single line showing the school's own name (`team.location`,
    e.g. "Alabama") at a smaller size, replacing the abbr+mascot-name pair.
    Away side gets a leading "@" (standard sports shorthand for "at") instead
    of a home-team house emoji — reads instantly, no icon legend needed.
  - **NFL**: left exactly as it was (abbr + mascot name stack, home icon) —
    NFL abbreviations are widely recognized on their own, and "@" landing
    next to a bare mascot name read oddly once tried ("KC @Chiefs") rather
    than clarifying anything.
  - `normalizeEvent()` now also carries `team.location` through for CFB.
  - `.game-card-team` grid dropped from 4 columns to 3 (logo, name, score)
    now that NCAA doesn't need a separate abbr column.
- **Analytics team search** — Neil: 130+ NCAA teams in a plain `<select>`
  was too much to scroll through to find one team. Added a search input
  above the team picker (`#team-search-input`) that filters the `<select>`'s
  own option list live as you type, matching on either abbreviation or full
  name — same visual pattern as the Picks page's existing team search.
  Clears automatically when switching the NFL/NCAA toggle.
- Bumped `sw.js` to `full-regalia-shell-v74`, committed, pushed, confirmed live.

### 2026-09-03 (cont'd 3) — Fixed "@" polarity, restored NCAA nickname
- Neil caught two things from the last pass: (1) "@" was marking the AWAY
  team — standard sports shorthand actually uses "@" for the home side
  (it marks the site of the game), so this was backwards; (2) he wanted the
  mascot nickname back too, not just the plain school name — specifically
  "the bigger white font" nickname next to the logo, with the school name
  adjacent as a smaller secondary line, rather than replacing one with the
  other.
- Fixed both in `gameCardTeamRow()` (`js/live-scores.js`): NCAA now shows
  the nickname (e.g. "Crimson Tide") as the bold, bright primary label
  (new `.game-card-team-nickname`, `color: var(--text)` — white in dark
  mode) with the school name (e.g. "Alabama") right after it as a smaller
  muted line (new `.game-card-team-schoolname`) — same layout pattern NFL's
  abbr+mascot-name stack already used, just swapped which piece of text is
  primary. "@" now prefixes the HOME team's nickname instead of the away
  team's. NFL is untouched (still abbr + mascot name + house icon).
- Bumped `sw.js` to `full-regalia-shell-v75`, committed, pushed, confirmed live.

### 2026-09-03 (cont'd 4) — Dropped mascot, fixed a real name-source bug, added AP rankings
- Neil said the nickname pass still looked repetitive and asked to drop it —
  landed back on NCAA showing just the school's own name (`location`), no
  mascot, "@" still marking the home team.
  - While investigating, found the ACTUAL bug behind "looks like the school
    name is just repeated": the app's `name` field for a team was populated
    from ESPN's `shortDisplayName`, which for NCAA is often a shortened
    SCHOOL name ("E Michigan" for Eastern Michigan), not the true mascot —
    confirmed via live ESPN data. So the "nickname" shown a moment ago
    wasn't actually the mascot at all for most schools, just a second,
    shorter copy of the school name — which is exactly why it read as
    duplicated. (The raw ESPN `team.name` field, not `shortDisplayName`, is
    the actual mascot — not used now that mascot's been dropped, but worth
    recording in case it comes back.)
  - `.game-card-team-fullname` restored (was removed in the mascot pass).
- **AP/Coaches Top 25 rankings** — Neil asked for ranked teams to show their
  rank. Confirmed via live ESPN data: `competitor.curatedRank.current` gives
  1-25 for ranked teams, with **99 as ESPN's "unranked" sentinel** (not
  null/undefined — had to check a real response to catch this). New `rank`
  field on `normalizeEvent()`'s home/away objects (`js/live-scores.js`),
  only non-null when `curatedRank.current <= 25`. Shown as a small "#N"
  badge (new `.game-card-team-rank`, accent-colored) right before the
  school name on NCAA game cards. College-only concept — NFL's `rank` is
  always null since ESPN doesn't return `curatedRank` for pro games.
- Bumped `sw.js` to `full-regalia-shell-v76`, committed, pushed, confirmed live.

### 2026-09-04 — Nav reorder, filter/click investigation, team pick history
- **Moved Games ahead of History** in the bottom nav on all 8 pages that
  have it (Admin deliberately has none, unchanged).
- Neil reported the NFL/NCAA conference filters on the Games page and
  clicking a team both "not really working." Investigated extensively:
  - Built clean, controlled test data for the conference filter (AFC-only
    game vs. NFC-only game) and confirmed `gameMatchesConference()`
    correctly reduces the list when a chip is clicked — the underlying
    logic is sound. (An earlier test run gave a false positive because the
    mock data itself had Miami mis-assigned to the wrong conference — a
    test bug, not an app bug.) Cross-checked all 67 hardcoded NCAA Power-4
    abbreviations (`NCAA_TEAM_TO_CONF`, `js/pick-utils.js`) against live
    ESPN data — all 67 matched real current abbreviations exactly.
  - Tested the full team-click flow (game card → Analytics `?team=X&opp=Y`)
    end to end — navigates correctly, renders both teams, zero errors.
  - Couldn't reproduce a functional bug in either case. Best working theory:
    the team detail page read as "not working" because it was mostly empty
    early in the season ("No finished games yet") rather than an actual
    defect — addressed below by giving it real substance. Flagged to Neil
    to get exact repro steps (which chip, what was expected vs. seen) if
    this persists on his device.
- **New: "Who's picked [team]" on Analytics team detail** — Neil wanted to
  see who in the league has bet on a team, which week, and whether it hit,
  alongside the team's own ATS/O-U record. New `teamPickHistoryHtml()`
  (`analytics.html`) filters the same `graded` picks list already computed
  for Player Comparison down to picks whose game involves this team (either
  side, any bet type — an Over/Under pick on the team's game counts too,
  not just picks literally naming the team), sorted most recent first, each
  row showing avatar, player, week, their pick, and a Hit/Miss/Push badge.
  Shown for both teams when viewing a matchup (?team=X&opp=Y).
- Bumped `sw.js` to `full-regalia-shell-v77`, committed, pushed, confirmed live.

### 2026-09-04 (cont'd) — Replaced Guide with Analytics in the bottom nav
- Neil went with the recommendation to keep History (settled record of what
  happened) and instead swap out Guide for Analytics in the bottom nav —
  Guide is a reference doc people check once, not something tapped
  repeatedly, and it's already reachable from Home's hub grid, so nothing's
  lost. New nav order across all 8 pages: Home, Picks, Standings, Games,
  History, Analytics. New line-icon (axis + 3 ascending solid bars) matches
  the style of the other 5 nav icons.
- Bumped `sw.js` to `full-regalia-shell-v78`, committed, pushed, confirmed live.

### 2026-09-04 (cont'd 2) — AP rank badge in cursive
- `.game-card-team-rank` ("#5" next to a ranked NCAA team) switched to the
  same Pacifico cursive used everywhere else (topbar, quote, standings rank
  numerals, confirm modal title) instead of plain bold text — Neil wanted
  it consistent with the rest of the page's branding.
- Bumped `sw.js` to `full-regalia-shell-v79`, committed, pushed, confirmed live.
