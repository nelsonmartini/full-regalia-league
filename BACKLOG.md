# Full Regalia League — Backlog

**Open this file first each session.** Full reasoning/architecture lives in `ROADMAP.md`.

## Status

- **Current phase:** Initial build — tonight's session (2026-07-29). Site shell, PWA
  install support, Betting Guide, Standings (sample data), Home dashboard, and Picks
  entry UI (local-only) are all built and browser-tested locally with no console errors.
- **Next action:** Confirm with Neil before creating the GitHub repo + enabling Pages
  (makes the code public — see ROADMAP.md security note). Then publish the Google
  Sheet to web and wire Standings/History to the live feed.
- **Live site:** not deployed yet — built and tested locally (`npx serve .`), not yet
  pushed to GitHub.

## Next 7 days

1. **Tonight:** site shell (nav, design system, PWA manifest/icons), Betting Guide page,
   Standings page (sample data), Home dashboard, Picks-entry UI (saves locally, no
   backend yet). Get it viewable on your phone via a local server or GitHub Pages.
2. Create the GitHub repo (`full-regalia-league`, public, under `nelsonmartini`) and
   turn on GitHub Pages — confirm with you first since this makes the code public.
3. Publish the Google Sheet to the web (File → Share → Publish to web → CSV, per tab) —
   this is a 2-minute action only you can do since it's your sheet.
4. Wire Standings + History pages to the live published CSV instead of sample data.
5. Wire up ESPN's free scoreboard API for live NFL + college football scores on Home
   and a Results page.
6. Start the **auto-grading pipeline** (the headline automation feature): live scores →
   match against each person's picks → compute win/loss/points automatically → Standings
   updates itself. This is what actually kills the manual copy/paste-every-week work.

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
- [ ] Test on an actual phone — add to home screen, confirm it looks/feels like an app
- [ ] Init local git repo
- [ ] Create GitHub repo + enable Pages (confirm with Neil first — makes code public)
- [ ] Publish Google Sheet to web as CSV (Neil to do)
- [ ] Wire Standings/History to live CSV
- [ ] Live scores via ESPN scoreboard API
- [ ] **Auto-grading pipeline** — the core value prop, do right after live scores work
- [ ] Live odds (ESPN first, fall back to The Odds API signup if needed)
- [ ] Championship/Bowl Picks page
- [ ] Results page (auto-populated once grading pipeline exists)
- [ ] History page (filterable by player/week)
- [ ] Real picks-submission backend (own project — needs backend/auth decision)
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
- Next session: confirm repo name/visibility, push to GitHub, enable Pages, test
  "Add to Home Screen" on an actual phone.
