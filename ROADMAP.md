# Full Regalia League Site — Roadmap

This is the **reference plan**: architecture decisions, the full page list, and honest
cost/effort estimates. For "what's happening right now," open `BACKLOG.md` instead —
that's the living tracker we update every session.

## What this is

A shareable, mobile-first site for your pick'em group (currently 15 players, mostly
couples: Alex/Calli, Drew/Michaela, Sean/Carlie, Jacob/Emma, Nick/Emily, Louie/Josie,
Jack/Connor, Phil) — built from the structure in your `Full Regalia 2025 Pick'Em.xlsx`
workbook. Goal: everyone can open one link, see live standings/scores/odds, and
(eventually) submit picks — then add it to their phone's home screen so it feels like
a real app, not a spreadsheet.

## Decisions made (2026-07-29)

| Decision | Choice | Why |
|---|---|---|
| Picks submission | **Real, nice-feeling picks-entry UI now; the backend behind it is a placeholder.** People can actually tap through and fill out their picks in the beta — it just doesn't write anywhere permanent yet (saved locally in the browser as a stand-in). | You clarified the beta priority is a good *entry* experience, not a fully wired backend — that's still its own phase. |
| **The automation goal (headline feature)** | Replace the weekly manual grind — looking up final scores, retyping them into the Results tab, hand-computing win/loss/points, updating Standings — with an automatic pipeline: live scores fetched → auto-graded against each person's picks → Standings recomputed on its own. | This came directly from your feedback: the real point of "backend numbers" isn't just displaying a spreadsheet online, it's killing the copy/paste-every-week work. This is the thing worth building first, once live scores are wired up. |
| Data backend | **Keep the Excel/Google Sheet** as the system of record for who picked what. Publish it to the web as a CSV feed; the site reads it live, and (later) the auto-grading pipeline reads live scores + the sheet together to compute points instead of a human doing it. | You already know how to edit a spreadsheet. Zero new cost, no new accounts to manage tonight. |
| Hosting | **GitHub Pages**, static site, no build step (plain HTML/CSS/JS). | Free, matches your ask, and no build tooling (Node/React) for a non-technical maintainer to fight with later. |
| "Add to Home Screen" | **PWA manifest + icons**, installable on iOS/Android. | Makes the site behave like an app icon on the phone, per your ask. |
| Live scores | **ESPN's free public scoreboard API** (unofficial, no key needed) for NFL + college football. | No signup required, works today. Risk: it's undocumented/unofficial and could change without notice — acceptable for a friend league, not something to build a business on. This also feeds the auto-grading pipeline above, so it's high-priority, not just a "nice to have" widget. |
| Live odds | **Try ESPN's built-in odds data first** (often included free in the same scoreboard response). If it's missing games we need, fall back to **The Odds API** (free tier, ~500 requests/month, requires a free signup for an API key). | Avoids a second account/key if we don't need it. |

## Security note (read this one)

Because this is a 100% static site with no server, any API key we use (if we end up
needing The Odds API) would be visible to anyone who views the page source — there's
no server to hide it behind. For a private site shared only with your group, with a
free/low-value key, that's a reasonable trade-off (worst case someone burns your free
monthly quota, not a real security incident). If this ever gets a real audience or a
paid API tier, the fix is a small serverless proxy (e.g., a Cloudflare Worker) that
holds the key server-side — worth revisiting later, not tonight.

Also: a **public GitHub repo means the site's code is public.** That's normal and fine
for a site like this (no passwords, no personal financial info in the code itself).
Just don't commit anything like API keys, phone numbers, or Venmo/Zelle details directly
into the repo — we'll keep the "Winnings" money-owed data conceptually separate later
if we ever pipe it in raw.

## Site map (your 7 tabs → pages)

| Workbook tab | Site page | Tonight? |
|---|---|---|
| Picks | **Picks** — real picks-entry UI (dropdowns/buttons per game), saves locally for now | Tonight (UI only, no backend write yet) |
| Championship Picks | **Bowl/Championship Picks** — same pattern for Divisional/Conf Champ/Super Bowl | Later |
| Game Lines | **Live Odds & Scores** — real-time lines + live scores | Later (needs API wiring) |
| Results | **Results** — graded results feed | Later |
| Standings | **Standings** — leaderboard: rank, points, win %, paid?, winnings | Tonight (sample data) |
| History | **History** — season archive, filterable by player/week | Later |
| Betting Guide | **Betting Guide** — your existing spread/moneyline/O-U explainer + video | Tonight (fully static) |
| — | **Home** — dashboard: this week at a glance, top-3 standings, next game countdown | Tonight |

## Design direction

Fresh, modern "friend-group app" feel (think a clean fantasy-sports app), not a
sportsbook or spreadsheet look — deliberately welcoming to the couples in the group,
not bro-heavy. Deep charcoal/navy base, warm amber/coral accent, generous white space,
rounded cards, mobile-first with a bottom tab bar (feels native once added to a home
screen). Shared design system lives in one CSS file so every page stays consistent.

## Effort & cost estimate

| Phase | Effort | Cost |
|---|---|---|
| Tonight: shell, design system, PWA, Betting Guide, Standings (sample data), Home, Picks-entry UI (local only) | ~1 session | $0 |
| Publish Google Sheet to web + wire Standings/History to live data | 30–60 min | $0 |
| Live scores (ESPN) integration | 1–2 hrs | $0 |
| **Auto-grading pipeline** (live scores → match against picks → compute win/loss/points → update Standings, no manual copy/paste) | 3–5 hrs — the meatiest single feature, do this right after live scores are in | $0 |
| Live odds integration | 1–2 hrs | $0 (free tier) or ~$0–30/mo if we outgrow the free odds API tier |
| Remaining pages (Championship Picks, Results, History) | 2–4 hrs | $0 |
| Picks submission — real backend (writes picks somewhere permanent, per-person, can't edit others') | Its own project — needs a backend decision (small serverless function, or migrate off Sheets to something like Firebase/Supabase) | $0–10/mo typical at this scale |
| Domain name (optional — `yourleague.com` instead of a github.io URL) | 15 min | ~$12/yr |

Nothing here requires paid hosting at your group's size. The only genuinely optional
cost is a custom domain.

## Open items that need your input later (not blocking tonight)

- GitHub repo name/visibility — defaulting to a public repo named `full-regalia-league`
  under your `nelsonmartini` account unless you say otherwise.
- Google Sheet: needs "Publish to web" turned on (File → Share → Publish to web, per
  tab, as CSV) before we can wire pages to live data.
- A real logo/wordmark for "Full Regalia" — using a simple text mark tonight.
- Odds API signup, if/when we need it beyond what ESPN gives us free.
