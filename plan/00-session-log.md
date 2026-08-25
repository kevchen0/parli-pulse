# Current state and handoff

Read this first. [10-mistakes.md](10-mistakes.md) second, before touching
scoring or identity — several bugs there were reintroduced after being fixed,
in tooling written later.

---

## Where things stand

Phases 0-4 complete and deployed. **Phase 5 (Glicko-2) is next** and needs
nothing from the user.

| | |
|---|---|
| Per-entry Article XXI agreement | **98%** (1529/1564) |
| NPDL-TOC, NYPDL | **100%** each |
| CHSSA | 99% |
| Regular invitationals | 96% |
| Partnership season totals, all 835 | **87% exact** |
| The league's top 100 | **92% exact**, 95% within 2% |

Loaded for 2025-26: 97 tournaments, 4,907 entries, 25,795 ballots, 799
partnerships, 1,183 debaters with points, 47 member schools, 387 ranked
speakers, 35 open disagreements.

Live at `/rankings`: teams, debaters, schools, speakers, and a diagnostic tab
reconciling every partnership against the league result by result.

## Commands

| | |
|---|---|
| `npm run load` | rebuild a season from cached payloads (`SEASON=` to pick) |
| `npm run rollup` | identity merging, then team/debater/school standings |
| `npm run speaks` | judge-normalized speaker points |
| `npm run diagnostics` | the reconciliation the site displays |
| `npm run backtest` | fields, per-entry, partnerships |
| `npm run compare` / `npm run diagnose` | top-N accuracy, cause attribution |
| `npm test` | 73 tests, mostly the rules engine |

**Order matters:** `load` → `rollup` → `speaks` → `diagnostics`.

## Things that will bite you

- **Node runs `.ts` directly.** No build step, no tsx. Imports use explicit
  `.ts` extensions so Node and Vitest agree.
- **`.env` lives at the repo root**, and `apps/web/.env` is a symlink to it —
  Next reads env from the app directory, not the root. Vercel uses its own
  dashboard variables.
- **Never run `next build` while the dev server is up.** It clobbers the dev
  cache and the page dies with a webpack error. Stop the server, `rm -rf
  apps/web/.next`, restart. This cost two debugging cycles.
- **`schools` and `debaters` are not season-scoped**, so they are never
  cleared. They must be *upserted*. Inserting with `onConflictDoNothing` leaves
  stale rows and a correction silently does nothing — this has bitten three
  times, most visibly when a fixed membership flag changed no rows.
- **All comparison and aggregation goes through `scripts/lib/standings.ts` or
  `packages/ingest/src/matching.ts`.** Never write a new match key. Surnames
  alone collapse "Egleson & S. Goyal" into "Egleson & N. Goyal", two real Menlo
  teams 73 points apart, and it will invent data problems that do not exist.
- **Raw payloads are gitignored** (~370MB in `data/raw/`). A fresh clone cannot
  run the backtests until they are re-fetched from Tabroom.

## Where the remaining error lives

Catalogued in [09-data-quality.md](09-data-quality.md). Most of it is not ours:

- **~30 results** at tournaments that published little or nothing to Tabroom
  (Ridge Debates published 4 of 28 teams; Randolph Fall Classic, CBSR 3, Ryan
  Rutledge). Manual entry is the only route.
- **14 at El Cerrito**, where the league applied a −1 adjustment that 27 of 28
  comparable tournaments did not. Probably their error.
- **~8** where the league splits one partnership across two registrations and
  we merge them. A modelling difference.
- **6 at UCLA**, where Tabroom shows six prelims and the league counted five.
- **~5** human `manual_adj` overrides, and **3** league typos creating phantom
  teams.

Realistic ceiling without manual entry is about 88-89%.

## Next

1. **Phase 5, Glicko-2.** The evidence and recommendation are in
   [05-metrics.md](05-metrics.md) — build the partnership rating first, ship it
   with uncertainty visible, then test an individual-level rating against it.
   Do not add an elim multiplier; elims are already priced in through opponent
   quality.
2. **Phase 6, profiles.** Probably the highest user value left — the rankings
   are currently a dead end with nothing to click into. Gated on the
   minors-privacy decision in [07-open-questions.md](07-open-questions.md).
3. **Phase 7, live season**, before the 2026-27 opener (Harvard, Sept 5-6).

## Waiting on the user

None of it blocking:

- Whether a partnership follows the people or the registration.
- Manual entry for Ridge Debates, worth −54 to Ridge's school total.
- Which season the alternative non-break point table belongs to, before
  2026-27 opens.
- What may be shown on a debater profile page.
