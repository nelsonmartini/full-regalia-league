# Full Regalia League — Backlog

**Open this file first each session.** Full reasoning/architecture lives in `ROADMAP.md`.

## Status

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
7. **New backlog, not started — stats/trends pages** (Neil's idea, sourced
   from teamrankings.com):
   - **Team ATS trends per betting category.** teamrankings.com/nfl/trends/ats-trends
     (and the college-football equivalent) publishes exactly this: how each
     team performs against the spread, over/under, as favorite/underdog —
     maps closely onto our own 4 categories. No public API — would need
     either scraping (fragile, same "fails soft" caution as the ESPN
     integration, more so since it's not CORS-open like ESPN's endpoint, so
     it can't be fetched client-side and would need a small server-side
     fetcher) or manual/periodic data entry. Needs its own research pass
     before committing to an approach.
   - **Player (league member) performance history per betting category.**
     E.g. "Neil hits 68% on Unders but only 40% on Plus Spread this season."
     Unlike the team-trends idea, this needs NO external source — it's
     fully derivable from data already in Supabase: every saved pick already
     records its category (via `pickCategory()` in `js/pick-utils.js`) and
     gets graded (`js/grading.js`). Just needs a new aggregation (group
     graded picks by player + category, compute hit rate) and a place to
     show it — natural fit for `player.html`, next to the existing points
     trend.
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
- [ ] **Stats/trends pages (new backlog, 2026-08-14):** team ATS trends
      (possibly sourced from teamrankings.com) and per-player category
      performance history, possibly surfaced via a new "Analytics" tab
      replacing "Live" in the bottom nav. Deferred until after the season
      starts and there's real data — see Status → "New backlog" for detail.

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
