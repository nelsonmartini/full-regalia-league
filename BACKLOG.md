# Full Regalia League — Backlog

**Open this file first each session.** Full reasoning/architecture lives in `ROADMAP.md`.

## Status

- **Current phase:** Core feature-complete beta as of 2026-08-01. Live at
  **https://nelsonmartini.github.io/full-regalia-league/** (passphrase `regalia2026`).
  7 pages: Home, Standings, Picks, History, Player detail, Live, Betting Guide.
- **What's real vs. sample data right now:**
  - Standings: still sample/snapshot data from the workbook (not live-wired to the Sheet).
  - History + Player pages: real, full season data (344 picks, 23 weeks, 16 players) —
    but it's a frozen snapshot parsed from the workbook, not live either.
  - Picks page: **fully real** — live current games + live odds from ESPN, saves
    locally per-device.
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
1. **Blocked on Neil:** talk to the site's eventual owner about Firebase vs. Supabase
   (cost, who administers it) — this unblocks the real backend build, which is now the
   top-priority next feature.
2. **Player avatars** — clickable avatar next to each name (Standings, Picks
   player-select, History) so it's obviously "you" at a glance, and so a tap jumps
   straight to that person's results/money-won view. Asked 2026-08-01. Needs a
   decision: real photos (someone has to supply them) vs. generated avatars
   (initials-on-color, no photo needed — faster, no dependency on anyone). Leaning
   generated for a fast v1, real photos as an upgrade later. Not blocked on the
   backend decision — can build this anytime.
3. Championship/Bowl Picks page (Divisional/Conf Champ/Super Bowl — same pattern as
   Picks, proven out now that Picks pulls real games). Not blocked on the backend
   decision either — this is frontend/live-data work like tonight's Picks page.
4. Results page (a straight log of finished games + scores — mostly "for free" now
   since live-scores.js already fetches this; just needs its own page/view).
5. **The real backend** (once Firebase/Supabase is chosen — see item 1): picks sync
   across the group instead of living in each person's browser, standings compute
   themselves from graded results, and money-won tracking becomes possible. This is
   the actual "eliminate Excel" milestone — everything else is groundwork for it.

## Living checklist

- [x] Read `Full Regalia 2025 Pick'Em.xlsx` and map all 7 tabs to a site structure
- [x] Confirm architecture decisions with Neil (picks UI vs. full backend; data source)
- [x] Write `ROADMAP.md`
- [x] Write `BACKLOG.md`
- [x] Site shell: shared CSS design system, nav (bottom tab bar on mobile)
- [x] PWA manifest + icons + basic service worker (Add to Home Screen)
- [x] Betting Guide page (static content from the workbook, ported as-is; dropped one
      slightly off-tone line from the original to keep it welcoming for the whole group)
- [x] Standings page (sample data tonight, 15 players, sorted by points)
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
- [ ] Player avatars (generated initials-on-color for v1) — clickable, next to names on
      Standings/Picks/History, tap-through to that player's results/money-won view
- [ ] Championship/Bowl Picks page
- [ ] Results page (dedicated view — data's already flowing via live-scores.js)
- [ ] **The real backend** (Firebase or Supabase — choice deferred pending a
      conversation with the site's eventual owner). This is now the top-priority
      feature: picks synced across the group, standings computed automatically,
      money-won tracking possible — the actual "eliminate Excel" milestone.
- [ ] Real logo/wordmark (using text mark for now)

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

### Next session — resume here
- **Top priority, blocked on Neil:** the Firebase-vs-Supabase conversation with the
  site's eventual owner. Once decided, the real backend becomes the main build:
  shared picks storage + live-computed standings, replacing localStorage entirely.
- Not blocked, can build anytime: player avatars, Championship/Bowl Picks page,
  Results page.
- Do **not** revisit "wire Standings to the Google Sheet CSV" — that direction was
  explicitly dropped in favor of the real backend (see above).
- Remember to bump `sw.js`'s `CACHE` constant on any deploy touching a cached file.
