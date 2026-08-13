# Full Regalia League — Backlog

**Open this file first each session.** Full reasoning/architecture lives in `ROADMAP.md`.

## Status

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
  3. ⛔ **Still blocked — Super Admin panel** (add players, rename without
     losing history). This is the one that needs real architecture work — see
     below. Not started.
  - **The real architectural piece (why item 3 needs planning, not just
    coding):** player names currently live as a hardcoded list in `js/app.js`
    (`LEAGUE_PLAYERS`), and `picks.player_name` stores the name as plain text.
    Renaming someone today would orphan their old picks (still tagged with the
    old name). The correct fix is a real `players` table with a stable id, and
    `picks` referencing that id instead of storing the name directly — then a
    rename is just editing a label, every historical pick follows automatically.
    This also makes "add a player" a real DB action instead of something only
    Claude can do by editing code and redeploying.
  - **One open decision, asked but not yet answered — do not build until
    Neil weighs in:** **admin auth strength.** Option A (recommended): a real
    Supabase Auth login for Neil (email+password) — genuine security, the
    database itself enforces only that logged-in account can write to the
    players table, not bypassable via browser dev tools. Small one-time setup
    (Neil creates one login). Option B: reuse the existing passphrase-gate
    pattern (`js/gate.js`) — quick, consistent with the beta gate, but same
    honest caveat as before: client-side speed bump, not real security — and
    this time it'd be protecting who's officially in the league, not just
    picks, so leaning against it, but it's Neil's call.
  - **SQL that will be needed once the decision lands** (not written yet — exact
    shape of the admin-write RLS policy depends on decision #1 above):
    - Create a `players` table (id uuid primary key, name text unique, couple
      text nullable, active boolean default true, created_at).
    - Seed it from the current `LEAGUE_PLAYERS` list in `js/app.js` (15 players).
    - Add `player_id uuid references players(id)` to `picks`; backfill existing
      rows by matching `player_name` text to the new table; can drop
      `player_name` later once confirmed working, or just leave it as a
      harmless legacy column.
    - New RLS: `players` needs public SELECT (everyone reads the roster to
      populate the picker dropdown); INSERT/UPDATE on `players` needs to be
      locked down per decision #1 — either `using (auth.uid() = '<neil's uid>')`
      style (Option A) or left open like `picks` currently is (Option B, not
      recommended here).
    - `picks` RLS policies need updating to reference `player_id` instead of
      `player_name` once the migration happens.
  - Not blocking the rest of the site — Standings computation (next up
    regardless) doesn't depend on this.
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
2. **Done (2026-08-13):** the "8 picks/week, 4 categories" redesign — see Status
   above for full detail. **First thing next session: confirm the DELETE grant
   was run and actually test a category-swap end to end** (the one path not yet
   empirically verified).
3. **Build the live Standings computation** — query all picks from Supabase,
   cross-reference with graded results (`js/grading.js`, already built and
   tested), sum points per player. This is what finally makes Standings stop
   being a frozen snapshot. Next up once the swap path is confirmed.
4. Championship/Bowl Picks page — still needs its own scoping for prop bets
   (First TD scorer, etc.) that the current category system doesn't cover.
   Lower urgency, months out.
5. **Done:** per-week "who's submitted picks" tracker — see checklist/Status
   above. **Still blocked on Neil:** players-table migration + Super Admin
   panel (add/rename players) — one decision needed before building: admin
   auth strength (real Supabase login vs. passphrase gate).

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
- [ ] **Live Standings computation** — query Supabase picks + graded results, sum
      points per player. This is the last piece of "eliminate Excel." Next up
      once the swap path above is confirmed.
- [x] **Per-week "who's submitted picks" tracker** — collapsible card at the top
      of the Make Picks view, visible to everyone, sorted least-complete-first
- [ ] **Players table migration** — real DB table with a stable id, so renaming a
      player doesn't orphan their pick history (currently just a hardcoded list
      + plain-text name on each pick row). Blocked on Neil picking admin auth
      strength (real Supabase login vs. passphrase gate) — see Status section.
- [ ] **Super Admin panel** — add/rename players through the site instead of a
      code change + redeploy. Blocked on the same decision as above.
- [ ] Championship/Bowl Picks page — needs its own scoping for prop bets, lower
      urgency (months out)

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
