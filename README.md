# Full Regalia League

A shareable, mobile-first site for the Full Regalia pick'em league — live standings,
picks, scores, odds, and a betting-rules guide, installable to your phone's home screen.

**Start here:** `BACKLOG.md` — current status and next steps.
**Full plan:** `ROADMAP.md` — architecture decisions and the complete build plan.

## Running it locally

No build step — it's plain HTML/CSS/JS. Any static file server works, for example:

```
npx serve .
```

Then open the printed `localhost` URL on your phone (same wifi network) or in a
desktop browser.

## Status

Early beta. Standings uses sample data snapshotted from the workbook; Picks entry
saves to your browser only (not synced across the group yet); Live scores/odds aren't
wired up yet. See `BACKLOG.md` for what's next.
